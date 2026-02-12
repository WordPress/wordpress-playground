#!/bin/bash
#
# Verify that the root package.json and all published (non-private) package.json
# files declare engines.node and engines.npm values matching WordPress Core
# (wordpress-develop/trunk).
#

set -euo pipefail

WP_PACKAGE_JSON_URL="https://raw.githubusercontent.com/WordPress/wordpress-develop/trunk/package.json"

echo "Fetching WordPress Core package.json..."
wp_package_json=$(curl -sf "$WP_PACKAGE_JSON_URL")

wp_engines_node=$(echo "$wp_package_json" | jq -r '.engines.node')
wp_engines_npm=$(echo "$wp_package_json" | jq -r '.engines.npm')

if [ -z "$wp_engines_node" ] || [ "$wp_engines_node" = "null" ]; then
	echo "ERROR: Could not extract engines.node from WordPress Core package.json"
	exit 1
fi

if [ -z "$wp_engines_npm" ] || [ "$wp_engines_npm" = "null" ]; then
	echo "ERROR: Could not extract engines.npm from WordPress Core package.json"
	exit 1
fi

echo "WordPress Core engines.node: $wp_engines_node"
echo "WordPress Core engines.npm:  $wp_engines_npm"
echo ""

# Collect package.json paths: root + all non-private lerna packages.
echo "Querying lerna for non-private packages..."
lerna_json=$(npx lerna list --no-private --json --loglevel=error 2>/dev/null)

# Sanity check: @wp-playground/cli must be in the list. This confirms
# lerna is returning valid Playground package names and ensures that
# package is always checked.
if ! echo "$lerna_json" | jq -e '.[] | select(.name == "@wp-playground/cli")' > /dev/null 2>&1; then
	echo "ERROR: @wp-playground/cli not found in lerna list output."
	echo "The lerna command may not be returning valid Playground packages."
	exit 1
fi

package_files=("./package.json")
while IFS= read -r location; do
	package_files+=("${location}/package.json")
done < <(echo "$lerna_json" | jq -r '.[].location')

echo "Checking ${#package_files[@]} package.json files..."
echo ""

mismatches=0

for file in "${package_files[@]}"; do
	local_engines_node=$(jq -r '.engines.node // empty' "$file")
	if [ -n "$local_engines_node" ] && [ "$local_engines_node" != "$wp_engines_node" ]; then
		echo "MISMATCH (engines.node): $file"
		echo "  local:     $local_engines_node"
		echo "  expected:  $wp_engines_node"
		mismatches=$((mismatches + 1))
	fi

	local_engines_npm=$(jq -r '.engines.npm // empty' "$file")
	if [ -n "$local_engines_npm" ] && [ "$local_engines_npm" != "$wp_engines_npm" ]; then
		echo "MISMATCH (engines.npm): $file"
		echo "  local:     $local_engines_npm"
		echo "  expected:  $wp_engines_npm"
		mismatches=$((mismatches + 1))
	fi
done

if [ "$mismatches" -gt 0 ]; then
	echo ""
	echo "ERROR: $mismatches engine mismatch(es) found"
	exit 1
fi

echo "All engines.node and engines.npm values align with WordPress Core."
