#!/bin/bash

if [[ $* == *--rebuild-docker* ]]; then
    mkdir -p build/downloads
    docker build -t emscripten -f Dockerfile_emscripten .
    cp -r ./build-assets/zlib ./source
fi

cp ./build-assets/*.patch ./source
cp ./build-assets/Makefile ./source
docker run -v $(PWD)/source:/source -v $(PWD)/lib:/root/lib -w /source emscripten 'make all'
