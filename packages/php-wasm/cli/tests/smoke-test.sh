#!/bin/bash

set -euo pipefail

# Ensure Node 23+ is available for JSPI support
if node -e 'if (parseInt(process.versions.node) < 24) { process.exit(1); }'; then
	echo "Node $(node -v) detected, proceeding with smoke test..."
else
	source ~/.nvm/nvm.sh
	nvm install 24
	npm ci
fi

echo "Running php-wasm-cli smoke test with proc_open..."

# Run the test using the unbuilt php-wasm-cli and capture output
output=$(npx nx dev php-wasm-cli -- packages/php-wasm/cli/tests/proc_open_test.php 2>&1)

# Assert that the output contains the expected success message
if echo "$output" | grep -q "proc_open test passed!"; then
    echo "Assertion passed: proc_open test output contains expected success message"
else
    echo "Assertion failed: Expected output to contain 'proc_open test passed!'"
    echo "Actual output:"
    echo "$output"
    exit 1
fi

echo "Running php-wasm-cli smoke test with curl over HTTPS..."

curl_output=$(npx nx dev php-wasm-cli -- packages/php-wasm/cli/tests/curl_test.php 2>&1)

if echo "$curl_output" | grep -q "curl test passed!"; then
    echo "Assertion passed: curl test output contains expected success message"
    echo "php-wasm-cli smoke test completed!"
else
    echo "Assertion failed: Expected output to contain 'curl test passed!'"
    echo "Actual output:"
    echo "$curl_output"
    exit 1
fi
