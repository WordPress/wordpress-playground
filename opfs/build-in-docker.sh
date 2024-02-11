#!/bin/bash

docker build -t playground-php-wasm:base .
docker run --name test-opfs --rm -v "$(pwd)":/app -w /app \
    playground-php-wasm:base bash /app/build.sh
    