#!/bin/bash
set -euo pipefail

# Install one static release for Nginx to serve on both hostnames, or roll back.
#
# The build was made with its asset URLs under /releases/$PLAYGROUND_RELEASE_ID/.
# This script places it in that public directory, keeps its PHP endpoints in a
# private directory, then copies the entry pages to the web root. Nginx serves
# existing files directly; custom-redirects.php handles only missing paths.
# Previous releases stay in place so open tabs can keep loading their own files.
# Steps that need PHP live in apply-update.php, which receives values only as
# arguments.
#
# Install a release. deploy-website.sh passes the origins and release ID used for the build:
#
#   PLAYGROUND_RELEASE_ID=<id> apply-update.sh <app-origin> <wordpress-origin> \
#     [build] [web-root] [backups]
#
# Roll back on the server, undoing the live release's deployment or a named one:
#
#   PLAYGROUND_ROLLBACK=previous website-deployment/apply-update.sh [web-root] [backups]
#   PLAYGROUND_ROLLBACK=<release-id> website-deployment/apply-update.sh
#   PLAYGROUND_PURGE_ONLY=1 website-deployment/apply-update.sh [web-root] [backups]
#
# /release.json names the live and previous releases. A rollback restores the root
# files from the snapshot taken before that deployment and purges the edge cache. It builds,
# uploads, probes and prunes nothing, so it finishes in seconds; the next deployment
# prunes. Paths and platform settings can be supplied to run against a test site.
# Only the PHP lock holder invokes this internal entry point.
LOCK_HELD=0
if [ "${1:-}" = --deployment-lock-held ]; then
    LOCK_HELD=1
    shift
fi
ROLLBACK="${PLAYGROUND_ROLLBACK:-}"
PURGE_ONLY="${PLAYGROUND_PURGE_ONLY:-0}"
if [ -n "$ROLLBACK" ] || [ "$PURGE_ONLY" = 1 ]; then
    WEB_ROOT="${1:-/srv/htdocs}"
    BACKUPS="${2:-$HOME/website-backups}"
else
    APP_ORIGIN="${1:?Expected app origin}"
    WORDPRESS_ORIGIN="${2:?Expected WordPress origin}"
    BUILD="${3:-$HOME/updated-playground-files}"
    WEB_ROOT="${4:-/srv/htdocs}"
    BACKUPS="${5:-$HOME/website-backups}"
    RELEASE_ID="${PLAYGROUND_RELEASE_ID:?Expected PLAYGROUND_RELEASE_ID}"
fi
if [ -n "$ROLLBACK" ] && [ "$PURGE_ONLY" = 1 ]; then
    echo "Choose rollback or purge-only recovery, not both." >&2
    exit 1
fi
RETENTION_DAYS="${PLAYGROUND_RELEASE_RETENTION_DAYS:-30}"
# Local preview and test installs skip the WP Cloud probes and edge purge.
LOCAL="${PLAYGROUND_LOCAL_RELEASES:-0}"
DEPLOYMENT="$(cd "$(dirname "$0")" && pwd)"
# Explicitly use the site's declared PHP version. The SSH default has been 7.4,
# which cannot run this handler. Tests may supply their installed PHP binary.
SITE_PHP="${SITE_PHP:-/usr/local/php${PHP_VERSION:?Expected PHP_VERSION or SITE_PHP}/bin/php}"
if [ "$LOCAL" != 1 ]; then
    # Check purge credentials before installing or restoring any root files.
    : "${ATOMIC_SITE_API_KEY:?Expected ATOMIC_SITE_API_KEY}"
    : "${ATOMIC_SITE_ID:?Expected ATOMIC_SITE_ID}"
    SITE_API_BASE="${SITE_API_BASE:-$( "$SITE_PHP" -r 'require "/scripts/env.php"; echo SITE_API_BASE;')}"
    : "${SITE_API_BASE:?Expected SITE_API_BASE}"
fi
if [ "$LOCK_HELD" = 0 ]; then
    # WP Cloud's web bootstrap filters HOME and other environment variables.
    # The lock coordinator needs the original shell environment for its child.
    exec "$SITE_PHP" -d auto_prepend_file= "$DEPLOYMENT/apply-update.php" with-lock \
        "$WEB_ROOT" "$DEPLOYMENT/apply-update.sh" "$@"
