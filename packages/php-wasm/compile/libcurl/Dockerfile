FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

RUN /root/copy-lib.sh lib-libz
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    export CURL_VERSION=7.69.1 && \
    wget https://curl.haxx.se/download/curl-$CURL_VERSION.tar.gz && \
    tar xf curl-$CURL_VERSION.tar.gz

RUN cd curl-7.69.1 && \
    CPPFLAGS="-I/root/lib/include " \
    LDFLAGS="-L/root/lib/lib " \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    source /root/emsdk/emsdk_env.sh && \
    emconfigure ./configure \
        --build i386-pc-linux-gnu \
        --target wasm32-unknown-emscripten \
        --prefix=/root/install/ \
        --disable-shared \
        --enable-static \
        --disable-ldap \
        --disable-ldaps \
        --disable-rtsp \
        --disable-dict \
        --disable-telnet \
        --disable-tftp \
        --disable-pop3 \
        --disable-imap \
        --disable-smtp 

WORKDIR /root/curl-7.69.1
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz -lcurl" EMCC_FLAGS="-sSIDE_MODULE" emmake make || true