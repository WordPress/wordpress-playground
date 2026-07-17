#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=versions.env
source "$ROOT/versions.env"

COMPONENT=${1:-$ROOT/dist/php-wasi-component.wasm}
if [[ ! -s "$COMPONENT" ]]; then
	echo "Component does not exist or is empty: $COMPONENT" >&2
	exit 1
fi

wasm-tools validate --features all "$COMPONENT"

resolved_wit=$(mktemp)
trap 'rm -f "$resolved_wit"' EXIT
wasm-tools component wit "$COMPONENT" >"$resolved_wit"

grep -Fq "import wasi:filesystem/types@$WASI_WIT_VERSION;" "$resolved_wit"
grep -Fq "import wasi:random/random@$WASI_WIT_VERSION;" "$resolved_wit"
grep -Fq 'import wordpress:php-wasi/output@0.1.0;' "$resolved_wit"
grep -Fq 'import wordpress-playground:filesystem-locks/filesystem-locks@0.1.0;' "$resolved_wit"
grep -Fq 'import wordpress-playground:filesystem-locks/sqlite-wal-shm@0.1.0;' "$resolved_wit"
grep -Fq 'record exchange-result {' "$resolved_wit"
grep -Fq 'epoch: u64,' "$resolved_wit"
grep -Fq 'current-epoch: func(shm: borrow<wal-shm>) -> result<u64, shm-error>;' "$resolved_wit"
grep -Fq 'export wordpress:php-wasi/handler@0.1.0;' "$resolved_wit"
grep -Fq 'initialize: func(php-ini-path: string) -> result<_, string>;' "$resolved_wit"
grep -Fq 'record request {' "$resolved_wit"
grep -Fq 'script-path: string,' "$resolved_wit"
grep -Fq 'body: list<u8>,' "$resolved_wit"
grep -Fq 'stream-response: bool,' "$resolved_wit"
grep -Fq 'server-entries: list<entry>,' "$resolved_wit"
grep -Fq 'record response {' "$resolved_wit"
grep -Fq 'http-status: u16,' "$resolved_wit"
grep -Fq 'headers: list<string>,' "$resolved_wit"
grep -Fq 'handle-request: func(request: request) -> result<response, string>;' "$resolved_wit"
grep -Fq 'export wordpress:php-wasi/cli@0.1.0;' "$resolved_wit"
grep -Fq 'argv: list<string>,' "$resolved_wit"
grep -Fq 'env: list<entry>,' "$resolved_wit"
grep -Fq 'cwd: option<string>,' "$resolved_wit"
grep -Fq 'run: func(request: request) -> result<s32, string>;' "$resolved_wit"

echo "Validated $(basename "$COMPONENT"): WASI $WASI_WIT_VERSION reactor, PHP handler/CLI, output, lock, and SQLite WAL SHM imports"
