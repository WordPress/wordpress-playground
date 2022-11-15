#!/bin/bash

# Run from the repo root
rm ./build-api/*.json ./build-api/*/*.json;
mkdir -p ./build-api/distinct ./build-api/combined;

for i in $(ls src/*/api-extractor*.json); do
    node ./src/typescript-reference-doc-generator/bin/api-extractor.js \
        run -c $i --local --verbose;
done;

# Unique modules that the API docs were sourced from
for module in $(find . -type f -maxdepth 3 -name 'api-extractor*.json' -exec dirname "{}" \; | xargs basename | sort -u | uniq | grep -v '\.'); do
    node ./src/typescript-reference-doc-generator/bin/merge-api-models.js \
        ./build-api/distinct/$module*.json > build-api/combined/$module.api.json;
done;
