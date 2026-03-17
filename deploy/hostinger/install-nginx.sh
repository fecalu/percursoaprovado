#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_NAME="${SITE_NAME:-percursoaprovado}"
CONF_SOURCE="${NGINX_CONF_SOURCE:-$SCRIPT_DIR/percursoaprovado.nginx.conf}"
CONF_TARGET="${NGINX_CONF_TARGET:-/etc/nginx/sites-available/$SITE_NAME}"
LINK_TARGET="${NGINX_LINK_TARGET:-/etc/nginx/sites-enabled/$SITE_NAME}"

cp "$CONF_SOURCE" "$CONF_TARGET"
ln -sfn "$CONF_TARGET" "$LINK_TARGET"

nginx -t
systemctl reload nginx
