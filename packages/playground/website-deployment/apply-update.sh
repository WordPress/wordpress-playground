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
# Roll back the root snapshot taken immediately before this deployment.
ROLLBACK="${PLAYGROUND_ROLLBACK_BACKUP:-}"
RETENTION_DAYS="${PLAYGROUND_RELEASE_RETENTION_DAYS:-30}"
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

if [ -z "$ROLLBACK" ]; then
# A partial upload, or a build made for another release path, must not go live.
for file in index.html api.html remote.html wordpress-popup.html wordpress-bridge.html sw.js; do
    test -s "$BUILD/$file"
done
if ! grep -qF "/releases/$RELEASE_ID/" "$BUILD/index.html"; then
    echo "Refusing deployment: the build does not use /releases/$RELEASE_ID/." >&2
    exit 1
fi
# Both hostnames serve every page, so each must stop itself on the wrong origin.
if [ "$LOCAL" != 1 ] && ! grep -qF "location.origin!==\"$APP_ORIGIN\"" "$BUILD/remote.html"; then
    echo "Refusing deployment: the build's pages do not check for $APP_ORIGIN." >&2
    exit 1
fi

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

if [ -z "$ROLLBACK" ]; then
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

fi

# One inventory owns root activation, failure recovery, manual rollback and pruning.
# Release files remain immutable; only these small entry files are replaced.
"$SITE_PHP" /dev/stdin "$WEB_ROOT" "$BACKUPS" "$RELEASE_ID" "$ROLLBACK" "$RETENTION_DAYS" "$DEPLOYMENT" <<'PHP'
<?php
[ , $root, $backups, $release, $rollback, $retention, $deployment ] = $argv;
if ( ! ctype_digit( $retention ) || (int) $retention < 1 ) throw new RuntimeException( 'Retention must be a positive number of days.' );
require "$deployment/custom-redirects-lib.php";
$manifest = is_file( "$root/release.json" ) ? json_decode( file_get_contents( "$root/release.json" ), true, 512, JSON_THROW_ON_ERROR ) : [];
$owned = $manifest['rootFiles'] ?? [];
// Migrate the inventory of deployments made before rootFiles was recorded.
if ( ! isset( $manifest['rootFiles'] ) && isset( $manifest['release'] ) ) {
    $previous = "$root/releases/{$manifest['release']}";
    if ( is_dir( $previous ) ) {
        foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $previous, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
            $path = substr( $file->getPathname(), strlen( $previous ) + 1 );
            if ( str_ends_with( $path, '.html' ) && ! preg_match( '~^wp-[^/]+/~', $path ) && is_file( "$root/$path" ) ) $owned[] = $path;
        }
    }
}
$fixed = [ 'custom-redirects.php', 'sw.js', 'release.json', '__wp__/index.php' ];
$owned = array_unique( array_merge( $owned, $fixed ) );
if ( $rollback !== '' ) {
    if ( ! preg_match( '/\A[A-Za-z0-9][A-Za-z0-9._-]*\z/', $rollback ) ) throw new RuntimeException( 'Invalid rollback backup.' );
    $backup = "$backups/$rollback";
    $inventory = json_decode( file_get_contents( "$backup/inventory.json" ), true, 512, JSON_THROW_ON_ERROR );
    $target = is_file( "$backup/release.json" ) ? json_decode( file_get_contents( "$backup/release.json" ), true, 512, JSON_THROW_ON_ERROR ) : null;
    if ( $target && ( ! is_dir( "$root/releases/{$target['release']}" ) || ! is_dir( "$root/.playground-releases/{$target['release']}" ) ) ) throw new RuntimeException( 'Rollback release has expired.' );
    restore_snapshot( $root, $backup, $inventory, $owned );
    echo "Restored root snapshot $rollback\n";
} else {
    $public = "$root/releases/$release";
    $private = "$root/.playground-releases/$release";
    $sources = [ 'custom-redirects.php' => "$private/public-entry.php", '__wp__/index.php' => "$deployment/__wp__/index.php" ];
    foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $public, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
        $path = substr( $file->getPathname(), strlen( $public ) + 1 );
        if ( str_ends_with( $path, '.html' ) && ! preg_match( '~^wp-[^/]+/~', $path ) && ! playground_is_static_file_needing_special_treatment( "/$path" ) ) $sources[$path] = $file->getPathname();
    }
    write_file( "$private/root-sw.js", 'import "/releases/' . $release . '/sw.js";' . "\n" );
    $sources['sw.js'] = "$private/root-sw.js";
    $next = [ 'release' => $release, 'previousRelease' => $manifest['release'] ?? null, 'installedAt' => time(), 'rootFiles' => array_merge( array_keys( $sources ), [ 'release.json' ] ) ];
    write_file( "$private/release.json", json_encode( $next, JSON_THROW_ON_ERROR ) . "\n" );
    $sources['release.json'] = "$private/release.json";
    $backup = "$backups/$release";
    if ( is_dir( $backup ) ) throw new RuntimeException( 'Backup already exists.' );
    mkdir( $backup, 0755, true );
    $inventory = [ 'files' => [], 'absent' => [] ];
    foreach ( array_unique( array_merge( $owned, array_keys( $sources ) ) ) as $path ) {
        if ( is_file( "$root/$path" ) ) {
            install_file( "$backup/$path", "$root/$path" );
            $inventory['files'][] = $path;
        } else {
            $inventory['absent'][] = $path;
        }
    }
    write_file( "$backup/inventory.json", json_encode( $inventory, JSON_THROW_ON_ERROR ) );
    try {
        foreach ( array_diff( $owned, array_keys( $sources ) ) as $path ) remove_root_file( $root, $path );
        foreach ( $sources as $path => $source ) install_file( "$root/$path", $source );
    } catch ( Throwable $error ) {
        restore_snapshot( $root, $backup, $inventory, array_keys( $sources ) );
        throw new RuntimeException( 'Activation failed; previous root files restored.', 0, $error );
    }
    echo "Activated release $release; root snapshot: $backup\n";
}

