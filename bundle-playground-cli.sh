#!/bin/bash

bun build  ./packages/playground/cli/src/cli.js --compile --minify --outfile playground-cli
mv ./packages/playground/cli/src/playground-cli ./
