#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/lib/common.sh"

require_root
require_apt
load_install_config
load_runtime_env_if_present

log_info "Synchronisiere Repository."
git_sync_repo "$REPO_URL" "${REPO_BRANCH:-$DEFAULT_BRANCH}"

log_info "Pruefe Laufzeitabhaengigkeiten."
ensure_runtime_packages
ensure_services_enabled
ensure_app_user_and_dirs

log_info "Aktualisiere Datenbankstruktur."
ensure_database_and_user "$DB_NAME" "$DB_USER" "$DB_PASSWORD"
apply_database_schema "$DB_NAME"

PUBLIC_ORIGIN="$(build_public_origin "$PUBLIC_HOST" "$SSL_ENABLED")"
JWT_SECRET="${JWT_SECRET_KEY:-}"
[ -n "$JWT_SECRET" ] || JWT_SECRET="$(random_hex 32)"
write_runtime_env "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$PUBLIC_ORIGIN" "$JWT_SECRET"

log_info "Baue neue Artefakte."
build_and_publish_backend
build_frontend
deploy_frontend_site

PHP_FPM_SOCKET="$(detect_php_fpm_socket)"
[ -n "$PHP_FPM_SOCKET" ] || die "PHP-FPM-Socket wurde nicht gefunden."

write_systemd_service
write_nginx_site "${DOMAIN:-_}" "$PHP_FPM_SOCKET"
ensure_management_symlinks
reload_systemd_and_services

if [ "${SSL_ENABLED:-false}" = "true" ] && [ -n "${DOMAIN:-}" ]; then
    renew_ssl_certificates
fi

print_access_summary "$PUBLIC_ORIGIN"
