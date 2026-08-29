#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY=""
REVISION=""
OUTPUT=""

while [[ $# -gt 0 ]]; do
	case "$1" in
		--repository)
			REPOSITORY="$2"
			shift 2
			;;
		--revision)
			REVISION="$2"
			shift 2
			;;
		--output)
			OUTPUT="$2"
			shift 2
			;;
		*)
			echo "error: unknown argument: $1" >&2
			exit 2
			;;
	esac
done

if [[ -z "$REPOSITORY" || -z "$REVISION" || -z "$OUTPUT" ]]; then
	echo "error: --repository, --revision, and --output are required" >&2
	exit 2
fi
if [[ "$(uname -s)" != "Linux" ]]; then
	echo "error: full benchmark collection requires Linux" >&2
	exit 2
fi

for command in bash cargo curl git id node python3 realpath sudo systemctl systemd-run taskset; do
	if ! command -v "$command" >/dev/null; then
		echo "error: required benchmark command is unavailable: $command" >&2
		exit 2
	fi
done
BASH_BIN="$(command -v bash)"
TASKSET_BIN="$(command -v taskset)"
SERVICE_USER="$(id -un)"
SERVICE_GROUP="$(id -gn)"
if [[ ! -f /sys/fs/cgroup/cgroup.controllers ]]; then
	echo "error: full benchmark collection requires cgroup v2" >&2
	exit 2
fi
if ! sudo -n true >/dev/null 2>&1; then
	echo "error: full benchmark collection requires passwordless sudo for transient cgroups" >&2
	exit 2
fi

REPOSITORY="$(cd "$REPOSITORY" && pwd)"
OUTPUT="$(realpath -m "$OUTPUT")"
ARTIFACT_ROOT="${OUTPUT%.json}-artifacts"
RAW="$ARTIFACT_ROOT/raw"
LOGS="$ARTIFACT_ROOT/logs"
WORK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/wp-native-regression-collect.XXXXXX")"
TARGET_DIR="$WORK_ROOT/target"
SITE="$WORK_ROOT/site"
PORT="${WP_PLAYGROUND_NATIVE_BENCHMARK_PORT:-$((20000 + $$ % 10000))}"
BASE_URL="http://127.0.0.1:$PORT"
POST_PATH='/?p=1'
SERVER_CPUS="${WP_PLAYGROUND_NATIVE_BENCHMARK_SERVER_CPUS:-0-5}"
CLIENT_CPUS="${WP_PLAYGROUND_NATIVE_BENCHMARK_CLIENT_CPUS:-6-11}"
WORDPRESS_VERSION="${WP_PLAYGROUND_NATIVE_BENCHMARK_WORDPRESS_VERSION:-6.9.4}"
HOST_ARCHITECTURE="$(uname -m)"
HOST_KERNEL_RELEASE="$(uname -r)"
HOST_LOGICAL_CPU_COUNT="$(python3 -c 'import os; print(os.cpu_count() or 0)')"
HOST_CPU_MODEL="$(
	awk -F: '/^(model name|Hardware)[[:space:]]*:/ {
		value=$2
		sub(/^[[:space:]]+/, "", value)
		print value
		exit
	}' /proc/cpuinfo
)"
if [[ -z "$HOST_CPU_MODEL" ]]; then
	HOST_CPU_MODEL="$HOST_ARCHITECTURE"
fi
LABEL=wasmtime
CURRENT_UNIT=""
CGROUP=""
SAMPLER_PID=""
BOOTSTRAP_PID=""

rm -f -- "$OUTPUT"
rm -rf -- "$ARTIFACT_ROOT"
mkdir -p "$RAW/throughput" "$RAW/cpu" "$RAW/cpu-reports" \
	"$RAW/memory/$LABEL" "$LOGS" "$SITE" "$WORK_ROOT/home"
if ! python3 - "$SERVER_CPUS" "$CLIENT_CPUS" <<'PY'
import re
import sys


def parse(value):
    if re.fullmatch(r"\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*", value) is None:
        raise ValueError
    ranges = []
    previous_end = -1
    count = 0
    for part in value.split(","):
        bounds = [int(item) for item in part.split("-")]
        start, end = (bounds[0], bounds[0]) if len(bounds) == 1 else bounds
        if start > end or start <= previous_end:
            raise ValueError
        ranges.append((start, end))
        previous_end = end
        count += end - start + 1
    if count != 6:
        raise ValueError
    return ranges


