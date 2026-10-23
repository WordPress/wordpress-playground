#!/bin/bash

set -euo pipefail

# Explicitly use the site's declared PHP version.
# Otherwise, we've seen this defaulting to PHP 7.4 which breaks our custom-redirects script.
SITE_PHP="/usr/local/php${PHP_VERSION}/bin/php"
SITE_API_BASE="$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')"

# Keep the complete build out of Nginx's public-file lookup. The installer checks
# both hosts before replacing custom-redirects.php; Personal WP keeps its separate
# deployment script and the existing custom-redirects.php entry.
export SITE_PHP
bash ~/website-deployment/wordpress-frame/install-release.sh \
    ~/updated-playground-files /srv/htdocs ~/website-backups

echo Purging edge cache
curl --fail --silent --show-error --max-time 60 -X POST -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" \
        > /dev/null \
        && echo "Edge cache purged" \
        || (>&2 echo "Failed to purge edge cache" && false)

echo Done!
