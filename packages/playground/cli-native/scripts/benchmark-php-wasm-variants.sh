#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BENCHMARK_SCRIPT="$SCRIPT_DIR/benchmark-wordpress.sh"

PHP_VERSION="${PHP_VERSION:-8.5}"
WP_VERSION="${WP_VERSION:-6.9}"
SAMPLES="${SAMPLES:-8}"
WARMUPS="${WARMUPS:-2}"
BASE_PORT="${BASE_PORT:-10100}"
PORT_STEP="${PORT_STEP:-20}"
PACKAGE_PRECOMPILE_WASMTIME="${PACKAGE_PRECOMPILE_WASMTIME:-1}"
PHP_WASM_RUNTIME="${PHP_WASM_RUNTIME:-wasmtime-async}"
KEEP_VARIANT_ARTIFACTS="${KEEP_VARIANT_ARTIFACTS:-0}"
DRY_RUN="${DRY_RUN:-0}"
WORK_DIR="${WORK_DIR:-}"
VARIANTS="${VARIANTS:-dlmalloc-64:64MB:dlmalloc emmalloc-64:64MB:emmalloc emmalloc-48:48MB:emmalloc dlmalloc-48:48MB:dlmalloc}"

usage() {
	cat <<'USAGE'
Build PHP wasm variants, generate native CLI asset roots, and benchmark them.

Each variant has this form:
  label:INITIAL_MEMORY:MALLOC[:EXTRA_BUILD_ARGS]

EXTRA_BUILD_ARGS is an optional comma-separated list of build.js options without
leading --, for example:
  light-48:48MB:emmalloc:WITH_GD=no,WITH_MYSQL=no,WITH_IMAGICK=no

Environment:
  PHP_VERSION=8.5
  WP_VERSION=6.9
  SAMPLES=8
  WARMUPS=2
  BASE_PORT=10100
  PORT_STEP=20
  PACKAGE_PRECOMPILE_WASMTIME=1
  PHP_WASM_RUNTIME=wasmtime-async
  KEEP_VARIANT_ARTIFACTS=0
  WORK_DIR=/tmp/wp-native-variant-bench
  DRY_RUN=0
  VARIANTS="dlmalloc-64:64MB:dlmalloc emmalloc-64:64MB:emmalloc emmalloc-48:48MB:emmalloc dlmalloc-48:48MB:dlmalloc"

Examples:
  DRY_RUN=1 bash packages/playground/cli-native/scripts/benchmark-php-wasm-variants.sh
  SAMPLES=12 VARIANTS="emmalloc-48:48MB:emmalloc dlmalloc-48:48MB:dlmalloc" \
    bash packages/playground/cli-native/scripts/benchmark-php-wasm-variants.sh
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	usage
	exit 0
fi

if [[ -z "$WORK_DIR" ]]; then
	if [[ "$DRY_RUN" == "1" ]]; then
		WORK_DIR="${TMPDIR:-/tmp}/wp-native-variant-bench.DRYRUN"
	else
		WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wp-native-variant-bench.XXXXXX")"
	fi
fi

cleanup() {
	if [[ "$KEEP_VARIANT_ARTIFACTS" != "1" && "$DRY_RUN" != "1" ]]; then
		rm -rf "$WORK_DIR"
	fi
}
trap cleanup EXIT

require_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "error: required command not found: $1" >&2
		exit 1
	fi
}

if [[ "$DRY_RUN" != "1" ]]; then
	require_cmd awk
	require_cmd docker
	require_cmd node
	require_cmd shasum
fi

case "$PACKAGE_PRECOMPILE_WASMTIME" in
	0 | 1) ;;
	*)
		echo "error: PACKAGE_PRECOMPILE_WASMTIME must be 0 or 1" >&2
		exit 1
		;;
esac

case "$PHP_WASM_RUNTIME" in
	wasmtime-async | asyncify) ;;
	*)
		echo "error: PHP_WASM_RUNTIME must be wasmtime-async or asyncify" >&2
		exit 1
		;;
esac