function restore_snapshot( $root, $backup, $inventory, $current ) {
    foreach ( array_unique( array_merge( $inventory['absent'], array_diff( $current, $inventory['files'] ) ) ) as $path ) remove_root_file( $root, $path );
    // release.json is committed last, just as during activation.
    foreach ( array_diff( $inventory['files'], [ 'release.json' ] ) as $path ) install_file( "$root/$path", "$backup/$path" );
    if ( in_array( 'release.json', $inventory['files'], true ) ) install_file( "$root/release.json", "$backup/release.json" );
}

function install_file( $target, $source ) {
    if ( ! is_dir( dirname( $target ) ) && ! mkdir( dirname( $target ), 0755, true ) ) throw new RuntimeException( "Cannot create parent of $target" );
    $temporary = tempnam( dirname( $target ), '.playground-new-' );
    if ( false === $temporary ) throw new RuntimeException( "Cannot stage $target" );
    try {
        if ( ! copy( $source, $temporary ) || ! chmod( $temporary, 0644 ) || ! rename( $temporary, $target ) ) throw new RuntimeException( "Cannot install $target" );
    } finally {
        if ( is_file( $temporary ) ) unlink( $temporary );
    }
}

function write_file( $path, $contents ) {
    if ( file_put_contents( $path, $contents ) !== strlen( $contents ) ) throw new RuntimeException( "Cannot write $path" );
}

function remove_root_file( $root, $path ) {
    if ( is_file( "$root/$path" ) && ! unlink( "$root/$path" ) ) throw new RuntimeException( "Cannot remove $path" );
    $parent = dirname( "$root/$path" );
    while ( $parent !== $root && is_dir( $parent ) && count( scandir( $parent ) ) === 2 ) {
        rmdir( $parent );
        $parent = dirname( $parent );
    }
}

PHP

if [ "$LOCAL" != 1 ]; then
    # Do not report a complete deployment when the old edge responses remain cached.
    curl --fail --silent --show-error --max-time 60 -X POST \
        -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" > /dev/null
    echo 'Edge cache purged'
fi

# Prune only after the activation's edge purge. A cleanup failure must not leave
# stale entry responses cached, and must still be reported as a deployment error.
"$SITE_PHP" /dev/stdin "$WEB_ROOT" "$BACKUPS" "$RETENTION_DAYS" <<'PHP'
<?php
[ , $root, $backups, $retention ] = $argv;
// Cleanup follows activation. Protect the active release and its rollback target.
if ( ! is_file( "$root/release.json" ) ) exit( 0 );
$active = json_decode( file_get_contents( "$root/release.json" ), true, 512, JSON_THROW_ON_ERROR );
$protected = [ $active['release'], $active['previousRelease'] ?? null ];
foreach ( glob( "$root/.playground-releases/*/release.json" ) as $metadata ) {
    $candidate = json_decode( file_get_contents( $metadata ), true, 512, JSON_THROW_ON_ERROR );
    $id = $candidate['release'];
    // Measure retention from inactivity, not the original upload. A release may
    // have served for months before today's deployment or be activated again.
    if ( $id === $active['release'] ) unset( $candidate['inactiveSince'] );
    else $candidate['inactiveSince'] ??= time();
    $json = json_encode( $candidate, JSON_THROW_ON_ERROR ) . "\n";
    if ( file_put_contents( $metadata, $json, LOCK_EX ) !== strlen( $json ) ) throw new RuntimeException( "Cannot update lifecycle metadata: $id" );
    if ( in_array( $id, $protected, true ) || $candidate['inactiveSince'] >= time() - (int) $retention * 86400 ) continue;
    foreach ( [ "$root/releases/$id", "$root/.playground-releases/$id", "$backups/$id" ] as $directory ) remove_tree( $directory );
    echo "Expired release $id\n";
}

function remove_tree( $directory ) {
    if ( ! is_dir( $directory ) ) return;
    foreach ( new FilesystemIterator( $directory ) as $file ) {
        if ( $file->isDir() && ! $file->isLink() ) remove_tree( $file->getPathname() );
        else unlink( $file->getPathname() );
    }
    rmdir( $directory );
}
PHP
