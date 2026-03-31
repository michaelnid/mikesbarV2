#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

APP_NAME="mikesbar"
APP_USER="mikesbar"
APP_GROUP="mikesbar"
APP_ROOT="/opt/${APP_NAME}/core"
PUBLISH_ROOT="/opt/${APP_NAME}/publish/backend"
SITE_ROOT="/var/www/${APP_NAME}/site"
DATA_ROOT="/var/lib/${APP_NAME}"
CONFIG_DIR="/etc/${APP_NAME}"
INSTALL_CONFIG_PATH="${CONFIG_DIR}/install.conf"
RUNTIME_ENV_PATH="${CONFIG_DIR}/runtime.env"
SYSTEMD_SERVICE_NAME="${APP_NAME}-api"
SYSTEMD_SERVICE_PATH="/etc/systemd/system/${SYSTEMD_SERVICE_NAME}.service"
NGINX_SITE_NAME="${APP_NAME}.conf"
NGINX_SITE_PATH="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"
DEFAULT_BRANCH="main"
DEFAULT_DB_NAME="${APP_NAME}"
DEFAULT_DB_USER="${APP_NAME}"
DEFAULT_PUBLIC_PORT="80"
DEFAULT_APP_PORT="5000"

# ── Farben & Formatierung ──────────────────────────────────────────────

if [ -t 1 ] && [ -t 2 ]; then
    C_RESET='\033[0m'
    C_BOLD='\033[1m'
    C_DIM='\033[2m'
    C_GREEN='\033[32m'
    C_YELLOW='\033[33m'
    C_RED='\033[31m'
    C_CYAN='\033[36m'
    C_WHITE='\033[97m'
else
    C_RESET='' C_BOLD='' C_DIM='' C_GREEN='' C_YELLOW='' C_RED='' C_CYAN='' C_WHITE=''
fi

_STEP=0
_STEPS_TOTAL=0

init_steps() {
    _STEPS_TOTAL="$1"
    _STEP=0
}

step() {
    _STEP=$((_STEP + 1))
    printf '\n%b[%d/%d]%b %b%s%b\n' \
        "$C_CYAN" "$_STEP" "$_STEPS_TOTAL" "$C_RESET" \
        "$C_BOLD" "$*" "$C_RESET"
}

log_info() {
    printf '%b  =>%b %s\n' "$C_GREEN" "$C_RESET" "$*"
}

log_warn() {
    printf '%b  !!%b %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2
}

die() {
    printf '\n%b  FEHLER:%b %s\n\n' "$C_RED" "$C_RESET" "$*" >&2
    exit 1
}

