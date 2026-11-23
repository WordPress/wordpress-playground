FROM playground-php-wasm:base

ARG JSPI
ARG OPENSSL_DIST_PATH=root/lib

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
    fi

COPY ./libopenssl/ /root/libopenssl
RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libopenssl/jspi/dist/$OPENSSL_DIST_PATH/* /root/lib; \
    else \
        cp -r /root/libopenssl/asyncify/dist/$OPENSSL_DIST_PATH/* /root/lib; \
    fi


ARG CURL_VERSION="curl-7.69.1"
ARG CURL_SHA256=""

RUN /root/copy-lib.sh lib-libz
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    wget https://curl.se/download/$CURL_VERSION.tar.gz && \
    if [ -n "$CURL_SHA256" ]; then echo "$CURL_SHA256  $CURL_VERSION.tar.gz" | sha256sum -c -; fi && \
    tar xf $CURL_VERSION.tar.gz

WORKDIR /root/$CURL_VERSION

# Emscripten's poll() does not yield; use Playground's select() shim instead.
# Keep NTLM and the protocol set from the existing curl build.
RUN CPPFLAGS="-I/root/lib/include " \
    LDFLAGS="-L/root/lib/lib " \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    source /root/emsdk/emsdk_env.sh && \
    CURL_EXTRA_CONFIGURE_FLAGS="" && \
    if [ "$CURL_VERSION" != "curl-7.69.1" ]; then \
        CURL_EXTRA_CONFIGURE_FLAGS="--without-libpsl --enable-ntlm --disable-ipfs --disable-mqtt --disable-websockets"; \
        export ac_cv_func_poll=no; \
    fi && \
    emconfigure ./configure \
        --build i386-pc-linux-gnu \
        --target wasm32-unknown-emscripten \
        --prefix=/root/lib/ \
        --disable-shared \
        --enable-static \
        --with-ssl \
        --with-openssl=/root/lib \
        --enable-https \
        --enable-http \
        --disable-pop3 \
        --disable-imap \
        --disable-smb \
        --disable-smtp \
        --disable-telnet \
        --disable-gopher \
        --disable-ftp \
        --disable-ftps \
        --disable-rtsp \
        --disable-tftp \
        --disable-pthreads \
        --disable-threaded-resolver \
        --with-zlib=/root/lib \
        $CURL_EXTRA_CONFIGURE_FLAGS

RUN if [ "$JSPI" = "1" ] && [ "$CURL_VERSION" = "curl-7.69.1" ]; then \
    source /root/emsdk/emsdk_env.sh && \
    EMCC_SKIP="-lc -lz -lcurl -lssl " \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE -Wl,--wrap=select -sSUPPORT_LONGJMP=wasm -fwasm-exceptions " emmake make || true; \
fi

RUN if [ "$JSPI" != "1" ] && [ "$CURL_VERSION" = "curl-7.69.1" ]; then \
    cp /root/emsdk/upstream/bin/wasm-ld /root/emsdk/upstream/bin/wasm-ld-original && \
    echo $'#!/bin/bash\n\
if [[ " $@ " =~ " -o curl " ]]; then \n\
echo '' > /root/curl-7.69.1/src/curl; \n\
echo '' > /root/curl-7.69.1/curl; \n\
fi; \n\
/root/emsdk/upstream/bin/wasm-ld-original "$@" || true; \n\
exit 0; \n' > /root/emsdk/upstream/bin/wasm-ld && \
    chmod a+x /root/emsdk/upstream/bin/wasm-ld; \
fi

RUN if [ "$JSPI" != "1" ] && [ "$CURL_VERSION" = "curl-7.69.1" ]; then \
    source /root/emsdk/emsdk_env.sh && \
    EMCC_SKIP="-lc -lz -lcurl -lssl " \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE -Wl,--wrap=select " emmake make -i || true; \
fi

RUN if [ "$JSPI" != "1" ] && [ "$CURL_VERSION" = "curl-7.69.1" ]; then \
    source /root/emsdk/emsdk_env.sh && \
    EMCC_SKIP="-lc -lz -lcurl -lssl " \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE -Wl,--wrap=select " emmake make install -i || true; \
fi

# Build only the library for newer curl releases; the command-line tool is not needed.
RUN if [ "$CURL_VERSION" != "curl-7.69.1" ]; then \
    source /root/emsdk/emsdk_env.sh && \
    JSPI_FLAGS="" && \
    if [ "$JSPI" = "1" ]; then JSPI_FLAGS="-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; fi && \
    EMCC_SKIP="-lc -lz -lcurl -lssl " \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE -Wl,--wrap=select $JSPI_FLAGS " emmake make -C lib -j12; \
fi
