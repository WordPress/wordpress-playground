#!/bin/bash
set -euo pipefail

APP_ORIGIN="${1:?Expected app origin}"
WORDPRESS_ORIGIN="${2:?Expected WordPress origin}"
BUILD="${3:-$HOME/updated-playground-files}"
WEB_ROOT="${4:-/srv/htdocs}"
BACKUPS="${5:-$HOME/website-backups}"
DEPLOYMENT="$(cd "$(dirname "$0")" && pwd)"
SITE_PHP="${SITE_PHP:-/usr/local/php${PHP_VERSION}/bin/php}"
SITE_API_BASE="${SITE_API_BASE:-$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')}"

# Reject malformed origins before probing either host or changing deployment files.
"$SITE_PHP" -r '
[ , $app_origin, $wordpress_origin ] = $argv;
foreach ( [ $app_origin, $wordpress_origin ] as $origin ) {
    $url = parse_url( $origin );
    $local = getenv( "PLAYGROUND_LOCAL_RELEASES" ) === "1";
    $host = $url["host"] ?? "";
    if ( $local && ! in_array( $host, [ "localhost", "127.0.0.1" ], true ) && ! str_ends_with( $host, ".localhost" ) ) {
        throw new RuntimeException( "Local release installation requires loopback hosts." );
    }
    if ( ! filter_var( $origin, FILTER_VALIDATE_URL ) ||
        ( ( $url["scheme"] ?? "" ) !== "https" && ! (
            getenv( "PLAYGROUND_LOCAL_RELEASES" ) === "1" &&
            ( $url["scheme"] ?? "" ) === "http" &&
            ( in_array( $url["host"] ?? "", [ "localhost", "127.0.0.1" ], true ) ||
                str_ends_with( $url["host"] ?? "", ".localhost" ) )
        ) ) || isset( $url["path"] ) ||
        isset( $url["query"] ) || isset( $url["fragment"] ) ||
        isset( $url["user"] ) || isset( $url["pass"] ) ) {
        throw new RuntimeException( "Expected an HTTPS origin without a path." );
    }
}
if ( strcasecmp( parse_url( $app_origin, PHP_URL_HOST ), parse_url( $wordpress_origin, PHP_URL_HOST ) ) === 0 ) {
    throw new RuntimeException( "The app and sandbox must use different hostnames." );
}
 ' "$APP_ORIGIN" "$WORDPRESS_ORIGIN"

if [ "${PLAYGROUND_LOCAL_RELEASES:-0}" != 1 ]; then
    # Native PHP endpoints remain private. Verify the server deny rule before publishing.
    mkdir -p -m 755 "$WEB_ROOT/.playground-releases"
    PROBE="$(mktemp "$WEB_ROOT/.playground-releases/probe.XXXXXXXX")"
    HIDDEN_PROBE=''
    trap 'rm -f "$PROBE" "$HIDDEN_PROBE"' EXIT
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

"$SITE_PHP" /dev/stdin "$DEPLOYMENT" \
    "$APP_ORIGIN" "$WORDPRESS_ORIGIN" "$BUILD" "$WEB_ROOT" "$BACKUPS" <<'PHP'
<?php
/** Install static immutable files first; replacing one selector activates the release. */
set_error_handler( static function ( $severity, $message, $file, $line ) {
    throw new ErrorException( $message, 0, $severity, $file, $line );
} );
[ , $deployment, $app_origin, $wordpress_origin, $build, $web_root, $backups ] = $argv;
foreach ( [ 'index.html', 'remote.html', 'api.html', 'app-sw.js', 'sandbox-sw.js', 'wordpress-bridge.html' ] as $file ) {
    if ( ! is_file( "$build/$file" ) || ! filesize( "$build/$file" ) ) {
        throw new RuntimeException( "Incomplete upload: $file" );
    }
}
// Public deployment must never expose a symlink to server-private files.
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $build, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::SELF_FIRST ) as $file ) {
    if ( $file->isLink() ) throw new RuntimeException( 'Build symlinks are not supported.' );
}

