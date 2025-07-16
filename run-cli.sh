#!/bin/bash

current_dir=$(pwd)
plugin_dir=$current_dir/packages/playground/cli/src/test/mount-examples/plugin
symlink_dir=$current_dir/plugin-symlink

# symlink plugin
ln -s $plugin_dir $symlink_dir

# run cli
node \
    --experimental-wasm-jspi \
    --experimental-strip-types \
    --experimental-transform-types \
    --import ./packages/meta/src/node-es-module-loader/register.mts \
    ./packages/playground/cli/src/cli.ts \
    server \
    --port=9400 \
    --follow-symlinks \
    --blueprint=$current_dir/blueprint.json \
    --mount=$symlink_dir:/wordpress/wp-content/plugins/plugin