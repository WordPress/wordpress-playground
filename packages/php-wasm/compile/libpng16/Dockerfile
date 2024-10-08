FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

RUN wget http://prdownloads.sourceforge.net/libpng/libpng-1.6.39.tar.gz?download -O libpng-1.6.39.tar.gz
RUN tar -xzf libpng-1.6.39.tar.gz
WORKDIR /root/libpng-1.6.39
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build i386-pc-linux-gnu \
            --target wasm32-unknown-emscripten \
            --prefix=/root/install/
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE -sSUPPORT_LONGJMP=wasm -fwasm-exceptions" emmake make
RUN source /root/emsdk/emsdk_env.sh && emmake make install