try:
    server = parse(sys.argv[1])
    client = parse(sys.argv[2])
except ValueError:
    raise SystemExit(1)
if any(
    server_start <= client_end and client_start <= server_end
    for server_start, server_end in server
    for client_start, client_end in client
):
    raise SystemExit(1)
PY
then
	echo "error: benchmark CPU sets must contain six ordered, non-overlapping CPUs each" >&2
	exit 2
fi
if ! taskset -c "$SERVER_CPUS" true || ! taskset -c "$CLIENT_CPUS" true; then
	echo "error: benchmark CPU sets are unavailable: server=$SERVER_CPUS client=$CLIENT_CPUS" >&2
	exit 2
fi

cleanup() {
	if [[ -n "$SAMPLER_PID" ]]; then
		kill -TERM "$SAMPLER_PID" 2>/dev/null || true
		wait "$SAMPLER_PID" 2>/dev/null || true
	fi
	if [[ -n "$BOOTSTRAP_PID" ]]; then
		kill -TERM "$BOOTSTRAP_PID" 2>/dev/null || true
		wait "$BOOTSTRAP_PID" 2>/dev/null || true
	fi
	if [[ -n "$CURRENT_UNIT" ]]; then
		sudo -n systemctl stop "$CURRENT_UNIT" >/dev/null 2>&1 || true
	fi
	rm -rf "$WORK_ROOT"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_ready() {
	for _ in $(seq 1 240); do
		if curl --http1.1 -fsS -m 3 -o /dev/null "$BASE_URL/" 2>/dev/null; then
			return 0
		fi
		sleep 0.25
	done
	echo "error: server did not become ready at $BASE_URL" >&2
	return 1
}

echo "Initializing benchmark worktree"
git -C "$REPOSITORY" submodule update --init --recursive \
	>"$LOGS/submodules.log" 2>&1

echo "Building native benchmark binary"
CARGO_TARGET_DIR="$TARGET_DIR" cargo build \
	--manifest-path "$REPOSITORY/packages/playground/cli-native/Cargo.toml" \
	--release --bin wp-playground-native \
	>"$LOGS/build.log" 2>&1
NATIVE_BIN="$TARGET_DIR/release/wp-playground-native"
if [[ ! -x "$NATIVE_BIN" ]]; then
	echo "error: native benchmark binary was not produced" >&2
	exit 1
fi

PHP_INI_APPEND=$'opcache.enable=1\nopcache.memory_consumption=32\nopcache.interned_strings_buffer=4\nopcache.max_accelerated_files=8192\nopcache.max_wasted_percentage=10\nopcache.validate_timestamps=0\nopcache.revalidate_freq=0\nopcache.file_update_protection=0\nopcache.jit=0'

echo "Bootstrapping matched WordPress site"
env \
	WP_PLAYGROUND_NATIVE_ASSET_ROOT="$REPOSITORY" \
	WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER=3000 \
	WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND="$PHP_INI_APPEND" \
	taskset -c "$SERVER_CPUS" "$NATIVE_BIN" server \
	--mount-before-install="$SITE:/wordpress" \
	--login --php=8.2 --wp="$WORDPRESS_VERSION" --site-url="$BASE_URL" \
	--port="$PORT" --workers=1 \
	>"$LOGS/bootstrap.stdout" 2>"$LOGS/bootstrap.stderr" &
BOOTSTRAP_PID="$!"
wait_ready
kill -TERM "$BOOTSTRAP_PID" 2>/dev/null || true
wait "$BOOTSTRAP_PID" 2>/dev/null || true
BOOTSTRAP_PID=""

mkdir -p "$SITE/wp-content/mu-plugins"
cat >"$SITE/wp-content/mu-plugins/0-native-benchmark-http.php" <<'PHP'
<?php
add_filter('redirect_canonical', '__return_false');
add_filter('pre_http_request', function () {
    return new WP_Error('native_benchmark_http_blocked', 'HTTP disabled for benchmark');
}, 10, 3);
add_action('admin_init', function () {
    remove_action('admin_init', '_maybe_update_core');
    remove_action('admin_init', '_maybe_update_plugins');
    remove_action('admin_init', '_maybe_update_themes');
}, PHP_INT_MIN);
PHP
cat >"$SITE/wp-content/mu-plugins/1-native-benchmark-login.php" <<'PHP'
<?php
add_action('init', function () {
    $login_requested = isset($_GET['native_parity_benchmark_login'])
        && hash_equals('1', (string) $_GET['native_parity_benchmark_login']);
    if (!$login_requested) {
        return;
    }
    if (!is_user_logged_in()) {
        $user = get_user_by('login', 'admin');
        if (!$user) {
            wp_die('Benchmark admin user is unavailable.');
        }
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID);
    }
    wp_safe_redirect(admin_url('site-editor.php'));
    exit;
}, 0);
PHP