$release = 'release.' . bin2hex( random_bytes( 8 ) );
$public = "$web_root/releases/$release";
$private = "$web_root/.playground-releases/$release";
$metadata = json_encode( [
    'protocol' => 1,
    'release' => $release,
    'appOrigin' => $app_origin,
    'wordPressOrigin' => $wordpress_origin,
], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES );
mkdir( $public, 0755, true );
mkdir( "$private/files", 0755, true );
$backup = "$backups/$release";
mkdir( $backup, 0755, true );
$public_entries = [ 'custom-redirects.php', 'index.html', 'remote.html', 'api.html', 'wordpress-bridge.html', 'bootstrap.js' ];
foreach ( $public_entries as $file ) {
    if ( is_file( "$web_root/$file" ) ) copy( "$web_root/$file", "$backup/$file" );
}
$activated = false;
register_shutdown_function( static function () use ( &$activated, $public_entries, $web_root, $backup ) {
    if ( $activated ) return;
    restore_error_handler();
    foreach ( $public_entries as $file ) {
        if ( is_file( "$backup/$file" ) ) {
            if ( ! copy( "$backup/$file", "$web_root/$file.rollback" ) ||
                ! rename( "$web_root/$file.rollback", "$web_root/$file" ) ) {
                error_log( "Failed to restore $file from $backup" );
            }
        } elseif ( is_file( "$web_root/$file" ) ) {
            unlink( "$web_root/$file" );
        }
    }
} );
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $build, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::SELF_FIRST ) as $file ) {
    $relative = substr( $file->getPathname(), strlen( $build ) + 1 );
    $target = str_ends_with( strtolower( $relative ), '.php' ) ? "$private/files/$relative" : "$public/$relative";
    if ( $file->isDir() ) {
        if ( ! is_dir( $target ) ) mkdir( $target, 0755, true );
    } else {
        if ( ! is_dir( dirname( $target ) ) ) mkdir( dirname( $target ), 0755, true );
        if ( ! copy( $file->getPathname(), $target ) ) throw new RuntimeException( "Cannot install $relative" );
        if ( str_ends_with( $relative, '.html' ) ) {
            $html = file_get_contents( $target );
            $html = preg_replace_callback( '~(<(?:script|link|img)\b[^>]*?\b(?:src|href)=["\'])/(?!/)([^"\']+)(["\'])~i',
                fn( $match ) => $match[1] . "/releases/$release/" . $match[2] . $match[3], $html );
            file_put_contents( $target, $html );
        }
    }
}
// A stable module name lets installed workers generate trustworthy helper HTML
// for retained releases without consulting WordPress-writable CacheStorage.
$bridge = file_get_contents( "$public/wordpress-bridge.html" );
if ( ! preg_match( '~<script\b[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>~i', $bridge, $bridge_script ) ) {
    throw new RuntimeException( 'The WordPress bridge module is missing.' );
}
$bridge_module = realpath( $web_root . $bridge_script[1] );
if ( ! str_starts_with( $bridge_script[1], "/releases/$release/" ) ||
    ! $bridge_module || ! str_starts_with( $bridge_module, realpath( $public ) . '/' ) ||
    ! is_file( $bridge_module ) || ! filesize( $bridge_module ) ) {
    throw new RuntimeException( 'The WordPress bridge module is not a file in this release.' );
}
file_put_contents( "$public/wordpress-bridge.js", 'import ' . json_encode( $bridge_script[1], JSON_THROW_ON_ERROR ) . ";\n" );
file_put_contents( "$public/wordpress-bridge.html", str_replace( $bridge_script[1], "/releases/$release/wordpress-bridge.js", $bridge ) );

