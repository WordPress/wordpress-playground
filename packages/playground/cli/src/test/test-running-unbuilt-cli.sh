#!/bin/bash

set -euo pipefail

if node -e 'if (parseInt(process.versions.node) < 22) { process.exit(0); }'; then
	source ~/.nvm/nvm.sh
	nvm install 22
fi

# Run Playground CLI with a timeout.
timeout -s TERM 30s npx nx dev-node playground-cli server --php=8.3 2>&1 > playground-cli-test-output &
PID=$!
CLI_STARTUP_STRING='WordPress is running on http://127.0.0.1:9400'

# Sleep until Playground CLI starts or the process times out.
while ps -p "$PID" > /dev/null && ! grep -q "$CLI_STARTUP_STRING" playground-cli-test-output; do
	sleep 1
done

# Kill Playground CLI if it is still running.
kill "$PID" 2>&1 > /dev/null || true

if grep -q "$CLI_STARTUP_STRING" playground-cli-test-output; then
	echo "Playground CLI started successfully"
	exit 0
else
	cat playground-cli-test-output
	echo 
	echo Playground CLI failed to start
	exit 1
fi