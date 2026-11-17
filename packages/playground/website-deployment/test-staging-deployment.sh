#!/bin/bash
set -euo pipefail

# Rehearse website deployments on a disposable WP Cloud staging site.
#
# This overwrites the site's web root, purges its edge cache, and expires a release
# early, so never point it at production. Run it from the repository root:
#
#   PLAYGROUND_STAGING_CONFIRM=<user@host> \
#     packages/playground/website-deployment/test-staging-deployment.sh \
#     <user@host> <app-origin> <wordpress-origin>
#
# Both origins must be HTTPS hostnames mapped to the same site, as for production.
# Optional environment:
#   PLAYGROUND_STAGING_FROM_TRUNK=1  First deploy origin/trunk with its own installer,
#                                    to rehearse the transition production will make.
#   PLAYGROUND_STAGING_BROWSER=1     With PLAYGROUND_STAGING_FROM_TRUNK=1, finish by running
#                                    test-staging-upgrade.mjs: browser sessions that stay
#                                    open while the site upgrades from trunk.
#   PLAYGROUND_STAGING_FIREFOX_CHANNEL  Optional Playwright Firefox channel, e.g. moz-firefox.
#   DEPLOY_SSH_COMMAND               SSH command for ssh and rsync; defaults to "ssh".
#   CORS_PROXY_URL                   Passed to the builds.
#
# Steps: deploy release A, deploy release B, roll back to A, refuse a broken
# upload, then expire B early. After a trunk deployment, finish by rolling back to
# it. check-deployment.sh verifies each active release. The script ends with the
# browser checks that remain manual.
TARGET="${1:?Expected the SSH target, such as user@host}"
APP_ORIGIN="${2:?Expected app origin}"
WORDPRESS_ORIGIN="${3:?Expected WordPress origin}"
SSH="${DEPLOY_SSH_COMMAND:-ssh}"
WEB_ROOT=/srv/htdocs
DEPLOYMENT=packages/playground/website-deployment

if [ "${PLAYGROUND_STAGING_CONFIRM:-}" != "$TARGET" ]; then
    echo "Set PLAYGROUND_STAGING_CONFIRM=$TARGET to confirm this site may be overwritten." >&2
    exit 1
fi
for origin in "$APP_ORIGIN" "$WORDPRESS_ORIGIN"; do
    case "$origin" in
        https://playground.wordpress.net | https://wpsandbox.wordpress.net | https://my.wordpress.net)
            echo "Refusing to run a staging test against production: $origin" >&2
            exit 1
            ;;
    esac
done

step() { printf '\n=== %s\n' "$1"; }

# Run a command and report its description as passed, or stop the test.
check() {
    local description="$1"
    shift
    if "$@"; then
        echo "PASS  $description"
    else
        echo "FAIL  $description" >&2
        exit 1
    fi
}

# Run a command on the staging host. The terminal gives it the same environment
# (PHP_VERSION, WP Cloud settings) as the deployment's own SSH step.
remote() {
    # shellcheck disable=SC2086 # DEPLOY_SSH_COMMAND may include options.
    $SSH -tt "$TARGET" "$1" | tr -d '\r'
}

# Run the site's PHP, passing each argument quoted. Paths are relative to the
# SSH user's home directory, where the deployment files live.
remote_php() {
    # shellcheck disable=SC2016 # PHP_VERSION expands on the staging host.
    local command='"/usr/local/php${PHP_VERSION}/bin/php"'
    for argument in "$@"; do
        command+=" $(printf %q "$argument")"
    done
    remote "$command"
}

active_release() {
    curl --silent --show-error --max-time 30 "$APP_ORIGIN/release.json" |
        node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).release))'
}

stamp="$(date -u +%Y%m%d-%H%M%S)"
commit="$(git rev-parse --short=12 HEAD)"
RELEASE_A="staging-$stamp-a-$commit"
RELEASE_B="staging-$stamp-b-$commit"
REFUSED="staging-$stamp-refused-$commit"

step "Web root before the test"
remote "ls -la $WEB_ROOT"

if [ "${PLAYGROUND_STAGING_FROM_TRUNK:-0}" = 1 ]; then
    step "Deploy origin/trunk with its own installer"
    git fetch --quiet origin trunk
    trunk="$(mktemp -d)"
    trap 'git worktree remove --force "$trunk" >/dev/null 2>&1 || true' EXIT
    git worktree add --quiet --detach "$trunk" origin/trunk
    (
        cd "$trunk"
        npm ci
        npm run sync:php-next
        PLAYGROUND_APP_ORIGIN="$APP_ORIGIN" VITE_WORDPRESS_SITE_URL="$WORDPRESS_ORIGIN" \
            npx nx build playground-website --skip-nx-cache
        rsync -az -e "$SSH" --delete dist/packages/playground/wasm-wordpress-net/ "$TARGET:~/updated-playground-files"
        rsync -az -e "$SSH" --delete packages/playground/website-deployment/ "$TARGET:~/website-deployment"
        rsync -az -e "$SSH" packages/php-wasm/universal/src/lib/mime-types.json "$TARGET:~/website-deployment/mime-types.json"
    )
    remote "website-deployment/apply-update.sh $(printf %q "$APP_ORIGIN") $(printf %q "$WORDPRESS_ORIGIN")"
    step "Web root after the trunk deployment"
    remote "ls -la $WEB_ROOT"
fi

npm run sync:php-next