// Keep every platform page inert until its own document origin has been checked.
// WordPress distribution templates are content, not platform entry points.
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $public, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
    $relative = substr( $file->getPathname(), strlen( $public ) + 1 );
    if ( ! str_ends_with( $relative, '.html' ) || preg_match( '~^wp-[^/]+/~', $relative ) ) continue;
    $origin = $relative === 'wordpress-bridge.html' ? $wordpress_origin : $app_origin;
    $payload = json_encode( file_get_contents( $file->getPathname() ), JSON_HEX_TAG | JSON_THROW_ON_ERROR );
    $expected = json_encode( $origin, JSON_HEX_TAG | JSON_THROW_ON_ERROR );
    file_put_contents( $file->getPathname(), '<!doctype html><meta charset="utf-8"><body>' .
        '<script type="application/json" id="playground-document">' . $payload . '</script>' .
        '<script>(()=>{if(location.origin!==' . $expected . '){' .
        'const error=new Error("Incorrect Playground ' . ( $relative === 'wordpress-bridge.html' ? 'sandbox' : 'app' ) . ' hostname.");' .
        'document.body.textContent=error.message;console.error(error);return;}' .
        'const html=JSON.parse(document.getElementById("playground-document").textContent);' .
        'document.open();document.write(html);document.close();})();</script>' );
}
copy( $deployment . '/custom-redirects-lib.php', "$private/custom-redirects-lib.php" );
$types = json_decode( file_get_contents( getenv( 'PLAYGROUND_MIME_TYPES' ) ?: $deployment . '/mime-types.json' ), true, 512, JSON_THROW_ON_ERROR );
file_put_contents( "$private/mime-types.php", '<?php $mime_types = ' . var_export( $types, true ) . ';' );
file_put_contents( "$public/release.json", $metadata );

// Retain root asset aliases for existing clients and public SDK URLs. Hashed assets
// are append-only; new clients fetch through the worker's pinned release instead.
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $public, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
    $relative = substr( $file->getPathname(), strlen( $public ) + 1 );
    if ( str_starts_with( $relative, 'assets/' ) ) {
        $target = "$web_root/$relative";
        if ( ! is_dir( dirname( $target ) ) ) mkdir( dirname( $target ), 0755, true );
        if ( ! file_exists( $target ) && ! copy( $file->getPathname(), $target ) ) throw new RuntimeException( 'Cannot publish asset alias.' );
    }
}
// Root-level immutable loaders get root scope without Service-Worker-Allowed.
foreach ( [ 'app', 'sandbox' ] as $role ) {
    file_put_contents( "$web_root/$role-sw-$release.js", "import \"/releases/$release/$role-sw.js\";\n" );
}
copy( $deployment . '/bootstrap.js', "$web_root/bootstrap.js.new" );
rename( "$web_root/bootstrap.js.new", "$web_root/bootstrap.js" );
foreach ( [ 'remote.html', 'api.html', 'wordpress-bridge.html' ] as $entry ) {
    $html = '<!doctype html><meta charset="utf-8"><meta name="playground-entry" content="' . $entry . '"><title>Starting Playground</title><body><script type="module" src="/bootstrap.js"></script></body>';
    file_put_contents( "$web_root/$entry.new", $html );
    rename( "$web_root/$entry.new", "$web_root/$entry" );
}
if ( ! is_dir( "$web_root/__wp__" ) ) mkdir( "$web_root/__wp__", 0755, true );
copy( $deployment . '/__wp__/index.php', "$web_root/__wp__/index.php" );
copy( $deployment . '/public-release-entry.php', "$web_root/custom-redirects.php.new" );
rename( "$web_root/custom-redirects.php.new", "$web_root/custom-redirects.php" );
$selector = '<!doctype html><meta charset="utf-8"><meta name="playground-entry" content="index.html"><title>Starting Playground</title><script id="playground-release" type="application/json">' . $metadata . '</script><body><script type="module" src="/bootstrap.js"></script></body>';
file_put_contents( "$web_root/index.html.new", $selector );
rename( "$web_root/index.html.new", "$web_root/index.html" );
$activated = true;
echo "Activated $release; rollback selector and entry: $backup\n";

PHP

# A stale selector remains coherent because releases and their loaders are retained.
# Purge the edge so new visitors discover the newly selected release immediately.
if [ "${PLAYGROUND_LOCAL_RELEASES:-0}" != 1 ]; then
    curl --fail --silent --show-error --max-time 60 -X POST \
        -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" > /dev/null
    echo 'Edge cache purged'

fi
