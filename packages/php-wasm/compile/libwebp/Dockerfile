FROM playground-php-wasm:base

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
            --prefix=/root/install/
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE" emmake make
RUN source /root/emsdk/emsdk_env.sh && emmake make install