step "Deploy release A: $RELEASE_A"
PLAYGROUND_RELEASE_ID="$RELEASE_A" "$DEPLOYMENT/deploy-website.sh" "$TARGET" "$APP_ORIGIN" "$WORDPRESS_ORIGIN"
"$DEPLOYMENT/check-deployment.sh" "$APP_ORIGIN" "$WORDPRESS_ORIGIN" "$RELEASE_A"

step "Deploy release B: $RELEASE_B"
PLAYGROUND_RELEASE_ID="$RELEASE_B" "$DEPLOYMENT/deploy-website.sh" "$TARGET" "$APP_ORIGIN" "$WORDPRESS_ORIGIN"
"$DEPLOYMENT/check-deployment.sh" "$APP_ORIGIN" "$WORDPRESS_ORIGIN" "$RELEASE_B"
release_a_worker() {
    [ "$(curl --silent --output /dev/null --write-out '%{http_code}' "$APP_ORIGIN/releases/$RELEASE_A/sw.js")" = 200 ]
}
check "release A's files remain for open tabs" release_a_worker

step "Roll back to release A"
# Rollback uses the installer already on the server: no build, upload or origins.
time remote "PLAYGROUND_ROLLBACK=previous website-deployment/apply-update.sh"
"$DEPLOYMENT/check-deployment.sh" "$APP_ORIGIN" "$WORDPRESS_ORIGIN" "$RELEASE_A"

step "Refuse a broken upload"
broken="$(mktemp -d)"
echo 'An incomplete upload without entry pages.' > "$broken/README.md"
rsync -az -e "$SSH" --delete "$broken/" "$TARGET:~/updated-playground-files"
rm -r "$broken"
install_broken_upload() {
    ! remote "PLAYGROUND_RELEASE_ID=$REFUSED website-deployment/apply-update.sh $(printf %q "$APP_ORIGIN") $(printf %q "$WORDPRESS_ORIGIN")"
}
release_a_active() { [ "$(active_release)" = "$RELEASE_A" ]; }
check "the installer refuses an upload without entry pages" install_broken_upload
check "release A is still active" release_a_active
check "the refused release left no files" \
    remote "test ! -e $WEB_ROOT/.playground-releases/$REFUSED && test ! -e $WEB_ROOT/releases/$REFUSED"

step "Expire release B early"
# shellcheck disable=SC2016 # PHP code, not shell.
remote_php -r '
    $file = $argv[1];
    $metadata = json_decode( file_get_contents( $file ), true, 512, JSON_THROW_ON_ERROR );
    $metadata["inactiveSince"] = 1;
    file_put_contents( $file, json_encode( $metadata ) . "\n" );
' "$WEB_ROOT/.playground-releases/$RELEASE_B/release.json"
# The installer prunes after each activation; run that step directly.
remote_php website-deployment/apply-update.php prune "$WEB_ROOT" website-backups 30
check "expired release B was removed" \
    remote "test ! -e $WEB_ROOT/releases/$RELEASE_B && test ! -e $WEB_ROOT/.playground-releases/$RELEASE_B"
check "active release A was kept" remote "test -d $WEB_ROOT/releases/$RELEASE_A"

if [ "${PLAYGROUND_STAGING_FROM_TRUNK:-0}" = 1 ]; then
    # Before release A came the trunk layout, so "previous" now restores it.
    step "Roll back to trunk with a failed edge purge, then recover"
    # A refused local TLS connection fails before sending the purge credentials.
    rollback_with_failed_purge() {
        ! remote "SITE_API_BASE=https://127.0.0.1:1 PLAYGROUND_ROLLBACK=previous website-deployment/apply-update.sh"
    }
    check "rollback reports the failed edge purge" rollback_with_failed_purge
    check "rollback restored trunk before the purge failed" remote "test ! -f $WEB_ROOT/release.json"
    check "the failed purge kept its hostnames" remote "test -s website-backups/pending-edge-purge"
    remote "PLAYGROUND_PURGE_ONLY=1 website-deployment/apply-update.sh"
    check "purge retry removed its pending record" remote "test ! -e website-backups/pending-edge-purge"
    status_of() { curl --silent --output /dev/null --write-out '%{http_code}' "$1"; }
    # The edge can serve the removed /release.json briefly after the purge.
    trunk_restored() {
        local started=$SECONDS
        until [ "$(status_of "$APP_ORIGIN/release.json")" = 404 ]; do
            [ $((SECONDS - started)) -lt 300 ] || return 1
            sleep 2
        done
        [ "$(status_of "$APP_ORIGIN/")" = 200 ]
    }
    check "the trunk layout serves the app without release.json" trunk_restored
    ACTIVE="the trunk layout"
else
    ACTIVE="release A ($RELEASE_A)"
fi

step "Web root after the test"
remote "ls -la $WEB_ROOT"

if [ "${PLAYGROUND_STAGING_BROWSER:-0}" = 1 ] && [ "${PLAYGROUND_STAGING_FROM_TRUNK:-0}" = 1 ]; then
    step "Browser sessions across deployments"
    node "$DEPLOYMENT/test-staging-upgrade.mjs" "$TARGET" "$APP_ORIGIN" "$WORDPRESS_ORIGIN"
    ACTIVE="the trunk layout"
fi

cat <<EOF

All scripted checks passed. The site now runs $ACTIVE.
Check in a browser before production:
  - $APP_ORIGIN/ boots a site, saves it, reloads it, and opens wp-admin.
  - $APP_ORIGIN/releases/$RELEASE_A/remote.html stops with "cannot run at this address".
  - A tab opened before a deployment keeps working after the next one.
EOF
