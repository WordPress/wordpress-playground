#!/usr/bin/env bash
set -euo pipefail

PACKAGES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EDIT_MARKDOWN_DIR="$PACKAGES_DIR/playground/cli/src/edit-markdown"
ZIP_URL="https://github.com/adamziel/wp-extensions/releases/download/markdown-editor-latest/wp-markdown-editor.zip"
ZIP_PATH="$EDIT_MARKDOWN_DIR/.tmp/wp-markdown-editor.zip"
RUNTIME_DIR="$EDIT_MARKDOWN_DIR/wp-markdown-editor"

rm -rf "$EDIT_MARKDOWN_DIR/.tmp" "$RUNTIME_DIR"
mkdir -p "$EDIT_MARKDOWN_DIR/.tmp"

curl -fsSL "$ZIP_URL" -o "$ZIP_PATH"
unzip -q "$ZIP_PATH" -d "$EDIT_MARKDOWN_DIR"
rm -rf "$EDIT_MARKDOWN_DIR/.tmp"

test -f "$RUNTIME_DIR/markdown-editor/sqlite-markdown-extension/dist/manifest.json"
test -f "$RUNTIME_DIR/markdown-editor/edit-markdown-mu-plugin.php"
