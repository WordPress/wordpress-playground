FROM playground-php-wasm:base

ARG JSPI
ARG WITH_DEBUG
ARG DEBUG_DWARF_COMPILATION_DIR

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz

RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
    fi


RUN set -euxo pipefail &&\
    wget --no-check-certificate https://sqlite.org/2025/sqlite-autoconf-3510000.tar.gz && \
    tar -xzvf sqlite-autoconf-3510000.tar.gz && \
    mv sqlite-autoconf-3510000 sqlite-src && \
    cd sqlite-src && \
    source /root/emsdk/emsdk_env.sh && \
	export CFLAGS="-DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_FTS5 -DSQLITE_USE_URI" && \
    emconfigure ./configure \
        --build=i386-pc-linux-gnu \
        --host=wasm32-unknown-emscripten \
        --prefix=/root/lib/ && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    export EMCC_SKIP="-lc"; \
    export EMCC_FLAGS=" \
        -D__x86_64__  -sSIDE_MODULE \
        $JSPI_FLAGS \
        $(\
            if [ "$WITH_DEBUG" = "yes" ]; then \
                echo "-g3 -fdebug-compilation-dir=${DEBUG_DWARF_COMPILATION_DIR}/sqlite-src "; \
            else \
                echo ''; \
            fi \
        )\
    "; \
    emmake make && \
    emmake make install