fi
PENDING_PURGE="$BACKUPS/pending-edge-purge"

# Purge the edge cache for the recorded hostnames. Do not report
# a complete deployment or rollback while old edge responses remain cached.
# A purge without a domain clears only the site's primary domain, so name each host.
purge_edge() {
    [ "$LOCAL" != 1 ] || return 0
    if [ "$#" -eq 0 ]; then
        echo "No hostnames to purge." >&2
        return 1
    fi
    for host in "$@"; do
        request_edge_purge "$host"
    done
    echo "Edge cache purged for $*"
}

request_edge_purge() {
    local host="$1"
    shift
    curl --fail --silent --show-error --max-time 60 -X POST \
        -H "Auth: $ATOMIC_SITE_API_KEY" "$@" \
        "$SITE_API_BASE/edge-cache/$ATOMIC_SITE_ID/purge/$host" > /dev/null
}

verify_release_at_edge() {
    [ "$LOCAL" != 1 ] || return 0
    local origin="$1" host file path status started
    shift
    local -a missing=() purge_args=()
    for file in "$@"; do
        path="/releases/$RELEASE_ID/$file"
        if [ ! -f "$PUBLIC/$file" ]; then
            echo "Refusing activation: the published release is missing $path." >&2
            return 1
        fi
        status="$(release_asset_status "$origin$path")"
        case "$status" in
            200) ;;
            404)
                missing+=("$path")
                purge_args+=(--data-urlencode "purge_uris[]=$path")
                ;;
            *)
                echo "Refusing activation: $origin$path returned $status, expected 200." >&2
                return 1
                ;;
        esac
    done
    [ "${#missing[@]}" -gt 0 ] || return 0

    # Only purge new release URLs. Root files still point to the previous release.
    echo "Purging cached 404s for $origin: ${missing[*]}"
    # shellcheck disable=SC2016 # PHP reads its own argument list.
    host="$("$SITE_PHP" -r 'echo parse_url( $argv[1], PHP_URL_HOST );' "$origin")"
    request_edge_purge "$host" "${purge_args[@]}"
    started=$SECONDS
    for path in "${missing[@]}"; do
        while :; do
            status="$(release_asset_status "$origin$path")"
            [ "$status" != 200 ] || break
            if [ "$status" != 404 ] || [ $((SECONDS - started)) -ge 60 ]; then
                echo "Refusing activation: $origin$path returned $status after its edge purge." >&2
                return 1
            fi
            sleep 2
        done
    done
}

release_asset_status() {
    curl --silent --show-error --max-time 15 --output /dev/null \
        --write-out '%{http_code}' "$1"
}

prepare_edge_purge() {
    [ "$LOCAL" != 1 ] || return 0
    local hosts
    hosts="$("$SITE_PHP" "$DEPLOYMENT/apply-update.php" prepare-purge "$WEB_ROOT" "$BACKUPS" "$@")"
    if [ -z "$hosts" ]; then
        echo "No hostnames to purge." >&2
        return 1
    fi
}

finish_edge_purge() {
    [ "$LOCAL" != 1 ] || return 0
    local hosts
    hosts="$(cat "$PENDING_PURGE")"
    # shellcheck disable=SC2086 # One hostname per line.
    purge_edge $hosts
    rm "$PENDING_PURGE"
}

if [ "$PURGE_ONLY" = 1 ]; then
    if [ -e "$PENDING_PURGE" ]; then
        finish_edge_purge
    else
        echo "No pending edge purge."
    fi
    exit 0
fi
if [ -e "$PENDING_PURGE" ]; then
    echo "An edge purge is pending. Run PLAYGROUND_PURGE_ONLY=1 website-deployment/apply-update.sh with the same paths before continuing." >&2
    exit 1
fi

if [ -n "$ROLLBACK" ]; then
    # Read the current hostnames before rollback: snapshots of the old root-only
    # layout have no release.json to name the hosts whose edge caches need purging.
    prepare_edge_purge "$ROLLBACK"
    status=0
    "$SITE_PHP" "$DEPLOYMENT/apply-update.php" rollback "$WEB_ROOT" "$BACKUPS" "$ROLLBACK" || status=$?
    finish_edge_purge
    exit "$status"
