#!/bin/bash

set -e
node ./packages/playground/client/test/esm_cjs/commonjs.cjs
node ./packages/playground/client/test/esm_cjs/esm.mjs
echo "Playground Client can be both imported as ESM and required as CJS"