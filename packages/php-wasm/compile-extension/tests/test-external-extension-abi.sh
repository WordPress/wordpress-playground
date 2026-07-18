#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
WORK_DIR="${ROOT_DIR}/tmp/external-extension-abi"
PHP_VERSION="${PHP_VERSION:-8.3}"

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required for external extension ABI tests." >&2
	exit 1
fi

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
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

node --input-type=module - "$WORK_DIR/runtime" "$WORK_DIR/extension" "$PHP_VERSION" <<'EOF'
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [runtimeDir, extensionDir, phpVersion] = process.argv.slice(2);
const runtimeVersion = phpVersion.replaceAll('.', '_');
const runtimeBuildDir = readdirSync(runtimeDir).find((entry) =>
	entry.startsWith(`${runtimeVersion}_`)
);
if (!runtimeBuildDir) {
	throw new Error(`Could not find the PHP ${phpVersion} runtime output.`);
}
const runtimePath = join(
	runtimeDir,
	runtimeBuildDir,
	`php_${runtimeVersion}.wasm`
);
const extensionPath = join(
	extensionDir,
	`external_abi-php${phpVersion}-jspi.so`
);
const runtimeModule = new WebAssembly.Module(readFileSync(runtimePath));
const extensionModule = new WebAssembly.Module(readFileSync(extensionPath));
const runtimeExports = new Set(
	WebAssembly.Module.exports(
		runtimeModule
	).map(({ name }) => name)
);
const runtimeImports = new Set(
	WebAssembly.Module.imports(runtimeModule)
		.filter(({ module, kind }) => module === 'env' && kind === 'function')
		.map(({ name }) => name)
);
const unresolvedImports = WebAssembly.Module.imports(
	extensionModule
)
	.filter(({ module, name }) =>
		(module === 'env' || module === 'GOT.mem' || module === 'GOT.func') &&
		!runtimeExports.has(name) &&
		!runtimeImports.has(name)
	)
	.map(({ module, name }) => `${module}.${name}`);

if (unresolvedImports.length) {
	throw new Error(
		`The PHP ${phpVersion} runtime does not export extension imports: ${unresolvedImports.join(', ')}`
	);
}
EOF
