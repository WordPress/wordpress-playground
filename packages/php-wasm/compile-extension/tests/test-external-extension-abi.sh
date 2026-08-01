#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
PHP_VERSION="${PHP_VERSION:-8.5}"

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required for external extension ABI tests." >&2
	exit 1
fi

mkdir -p "${ROOT_DIR}/tmp"
WORK_DIR="$(mktemp -d "${ROOT_DIR}/tmp/external-extension-abi.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

node "$ROOT_DIR/packages/php-wasm/compile/build.js" \
	--PLATFORM=node \
	--PHP_VERSION="$PHP_VERSION" \
	--WITH_JSPI=yes \
	--output-dir="$WORK_DIR/runtime"

node \
	--experimental-wasm-jspi \
	--experimental-strip-types \
	--experimental-transform-types \
	--disable-warning=ExperimentalWarning \
	--import "$ROOT_DIR/packages/meta/src/node-es-module-loader/register.mts" \
	"$ROOT_DIR/packages/php-wasm/compile-extension/src/cli.ts" \
	--source "$ROOT_DIR/packages/php-wasm/compile-extension/tests/fixtures/external-abi" \
	--name external_abi \
	--php-versions "$PHP_VERSION" \
	--jobs 1 \
	--out "$WORK_DIR/extension"

node \
	--experimental-wasm-jspi \
	--experimental-strip-types \
	--experimental-transform-types \
	--disable-warning=ExperimentalWarning \
	--import "$ROOT_DIR/packages/meta/src/node-es-module-loader/register.mts" \
	"$ROOT_DIR/packages/php-wasm/compile-extension/tests/load-built-extension.mjs" \
	"$WORK_DIR/extension/manifest.json" \
	"$PHP_VERSION" \
	"<?php echo external_abi_probe() ? 'external ABI loaded' : 'probe failed';" \
	"external ABI loaded" \
	"$WORK_DIR/runtime/php_${PHP_VERSION//./_}.js"
