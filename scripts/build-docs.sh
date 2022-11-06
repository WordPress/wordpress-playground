#!/bin/bash

# Run from the repo root

node ./scripts/refresh-markdown-includes.js /packages/php-wasm/README.md /packages/php-wasm-browser/README.md

echo "Copying README.md files to ./docs..."
cp ./packages/php-wasm/README.md ./docs/using-php-in-javascript.md
cp ./packages/php-wasm-browser/README.md ./docs/using-php-in-the-browser.md
cp ./packages/wordpress-wasm/README.md ./docs/using-wordpress-in-the-browser.md