banner() {
    local title="${1:-mikesbar}"
    local width=52
    local pad=$(( (width - ${#title} - 2) / 2 ))
    local line
    line="$(printf '%*s' "$width" '' | tr ' ' '─')"

    printf '\n%b' "$C_CYAN"
    printf '  ┌%s┐\n' "$line"
    printf '  │%*s%b %s %b%*s│\n' "$pad" '' "$C_BOLD$C_WHITE" "$title" "$C_RESET$C_CYAN" "$((width - pad - ${#title} - 2))" ''
    printf '  └%s┘\n' "$line"
    printf '%b\n' "$C_RESET"
}

print_line() {
    printf '%b  %s%b\n' "$C_DIM" "$(printf '%*s' 52 '' | tr ' ' '─')" "$C_RESET"
}

# ── Systemvoraussetzungen ──────────────────────────────────────────────

require_root() {
    if [ "${EUID:-$(id -u)}" -ne 0 ]; then
        die "Dieses Skript muss als root ausgefuehrt werden."
    fi
}

require_apt() {
    command -v apt-get >/dev/null 2>&1 || die "Dieses Setup unterstuetzt aktuell nur apt-basierte Linux-Systeme."
}

load_os_release() {
    [ -f /etc/os-release ] || die "/etc/os-release wurde nicht gefunden."
    # shellcheck disable=SC1091
    . /etc/os-release
}

# ── String-Hilfsfunktionen ────────────────────────────────────────────

escape_shell_value() {
    printf '%q' "$1"
}

write_shell_kv() {
    local key="$1"
    local value="$2"
    printf '%s=%s\n' "$key" "$(escape_shell_value "$value")"
}

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

sanitize_domain() {
    local raw
    raw="$(trim "${1:-}")"
    raw="${raw#http://}"
    raw="${raw#https://}"
    raw="${raw%%/*}"
    raw="${raw%%:*}"
    printf '%s' "${raw,,}"
}

is_ipv4() {
    [[ "${1:-}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

# ── Interaktive Eingabe ───────────────────────────────────────────────

read_interactive() {
    local __resultvar="$1"
    shift

    if [ -r /dev/tty ]; then
        IFS= read "$@" "$__resultvar" < /dev/tty
        return $?
    fi

    IFS= read "$@" "$__resultvar"
}

prompt_value() {
    local prompt_text="$1"
    local default_value="${2:-}"
    local allow_empty="${3:-false}"
    local result=""

    while true; do
        if [ -n "$default_value" ]; then
            if ! read_interactive result -r -p "  ${prompt_text} [${default_value}]: "; then
                die "Keine interaktive Eingabe verfuegbar. Bitte Werte per Parameter oder Umgebungsvariable setzen."
            fi
            result="${result:-$default_value}"
        else
            if ! read_interactive result -r -p "  ${prompt_text}: "; then
                die "Keine interaktive Eingabe verfuegbar. Bitte Werte per Parameter oder Umgebungsvariable setzen."
            fi
        fi

        result="$(trim "$result")"

        if [ -n "$result" ] || [ "$allow_empty" = "true" ]; then
            printf '%s' "$result"
            return 0
        fi

        log_warn "Eingabe darf nicht leer sein."
    done
}

prompt_secret() {
    local prompt_text="$1"
    local result=""
    local confirmation=""

    while true; do
        if ! read_interactive result -r -s -p "  ${prompt_text}: "; then
            die "Keine interaktive Eingabe verfuegbar. Bitte Werte per Parameter oder Umgebungsvariable setzen."
        fi
        printf '\n'
        [ -n "$result" ] || { log_warn "Eingabe darf nicht leer sein."; continue; }

        if ! read_interactive confirmation -r -s -p "  ${prompt_text} bestaetigen: "; then
            die "Keine interaktive Eingabe verfuegbar. Bitte Werte per Parameter oder Umgebungsvariable setzen."
        fi
        printf '\n'

        if [ "$result" = "$confirmation" ]; then
            printf '%s' "$result"
            return 0
        fi

        log_warn "Die Eingaben stimmen nicht ueberein."
    done
}

prompt_yes_no() {
    local prompt_text="$1"
    local default_value="${2:-n}"
    local answer=""

    while true; do
        if ! read_interactive answer -r -p "  ${prompt_text} [y/N]: "; then
            die "Keine interaktive Eingabe verfuegbar. Bitte Werte per Parameter oder Umgebungsvariable setzen."
        fi
        answer="${answer:-$default_value}"
        case "${answer,,}" in
            y|yes|j|ja) return 0 ;;
            n|no|nein) return 1 ;;
            *) log_warn "Bitte y oder n eingeben." ;;
        esac
    done
}

require_match() {
    local value="$1"
    local label="$2"
    local pattern="$3"

    if [[ ! "$value" =~ $pattern ]]; then
        die "${label} ist ungueltig."
    fi
}

# ── Netzwerk & Zufall ─────────────────────────────────────────────────

detect_server_ip() {
    local first_ip=""
    first_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -n "$first_ip" ] || first_ip="127.0.0.1"
    printf '%s' "$first_ip"
}

random_hex() {
    local bytes="${1:-32}"
    openssl rand -hex "$bytes"
}

random_from_charset() {
    local length="$1"
    local charset="$2"

    (
        set +o pipefail
        LC_ALL=C tr -dc "$charset" </dev/urandom | head -c "$length"
    )
}

random_alnum() {
    local length="${1:-32}"
    random_from_charset "$length" 'A-Za-z0-9'
}

random_digits() {
    local length="${1:-6}"
    random_from_charset "$length" '0-9'
}

# ── Paketinstallation ─────────────────────────────────────────────────

ensure_base_apt_packages() {
    rm -f /etc/apt/sources.list.d/microsoft-prod.list
    rm -f /etc/apt/sources.list.d/microsoft-prod.list.save
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
}

ensure_nodesource_repo() {
    if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then
        log_info "Fuege Node.js 20.x Repository hinzu."
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
            | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main\n' \
            >/etc/apt/sources.list.d/nodesource.list
    fi
}

ensure_microsoft_repo() {
    local package_url=""
    local temp_deb=""

    load_os_release

    case "${ID:-}" in
        ubuntu)
            package_url="https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb"
            ;;
        debian)
            package_url="https://packages.microsoft.com/config/debian/${VERSION_ID}/packages-microsoft-prod.deb"
            ;;
        *)
            die "Nicht unterstuetzte Distribution fuer Microsoft/.NET-Repository: ${ID:-unbekannt}"
            ;;
    esac

    rm -f /etc/apt/sources.list.d/microsoft-prod.list

    log_info "Fuege Microsoft/.NET Repository hinzu."
    temp_deb="$(mktemp /tmp/packages-microsoft-prod-XXXXXX.deb)"
    curl -fsSL "$package_url" -o "$temp_deb"
    dpkg -i "$temp_deb" >/dev/null
    rm -f "$temp_deb"
}

