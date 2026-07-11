#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$ROOT/../../../.." && pwd)
COMPONENT="$ROOT/dist/php-wasi-component.wasm"
MANIFEST="$REPO_ROOT/packages/playground/cli-native/assets/php-assets.json"
RELATIVE_PATH=packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm

checksum=$(sha256sum "$COMPONENT" | cut -d' ' -f1)
expected_checksum=$(
	sed -n 's/.*"sha256": "\([0-9a-f]\{64\}\)".*/\1/p' "$MANIFEST"
)
grep -Fq "\"path\": \"$RELATIVE_PATH\"" "$MANIFEST"
if [[ "$checksum" != "$expected_checksum" ]]; then
	echo "PHP WASI component checksum mismatch:" >&2
	echo "  expected: $expected_checksum" >&2
	echo "  actual:   $checksum" >&2
	exit 1
fi

echo "Published PHP WASI component checksum matches the native asset manifest: $checksum"
