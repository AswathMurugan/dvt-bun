# Helm Charts Deployment Guide

This directory contains Helm charts for deploying the JavaScript Executor API with YAML-based configuration.

## Files Overview

- `configmap.yml` - Application configuration and secrets
- `deployment.yml` - Deployment, service, and ingress resources
- `README.md` - This deployment guide

## Quick Deployment

### 1. Update Configuration

Edit the ConfigMap and Secret values in `configmap.yml`:

```yaml
# Update these values for your environment
stringData:
  IAM_CLIENT_ID: "your-production-client-id"
  IAM_CLIENT_SECRET: "your-production-client-secret"  
  IAM_TENANT_NAME: "your-production-tenant"
```

### 2. Deploy to Kubernetes

```bash
# Apply ConfigMap and Secrets
kubectl apply -f helm-charts/configmap.yml

# Deploy the application
kubectl apply -f helm-charts/deployment.yml
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=js-executor-api

# Check service
kubectl get svc js-executor-service

# View logs
kubectl logs -l app=js-executor-api -f

# Test health endpoint
kubectl port-forward svc/js-executor-service 8080:80
curl http://localhost:8080/health
```

## Configuration Management

### ConfigMap Structure

The application configuration is mounted at `/etc/config/application.yml` in the container:

```yaml
volumeMounts:
- name: config-volume
  mountPath: /etc/config
  readOnly: true

volumes:
- name: config-volume
  configMap:
    name: js-executor-config
```

### Environment Variables

Sensitive data is provided via Kubernetes Secrets as environment variables:

```yaml
env:
- name: IAM_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: js-executor-secrets
      key: IAM_CLIENT_ID
```

### Configuration Priority

The application loads configuration in this order:
1. `/etc/config/application.yml` (from ConfigMap)
2. Environment variables (from Secrets)
3. Environment-specific overrides

## Scaling and Resource Management

### Horizontal Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment js-executor-api --replicas=5

# Auto-scaling (optional)
kubectl autoscale deployment js-executor-api --min=3 --max=10 --cpu-percent=70
```

### Resource Limits

Current resource configuration:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

Adjust based on your workload requirements.

## Monitoring and Health Checks

### Health Endpoints

- **Liveness Probe**: `GET /health` - Checks if container is alive
- **Readiness Probe**: `GET /health` - Checks if container is ready to serve traffic

### Logging

Application logs are structured JSON format in production:

```bash
# View application logs
kubectl logs -l app=js-executor-api -f

# Filter specific log levels
kubectl logs -l app=js-executor-api | grep '"level":"error"'
```

## Security Considerations

### Network Security

- Service uses ClusterIP (internal only by default)
- Ingress with TLS termination for external access
- Network policies can be added for additional isolation

### Secrets Management

- IAM credentials stored in Kubernetes Secrets
- Secrets are base64 encoded (not encrypted by default)
- Consider using external secret management (e.g., Vault, AWS Secrets Manager)

### RBAC

Create service account and RBAC rules if needed:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: js-executor-sa
  namespace: default

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: js-executor-role
  namespace: default
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
```

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   ```bash
   # Check ConfigMap
   kubectl describe configmap js-executor-config
   
   # Check if volume is mounted
   kubectl exec -it <pod-name> -- ls -la /etc/config/
   ```

2. **Secret Values Not Available**
   ```bash
   # Check Secret
   kubectl describe secret js-executor-secrets
   
   # Check environment variables in pod
   kubectl exec -it <pod-name> -- env | grep IAM
   ```

3. **Application Startup Issues**
   ```bash
   # Check pod events
   kubectl describe pod <pod-name>
   
   # Check application logs
   kubectl logs <pod-name> --previous
   ```

### Configuration Validation

Test configuration loading:

```bash
# Exec into pod and check config
kubectl exec -it <pod-name> -- cat /etc/config/application.yml

# Test configuration loading
kubectl exec -it <pod-name> -- bun run -e "
const { getConfig } = require('./dist/config/config.loader.js');
console.log(JSON.stringify(getConfig(), null, 2));
"
```

## Environment-Specific Deployments

### Development

```bash
# Use development ConfigMap
kubectl apply -f helm-charts/configmap-dev.yml
kubectl apply -f helm-charts/deployment.yml
```

### Staging

```bash
# Use staging ConfigMap
kubectl apply -f helm-charts/configmap-staging.yml
kubectl apply -f helm-charts/deployment.yml
```

### Production

```bash
# Use production ConfigMap (default)
kubectl apply -f helm-charts/configmap.yml
kubectl apply -f helm-charts/deployment.yml
```

## Updates and Rollbacks

### Rolling Updates

```bash
# Update ConfigMap
kubectl apply -f helm-charts/configmap.yml

# Force pod restart to pick up new config
kubectl rollout restart deployment js-executor-api

# Monitor rollout
kubectl rollout status deployment js-executor-api
```

### Rollbacks

```bash
# View rollout history
kubectl rollout history deployment js-executor-api

# Rollback to previous version
kubectl rollout undo deployment js-executor-api

# Rollback to specific revision
kubectl rollout undo deployment js-executor-api --to-revision=2
```