#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CLI_DIR="$REPO_ROOT/packages/playground/cli-native"

PHP_VERSION="${PHP_VERSION:-8.3}"
WP_VERSION="${WP_VERSION:-6.9}"
SAMPLES="${SAMPLES:-8}"
WARMUPS="${WARMUPS:-2}"
IDLE_SLEEP="${IDLE_SLEEP:-1.2}"
STARTUP_RETRIES="${STARTUP_RETRIES:-240}"
BASE_PORT="${BASE_PORT:-9690}"
BUILD_PACKAGE="${BUILD_PACKAGE:-1}"
KEEP_BENCH_ARTIFACTS="${KEEP_BENCH_ARTIFACTS:-0}"
BENCHMARK_PROFILE="${BENCHMARK_PROFILE:-0}"
BENCHMARK_WP_STAGE_PROFILE="${BENCHMARK_WP_STAGE_PROFILE:-0}"
PACKAGE_ASSET_ROOT="${PACKAGE_ASSET_ROOT:-}"
PACKAGE_PRECOMPILE_WASMTIME="${PACKAGE_PRECOMPILE_WASMTIME:-1}"
WASMTIME_LABEL="${WASMTIME_LABEL:-wasmtime}"
WASMTIME_OPCACHE="${WASMTIME_OPCACHE:-middle}"
BOOTSTRAP_OPCACHE="${BOOTSTRAP_OPCACHE:-$WASMTIME_OPCACHE}"
NATIVE_PHP_BIN="${NATIVE_PHP_BIN:-php}"
NATIVE_PHP_LABEL="${NATIVE_PHP_LABEL:-native-php}"
WORK_DIR="${WORK_DIR:-}"
PACKAGE_DIR="${PACKAGE_DIR:-}"
PACKAGED_BENCH_BIN=0

usage() {
	cat <<'USAGE'
Benchmark wp-playground-native WordPress server behavior against system PHP.

Defaults build a temporary packaged native CLI with precompiled Wasmtime assets,
bootstrap comparable WordPress sites, then measure these routes:
  /, /?s=hello, /?p=1, /wp-admin/post-new.php

Environment:
  PHP_VERSION=8.3
  WP_VERSION=6.9
  SAMPLES=8
  WARMUPS=2
  IDLE_SLEEP=1.2
  BASE_PORT=9690
  BUILD_PACKAGE=1
  WP_PLAYGROUND_NATIVE_BENCH_BIN=/path/to/bin/wp-playground-native
  PACKAGE_DIR=/tmp/wp-native-package-bench
  PACKAGE_ASSET_ROOT=/path/to/rebuilt/asset-root
  PACKAGE_PRECOMPILE_WASMTIME=1
  WASMTIME_LABEL=wasmtime
  WASMTIME_OPCACHE=middle
  BOOTSTRAP_OPCACHE=middle
  NATIVE_PHP_BIN=php
  NATIVE_PHP_LABEL=native-php
  WP_PLAYGROUND_NATIVE_MAX_WASM_STACK_MIB=2
  WP_PLAYGROUND_NATIVE_ASYNC_STACK_MIB=4
  WP_PLAYGROUND_NATIVE_RECYCLE_WASM_MEMORY_MIB=90
  WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB=
  WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB=
  WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_FOR_GROWTH_MIB=
  WP_PLAYGROUND_NATIVE_MEMORY_MAY_MOVE=false
  WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND=
  WP_PLAYGROUND_NATIVE_ASSET_ROOT=/path/to/runtime/asset-root
  KEEP_BENCH_ARTIFACTS=0
  BENCHMARK_PROFILE=0
  BENCHMARK_WP_STAGE_PROFILE=0

Examples:
  bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER=400 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_WORKER_RECYCLE_IDLE_MS=2000 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WASMTIME_OPCACHE=low-memory WASMTIME_LABEL=low-opcache bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  PACKAGE_ASSET_ROOT=/tmp/php-wasm-emmalloc WASMTIME_LABEL=emmalloc bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_MAX_WASM_STACK_MIB=8 WP_PLAYGROUND_NATIVE_ASYNC_STACK_MIB=16 WASMTIME_LABEL=stack-8-16 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB=256 WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB=16 WASMTIME_LABEL=mem-256-16 bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND=$'realpath_cache_size=512K\noutput_buffering=4096' WASMTIME_LABEL=php-ini-tuned bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
  NATIVE_PHP_BIN=/opt/homebrew/bin/php NATIVE_PHP_LABEL=macos-php bash packages/playground/cli-native/scripts/benchmark-wordpress.sh
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	usage
	exit 0
fi

if [[ -z "$WORK_DIR" ]]; then
	WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wp-native-bench.XXXXXX")"
fi
PACKAGE_DIR="${PACKAGE_DIR:-$WORK_DIR/wp-native-package-bench}"
RESULTS_FILE="$WORK_DIR/results.tsv"
PROFILE_FILE="$WORK_DIR/profile.tsv"
mkdir -p "$WORK_DIR"

cleanup() {
	if [[ "$KEEP_BENCH_ARTIFACTS" != "1" ]]; then
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

require_cmd awk
require_cmd cargo
require_cmd curl
require_cmd perl
require_cmd "$NATIVE_PHP_BIN"
require_cmd ps
require_cmd sort

validate_opcache_mode() {
	local name="$1"
	local value="$2"
	case "$value" in
		validate | revalidate | immutable | middle | low-memory | off) ;;
		*)
			echo "error: $name must be validate, revalidate, immutable, middle, low-memory, or off" >&2
			exit 1
			;;
	esac
}

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
validate_opcache_mode WASMTIME_OPCACHE "$WASMTIME_OPCACHE"
validate_opcache_mode BOOTSTRAP_OPCACHE "$BOOTSTRAP_OPCACHE"
if [[ "$WASMTIME_LABEL" == "$NATIVE_PHP_LABEL" ]]; then
	echo "error: WASMTIME_LABEL and NATIVE_PHP_LABEL must be different" >&2
	exit 1
