#!/usr/bin/env bash
# Provisions a WordPress site with Reprint Server and serves it for the
# import E2E test (playwright/e2e/reprint-import.spec.ts).
#
#   bash serve.sh            # http://127.0.0.1:8181/
#   REPRINT_E2E_PORT=9000 bash serve.sh
#
# The site runs on SQLite so it needs only PHP (with sqlite3 and gd). Reprint's
# own E2E suite covers MySQL sources; this one covers the Playground side.
set -euo pipefail

PORT="${REPRINT_E2E_PORT:-8181}"
DIR="${REPRINT_E2E_DIR:-/tmp/playground-reprint-e2e-site}"
CACHE="${REPRINT_E2E_CACHE:-/tmp/playground-reprint-e2e-cache}"
SECRET="${REPRINT_E2E_SECRET:-playground-e2e-secret}"

WP_VERSION=7.1.2
SQLITE_PLUGIN_VERSION=3.0.2
# Same release as the client pinned in src/lib/reprint/reprint.ts.
REPRINT_VERSION=v0.10.10
REPRINT_SERVER_SHA256=456d60fb754c83c2203ca700d25aa0f5089b443dcb83d97cc855e6f688dc142a

HERE="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:${PORT}"
WP="php ${CACHE}/wp-cli.phar --path=${DIR}"

fetch() {
	if [ ! -s "$2" ]; then
		curl -sfL "$1" -o "$2"
	fi
}

mkdir -p "$CACHE"
fetch "https://wordpress.org/wordpress-${WP_VERSION}.tar.gz" "${CACHE}/wordpress-${WP_VERSION}.tar.gz"
fetch "https://downloads.wordpress.org/plugin/sqlite-database-integration.${SQLITE_PLUGIN_VERSION}.zip" "${CACHE}/sqlite-database-integration.zip"
fetch "https://github.com/WordPress/reprint/releases/download/${REPRINT_VERSION}/reprint-exporter-wp.zip" "${CACHE}/reprint-server.zip"
fetch "https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar" "${CACHE}/wp-cli.phar"
echo "${REPRINT_SERVER_SHA256}  ${CACHE}/reprint-server.zip" | shasum -a 256 -c - >/dev/null

rm -rf "$DIR"
mkdir -p "$DIR"
tar xzf "${CACHE}/wordpress-${WP_VERSION}.tar.gz" --strip-components=1 -C "$DIR"
unzip -q "${CACHE}/sqlite-database-integration.zip" -d "${DIR}/wp-content/plugins"
mkdir -p "${DIR}/wp-content/plugins/reprint-server"
unzip -q "${CACHE}/reprint-server.zip" -d "${DIR}/wp-content/plugins/reprint-server"
printf '<?php return %s;\n' "'${SECRET}'" > "${DIR}/wp-content/plugins/reprint-server/secret.php"

# The SQLite drop-in, filled in the way WordPress Playground fills it.
sed \
	-e "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#${DIR}/wp-content/plugins/sqlite-database-integration#" \
	-e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" \
	"${DIR}/wp-content/plugins/sqlite-database-integration/db.copy" > "${DIR}/wp-content/db.php"

$WP config create --dbname=wordpress --dbuser=wordpress --dbpass=wordpress --skip-check --quiet
$WP core install --url="$URL" --title="Reprint E2E source" \
	--admin_user=admin --admin_password=password --admin_email=admin@example.com \
	--skip-email --quiet
$WP plugin activate reprint-server --quiet
REPRINT_E2E_SITE_URL="$URL" $WP eval-file "${HERE}/seed.php" > "${DIR}/playground-e2e-manifest.json"

echo "Serving ${DIR} at ${URL}"
# Reprint Server calls its own site during preflight. One worker would block
# on that loopback request while it is still serving the API call.
export PHP_CLI_SERVER_WORKERS=8
exec php -S "127.0.0.1:${PORT}" -t "$DIR" -d display_errors=0 -d log_errors=1
