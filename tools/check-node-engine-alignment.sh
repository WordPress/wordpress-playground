#!/bin/bash
#
# Verify that all local package.json files declaring engines.node or
# engines.npm match the values used by WordPress Core (wordpress-develop/trunk).
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

mismatches=0

while IFS= read -r file; do
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
done < <(find . -name 'package.json' -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/wordpress-builds/public/*')

if [ "$mismatches" -gt 0 ]; then
	echo ""
	echo "ERROR: $mismatches engine mismatch(es) found"
	exit 1
fi

echo "All engines.node and engines.npm values align with WordPress Core."
