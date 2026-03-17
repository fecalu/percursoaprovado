#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.hostinger}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$REPO_DIR/docker-compose.hostinger.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente nao encontrado: $ENV_FILE"
  echo "Copie .env.hostinger.example para .env.hostinger e preencha os valores."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE_PATH" ]; then
  echo "Arquivo Docker Compose nao encontrado: $COMPOSE_FILE_PATH"
  exit 1
fi

cd "$REPO_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" up -d --build
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" ps
