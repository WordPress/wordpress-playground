#!/bin/bash

# Publishes a refreshed mirror of the WordPress/blueprints repository to
# /srv/htdocs/blueprints/ without redeploying the rest of the website.
#
# The full website deployment (apply-update.sh) also ships the mirror as part
# of the build, so this script only exists to refresh it in between deploys.
# It expects the new mirror in ~/updated-blueprints-mirror, as uploaded by the
# "Refresh Blueprints mirror" GitHub workflow.

set -euo pipefail

# Explicitly use the site's declared PHP version, like apply-update.sh does.
SITE_PHP="/usr/local/php${PHP_VERSION}/bin/php"
SITE_API_BASE="$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')"

if [ ! -f ~/updated-blueprints-mirror/index.json ]; then
    >&2 echo "~/updated-blueprints-mirror/index.json is missing; refusing to publish an incomplete mirror"
    exit 1
fi

# custom-redirects-lib.php adds CORS headers to /blueprints/, so the files must
# live where Nginx cannot find them and delegates to PHP instead. apply-update.sh
# sets them aside the same way for full website deployments.
MIRROR_DIR=/srv/htdocs/static-files-to-serve-via-php/blueprints

echo Syncing Blueprints mirror to production
mkdir -p "$MIRROR_DIR"
rsync -av --delete --no-perms --omit-dir-times ~/updated-blueprints-mirror/ "$MIRROR_DIR/"

# A copy served directly by Nginx would shadow the PHP-served one without CORS headers.
rm -rf /srv/htdocs/blueprints

echo Purging edge cache
curl -sS --fail -X POST -H "Auth: $ATOMIC_SITE_API_KEY" "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge" \
        > /dev/null \
        && echo "Edge cache purged" \
        || (>&2 echo "Failed to purge edge cache" && false)

echo Done!