ensure_runtime_packages() {
    ensure_base_apt_packages
    ensure_nodesource_repo
    ensure_microsoft_repo

    log_info "Installiere Pakete (nginx, mariadb, node, dotnet, php, ...)."
    apt-get update -qq
    apt-get install -y -qq \
        git \
        nginx \
        certbot \
        python3-certbot-nginx \
        mariadb-server \
        php-fpm \
        php-cli \
        php-mysql \
        rsync \
        apache2-utils \
        dotnet-sdk-8.0 \
        nodejs
}

# ── Dienste ───────────────────────────────────────────────────────────

detect_php_fpm_socket() {
    find /run/php -maxdepth 1 -type s -name 'php*-fpm.sock' | sort | tail -n 1
}

detect_php_fpm_service() {
    systemctl list-unit-files --type=service --no-legend 2>/dev/null \
        | awk '/php.*-fpm\.service/ { print $1; exit }'
}

ensure_services_enabled() {
    local php_service=""
    php_service="$(detect_php_fpm_service)"

    systemctl enable --now mariadb  >/dev/null 2>&1
    systemctl enable --now nginx    >/dev/null 2>&1

    if [ -n "$php_service" ]; then
        systemctl enable --now "$php_service" >/dev/null 2>&1
    else
        log_warn "Kein PHP-FPM-Dienst gefunden. Avatar-Uploads waeren nicht verfuegbar."
    fi
}

# ── Benutzer & Verzeichnisse ──────────────────────────────────────────

ensure_app_user_and_dirs() {
    if ! id -u "$APP_USER" >/dev/null 2>&1; then
        useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /bin/bash "$APP_USER"
    fi

    mkdir -p "$APP_ROOT" "$PUBLISH_ROOT" "$SITE_ROOT" "$DATA_ROOT" "$CONFIG_DIR"
    mkdir -p "${DATA_ROOT}/live-game-packages/installed" "${DATA_ROOT}/live-game-packages/archives"
    chown -R "$APP_USER:$APP_GROUP" "/opt/${APP_NAME}"
    chown -R "$APP_USER:$APP_GROUP" "$DATA_ROOT"
    mkdir -p "${SITE_ROOT}/avatars"
    chown -R www-data:www-data "${SITE_ROOT}/avatars"
    chmod 0775 "${SITE_ROOT}/avatars"
}

# ── Git ───────────────────────────────────────────────────────────────

git_sync_repo() {
    local repo_url="$1"
    local branch="$2"

    [ -n "$repo_url" ] || die "REPO_URL ist nicht gesetzt."

    if [ ! -d "$APP_ROOT/.git" ]; then
        rm -rf "$APP_ROOT"
        mkdir -p "$(dirname "$APP_ROOT")"
        su -s /bin/bash -c "git clone --branch '$branch' --depth 1 '$repo_url' '$APP_ROOT'" "$APP_USER"
        chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT"
        return 0
    fi

    su -s /bin/bash -c "git -C '$APP_ROOT' remote set-url origin '$repo_url'" "$APP_USER"
    su -s /bin/bash -c "git -C '$APP_ROOT' fetch --prune origin '$branch'" "$APP_USER"
    su -s /bin/bash -c "git -C '$APP_ROOT' checkout '$branch'" "$APP_USER"
    su -s /bin/bash -c "git -C '$APP_ROOT' pull --ff-only origin '$branch'" "$APP_USER"
    chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT"
}

# ── Datenbank ─────────────────────────────────────────────────────────

