#!/bin/bash

set -e

cd wasm-build-pipeline

# Prepare a local WordPress installation to preload with the WASM build
bash prepare-wordpress.sh

# Prepare the WASM build environment module
docker build . --tag=wasm-wp-build

# Build the WASM module
docker run -v `pwd`/volume:/volume wasm-wp-build:latest bash /root/build-wasm.sh

cd ..

# Copy the WASM module to the public folder
cp ./wasm-build-pipeline/volume/output/php-web-wordpress.* public/

# Refresh WordPress static files in the public folder
rm -rf public/{wp-admin,wp-content,wp-includes}
mv wasm-build-pipeline/volume/wordpress-static/{wp-admin,wp-content,wp-includes} public/

# Cleanup
rm -rf ./wasm-build-pipeline/volume/*

