#!/bin/bash
set -euo pipefail

# Install one static release for Nginx to serve on both hostnames.
#
# The build was made with its asset URLs under /releases/$PLAYGROUND_RELEASE_ID/.
# This script places it in that public directory, keeps its PHP endpoints in a
# private directory, then copies the entry pages to the web root. Nginx serves
# existing files directly; custom-redirects.php handles only missing paths.
# Previous releases stay in place so open tabs can keep loading their own files.
#
# The workflow passes the same origins and release ID used for the browser build.
# Paths and platform settings can be supplied to run this script against a test site.
APP_ORIGIN="${1:?Expected app origin}"
WORDPRESS_ORIGIN="${2:?Expected WordPress origin}"
BUILD="${3:-$HOME/updated-playground-files}"
WEB_ROOT="${4:-/srv/htdocs}"
BACKUPS="${5:-$HOME/website-backups}"
RELEASE_ID="${PLAYGROUND_RELEASE_ID:?Expected PLAYGROUND_RELEASE_ID}"
# Local preview and test installs skip the WP Cloud probes and edge purge.
LOCAL="${PLAYGROUND_LOCAL_RELEASES:-0}"
DEPLOYMENT="$(cd "$(dirname "$0")" && pwd)"
# Explicitly use the site's declared PHP version. The SSH default has been 7.4,
# which cannot run this handler. Tests may supply their installed PHP binary.
SITE_PHP="${SITE_PHP:-/usr/local/php${PHP_VERSION}/bin/php}"
if [ "$LOCAL" != 1 ]; then
    SITE_API_BASE="${SITE_API_BASE:-$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')}"
fi

# A bad origin could put app documents on the sandbox host or import platform
# scripts from the wrong host. Pages compare these strings with location.origin,
# so they must already be canonical. Reject them before touching the web root.
"$SITE_PHP" -r '
    [ , $app_origin, $wordpress_origin, $release, $local ] = $argv;
    foreach ( [ $app_origin, $wordpress_origin ] as $origin ) {
        $parts = parse_url( $origin );
        $host = $parts["host"] ?? "";
        $loopback = in_array( $host, [ "localhost", "127.0.0.1" ], true ) || str_ends_with( $host, ".localhost" );
        if ( ! filter_var( $origin, FILTER_VALIDATE_URL ) ||
            ! ( ( $parts["scheme"] ?? null ) === "https" || ( "1" === $local && $loopback && ( $parts["scheme"] ?? null ) === "http" ) ) ||
            ( "1" === $local && ! $loopback ) ||
            isset( $parts["user"] ) || isset( $parts["pass"] ) ||
            isset( $parts["path"] ) || isset( $parts["query"] ) || isset( $parts["fragment"] ) ) {
            throw new RuntimeException( "Expected an HTTPS origin without a path: " . $origin );
        }
        $default_port = [ "http" => 80, "https" => 443 ][ $parts["scheme"] ];
        $canonical = $parts["scheme"] . "://" . strtolower( $host ) .
            ( isset( $parts["port"] ) && $parts["port"] !== $default_port ? ":" . $parts["port"] : "" );
        if ( $origin !== $canonical ) {
            throw new RuntimeException( "Expected the origin in canonical form: " . $canonical );
        }
    }
    if ( strcasecmp( parse_url( $app_origin, PHP_URL_HOST ), parse_url( $wordpress_origin, PHP_URL_HOST ) ) === 0 ) {
        throw new RuntimeException( "The app and WordPress must use different hostnames" );
    }
    if ( ! preg_match( "/\\A[A-Za-z0-9][A-Za-z0-9._-]*\\z/", $release ) ) {
        throw new RuntimeException( "Invalid release ID: " . $release );
    }
' "$APP_ORIGIN" "$WORDPRESS_ORIGIN" "$RELEASE_ID" "$LOCAL"

# A partial upload, or a build made for another release path, must not go live.
for file in index.html api.html remote.html wordpress-popup.html wordpress-bridge.html sw.js; do
    test -s "$BUILD/$file"
done
if ! grep -q "/releases/$RELEASE_ID/" "$BUILD/index.html"; then
    echo "Refusing deployment: the build does not use /releases/$RELEASE_ID/." >&2
    exit 1