ensure_mysql_credentials() {
    mysql --protocol=socket -uroot -e "SELECT 1;" >/dev/null 2>&1 \
        || die "MariaDB/MySQL root-Zugriff ueber lokalen Socket ist nicht verfuegbar."
}

ensure_database_and_user() {
    local db_name="$1"
    local db_user="$2"
    local db_password="$3"

    ensure_mysql_credentials

    mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${db_user}'@'localhost' IDENTIFIED BY '${db_password}';
ALTER USER '${db_user}'@'localhost' IDENTIFIED BY '${db_password}';
GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'localhost';
FLUSH PRIVILEGES;
SQL
}

database_has_users_table() {
    local db_name="$1"
    mysql --protocol=socket -uroot -Nse \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${db_name}' AND table_name='users';" \
        | grep -q '^1$'
}

apply_database_schema() {
    local db_name="$1"

    if ! database_has_users_table "$db_name"; then
        log_info "Erstelle initiales Datenbankschema."
        mysql --protocol=socket -uroot "$db_name" <"${ROOT_DIR}/database/schema.sql"
    fi

    log_info "Wende Datenbankmigrationen an."
    mysql --protocol=socket -uroot "$db_name" <"${ROOT_DIR}/database/upgrade.sql"
}

hash_pin_with_bcrypt() {
    local pin="$1"
    htpasswd -bnBC 12 '' "$pin" | tr -d ':\n'
}

upsert_admin_user() {
    local db_name="$1"
    local admin_username="$2"
    local admin_pin="$3"
    local admin_hash=""

    admin_hash="$(hash_pin_with_bcrypt "$admin_pin")"

    mysql --protocol=socket -uroot "$db_name" <<SQL
INSERT INTO users (
    username,
    pin_hash,
    balance,
    avatar_url,
    qr_code_uuid,
    role,
    permissions,
    is_active,
    created_at,
    updated_at,
    bankruptcy_count,
    has_fotobox_access
) VALUES (
    '${admin_username}',
    '${admin_hash}',
    0.00,
    '/avatars/default.svg',
    UUID(),
    'ADMIN',
    'PLAYER,ADMIN',
    TRUE,
    UTC_TIMESTAMP(),
    UTC_TIMESTAMP(),
    0,
    FALSE
)
ON DUPLICATE KEY UPDATE
    pin_hash = VALUES(pin_hash),
    role = 'ADMIN',
    permissions = 'PLAYER,ADMIN',
    is_active = TRUE,
    updated_at = UTC_TIMESTAMP();
SQL
}

# ── Konfiguration ────────────────────────────────────────────────────

write_install_config() {
    local repo_url="$1"
    local repo_branch="$2"
    local public_host="$3"
    local domain="$4"
    local ssl_enabled="$5"
    local db_name="$6"
    local db_user="$7"
    local db_password="$8"
    local admin_username="$9"

    umask 077
    mkdir -p "$CONFIG_DIR"

    {
        write_shell_kv "APP_NAME" "$APP_NAME"
        write_shell_kv "APP_USER" "$APP_USER"
        write_shell_kv "APP_GROUP" "$APP_GROUP"
        write_shell_kv "APP_ROOT" "$APP_ROOT"
        write_shell_kv "PUBLISH_ROOT" "$PUBLISH_ROOT"
        write_shell_kv "SITE_ROOT" "$SITE_ROOT"
        write_shell_kv "DATA_ROOT" "$DATA_ROOT"
        write_shell_kv "CONFIG_DIR" "$CONFIG_DIR"
        write_shell_kv "SYSTEMD_SERVICE_NAME" "$SYSTEMD_SERVICE_NAME"
        write_shell_kv "SYSTEMD_SERVICE_PATH" "$SYSTEMD_SERVICE_PATH"
        write_shell_kv "NGINX_SITE_PATH" "$NGINX_SITE_PATH"
        write_shell_kv "NGINX_SITE_LINK" "$NGINX_SITE_LINK"
        write_shell_kv "REPO_URL" "$repo_url"
        write_shell_kv "REPO_BRANCH" "$repo_branch"
        write_shell_kv "PUBLIC_HOST" "$public_host"
        write_shell_kv "DOMAIN" "$domain"
        write_shell_kv "SSL_ENABLED" "$ssl_enabled"
        write_shell_kv "DB_NAME" "$db_name"
        write_shell_kv "DB_USER" "$db_user"
        write_shell_kv "DB_PASSWORD" "$db_password"
        write_shell_kv "ADMIN_USERNAME" "$admin_username"
        write_shell_kv "APP_PORT" "$DEFAULT_APP_PORT"
    } >"$INSTALL_CONFIG_PATH"
}

