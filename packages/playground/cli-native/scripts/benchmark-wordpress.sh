#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CLI_DIR="$REPO_ROOT/packages/playground/cli-native"

PHP_VERSION="${PHP_VERSION:-8.2}"
WP_VERSION="${WP_VERSION:-6.9}"
SAMPLES="${SAMPLES:-30}"
WARMUPS="${WARMUPS:-}"
IDLE_SLEEP="${IDLE_SLEEP:-1.2}"
STARTUP_RETRIES="${STARTUP_RETRIES:-240}"
BASE_PORT="${BASE_PORT:-9690}"
BUILD_PACKAGE="${BUILD_PACKAGE:-1}"
KEEP_BENCH_ARTIFACTS="${KEEP_BENCH_ARTIFACTS:-0}"
BENCHMARK_PROFILE="${BENCHMARK_PROFILE:-0}"
BENCHMARK_WP_STAGE_PROFILE="${BENCHMARK_WP_STAGE_PROFILE:-0}"
BENCHMARK_GUARD="${BENCHMARK_GUARD:-0}"
BENCHMARK_BASELINE_RESULTS="${BENCHMARK_BASELINE_RESULTS:-}"
BENCHMARK_BASELINE_LABEL="${BENCHMARK_BASELINE_LABEL:-}"
BENCHMARK_MAX_BURST_RSS_MIB="${BENCHMARK_MAX_BURST_RSS_MIB:-}"
BENCHMARK_MAX_IDLE_RSS_RATIO="${BENCHMARK_MAX_IDLE_RSS_RATIO:-1.3}"
BENCHMARK_MAX_ROUTE_REGRESSION_PCT="${BENCHMARK_MAX_ROUTE_REGRESSION_PCT:-5}"
BENCHMARK_MAX_ROUTE_REGRESSION_MS="${BENCHMARK_MAX_ROUTE_REGRESSION_MS:-10}"
BENCHMARK_LOAD_DURATION="${BENCHMARK_LOAD_DURATION:-15}"
BENCHMARK_LOAD_CONCURRENCY="${BENCHMARK_LOAD_CONCURRENCY:-4}"
BENCHMARK_LOAD_TIMEOUT="${BENCHMARK_LOAD_TIMEOUT:-30}"
BENCHMARK_RSS_SAMPLE_INTERVAL="${BENCHMARK_RSS_SAMPLE_INTERVAL:-0.05}"
BENCHMARK_OBJECTIVE_GUARD="${BENCHMARK_OBJECTIVE_GUARD:-1}"
BENCHMARK_OBJECTIVE_MAX_ROUTE_RATIO="${BENCHMARK_OBJECTIVE_MAX_ROUTE_RATIO:-1.40}"
BENCHMARK_OBJECTIVE_MIN_RPS_RATIO="${BENCHMARK_OBJECTIVE_MIN_RPS_RATIO:-0.70}"
BENCHMARK_OBJECTIVE_MAX_RSS_RATIO="${BENCHMARK_OBJECTIVE_MAX_RSS_RATIO:-1.50}"
PACKAGE_ASSET_ROOT="${PACKAGE_ASSET_ROOT:-}"
PACKAGE_PRECOMPILE_WASMTIME="${PACKAGE_PRECOMPILE_WASMTIME:-}"
PACKAGE_RELEASE_CODEGEN="${PACKAGE_RELEASE_CODEGEN:-1}"
WASMTIME_LABEL="${WASMTIME_LABEL:-wasmtime}"
NATIVE_PHP_BIN="${NATIVE_PHP_BIN:-php}"
NATIVE_PHP_LABEL="${NATIVE_PHP_LABEL:-native-php}"
WORK_DIR="${WORK_DIR:-}"
PACKAGE_DIR="${PACKAGE_DIR:-}"
PACKAGED_BENCH_BIN=0
EDITOR_PAGE_MARKER="post-new-php"
ACTIVE_SERVER_PID=""
ACTIVE_RSS_SAMPLER_PID=""
ACTIVE_RSS_OUTPUT=""
LAST_PEAK_TREE_RSS_MIB=""

WARMUPS="${WARMUPS:-5}"
PACKAGE_PRECOMPILE_WASMTIME="${PACKAGE_PRECOMPILE_WASMTIME:-1}"

