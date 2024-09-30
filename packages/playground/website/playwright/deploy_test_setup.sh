#!/bin/bash

# Store the current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

git checkout 4cbd5ac28
PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
rm -rf dist/packages/playground/wasm-wordpress-net-old
mv dist/packages/playground/wasm-wordpress-net dist/packages/playground/wasm-wordpress-net-old

git checkout d7b1a7274
PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
rm -rf dist/packages/playground/wasm-wordpress-net-new
mv dist/packages/playground/wasm-wordpress-net dist/packages/playground/wasm-wordpress-net-new

# Checkout back to the original branch
git checkout $CURRENT_BRANCH