fi
# Both hostnames serve every page, so each must stop itself on the wrong origin.
if [ "$LOCAL" != 1 ] && ! grep -qF "location.origin!==\"$APP_ORIGIN\"" "$BUILD/remote.html"; then
    echo "Refusing deployment: the build's pages do not check for $APP_ORIGIN." >&2
    exit 1
fi

PROBE=''
HIDDEN_PROBE=''
trap 'rm -f "$PROBE" "$HIDDEN_PROBE"' EXIT
if [ "$LOCAL" != 1 ]; then
    # PHP endpoints live under hidden paths in htdocs, which MUST be denied by
    # Nginx, including encoded path variants.
    mkdir -p -m 755 "$WEB_ROOT/.playground-releases"
    PROBE="$(mktemp "$WEB_ROOT/.playground-releases/probe.XXXXXXXX")"
    # Hidden server files, such as editor swap files, stay in htdocs. Check that
    # Nginx denies those too, not just the private release directory.
    HIDDEN_PROBE="$(mktemp "$WEB_ROOT/.playground-probe.XXXXXXXX")"
    HIDDEN_PROBE_NAME="$(basename "$HIDDEN_PROBE")"
    # mktemp creates mode 600. A permissions-based 403 must not stand in for the
    # Nginx rule that has to protect readable build files.
    for probe in "$PROBE" "$HIDDEN_PROBE"; do
        printf 'This private deployment probe must not be served.\n' > "$probe"
        chmod 644 "$probe"
    done
    for origin in "$APP_ORIGIN" "$WORDPRESS_ORIGIN"; do
        for path in \
            "/.playground-releases/$(basename "$PROBE")" \
            "/%2eplayground-releases/$(basename "$PROBE")" \
            "/%2eplayground-releases%2f$(basename "$PROBE")" \
            "/$HIDDEN_PROBE_NAME" \
            "/%2e${HIDDEN_PROBE_NAME:1}"; do
            status="$(curl --silent --show-error --path-as-is --max-time 15 \
                --output /dev/null --write-out '%{http_code}' \
                "$origin$path")"
            if [ "$status" != 403 ]; then
                echo "Refusing deployment: $origin$path returned $status, expected 403." >&2
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
fi

# Stage under a hidden name, which Nginx denies, until the release is complete.
mkdir -p "$WEB_ROOT/releases" "$WEB_ROOT/.playground-releases" "$BACKUPS"
PUBLIC="$WEB_ROOT/releases/$RELEASE_ID"
PRIVATE="$WEB_ROOT/.playground-releases/$RELEASE_ID"
STAGING="$WEB_ROOT/releases/.staging-$RELEASE_ID"
if [ -e "$PUBLIC" ] || [ -e "$PRIVATE" ] || [ -e "$STAGING" ]; then
    echo "Refusing deployment: release $RELEASE_ID already exists." >&2
    exit 1
fi
mv "$BUILD" "$STAGING"
mkdir -p "$PRIVATE/files"
cp "$DEPLOYMENT/custom-redirects-lib.php" "$PRIVATE/"
"$SITE_PHP" -r '
    $types = json_decode( file_get_contents( $argv[1] ), true, 512, JSON_THROW_ON_ERROR );
    if ( ( $types["_default"] ?? null ) !== "application/octet-stream" ||
        ( $types["html"] ?? null ) !== "text/html" ||
        ( $types["jpeg"] ?? null ) !== "image/jpeg" ) {
        throw new RuntimeException( "MIME map is missing required entries" );
    }
    echo "<?php\n\$mime_types = " . var_export( $types, true ) . ";\n";
' "${PLAYGROUND_MIME_TYPES:-$DEPLOYMENT/mime-types.json}" > "$PRIVATE/mime-types.php"

# Move PHP endpoints out of the public release: Nginx would run them on both
# hostnames. The build validates WordPress static documents before upload.
"$SITE_PHP" -r '
    [ , $staging, $private ] = $argv;
    $files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $staging, FilesystemIterator::SKIP_DOTS ) );
    foreach ( iterator_to_array( $files ) as $file ) {
        $relative = substr( $file->getPathname(), strlen( $staging ) + 1 );
        if ( str_ends_with( strtolower( $relative ), ".php" ) ) {
            $target = "$private/files/$relative";
            if ( ! is_dir( dirname( $target ) ) ) mkdir( dirname( $target ), 0755, true );
            if ( ! rename( $file->getPathname(), $target ) ) throw new RuntimeException( "Cannot move $relative" );
        }
    }
