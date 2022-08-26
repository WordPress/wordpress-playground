#!/bin/bash

cd /root/php7.4-src/
rm -rf preload/*
cp -r /volume/wordpress preload/
mkdir -p /volume/output

emcc -O3 \
	-o /volume/output/php-web-wordpress.js \
	--llvm-lto 2                     \
	-s EXPORTED_FUNCTIONS='["_pib_init", "_pib_destroy", "_pib_run", "_pib_exec" "_pib_refresh", "_main", "_php_embed_init", "_php_embed_shutdown", "_php_embed_shutdown", "_zend_eval_string", "_exec_callback", "_del_callback"]' \
	-s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8"]' \
	-s ENVIRONMENT=web               \
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
    --preload-file preload/ \
    -s ENVIRONMENT=web
