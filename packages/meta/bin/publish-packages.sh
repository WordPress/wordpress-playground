#!/bin/bash

# Default value for dist-tag
DIST_TAG=""

# Parse CLI arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dist-tag=*) DIST_TAG="${1#*=}"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
done

# Function to check if the package.json is for a public NPM package and publish it
publish_if_public_package() {
    if [ -f "$1/package.json" ]; then
        # Use Node.js to check the 'private' field in package.json
        is_private=$(node -e "
            const fs = require('fs');
            const path = '$1/package.json';
            const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
            console.log(pkg.private === true ? 'true' : 'false');
        ")

        # If "private" is false, publish the package
        if [ "$is_private" = "false" ]; then
            echo "Publishing package in $1"
            if [ -n "$DIST_TAG" ]; then
                npm publish "$1" --tag "$DIST_TAG"
            else
                npm publish "$1"
            fi
        else
            echo "$1 is marked as private. Skipping publish."
        fi
    else
        echo "No package.json found in $1. Skipping."
    fi
}

# Iterate over all directories in dist/packages/php-wasm/*
for dir in dist/packages/php-wasm/*/; do
    publish_if_public_package "$dir"
done

# Iterate over all directories in dist/packages/playground/*
for dir in dist/packages/playground/*/; do
    publish_if_public_package "$dir"
done
