#!/bin/bash

node packages/typescript-reference-doc-generator/build/tsdoc-to-api-markdown.js \
	-e packages/php-wasm/build/web/types/index.d.ts \
       packages/wordpress-plugin-ide/build/types/index.d.ts \
	-o docs/api
