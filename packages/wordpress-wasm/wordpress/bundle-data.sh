#!/bin/bash

docker build . --tag=wasm-wordpress-bundler

docker run \
	-v `pwd`/preload:/preload \
	-v `pwd`/docker-output:/output \
	wasm-wordpress-bundler:latest \
	/emsdk/upstream/emscripten/tools/file_packager.py \
	/output/wp.data \
	--export-name="PHPModule" \
	--preload /preload/wordpress \
	--js-output=/output/wp.js
