#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO_URL="https://github.com/michaelnid/mikesbarV2"
REPO_URL="${REPO_URL:-$DEFAULT_REPO_URL}"
REPO_BRANCH="${REPO_BRANCH:-main}"
TMP_DIR=""

cleanup() {
    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}

trap cleanup EXIT

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    printf '[ERROR] Bitte mit sudo oder als root ausfuehren.\n' >&2
    exit 1
fi

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
        *)
            printf '[ERROR] Unbekannter Parameter: %s\n' "$1" >&2
            exit 1
            ;;
    esac
done

[ -n "$REPO_URL" ] || { printf '[ERROR] Repository-URL fehlt.\n' >&2; exit 1; }

if ! command -v git >/dev/null 2>&1; then
    apt-get update
    apt-get install -y git
fi

TMP_DIR="$(mktemp -d /tmp/mikesbar-install-XXXXXX)"
git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$TMP_DIR"

exec "$TMP_DIR/scripts/install.sh" --repo-url "$REPO_URL" --branch "$REPO_BRANCH"
