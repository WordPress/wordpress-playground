#!/bin/bash

# Run from the repo root
npx tsc -p packages/php-wasm/tsconfig.json;
npx tsc -p packages/php-wasm-browser/tsconfig.json;
npx tsc -p packages/php-wasm-browser/tsconfig.worker.json;
npx tsc -p packages/wordpress-wasm/tsconfig.json;
npx tsc -p packages/wordpress-wasm/tsconfig.worker.json;
