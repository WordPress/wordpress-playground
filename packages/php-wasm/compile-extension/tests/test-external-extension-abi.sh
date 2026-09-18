#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
PHP_VERSION="${PHP_VERSION:-8.5}"
TESTS_DIR="$ROOT_DIR/packages/php-wasm/compile-extension/tests"
CLI="$ROOT_DIR/packages/php-wasm/compile-extension/src/cli.ts"

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required for external extension ABI tests." >&2
	exit 1
fi

mkdir -p "${ROOT_DIR}/tmp"
WORK_DIR="$(mktemp -d "${ROOT_DIR}/tmp/external-extension-abi.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT
RUNTIME_LOADER="$WORK_DIR/runtime/php_${PHP_VERSION//./_}.js"

# Build a fresh PHP.wasm runtime that the extensions below will link against.
node "$ROOT_DIR/packages/php-wasm/compile/build.js" \
	--PLATFORM=node \
	--PHP_VERSION="$PHP_VERSION" \
	--WITH_JSPI=yes \
	--output-dir="$WORK_DIR/runtime"

run_cli() {
	node \
		--experimental-wasm-jspi \
		--experimental-strip-types \
		--experimental-transform-types \
		--disable-warning=ExperimentalWarning \
		--import "$ROOT_DIR/packages/meta/src/node-es-module-loader/register.mts" \
		"$CLI" "$@"
}

run_loader() {
	node \
		--experimental-wasm-jspi \
		--experimental-strip-types \
		--experimental-transform-types \
		--disable-warning=ExperimentalWarning \
		--import "$ROOT_DIR/packages/meta/src/node-es-module-loader/register.mts" \
		"$TESTS_DIR/load-built-extension.mjs" "$@"
}

# 1. A standard PHP module extension (exposes get_module()).
run_cli \
	--source "$TESTS_DIR/fixtures/external-abi" \
	--name external_abi \
	--php-versions "$PHP_VERSION" \
	--jobs 1 \
	--out "$WORK_DIR/extension"

# The module allocates compile-time-constant sizes. Assert those calls resolve
# to the stable emalloc() symbol instead of build-specific _emalloc_<size>()
# shortcuts, i.e. that Dockerfile.ext's HAVE_BUILTIN_CONSTANT_P undef took hold.
node --input-type=module - \
	"$WORK_DIR/extension/external_abi-php${PHP_VERSION}-jspi.so" <<'EOF'
import { readFile } from 'node:fs/promises';

const soPath = process.argv[2];
const module = new WebAssembly.Module(await readFile(soPath));
const imports = WebAssembly.Module.imports(module).map(({ name }) => name);

// Emscripten side modules import PHP's allocator with a leading underscore:
// the stable entry point is `_emalloc`, and the specialized shortcuts are
// `_emalloc_<size>` (e.g. `_emalloc_160`).
if (!imports.includes('_emalloc')) {
	throw new Error(`${soPath} does not import the stable _emalloc() symbol.`);
}
const specialized = imports.filter((name) => /^_?emalloc_\d+$/.test(name));
if (specialized.length > 0) {
	throw new Error(
		`${soPath} imports build-specific allocator symbols (${specialized.join(
			', '
		)}). HAVE_BUILTIN_CONSTANT_P was not undefined for the extension build.`
	);
}
EOF

run_loader \
	"$WORK_DIR/extension/manifest.json" \
	"$PHP_VERSION" \
	"<?php echo external_abi_probe() ? 'external ABI loaded' : 'probe failed';" \
	"external ABI loaded" \
	"$RUNTIME_LOADER"

# 2. A pure Zend extension (no get_module(); loaded with zend_extension=).
run_cli \
	--source "$TESTS_DIR/fixtures/external-abi-zend" \
	--name external_abi_zend \
	--php-versions "$PHP_VERSION" \
	--jobs 1 \
	--out "$WORK_DIR/extension-zend"

run_loader \
	"$WORK_DIR/extension-zend/manifest.json" \
	"$PHP_VERSION" \
	"<?php echo in_array('external_abi_zend', get_loaded_extensions(true), true) ? 'zend ABI loaded' : 'zend ext missing';" \
	"zend ABI loaded" \
	"$RUNTIME_LOADER" \
	zend_extension
