FROM playground-php-wasm:base

ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

RUN wget https://chromium.googlesource.com/webm/libwebp/+archive/845d5476a866141ba35ac133f856fa62f0b7445f.tar.gz -O libwebp.tar.gz
RUN tar -xzf libwebp.tar.gz
RUN     autoreconf --install
RUN     autoconf
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build i386-pc-linux-gnu \
            --target wasm32-unknown-emscripten \
            --prefix=/root/lib/
RUN source /root/emsdk/emsdk_env.sh && \
    JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; fi) && \
    EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE $JSPI_FLAGS" emmake make
RUN source /root/emsdk/emsdk_env.sh && \
    JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; fi) && \
    EMCC_FLAGS="-sSIDE_MODULE $JSPI_FLAGS" emmake make install
# @TODO: Do not remove dependencies like this – it's too easy to miss something.
#        Instead, source them from another directory and end up with a clean build.
RUN rm -rf /root/lib/lib/pkgconfig /root/lib/lib/libz.a /root/lib/include/zconf.h /root/lib/include/zlib.h