FROM playground-php-wasm:base

ARG LIBZIP_VERSION
ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
    fi

RUN     cd /root && \
        curl -k https://libzip.org/download/libzip-$LIBZIP_VERSION.tar.gz -o libzip-$LIBZIP_VERSION.tar.gz && \
        tar -xzf libzip-$LIBZIP_VERSION.tar.gz && \
        mv libzip-$LIBZIP_VERSION libzip;
RUN mkdir -p libzip/build
RUN cd libzip/build && \
        source /root/emsdk/emsdk_env.sh && \
        emcmake cmake \
            -DCMAKE_INSTALL_PREFIX=/root/install \
            -DZLIB_LIBRARY=/root/lib/lib/libz.a \
            -DZLIB_INCLUDE_DIR=/root/lib/include \
            ..

RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" emmake make
RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" emmake make install
RUN ls -r /root/install
