#!/bin/bash
#
# Rewrites package.json to use packages from a local package registry.
# All @wp-playground/* and @php-wasm/* dependencies are rewritten to
# point to tarball URLs on the local server.
#
# Usage:
#   ./use-local-packages.sh [package.json path]
#
# Environment variables:
#   PACKAGE_BASE_URL - Base URL of the package server (e.g., http://127.0.0.1:9724/abc123)
#   PACKAGE_VERSION  - Version of the packages (defaults to version from lerna.json)
#
# Example:
#   PACKAGE_BASE_URL=http://127.0.0.1:9724/abc123 ./use-local-packages.sh ./package.json
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PACKAGE_JSON="${1:-./package.json}"

if [ ! -f "$PACKAGE_JSON" ]; then
    echo "Error: package.json not found at $PACKAGE_JSON"
    exit 1
fi

if [ -z "$PACKAGE_BASE_URL" ]; then
    echo "Error: PACKAGE_BASE_URL environment variable is required"
    echo "Example: PACKAGE_BASE_URL=http://127.0.0.1:9724/abc123 $0"
    exit 1
fi

# Use provided version or fall back to lerna.json version
if [ -z "$PACKAGE_VERSION" ]; then
    PACKAGE_VERSION=$(jq -r '.version' "$REPO_ROOT/lerna.json")
fi

echo "Rewriting $PACKAGE_JSON to use local packages"
echo "  Base URL: $PACKAGE_BASE_URL"
echo "  Version:  $PACKAGE_VERSION"

jq --arg base_url "$PACKAGE_BASE_URL" --arg version "$PACKAGE_VERSION" '
  def rewrite_pkg($k; $v):
    if ($k | startswith("@wp-playground/") or startswith("@php-wasm/")) then
      ($base_url + "/v" + $version + "/" + ($k | gsub("/"; "-")) + "-" + $version + ".tar.gz")
    else $v end;
  .dependencies |= (if . then with_entries(.value = rewrite_pkg(.key; .value)) else . end) |
  .devDependencies |= (if . then with_entries(.value = rewrite_pkg(.key; .value)) else . end)
' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"

mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

echo "Updated package.json:"
cat "$PACKAGE_JSON"
