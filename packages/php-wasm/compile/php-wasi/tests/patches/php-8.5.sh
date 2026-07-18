#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
exec "$ROOT/tests/patches/php-series.sh" 8.5 "$@"
