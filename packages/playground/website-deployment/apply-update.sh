#!/bin/bash

set -euo pipefail

SITE_PHP="/usr/local/php${PHP_VERSION}/bin/php"
SITE_API_BASE="$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')"

echo Setting up staging directory
cd ~
rm -rf website-update
mkdir website-update

cp -r ~/website-deployment/__wp__ ~/website-update/
cp ~/website-deployment/custom-redirects.php ~/website-update/
cp ~/website-deployment/mime-types.php ~/website-update/

echo Moving updated Playground files into staging directory
mv updated-playground-files website-update/playground-files

# Mirror directory structure from playground files
echo Mirroring website directory structure for nginx
cd ~/website-update/playground-files
find . -type d -exec mkdir -p ../{} \;

function should_serve_file_via_php() {
    local FILE_PATH=$1
    local FILE_NAME=$(basename "$FILE_PATH")

    local PHP="
    	require_once '/srv/htdocs/custom-redirects.php';
	    if ( playground_file_needs_special_treatment('$FILE_NAME') ) {
		// zero is the truthy exit code
		exit(0);
	    } else {
		// non-zero is a falsy exit code
		exit(1);
	    }
    ";

    # Explicitly use the site's declared PHP version.
    # Otherwise, we've seen this defaulting to PHP 7.4 which breaks our custom-redirects script.
    "$SITE_PHP" -r "$PHP"
}

function link_files() {
	while read PLAYGROUND_FILE_PATH; do
	    WEB_PATH=$(echo $PLAYGROUND_FILE_PATH | sed 's#^playground-files/##')

	    if [[ "$WEB_PATH" == "$PLAYGROUND_FILE_PATH" ]]; then
		    echo "Error: Path prefix not removed from $PLAYGROUND_FILE_PATH" 1>&2
		    return -1
	    fi

	    if ! should_serve_file_via_php "$WEB_PATH"; then
		    ln -srf "$PLAYGROUND_FILE_PATH" "$WEB_PATH"
	    else
		echo "  php-served: $WEB_PATH"
	    fi
	done
}

cd ~/website-update
echo Configure which files should be served by Nginx and which by PHP
find playground-files -type f | link_files

echo Syncing staged files to production
rsync -av --delete ~/website-update/* /srv/htdocs/ 2>&1 | tee ~/website-deployment/rsync-log

echo Purging edge cache
curl -sS -X POST -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" \
        > /dev/null \
        && echo "Edge cache purged" \
        || (>&2 echo "Failed to purge edge cache" && false)
echo Done!

