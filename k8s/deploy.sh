#!/bin/bash
set -euo pipefail

# Deployment script for Auto Inquiry Form Submitter

# Configuration
ENVIRONMENT="${1:-production}"
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
NAMESPACE="auto-inquiry-form-${ENVIRONMENT}"
VERSION="${VERSION:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    command -v kubectl >/dev/null 2>&1 || log_error "kubectl is required but not installed."
    command -v docker >/dev/null 2>&1 || log_error "docker is required but not installed."
    
    kubectl version --client >/dev/null 2>&1 || log_error "kubectl is not properly configured."
    
    if [ ! -f "k8s/overlays/${ENVIRONMENT}/secrets.env" ]; then
        log_error "Secrets file not found: k8s/overlays/${ENVIRONMENT}/secrets.env"
    fi
}

# Build and push images
build_images() {
    log_info "Building Docker images..."
    
    docker build -t ${REGISTRY}/auto-inquiry-form/backend:${VERSION} -f backend/Dockerfile.prod backend/
    docker build -t ${REGISTRY}/auto-inquiry-form/frontend:${VERSION} -f frontend/Dockerfile.prod frontend/
    
    log_info "Pushing Docker images..."
    docker push ${REGISTRY}/auto-inquiry-form/backend:${VERSION}
    docker push ${REGISTRY}/auto-inquiry-form/frontend:${VERSION}
}

# Update kustomization with image tags
update_kustomization() {
    log_info "Updating kustomization with image tags..."
    
    cat > k8s/overlays/${ENVIRONMENT}/kustomization-temp.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: ${NAMESPACE}

bases:
  - ../../base

namePrefix: ${ENVIRONMENT}-

commonLabels:
  environment: ${ENVIRONMENT}

patchesStrategicMerge:
  - backend-patch.yaml
  - frontend-patch.yaml
  - ingress-patch.yaml

configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - ENVIRONMENT=${ENVIRONMENT}
      - LOG_LEVEL=$([ "$ENVIRONMENT" = "production" ] && echo "WARNING" || echo "INFO")

secretGenerator:
  - name: app-secrets
    behavior: replace
    files:
      - secrets.env

images:
  - name: auto-inquiry-form/backend
    newName: ${REGISTRY}/auto-inquiry-form/backend
    newTag: ${VERSION}
  - name: auto-inquiry-form/frontend
    newName: ${REGISTRY}/auto-inquiry-form/frontend
    newTag: ${VERSION}
EOF
    
    mv k8s/overlays/${ENVIRONMENT}/kustomization-temp.yaml k8s/overlays/${ENVIRONMENT}/kustomization.yaml
}

# Deploy to Kubernetes
deploy() {
    log_info "Deploying to Kubernetes (${ENVIRONMENT})..."
    
    # Apply configurations
    kubectl apply -k k8s/overlays/${ENVIRONMENT}/
    
    # Wait for deployments
    log_info "Waiting for deployments to be ready..."
    kubectl -n ${NAMESPACE} wait --for=condition=available --timeout=300s deployment --all
    
    # Run migrations
    log_info "Running database migrations..."
    kubectl -n ${NAMESPACE} exec deployment/${ENVIRONMENT}-backend -- alembic upgrade head
    
    # Show status
    log_info "Deployment status:"
    kubectl -n ${NAMESPACE} get pods
    kubectl -n ${NAMESPACE} get services
    kubectl -n ${NAMESPACE} get ingress
}

# Main execution
main() {
    log_info "Starting deployment for environment: ${ENVIRONMENT}"
    
    check_prerequisites
    
    if [ "${SKIP_BUILD:-false}" != "true" ]; then
        build_images
    else
        log_warn "Skipping image build (SKIP_BUILD=true)"
    fi
    
    update_kustomization
    deploy
    
    log_info "Deployment completed successfully!"
    log_info "Application should be available at: https://app.yourdomain.com"
}

# Run main function
main