major="${PHP_VERSION%%.*}"
minor="${PHP_VERSION#*.}"
minor="${minor%%.*}"
php_selector_version="$major.$minor"
version_dir="${major}-${minor}"
underscore_version="${major}_${minor}"

sha256_file() {
	shasum -a 256 "$1" | awk '{ print $1 }'
}

asset_path() {
	local absolute="$1"
	local relative="${absolute#"$2"/}"
	printf "%s" "$relative"
}

write_asset_manifest() {
	local asset_root="$1"
	local js_path="$2"
	local wasm_path="$3"
	local manifest_dir="$asset_root/packages/playground/cli-native/assets"
	local manifest_path="$manifest_dir/php-assets.json"
	mkdir -p "$manifest_dir"
	cat >"$manifest_path" <<JSON
{
	"schemaVersion": 1,
	"runtime": "node-builds/$PHP_WASM_RUNTIME",
	"php": {
		"$php_selector_version": {
			"js": {
				"path": "$(asset_path "$js_path" "$asset_root")",
				"sha256": "$(sha256_file "$js_path")"
			},
			"wasm": {
				"path": "$(asset_path "$wasm_path" "$asset_root")",
				"sha256": "$(sha256_file "$wasm_path")"
			}
		}
	}
}
JSON
}

link_shared_assets() {
	local asset_root="$1"
	mkdir -p "$asset_root/packages/playground"
	rm -f "$asset_root/packages/playground/wordpress-builds"
	ln -s "$REPO_ROOT/packages/playground/wordpress-builds" \
		"$asset_root/packages/playground/wordpress-builds"
}

build_variant_asset_root() {
	local label="$1"
	local initial_memory="$2"
	local malloc="$3"
	local extra_csv="${4:-}"
	local asset_root="$WORK_DIR/$label/asset-root"
	local output_dir="$asset_root/packages/php-wasm/node-builds/$version_dir/$PHP_WASM_RUNTIME"
	local build_args=(
		"$REPO_ROOT/packages/php-wasm/compile/build.js"
		"--PLATFORM=node"
		"--PHP_VERSION=$PHP_VERSION"
		"--output-dir=$output_dir"
		"--INITIAL_MEMORY=$initial_memory"
		"--MALLOC=$malloc"
	)
	if [[ "$PHP_WASM_RUNTIME" == "wasmtime-async" ]]; then
		build_args+=("--WITH_WASMTIME_ASYNC=yes")
	fi

	if [[ -n "$extra_csv" ]]; then
		local extra_args=()
		IFS=',' read -r -a extra_args <<<"$extra_csv"
		for arg in "${extra_args[@]}"; do
			if [[ -n "$arg" ]]; then
				build_args+=("--$arg")
			fi
		done
	fi

	if [[ "$DRY_RUN" == "1" ]]; then
		printf "node"
		printf " %q" "${build_args[@]}"
		printf "\n"
		printf "PACKAGE_ASSET_ROOT=%q WASMTIME_LABEL=%q PHP_VERSION=%q WP_VERSION=%q SAMPLES=%q WARMUPS=%q BASE_PORT=<port> PACKAGE_PRECOMPILE_WASMTIME=%q PHP_WASM_RUNTIME=%q bash %q\n" \
			"$asset_root" "$label" "$php_selector_version" "$WP_VERSION" "$SAMPLES" "$WARMUPS" "$PACKAGE_PRECOMPILE_WASMTIME" "$PHP_WASM_RUNTIME" "$BENCHMARK_SCRIPT"
		return 0
	fi

	rm -rf "$asset_root"
	mkdir -p "$output_dir"
	link_shared_assets "$asset_root"
	if ! node "${build_args[@]}"; then
		return 1
	fi

	local js_path="$output_dir/php_${underscore_version}.js"
	local wasm_path
	wasm_path="$(find "$output_dir" -path "*/php_${underscore_version}.wasm" -type f | sort | tail -n 1)"
	if [[ ! -f "$js_path" || -z "$wasm_path" || ! -f "$wasm_path" ]]; then
		echo "error: expected PHP wasm build artifacts were not produced under $output_dir" >&2
		return 1
	fi
	write_asset_manifest "$asset_root" "$js_path" "$wasm_path"
}

