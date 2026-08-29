#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PHP_WASI_PHP_VERSION=8.2
# shellcheck source=../../versions.env
source "$ROOT/versions.env"

PATCH_FILE="$ROOT/extension-patches/xdebug-3.4-static-wasi.patch"
WORK_DIR=$(mktemp -d)
LOG_FILE="$WORK_DIR/patch.log"
trap 'rm -rf "$WORK_DIR"' EXIT

ARCHIVE=${1:-$ROOT/.build/downloads/xdebug-$XDEBUG_VERSION.tgz}
if [[ ! -f "$ARCHIVE" && $# -eq 0 ]]; then
	ARCHIVE="$WORK_DIR/xdebug-$XDEBUG_VERSION.tgz"
	curl --fail --location --silent --show-error "$XDEBUG_SOURCE_URL" \
		--output "$ARCHIVE"
elif [[ ! -f "$ARCHIVE" ]]; then
	echo "Xdebug source archive is missing: $ARCHIVE" >&2
	exit 2
fi
printf '%s  %s\n' "$XDEBUG_SOURCE_SHA256" "$ARCHIVE" \
	| sha256sum --check --status || {
	echo "Xdebug source archive checksum mismatch: $ARCHIVE" >&2
	exit 1
}

mkdir -p "$WORK_DIR/source"
tar -xzf "$ARCHIVE" --strip-components=1 -C "$WORK_DIR/source"

if ! patch --directory="$WORK_DIR/source" --strip=1 --forward --fuzz=0 \
		--dry-run --input="$PATCH_FILE" >"$LOG_FILE" 2>&1; then
	echo "Xdebug static WASI patch dry-run failed; last 40 lines:" >&2
	tail -n 40 "$LOG_FILE" >&2
	exit 1
fi

sed -n '1,20p' "$LOG_FILE"
echo "Xdebug $XDEBUG_VERSION static WASI patch applies with --fuzz=0"
