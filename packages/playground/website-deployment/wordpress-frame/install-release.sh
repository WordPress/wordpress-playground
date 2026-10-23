#!/bin/bash

# Install an uploaded build only after WP Cloud denies direct release URLs.
# Arguments are filesystem paths so the same installer can be tested in a
# temporary directory. Public origins are fixed in custom-redirects-lib.php,
# not HTTP input.
set -euo pipefail
BUILD="${1:?Expected build, web-root, and backup-directory paths}"
WEB_ROOT="${2:?Expected web-root path}"
BACKUPS="${3:?Expected backup-directory path}"
DEPLOYMENT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_PHP="${SITE_PHP:-php}"

# A partial upload must not replace the running site.
for file in index.html api.html remote.html wordpress-bridge.html sw.js; do
    test -s "$BUILD/$file"
done

# Web PHP cannot read the SSH home directory. Hidden paths under htdocs are
# mounted there, but MUST be denied by Nginx, including encoded path variants.
mkdir -p -m 755 "$WEB_ROOT/.playground-releases"
PROBE="$(mktemp "$WEB_ROOT/.playground-releases/probe.XXXXXXXX")"
printf 'This private deployment probe must not be served.\n' > "$PROBE"
# mktemp creates mode 600. A permissions-based 403 must not stand in for the
# Nginx rule that has to protect readable build files.
chmod 644 "$PROBE"
trap 'rm -f "$PROBE"' EXIT
for origin in https://playground.wordpress.net https://wasm.wordpress.net; do
    for prefix in /.playground-releases/ /%2eplayground-releases/ /%2eplayground-releases%2f; do
        status="$(curl --silent --show-error --path-as-is --max-time 15 \
            --output /dev/null --write-out '%{http_code}' \
            "$origin$prefix$(basename "$PROBE")")"
        if [ "$status" != 403 ]; then
            echo "Refusing deployment: $origin$prefix returned $status, expected 403." >&2
            exit 1
        fi
    done
    # An alias redirect can happen after Nginx's hidden-path rejection. Check a
    # normal URL too, without following redirects or reusing an old cached 301.
    status="$(curl --silent --show-error --max-time 15 \
        --output /dev/null --write-out '%{http_code}' \
        "$origin/sw.js?playground-deployment=$(basename "$PROBE")")"
    if [ "$status" != 200 ] && [ "$status" != 404 ]; then
        echo "Refusing deployment: $origin/sw.js returned $status; check domain mapping and canonicalize_aliases." >&2
        exit 1
    fi
done

RELEASE="$(mktemp -d "$WEB_ROOT/.playground-releases/release.XXXXXXXX")"
chmod 755 "$RELEASE"
mv "$BUILD" "$RELEASE/files"
cp "$DEPLOYMENT/custom-redirects-lib.php" "$RELEASE/"
# Retain the existing PHP MIME map so opcache can cache it. Both website layouts
# use the same response-header code in custom-redirects-lib.php.
"$SITE_PHP" -r '
    $types = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
    if (($types["_default"] ?? null) !== "application/octet-stream" ||
        ($types["html"] ?? null) !== "text/html" ||
        ($types["jpeg"] ?? null) !== "image/jpeg") {
        throw new RuntimeException("MIME map is missing required entries");
    }
    echo "<?php\n\$mime_types = " . var_export($types, true) . ";\n";
' "$DEPLOYMENT/mime-types.json" > "$RELEASE/mime-types.php"
for file in "$RELEASE/"*.php; do
    "$SITE_PHP" -l "$file"
done

# Select this exact build in the existing request handler. Once PHP loads this
# entry, it keeps using this release even if another deployment replaces the
# public entry. Personal WP still uses the existing no-argument entry.
"$SITE_PHP" -r '
    $relative = "/.playground-releases/" . basename($argv[1]);
    echo "<?php\nif (\"cli\" === php_sapi_name()) { return; }\n";
    echo "define(\"PLAYGROUND_DEBUG\", false);\n";
    echo "require_once __DIR__ . " . var_export($relative . "/custom-redirects-lib.php", true) . ";\n";
    echo "playground_handle_request(__DIR__ . " . var_export($relative . "/files", true) . ");\n";
' "$RELEASE" > "$RELEASE/public-entry.php"
"$SITE_PHP" -l "$RELEASE/public-entry.php"

BACKUP="$BACKUPS/$(basename "$RELEASE")"
mkdir -p "$BACKUP"
if [ -f "$WEB_ROOT/custom-redirects.php" ]; then
    cp "$WEB_ROOT/custom-redirects.php" "$BACKUP/"
fi
# Old public HTML or assets would bypass the router on the WordPress host.
# Move them outside htdocs. Preserve releases and the platform's PHP fallback.
# Do not use find -exec here: an individual mv failure must stop activation.
shopt -s dotglob nullglob
for path in "$WEB_ROOT"/*; do
    case "$(basename "$path")" in
        .playground-releases|__wp__|custom-redirects.php) continue ;;
    esac
    mv "$path" "$BACKUP/"
done
mkdir -p "$WEB_ROOT/__wp__"
cp "$DEPLOYMENT/__wp__/index.php" "$WEB_ROOT/__wp__/index.php"
mv -f "$RELEASE/public-entry.php" "$WEB_ROOT/custom-redirects.php"
printf 'Activated %s; previous entry and public files: %s\n' "$RELEASE" "$BACKUP"
