#!/bin/bash

bun build ./src/playground-loader.ts -e ./src/php_8_0.js > ./src/playground-loader.js
bun build ./src/sw.ts -e ./src/php_8_0.js > ./src/sw.js

