#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
PACKAGE_DIR="${ROOT_DIR}/dist/packages/php-wasm/compile-extension"
WORK_DIR="${ROOT_DIR}/tmp/compile-extension-lazy-fetch"
CACHE_DIR="${WORK_DIR}/cache"
FAKE_DOCKER_BIN="${WORK_DIR}/bin"
CONSUMER_DIR="$(mktemp -d "${TMPDIR:-/tmp}/compile-extension-consumer-XXXXXX")"

rm -rf "$WORK_DIR"
mkdir -p "$CACHE_DIR" "$FAKE_DOCKER_BIN"
trap 'rm -rf "$WORK_DIR" "$CONSUMER_DIR"' EXIT

npx nx build php-wasm-compile-extension

PACK_JSON="$(cd "$PACKAGE_DIR" && npm pack --dry-run --json)"
PACK_JSON="$PACK_JSON" node <<'NODE'
const pack = JSON.parse(process.env.PACK_JSON)[0];
const assetFiles = pack.files
	.map((file) => file.path)
	.filter((filepath) =>
		filepath.startsWith('php-wasm/') ||
		filepath.startsWith('compile/') ||
		filepath.startsWith('compile-extension/')
	);
if (assetFiles.length > 0) {
	throw new Error(
		`Package tarball should not include Playground Docker assets: ${assetFiles.join(', ')}`
	);
}
NODE

cat > "${FAKE_DOCKER_BIN}/docker" <<'BASH'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
	echo "Docker version 99.0.0"
	exit 0
fi
echo "fake docker $*" >&2
exit 42
BASH
chmod +x "${FAKE_DOCKER_BIN}/docker"

set +e
OUTPUT="$(
	cd "$CONSUMER_DIR" &&
		PATH="${FAKE_DOCKER_BIN}:$PATH" \
		PHP_WASM_COMPILE_EXTENSION_CACHE_DIR="$CACHE_DIR" \
		node "${PACKAGE_DIR}/cli.js" --prepare-image --php-versions 8.4 2>&1
)"
STATUS=$?
set -e

echo "$OUTPUT"

if [ "$STATUS" -eq 0 ]; then
	echo "Expected fake docker build to stop the CLI after asset fetch." >&2
	exit 1
fi

PACKAGE_VERSION="$(node -p "require('${PACKAGE_DIR}/package.json').version")"
EXPECTED_REF="v${PACKAGE_VERSION}"

if ! grep -q "Fetching PHP.wasm Docker assets from WordPress/wordpress-playground ${EXPECTED_REF}" <<<"$OUTPUT"; then
	echo "Expected the package build to fetch Docker assets from ${EXPECTED_REF}." >&2
	exit 1
fi

if ! grep -q "Running docker build -f ./Dockerfile . --tag=playground-php-wasm:base --progress=plain" <<<"$OUTPUT"; then
	echo "Expected the CLI to use the fetched base-image Docker context." >&2
	exit 1
fi

SOURCE_JSON="$(find "$CACHE_DIR" -path '*/php-wasm/source.json' -print -quit)"
if [ -z "$SOURCE_JSON" ]; then
	echo "Expected lazy fetch to write php-wasm/source.json." >&2
	exit 1
fi

SOURCE_JSON="$SOURCE_JSON" EXPECTED_REF="$EXPECTED_REF" node <<'NODE'
const fs = require('fs');
const source = JSON.parse(fs.readFileSync(process.env.SOURCE_JSON, 'utf8'));
if (source.repository !== 'https://github.com/WordPress/wordpress-playground.git') {
	throw new Error(`Unexpected repository: ${source.repository}`);
}
if (source.ref !== process.env.EXPECTED_REF) {
	throw new Error(`Expected ${process.env.EXPECTED_REF}, got ${source.ref}`);
}
NODE

PHP_WASM_ROOT="$(dirname "$SOURCE_JSON")"
for asset in \
	compile/base-image/Dockerfile \
	compile/base-image/emcc-for-php-wasm.sh \
	compile/base-image/replace.sh \
	compile/base-image/replace-across-lines.sh \
	compile/php/php8.4.patch \
	compile/php/php-chunk-alloc-zend-assert-8.5.patch \
	compile-extension/docker/Dockerfile.ext \
	compile-extension/scripts/build-in-docker.sh
do
	if [ ! -f "${PHP_WASM_ROOT}/${asset}" ]; then
		echo "Expected fetched asset ${asset}." >&2
		exit 1
	fi
done

if find "$CACHE_DIR" \( -name .git-work -o -path '*/packages/php-wasm/*' \) -print -quit | grep -q .; then
	echo "Expected cache to contain only the normalized php-wasm asset context." >&2
	exit 1
fi
