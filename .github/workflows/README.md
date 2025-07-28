# GitHub Actions CI/CD Workflows

## Overview

This project uses GitHub Actions for continuous integration and deployment. The workflows are designed to ensure code quality, security, and reliable deployments.

## Workflows

### 1. CI - Continuous Integration (`ci.yml`)

**Trigger:** On push to main/develop branches and pull requests

**Jobs:**
- **Backend Tests**: Python linting, unit tests, and coverage
- **Frontend Tests**: TypeScript checking and build verification
- **E2E Tests**: Full end-to-end testing with Playwright
- **Build Images**: Multi-platform Docker image builds
- **Security Scan**: Container vulnerability scanning

### 2. CD - Continuous Deployment (`cd.yml`)

**Trigger:** On version tags (v*) or manual workflow dispatch

**Jobs:**
- **Deploy**: Kubernetes deployment to production/staging
- **Verification**: Health checks and smoke tests
- **Post-deployment**: GitHub release creation

### 3. Security Scans (`security.yml`)

**Trigger:** Daily at 2 AM UTC or manual

**Jobs:**
- **Dependency Check**: Python and Node.js vulnerability scanning
- **Container Scan**: Trivy security scanning
- **SAST**: CodeQL static analysis
- **Secret Scan**: Gitleaks secret detection

## Required Secrets

Configure these secrets in your GitHub repository settings:

### AWS/Kubernetes Secrets
- `AWS_ACCESS_KEY_ID`: AWS access key for EKS
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (e.g., us-east-1)
- `EKS_CLUSTER_NAME`: Name of your EKS cluster

### Application Secrets
- `DATABASE_URL`: Production database connection string
- `SECRET_KEY`: Application secret key
- `JWT_SECRET_KEY`: JWT signing key
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `POSTGRES_PASSWORD`: PostgreSQL password

### Integration Secrets
- `SLACK_WEBHOOK`: Slack webhook for notifications
- `SAFETY_API_KEY`: Python Safety API key (optional)

## Usage

### Manual Deployment

1. Go to Actions tab
2. Select "CD - Deploy to Production"
3. Click "Run workflow"
4. Select environment (production/staging)
5. Click "Run workflow"

### Creating a Release

1. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. The CD workflow will automatically deploy to production

### Running Security Scans

1. Go to Actions tab
2. Select "Security Scans"
3. Click "Run workflow"

## Monitoring

### Workflow Status
- Check the Actions tab for workflow runs
- Failed workflows will notify via Slack
- Security issues create GitHub issues automatically

### Deployment Verification
- Health endpoints are checked after deployment
- Rollback occurs automatically on failure
- Smoke tests validate critical functionality

## Best Practices

1. **Always create pull requests** for code changes
2. **Wait for CI checks** before merging
3. **Use semantic versioning** for releases
4. **Review security scan results** regularly
5. **Keep dependencies updated** via Dependabot

## Troubleshooting

### CI Failures

1. **Test failures**: Check test logs in the workflow run
2. **Build failures**: Verify Dockerfile changes
3. **E2E failures**: Check service health and screenshots

### CD Failures

1. **Deployment failures**: Check Kubernetes events and logs
2. **Health check failures**: Verify service configuration
3. **Permission errors**: Check AWS/Kubernetes credentials

### Security Scan Issues

1. **Dependency vulnerabilities**: Update packages in requirements.txt/package.json
2. **Container vulnerabilities**: Update base images
3. **Code vulnerabilities**: Review CodeQL findings

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Run CI workflow
act -W .github/workflows/ci.yml

# Run with secrets
act -W .github/workflows/ci.yml --secret-file .env.local
```