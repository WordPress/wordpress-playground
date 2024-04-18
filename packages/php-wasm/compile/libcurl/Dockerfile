FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib
COPY ./libopenssl/dist/root/lib/include /root/lib/include
COPY ./libopenssl/dist/root/lib/lib /root/lib/lib

ARG CURL_VERSION="curl-7.69.1"

RUN /root/copy-lib.sh lib-libz
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    wget https://curl.haxx.se/download/$CURL_VERSION.tar.gz && \
    tar xf $CURL_VERSION.tar.gz

WORKDIR /root/$CURL_VERSION

RUN CPPFLAGS="-I/root/lib/include " \
    LDFLAGS="-L/root/lib/lib " \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    source /root/emsdk/emsdk_env.sh && \
    emconfigure ./configure \
        --build i386-pc-linux-gnu \
        --target wasm32-unknown-emscripten \
        --prefix=/root/install/ \
        --disable-shared \
        --enable-static \
        --with-openssl=/root/lib \
        --enable-https \
        --enable-http \
        --disable-pthreads \
        --disable-threaded-resolver \
        --with-zlib=/root/lib

RUN source /root/emsdk/emsdk_env.sh && \
    EMCC_SKIP="-lc -lz -lcurl" \
    EMCC_FLAGS="-sSIDE_MODULE -Wl,--wrap=select " emmake make || true