usage() {
	cat <<'USAGE'
Benchmark wp-playground-native WordPress server behavior against system PHP.

Defaults build a temporary packaged native CLI with precompiled Wasmtime assets,
bootstrap comparable WordPress sites, then measure latency for these routes:
  /, /?s=hello, /?p=1, /wp-admin/post-new.php
It also runs an equal-mix sustained load, samples process-tree RSS, and enforces
the route <=1.40x, successful RPS >=0.70x, zero-error, and RSS <=1.50x goals.

Environment:
  PHP_VERSION=8.2
  WP_VERSION=6.9
  SAMPLES=30
  WARMUPS=5
  IDLE_SLEEP=1.2
  BASE_PORT=9690
  BUILD_PACKAGE=1
  WP_PLAYGROUND_NATIVE_BENCH_BIN=/path/to/bin/wp-playground-native
  PACKAGE_DIR=/tmp/wp-native-package-bench
  PACKAGE_ASSET_ROOT=/path/to/rebuilt/asset-root
  PACKAGE_PRECOMPILE_WASMTIME=1
  PACKAGE_RELEASE_CODEGEN=1 (use portable release-equivalent Wasmtime codegen)
  WASMTIME_LABEL=wasmtime
  NATIVE_PHP_BIN=php
  NATIVE_PHP_LABEL=native-php
  WP_PLAYGROUND_NATIVE_MAX_WASM_STACK_MIB=2
  WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB=
  WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB=
  WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_FOR_GROWTH_MIB=
  WP_PLAYGROUND_NATIVE_MEMORY_MAY_MOVE=false
  WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND=
  WP_PLAYGROUND_NATIVE_ASSET_ROOT=/path/to/runtime/asset-root
  KEEP_BENCH_ARTIFACTS=0
  BENCHMARK_PROFILE=0
  BENCHMARK_WP_STAGE_PROFILE=0
  BENCHMARK_GUARD=0
  BENCHMARK_BASELINE_RESULTS=/path/to/baseline-results.tsv
  BENCHMARK_BASELINE_LABEL=c57-baseline
  BENCHMARK_MAX_BURST_RSS_MIB=98.9
  BENCHMARK_MAX_IDLE_RSS_RATIO=1.3
  BENCHMARK_MAX_ROUTE_REGRESSION_PCT=5
  BENCHMARK_MAX_ROUTE_REGRESSION_MS=10
  BENCHMARK_LOAD_DURATION=15
  BENCHMARK_LOAD_CONCURRENCY=4
  BENCHMARK_LOAD_TIMEOUT=30
  BENCHMARK_RSS_SAMPLE_INTERVAL=0.05
  BENCHMARK_OBJECTIVE_GUARD=1
  BENCHMARK_OBJECTIVE_MAX_ROUTE_RATIO=1.40
  BENCHMARK_OBJECTIVE_MIN_RPS_RATIO=0.70
  BENCHMARK_OBJECTIVE_MAX_RSS_RATIO=1.50

Examples:
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER=300 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_WORKER_RECYCLE_IDLE_MS=2000 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB=256 WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB=16 WASMTIME_LABEL=mem-256-16 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND='realpath_cache_size=8M' WASMTIME_LABEL=php-ini-tuned bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  NATIVE_PHP_BIN=/opt/homebrew/bin/php NATIVE_PHP_LABEL=macos-php bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	usage
	exit 0
fi

cleanup() {
	local exit_status="$?"
	trap - EXIT INT TERM
	if [[ -n "$ACTIVE_RSS_SAMPLER_PID" ]]; then
		kill "$ACTIVE_RSS_SAMPLER_PID" 2>/dev/null || true
		wait "$ACTIVE_RSS_SAMPLER_PID" 2>/dev/null || true
	fi
	if [[ -n "$ACTIVE_SERVER_PID" ]]; then
		kill "$ACTIVE_SERVER_PID" 2>/dev/null || true
		wait "$ACTIVE_SERVER_PID" 2>/dev/null || true
	fi
	if [[ "$KEEP_BENCH_ARTIFACTS" != "1" ]]; then
		rm -rf "$WORK_DIR"
	fi
	exit "$exit_status"
}

require_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "error: required command not found: $1" >&2
		exit 1
	fi
}

require_cmd awk
require_cmd cargo
require_cmd curl
require_cmd grep
require_cmd perl
require_cmd python3
require_cmd "$NATIVE_PHP_BIN"
require_cmd ps
require_cmd sort

native_php_version=""
if ! native_php_version="$("$NATIVE_PHP_BIN" -r 'echo PHP_MAJOR_VERSION, ".", PHP_MINOR_VERSION;')"; then
	echo "error: could not determine the version of NATIVE_PHP_BIN=$NATIVE_PHP_BIN" >&2
	exit 1
fi
if [[ "$native_php_version" != "$PHP_VERSION" ]]; then
	echo "error: NATIVE_PHP_BIN must be PHP $PHP_VERSION; $NATIVE_PHP_BIN reports $native_php_version" >&2
	exit 1
fi

