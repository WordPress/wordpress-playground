#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PACKAGE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$PACKAGE_DIR/../../.." && pwd)
MANIFEST="$PACKAGE_DIR/assets/php-assets.json"

for command in cargo python3 redis-server memcached sha256sum; do
	if ! command -v "$command" >/dev/null 2>&1; then
		echo "Required command is unavailable: $command" >&2
		exit 1
	fi
done

if [[ ! -f "$MANIFEST" ]]; then
	echo "PHP asset manifest is missing: $MANIFEST" >&2
	exit 1
fi

if [[ -n "${WP_PLAYGROUND_NATIVE_MATRIX_LOG_DIR:-}" ]]; then
	LOG_DIR=$WP_PLAYGROUND_NATIVE_MATRIX_LOG_DIR
	mkdir -p "$LOG_DIR"
	CLEAN_LOG_DIR=false
else
	LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/wp-playground-native-php-matrix.XXXXXX")
	CLEAN_LOG_DIR=true
fi

cleanup() {
	if [[ "$CLEAN_LOG_DIR" == true ]]; then
		rm -rf "$LOG_DIR"
	fi
}
trap cleanup EXIT

mapfile -t COMPONENTS < <(
	python3 - "$MANIFEST" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    manifest = json.load(source)

for version, asset in manifest["php"].items():
    base = asset["wasm"]
    extended = asset.get("variants", {}).get("extended", {}).get("wasm")
    if not extended:
        raise SystemExit(f"PHP {version} does not declare variants.extended.wasm")
    print(
        f'{version}\t{base["path"]}\t{base["sha256"]}'
        f'\t{extended["path"]}\t{extended["sha256"]}'
    )
PY
)

EXPECTED_VERSIONS=(7.4 8.0 8.1 8.2 8.3 8.4 8.5)
if [[ ${#COMPONENTS[@]} -ne ${#EXPECTED_VERSIONS[@]} ]]; then
	echo "Expected ${#EXPECTED_VERSIONS[@]} PHP versions; manifest declares ${#COMPONENTS[@]}" >&2
	exit 1
fi

TESTS=(
	component_artifact_stages_runtime_and_runs_parallel_workers
	xdebug_extended_component_completes_a_real_dbgp_handshake
	redis_and_memcached_extensions_complete_real_tcp_round_trips
)

for index in "${!COMPONENTS[@]}"; do
	IFS=$'\t' read -r version base_relative base_sha extended_relative extended_sha \
		<<<"${COMPONENTS[$index]}"
	if [[ "$version" != "${EXPECTED_VERSIONS[$index]}" ]]; then
		echo "Expected PHP ${EXPECTED_VERSIONS[$index]} at manifest index $index; got $version" >&2
		exit 1
	fi
	base="$REPO_ROOT/$base_relative"
	extended="$REPO_ROOT/$extended_relative"
	for artifact in "$base" "$extended"; do
		if [[ ! -s "$artifact" ]]; then
			echo "PHP $version artifact is missing or empty: $artifact" >&2
			exit 1
		fi
	done
	actual_base_sha=$(sha256sum "$base")
	actual_base_sha=${actual_base_sha%% *}
	actual_extended_sha=$(sha256sum "$extended")
	actual_extended_sha=${actual_extended_sha%% *}
	if [[ "$actual_base_sha" != "$base_sha" ]]; then
		echo "PHP $version base hash mismatch: expected $base_sha, got $actual_base_sha" >&2
		exit 1
	fi
	if [[ "$actual_extended_sha" != "$extended_sha" ]]; then
		echo "PHP $version extended hash mismatch: expected $extended_sha, got $actual_extended_sha" >&2
		exit 1
	fi

	for test_name in "${TESTS[@]}"; do
		log="$LOG_DIR/php-$version-$test_name.log"
		test_flags=(-- --exact)
		if [[ "$test_name" != component_artifact_stages_runtime_and_runs_parallel_workers ]]; then
			test_flags=(-- --ignored --exact)
		fi
		if ! WP_PLAYGROUND_NATIVE_TEST_PHP_VERSION="$version" \
			WP_PLAYGROUND_NATIVE_TEST_PHP_COMPONENT="$base" \
			WP_PLAYGROUND_NATIVE_TEST_PHP_EXTENDED_COMPONENT="$extended" \
			cargo test --manifest-path "$PACKAGE_DIR/Cargo.toml" --lib \
				"php_backend::tests::$test_name" "${test_flags[@]}" >"$log" 2>&1; then
			echo "FAIL PHP $version $test_name; last 80 log lines:" >&2
			tail -n 80 "$log" >&2
			exit 1
		fi
		echo "PASS PHP $version $test_name"
	done
done

echo "PASS PHP 7.4–8.5 base, Xdebug, Redis, and Memcached runtime matrix"
