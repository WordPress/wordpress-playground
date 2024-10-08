FROM playground-php-wasm:base

ARG JSPI

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
        JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; fi) && \
        EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" emmake make;

RUN cd oniguruma && \
        source /root/emsdk/emsdk_env.sh && \
        emmake make install

RUN ls -r /root/lib
