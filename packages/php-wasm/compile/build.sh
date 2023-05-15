#!/bin/bash

mkdir -p source
if [[ $* == *--rebuild-docker* ]]; then
    mkdir -p build/downloads
    docker build -t emscripten -f Dockerfile_emscripten .
fi

cp -r ./build-assets/* ./source
# docker run -v $(PWD)/source:/source -v $(PWD)/lib:/root/lib -w /source emscripten 'make php-src-7-4-configured'
docker run -v $(PWD)/source:/source -v $(PWD)/lib:/root/lib -w /source emscripten 'make php-src-7-4-linked'
