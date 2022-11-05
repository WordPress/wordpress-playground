#!/bin/bash

# Run from the repo root
rm packages/*/build-api/*.json;

for i in $(ls packages/*/api-extractor*.json); do
    node ./packages/typescript-reference-doc-generator/bin/api-extractor.js \
        run -c $i --local --verbose;
done;

mkdir -p build-api
node ./packages/typescript-reference-doc-generator/bin/merge-api-models.js \
    ./packages/php-wasm/build-api/*.json > build-api/php-wasm.api.json; 

node ./packages/typescript-reference-doc-generator/bin/merge-api-models.js \
    ./packages/php-wasm-browser/build-api/*.json > build-api/php-wasm-browser.api.json; 

node ./packages/typescript-reference-doc-generator/bin/merge-api-models.js \
    ./packages/wordpress-wasm/build-api/*.json > build-api/wordpress-wasm.api.json; 
