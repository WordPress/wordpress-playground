#!/bin/bash

set -e

PHP_VERSION=${1:-8.0.24}
if [[ $PHP_VERSION == "7.*" ]]
then
  VRZNO_FLAG="--enable-vrzno"
  EXTRA_EXPORTED_FUNCTIONS=', "_exec_callback", "_del_callback"'
else
  VRZNO_FLAG="--disable-vrzno"
  EXTRA_EXPORTED_FUNCTIONS=""
fi

EXPORTED_FUNCTIONS='["_pib_init", "_pib_destroy", "_pib_run", "_pib_exec" "_pib_refresh", "_main", "_php_embed_init", "_php_embed_shutdown", "_php_embed_shutdown", "_zend_eval_string" '$EXTRA_EXPORTED_FUNCTIONS']'

docker build . --tag=wasm-wordpress-php-builder --build-arg PHP_VERSION=$PHP_VERSION --build-arg VRZNO_FLAG="$VRZNO_FLAG"

# Build the PHP wasm binary
docker run \
        -v `pwd`/preload:/preload \
        -v `pwd`/docker-output:/output \
        wasm-wordpress-php-builder:latest \
        emcc -Oz \
        -o /output/php-web.js \
        --llvm-lto 2                     \
        -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
        -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8", "FS", "PROXYFS"]' \
        -s MAXIMUM_MEMORY=-1             \
        -s INITIAL_MEMORY=1024MB \
        -s ALLOW_MEMORY_GROWTH=1         \
        -s ASSERTIONS=0                  \
        -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
        -s EXPORT_NAME="'PHP'"           \
        -s MODULARIZE=1                  \
        -s INVOKE_RUN=0                  \
        -s USE_ZLIB=1                    \
                /root/lib/pib_eval.o /root/lib/libphp7.a /root/lib/lib/libxml2.a \
        --pre-js /preload/php-web-pre-script.js \
        -s ENVIRONMENT=web \
        -s FORCE_FILESYSTEM=1

# A webworker-compatible version doesn't require a separate build, just
# a different configuration. Let's just copy the file and change the
# environment – it's much faster this way.
cat `pwd`/docker-output/php-web.js \
  | sed 's/ENVIRONMENT_IS_WEB=true/ENVIRONMENT_IS_WEB=false/g' \
  | sed 's/ENVIRONMENT_IS_WORKER=false/ENVIRONMENT_IS_WORKER=true/g' \
  > `pwd`/docker-output/php-webworker.js
