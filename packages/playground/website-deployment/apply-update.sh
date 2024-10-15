#!/bin/bash

set -euo pipefail

# Explicitly use the site's declared PHP version.
# Otherwise, we've seen this defaulting to PHP 7.4 which breaks our custom-redirects script.
SITE_PHP="/usr/local/php${PHP_VERSION}/bin/php"
SITE_API_BASE="$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')"

echo Setting up staging directory
cd ~
rm -rf website-update

echo Moving updated Playground files to staging directory
mv updated-playground-files website-update
mkdir website-update/static-files-to-serve-via-php

echo Copy supporting files for WP Cloud
cp -r ~/website-deployment/__wp__ ~/website-update/
cp ~/website-deployment/custom-redirects-lib.php ~/website-update/
cp ~/website-deployment/custom-redirects.php ~/website-update/
cp ~/website-deployment/cors-proxy-config.php ~/website-update/

# Generate mime-types.php from mime-types.json in case the PHP can be opcached
echo Generating mime-types.php
cat ~/website-deployment/mime-types.json | "$SITE_PHP" -r '
    $raw_json = file_get_contents( "php://stdin" );
    if ( false === $raw_json ) {
        fprintf( STDERR, "Unable to read MIME type JSON\n" );
        die( -1 );
    }
    $types = json_decode( $raw_json, JSON_OBJECT_AS_ARRAY );
    if ( null === $types ) {
        fprintf( STDERR, "Unable to decode MIME type JSON\n" );
        die( -1 );
    }

    echo "<?php\n";
    echo "\$mime_types = array(\n";
    foreach ( $types as $extension => $mime_type ) {
        echo "  \"$extension\" => \"$mime_type\",\n";
    }
    echo ");\n";
' > ~/website-deployment/mime-types.php

echo Checking mime-types.php
(
    cd ~/website-deployment
    "$SITE_PHP" -r '
        require( "mime-types.php" );
        if (
            $mime_types["_default"] !== "application/octet-stream" ||
            $mime_types["html"] !== "text/html" ||
            $mime_types["jpeg"] !== "image/jpeg"
        ) {
            fprintf( STDERR, "mime-types.php looks broken\n" );
            die( -1 );
        }
    '
)
echo Adding mime-types.php to updated website files
cp ~/website-deployment/mime-types.php ~/website-update/

function match_static_files_to_serve_via_php() (
    cd ~/website-deployment

    "$SITE_PHP" -r '
    require "custom-redirects-lib.php";
    while ( $path = fgets( STDIN ) ) {
        $path = trim( $path );
        if ( playground_is_static_file_needing_special_treatment($path) ) {
            echo "$path\n";
        }
    }
    '
)

function set_aside_static_files_to_serve_via_php() {
    while read FILE_TO_SERVE_VIA_PHP; do
        echo "  php-served: $FILE_TO_SERVE_VIA_PHP"
        TARGET_DIR="static-files-to-serve-via-php/$(dirname "$FILE_TO_SERVE_VIA_PHP")"
        mkdir -p "$TARGET_DIR"
        mv "$FILE_TO_SERVE_VIA_PHP" "$TARGET_DIR/"
    done
}

echo Configure which files should be served by Nginx and which by PHP
cd ~/website-update
find -type f |
    grep -v static-files-to-serve-via-php |   # avoid files that are moved as part of this pipeline
    sed 's#^\.##' |                    # filter '.' from './' so paths are like request URIs
    match_static_files_to_serve_via_php |
    sed 's#^/##' |                     # remove the leading '/' to get paths relative to current dir
    set_aside_static_files_to_serve_via_php

echo Syncing staged files to production
rsync -av --delete --no-perms --omit-dir-times ~/website-update/ /srv/htdocs/

echo Purging edge cache
curl -sS -X POST -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" \
        > /dev/null \
        && echo "Edge cache purged" \
        || (>&2 echo "Failed to purge edge cache" && false)

echo Applying latest CORS proxy rate-limiting schema
# NOTE: This will reset rate-limiting token buckets, but that should be tolerable
# as long as we're generally discouraging abuse of the proxy.
cat ~/website-deployment/cors-proxy-rate-limiting-table.sql | mysql --database="$DB_NAME"

echo Done!
