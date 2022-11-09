#!/bin/bash

# Run from the repo root
npm run build:types
bash ./scripts/build-api-model.sh
bash ./scripts/build-api-markdown.sh
node ./scripts/build-readme-md-files.js
