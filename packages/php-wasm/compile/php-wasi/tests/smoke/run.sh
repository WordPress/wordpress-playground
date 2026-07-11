#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${1:?Usage: run.sh http://127.0.0.1:PORT}
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TMP=$(mktemp -d)

cleanup() {
	rm -rf "$TMP"
	rm -f "$ROOT"/*.sqlite "$ROOT"/*.sqlite-journal "$ROOT"/*.sqlite-shm "$ROOT"/*.sqlite-wal
}
trap cleanup EXIT
cleanup
mkdir -p "$TMP"

status=$(curl -sS -o "$TMP/hello-alpha" -w '%{http_code}' \
	-X POST --data-binary alpha "$BASE_URL/hello.php")
[[ "$status" == 200 && "$(<"$TMP/hello-alpha")" == 'POST:alpha:temp=ok' ]]

status=$(curl -sS -o "$TMP/fatal" -w '%{http_code}' "$BASE_URL/fatal.php")
[[ "$status" == 500 ]]

status=$(curl -sS -o "$TMP/hello-omega" -w '%{http_code}' \
	-X POST --data-binary omega "$BASE_URL/hello.php")
[[ "$status" == 200 && "$(<"$TMP/hello-omega")" == 'POST:omega:temp=ok' ]]

status=$(curl -sS -D "$TMP/redirect-headers" -o "$TMP/redirect-body" \
	-w '%{http_code}' "$BASE_URL/redirect.php")
[[ "$status" == 302 && ! -s "$TMP/redirect-body" ]]
tr -d '\r' <"$TMP/redirect-headers" >"$TMP/redirect-headers-normalized"
grep -Fiqx 'Location: /next' "$TMP/redirect-headers-normalized"
grep -Fiq 'Set-Cookie: php_wasi_redirect=visible;' "$TMP/redirect-headers-normalized"

status=$(curl -sS -D "$TMP/header-only-headers" -o "$TMP/header-only-body" \
	-w '%{http_code}' "$BASE_URL/headeronly.php")
[[ "$status" == 204 && ! -s "$TMP/header-only-body" ]]
tr -d '\r' <"$TMP/header-only-headers" >"$TMP/header-only-headers-normalized"
grep -Fiqx 'X-Header-Only: yes' "$TMP/header-only-headers-normalized"

[[ "$(curl -sS "$BASE_URL/sqlite.php")" == 1 ]]
[[ "$(curl -sS "$BASE_URL/sqlite.php")" == 2 ]]

[[ "$(curl -sS "$BASE_URL/random.php")" == '513:in-range:valid:email-valid' ]]

[[ "$(curl -sS "$BASE_URL/sqlite-lock.php")" == 1 ]]
for worker in 1 2; do
	(
		curl -sS -o "$TMP/lock-$worker-body" -w '%{http_code}' \
			"$BASE_URL/sqlite-lock.php" >"$TMP/lock-$worker-status"
	) &
done
wait
[[ "$(<"$TMP/lock-1-status")" == 200 && "$(<"$TMP/lock-2-status")" == 200 ]]
counts=$(printf '%s\n%s\n' "$(<"$TMP/lock-1-body")" "$(<"$TMP/lock-2-body")" | sort -n | tr '\n' ' ')
[[ "$counts" == '2 3 ' ]]

echo 'PHP WASI smoke tests passed: persistent bailout recovery, redirects/header-only responses, temp files, CSPRNG/password hashing, PDO SQLite, and concurrent locks'
