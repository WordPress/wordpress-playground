#!/bin/bash

git checkout 4cbd5ac28
PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
rm -rf dist/packages/playground/wasm-wordpress-net-old
mv dist/packages/playground/wasm-wordpress-net dist/packages/playground/wasm-wordpress-net-old

git checkout 8e727e9f4
PLAYGROUND_URL=http://localhost:8000 npx nx run playground-website:build:wasm-wordpress-net
rm -rf dist/packages/playground/wasm-wordpress-net-new
mv dist/packages/playground/wasm-wordpress-net dist/packages/playground/wasm-wordpress-net-new

# npx playwright test \
#   --config=packages/playground/website/playwright/playwright.config.ts \
#   ./packages/playground/website/playwright/e2e/deployment.spec.ts
