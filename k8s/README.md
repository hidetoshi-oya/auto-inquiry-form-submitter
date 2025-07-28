# Kubernetes Deployment Guide

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured to access your cluster
- Docker registry for container images
- cert-manager installed for TLS certificates
- NGINX Ingress Controller installed

## Directory Structure

```
k8s/
├── base/                    # Base configurations
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── *-deployment.yaml
│   └── kustomization.yaml
└── overlays/               # Environment-specific configurations
    ├── production/
    └── staging/
```

## Deployment Steps

### 1. Build and Push Docker Images

```bash
# Build images
docker build -t your-registry/auto-inquiry-form/backend:v1.0.0 -f backend/Dockerfile.prod backend/
docker build -t your-registry/auto-inquiry-form/frontend:v1.0.0 -f frontend/Dockerfile.prod frontend/

# Push to registry
docker push your-registry/auto-inquiry-form/backend:v1.0.0
docker push your-registry/auto-inquiry-form/frontend:v1.0.0
```

### 2. Configure Secrets

```bash
# Copy and edit secrets file
cp k8s/overlays/production/secrets.env.example k8s/overlays/production/secrets.env

# Edit the file with your production values
vim k8s/overlays/production/secrets.env
```

### 3. Update Image References

Edit `k8s/overlays/production/kustomization.yaml` to point to your registry:

```yaml
images:
  - name: auto-inquiry-form/backend
    newName: your-registry/auto-inquiry-form/backend
    newTag: v1.0.0
  - name: auto-inquiry-form/frontend
    newName: your-registry/auto-inquiry-form/frontend
    newTag: v1.0.0
```

### 4. Deploy to Kubernetes

```bash
# Apply base configurations
kubectl apply -k k8s/overlays/production/

# Wait for deployments
kubectl -n auto-inquiry-form-prod wait --for=condition=available --timeout=300s deployment --all

# Check status
kubectl -n auto-inquiry-form-prod get pods
kubectl -n auto-inquiry-form-prod get services
kubectl -n auto-inquiry-form-prod get ingress
```

### 5. Initialize Database

```bash
# Run database migrations
kubectl -n auto-inquiry-form-prod exec -it deployment/prod-backend -- alembic upgrade head

# Create initial admin user (optional)
kubectl -n auto-inquiry-form-prod exec -it deployment/prod-backend -- python -m app.scripts.create_admin
```

## Monitoring

### Check Application Logs

```bash
# Backend logs
kubectl -n auto-inquiry-form-prod logs -f deployment/prod-backend

# Frontend logs
kubectl -n auto-inquiry-form-prod logs -f deployment/prod-frontend

# Celery worker logs
kubectl -n auto-inquiry-form-prod logs -f deployment/prod-celery-worker

# Celery beat logs
kubectl -n auto-inquiry-form-prod logs -f deployment/prod-celery-beat
```

### Check Resource Usage

```bash
kubectl -n auto-inquiry-form-prod top pods
kubectl -n auto-inquiry-form-prod describe pod <pod-name>
```

## Scaling

```bash
# Scale backend
kubectl -n auto-inquiry-form-prod scale deployment/prod-backend --replicas=10

# Scale celery workers
kubectl -n auto-inquiry-form-prod scale deployment/prod-celery-worker --replicas=5

# Enable HPA (Horizontal Pod Autoscaler)
kubectl -n auto-inquiry-form-prod autoscale deployment/prod-backend --cpu-percent=70 --min=3 --max=20
```

## Updating the Application

```bash
# Update image tag in kustomization.yaml
vim k8s/overlays/production/kustomization.yaml

# Apply changes
kubectl apply -k k8s/overlays/production/

# Watch rollout
kubectl -n auto-inquiry-form-prod rollout status deployment/prod-backend
kubectl -n auto-inquiry-form-prod rollout status deployment/prod-frontend
```

## Backup and Restore

### Database Backup

```bash
# Create backup
kubectl -n auto-inquiry-form-prod exec deployment/prod-postgres -- pg_dump -U postgres auto_inquiry_prod > backup.sql

# Restore backup
kubectl -n auto-inquiry-form-prod exec -i deployment/prod-postgres -- psql -U postgres auto_inquiry_prod < backup.sql
```

### Persistent Volume Backup

```bash
# Backup MinIO data
kubectl -n auto-inquiry-form-prod exec deployment/prod-minio -- tar czf /tmp/minio-backup.tar.gz /data
kubectl -n auto-inquiry-form-prod cp prod-minio-xxx:/tmp/minio-backup.tar.gz ./minio-backup.tar.gz
```

## Troubleshooting

### Common Issues

1. **Pods not starting**: Check logs and describe pod
   ```bash
   kubectl -n auto-inquiry-form-prod describe pod <pod-name>
   kubectl -n auto-inquiry-form-prod logs <pod-name>
   ```

2. **Database connection errors**: Verify secrets and service connectivity
   ```bash
   kubectl -n auto-inquiry-form-prod get secret prod-app-secrets -o yaml
   kubectl -n auto-inquiry-form-prod exec -it deployment/prod-backend -- nc -zv prod-postgres-service 5432
   ```

3. **Ingress not working**: Check ingress controller and DNS
   ```bash
   kubectl -n auto-inquiry-form-prod describe ingress prod-app-ingress
   kubectl get svc -n ingress-nginx
   ```

## Security Considerations

1. **Network Policies**: Implement network policies to restrict pod-to-pod communication
2. **RBAC**: Use proper RBAC roles for service accounts
3. **Secrets Management**: Consider using sealed-secrets or external secret operators
4. **Pod Security**: Enable pod security policies or pod security standards
5. **Image Scanning**: Scan container images for vulnerabilities before deployment