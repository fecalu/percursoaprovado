#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.hostinger}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$REPO_DIR/docker-compose.hostinger.yml}"
BACKUP_MODE="${BACKUP_MODE:-quick}"
BACKUP_DIR="${BACKUP_DIR:-/root}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente nao encontrado: $ENV_FILE"
  echo "Copie .env.hostinger.example para .env.hostinger e preencha os valores."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE_PATH" ]; then
  echo "Arquivo Docker Compose nao encontrado: $COMPOSE_FILE_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

create_quick_backup() {
  local backup_file="$BACKUP_DIR/percursoaprovado-site-backup-$TIMESTAMP.tar.gz"
  local backup_items=()

  if [ -f "$REPO_DIR/.env.hostinger" ]; then
    backup_items+=(".env.hostinger")
  fi
  if [ -f "$REPO_DIR/.env.hostinger.homolog" ]; then
    backup_items+=(".env.hostinger.homolog")
  fi
  if [ -f "$REPO_DIR/docker-compose.hostinger.yml" ]; then
    backup_items+=("docker-compose.hostinger.yml")
  fi
  if [ -f "$REPO_DIR/docker-compose.hostinger-homolog.yml" ]; then
    backup_items+=("docker-compose.hostinger-homolog.yml")
  fi
  if [ -d "$REPO_DIR/deploy/hostinger" ]; then
    backup_items+=("deploy/hostinger")
  fi

  if [ ${#backup_items[@]} -eq 0 ]; then
    echo "Nenhum arquivo critico encontrado para backup rapido. Seguindo sem backup."
    return 0
  fi

  (
    cd "$REPO_DIR"
    tar -czf "$backup_file" "${backup_items[@]}"
  )
  echo "Backup rapido criado em: $backup_file"
}

create_full_backup() {
  local backup_file="$BACKUP_DIR/percursoaprovado-backup-$TIMESTAMP.tar.gz"
  (
    cd "$(dirname "$REPO_DIR")"
    tar \
      --exclude="$(basename "$REPO_DIR")/.git" \
      --exclude="$(basename "$REPO_DIR")/edu-percurso-frontend/node_modules" \
      --exclude="$(basename "$REPO_DIR")/edu-percurso-frontend/dist" \
      --exclude="$(basename "$REPO_DIR")/edu-percurso-backend/target" \
      -czf "$backup_file" \
      "$(basename "$REPO_DIR")"
  )
  echo "Backup completo criado em: $backup_file"
}

case "$BACKUP_MODE" in
  none)
    echo "BACKUP_MODE=none -> deploy sem backup previo."
    ;;
  quick)
    create_quick_backup
    ;;
  full)
    create_full_backup
    ;;
  *)
    echo "BACKUP_MODE invalido: $BACKUP_MODE"
    echo "Use: none, quick ou full"
    exit 1
    ;;
esac

cd "$REPO_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" up -d --build
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" ps
