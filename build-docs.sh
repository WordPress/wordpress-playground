#!/bin/bash

npx docgen packages/php-wasm/src/php.js --output packages/php-wasm/README.md --to-section php.js                                                                                                            1 ↵
npx docgen packages/php-wasm/src/php-server.js --output packages/php-wasm/README.md --to-section php-server.js
npx docgen packages/php-wasm/src/php-browser.js --output packages/php-wasm/README.md --to-section php-browser.js

npx docgen packages/php-wasm-browser/src/emscripten-download-monitor.js --output packages/php-wasm-browser/README.md --to-section Utilities --ignore defaul
npx docgen packages/php-wasm-browser/src/worker-thread.js --output packages/php-wasm-browser/README.md --to-section 'Worker Thread API ' --ignore 'loadPHPWithProgress|currentBackend'