START_SCRIPT="$WORK_ROOT/start-server.sh"
{
	printf '#!/usr/bin/env bash\nset -euo pipefail\n'
	printf 'export HOME=%q\n' "$WORK_ROOT/home"
	printf 'export WP_PLAYGROUND_NATIVE_ASSET_ROOT=%q\n' "$REPOSITORY"
	printf 'export WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER=3000\n'
	printf 'export WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND=%q\n' "$PHP_INI_APPEND"
	printf 'exec %q -c %q %q server ' "$TASKSET_BIN" "$SERVER_CPUS" "$NATIVE_BIN"
	printf '%q ' \
		"--mount-before-install=$SITE:/wordpress" \
		'--wordpress-install-mode=install-from-existing-files-if-needed' \
		'--define' 'SQLITE_JOURNAL_MODE' 'WAL' \
		'--no-login' '--php=8.2' "--wp=$WORDPRESS_VERSION" "--site-url=$BASE_URL" \
		"--port=$PORT" '--workers=6'
	printf '>>%q 2>&1\n' "$LOGS/server.log"
} >"$START_SCRIPT"
chmod 700 "$START_SCRIPT"

counter_value() {
	local path="$1" key="$2"
	awk -v key="$key" '$1 == key { print $2; found=1 } END { if (!found) print 0 }' "$path"
}

assert_counter_unchanged() {
	local before="$1" after="$2" key="$3" context="$4"
	local before_value after_value
	before_value="$(counter_value "$before" "$key")"
	after_value="$(counter_value "$after" "$key")"
	if [[ "$before_value" != "$after_value" ]]; then
		echo "error: $context changed $key from $before_value to $after_value" >&2
		return 1
	fi
}

start_service() {
	local phase="$1"
	CURRENT_UNIT="wp-native-regression-$$-${phase}.service"
	sudo -n systemd-run \
		--unit="$CURRENT_UNIT" --collect \
		--uid="$SERVICE_USER" --gid="$SERVICE_GROUP" \
		--property="AllowedCPUs=$SERVER_CPUS" \
		--property=OOMPolicy=stop \
		"$BASH_BIN" "$START_SCRIPT" >"$RAW/systemd-$phase.txt"
	wait_ready
	CGROUP="$(systemctl show "$CURRENT_UNIT" --property=ControlGroup --value)"
	if [[ -z "$CGROUP" || ! -d "/sys/fs/cgroup$CGROUP" ]]; then
		echo "error: could not resolve cgroup for $CURRENT_UNIT" >&2
		return 1
	fi
	cp "/sys/fs/cgroup$CGROUP/cpu.stat" "$RAW/$phase-cpu-start.stat"
	cp "/sys/fs/cgroup$CGROUP/memory.events" "$RAW/$phase-memory-start.events"
}

stop_service() {
	local phase="$1"
	cp "/sys/fs/cgroup$CGROUP/cpu.stat" "$RAW/$phase-cpu-final.stat"
	cp "/sys/fs/cgroup$CGROUP/memory.events" "$RAW/$phase-memory-final.events"
	cat "/sys/fs/cgroup$CGROUP/memory.peak" >"$RAW/$phase-memory-final.peak-bytes"
	sudo -n systemctl stop "$CURRENT_UNIT" >/dev/null
	assert_counter_unchanged "$RAW/$phase-cpu-start.stat" "$RAW/$phase-cpu-final.stat" nr_throttled "$phase"
	for key in oom oom_kill oom_group_kill; do
		assert_counter_unchanged "$RAW/$phase-memory-start.events" "$RAW/$phase-memory-final.events" "$key" "$phase"
	done
	CURRENT_UNIT=""
	CGROUP=""
}

