#!/bin/bash

docker build . --tag=wasm-wordpress-bundler

docker run \
	-v `pwd`/preload:/preload \
	-v `pwd`/output:/output \
	wasm-wordpress-bundler:latest \
	/emsdk_portable/fastcomp/emscripten/tools/file_packager.py \
	/output/wp.data \
	--pre-js=/preload/pre-lazy-wp-files.js \
	--export-name="PHPModule" \
	--preload=/preload/wordpress \
	--js-output=/output/wp.js
