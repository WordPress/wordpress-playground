#!/bin/bash

# Store the current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Checkout a old version of Playground and build it
git checkout 4cbd5ac28
PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
rm -rf packages/playground/website/public/test-fixtures/wasm-wordpress-net-old
mv dist/packages/playground/wasm-wordpress-net packages/playground/website/public/test-fixtures/wasm-wordpress-net-old

# Checkout back to the original branch
git checkout $CURRENT_BRANCH

# git checkout 4cbd5ac28
# PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
# rm -rf dist/packages/playground/wasm-wordpress-net-old
# mv dist/packages/playground/wasm-wordpress-net dist/packages/playground/wasm-wordpress-net-old

# git checkout d7b1a7274
# PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
# rm -rf dist/packages/playground/wasm-wordpress-net-new
# mv dist/packages/playground/wasm-wordpress-net dist/packages/playground/wasm-wordpress-net-new

# npx playwright test \
#   --config=packages/playground/website/playwright/playwright.config.ts \
#   ./packages/playground/website/playwright/e2e/deployment.spec.ts
