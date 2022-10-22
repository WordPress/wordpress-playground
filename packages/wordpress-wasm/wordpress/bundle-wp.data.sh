#!/bin/bash

docker build . --tag=wasm-wordpress-bundler

docker run \
	-v `pwd`/wordpress:/wordpress \
	-v `pwd`/docker-output:/output \
	wasm-wordpress-bundler:latest \
	/emsdk/upstream/emscripten/tools/file_packager.py \
	/output/wp.data \
	--export-name="PHPModule" \
	--preload /wordpress \
	--js-output=/output/wp.js

mv docker-output/* ./
rm -rf docker-output