login() {
	local cookie="$1" prefix="$2"
	: >"$cookie"
	chmod 600 "$cookie"
	curl --http1.1 -fsS -m 60 -L -c "$cookie" -b "$cookie" \
		"$BASE_URL/?native_parity_benchmark_login=1" \
		-o "$RAW/$prefix-site-editor-login.html"
	if ! grep -Eq 'edit-site|site-editor' "$RAW/$prefix-site-editor-login.html"; then
		echo "error: Site Editor login validation failed" >&2
		return 1
	fi
}

cookie_scope() {
	case "$1" in
		public) echo none ;;
		mixed) echo admin ;;
		admin) echo all ;;
		*) return 1 ;;
	esac
}

run_load() {
	local workload="$1" round="$2" requests="$3" output="$4" cookie="$5"
	taskset -c "$CLIENT_CPUS" python3 "$SCRIPT_DIR/benchmark-wordpress-parity.py" load \
		--label "$LABEL" --base-url "$BASE_URL" --cookie-file "$cookie" \
		--cookie-scope "$(cookie_scope "$workload")" --workload "$workload" \
		--post-path "$POST_PATH" --concurrency 6 --requests-per-worker "$requests" \
		--round "$round" --timeout 60 --output "$output"
}

cookie_header() {
	awk -F '\t' '
		/^#HttpOnly_/ { sub(/^#HttpOnly_/, "") }
		/^#/ || NF != 7 { next }
		{ cookies[$6] = $7 }
		END {
			for (name in cookies) {
				printf "%s%s=%s", separator, name, cookies[name]
				separator = "; "
			}
			print ""
		}
	' "$1"
}

MAIN_COOKIE="$WORK_ROOT/main.cookies"
echo "Collecting throughput, CPU, and Site Editor metrics"
start_service main
login "$MAIN_COOKIE" main

for workload in public mixed admin; do
	mkdir -p "$RAW/throughput/$workload"
	run_load "$workload" 1 12 \
		"$RAW/throughput/$workload/warmup-load.json" "$MAIN_COOKIE" \
		>"$RAW/throughput/$workload/warmup.stdout"
	for round in 1 2 3 4; do
		run_load "$workload" "$round" 36 \
			"$RAW/throughput/$workload/round-$round-load.json" "$MAIN_COOKIE" \
			>"$RAW/throughput/$workload/round-$round.stdout"
	done
done

for workload in public mixed admin; do
	mkdir -p "$RAW/cpu/$workload"
	run_load "$workload" 1 12 "$RAW/cpu/$workload/warmup-load.json" \
		"$MAIN_COOKIE" >"$RAW/cpu/$workload/warmup.stdout"
done
sleep 2
for workload in public mixed admin; do
	for round in 1 2 3 4 5 6; do
		prefix="$RAW/cpu/$workload/round-$round"
		report="$RAW/cpu-reports/$LABEL-$workload-r$round.json"
		python3 "$SCRIPT_DIR/benchmark-process-resources.py" cgroup-cpu \
			--cgroup "$CGROUP" --output "$prefix-before.json"
		run_load "$workload" "$round" 36 "$prefix-load.json" "$MAIN_COOKIE" \
			>"$prefix-load.stdout"
		python3 "$SCRIPT_DIR/benchmark-process-resources.py" cgroup-cpu \
			--cgroup "$CGROUP" --output "$prefix-after.json"
		python3 "$SCRIPT_DIR/benchmark-process-resources.py" cpu-report \
			--label "$LABEL" --workload "$workload" --round "$round" \
			--before "$prefix-before.json" --after "$prefix-after.json" \
			--load "$prefix-load.json" --output "$report" \
			>"$prefix-report.stdout"
	done
done
python3 "$SCRIPT_DIR/benchmark-process-resources.py" aggregate \
	--reports-dir "$RAW/cpu-reports" --output "$ARTIFACT_ROOT/cpu-summary.json" \
	>"$LOGS/cpu-summary.log"

CHROMIUM="${PLAYWRIGHT_EXECUTABLE_PATH:-}"
if [[ -z "$CHROMIUM" ]]; then
	for candidate in chromium chromium-browser google-chrome; do
		if command -v "$candidate" >/dev/null; then
			CHROMIUM="$(command -v "$candidate")"
			break
		fi
	done
