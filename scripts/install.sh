#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib/common.sh"

REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-$DEFAULT_BRANCH}"
DOMAIN_INPUT="${DOMAIN:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PIN="${ADMIN_PIN:-}"
DB_NAME="${DB_NAME:-$DEFAULT_DB_NAME}"
DB_USER="${DB_USER:-$DEFAULT_DB_USER}"
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
SKIP_SSL="false"

while [ $# -gt 0 ]; do
    case "$1" in
        --repo-url)
            REPO_URL="${2:-}"
            shift 2
            ;;
        --branch)
            REPO_BRANCH="${2:-}"
            shift 2
            ;;
        --domain)
            DOMAIN_INPUT="${2:-}"
            shift 2
            ;;
        --admin-user)
            ADMIN_USERNAME="${2:-}"
            shift 2
            ;;
        --admin-pin)
            ADMIN_PIN="${2:-}"
            shift 2
            ;;
        --db-name)
            DB_NAME="${2:-}"
            shift 2
            ;;
        --db-user)
            DB_USER="${2:-}"
            shift 2
            ;;
        --db-password)
            DB_PASSWORD="${2:-}"
            shift 2
            ;;
        --jwt-secret)
            JWT_SECRET="${2:-}"
            shift 2
            ;;
        --skip-ssl)
            SKIP_SSL="true"
            shift
            ;;
        *)
            die "Unbekannter Parameter: $1"
            ;;
    esac
done

require_root
require_apt

log_info "Installiere Systemabhaengigkeiten."
ensure_runtime_packages
ensure_services_enabled
ensure_app_user_and_dirs

if [ -z "$REPO_URL" ] && [ -d "${ROOT_DIR}/.git" ]; then
    REPO_URL="$(git -C "$ROOT_DIR" config --get remote.origin.url || true)"
fi

if [ -z "$REPO_URL" ]; then
    REPO_URL="$(prompt_value "Oeffentliche GitHub-Repository-URL" "" false)"
fi

REPO_BRANCH="$(prompt_value "Git-Branch fuer Deployment" "$REPO_BRANCH" false)"

if [ -z "$DOMAIN_INPUT" ]; then
    DOMAIN_INPUT="$(prompt_value "Domain fuer HTTPS (leer lassen fuer HTTP ueber Server-IP)" "" true)"
fi

DOMAIN_INPUT="$(sanitize_domain "$DOMAIN_INPUT")"
if is_ipv4 "$DOMAIN_INPUT"; then
    log_warn "Eine IP-Adresse kann kein Let's-Encrypt-Zertifikat erhalten. SSL wird fuer diese Eingabe deaktiviert."
    DOMAIN_INPUT=""
fi

if [ "$SKIP_SSL" = "true" ]; then
    DOMAIN_INPUT=""
fi

SERVER_IP="$(detect_server_ip)"
PUBLIC_HOST="${DOMAIN_INPUT:-$SERVER_IP}"
SSL_ENABLED="false"
if [ -n "$DOMAIN_INPUT" ]; then
    SSL_ENABLED="true"
fi

ADMIN_USERNAME="$(prompt_value "Initialer Admin-Benutzername" "$ADMIN_USERNAME" false)"
require_match "$ADMIN_USERNAME" "Admin-Benutzername" '^[A-Za-z0-9._-]{3,50}$'

if [ -z "$ADMIN_PIN" ]; then
    ADMIN_PIN="$(random_digits 6)"
    log_info "Es wurde automatisch eine zufaellige 6-stellige Admin-PIN erzeugt."
fi
require_match "$ADMIN_PIN" "Admin-PIN" '^[0-9]{6}$'

DB_NAME="$(prompt_value "Datenbankname" "$DB_NAME" false)"
DB_USER="$(prompt_value "Datenbankbenutzer" "$DB_USER" false)"
require_match "$DB_NAME" "Datenbankname" '^[A-Za-z0-9_]{1,64}$'
require_match "$DB_USER" "Datenbankbenutzer" '^[A-Za-z0-9_]{1,64}$'

if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="$(random_alnum 32)"
fi

if [ -z "$JWT_SECRET" ] && [ -f "$RUNTIME_ENV_PATH" ]; then
    load_runtime_env_if_present
    JWT_SECRET="${JWT_SECRET_KEY:-}"
fi

if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="$(random_hex 32)"
fi

log_info "Synchronisiere Repository nach ${APP_ROOT}."
git_sync_repo "$REPO_URL" "$REPO_BRANCH"

log_info "Richte Datenbank ein."
ensure_database_and_user "$DB_NAME" "$DB_USER" "$DB_PASSWORD"
apply_database_schema "$DB_NAME"
upsert_admin_user "$DB_NAME" "$ADMIN_USERNAME" "$ADMIN_PIN"

PUBLIC_ORIGIN="$(build_public_origin "$PUBLIC_HOST" "$SSL_ENABLED")"

log_info "Schreibe Laufzeitkonfiguration."
write_install_config "$REPO_URL" "$REPO_BRANCH" "$PUBLIC_HOST" "$DOMAIN_INPUT" "$SSL_ENABLED" "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$ADMIN_USERNAME"
write_runtime_env "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$PUBLIC_ORIGIN" "$JWT_SECRET"

log_info "Baue Backend und Frontend."
build_and_publish_backend
build_frontend
deploy_frontend_site

PHP_FPM_SOCKET="$(detect_php_fpm_socket)"
[ -n "$PHP_FPM_SOCKET" ] || die "PHP-FPM-Socket wurde nicht gefunden."

log_info "Erzeuge systemd- und nginx-Konfiguration."
write_systemd_service
write_nginx_site "${DOMAIN_INPUT:-_}" "$PHP_FPM_SOCKET"
ensure_management_symlinks
reload_systemd_and_services

if [ "$SSL_ENABLED" = "true" ]; then
    log_info "Fordere Let's-Encrypt-Zertifikat fuer ${DOMAIN_INPUT} an."
    obtain_ssl_certificate "$DOMAIN_INPUT"
    PUBLIC_ORIGIN="$(build_public_origin "$DOMAIN_INPUT" "true")"
    write_runtime_env "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$PUBLIC_ORIGIN" "$JWT_SECRET"
    systemctl restart "$SYSTEMD_SERVICE_NAME"
else
    log_warn "Keine Domain gesetzt. Installation bleibt auf HTTP ueber ${SERVER_IP}."
fi

print_access_summary "$PUBLIC_ORIGIN"
print_admin_credentials "$ADMIN_USERNAME" "$ADMIN_PIN"
