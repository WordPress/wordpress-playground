FROM playground-php-wasm:base

ARG LIBZIP_VERSION
ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

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
        JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; fi) && \
        EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" emmake make
RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && \
        EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE $JSPI_FLAGS" emmake make install
RUN ls -r /root/install
