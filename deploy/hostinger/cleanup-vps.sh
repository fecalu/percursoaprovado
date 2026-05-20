#!/usr/bin/env bash
set -euo pipefail

# Limpeza de manutencao segura para a VPS.
#
# Uso:
#   bash deploy/hostinger/cleanup-vps.sh
#   bash deploy/hostinger/cleanup-vps.sh --aggressive
#
# Modo padrao:
# - limpa build cache do Docker
# - limpa imagens Docker sem uso
# - reduz logs do journal para 20M
#
# Modo --aggressive:
# - faz tudo do modo padrao
# - remove o container fig-test-backend, se existir
# - remove /root/migration-backups, se existir

AGGRESSIVE=0
if [[ "${1:-}" == "--aggressive" ]]; then
  AGGRESSIVE=1
fi

print_section() {
  printf '\n===== %s =====\n' "$1"
}

disk_report() {
  df -h /
  echo
  docker system df || true
  echo
  journalctl --disk-usage 2>/dev/null || true
}

print_section "ANTES"
disk_report

print_section "Limpando build cache do Docker"
docker builder prune -af

print_section "Limpando imagens Docker sem uso"
docker image prune -af

print_section "Reduzindo logs do journal para 20M"
journalctl --vacuum-size=20M || true

if [[ "$AGGRESSIVE" == "1" ]]; then
  print_section "Modo agressivo"

  if docker ps -a --format '{{.Names}}' | grep -qx 'fig-test-backend'; then
    echo "Removendo fig-test-backend"
    docker rm -f fig-test-backend
  else
    echo "fig-test-backend nao existe"
  fi

  if [[ -d /root/migration-backups ]]; then
    echo "Removendo /root/migration-backups"
    rm -rf /root/migration-backups
  else
    echo "/root/migration-backups nao existe"
  fi
fi

print_section "DEPOIS"
disk_report
