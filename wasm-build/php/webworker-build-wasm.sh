#!/bin/bash

set -e

PHP_VERSION=${1:-8.0.24}

docker build . --tag=wasm-wordpress-php-builder --build-arg PHP_VERSION=$PHP_VERSION

docker run \
        -v `pwd`/preload:/preload \
        -v `pwd`/docker-output:/output \
        wasm-wordpress-php-builder:latest \
        emcc \
        -I /root/php-src/TSRM \
        -o /output/webworker-php.js \
        -s EXPORTED_FUNCTIONS='["_main"]' \
        -s MAXIMUM_MEMORY=-1             \
        -s INITIAL_MEMORY=1024MB \
        -s ALLOW_MEMORY_GROWTH=1         \
        -s ASSERTIONS=1                  \
        -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
        -s EXPORT_NAME="'PHP'"           \
        -s MODULARIZE=1                  \
        -s INVOKE_RUN=0                  \
                /root/lib/pib_eval.o /root/lib/libphp7.a \
        -s ENVIRONMENT=worker

# -fno-exceptions
