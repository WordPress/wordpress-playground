#!/bin/bash
set -euo pipefail

# Build one static release and install it on a WP Cloud site over SSH.
#
# The deploy workflow and staging tests both run this script, so a staging test
# exercises the production deployment path. Run it from the repository root:
#
#   packages/playground/website-deployment/deploy-website.sh \
#     <user@host> <app-origin> <wordpress-origin>
#
# Optional environment:
#   PLAYGROUND_RELEASE_ID    Release ID; defaults to <UTC time>-<commit>.
#   PLAYGROUND_SKIP_BUILD=1  Upload the existing dist/packages/playground/wasm-wordpress-net,
#                            which must have been built for this release and these origins.
#   PLAYGROUND_ROLLBACK_BACKUP, PLAYGROUND_RELEASE_RETENTION_DAYS
#                            Passed to apply-update.sh. A rollback skips building and
#                            uploading the website.
#   DEPLOY_SSH_COMMAND       SSH command for ssh and rsync; defaults to "ssh".
#   CORS_PROXY_URL, VITE_GOOGLE_ANALYTICS_ID
#                            Passed to the build, as the workflow sets them.
TARGET="${1:?Expected the SSH target, such as user@host}"
APP_ORIGIN="${2:?Expected app origin}"
WORDPRESS_ORIGIN="${3:?Expected WordPress origin}"
RELEASE_ID="${PLAYGROUND_RELEASE_ID:-$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)}"
ROLLBACK="${PLAYGROUND_ROLLBACK_BACKUP:-}"
SSH="${DEPLOY_SSH_COMMAND:-ssh}"
BUILD=dist/packages/playground/wasm-wordpress-net
DEPLOYMENT=packages/playground/website-deployment

# The release ID becomes part of URLs and remote paths; apply-update.php applies
# the same rule. Check it before building for it.
if ! [[ "$RELEASE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    echo "Invalid release ID: $RELEASE_ID" >&2
    exit 1
fi
echo "Release: $RELEASE_ID"

if [ -z "$ROLLBACK" ]; then
    if [ "${PLAYGROUND_SKIP_BUILD:-0}" != 1 ]; then
        # Do not restore bundles built with a different WordPress origin or release.
        PLAYGROUND_RELEASE_ID="$RELEASE_ID" \
            VITE_PLAYGROUND_APP_ORIGIN="$APP_ORIGIN" \
            VITE_WORDPRESS_SITE_URL="$WORDPRESS_ORIGIN" \
            npx nx build playground-website --skip-nx-cache
    fi
    rsync -az -e "$SSH" --delete "$BUILD/" "$TARGET:~/updated-playground-files"
fi

# Host-specific deployment scripts and server config, plus the MIME map the PHP
# handler uses for files it serves.
rsync -az -e "$SSH" --delete "$DEPLOYMENT/" "$TARGET:~/website-deployment"
rsync -az -e "$SSH" packages/php-wasm/universal/src/lib/mime-types.json \
    "$TARGET:~/website-deployment/mime-types.json"

# Quote every value for the remote shell, which starts in the SSH user's home directory.
remote_command="PLAYGROUND_RELEASE_ID=$(printf %q "$RELEASE_ID")"
for name in PLAYGROUND_ROLLBACK_BACKUP PLAYGROUND_RELEASE_RETENTION_DAYS; do
    if [ -n "${!name:-}" ]; then
        remote_command+=" $name=$(printf %q "${!name}")"
    fi
done
remote_command+=" website-deployment/apply-update.sh $(printf %q "$APP_ORIGIN") $(printf %q "$WORDPRESS_ORIGIN")"
# A terminal gives the remote shell the same environment as the workflow's SSH step.
# shellcheck disable=SC2086 # DEPLOY_SSH_COMMAND may include options.
$SSH -tt -C "$TARGET" "$remote_command"
