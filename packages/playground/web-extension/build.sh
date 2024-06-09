#!/bin/bash

bun build ./src/playground-loader.ts -e ./src/php_8_0.js > ./src/playground-loader.js
bun build ./src/sw.ts -e ./src/php_8_0.js > ./src/sw.js
bun build ./src/content-script.ts -e ./src/php_8_0.js > ./src/content-script.js
bun build ./src/wordpress-plugin/script.ts -e ./src/php_8_0.js \
    -e '../blocky-formats/*'  > ./src/wordpress-plugin/script.js

