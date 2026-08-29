#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$ROOT/../../../.." && pwd)
MANIFEST="$REPO_ROOT/packages/playground/cli-native/assets/php-assets.json"
PHP_SERIES=${PHP_WASI_PHP_VERSION:-8.2}
PHP_WASI_VARIANT=${PHP_WASI_VARIANT:-base}

case "$PHP_SERIES" in
	7.4|8.0|8.1|8.2|8.3|8.4|8.5) ;;
	*)
		echo "Unsupported PHP WASI version: $PHP_SERIES" >&2
		exit 2
		;;
esac
case "$PHP_WASI_VARIANT" in
	base|extended) ;;
	*)
		echo "Unsupported PHP WASI variant: $PHP_WASI_VARIANT" >&2
		exit 2
		;;
esac

if [[ "$PHP_SERIES" == 8.2 ]]; then
	COMPONENT_BASENAME=php-wasi-component.wasm
	if [[ "$PHP_WASI_VARIANT" == extended ]]; then
		COMPONENT_BASENAME=php-wasi-extended-component.wasm
	fi
else
	COMPONENT_BASENAME="php-$PHP_SERIES-wasi-component.wasm"
	if [[ "$PHP_WASI_VARIANT" == extended ]]; then
		COMPONENT_BASENAME="php-$PHP_SERIES-wasi-extended-component.wasm"
	fi
fi
COMPONENT=${1:-$ROOT/dist/$COMPONENT_BASENAME}
RELATIVE_PATH="packages/php-wasm/compile/php-wasi/dist/$COMPONENT_BASENAME"

checksum=$(sha256sum "$COMPONENT" | cut -d' ' -f1)
mapfile -t manifest_fields < <(python3 - "$MANIFEST" "$PHP_SERIES" "$PHP_WASI_VARIANT" <<'PY'
import json
import sys

manifest_path, php_series, variant = sys.argv[1:]
with open(manifest_path, encoding="utf-8") as manifest_file:
    manifest = json.load(manifest_file)
try:
    php_entry = manifest["php"][php_series]
    asset = php_entry["wasm"] if variant == "base" else php_entry["variants"][variant]["wasm"]
    print(asset["path"])
    print(asset["sha256"])
except KeyError as error:
    raise SystemExit(
        f"PHP {php_series} {variant} is missing from {manifest_path}: {error}"
    )
PY
)
if [[ ${#manifest_fields[@]} -ne 2 ]]; then
	echo "Could not read PHP $PHP_SERIES $PHP_WASI_VARIANT from $MANIFEST" >&2
	exit 1
fi
expected_path=${manifest_fields[0]}
expected_checksum=${manifest_fields[1]}
if [[ "$expected_path" != "$RELATIVE_PATH" ]]; then
	echo "PHP WASI component manifest path mismatch:" >&2
	echo "  expected: $RELATIVE_PATH" >&2
	echo "  actual:   $expected_path" >&2
	exit 1
fi
if [[ "$checksum" != "$expected_checksum" ]]; then
	echo "PHP WASI component checksum mismatch:" >&2
	echo "  expected: $expected_checksum" >&2
	echo "  actual:   $checksum" >&2
	exit 1
fi

echo "Published PHP $PHP_SERIES $PHP_WASI_VARIANT component checksum matches the native asset manifest: $checksum"
