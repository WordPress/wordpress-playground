#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
# shellcheck source=../../versions.env
source "$ROOT/versions.env"

PATCH_FILE="$ROOT/extension-patches/libmemcached-1.1.4-wasip2.patch"
WORK_DIR=$(mktemp -d)
LOG_FILE="$WORK_DIR/patch.log"
trap 'rm -rf "$WORK_DIR"' EXIT

ARCHIVE=${1:-$ROOT/.build/downloads/libmemcached-$LIBMEMCACHED_VERSION.tar.gz}
if [[ ! -f "$ARCHIVE" && $# -eq 0 ]]; then
	ARCHIVE="$WORK_DIR/libmemcached-$LIBMEMCACHED_VERSION.tar.gz"
	curl --fail --location --silent --show-error "$LIBMEMCACHED_SOURCE_URL" \
		--output "$ARCHIVE"
elif [[ ! -f "$ARCHIVE" ]]; then
	echo "libmemcached source archive is missing: $ARCHIVE" >&2
	exit 2
fi
printf '%s  %s\n' "$LIBMEMCACHED_SOURCE_SHA256" "$ARCHIVE" \
	| sha256sum --check --status || {
	echo "libmemcached source archive checksum mismatch: $ARCHIVE" >&2
	exit 1
}

mkdir -p "$WORK_DIR/source"
tar -xzf "$ARCHIVE" --strip-components=1 -C "$WORK_DIR/source"

if ! patch --directory="$WORK_DIR/source" --strip=1 --forward --fuzz=0 \
		--dry-run --input="$PATCH_FILE" >"$LOG_FILE" 2>&1; then
	echo "libmemcached WASIp2 patch dry-run failed; last 40 lines:" >&2
	tail -n 40 "$LOG_FILE" >&2
	exit 1
fi

echo "libmemcached $LIBMEMCACHED_VERSION WASIp2 patch applies with --fuzz=0"
