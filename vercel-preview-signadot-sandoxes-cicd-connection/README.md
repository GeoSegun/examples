# Tutorial: Connect Vercel Previews to Signadot Sandboxes for Full-Stack Preview Environments

Modern frontend teams rely heavily on Vercel Preview Deployments to validate UI changes. However, there's an inherent limitation: Vercel previews almost always point to a static backend (staging/production), which breaks when a frontend PR depends on a backend change.

This tutorial provides a hands-on guide to building an automated system that:
- Creates isolated Signadot sandboxes for each frontend PR
- Automatically connects Vercel previews to the corresponding backend sandbox
- Enables full-stack testing in ephemeral environments

**Time required:** 30-45 minutes

> **Note:** The configuration files and code referenced in this guide can be found in the following repository:  
> https://github.com/signadot/examples/tree/main/vercel-preview-signadot-sandoxes-cicd-connection

---

## Prerequisites

Before starting, ensure you have:

1. **GitHub Account** with two repositories (or a monorepo):
   - Frontend repository (Next.js application)
   - Backend repository (Node.js/Express API)

2. **Vercel Account** with:
   - A project connected to your frontend repository
   - API token for GitHub Actions

3. **Signadot Account** with:
   - API key
   - Organization name
   - Kubernetes cluster registered (AWS EKS, GKE Standard, or other supported cluster)

4. **Kubernetes Cluster** with:
   - Backend deployment already running
   - Signadot Operator installed (or install via workflow)

5. **Container Registry** (Docker Hub, GHCR, or GCR):
   - Account with push permissions

> **Note:** Signadot Operator cannot run on GKE Autopilot. Use GKE Standard or AWS EKS.

## Architecture Overview

The integration works as follows:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Frontend PR    │───▶│  GitHub Actions │───▶│  Signadot       │
│  (Vercel)       │    │  Workflow       │    │  Sandbox        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Vercel Preview  │
                       │  (with sandbox   │
                       │   URL injected)  │
                       └──────────────────┘
```

### Workflow Steps

1. **Developer opens PR** on frontend repository
2. **GitHub Actions triggers** the preview workflow
3. **Backend code is checked out** from the repository
4. **Docker image is referenced** (from backend CI workflow)
5. **Signadot sandbox is created** with the backend image
6. **Sandbox URL is extracted** (e.g., `https://backend-api--backend-pr-5.sb.signadot.com` or `https://backend-api--backend-pr-5.preview.signadot.com`)
7. **Vercel preview is deployed** with sandbox URL as `NEXT_PUBLIC_API_URL`
8. **PR comment is posted** with both frontend and backend preview URLs

## Step 1: Prepare the Backend

### 1.1. Deploy the Baseline Backend

First, deploy your backend to Kubernetes. The example includes minimal backend code in the `backend/` directory.

**Before deploying, update the image reference:**

1. Open `k8s/deployment.yaml` (or `backend/k8s/deployment.yaml`)
2. Replace `YOUR_REGISTRY` with your container registry (e.g., `docker.io/username` or `ghcr.io/username`)
3. The image line should look like: `image: docker.io/username/vercel-signadot-backend:latest`

**Deploy to Kubernetes:**

```bash
# Apply the Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Verify the deployment
kubectl get deployment vercel-signadot-backend -n default
kubectl get service vercel-signadot-backend -n default
```

### 1.2. Create sandbox.yaml

The `backend/sandbox.yaml` file defines how Signadot creates sandboxes. See `backend/sandbox.yaml` for the complete configuration.

**Key points:**
- The `defaultRouteGroup.endpoints` section is **required** for Signadot to generate preview URLs
- The image reference will be replaced by the workflow during CI
- The sandbox name will be replaced with a PR-specific name

## Step 2: Prepare the Frontend

### 2.1. Configure API URL Handling

The frontend uses `src/lib/config/api.ts` to handle API requests. This file:
- Automatically routes Signadot URLs through a Next.js API proxy (keeps API key server-side)
- Makes direct requests for non-Signadot URLs (production/local)

See `frontend/src/lib/config/api.ts` for the implementation.

### 2.2. Create API Proxy Route

The `src/app/api/proxy/[...path]/route.ts` file handles Signadot authentication server-side. This ensures the `SIGNADOT_API_KEY` is never exposed to the client browser.

See `frontend/src/app/api/proxy/[...path]/route.ts` for the implementation.

**Security Note:** Never use `NEXT_PUBLIC_SIGNADOT_API_KEY` - this would expose the key to the client. Always use `SIGNADOT_API_KEY` (without `NEXT_PUBLIC_` prefix) and route requests through the API proxy.

