#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Unit tests (PHPUnit) ==="
phpunit --bootstrap "$SCRIPT_DIR/tests/bootstrap.php" "$SCRIPT_DIR/tests/ProxyFunctionsTests.php"

echo ""
echo "=== E2E tests ==="
php "$SCRIPT_DIR/tests/e2e/cors-proxy-e2e-test.php"
