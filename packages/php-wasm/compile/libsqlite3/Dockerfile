FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

RUN set -euxo pipefail &&\
    wget --no-check-certificate https://www.sqlite.org/2022/sqlite-autoconf-3400100.tar.gz && \
    tar -xzvf sqlite-autoconf-3400100.tar.gz && \
    cd sqlite-autoconf-3400100 && \
    source /root/emsdk/emsdk_env.sh && \
    emconfigure ./configure \
        --build i386-pc-linux-gnu \
        --target wasm32-unknown-emscripten \
        --prefix=/root/lib/ && \
    EMCC_SKIP="-lc" EMCC_FLAGS=" -sSIDE_MODULE -sSUPPORT_LONGJMP=wasm -fwasm-exceptions " emmake make && \
    emmake make install
