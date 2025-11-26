# Signadot Examples

This repository contains examples for Signadot users demonstrating various integration patterns and use cases.

To file an issue, please use our [community issue tracker](https://github.com/signadot/community/issues).

## Examples

### Full-Stack Preview Environments

- **[Vercel + Signadot Integration](./vercel-preview-signadot-sandoxes-cicd-connection/)** - Connect Vercel Preview Deployments to Signadot Sandboxes for automated full-stack preview environments. Every frontend PR gets its own isolated backend instance.

### Collaborative Testing

- **[Collaborative Pre-Merge Testing for Multi-PR Features](./collaborative-pre-merge-testing-for-multi-PR-features/)** - Build unified preview environments for features spanning multiple microservices using RouteGroups and epic labels.

### Message Queue Integration

- **[RabbitMQ with Signadot](./rabbitmq-signadot-demo/)** - Demonstrate request-level isolation for RabbitMQ consumers using routing keys and selective consumption.
- **[Kafka with Signadot](./selective-consumption-with-kafka/)** - Selective message consumption in Kafka-based microservices with Signadot sandboxes.
- **[Google Pub/Sub with Signadot](./selective-consumption-with-google-pub-sub/)** - Isolated testing for Pub/Sub-based architectures.
- **[SQS-Based Microservices](./SQS-Based-Microservices-with-Signadot-main/)** - AWS SQS integration with Signadot for message routing.

### Workflow Orchestration

- **[Temporal Integration](./temporal-tutorial/)** - Integrate Temporal workflows with Signadot sandbox routing for multi-tenant applications.

### GraphQL & API Gateway

- **[Apollo GraphQL Tutorial](./apollographql-tutorial/)** - Signadot integration with Apollo GraphQL Federation.
- **[WunderGraph Tutorial](./wundergraph-tutorial/)** - Connect WunderGraph API Gateway with Signadot sandboxes.

### CLI Examples

- **[CLI Sandbox Examples](./cli/)** - Comprehensive examples of sandbox specifications using the Signadot CLI, including TTL, labels, resources, and local workloads.

### Observability

- **[OpenTelemetry Instrumentation](./instrumentation/)** - Examples for instrumenting applications with OpenTelemetry for Signadot integration.
- **[Prometheus Monitoring](./prometheus/)** - Set up Prometheus monitoring for Signadot sandboxes.

### Mobile Development

- **[HotRod iOS App](./hotrod-ios-app/)** - iOS application example using Signadot for backend routing.

### SDK Examples

- **[SDK Integration](./sdk/)** - Examples for using Signadot SDKs in Java, Node.js, and Python.

### Experimental

- **[Custom Routing with Envoy](./experimental/custom-routing-with-envoy/)** - Advanced routing patterns using Envoy proxy.

## Getting Started

1. Choose an example that matches your use case
2. Follow the README in that example directory
3. Ensure you have the prerequisites (Signadot account, Kubernetes cluster, etc.)
4. Configure the necessary secrets and credentials
5. Run through the tutorial step-by-step

## Contributing

If you have an example you'd like to contribute, please:
1. Create a new directory with a descriptive name
2. Include a comprehensive README.md
3. Add all necessary configuration files
4. Include screenshots or diagrams where helpful
5. Follow the patterns established in existing examples

