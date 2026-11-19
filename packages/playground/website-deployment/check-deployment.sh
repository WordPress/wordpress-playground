#!/bin/bash
set -euo pipefail

# Check a deployed release over HTTP, without changing anything on the server.
#
# Safe to run against production. Run it from the repository root:
#
#   packages/playground/website-deployment/check-deployment.sh \
#     <app-origin> <wordpress-origin> [expected-release-id]
#
# Sample asset names (PHP runtime, WordPress archive, CSS, SVG) come from the local
# dist/packages/playground/wasm-wordpress-net when it was built for the deployed
# release; otherwise those checks are skipped. With an expected release, it first
# waits up to PLAYGROUND_CHECK_WAIT seconds (default 300) for the edge to serve it.
# Prints PASS, FAIL, SKIP and INFO lines and exits non-zero if any check fails.
APP="${1:?Expected app origin}"
WORDPRESS="${2:?Expected WordPress origin}"
EXPECTED_RELEASE="${3:-}"
BUILD="${PLAYGROUND_CHECK_BUILD:-dist/packages/playground/wasm-wordpress-net}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FAILURES=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILURES=$((FAILURES + 1)); }
skip() { echo "SKIP  $1"; }
info() { echo "INFO  $1"; }

# Fetch a URL into $WORK/body and $WORK/headers and set STATUS. Extra arguments go to curl.
request() {
    local url="$1"
    shift
    STATUS="$(curl --silent --show-error --max-time 60 --path-as-is \
        --dump-header "$WORK/headers" --output "$WORK/body" \
        --write-out '%{http_code}' "$@" "$url")" || STATUS=000
}

# Print a response header's value, or nothing when it is absent.
header() {
    grep -i "^$1:" "$WORK/headers" | tail -n 1 | cut -d: -f2- | sed 's/^ *//' | tr -d '\r' || true
}

expect_status() {
    local expected="$1" label="$2"
    if [ "$STATUS" = "$expected" ]; then pass "$label: HTTP $STATUS"; else fail "$label: HTTP $STATUS, expected $expected"; fi
}

# Nginx static responses carry an ETag; the PHP handler does not send one.
expect_static() {
    if [ -n "$(header etag)" ]; then pass "$1: served directly by Nginx"; else fail "$1: no ETag, so PHP probably served it"; fi
}

expect_type() {
    local type
    type="$(header content-type)"
    if [[ "$type" =~ $1 ]]; then pass "$2: Content-Type $type"; else fail "$2: Content-Type '$type', expected $1"; fi
}

expect_body() {
    if grep -qF -- "$1" "$WORK/body"; then pass "$2"; else fail "$2: response lacks $1"; fi
}

report_caching() {
    info "$1: Cache-Control='$(header cache-control)' Age='$(header age)' edge='$(header x-ac)'"
}

# The edge cache purge returns before every edge node drops its old copies, so
# root files can name the previous release for a short time after a deployment.
if [ -n "$EXPECTED_RELEASE" ]; then
    worker_base="\"/releases/$EXPECTED_RELEASE/\""
    started=$SECONDS
    until curl --silent --max-time 30 "$APP/release.json" | grep -qF "\"release\":\"$EXPECTED_RELEASE\"" &&
        curl --fail --silent --max-time 30 "$APP/sw.js" -o "$WORK/worker" && grep -qF "$worker_base" "$WORK/worker" &&
        curl --fail --silent --max-time 30 "$WORDPRESS/sw.js" -o "$WORK/worker" && grep -qF "$worker_base" "$WORK/worker"; do
        if [ $((SECONDS - started)) -ge "${PLAYGROUND_CHECK_WAIT:-300}" ]; then
            break
        fi
        sleep 2
    done
    info "Waited $((SECONDS - started))s for the edge to serve $EXPECTED_RELEASE's root files"
fi

# The active release, as recorded by the installer.
request "$APP/release.json"
expect_status 200 "app /release.json"
RELEASE="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).release)' "$WORK/body" 2>/dev/null || true)"
if [ -z "$RELEASE" ]; then
    fail "app /release.json names no release"
    echo "$FAILURES check(s) failed."
    exit 1
fi
info "Active release: $RELEASE"
if [ -n "$EXPECTED_RELEASE" ] && [ "$RELEASE" != "$EXPECTED_RELEASE" ]; then
    fail "active release is $RELEASE, expected $EXPECTED_RELEASE"
fi
BASE="/releases/$RELEASE"

# Both hosts load the active release's worker at /sw.js. Nginx lets
# the edge cache it for a year, so this also shows the deployment purged both hosts.
for host in "$APP" "$WORDPRESS"; do
    request "$host/sw.js"
    expect_status 200 "$host/sw.js"
    cp "$WORK/body" "$WORK/root-worker"
    report_caching "$host/sw.js"
    request "$host$BASE/sw.js"
    expect_status 200 "$host$BASE/sw.js"
    expect_type 'javascript' "$host$BASE/sw.js"
    expect_static "$host$BASE/sw.js"
    if cmp -s "$WORK/root-worker" "$WORK/body"; then pass "$host/sw.js matches the active worker"; else fail "$host/sw.js differs from the active worker"; fi
