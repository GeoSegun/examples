# Tutorial: Connect Vercel Previews to Signadot Sandboxes for Full-Stack Preview Environments

Modern Vercel Preview Deployments rarely track backend changes. When a frontend pull request (PR) depends on a backend update, reviewers end up testing against stale APIs. This tutorial shows how to pair every Vercel preview with its own Signadot sandbox so that each frontend PR runs against its matching backend build.

**Time required:** 30-45 minutes  
**Repository:** https://github.com/signadot/examples/tree/main/vercel-preview-signadot-sandoxes-cicd-connection

---

## Prerequisites

- GitHub repositories (separate frontend/backend or a monorepo)
- Vercel account with a project linked to the frontend repo
- Signadot account with an API key, organization, and registered Kubernetes cluster (EKS or GKE Standard)
- Kubernetes cluster with the Signadot Operator installed
- Container registry credentials (Docker Hub/GHCR/GCR)

> Signadot Operator does not run on GKE Autopilot. Use GKE Standard or AWS EKS.

---

## Step 1: Configure the Application

### 1.1 Backend: expose a sandbox-friendly service

The example backend (`backend/`) is a minimal Express app that ships with Kubernetes manifests. Before deploying, update the image placeholder inside `k8s/deployment.yaml`:

```yaml
containers:
  - name: vercel-signadot-backend
    image: YOUR_REGISTRY/vercel-signadot-backend:latest
```

Replace `YOUR_REGISTRY` with something like `docker.io/username` and apply the manifests:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

#### sandbox.yaml

`backend/sandbox.yaml` controls how Signadot clones the baseline deployment. You only need to edit placeholders such as `DOCKERHUB_USERNAME`, `SANDBOX_IMAGE_TAG`, and `PR_NUMBER`. The important bits are:

```yaml
name: backend-pr-PR_NUMBER
workloads:
  - name: vercel-signadot-backend
    source:
      kind: kubernetes
      name: vercel-signadot-backend
    patches:
      - op: replace
        path: spec/template/spec/containers/0/image
        value: docker.io/DOCKERHUB_USERNAME/vercel-signadot-backend:SANDBOX_IMAGE_TAG
defaultRouteGroup:
  endpoints:
    - name: backend-api
      port: 8080
```

Signadot uses `defaultRouteGroup` to mint URLs like `https://backend-api--backend-pr-123.sb.signadot.com`.

### 1.2 Frontend: read the sandbox URL at build time

The frontend consumes whatever backend URL the workflow injects into `NEXT_PUBLIC_API_URL`.

- `frontend/src/lib/config/api.ts` decides whether to call the backend directly or through the proxy route.
- `frontend/src/app/api/proxy/[...path]/route.ts` keeps the `SIGNADOT_API_KEY` server-side and forwards requests to the sandbox URL.

Example usage from `BackendStatus.tsx`:

```typescript
import { getApiUrl, getApiHeaders } from '@/lib/config/api';

const response = await fetch(getApiUrl('/health'), {
  headers: getApiHeaders()
});
```

Never expose `SIGNADOT_API_KEY` via `NEXT_PUBLIC_*`. The proxy route adds the header on the server before relaying traffic to `*.sb.signadot.com`.

---

## Step 2: Create the GitHub Workflows

### 2.1 Backend CI (`backend/.github/workflows/ci.yml`)

This job builds the backend image on every PR/push, tags it, and pushes to your registry. Highlights:

- Logs in using `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN`
- Builds multi-tag images (`branch-sha`, `sha`, and `latest` on default branch)
- Publishes to the registry so sandboxes can pull the exact image associated with a frontend PR

Copy the workflow from this repo, then configure the `REGISTRY`, `DOCKERHUB_USERNAME`, and `DOCKERHUB_TOKEN` secrets in the backend repository.

### 2.2 Frontend preview workflow (`frontend/.github/workflows/vercel-preview.yml`)

Triggered on `pull_request`, it performs the following:

1. **Checkout repos** – pulls both frontend and backend sources (backend repo name comes from the `BACKEND_REPO` secret).
2. **Authenticate to AWS** – obtains kubeconfig for the EKS cluster that hosts the baseline deployment.
3. **Create/refresh Signadot Operator** – ensures the operator is present before creating a sandbox.
4. **Prepare sandbox manifest** – rewrites placeholders in `backend/sandbox.yaml` (PR number, cluster name, registry).
5. **Create sandbox** – runs `signadot sandbox apply` and captures the resulting URL via `signadot sandbox get -o json`.
6. **Deploy to Vercel** – calls `amondnet/vercel-action@v25` with `NEXT_PUBLIC_API_URL` set to the sandbox URL.

Key snippet (simplified):

```yaml
- name: Create Signadot Sandbox
  run: |
    signadot sandbox apply \
      --file backend/sandbox.yaml \
      --org "$SIGNADOT_ORG" \
      --name backend-pr-${{ github.event.number }}
- name: Deploy Vercel Preview
  uses: amondnet/vercel-action@v25
  with:
    vercel-args: '--build-env NEXT_PUBLIC_API_URL=${{ steps.sandbox.outputs.sandbox-url }}'
```

Secrets needed in the **frontend** repo:

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `SIGNADOT_API_KEY`, `SIGNADOT_ORG`
- `BACKEND_REPO`, `GH_PAT` (for cross-repo checkout)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_EKS_CLUSTER_NAME`
- `DOCKERHUB_USERNAME` (to rewrite image references)

---

## Step 3: See It Work

1. Push a branch in the frontend repo and open a PR.
2. Watch the `vercel-preview.yml` workflow:
   - Backend repo is checked out and `sandbox.yaml` is rewritten.
   - Signadot sandbox spins up using the image built by backend CI.
   - Vercel deploys with `NEXT_PUBLIC_API_URL` equal to the sandbox endpoint.
3. The workflow (or Vercel bot) comments on the PR with the preview URL.
4. Open the Vercel preview, inspect DevTools → Network, and verify calls go through `/api/proxy/*` to `https://backend-api--backend-pr-<n>.sb.signadot.com`.

You now have an isolated backend per frontend PR, so reviewers interact with exactly the code under review.

---

## Troubleshooting

- **Sandbox creation fails**
  - Confirm the baseline deployment exists: `kubectl get deployment vercel-signadot-backend`.
  - Ensure the Signadot Operator is healthy: `kubectl get pods -n signadot`.
  - Verify the image tag produced by backend CI exists in your registry.

- **Vercel preview loads but API calls fail**
  - Check that `NEXT_PUBLIC_API_URL` shows up in the Vercel build logs.
  - Ensure `SIGNADOT_API_KEY` is configured as a Vercel secret (no `NEXT_PUBLIC_`).
  - Confirm `/api/proxy/[...path]` exists in the deployed bundle.

- **401/403 from Signadot endpoints**
  - Make sure requests route through the proxy (look for `/api/proxy/health` in Network tab).
  - Retry `curl https://<preview>/api/proxy/health` locally; if it fails, verify the `signadot-api-key` header is sent server-side.

---

## Conclusion

By pairing Vercel previews with Signadot sandboxes:

- Every frontend PR is validated against the matching backend build.
- Reviewers receive URLs that reflect their exact code changes.
- GitHub Actions orchestrates the entire flow without manual steps.

Clone this repository, customize the placeholders, and you will have dependable full-stack preview environments in under an hour.

### Additional Resources

- [Signadot Documentation](https://www.signadot.com/docs)
- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
