FROM playground-php-wasm:base

ARG JSPI=0
ARG OPENSSL_VERSION
ARG OPENSSL_SHA256=""

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
    fi

RUN /root/copy-lib.sh lib-libz
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    wget https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz && \
    if [ -n "$OPENSSL_SHA256" ]; then echo "$OPENSSL_SHA256  openssl-$OPENSSL_VERSION.tar.gz" | sha256sum -c -; fi && \
    tar xf openssl-$OPENSSL_VERSION.tar.gz && \
    cd openssl-$OPENSSL_VERSION && \
    CONFIGURE_FLAGS="" && \
    if [[ "$OPENSSL_VERSION" == 3.* ]]; then CONFIGURE_FLAGS="no-shared no-afalgeng --libdir=lib"; fi && \
    emconfigure ./Configure -DHAVE_FORK=0 -DOPENSSL_NO_AFALGENG=1 no-threads $CONFIGURE_FLAGS --prefix=/root/install linux-generic32;

RUN source /root/emsdk/emsdk_env.sh && \
    cd openssl-$OPENSSL_VERSION && \
    sed -i 's|^CROSS_COMPILE.*$|CROSS_COMPILE=|g' Makefile && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" EMCC_SKIP="-lz" emmake make -j 12 build_generated libssl.a libcrypto.a;

RUN source /root/emsdk/emsdk_env.sh && \
    cd openssl-$OPENSSL_VERSION && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    cp -RL include/openssl /root/lib/include && \
    cp libcrypto.a libssl.a /root/lib/lib && \
    if [[ "$OPENSSL_VERSION" == 3.* ]]; then \
        EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" EMCC_SKIP="-lz" emmake make install_dev; \
    else \
        EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" EMCC_SKIP="-lz" emmake make install_sw || true; \
    fi
