#!/bin/bash
#
# Runs the ES Modules test suite using packages from a local registry.
#
# Usage:
#   # First, start the local package server in another terminal:
#   ./tools/scripts/local-package-repository.sh
#
#   # Then run this script with the base URL (printed by the server):
#   PACKAGE_BASE_URL=http://127.0.0.1:9724/abc123 ./run-with-local-packages.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

# Rewrite package.json to use local packages
"$SCRIPT_DIR/../use-local-packages.sh" ./package.json

# Install dependencies from local registry
npm install

# Run tests
npm run test
