#!/usr/bin/env bash
# =============================================================================
#  deploy.sh — Script de despliegue para licitapp Chile
#  Uso:
#    ./deploy.sh [docker|kubernetes] [build|deploy|full] [version]
#  Ejemplos:
#    ./deploy.sh docker full v1.0.0
#    ./deploy.sh kubernetes deploy v1.2.3
#    ./deploy.sh docker deploy   # usa imagen existente
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
APP_NAME="licitapp"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/tu-org}"
VERSION="${3:-$(git describe --tags --always 2>/dev/null || echo 'latest')}"
DEPLOY_TARGET="${1:-docker}"
ACTION="${2:-full}"
DOCKER_COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"
K8S_BASE_DIR="infrastructure/kubernetes/base"
ENV_FILE=".env.production"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------------------------------------------------------------------------
check_prereqs() {
  log_info "Verificando prerequisitos..."
  command -v docker >/dev/null 2>&1 || log_error "Docker no instalado"
  command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || log_error "Docker Compose no instalado"

  if [[ "$DEPLOY_TARGET" == "kubernetes" ]]; then
    command -v kubectl >/dev/null 2>&1 || log_error "kubectl no instalado"
    command -v kustomize >/dev/null 2>&1 || log_error "kustomize no instalado"
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    log_warn "Archivo $ENV_FILE no encontrado. Copiando desde env.example.txt..."
    cp env.example.txt "$ENV_FILE"
    log_error "Por favor configura $ENV_FILE antes de continuar"
  fi

  # Verify required secrets are set
  source "$ENV_FILE"
  local required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "ELASTICSEARCH_PASSWORD")
  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" || "${!var}" == *"CHANGE_ME"* ]]; then
      log_error "Variable requerida $var no configurada en $ENV_FILE"
    fi
  done

  log_success "Prerequisitos verificados"
}

# ---------------------------------------------------------------------------
build_images() {
  log_info "Construyendo imágenes Docker (versión: $VERSION)..."

  local services=("api-gateway" "connectors" "search" "notifications" "frontend")
  for svc in "${services[@]}"; do
    log_info "  → $svc"
    docker build \
      --target production \
      --tag "${REGISTRY}/${APP_NAME}/${svc}:${VERSION}" \
      --tag "${REGISTRY}/${APP_NAME}/${svc}:latest" \
      --label "build.version=${VERSION}" \
      --label "build.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --cache-from "${REGISTRY}/${APP_NAME}/${svc}:latest" \
      --file "infrastructure/docker/Dockerfile.${svc}" \
      . 2>&1 | tail -5
    log_success "  ✓ ${svc}:${VERSION}"
  done
}

# ---------------------------------------------------------------------------
push_images() {
  log_info "Publicando imágenes al registry..."
  local services=("api-gateway" "connectors" "search" "notifications" "frontend")
  for svc in "${services[@]}"; do
    docker push "${REGISTRY}/${APP_NAME}/${svc}:${VERSION}"
    docker push "${REGISTRY}/${APP_NAME}/${svc}:latest"
    log_success "  ✓ pushed ${svc}"
  done
}

# ---------------------------------------------------------------------------
deploy_docker() {
  log_info "Desplegando con Docker Compose..."

  export APP_VERSION="$VERSION"
  set -a; source "$ENV_FILE"; set +a

  # Run DB migrations
  log_info "Ejecutando migraciones de base de datos..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm api-gateway \
    node -e "require('./dist/migrations').runMigrations()" 2>/dev/null || \
    log_warn "Migraciones no disponibles, continuando..."

  # Rolling update services
  local services=("api-gateway" "connectors" "search" "notifications" "frontend" "nginx")
  for svc in "${services[@]}"; do
    log_info "  → Actualizando $svc..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --no-deps --build "$svc"
    sleep 5

    # Health check
    local max_attempts=12
    local attempt=0
    while [[ $attempt -lt $max_attempts ]]; do
      if docker-compose -f "$DOCKER_COMPOSE_FILE" ps "$svc" | grep -q "healthy\|Up"; then
        log_success "  ✓ $svc saludable"
        break
      fi
      attempt=$((attempt + 1))
      sleep 5
    done

    if [[ $attempt -eq $max_attempts ]]; then
      log_error "  ✗ $svc no alcanzó estado saludable"
    fi
  done

  log_success "Despliegue Docker completado"
}