### 2.3. Use the API Configuration

In your components, use the API configuration:

```typescript
import { getApiUrl, getApiHeaders } from '@/lib/config/api';

const response = await fetch(getApiUrl('/health'), {
  headers: getApiHeaders()
});
```

The example includes a `BackendStatus` component (`frontend/src/components/BackendStatus.tsx`) that demonstrates this pattern.

## Step 3: Set Up Backend CI Workflow

Create `.github/workflows/ci.yml` in your **backend** repository. The example workflow is in `backend/.github/workflows/ci.yml`.

**Key features:**
- Builds Docker images on PR and push events
- Tags images with branch name + SHA, short SHA, and `latest` (on default branch)
- Pushes to configurable registry (Docker Hub, GHCR, GCR)

## Step 4: Set Up Frontend Preview Workflow

Create `.github/workflows/vercel-preview.yml` in your **frontend** repository. The example workflow is in `frontend/.github/workflows/vercel-preview.yml`.

**On a `pull_request` trigger, the workflow:**

1. **Checkout** code (both frontend and backend repositories)
2. **Create Signadot Sandbox:** Uses the Signadot CLI to spin up a sandbox for the backend
   - **Note:** This implementation uses `signadot` CLI directly rather than `signadot/sandbox-action` GitHub Action
   - The workflow checks out the backend repo and applies the `sandbox.yaml` configuration
3. **Get Sandbox URL:** Captures the `sandbox-url` output using `signadot sandbox get -o json`
   - The URL format is typically `https://<endpoint>--<sandbox-name>.sb.signadot.com` or `.preview.signadot.com`
4. **Deploy Vercel Preview:** Uses `amondnet/vercel-action` to deploy the frontend
   - **Note:** This implementation uses `amondnet/vercel-action@v25` rather than `vercel/action`
5. **Inject the URL:** Passes the sandbox URL as a build-time environment variable:
   ```yaml
   vercel-args: '--build-env NEXT_PUBLIC_API_URL=${{ steps.sandbox.outputs.sandbox-url }}'
   ```
   This ensures `NEXT_PUBLIC_API_URL` is available during the Next.js build process.

## Step 5: Configure GitHub Secrets

### Frontend Repository Secrets

Add these secrets to your **frontend repository**:

#### Vercel Secrets
- `VERCEL_TOKEN` - Your Vercel API token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

#### Signadot Secrets
- `SIGNADOT_API_KEY` - Your Signadot API key
- `SIGNADOT_ORG` - Your Signadot organization name

#### Backend Repository Access
- `BACKEND_REPO` - Full repository name (e.g., `owner/vercel-signadot-backend`)
- `GH_PAT` - GitHub Personal Access Token with `repo` scope

#### AWS Secrets (for EKS cluster access)
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (e.g., `eu-north-1`)
- `AWS_EKS_CLUSTER_NAME` - Name of your EKS cluster

#### Docker Hub Secrets
- `DOCKERHUB_USERNAME` - Docker Hub username

### Backend Repository Secrets

Add these secrets to your **backend repository**:

#### Container Registry Secrets
- `REGISTRY` - Docker registry URL (e.g., `docker.io`, `ghcr.io`)
- `DOCKERHUB_USERNAME` - Registry username (must match frontend's `DOCKERHUB_USERNAME`)
- `DOCKERHUB_TOKEN` - Registry access token for pushing images

## Step 6: Test the Integration

1. **Create a new branch** in your frontend repository
2. **Open a Pull Request** - This triggers the GitHub Action workflow
3. **Watch the GitHub Action run** - In the Actions tab, you'll see:
   - The workflow checking out code
   - Creating the Signadot Sandbox
   - Deploying to Vercel
   - Commenting on the PR
4. **Check the PR comments** - You'll see a comment with:
   - Frontend Preview URL (Vercel)
   - Backend Sandbox URL (Signadot)
5. **Click the Vercel Preview link** - Opens your frontend preview in the browser
6. **Open Developer Tools** (F12) → **Network tab**
7. **Interact with your app** - Make API calls, navigate pages, etc.
8. **Verify network requests** - You should see requests going to `/api/proxy/*` (the Next.js API proxy route) which then forwards to the Signadot preview URL server-side. In the Network tab, you'll see requests successfully hitting the unique `.sb.signadot.com` or `.preview.signadot.com` sandbox URL.

**Expected Result:** If configured correctly, your frontend will be talking only to the sandbox backend for that PR. All API requests will route through the Next.js API proxy (`/api/proxy/*`) which adds the `signadot-api-key` header server-side before forwarding to the Signadot preview URL (`https://*.sb.signadot.com` or `https://*.preview.signadot.com`).

**Verify in Network Tab:** Open browser DevTools (F12) → Network tab. You should see requests successfully hitting the unique `.sb.signadot.com` or `.preview.signadot.com` sandbox URL.

![Successful Frontend Job](./images/successful_frontend_job.png)

![Successful Backend Workflow](./images/successful_backend_workflow.png)

![Frontend Page Online](./images/frontend_page_online_ping.png)

## Troubleshooting

### Sandbox cannot be created

**Check:**
- Base deployment exists: `kubectl get deployment vercel-signadot-backend -n default`
- Operator is installed: `kubectl get pods -n signadot`
- Image exists in registry
- `sandbox.yaml` has `defaultRouteGroup.endpoints` section

### Vercel preview builds but API calls fail

**Check:**
- `NEXT_PUBLIC_API_URL` is injected into Vercel build (check build logs)
- `SIGNADOT_API_KEY` is set as runtime environment variable (without `NEXT_PUBLIC_` prefix)
- API proxy route (`/api/proxy/[...path]`) exists and is working
- Backend service is running in the sandbox

### API calls to Signadot preview URLs fail with authentication errors

**Symptom:** Requests return 401/403 errors.

**Solution:**
1. Ensure `SIGNADOT_API_KEY` is set in Vercel environment variables (without `NEXT_PUBLIC_` prefix)
2. Verify the API proxy route exists and is working
3. Check that your code uses `getApiUrl()` from `@/lib/config/api`
4. Test the API proxy route directly: `curl https://your-vercel-preview.vercel.app/api/proxy/health`

**Important:** Never use `NEXT_PUBLIC_SIGNADOT_API_KEY` - this exposes the key to the client.

### Backend Image Not Found

**Check:**
- Backend CI workflow has run and built the image
- Image exists in the registry
- Image tag matches what's referenced in sandbox.yaml
- Registry permissions are correct

### AWS EKS Access Issues

**Check:**
- AWS credentials are correct
- IAM user/role has `eks:DescribeCluster` and `eks:ListClusters` permissions
- Cluster name matches `AWS_EKS_CLUSTER_NAME` secret
- Region matches `AWS_REGION` secret

## Security Best Practices

### API Key Security

**Critical:** Never use `NEXT_PUBLIC_*` prefix for sensitive API keys. Variables with this prefix are bundled into client-side JavaScript and are visible in:
- Browser DevTools
- Network request headers
- Source code inspection

**Correct Approach:**
- Use `NEXT_PUBLIC_API_URL` for the backend URL (safe to expose)
- Use `SIGNADOT_API_KEY` (without `NEXT_PUBLIC_`) for the API key (server-side only)
- Route Signadot requests through Next.js API proxy (`/api/proxy/[...path]`)
- The proxy adds the `signadot-api-key` header server-side before forwarding requests

## Project Structure

```
vercel-preview-signadot-sandoxes-cicd-connection/
├── backend/
│   ├── .github/
│   │   └── workflows/
│   │       └── ci.yml              # Backend CI workflow
│   ├── server.js                  # Express server
│   ├── config.js                  # Configuration
│   ├── package.json
│   ├── Dockerfile
│   └── sandbox.yaml               # Signadot sandbox configuration
├── frontend/
│   ├── .github/
│   │   └── workflows/
│   │       └── vercel-preview.yml # Frontend preview workflow
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── proxy/
│   │   │   │       └── [...path]/
│   │   │   │           └── route.ts  # API proxy route
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   ├── lib/
│   │   │   └── config/
│   │   │       └── api.ts         # API configuration
│   │   └── components/
│   │       └── BackendStatus.tsx  # Backend status component
│   └── package.json
├── k8s/
│   ├── deployment.yaml            # Kubernetes deployment
│   └── service.yaml                # Kubernetes service
├── .signadot/
│   └── sandbox-template.yaml      # Sandbox template
└── README.md
```

## Conclusion

You now have a fully automated full-stack preview environment combining:
- **Vercel** for frontend previews
- **Signadot** for sandbox backends
- **GitHub Actions** for orchestration

Every frontend PR gets its own backend. Every reviewer gets reliable, isolated environments.

## Additional Resources

- [Signadot Documentation](https://www.signadot.com/docs)
- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
