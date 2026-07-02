FROM playground-php-wasm:base

ARG JSPI
ARG WASMTIME_ASYNC=0

RUN mkdir -p /root/lib/include /root/lib/lib

RUN git clone https://github.com/kkos/oniguruma.git

RUN cd oniguruma && \
        source /root/emsdk/emsdk_env.sh && \
        autoreconf -vfi && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emconfigure ./configure --prefix=/root/lib/ ;

RUN cd oniguruma && \
        source /root/emsdk/emsdk_env.sh && \
        export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions $(if [ "$WASMTIME_ASYNC" = "1" ]; then echo "-sWASM_LEGACY_EXCEPTIONS=0"; fi)"; else echo ""; fi) && \
        EMCC_SKIP="-lz" EMCC_FLAGS=" -D__x86_64__  -sSIDE_MODULE $JSPI_FLAGS" emmake make;

RUN cd oniguruma && \
        source /root/emsdk/emsdk_env.sh && \
        emmake make install

RUN ls -r /root/lib