validate_label() {
	local name="$1"
	local value="$2"
	if [[ -z "$value" || "$value" == */* || "$value" == *$'\t'* || "$value" == *$'\n'* ]]; then
		echo "error: $name must be non-empty and cannot contain '/', tabs, or newlines" >&2
		exit 1
	fi
}

validate_label WASMTIME_LABEL "$WASMTIME_LABEL"
validate_label NATIVE_PHP_LABEL "$NATIVE_PHP_LABEL"
if [[ "$WASMTIME_LABEL" == "$NATIVE_PHP_LABEL" ]]; then
	echo "error: WASMTIME_LABEL and NATIVE_PHP_LABEL must be different" >&2
	exit 1
fi

validate_non_negative_number() {
	local name="$1"
	local value="$2"
	if ! awk -v value="$value" 'BEGIN { exit(value ~ /^[0-9]+([.][0-9]+)?$/ ? 0 : 1) }'; then
		echo "error: $name must be a non-negative number" >&2
		exit 1
	fi
}

validate_positive_number() {
	local name="$1"
	local value="$2"
	if ! awk -v value="$value" 'BEGIN { exit(value ~ /^[0-9]+([.][0-9]+)?$/ && value > 0 ? 0 : 1) }'; then
		echo "error: $name must be a positive number" >&2
		exit 1
	fi
}

validate_positive_integer() {
	local name="$1"
	local value="$2"
	if ! awk -v value="$value" 'BEGIN { exit(value ~ /^[1-9][0-9]*$/ ? 0 : 1) }'; then
		echo "error: $name must be a positive integer" >&2
		exit 1
	fi
}

case "$PACKAGE_PRECOMPILE_WASMTIME" in
	0 | 1) ;;
	*)
		echo "error: PACKAGE_PRECOMPILE_WASMTIME must be 0 or 1" >&2
		exit 1
		;;
esac
case "$PACKAGE_RELEASE_CODEGEN" in
	0 | 1) ;;
	*)
		echo "error: PACKAGE_RELEASE_CODEGEN must be 0 or 1" >&2
		exit 1
		;;
esac

case "$BENCHMARK_PROFILE" in
	0 | 1) ;;
	*)
		echo "error: BENCHMARK_PROFILE must be 0 or 1" >&2
		exit 1
		;;
esac

case "$BENCHMARK_WP_STAGE_PROFILE" in
	0 | 1) ;;
	*)
		echo "error: BENCHMARK_WP_STAGE_PROFILE must be 0 or 1" >&2
		exit 1
		;;
esac

case "$BENCHMARK_GUARD" in
	0 | 1) ;;
	*)
		echo "error: BENCHMARK_GUARD must be 0 or 1" >&2
		exit 1
		;;
esac

case "$BENCHMARK_OBJECTIVE_GUARD" in
	0 | 1) ;;
	*)
		echo "error: BENCHMARK_OBJECTIVE_GUARD must be 0 or 1" >&2
		exit 1
		;;
esac

validate_positive_number BENCHMARK_LOAD_DURATION "$BENCHMARK_LOAD_DURATION"
validate_positive_integer BENCHMARK_LOAD_CONCURRENCY "$BENCHMARK_LOAD_CONCURRENCY"
validate_positive_number BENCHMARK_LOAD_TIMEOUT "$BENCHMARK_LOAD_TIMEOUT"
validate_positive_number BENCHMARK_RSS_SAMPLE_INTERVAL "$BENCHMARK_RSS_SAMPLE_INTERVAL"
validate_positive_number BENCHMARK_OBJECTIVE_MAX_ROUTE_RATIO "$BENCHMARK_OBJECTIVE_MAX_ROUTE_RATIO"
validate_positive_number BENCHMARK_OBJECTIVE_MIN_RPS_RATIO "$BENCHMARK_OBJECTIVE_MIN_RPS_RATIO"
validate_positive_number BENCHMARK_OBJECTIVE_MAX_RSS_RATIO "$BENCHMARK_OBJECTIVE_MAX_RSS_RATIO"
validate_positive_integer SAMPLES "$SAMPLES"
validate_positive_integer WARMUPS "$WARMUPS"
if [[ "$BENCHMARK_OBJECTIVE_GUARD" == "1" ]]; then
	if [[ "$SAMPLES" -lt 20 ]]; then
		echo "error: SAMPLES must be at least 20 when BENCHMARK_OBJECTIVE_GUARD=1" >&2
		exit 1
	fi
	if ! awk -v value="$BENCHMARK_LOAD_DURATION" 'BEGIN { exit(value >= 10 ? 0 : 1) }'; then
		echo "error: BENCHMARK_LOAD_DURATION must be at least 10 seconds when BENCHMARK_OBJECTIVE_GUARD=1" >&2
		exit 1
	fi
fi

if [[ "$BENCHMARK_GUARD" == "1" ]]; then
	validate_label BENCHMARK_BASELINE_LABEL "$BENCHMARK_BASELINE_LABEL"
	validate_non_negative_number BENCHMARK_MAX_BURST_RSS_MIB "$BENCHMARK_MAX_BURST_RSS_MIB"
	validate_positive_number BENCHMARK_MAX_IDLE_RSS_RATIO "$BENCHMARK_MAX_IDLE_RSS_RATIO"
	validate_non_negative_number BENCHMARK_MAX_ROUTE_REGRESSION_PCT "$BENCHMARK_MAX_ROUTE_REGRESSION_PCT"
	validate_non_negative_number BENCHMARK_MAX_ROUTE_REGRESSION_MS "$BENCHMARK_MAX_ROUTE_REGRESSION_MS"
	if [[ ! -f "$BENCHMARK_BASELINE_RESULTS" ]]; then
		echo "error: BENCHMARK_BASELINE_RESULTS must point to a results TSV when BENCHMARK_GUARD=1" >&2
		exit 1
	fi
fi

if [[ -z "$WORK_DIR" ]]; then
	WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wp-native-bench.XXXXXX")"
fi
PACKAGE_DIR="${PACKAGE_DIR:-$WORK_DIR/wp-native-package-bench}"
RESULTS_FILE="$WORK_DIR/results.tsv"
PROFILE_FILE="$WORK_DIR/profile.tsv"
mkdir -p "$WORK_DIR"
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

build_package() {
	local package_parent package_name binary_path package_target_triple
	local -a package_env
	package_parent="$(dirname "$PACKAGE_DIR")"
	package_name="$(basename "$PACKAGE_DIR")"
	binary_path="$CLI_DIR/target/release/wp-playground-native"
	package_target_triple="${WP_PLAYGROUND_NATIVE_TARGET_TRIPLE:-${CARGO_BUILD_TARGET:-}}"
	if [[ -z "$package_target_triple" && "$PACKAGE_PRECOMPILE_WASMTIME" == "1" && "$PACKAGE_RELEASE_CODEGEN" == "1" ]]; then
		package_target_triple="$(rustc -vV | sed -n 's/^host: //p')"
		if [[ -z "$package_target_triple" ]]; then
			echo "error: could not determine the Rust host target for release-equivalent Wasmtime codegen" >&2
			exit 1
		fi
	fi
	package_env=()
	if [[ -n "$package_target_triple" ]]; then
		package_env+=("WP_PLAYGROUND_NATIVE_TARGET_TRIPLE=$package_target_triple")
	fi
	cargo build --manifest-path "$CLI_DIR/Cargo.toml" --release --bins
	rm -rf "$PACKAGE_DIR"
	local package_args=(
		--binary "$binary_path" \
		--out-dir "$package_parent" \
		--name "$package_name" \
		--skip-archive
	)
	if [[ -n "$PACKAGE_ASSET_ROOT" ]]; then
		package_args+=(--asset-root "$PACKAGE_ASSET_ROOT")
	fi
	if [[ "$PACKAGE_PRECOMPILE_WASMTIME" == "1" ]]; then
		package_args+=(--precompile-wasmtime)
	else
		package_args+=(--no-precompile-wasmtime)
	fi
	if [[ "$PACKAGE_PRECOMPILE_WASMTIME" == "1" ]]; then
		package_env+=("WP_PLAYGROUND_NATIVE_PACKAGE_PRECOMPILE=1")
	fi
	env "${package_env[@]}" \
		"$CLI_DIR/target/release/package-native-cli" "${package_args[@]}"
}

if [[ -n "${WP_PLAYGROUND_NATIVE_BENCH_BIN:-}" ]]; then
	NATIVE_BIN="$WP_PLAYGROUND_NATIVE_BENCH_BIN"
elif [[ "$BUILD_PACKAGE" == "1" ]]; then
	build_package
	NATIVE_BIN="$PACKAGE_DIR/bin/wp-playground-native"
	PACKAGED_BENCH_BIN=1
elif [[ -x "$PACKAGE_DIR/bin/wp-playground-native" ]]; then
	NATIVE_BIN="$PACKAGE_DIR/bin/wp-playground-native"
	PACKAGED_BENCH_BIN=1
else
	echo "error: no packaged binary found. Set WP_PLAYGROUND_NATIVE_BENCH_BIN or BUILD_PACKAGE=1." >&2
	exit 1
fi

if [[ ! -x "$NATIVE_BIN" ]]; then
	echo "error: native binary is not executable: $NATIVE_BIN" >&2
	exit 1
fi

percentile() {
	local file="$1"
	local percentile="$2"
	python3 "$SCRIPT_DIR/benchmark-wordpress-metrics.py" percentile \
		--values "$file" \
		--percentile "$percentile"
}

rss_mib() {
	local pid="$1"
	local rss_kib
	rss_kib="$(ps -o rss= -p "$pid" | tr -d ' ')"
	awk "BEGIN { printf \"%.1f\", ${rss_kib:-0} / 1024 }"
}

start_lifetime_rss_sampler() {
	local server_pid="$1"
	local label="$2"
	ACTIVE_RSS_OUTPUT="$WORK_DIR/$label-peak-tree-rss.txt"
	rm -f "$ACTIVE_RSS_OUTPUT"
	python3 "$SCRIPT_DIR/benchmark-wordpress-metrics.py" rss-sample \
		--server-pid "$server_pid" \
		--rss-sample-interval "$BENCHMARK_RSS_SAMPLE_INTERVAL" \
		--output "$ACTIVE_RSS_OUTPUT" \
		>"$WORK_DIR/$label-rss-sampler.out" \
		2>"$WORK_DIR/$label-rss-sampler.log" &
	ACTIVE_RSS_SAMPLER_PID="$!"
	for _ in $(seq 1 200); do
		if [[ -s "$ACTIVE_RSS_OUTPUT" ]]; then
			return 0
		fi
		if ! kill -0 "$ACTIVE_RSS_SAMPLER_PID" 2>/dev/null; then
			echo "error: lifetime RSS sampler exited before its first sample" >&2
			return 1
		fi
		sleep 0.01
	done
	echo "error: lifetime RSS sampler did not produce its first sample" >&2
	return 1
}

stop_lifetime_rss_sampler() {
	local sampler_pid="$ACTIVE_RSS_SAMPLER_PID"
	local output_path="$ACTIVE_RSS_OUTPUT"
	local sampler_status=0
	if [[ -z "$sampler_pid" ]]; then
		echo "error: no active lifetime RSS sampler" >&2
		return 1
	fi
	kill "$sampler_pid" 2>/dev/null || true
	wait "$sampler_pid" || sampler_status="$?"
	ACTIVE_RSS_SAMPLER_PID=""
	ACTIVE_RSS_OUTPUT=""
	if [[ "$sampler_status" != "0" ]]; then
		echo "error: lifetime RSS sampler exited with status $sampler_status" >&2
		return 1
	fi
	if [[ ! -s "$output_path" ]]; then
		echo "error: lifetime RSS sampler did not write $output_path" >&2
		return 1
	fi
	IFS= read -r LAST_PEAK_TREE_RSS_MIB <"$output_path"
	validate_positive_number peak_tree_rss_mib "$LAST_PEAK_TREE_RSS_MIB"
}

replace_load_peak_tree_rss() {
	local load_metrics="$1"
	local peak_tree_rss_mib="$2"
	awk -F '\t' -v OFS='\t' -v peak="$peak_tree_rss_mib" '
		NF != 10 { exit 2 }
		{ $6 = peak; print }
	' <<<"$load_metrics"
}

stop_active_server() {
	local server_pid="$ACTIVE_SERVER_PID"
	if [[ -z "$server_pid" ]]; then
		return 0
	fi
	kill "$server_pid" 2>/dev/null || true
	wait "$server_pid" 2>/dev/null || true
	ACTIVE_SERVER_PID=""
}

validate_editor_response() {
	local response_file="$1"
	local context="$2"
	if ! LC_ALL=C grep -Fq -- "$EDITOR_PAGE_MARKER" "$response_file"; then
		echo "error: $context did not return an authenticated WordPress post-new page" >&2
		return 1
	fi
}

wait_for_http() {
	local port="$1"
	local path="$2"
	local cookies="$3"
	local url="http://127.0.0.1:$port$path"
	for _ in $(seq 1 "$STARTUP_RETRIES"); do
		if curl --http1.0 -fsSL -m 3 -c "$cookies" -b "$cookies" "$url" >/dev/null 2>&1; then
			return 0
		fi
		sleep 0.25
	done
	echo "error: timed out waiting for $url" >&2
	return 1
}

write_http_block_mu_plugin() {
	local site="$1"
	mkdir -p "$site/wp-content/mu-plugins"
	cat >"$site/wp-content/mu-plugins/0-native-benchmark-http.php" <<'PHP'
<?php
add_filter('pre_http_request', function () {
    return new WP_Error('native_benchmark_http_blocked', 'HTTP disabled for benchmark');
}, 10, 3);

add_action('admin_init', function () {
    remove_action('admin_init', '_maybe_update_core');
    remove_action('admin_init', '_maybe_update_plugins');
    remove_action('admin_init', '_maybe_update_themes');
}, PHP_INT_MIN);
PHP
}

write_native_login_mu_plugin() {
	local site="$1"
	mkdir -p "$site/wp-content/mu-plugins"
	cat >"$site/wp-content/mu-plugins/1-native-benchmark-login.php" <<'PHP'
<?php
add_action('init', function () {
    if (is_user_logged_in()) {
        return;
    }
    $user = get_user_by('login', 'admin');
    if ($user) {
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID);
    }
}, 0);
PHP
}

write_wp_stage_profile_mu_plugin() {
	local site="$1"
	local label="$2"
	local mu_plugins_dir="$site/wp-content/mu-plugins"
	mkdir -p "$mu_plugins_dir"
	printf "%s\n" "$label" >"$mu_plugins_dir/2-native-benchmark-stage-profile.case"
	cat >"$mu_plugins_dir/2-native-benchmark-stage-profile.php" <<'PHP'
<?php
$GLOBALS['native_benchmark_stage_profile_start'] = isset($_SERVER['REQUEST_TIME_FLOAT'])
    ? (float) $_SERVER['REQUEST_TIME_FLOAT']
    : microtime(true);

native_benchmark_stage_profile_hook('muplugins_loaded');
native_benchmark_stage_profile_hook('plugins_loaded');
native_benchmark_stage_profile_hook('init');
native_benchmark_stage_profile_hook('admin_init');
native_benchmark_stage_profile_hook('enqueue_block_editor_assets');
native_benchmark_stage_profile_hook('admin_footer');
native_benchmark_stage_profile_hook('shutdown');
add_action('current_screen', static function ($screen) {
    $screen_id = isset($screen->id) ? (string) $screen->id : 'unknown';
    native_benchmark_stage_profile_emit_stage('current_screen:' . $screen_id);
}, PHP_INT_MAX);

function native_benchmark_stage_profile_hook($hook)
{
    add_action($hook, static function () use ($hook) {
        native_benchmark_stage_profile_emit_stage($hook);
    }, PHP_INT_MAX);
}

function native_benchmark_stage_profile_emit_stage($stage)
{
    $start = isset($GLOBALS['native_benchmark_stage_profile_start'])
        ? (float) $GLOBALS['native_benchmark_stage_profile_start']
        : microtime(true);
    $query_metrics = native_benchmark_stage_profile_query_metrics();
    $line = sprintf(
        'wp-stage-profile	case=%s	method=%s	uri=%s	stage=%s	elapsed_ms=%.3f	memory_bytes=%d	peak_memory_bytes=%d	query_count=%s	query_time_ms=%s',
        native_benchmark_stage_profile_value(native_benchmark_stage_profile_case()),
        native_benchmark_stage_profile_value($_SERVER['REQUEST_METHOD'] ?? ''),
        native_benchmark_stage_profile_value($_SERVER['REQUEST_URI'] ?? ''),
        native_benchmark_stage_profile_value($stage),
        (microtime(true) - $start) * 1000,
        memory_get_usage(),
        memory_get_peak_usage(),
        native_benchmark_stage_profile_value($query_metrics['count']),
        native_benchmark_stage_profile_value($query_metrics['elapsed_ms'])
    );
    native_benchmark_stage_profile_emit_line($line);
}

function native_benchmark_stage_profile_case()
{
    static $case = null;
    if ($case !== null) {
        return $case;
    }
    $case = 'unknown';
    $case_file = __DIR__ . '/2-native-benchmark-stage-profile.case';
    if (is_readable($case_file)) {
        $file_case = trim((string) file_get_contents($case_file));
        if ($file_case !== '') {
            $case = $file_case;
        }
    }
    return $case;
}

function native_benchmark_stage_profile_query_metrics()
{
    global $wpdb;
    $metrics = array(
        'count' => 'na',
        'elapsed_ms' => 'na',
    );
    if (!isset($wpdb) || !is_object($wpdb)) {
        return $metrics;
    }
    if (isset($wpdb->num_queries)) {
        $metrics['count'] = (string) (int) $wpdb->num_queries;
    }
    if (!isset($wpdb->queries) || !is_array($wpdb->queries)) {
        return $metrics;
    }
    $query_time = 0.0;
    foreach ($wpdb->queries as $query) {
        if (isset($query[1]) && is_numeric($query[1])) {
            $query_time += (float) $query[1];
        }
    }
    $metrics['elapsed_ms'] = sprintf('%.3f', $query_time * 1000);
    return $metrics;
}

function native_benchmark_stage_profile_value($value)
{
    return str_replace(array("\t", "\r", "\n"), ' ', (string) $value);
}

function native_benchmark_stage_profile_emit_line($line)
{
    $profile_stream = native_benchmark_stage_profile_file_stream();
    if (is_resource($profile_stream)) {
        @fwrite($profile_stream, $line . PHP_EOL);
    }

    static $stream = null;
    if ($stream === null) {
        $stream = @fopen('php://stderr', 'ab');
    }
    if (is_resource($stream)) {
        @fwrite($stream, $line . PHP_EOL);
        return;
    }
    error_log($line);
}

function native_benchmark_stage_profile_file_stream()
{
    static $stream = null;
    if ($stream === null) {
        $stream = @fopen(dirname(__DIR__) . '/native-benchmark-stage-profile.log', 'ab');
    }
    return $stream;
}
PHP
}

copy_site() {
	local source="$1"
	local target="$2"
	mkdir -p "$target"
	cp -R "$source"/. "$target"/
}

patch_wp_config_url() {
	local site="$1"
	local port="$2"
	local config="$site/wp-config.php"
	local tmp_config="$site/wp-config.php.bench"
	{
		printf "<?php\n"
		printf "define( 'WP_HOME', 'http://127.0.0.1:%s' );\n" "$port"
		printf "define( 'WP_SITEURL', 'http://127.0.0.1:%s' );\n" "$port"
		tail -n +2 "$config"
	} >"$tmp_config"
	mv "$tmp_config" "$config"
}

bootstrap_wordpress_site() {
	local site="$1"
	local port="$2"
	local log="$WORK_DIR/bootstrap-$port.log"
	local out="$WORK_DIR/bootstrap-$port.out"
	local cookies="$WORK_DIR/bootstrap-$port.cookies"
	local server_args=(
		server
		--mount-before-install="$site:/wordpress"
		--login
		--php="$PHP_VERSION"
		--wp="$WP_VERSION"
		--port="$port"
		--workers=1
	)
	"$NATIVE_BIN" "${server_args[@]}" \
		>"$out" 2>"$log" &
	local pid="$!"
	ACTIVE_SERVER_PID="$pid"
	if ! wait_for_http "$port" "/" "$cookies"; then
		stop_active_server
		return 1
	fi
	stop_active_server
}

record_profiled_route_sample() {
	local label="$1"
	local route_name="$2"
	local sample="$3"
	local port="$4"
	local route_path="$5"
	local cookies="$6"
	local times="$7"
	local curl_write_out metrics http_code time_starttransfer time_total size_download
	local time_starttransfer_ms time_total_ms size_download_bytes
	local output_file="/dev/null"
	if [[ "$route_name" == "editor" ]]; then
		output_file="$WORK_DIR/$label-editor-response.html"
	fi

	curl_write_out=$'%{http_code}\t%{time_starttransfer}\t%{time_total}\t%{size_download}'
	if ! metrics="$(curl --http1.0 -fsSL -m 30 -w "$curl_write_out" -o "$output_file" -c "$cookies" -b "$cookies" "http://127.0.0.1:$port$route_path")"; then
		return 1
	fi
	if [[ "$route_name" == "editor" ]]; then
		validate_editor_response "$output_file" "$label editor sample $sample" || return 1
	fi
	IFS=$'\t' read -r http_code time_starttransfer time_total size_download <<<"$metrics"
	time_starttransfer_ms="$(awk "BEGIN { printf \"%.3f\", $time_starttransfer * 1000 }")"
	time_total_ms="$(awk "BEGIN { printf \"%.3f\", $time_total * 1000 }")"
	size_download_bytes="$(awk "BEGIN { printf \"%.0f\", $size_download }")"
	printf "%s\n" "$time_total_ms" >>"$times"
	printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
		"$label" "$route_name" "$sample" "$http_code" \
		"$time_starttransfer_ms" "$time_total_ms" "$size_download_bytes" \
		>>"$PROFILE_FILE"
}

benchmark_routes() {
	local label="$1"
	local port="$2"
	local cookies="$3"
	local prefix="$WORK_DIR/$label"
	local home_p50 home_p95 search_p50 search_p95 post_p50 post_p95 editor_p50 editor_p95
	local route_name route_path times sample timing output_file

	for route_name in home search post editor; do
		case "$route_name" in
			home) route_path="/" ;;
			search) route_path="/?s=hello" ;;
			post) route_path="/?p=1" ;;
			editor) route_path="/wp-admin/post-new.php" ;;
		esac
		output_file="/dev/null"
		if [[ "$route_name" == "editor" ]]; then
			output_file="$prefix-editor-response.html"
		fi
		for _ in $(seq 1 "$WARMUPS"); do
			curl --http1.0 -fsSL -m 30 -o "$output_file" -c "$cookies" -b "$cookies" "http://127.0.0.1:$port$route_path" || return 1
			if [[ "$route_name" == "editor" ]]; then
				validate_editor_response "$output_file" "$label editor warmup" || return 1
			fi
		done
		times="$prefix-$route_name.times"
		: >"$times"
		for sample in $(seq 1 "$SAMPLES"); do
			if [[ "$BENCHMARK_PROFILE" == "1" ]]; then
				record_profiled_route_sample "$label" "$route_name" "$sample" "$port" "$route_path" "$cookies" "$times" || return 1
			else
				if ! timing="$(curl --http1.0 -fsSL -m 30 -w '%{time_total}' -o "$output_file" -c "$cookies" -b "$cookies" "http://127.0.0.1:$port$route_path")"; then
					return 1
				fi
				if [[ "$route_name" == "editor" ]]; then
					validate_editor_response "$output_file" "$label editor sample $sample" || return 1
				fi
				awk "BEGIN { printf \"%.3f\n\", $timing * 1000 }" >>"$times"
			fi
		done
		case "$route_name" in
			home)
				home_p50="$(percentile "$times" 0.50)" || return 1
				home_p95="$(percentile "$times" 0.95)" || return 1
				;;
			search)
				search_p50="$(percentile "$times" 0.50)" || return 1
				search_p95="$(percentile "$times" 0.95)" || return 1
				;;
			post)
				post_p50="$(percentile "$times" 0.50)" || return 1
				post_p95="$(percentile "$times" 0.95)" || return 1
				;;
			editor)
				editor_p50="$(percentile "$times" 0.50)" || return 1
				editor_p95="$(percentile "$times" 0.95)" || return 1
				;;
		esac
	done

	printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
		"$home_p50" "$home_p95" \
		"$search_p50" "$search_p95" \
		"$post_p50" "$post_p95" \
		"$editor_p50" "$editor_p95"
}

benchmark_sustained_load() {
	local port="$1"
	local cookies="$2"
	local server_pid="$3"
	python3 "$SCRIPT_DIR/benchmark-wordpress-metrics.py" load \
		--base-url "http://127.0.0.1:$port" \
		--cookie-file "$cookies" \
		--server-pid "$server_pid" \
		--duration "$BENCHMARK_LOAD_DURATION" \
		--concurrency "$BENCHMARK_LOAD_CONCURRENCY" \
		--timeout "$BENCHMARK_LOAD_TIMEOUT" \
		--rss-sample-interval "$BENCHMARK_RSS_SAMPLE_INTERVAL" \
		--lifetime-rss-file "$ACTIVE_RSS_OUTPUT"
}

run_wasmtime_case() {
	local site="$1"
	local port="$2"
	local label="$WASMTIME_LABEL"
	local cookies="$WORK_DIR/$label.cookies"
	local log="$WORK_DIR/$label.log"
	local out="$WORK_DIR/$label.out"
	local stats load_metrics burst_rss idle_rss
	local server_env=()
	local server_args=(
		server
		--mount-before-install="$site:/wordpress"
		--wordpress-install-mode=install-from-existing-files-if-needed
		--login
		--php="$PHP_VERSION"
		--wp="$WP_VERSION"
		--port="$port"
		--workers=1
	)
	if [[ "$PACKAGED_BENCH_BIN" == "1" && -z "${WP_PLAYGROUND_NATIVE_ASSET_ROOT:-}" && -z "${WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK+x}" ]]; then
		server_env+=("WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK=1")
	fi

	env "${server_env[@]}" "$NATIVE_BIN" "${server_args[@]}" \
		>"$out" 2>"$log" &
	local pid="$!"
	ACTIVE_SERVER_PID="$pid"
	start_lifetime_rss_sampler "$pid" "$label"
	wait_for_http "$port" "/" "$cookies"
	stats="$(benchmark_routes "$label" "$port" "$cookies")"
	load_metrics="$(benchmark_sustained_load "$port" "$cookies" "$pid")"
	burst_rss="$(rss_mib "$pid")"
	sleep "$IDLE_SLEEP"
	idle_rss="$(rss_mib "$pid")"
	stop_lifetime_rss_sampler
	load_metrics="$(replace_load_peak_tree_rss "$load_metrics" "$LAST_PEAK_TREE_RSS_MIB")"
	stop_active_server
	printf "%s\t%s\t%s\t%s\t%s\n" "$label" "$burst_rss" "$idle_rss" "$stats" "$load_metrics" >>"$RESULTS_FILE"
}

run_native_php_case() {
	local site="$1"
	local port="$2"
	local label="$NATIVE_PHP_LABEL"
	local cookies="$WORK_DIR/$label.cookies"
	local log="$WORK_DIR/$label.log"
	local out="$WORK_DIR/$label.out"
	local stats load_metrics burst_rss idle_rss

	"$NATIVE_PHP_BIN" \
		-d opcache.enable=1 \
		-d opcache.enable_cli=1 \
		-d opcache.validate_timestamps=0 \
		-d opcache.memory_consumption=18 \
		-d opcache.interned_strings_buffer=3 \
		-S "127.0.0.1:$port" \
		-t "$site" \
		>"$out" 2>"$log" &
	local pid="$!"
	ACTIVE_SERVER_PID="$pid"
	start_lifetime_rss_sampler "$pid" "$label"
	wait_for_http "$port" "/" "$cookies"
	stats="$(benchmark_routes "$label" "$port" "$cookies")"
	load_metrics="$(benchmark_sustained_load "$port" "$cookies" "$pid")"
	burst_rss="$(rss_mib "$pid")"
	sleep "$IDLE_SLEEP"
	idle_rss="$(rss_mib "$pid")"
	stop_lifetime_rss_sampler
	load_metrics="$(replace_load_peak_tree_rss "$load_metrics" "$LAST_PEAK_TREE_RSS_MIB")"
	stop_active_server
	printf "%s\t%s\t%s\t%s\t%s\n" "$label" "$burst_rss" "$idle_rss" "$stats" "$load_metrics" >>"$RESULTS_FILE"
}

printf "case\tburst_rss_mib\tidle_rss_mib\thome_p50_ms\thome_p95_ms\tsearch_p50_ms\tsearch_p95_ms\tpost_p50_ms\tpost_p95_ms\teditor_p50_ms\teditor_p95_ms\tload_duration_s\tload_requests\tload_successes\tload_errors\tsuccessful_rps\tpeak_tree_rss_mib\tload_home_requests\tload_search_requests\tload_post_requests\tload_editor_requests\n" >"$RESULTS_FILE"
if [[ "$BENCHMARK_PROFILE" == "1" ]]; then
	printf "case\troute\tsample\thttp_code\ttime_starttransfer_ms\ttime_total_ms\tsize_download_bytes\n" >"$PROFILE_FILE"
fi

SOURCE_SITE="$WORK_DIR/source-site"
WASM_SITE="$WORK_DIR/wasm-site"
NATIVE_SITE="$WORK_DIR/native-site"
mkdir -p "$SOURCE_SITE" "$WASM_SITE" "$NATIVE_SITE"

bootstrap_wordpress_site "$SOURCE_SITE" "$BASE_PORT"
write_http_block_mu_plugin "$SOURCE_SITE"
copy_site "$SOURCE_SITE" "$WASM_SITE"
copy_site "$SOURCE_SITE" "$NATIVE_SITE"
if [[ "$BENCHMARK_WP_STAGE_PROFILE" == "1" ]]; then
	write_wp_stage_profile_mu_plugin "$WASM_SITE" "$WASMTIME_LABEL"
	write_wp_stage_profile_mu_plugin "$NATIVE_SITE" "$NATIVE_PHP_LABEL"
fi
write_native_login_mu_plugin "$NATIVE_SITE"
patch_wp_config_url "$NATIVE_SITE" "$((BASE_PORT + 2))"

run_wasmtime_case "$WASM_SITE" "$((BASE_PORT + 1))"
run_native_php_case "$NATIVE_SITE" "$((BASE_PORT + 2))"

cat "$RESULTS_FILE"
awk -F '\t' -v wasm_label="$WASMTIME_LABEL" -v native_label="$NATIVE_PHP_LABEL" '
	NR == 1 { next }
	$1 == native_label {
		for (i = 2; i <= NF; i++) native[i] = $i
	}
	$1 == wasm_label {
		for (i = 2; i <= NF; i++) wasm[i] = $i
	}
	END {
		if (!native[2] || !wasm[2]) exit
		print ""
		print "ratios_vs_native"
		labels[2] = "burst_rss"
		labels[3] = "idle_rss"
		labels[4] = "home_p50"
		labels[5] = "home_p95"
		labels[6] = "search_p50"
		labels[7] = "search_p95"
		labels[8] = "post_p50"
		labels[9] = "post_p95"
		labels[10] = "editor_p50"
		labels[11] = "editor_p95"
		for (i = 2; i <= 11; i++) {
			if (native[i] == "" || native[i] == 0 || wasm[i] == "") {
				printf "%s\tn/a\n", labels[i]
			} else {
				printf "%s\t%.2fx\n", labels[i], wasm[i] / native[i]
			}
		}
	}
' "$RESULTS_FILE"

if [[ "$BENCHMARK_OBJECTIVE_GUARD" == "1" ]]; then
	python3 "$SCRIPT_DIR/benchmark-wordpress-metrics.py" gate \
		--results "$RESULTS_FILE" \
		--candidate-label "$WASMTIME_LABEL" \
		--native-label "$NATIVE_PHP_LABEL" \
		--max-route-ratio "$BENCHMARK_OBJECTIVE_MAX_ROUTE_RATIO" \
		--min-rps-ratio "$BENCHMARK_OBJECTIVE_MIN_RPS_RATIO" \
		--max-rss-ratio "$BENCHMARK_OBJECTIVE_MAX_RSS_RATIO"
fi

if [[ "$BENCHMARK_GUARD" == "1" ]]; then
	awk \
		-v wasm_label="$WASMTIME_LABEL" \
		-v native_label="$NATIVE_PHP_LABEL" \
		-v baseline_file="$BENCHMARK_BASELINE_RESULTS" \
		-v baseline_label="$BENCHMARK_BASELINE_LABEL" \
		-v max_burst_rss_mib="$BENCHMARK_MAX_BURST_RSS_MIB" \
		-v max_idle_rss_ratio="$BENCHMARK_MAX_IDLE_RSS_RATIO" \
		-v max_route_regression_pct="$BENCHMARK_MAX_ROUTE_REGRESSION_PCT" \
		-v max_route_regression_ms="$BENCHMARK_MAX_ROUTE_REGRESSION_MS" \
		-f "$SCRIPT_DIR/benchmark-wordpress-gate.awk" \
		"$BENCHMARK_BASELINE_RESULTS" "$RESULTS_FILE"
fi

if [[ "$KEEP_BENCH_ARTIFACTS" == "1" ]]; then
	echo ""
	echo "bench_artifacts=$WORK_DIR"
fi
