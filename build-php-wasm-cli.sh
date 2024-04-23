#!/bin/bash

bun build  ./packages/php-wasm/cli/src/main.js --compile --minify --outfile php-wasm-cli
mv ./packages/php-wasm/cli/src/php-wasm-cli ./