# ---------------------------------------------------------------------------
deploy_kubernetes() {
  log_info "Desplegando en Kubernetes..."

  # Update image tags
  cd "$K8S_BASE_DIR"
  kustomize edit set image \
    "licitapp/api-gateway=${REGISTRY}/${APP_NAME}/api-gateway:${VERSION}" \
    "licitapp/connectors=${REGISTRY}/${APP_NAME}/connectors:${VERSION}" \
    "licitapp/search=${REGISTRY}/${APP_NAME}/search:${VERSION}" \
    "licitapp/notifications=${REGISTRY}/${APP_NAME}/notifications:${VERSION}" \
    "licitapp/frontend=${REGISTRY}/${APP_NAME}/frontend:${VERSION}"
  cd -

  # Apply manifests
  log_info "Aplicando manifiestos Kubernetes..."
  kubectl apply -k "$K8S_BASE_DIR"

  # Wait for rollout
  local deployments=("api-gateway" "connectors" "search" "notifications" "frontend")
  for dep in "${deployments[@]}"; do
    log_info "  → Esperando rollout de $dep..."
    kubectl rollout status deployment/"$dep" -n licitapp --timeout=300s
    log_success "  ✓ $dep desplegado"
  done

  log_info "Estado del clúster:"
  kubectl get pods -n licitapp
  kubectl get services -n licitapp
  kubectl get ingress -n licitapp

  log_success "Despliegue Kubernetes completado"
}

# ---------------------------------------------------------------------------
run_smoke_tests() {
  log_info "Ejecutando smoke tests..."

  local api_url="${API_URL:-http://localhost:3000}"
  local max_attempts=10
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    if curl -sf "${api_url}/health" >/dev/null 2>&1; then
      log_success "API Gateway responde en ${api_url}/health"
      break
    fi
    attempt=$((attempt + 1))
    log_info "  Intento ${attempt}/${max_attempts}..."
    sleep 10
  done

  if [[ $attempt -eq $max_attempts ]]; then
    log_error "API Gateway no responde tras ${max_attempts} intentos"
  fi

  # Additional checks
  if curl -sf "${api_url}/api/v1/licitapp?limit=1" >/dev/null 2>&1; then
    log_success "Endpoint de licitapp OK"
  else
    log_warn "Endpoint de licitapp no disponible (puede requerir auth)"
  fi

  log_success "Smoke tests completados"
}

# ---------------------------------------------------------------------------
rollback_docker() {
  local prev_version="${1:-}"
  if [[ -z "$prev_version" ]]; then
    log_error "Especifica la versión anterior: ./deploy.sh docker rollback v1.0.0"
  fi
  log_warn "Ejecutando rollback a versión $prev_version..."
  VERSION="$prev_version" deploy_docker
  log_success "Rollback completado"
}

rollback_kubernetes() {
  log_warn "Ejecutando rollback en Kubernetes..."
  local deployments=("api-gateway" "connectors" "search" "notifications" "frontend")
  for dep in "${deployments[@]}"; do
    kubectl rollout undo deployment/"$dep" -n licitapp
  done
  log_success "Rollback Kubernetes completado"
}

# ---------------------------------------------------------------------------
print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}  DESPLIEGUE COMPLETADO${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Versión:     $VERSION"
  echo "  Target:      $DEPLOY_TARGET"
  echo "  Hora:        $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  if [[ "$DEPLOY_TARGET" == "docker" ]]; then
    echo "  Frontend:    http://localhost"
    echo "  API:         http://localhost/api/v1"
    echo "  Grafana:     http://localhost:3100"
    echo "  Prometheus:  http://localhost:9090"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  log_info "=== licitapp Chile — Deploy Script ==="
  log_info "Target: $DEPLOY_TARGET | Action: $ACTION | Version: $VERSION"
  echo ""

  check_prereqs

  case "$ACTION" in
    build)
      build_images
      ;;
    push)
      push_images
      ;;
    deploy)
      if [[ "$DEPLOY_TARGET" == "kubernetes" ]]; then
        deploy_kubernetes
      else
        deploy_docker
      fi
      run_smoke_tests
      ;;
    full)
      build_images
      push_images
      if [[ "$DEPLOY_TARGET" == "kubernetes" ]]; then
        deploy_kubernetes
      else
        deploy_docker
      fi
      run_smoke_tests
      ;;
    rollback)
      if [[ "$DEPLOY_TARGET" == "kubernetes" ]]; then
        rollback_kubernetes
      else
        rollback_docker "${4:-}"
      fi
      ;;
    *)
      echo "Uso: $0 [docker|kubernetes] [build|push|deploy|full|rollback] [version]"
      exit 1
      ;;
  esac

  print_summary
}

main "$@"
