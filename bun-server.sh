#!/bin/bash

bun ./packages/playground/cli/src/cli.ts start --mount=my-plugin:/wordpress/wp-content/plugins/my-plugin --login --php=7.4 --wp=6.4
