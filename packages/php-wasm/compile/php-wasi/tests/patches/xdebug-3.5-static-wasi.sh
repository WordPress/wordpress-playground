#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
export PHP_WASI_PHP_VERSION=8.5
# ROOT is resolved at runtime so this script works from any checkout path.
# shellcheck disable=SC1091
source "$ROOT/versions.env"

PATCH_FILE="$ROOT/extension-patches/xdebug-3.5-static-wasi.patch"
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
		--input="$PATCH_FILE" >"$LOG_FILE" 2>&1; then
	echo "Xdebug static WASI patch failed; last 40 lines:" >&2
	tail -n 40 "$LOG_FILE" >&2
	exit 1
fi

test -f "$WORK_DIR/source/xdebug_wasi_loader.c"
grep -Fq 'm4_include([ext/xdebug/m4/pkg.m4])' \
	"$WORK_DIR/source/config.m4"
grep -Fq 'm4_include([ext/xdebug/m4/clocks.m4])' \
	"$WORK_DIR/source/config.m4"
grep -Fq 'xdebug_wasi_loader.c' "$WORK_DIR/source/config.m4"
grep -Fq 'PHP_ADD_EXTENSION_DEP(xdebug, opcache)' "$WORK_DIR/source/config.m4"
grep -Fq "PHP_ADD_INCLUDE(\$ext_srcdir)" "$WORK_DIR/source/config.m4"
grep -Fq 'zend_extension_entry=xdebug_zend_extension_entry' "$WORK_DIR/source/config.m4"
grep -Fq 'extension_version_info=xdebug_extension_version_info' "$WORK_DIR/source/config.m4"
grep -Fq '!defined(PHP_WASI)' "$WORK_DIR/source/src/debugger/com.c"
grep -Fq '#if WIN32|WINNT || defined(PHP_WASI)' \
	"$WORK_DIR/source/src/debugger/com.c"
grep -Fq '#define phpext_xdebug_ptr &xdebug_wasi_loader_module_entry' \
	"$WORK_DIR/source/php_xdebug.h"
grep -Fq 'zend_register_extension(&xdebug_zend_extension_entry, NULL)' \
	"$WORK_DIR/source/xdebug_wasi_loader.c"

sed -n '1,20p' "$LOG_FILE"
echo "Xdebug $XDEBUG_VERSION static WASI patch applies with --fuzz=0"
