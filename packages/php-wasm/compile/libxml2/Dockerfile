FROM playground-php-wasm:base

ARG JSPI
ARG WASMTIME_ASYNC=0

RUN source /root/emsdk/emsdk_env.sh && \
    env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
        --branch v2.9.10 \
        --single-branch     \
        --depth 1 && \
    cd libxml2 && \
    ./autogen.sh && \
    emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/lib/ &&\
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions $(if [ "$WASMTIME_ASYNC" = "1" ]; then echo "-sWASM_LEGACY_EXCEPTIONS=0"; fi)"; else echo ""; fi) && \
    EMCC_FLAGS=" -D__x86_64__  -sSIDE_MODULE $JSPI_FLAGS" emmake make && \
    emmake make install
