#!/bin/bash

set -euo pipefail

if node -e 'if (parseInt(process.versions.node) < 23) { process.exit(0); }'; then
	source ~/.nvm/nvm.sh
	nvm install 23
	npm ci
fi

function test_playground_cli() {
	TARGET="$1"
	shift

	# Run Playground CLI with a timeout.
	echo "Running Playground CLI with Nx target: $TARGET $@"
	timeout -s TERM 30s npx nx "$TARGET" playground-cli server --php=8.3 $@ 2>&1 > playground-cli-test-output &
	PID=$!
	CLI_STARTUP_STRING='WordPress is running on http://127.0.0.1:9400'

	# Sleep until Playground CLI starts or the process times out.
	while ps -p "$PID" > /dev/null && ! grep -q "$CLI_STARTUP_STRING" playground-cli-test-output; do
		sleep 1
	done

	# Kill Playground CLI if it is still running.
	trap 'kill "$PID" 2>&1 > /dev/null || true' RETURN

	if grep -q "$CLI_STARTUP_STRING" playground-cli-test-output; then
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
		cat playground-cli-test-output
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

test_playground_cli unbuilt-asyncify --experimental-multi-worker
echo
test_playground_cli unbuilt-jspi --experimental-multi-worker
echo
