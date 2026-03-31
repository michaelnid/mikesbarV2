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

banner "mikesbar  -  Update"
init_steps 5

# ── 1. Repository synchronisieren ────────────────────────────────────

step "Repository synchronisieren"
git_sync_repo "$REPO_URL" "${REPO_BRANCH:-$DEFAULT_BRANCH}"

# ── 2. Laufzeitabhaengigkeiten pruefen ──────────────────────────────

step "Laufzeitabhaengigkeiten pruefen"
ensure_runtime_packages
ensure_services_enabled
ensure_app_user_and_dirs

# ── 3. Datenbankstruktur aktualisieren ───────────────────────────────

step "Datenbankstruktur aktualisieren"
ensure_database_and_user "$DB_NAME" "$DB_USER" "$DB_PASSWORD"
apply_database_schema "$DB_NAME"

# ── 4. Artefakte bauen ───────────────────────────────────────────────

step "Backend & Frontend bauen"
PUBLIC_ORIGIN="$(build_public_origin "$PUBLIC_HOST" "$SSL_ENABLED")"
JWT_SECRET="${JWT_SECRET_KEY:-}"
[ -n "$JWT_SECRET" ] || JWT_SECRET="$(random_hex 32)"
write_runtime_env "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$PUBLIC_ORIGIN" "$JWT_SECRET"

build_and_publish_backend
build_frontend
deploy_frontend_site

# ── 5. Dienste konfigurieren & neu laden ─────────────────────────────

step "Dienste konfigurieren & neu laden"
PHP_FPM_SOCKET="$(detect_php_fpm_socket)"
[ -n "$PHP_FPM_SOCKET" ] || die "PHP-FPM-Socket wurde nicht gefunden."

write_systemd_service
write_nginx_site "${DOMAIN:-_}" "$PHP_FPM_SOCKET" "${SSL_ENABLED:-false}" "${DOMAIN:-}"
ensure_management_symlinks
reload_systemd_and_services

if [ "${SSL_ENABLED:-false}" = "true" ] && [ -n "${DOMAIN:-}" ]; then
    log_info "Erneuere SSL-Zertifikate ..."
    renew_ssl_certificates
fi

# ── Fertig ───────────────────────────────────────────────────────────

print_access_summary "$PUBLIC_ORIGIN"
