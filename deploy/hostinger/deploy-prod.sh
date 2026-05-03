#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="${LOG_FILE:-/var/log/percursoaprovado-deploy.log}"
BACKUP_MODE="${BACKUP_MODE:-quick}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.hostinger}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$REPO_DIR/docker-compose.hostinger.yml}"
RUN_DOCKER_PRUNE="${RUN_DOCKER_PRUNE:-1}"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  echo "[$(timestamp)] $*"
}

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

exec > >(tee -a "$LOG_FILE") 2>&1

log "Iniciando deploy de producao."
log "Repositorio: $REPO_DIR"
log "Env file: $ENV_FILE"
log "Compose file: $COMPOSE_FILE_PATH"
log "Backup mode: $BACKUP_MODE"

BACKUP_MODE="$BACKUP_MODE" \
ENV_FILE="$ENV_FILE" \
COMPOSE_FILE_PATH="$COMPOSE_FILE_PATH" \
"$SCRIPT_DIR/deploy.sh"

if [ "$RUN_DOCKER_PRUNE" = "1" ]; then
  log "Executando limpeza leve do Docker apos o deploy."
  /usr/local/sbin/percursoaprovado-docker-prune.sh
else
  log "RUN_DOCKER_PRUNE=0 -> limpeza leve do Docker ignorada."
fi

log "Validando health da aplicacao."
curl -fsS https://percursoaprovado.com.br/api/actuator/health

log "Deploy de producao concluido."
