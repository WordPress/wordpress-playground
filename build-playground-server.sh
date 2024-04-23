#!/bin/bash

bun build ./packages/playground/cli/src/cli.ts --compile --minify --outfile playground
mv ./packages/playground/cli/src/playground ./
