#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib/common.sh"

PURGE_DATA="false"
PURGE_CERT="false"

while [ $# -gt 0 ]; do
    case "$1" in
        --purge-data)
            PURGE_DATA="true"
            shift
            ;;
        --purge-cert)
            PURGE_CERT="true"
            shift
            ;;
        *)
            die "Unbekannter Parameter: $1"
            ;;
    esac
done

require_root

if [ -f "$INSTALL_CONFIG_PATH" ]; then
    load_install_config
else
    log_warn "Installationskonfiguration fehlt. Es werden nur Standardpfade bereinigt."
fi

if [ "$PURGE_DATA" != "true" ] && prompt_yes_no "Sollen Datenbank, Uploads und Laufzeitdaten ebenfalls geloescht werden?" "n"; then
    PURGE_DATA="true"
fi

if [ "$PURGE_CERT" != "true" ] && [ -n "${DOMAIN:-}" ] && prompt_yes_no "Soll auch das Let's-Encrypt-Zertifikat fuer ${DOMAIN} geloescht werden?" "n"; then
    PURGE_CERT="true"
fi

systemctl stop "$SYSTEMD_SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SYSTEMD_SERVICE_NAME" 2>/dev/null || true
rm -f "$SYSTEMD_SERVICE_PATH"
systemctl daemon-reload

rm -f "$NGINX_SITE_LINK" "$NGINX_SITE_PATH"
nginx -t >/dev/null 2>&1 && systemctl reload nginx || true

rm -f /usr/local/bin/mikesbar-update /usr/local/bin/mikesbar-uninstall

if [ "$PURGE_CERT" = "true" ] && [ -n "${DOMAIN:-}" ]; then
    certbot delete --non-interactive --cert-name "$DOMAIN" || log_warn "Zertifikat fuer ${DOMAIN} konnte nicht entfernt werden."
fi

rm -rf "$APP_ROOT" "$PUBLISH_ROOT" "$SITE_ROOT"

if [ "$PURGE_DATA" = "true" ]; then
    rm -rf "$DATA_ROOT"
    if [ -n "${DB_NAME:-}" ] && [ -n "${DB_USER:-}" ]; then
        mysql --protocol=socket -uroot <<SQL
DROP DATABASE IF EXISTS \`${DB_NAME}\`;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
    fi
else
    log_warn "Datenbank und Uploads wurden beibehalten."
fi

rm -rf "$CONFIG_DIR"

printf 'Deinstallation abgeschlossen.\n'
