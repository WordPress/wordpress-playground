#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
WP_CORE_TAG="${WP_CORE_TAG:-6.9.4}"
WORDPRESS_ZIP_URL="${WORDPRESS_ZIP_URL:-https://wordpress.org/wordpress-6.9.4.zip}"
TWENTY_TWENTY_ONE_URL="${TWENTY_TWENTY_ONE_URL:-https://downloads.wordpress.org/theme/twentytwentyone.latest-stable.zip}"
PHP_VERSION="${PHP_VERSION:-8.2}"
PORT="${PORT:-9500}"
BINARY="${BINARY:-$ROOT_DIR/packages/playground/cli-native/target/debug/wp-playground-native}"
WORK_BASE="${RUNNER_TEMP:-${XDG_CACHE_HOME:-$HOME/.cache}}"
WORK_DIR="${WORK_DIR:-$WORK_BASE/wp-playground-native-core-e2e}"
WP_CORE_DIR="${WP_CORE_DIR:-$WORK_DIR/wordpress-develop}"
SERVER_HOME="${SERVER_HOME:-$WORK_DIR/home}"
SERVER_TMP="${SERVER_TMP:-$WORK_DIR/tmp}"
BLUEPRINT_FILE="$WORK_DIR/blueprint.json"
SERVER_LOG="$WORK_DIR/server.log"

if [[ ! -x "$BINARY" ]]; then
	echo "Native CLI binary is missing or not executable: $BINARY" >&2
	exit 1
fi

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR" "$SERVER_HOME" "$SERVER_TMP"

git clone --depth 1 --branch "$WP_CORE_TAG" https://github.com/WordPress/wordpress-develop.git "$WP_CORE_DIR"

(
	cd "$WP_CORE_DIR"
	npm ci --no-audit --no-fund --loglevel=error
	if [[ "${INSTALL_PLAYWRIGHT_DEPS:-0}" == "1" ]]; then
		npx playwright install --with-deps chromium
	fi
)

cat > "$BLUEPRINT_FILE" <<JSON
{
  "steps": [
    {
      "step": "installTheme",
      "themeData": {
        "resource": "url",
        "url": "$TWENTY_TWENTY_ONE_URL"
      }
    }
  ]
}
JSON

cleanup() {
	if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
		kill "$SERVER_PID" 2>/dev/null || true
		wait "$SERVER_PID" 2>/dev/null || true
	fi
}
trap cleanup EXIT

HOME="$SERVER_HOME" TMPDIR="$SERVER_TMP" "$BINARY" server \
	--port="$PORT" \
	--workers=6 \
	--php="$PHP_VERSION" \
	--wp="$WORDPRESS_ZIP_URL" \
	--blueprint "$BLUEPRINT_FILE" \
	>"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 180); do
	if grep -q "Ready! WordPress is running" "$SERVER_LOG"; then
		break
	fi
	if ! kill -0 "$SERVER_PID" 2>/dev/null; then
		cat "$SERVER_LOG" >&2
		exit 1
	fi
	sleep 1
done

if ! grep -q "Ready! WordPress is running" "$SERVER_LOG"; then
	cat "$SERVER_LOG" >&2
	echo "Timed out waiting for wp-playground-native to become ready." >&2
	exit 1
fi

(
	cd "$WP_CORE_DIR"
	WP_BASE_URL="http://127.0.0.1:$PORT" \
		WP_USERNAME=admin \
		WP_PASSWORD=password \
		npm run test:e2e -- \
		tests/e2e/specs/hello.test.js \
		tests/e2e/specs/dashboard.test.js \
		tests/e2e/specs/edit-posts.test.js \
		--project=chromium \
		--reporter=line
)
