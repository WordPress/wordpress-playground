#!/bin/bash

PHP_VERSION="${PHP_VERSION:-8.0}"
hash1=$(sha1sum ./packages/php-wasm/compile/Dockerfile)
hash2=""

while [ "$hash1" != "$hash2" ]; do
  hash1=$(sha1sum ./packages/php-wasm/compile/Dockerfile);
  npm run recompile:php:node:$PHP_VERSION;
  node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify';
  hash2=$(sha1sum ./packages/php-wasm/compile/Dockerfile);
done