fi
if [[ -z "$CHROMIUM" ]]; then
	echo "error: set PLAYWRIGHT_EXECUTABLE_PATH to a Chromium executable" >&2
	exit 2
fi
AUTH_COOKIE_FILE="$WORK_ROOT/site-editor-cookie.txt"
cookie_header "$MAIN_COOKIE" >"$AUTH_COOKIE_FILE"
chmod 600 "$AUTH_COOKIE_FILE"
taskset -c "$CLIENT_CPUS" node "$SCRIPT_DIR/benchmark-site-editor.mjs" \
	--target "$LABEL=$BASE_URL" --auth-cookie-file "$LABEL::$AUTH_COOKIE_FILE" \
	--warmups 2 --samples 7 --timeout-ms 30000 \
	--fully-loaded-timeout-ms 30000 --quiet-window-ms 750 \
	--executable-path "$CHROMIUM" \
	--json-out "$ARTIFACT_ROOT/site-editor.json" \
	--tsv-out "$ARTIFACT_ROOT/site-editor.tsv" \
	>"$LOGS/site-editor.log" 2>&1

stop_service main
sleep 2

echo "Collecting isolated memory metrics"
MEMORY_COOKIE="$WORK_ROOT/memory.cookies"
start_service memory
login "$MEMORY_COOKIE" memory
for workload in public mixed admin; do
	mkdir -p "$RAW/memory/$LABEL/$workload"
	run_load "$workload" 1 12 \
		"$RAW/memory/$LABEL/$workload/warmup-load.json" "$MEMORY_COOKIE" \
		>"$RAW/memory/$LABEL/$workload/warmup.stdout"
done
sleep 5
python3 "$SCRIPT_DIR/benchmark-process-resources.py" sample \
	--cgroup "$CGROUP" --interval 0.2 \
	--output "$RAW/memory/$LABEL/idle-samples.json" \
	>"$RAW/memory/$LABEL/idle-sampler.stdout" \
	2>"$RAW/memory/$LABEL/idle-sampler.stderr" &
SAMPLER_PID="$!"
sleep 5
kill -TERM "$SAMPLER_PID"
wait "$SAMPLER_PID"
SAMPLER_PID=""

for workload in public mixed admin; do
	prefix="$RAW/memory/$LABEL/$workload"
	printf '0\n' | sudo -n tee "/sys/fs/cgroup$CGROUP/memory.peak" >/dev/null
	python3 "$SCRIPT_DIR/benchmark-process-resources.py" sample \
		--cgroup "$CGROUP" --interval 0.2 --output "$prefix/active-samples.json" \
		>"$prefix/active-sampler.stdout" 2>"$prefix/active-sampler.stderr" &
	SAMPLER_PID="$!"
	sleep 0.2
	run_load "$workload" 1 36 "$prefix/load.json" "$MEMORY_COOKIE" \
		>"$prefix/load.stdout"
	kill -TERM "$SAMPLER_PID"
	wait "$SAMPLER_PID"
	SAMPLER_PID=""
	sleep 5
done

stop_service memory
python3 "$SCRIPT_DIR/benchmark-process-resources.py" memory-aggregate \
	--results-dir "$RAW/memory" --output "$ARTIFACT_ROOT/memory-summary.json" \
	>"$LOGS/memory-summary.log"

node "$SCRIPT_DIR/benchmark-regression-normalize.mjs" \
	--revision-label "$REVISION" --resolved-commit "$REVISION" --label "$LABEL" \
	--throughput-dir "$RAW/throughput" \
	--cpu-reports-dir "$RAW/cpu-reports" \
	--cpu-loads-dir "$RAW/cpu" \
	--memory-summary "$ARTIFACT_ROOT/memory-summary.json" \
	--site-editor "$ARTIFACT_ROOT/site-editor.json" \
	--wordpress-version "$WORDPRESS_VERSION" --php-version 8.2 \
	--server-cpus "$SERVER_CPUS" --client-cpus "$CLIENT_CPUS" \
	--host-architecture "$HOST_ARCHITECTURE" \
	--host-cpu-model "$HOST_CPU_MODEL" \
	--host-kernel-release "$HOST_KERNEL_RELEASE" \
	--host-logical-cpu-count "$HOST_LOGICAL_CPU_COUNT" \
	--output "$OUTPUT"

echo "benchmark collection complete: $OUTPUT"