' "$STAGING" "$PRIVATE"

# The entry selects this exact release. Once PHP loads it, it keeps using this
# release even if another deployment replaces the root entry. Personal WP still
# uses the existing no-argument entry.
"$SITE_PHP" -r '
    [ , $release, $wordpress_origin, $app_origin ] = $argv;
    $private = "/.playground-releases/$release";
    echo "<?php\nif (\"cli\" === php_sapi_name()) { return; }\n";
    echo "define(\"PLAYGROUND_DEBUG\", false);\n";
    echo "require_once __DIR__ . " . var_export( "$private/custom-redirects-lib.php", true ) . ";\n";
    echo "playground_handle_request(__DIR__ . " . var_export( "/releases/$release", true ) . ", " .
        var_export( $wordpress_origin, true ) . ", " . var_export( $app_origin, true ) . ", __DIR__ . " .
        var_export( "$private/files", true ) . ");\n";
' "$RELEASE_ID" "$WORDPRESS_ORIGIN" "$APP_ORIGIN" > "$PRIVATE/public-entry.php"
for file in "$PRIVATE/"*.php; do
    "$SITE_PHP" -l "$file"
done
mv "$STAGING" "$PUBLIC"

# Root copies let Nginx serve the entry pages and worker without PHP. Pages that
# need custom headers, such as the no-store index.html, stay PHP-served from the
# release. Back up each root file this deployment replaces.
ROOT_FILES="$("$SITE_PHP" -r '
    require $argv[2];
    $files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $argv[1], FilesystemIterator::SKIP_DOTS ) );
    foreach ( $files as $file ) {
        $relative = substr( $file->getPathname(), strlen( $argv[1] ) );
        if ( str_ends_with( $relative, ".html" ) && ! preg_match( "~^/wp-[^/]+/~", $relative ) &&
            ! playground_is_static_file_needing_special_treatment( $relative ) ) {
            echo substr( $relative, 1 ), "\n";
        }
    }
' "$PUBLIC" "$DEPLOYMENT/custom-redirects-lib.php")"
BACKUP="$BACKUPS/$RELEASE_ID"
mkdir -p "$BACKUP"
while IFS= read -r file; do
    if [ -n "$file" ] && [ -f "$WEB_ROOT/$file" ]; then
        mkdir -p "$BACKUP/$(dirname "$file")"
        cp "$WEB_ROOT/$file" "$BACKUP/$file"
    fi
done <<< "$ROOT_FILES"
for file in custom-redirects.php sw.js release.json; do
    if [ -f "$WEB_ROOT/$file" ]; then
        cp "$WEB_ROOT/$file" "$BACKUP/$file"
    fi
done

# Replace each root file through a same-directory rename. The worker loader goes
# last: it imports the new release's worker, which pages from this release expect.
install_root_file() {
    mkdir -p "$(dirname "$WEB_ROOT/$1")"
    cp "$2" "$WEB_ROOT/$1.playground-new"
    mv -f "$WEB_ROOT/$1.playground-new" "$WEB_ROOT/$1"
}
mkdir -p "$WEB_ROOT/__wp__"
cp "$DEPLOYMENT/__wp__/index.php" "$WEB_ROOT/__wp__/index.php"
install_root_file custom-redirects.php "$PRIVATE/public-entry.php"
while IFS= read -r file; do
    if [ -n "$file" ]; then
        install_root_file "$file" "$PUBLIC/$file"
    fi
done <<< "$ROOT_FILES"
GENERATED="$(mktemp)"
printf 'import "/releases/%s/sw.js";\n' "$RELEASE_ID" > "$GENERATED"
install_root_file sw.js "$GENERATED"
printf '{"release":"%s"}\n' "$RELEASE_ID" > "$GENERATED"
install_root_file release.json "$GENERATED"
rm -f "$GENERATED"
printf 'Activated release %s; previous root files: %s\n' "$RELEASE_ID" "$BACKUP"

if [ "$LOCAL" != 1 ]; then
    # Do not report a complete deployment when the old edge responses remain cached.
    curl --fail --silent --show-error --max-time 60 -X POST \
        -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" > /dev/null
    echo 'Edge cache purged'
fi