fi

# Reject bad origins and release IDs before touching the web root.
"$SITE_PHP" "$DEPLOYMENT/apply-update.php" check-origins \
    "$APP_ORIGIN" "$WORDPRESS_ORIGIN" "$RELEASE_ID" "$LOCAL"

# A partial upload, or a build made for another release path, must not go live.
for file in index.html api.html remote.html wordpress-popup.html wordpress-bridge.html sw.js; do
    test -s "$BUILD/$file"
done
if ! grep -qF "/releases/$RELEASE_ID/" "$BUILD/index.html"; then
    echo "Refusing deployment: the build does not use /releases/$RELEASE_ID/." >&2
    exit 1
fi
# Every page must stop itself on the wrong origin, and links must stay in the build.
"$SITE_PHP" "$DEPLOYMENT/apply-update.php" check-build \
    "$BUILD" "$APP_ORIGIN" "$WORDPRESS_ORIGIN"

PROBE=''
HIDDEN_PROBE=''
trap 'rm -f "$PROBE" "$HIDDEN_PROBE"' EXIT
if [ "$LOCAL" != 1 ]; then
    # Nginx must block these private PHP files so requests cannot bypass the app's checks.
    # Require the same protection for encoded path variants.
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

# Stage in the private directory, whose Nginx denial the probes verified, until
# the release is complete. PHP endpoints remain there until moved below.
mkdir -p "$WEB_ROOT/releases" "$WEB_ROOT/.playground-releases" "$BACKUPS"
PUBLIC="$WEB_ROOT/releases/$RELEASE_ID"
PRIVATE="$WEB_ROOT/.playground-releases/$RELEASE_ID"
STAGING="$WEB_ROOT/.playground-releases/.staging-$RELEASE_ID"
if [ -e "$PUBLIC" ] || [ -e "$PRIVATE" ] || [ -e "$STAGING" ]; then
    echo "Refusing deployment: release $RELEASE_ID already exists." >&2
    exit 1
fi
mkdir -p "$PRIVATE/files"
# Record the release before anything can fail, so retention also removes an
# upload that never activates. Activation replaces this with its full record.
printf '{"release":"%s"}\n' "$RELEASE_ID" > "$PRIVATE/release.json"
mv "$BUILD" "$STAGING"
cp "$DEPLOYMENT/custom-redirects-lib.php" "$PRIVATE/"
# Move PHP endpoints out of the public release and write its private request entry.
# The build validates WordPress static documents before upload.
"$SITE_PHP" "$DEPLOYMENT/apply-update.php" write-private-files \
    "$STAGING" "$PRIVATE" "$RELEASE_ID" "$WORDPRESS_ORIGIN" "$APP_ORIGIN" \
    "${PLAYGROUND_MIME_TYPES:-$DEPLOYMENT/mime-types.json}"
for file in "$PRIVATE/"*.php; do
    "$SITE_PHP" -l "$file"
done
mv "$STAGING" "$PUBLIC"
verify_release_at_edge "$APP_ORIGIN" sw.js remote.html
verify_release_at_edge "$WORDPRESS_ORIGIN" sw.js wordpress-bridge.html

# Replace the root entry files. release.json records both origins for later purges.
prepare_edge_purge "" "$APP_ORIGIN" "$WORDPRESS_ORIGIN"
status=0
"$SITE_PHP" "$DEPLOYMENT/apply-update.php" activate \
    "$WEB_ROOT" "$BACKUPS" "$RELEASE_ID" "$RETENTION_DAYS" "$APP_ORIGIN" "$WORDPRESS_ORIGIN" || status=$?
finish_edge_purge
[ "$status" -eq 0 ] || exit "$status"

# Prune only after the activation's edge purge, so a cleanup failure cannot leave
# stale entry responses cached; it is still reported as a deployment error.
"$SITE_PHP" "$DEPLOYMENT/apply-update.php" prune "$WEB_ROOT" "$BACKUPS" "$RETENTION_DAYS"
