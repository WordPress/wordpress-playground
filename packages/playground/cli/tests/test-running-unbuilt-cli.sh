#!/bin/bash

set -euo pipefail

node -e 'if (parseInt(process.versions.node) < 22) { console.error("Node.js version 22 or greater is required"); process.exit(1); }'

if [[ -z "${WP_PLAYGROUND_WASMTIME_BINARY:-}" ]]; then
	echo 'WP_PLAYGROUND_WASMTIME_BINARY must point to a built Wasmtime host.' >&2
	exit 1
fi

echo 'Running the unbuilt public CLI through the Wasmtime host.'
timeout -s TERM 300s npx nx run playground-cli:unbuilt-wasmtime -- php \
	--php=8.5 \
	--skip-wordpress-install \
	--skip-sqlite-setup \
	-- -v > playground-cli-test-output 2>&1

if ! grep -q 'PHP 8.5' playground-cli-test-output; then
	cat playground-cli-test-output
	echo 'The unbuilt Wasmtime CLI did not run PHP 8.5.' >&2
	exit 1
fi

cat playground-cli-test-output