load_install_config() {
    [ -f "$INSTALL_CONFIG_PATH" ] || die "Installationskonfiguration fehlt: ${INSTALL_CONFIG_PATH}"
    # shellcheck disable=SC1090
    . "$INSTALL_CONFIG_PATH"
}

load_runtime_env_if_present() {
    if [ -f "$RUNTIME_ENV_PATH" ]; then
        # shellcheck disable=SC1090
        . "$RUNTIME_ENV_PATH"
    fi
}

build_public_origin() {
    local public_host="$1"
    local ssl_enabled="$2"

    if [ "$ssl_enabled" = "true" ]; then
        printf 'https://%s' "$public_host"
    else
        printf 'http://%s' "$public_host"
    fi
}

write_runtime_env() {
    local db_name="$1"
    local db_user="$2"
    local db_password="$3"
    local public_origin="$4"
    local jwt_secret="$5"

    umask 077
    mkdir -p "$CONFIG_DIR"

    cat >"$RUNTIME_ENV_PATH" <<EOF
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:${DEFAULT_APP_PORT}
JWT_SECRET_KEY="${jwt_secret}"
DB_CONNECTION_STRING="server=127.0.0.1;port=3306;database=${db_name};user=${db_user};password=${db_password}"
ALLOWED_ORIGINS="${public_origin}"
PLUGIN_STORAGE_PATH="${DATA_ROOT}/live-game-packages"
EOF
}

# ── Build & Deploy ───────────────────────────────────────────────────

build_and_publish_backend() {
    chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT" "$PUBLISH_ROOT"
    log_info "dotnet restore + publish ..."
    su -s /bin/bash -c "cd '$APP_ROOT/backend' && dotnet restore -v quiet && dotnet publish -c Release -o '$PUBLISH_ROOT' -v quiet" "$APP_USER"
}

build_frontend() {
    chown -R "$APP_USER:$APP_GROUP" "$APP_ROOT"
    log_info "npm ci + build ..."
    su -s /bin/bash -c "cd '$APP_ROOT/frontend' && npm ci --loglevel=warn && npm run build" "$APP_USER"
}

deploy_frontend_site() {
    mkdir -p "$SITE_ROOT" "${SITE_ROOT}/avatars"
    rsync -a --delete --exclude 'avatars/' "$APP_ROOT/frontend/dist/" "$SITE_ROOT/"
    install -m 0644 "$APP_ROOT/frontend/public/avatars/default.svg" "${SITE_ROOT}/avatars/default.svg"
    install -m 0644 "$APP_ROOT/frontend/avatars/upload.php" "${SITE_ROOT}/avatars/upload.php"

    # Berechtigungen: nginx (www-data) muss alle Dateien lesen koennen
    find "$SITE_ROOT" -type d -exec chmod 755 {} \;
    find "$SITE_ROOT" -type f -exec chmod 644 {} \;
    chown -R "$APP_USER:$APP_GROUP" "$SITE_ROOT"
    chown -R www-data:www-data "${SITE_ROOT}/avatars"
    chmod 0775 "${SITE_ROOT}/avatars"
}

# ── systemd & nginx ──────────────────────────────────────────────────

