FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

RUN /root/copy-lib.sh lib-libz
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    export OPENSSL_VERSION=1.1.0h && \
    wget https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz && \
    tar xf openssl-$OPENSSL_VERSION.tar.gz && \
    cd openssl-$OPENSSL_VERSION && \
    emconfigure ./Configure dist -DHAVE_FORK=0 -DOPENSSL_NO_AFALGENG=1 no-threads --prefix=/root/install && \
    sed -i 's|^CROSS_COMPILE.*$|CROSS_COMPILE=|g' Makefile && \
    EMCC_FLAGS=" -sSIDE_MODULE " EMCC_SKIP="-lz" emmake make -j 12 build_generated libssl.a libcrypto.a; \
    cp -RL include/openssl /root/lib/include && \
    cp libcrypto.a libssl.a /root/lib/lib && \
    EMCC_FLAGS=" -sSIDE_MODULE -sSUPPORT_LONGJMP=wasm -fwasm-exceptions" EMCC_SKIP="-lz" emmake make install_sw;
