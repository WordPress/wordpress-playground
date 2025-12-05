#!/usr/bin/env bash
set -euo pipefail

FS_EXT_VERSION="${FS_EXT_VERSION:-2.1.1}"
TARGET_OS="${TARGET_OS:-$(node -p "process.platform")}" 
TARGET_ARCH="${TARGET_ARCH:-$(node -p "process.arch")}" 
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ARTIFACTS_DIR="${FS_EXT_ARTIFACTS_DIR:-$SCRIPT_DIR/../fs-ext-artifacts}"

WORKDIR=$(mktemp -d)
cleanup() {
    # rm -rf "$WORKDIR"
    echo "WORKDIR: $WORKDIR"
}
trap cleanup EXIT

mkdir -p "$WORKDIR/src" "$ARTIFACTS_DIR"

echo "Fetching fs-ext@${FS_EXT_VERSION}..."
npm pack "fs-ext@${FS_EXT_VERSION}" --pack-destination "$WORKDIR/src" >/dev/null
TARBALL=$(find "$WORKDIR/src" -maxdepth 1 -name "fs-ext-*.tgz" | head -n1)

tar -xzf "$TARBALL" -C "$WORKDIR/src"
cd "$WORKDIR/src/package"

echo "Installing build tooling..."
npm install --ignore-scripts --no-package-lock --no-progress prebuildify@6 node-abi@3 node-gyp-build@4 >/dev/null

echo "Building prebuild for ${TARGET_OS}-${TARGET_ARCH} on Node $(node -v)..."
NODE_ABI=$(node -e "console.log(require('node-abi').getAbi(process.versions.node, 'node'))")
npx prebuildify --strip --tag-libc >/dev/null

OUTPUT_NAME="fs-ext-prebuild-${TARGET_OS}-${TARGET_ARCH}-abi${NODE_ABI}.tar.gz"
OUTPUT_PATH="$ARTIFACTS_DIR/${OUTPUT_NAME}"

tar -czf "$OUTPUT_PATH" prebuilds binding.gyp package.json README.md

echo "Prebuild artifact created: ${OUTPUT_PATH}"
