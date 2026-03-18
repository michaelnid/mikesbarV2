#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="${1:-}"

if [ -z "$PLUGIN_DIR" ]; then
    printf 'Verwendung: %s /pfad/zum/plugin-ordner [ausgabe.zip]\n' "$0" >&2
    exit 1
fi

PLUGIN_DIR="$(cd "$PLUGIN_DIR" && pwd)"
[ -f "${PLUGIN_DIR}/manifest.json" ] || {
    printf '[ERROR] manifest.json wurde nicht gefunden: %s\n' "${PLUGIN_DIR}/manifest.json" >&2
    exit 1
}
[ -d "${PLUGIN_DIR}/backend" ] || {
    printf '[ERROR] backend/ wurde nicht gefunden: %s\n' "${PLUGIN_DIR}/backend" >&2
    exit 1
}
[ -d "${PLUGIN_DIR}/frontend/dist" ] || {
    printf '[ERROR] frontend/dist wurde nicht gefunden: %s\n' "${PLUGIN_DIR}/frontend/dist" >&2
    exit 1
}

OUTPUT_PATH="${2:-}"
if [ -z "$OUTPUT_PATH" ]; then
    PLUGIN_NAME="$(basename "$PLUGIN_DIR")"
    OUTPUT_PATH="$(cd "$PLUGIN_DIR/.." && pwd)/${PLUGIN_NAME}.zip"
fi

command -v zip >/dev/null 2>&1 || {
    printf '[ERROR] Das Kommando zip ist nicht installiert.\n' >&2
    exit 1
}

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

mkdir -p "$TEMP_DIR/backend" "$TEMP_DIR/frontend/dist" "$TEMP_DIR/assets" "$TEMP_DIR/docs"
cp "${PLUGIN_DIR}/manifest.json" "$TEMP_DIR/manifest.json"
cp -R "${PLUGIN_DIR}/backend/." "$TEMP_DIR/backend/"
cp -R "${PLUGIN_DIR}/frontend/dist/." "$TEMP_DIR/frontend/dist/"

if [ -f "${PLUGIN_DIR}/README.md" ]; then
    cp "${PLUGIN_DIR}/README.md" "$TEMP_DIR/README.md"
fi

if [ -d "${PLUGIN_DIR}/assets" ]; then
    cp -R "${PLUGIN_DIR}/assets/." "$TEMP_DIR/assets/"
fi

if [ -d "${PLUGIN_DIR}/docs" ]; then
    cp -R "${PLUGIN_DIR}/docs/." "$TEMP_DIR/docs/"
fi

rm -f "$OUTPUT_PATH"
(
    cd "$TEMP_DIR"
    zip -r "$OUTPUT_PATH" . -x "*.DS_Store" "__MACOSX/*" >/dev/null
)

printf 'Plugin-ZIP erstellt: %s\n' "$OUTPUT_PATH"