write_systemd_service() {
    cat >"$SYSTEMD_SERVICE_PATH" <<EOF
[Unit]
Description=mikesbar Core API
After=network.target mariadb.service
Wants=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${PUBLISH_ROOT}
EnvironmentFile=${RUNTIME_ENV_PATH}
ExecStart=/usr/bin/dotnet ${PUBLISH_ROOT}/Backend.dll
Restart=always
RestartSec=5
KillSignal=SIGINT
SyslogIdentifier=${SYSTEMD_SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx_site() {
    local server_name="$1"
    local php_socket="$2"
    local ssl_enabled="${3:-false}"
    local domain="${4:-}"
    local ssl_cert_path=""
    local ssl_key_path=""
    local enable_ssl="false"

    [ -n "$php_socket" ] || die "Kein PHP-FPM-Socket gefunden."

    if [ "$ssl_enabled" = "true" ] && [ -n "$domain" ]; then
        ssl_cert_path="/etc/letsencrypt/live/${domain}/fullchain.pem"
        ssl_key_path="/etc/letsencrypt/live/${domain}/privkey.pem"

        if [ -f "$ssl_cert_path" ] && [ -f "$ssl_key_path" ]; then
            enable_ssl="true"
        fi
    fi

    if [ "$enable_ssl" = "true" ]; then
        cat >"$NGINX_SITE_PATH" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_name};

    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${server_name};

    ssl_certificate ${ssl_cert_path};
    ssl_certificate_key ${ssl_key_path};
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root ${SITE_ROOT};
    index index.html;
    client_max_body_size 5M;

    location /api/ {
        proxy_pass http://127.0.0.1:${DEFAULT_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /hubs/ {
        proxy_pass http://127.0.0.1:${DEFAULT_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }

    location /swagger/ {
        proxy_pass http://127.0.0.1:${DEFAULT_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /avatars/upload.php {
        include snippets/fastcgi-php.conf;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_pass unix:${php_socket};
    }

    location /avatars/ {
        try_files \$uri \$uri/ =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ \.php$ {
        return 404;
    }
}
EOF
    else
        cat >"$NGINX_SITE_PATH" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_name};

    root ${SITE_ROOT};
    index index.html;
    client_max_body_size 5M;

    location /api/ {
        proxy_pass http://127.0.0.1:${DEFAULT_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /hubs/ {
        proxy_pass http://127.0.0.1:${DEFAULT_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }

    location /swagger/ {
        proxy_pass http://127.0.0.1:${DEFAULT_APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /avatars/upload.php {
        include snippets/fastcgi-php.conf;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_pass unix:${php_socket};
    }

    location /avatars/ {
        try_files \$uri \$uri/ =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ \.php$ {
        return 404;
    }
}
EOF
    fi

    ln -sf "$NGINX_SITE_PATH" "$NGINX_SITE_LINK"
    rm -f /etc/nginx/sites-enabled/default
}

reload_systemd_and_services() {
    systemctl daemon-reload
    systemctl enable --now "$SYSTEMD_SERVICE_NAME" >/dev/null 2>&1
    systemctl restart "$SYSTEMD_SERVICE_NAME"
    nginx -t >/dev/null 2>&1 || die "nginx-Konfiguration ist fehlerhaft."
    systemctl reload nginx
}

ensure_management_symlinks() {
    ln -sf "${APP_ROOT}/scripts/update.sh" /usr/local/bin/mikesbar-update
    ln -sf "${APP_ROOT}/scripts/uninstall.sh" /usr/local/bin/mikesbar-uninstall
}

# ── SSL / Let's Encrypt ──────────────────────────────────────────────

obtain_ssl_certificate() {
    local domain="$1"

    [ -n "$domain" ] || return 0

    certbot certonly --nginx \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        -d "$domain"
}

renew_ssl_certificates() {
    certbot renew --quiet || log_warn "Certbot-Renew meldete einen Fehler."
}

# ── Zusammenfassung ──────────────────────────────────────────────────

print_access_summary() {
    local public_origin="$1"

    printf '\n'
    print_line
    printf '%b  Installation abgeschlossen!%b\n' "$C_BOLD$C_GREEN" "$C_RESET"
    print_line
    printf '\n'
    printf '  %-18s %b%s%b\n' "Frontend:" "$C_BOLD" "$public_origin" "$C_RESET"
    printf '  %-18s http://127.0.0.1:%s/api\n' "API (intern):" "$DEFAULT_APP_PORT"
    printf '  %-18s sudo mikesbar-update\n' "Aktualisieren:"
    printf '  %-18s sudo mikesbar-uninstall\n' "Deinstallieren:"
    printf '\n'
}

print_admin_credentials() {
    local admin_username="$1"
    local admin_pin="$2"

    printf '  %-18s %b%s%b\n' "Admin-Benutzer:" "$C_BOLD" "$admin_username" "$C_RESET"
    printf '  %-18s %b%s%b\n' "Admin-PIN:" "$C_BOLD$C_YELLOW" "$admin_pin" "$C_RESET"
    printf '\n'
    printf '%b  Bitte die PIN jetzt notieren und spaeter im System aendern.%b\n' "$C_DIM" "$C_RESET"
    printf '\n'
    print_line
    printf '\n'
}