fi

case "$PACKAGE_PRECOMPILE_WASMTIME" in
	0 | 1) ;;
	*)
		echo "error: PACKAGE_PRECOMPILE_WASMTIME must be 0 or 1" >&2
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

build_package() {
	local package_parent package_name binary_path
	package_parent="$(dirname "$PACKAGE_DIR")"
	package_name="$(basename "$PACKAGE_DIR")"
	binary_path="$CLI_DIR/target/release/wp-playground-native"
	cargo build --manifest-path "$CLI_DIR/Cargo.toml" --release --bins
	rm -rf "$PACKAGE_DIR"
	local package_args=(
		--binary "$binary_path" \
		--php-version="$PHP_VERSION" \
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
	sort -n "$file" | awk -v p="$percentile" '
		{ values[NR] = $1 }
		END {
			if (NR == 0) {
				print "0.000";
				exit;
			}
			idx = int((NR - 1) * p + 1);
			printf "%.3f\n", values[idx];
		}
	'
}

rss_mib() {
	local pid="$1"
	local rss_kib
	rss_kib="$(ps -o rss= -p "$pid" | tr -d ' ')"
	awk "BEGIN { printf \"%.1f\", ${rss_kib:-0} / 1024 }"
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
	"$NATIVE_BIN" server \
		--mount-before-install="$site:/wordpress" \
		--login \
		--php="$PHP_VERSION" \
		--wp="$WP_VERSION" \
		--port="$port" \
		--workers=1 \
		--opcache="$BOOTSTRAP_OPCACHE" \
		>"$out" 2>"$log" &
	local pid="$!"
	if ! wait_for_http "$port" "/" "$cookies"; then
		kill "$pid" 2>/dev/null || true
		wait "$pid" 2>/dev/null || true
		return 1
	fi
	kill "$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true
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

	curl_write_out=$'%{http_code}\t%{time_starttransfer}\t%{time_total}\t%{size_download}'
	metrics="$(curl --http1.0 -fsSL -m 30 -w "$curl_write_out" -o /dev/null -c "$cookies" -b "$cookies" "http://127.0.0.1:$port$route_path")"
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
	local route_name route_path times sample timing

	for route_name in home search post editor; do
		case "$route_name" in
			home) route_path="/" ;;
			search) route_path="/?s=hello" ;;
			post) route_path="/?p=1" ;;
			editor) route_path="/wp-admin/post-new.php" ;;
		esac
		for _ in $(seq 1 "$WARMUPS"); do
			curl --http1.0 -fsSL -m 30 -c "$cookies" -b "$cookies" "http://127.0.0.1:$port$route_path" >/dev/null
		done
		times="$prefix-$route_name.times"
		: >"$times"
		for sample in $(seq 1 "$SAMPLES"); do
			if [[ "$BENCHMARK_PROFILE" == "1" ]]; then
				record_profiled_route_sample "$label" "$route_name" "$sample" "$port" "$route_path" "$cookies" "$times"
			else
				timing="$(curl --http1.0 -fsSL -m 30 -w '%{time_total}' -o /dev/null -c "$cookies" -b "$cookies" "http://127.0.0.1:$port$route_path")"
				awk "BEGIN { printf \"%.3f\n\", $timing * 1000 }" >>"$times"
			fi
		done
		case "$route_name" in
			home)
				home_p50="$(percentile "$times" 0.50)"
				home_p95="$(percentile "$times" 0.95)"
				;;
			search)
				search_p50="$(percentile "$times" 0.50)"
				search_p95="$(percentile "$times" 0.95)"
				;;
			post)
				post_p50="$(percentile "$times" 0.50)"
				post_p95="$(percentile "$times" 0.95)"
				;;
			editor)
				editor_p50="$(percentile "$times" 0.50)"
				editor_p95="$(percentile "$times" 0.95)"
				;;
		esac
	done

	printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
		"$home_p50" "$home_p95" \
		"$search_p50" "$search_p95" \
		"$post_p50" "$post_p95" \
		"$editor_p50" "$editor_p95"
}

