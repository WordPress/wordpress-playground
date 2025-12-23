#!/bin/bash
#
# Builds all packages, starts a local registry server, and runs integration tests.
# This script is used by both CI and local development.
#
# Usage:
#   ./run-tests.sh [--skip-build] [--es-modules-only] [--commonjs-only]
#
# Options:
#   --skip-build       Skip building packages (useful if already built)
#   --es-modules-only  Only run ES Modules tests
#   --commonjs-only    Only run CommonJS tests
#
# Environment variables:
#   VERSION           Override the package version (defaults to timestamp)
#   PORT              Override the server port (defaults to 9934)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$REPO_ROOT"

# Parse arguments
SKIP_BUILD=false
RUN_ES_MODULES=true
RUN_COMMONJS=true

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --es-modules-only)
      RUN_COMMONJS=false
      ;;
    --commonjs-only)
      RUN_ES_MODULES=false
      ;;
  esac
done

# Set up environment
VERSION="${VERSION:-$(date +%s)}"
PORT="${PORT:-9934}"
PACKAGE_BASE_URL="http://127.0.0.1:$PORT/$VERSION"
HOST_PATH="./dist/packages-for-self-hosting/http%3A%2F%2F127.0.0.1%3A$PORT%2F$VERSION"

export VERSION
export PORT
export PACKAGE_BASE_URL
export PACKAGE_VERSION="$VERSION"

echo "=== Test Built NPM Packages ==="
echo "Version: $VERSION"
echo "Port: $PORT"
echo "Base URL: $PACKAGE_BASE_URL"
echo ""

# Update package.json versions in all packages
echo "=== Updating package.json versions ==="
for package in packages/*/*/package.json; do
  jq --arg version "$VERSION" '.version = $version' "$package" > "$package.tmp"
  mv "$package.tmp" "$package"
done

# Build and package all packages
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "=== Building and packaging all packages ==="
  npx nx run-many --all --target=package-for-self-hosting -- --hostingBaseUrl="$PACKAGE_BASE_URL"
fi

# Start the HTTP server in background
echo ""
echo "=== Starting package server ==="

cd "$HOST_PATH"
python3 -c "
import http.server
import socketserver

class PrefixHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        prefix = '/$VERSION/'
        if self.path.startswith(prefix):
            self.path = self.path[len(prefix)-1:]
        elif self.path == '/$VERSION':
            self.path = '/'
        super().do_GET()

    def log_message(self, format, *args):
        pass  # Suppress logging

with socketserver.TCPServer(('127.0.0.1', $PORT), PrefixHTTPRequestHandler) as httpd:
    httpd.serve_forever()
" &
SERVER_PID=$!
cd "$REPO_ROOT"

# Cleanup function to kill server on exit
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Wait for server to be ready
echo "Waiting for server to be ready..."
PACKAGE_URL="$PACKAGE_BASE_URL/v$VERSION/@wp-playground-cli-$VERSION.tar.gz"
for i in {1..60}; do
  if curl -sf "$PACKAGE_URL" > /dev/null 2>&1; then
    echo "Server is ready"
    break
  fi
  sleep 1
done

# Run tests
FAILED=false

if [ "$RUN_ES_MODULES" = true ]; then
  echo ""
  echo "=== Running ES Modules tests ==="
  if ! "$SCRIPT_DIR/es-modules-and-vitest/run-with-local-packages.sh"; then
    FAILED=true
  fi
fi

if [ "$RUN_COMMONJS" = true ]; then
  echo ""
  echo "=== Running CommonJS tests ==="
  if ! "$SCRIPT_DIR/commonjs-and-jest/run-with-local-packages.sh"; then
    FAILED=true
  fi
fi

if [ "$FAILED" = true ]; then
  echo ""
  echo "=== Some tests failed ==="
  exit 1
fi

echo ""
echo "=== All tests passed ==="
