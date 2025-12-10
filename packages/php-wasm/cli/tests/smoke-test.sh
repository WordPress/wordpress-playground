#!/bin/bash

set -euo pipefail

# Ensure Node 23+ is available for JSPI support
if node -e 'if (parseInt(process.versions.node) < 23) { process.exit(1); }'; then
	echo "Node $(node -v) detected, proceeding with smoke test..."
else
	source ~/.nvm/nvm.sh
	nvm install 23
	npm ci
fi

echo "Running php-wasm-cli smoke test with proc_open..."

# Run the test using the unbuilt php-wasm-cli
npx nx dev php-wasm-cli -- packages/php-wasm/cli/tests/proc_open_test.php

echo "php-wasm-cli smoke test completed!"