done

# App entry pages. Pages needing no-store stay PHP-served; others are root copies.
request "$APP/remote.html"
expect_status 200 "app /remote.html"
expect_type '^text/html' "app /remote.html"
expect_static "app /remote.html"
expect_body "location.origin!==\"$APP\"" "app /remote.html checks its origin"
report_caching "app /remote.html"
for path in / /api.html; do
    request "$APP$path"
    expect_status 200 "app $path"
    if [[ "$(header cache-control)" == *no-store* ]]; then pass "app $path: no-store"; else fail "app $path: Cache-Control '$(header cache-control)', expected no-store"; fi
done

# The WordPress host runs no app handler. Root copies of app pages exist there,
# but each stops itself because it names the app origin.
for path in / /api.html; do
    request "$WORDPRESS$path"
    expect_status 404 "WordPress host $path"
done
request "$WORDPRESS/remote.html"
expect_body "location.origin!==\"$APP\"" "WordPress host /remote.html stops itself (checks for the app origin)"

# The WordPress bridge is framed by the app, so frame-blocking headers would break it.
for path in "$BASE/wordpress-bridge.html" /wordpress-bridge.html; do
    request "$WORDPRESS$path"
    expect_status 200 "WordPress host $path"
    expect_body "location.origin!==\"$WORDPRESS\"" "WordPress host $path checks for the WordPress origin"
    if [ -z "$(header x-frame-options)" ]; then pass "$path: no X-Frame-Options"; else fail "$path: X-Frame-Options '$(header x-frame-options)'"; fi
    if [[ "$(header content-security-policy)" != *frame-ancestors* ]]; then pass "$path: no CSP frame-ancestors"; else fail "$path: CSP '$(header content-security-policy)'"; fi
done

# Scoped top-level navigations: the WordPress host sends them to the app's wrapper.
request "$WORDPRESS/scope:deployment-check/wp-admin/" -H 'Sec-Fetch-Dest: document'
expect_status 302 "WordPress host scoped navigation"
if [ "$(header location)" = "$APP/scope:deployment-check/wp-admin/" ]; then pass "scoped navigation redirects to the app"; else fail "scoped navigation Location '$(header location)'"; fi
request "$APP/scope:deployment-check/wp-admin/" -H 'Sec-Fetch-Dest: document'
expect_status 200 "app scoped navigation serves the WordPress wrapper"

# Private files stay private on both hosts.
for host in "$APP" "$WORDPRESS"; do
    # WP Cloud's Nginx answers 403; apply-update.sh's own probes require that.
    request "$host/.playground-releases/$RELEASE/release.json"
    if [ "$STATUS" = 403 ] || [ "$STATUS" = 404 ]; then pass "$host private release metadata: HTTP $STATUS"; else fail "$host private release metadata: HTTP $STATUS"; fi
    request "$host$BASE/logger.php"
    expect_status 404 "$host$BASE/logger.php (endpoints are not public)"
done
# logger.php sends app error reports using server credentials. The WordPress host
# must not run app endpoints; this host rule does not authenticate logger requests.
request "$WORDPRESS/logger.php"
expect_status 404 "WordPress host /logger.php"

request "$APP/.well-known/mcp.json"
expect_status 200 "app /.well-known/mcp.json"
expect_type 'json' "app /.well-known/mcp.json"

# Sample release files for MIME types and byte ranges, named by the local build.
if ! grep -qF "$BASE/" "$BUILD/index.html" 2>/dev/null; then
    skip "MIME and range samples: $BUILD was not built for $RELEASE"
else
    sample() {
        (cd "$BUILD" && find . -path "$1" -type f | sed 's|^\./||' | sort | head -n 1)
    }
    wasm="$(sample './assets/php_*.wasm')"
    for entry in \
        "$wasm|^application/wasm" \
        "$(sample './wp-*/wordpress-static.zip')|^application/zip" \
        "$(sample './assets/*.css')|^text/css" \
        "$(sample './*.svg')|^image/svg\\+xml"; do
        file="${entry%%|*}"
        if [ -z "$file" ]; then
            skip "no sample for ${entry#*|}"
            continue
        fi
        request "$APP$BASE/$file"
        expect_status 200 "app $BASE/$file"
        expect_type "${entry#*|}" "app $BASE/$file"
        expect_static "app $BASE/$file"
    done
    if [ -n "$wasm" ]; then
        # The PHP runtime download resumes with an open-ended range through the edge.
        request "$APP$BASE/$wasm" -H 'Range: bytes=1000-'
        expect_status 206 "app $BASE/$wasm resumed at byte 1000"
        if [[ "$(header content-range)" == "bytes 1000-"* ]]; then pass "Content-Range $(header content-range)"; else fail "Content-Range '$(header content-range)'"; fi
        report_caching "app $BASE/$wasm"
    fi
fi

if [ "$FAILURES" -gt 0 ]; then
    echo "$FAILURES check(s) failed."
    exit 1
fi
echo "All checks passed for release $RELEASE."