run_variant_benchmark() {
	local label="$1"
	local port="$2"
	local asset_root="$WORK_DIR/$label/asset-root"
	local log="$WORK_DIR/$label/benchmark.log"
	local status

	set +e
	(
		unset WP_PLAYGROUND_NATIVE_BENCH_BIN
		unset WP_PLAYGROUND_NATIVE_ASSET_ROOT
		unset WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK
		PHP_VERSION="$php_selector_version" \
		WP_VERSION="$WP_VERSION" \
		SAMPLES="$SAMPLES" \
		WARMUPS="$WARMUPS" \
		BASE_PORT="$port" \
		PACKAGE_ASSET_ROOT="$asset_root" \
		PACKAGE_PRECOMPILE_WASMTIME="$PACKAGE_PRECOMPILE_WASMTIME" \
		WASMTIME_LABEL="$label" \
		NATIVE_PHP_LABEL="$label-native-php" \
		bash "$BENCHMARK_SCRIPT"
	) | tee "$log"
	status="${PIPESTATUS[0]}"
	set -e
	return "$status"
}

combined_results="$WORK_DIR/variant-results.tsv"
combined_ratios="$WORK_DIR/variant-ratios.tsv"
variant_failures="$WORK_DIR/variant-failures.tsv"
if [[ "$DRY_RUN" != "1" ]]; then
	mkdir -p "$WORK_DIR"
	printf "case\tburst_rss_mib\tidle_rss_mib\thome_p50_ms\thome_p95_ms\tsearch_p50_ms\tsearch_p95_ms\tpost_p50_ms\tpost_p95_ms\teditor_p50_ms\teditor_p95_ms\n" >"$combined_results"
	printf "variant\tmetric\tratio_vs_native\n" >"$combined_ratios"
	printf "variant\tstage\n" >"$variant_failures"
fi

index=0
for variant in $VARIANTS; do
	IFS=':' read -r label initial_memory malloc extra_csv <<<"$variant"
	if [[ -z "${label:-}" || -z "${initial_memory:-}" || -z "${malloc:-}" ]]; then
		echo "error: invalid variant spec: $variant" >&2
		exit 1
	fi
	case "$malloc" in
		dlmalloc | emmalloc | mimalloc) ;;
		*)
			echo "error: invalid malloc in variant ${label}: ${malloc}" >&2
			exit 1
			;;
	esac

	if ! build_variant_asset_root "$label" "$initial_memory" "$malloc" "${extra_csv:-}"; then
		if [[ "$DRY_RUN" != "1" ]]; then
			printf "%s\tbuild\n" "$label" >>"$variant_failures"
		fi
		index="$((index + 1))"
		continue
	fi
	if [[ "$DRY_RUN" != "1" ]]; then
		port="$((BASE_PORT + (index * PORT_STEP)))"
		if run_variant_benchmark "$label" "$port"; then
			awk -F '\t' -v label="$label" -v native_label="$label-native-php" \
				'($1 == label || $1 == native_label) && NF == 11 { print }' \
				"$WORK_DIR/$label/benchmark.log" >>"$combined_results"
			awk -F '\t' -v label="$label" '
				$0 == "ratios_vs_native" {
					capturing = 1;
					next;
				}
				capturing && NF == 2 {
					print label "\t" $1 "\t" $2;
				}
			' "$WORK_DIR/$label/benchmark.log" >>"$combined_ratios"
		else
			printf "%s\tbenchmark\n" "$label" >>"$variant_failures"
		fi
	fi
	index="$((index + 1))"
done

if [[ "$DRY_RUN" != "1" ]]; then
	echo ""
	echo "combined_variant_results"
	cat "$combined_results"
	echo ""
	echo "combined_variant_ratios"
	cat "$combined_ratios"
	if awk 'NR > 1 { found = 1 } END { exit found ? 0 : 1 }' "$variant_failures"; then
		echo ""
		echo "variant_failures"
		cat "$variant_failures"
	fi
	if [[ "$KEEP_VARIANT_ARTIFACTS" == "1" ]]; then
		echo ""
		echo "variant_artifacts=$WORK_DIR"
	fi
fi