run_wasmtime_case() {
	local site="$1"
	local port="$2"
	local label="$WASMTIME_LABEL"
	local cookies="$WORK_DIR/$label.cookies"
	local log="$WORK_DIR/$label.log"
	local out="$WORK_DIR/$label.out"
	local stats burst_rss idle_rss
	local server_env=("WP_PLAYGROUND_NATIVE_MEMORY_STATS=${WP_PLAYGROUND_NATIVE_MEMORY_STATS:-0}")

	if [[ "$PACKAGED_BENCH_BIN" == "1" && -z "${WP_PLAYGROUND_NATIVE_ASSET_ROOT:-}" && -z "${WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK+x}" ]]; then
		server_env+=("WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK=1")
	fi

	env "${server_env[@]}" "$NATIVE_BIN" server \
		--mount-before-install="$site:/wordpress" \
		--wordpress-install-mode=install-from-existing-files-if-needed \
		--login \
		--php="$PHP_VERSION" \
		--wp="$WP_VERSION" \
		--port="$port" \
		--workers=1 \
		--opcache="$WASMTIME_OPCACHE" \
		>"$out" 2>"$log" &
	local pid="$!"
	wait_for_http "$port" "/" "$cookies"
	stats="$(benchmark_routes "$label" "$port" "$cookies")"
	burst_rss="$(rss_mib "$pid")"
	sleep "$IDLE_SLEEP"
	idle_rss="$(rss_mib "$pid")"
	kill "$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true
	printf "%s\t%s\t%s\t%s\n" "$label" "$burst_rss" "$idle_rss" "$stats" >>"$RESULTS_FILE"
}

run_native_php_case() {
	local site="$1"
	local port="$2"
	local label="$NATIVE_PHP_LABEL"
	local cookies="$WORK_DIR/$label.cookies"
	local log="$WORK_DIR/$label.log"
	local out="$WORK_DIR/$label.out"
	local stats burst_rss idle_rss

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
	wait_for_http "$port" "/" "$cookies"
	stats="$(benchmark_routes "$label" "$port" "$cookies")"
	burst_rss="$(rss_mib "$pid")"
	sleep "$IDLE_SLEEP"
	idle_rss="$(rss_mib "$pid")"
	kill "$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true
	printf "%s\t%s\t%s\t%s\n" "$label" "$burst_rss" "$idle_rss" "$stats" >>"$RESULTS_FILE"
}

printf "case\tburst_rss_mib\tidle_rss_mib\thome_p50_ms\thome_p95_ms\tsearch_p50_ms\tsearch_p95_ms\tpost_p50_ms\tpost_p95_ms\teditor_p50_ms\teditor_p95_ms\n" >"$RESULTS_FILE"
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

if [[ "$KEEP_BENCH_ARTIFACTS" == "1" ]]; then
	echo ""
	echo "bench_artifacts=$WORK_DIR"
fi
