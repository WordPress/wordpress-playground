#!/bin/bash

set -euo pipefail

# Nx enables colors in CI even when output is redirected. The assertions below
# intentionally inspect plain command names and usage text.
unset FORCE_COLOR
export NO_COLOR=1

node -e 'if (parseInt(process.versions.node) < 22) { console.error("Node.js version 22 or greater is required"); process.exit(1); }'

if [[ -z "${WP_PLAYGROUND_WASMTIME_BINARY:-}" ]]; then
	echo 'WP_PLAYGROUND_WASMTIME_BINARY must point to a built Wasmtime host.' >&2
	exit 1
fi

echo 'Running the unbuilt public CLI through the Wasmtime host.'
npx nx run playground-cli:source-run -- --help \
	> playground-cli-test-output 2>&1
npx nx run playground-cli:source-run -- server --help \
	>> playground-cli-test-output 2>&1

perl -pe 's/\e\[[0-9;]*[[:alpha:]]//g; s/\r//g' \
	playground-cli-test-output > playground-cli-test-output-plain
output=playground-cli-test-output-plain

for command in start server run-blueprint build-snapshot; do
	if ! grep -q "  $command" "$output"; then
		tail -n 120 "$output"
		echo "The unbuilt Wasmtime CLI did not advertise $command." >&2
		exit 1
	fi
done

if grep -Eq '^  php([[:space:]]|$)' "$output"; then
	tail -n 120 "$output"
	echo 'The unbuilt Wasmtime CLI unexpectedly advertised a standalone php command.' >&2
	exit 1
fi

if ! grep -q 'Usage: wp-playground-native server \[options\]' "$output"; then
	tail -n 120 "$output"
	echo 'The unbuilt Wasmtime CLI did not run the supported server command help.' >&2
	exit 1
fi

tail -n 120 "$output"
