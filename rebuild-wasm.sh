#!/bin/bash

cd wasm-build-pipeline

# Prepare the WASM build environment module
docker build . --tag=wasm-wp-build

# Prepare a local WordPress installation to preload with the WASM build
bash prepare-wordpress.sh

# Build the WASM module
docker run -v `pwd`/volume:/volume wasm-wp-build /root/build-wasm.sh

cd ..

# Copy the WASM module to the public folder
cp ./wasm-build-pipeline/volume/output/php-web-wordpress.* public/

# Refresh WordPress static files in the public folder
rm -rf public/{wp-admin,wp-content,wp-includes}
mv wasm-build-pipeline/wordpress-static/{wp-admin,wp-content,wp-includes} public/

# Cleanup
rm -rf ./wasm-build-pipeline/wordpress

