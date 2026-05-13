#!/bin/bash

set -euo pipefail

if node -e 'process.exit(parseInt(process.versions.node, 10) < 24 ? 0 : 1)'; then
	if [ ! -s ~/.nvm/nvm.sh ]; then
		echo 'Node.js 24 is required to test the unbuilt JSPI CLI, and nvm is not available.'
		exit 1
	fi

	source ~/.nvm/nvm.sh
	nvm install 24
	npm ci
fi

function test_playground_cli() {
	TARGET="$1"
	shift

	# Run Playground CLI with a timeout.
	echo "Running Playground CLI with Nx target: $TARGET $@"
	OUTPUT_FILE="playground-cli-test-output-$TARGET"
	timeout -s TERM 30s npx nx "$TARGET" playground-cli server --php=8.3 $@ > "$OUTPUT_FILE" 2>&1 &
	PID=$!
	CLI_STARTUP_STRING='WordPress is running on http://127.0.0.1:9400'

	function cleanup_playground_cli() {
		trap - RETURN
		kill "$PID" > /dev/null 2>&1 || true
		wait "$PID" > /dev/null 2>&1 || true
	}

	trap cleanup_playground_cli RETURN

	# Sleep until Playground CLI starts or the process times out.
	while ps -p "$PID" > /dev/null && ! grep -q "$CLI_STARTUP_STRING" "$OUTPUT_FILE"; do
		sleep 1
	done

	if grep -q "$CLI_STARTUP_STRING" "$OUTPUT_FILE"; then
		echo "Playground CLI started successfully"
		echo "Checking WordPress home page..."

		HOME_PAGE_OUTPUT="$(curl -sL http://127.0.0.1:9400 || echo 'No output')"
		if [[ $HOME_PAGE_OUTPUT != *"My WordPress Website"* ]]; then
			echo "Home page output: $HOME_PAGE_OUTPUT"
			echo "Error: Home page did not contain 'My WordPress Website'"
			return 1
		else
			echo 'Looks good!'
			return 0
		fi
	else
		cat "$OUTPUT_FILE"
		echo
		echo Playground CLI failed to start
		return 1
	fi
}

echo
test_playground_cli unbuilt-asyncify
echo
test_playground_cli unbuilt-jspi
echo
