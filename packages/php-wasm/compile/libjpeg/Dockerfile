FROM playground-php-wasm:base

ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
    fi

RUN wget https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.0.3/libjpeg-turbo-3.0.3.tar.gz -O libjpeg.tar.gz
RUN tar -xzf libjpeg.tar.gz
WORKDIR /root/libjpeg-turbo-3.0.3
RUN ls -a
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        CMAKE_INSTALL_DEFAULT_PREFIX="/root/lib " \
        emcmake cmake -G"Unix Makefiles" -DCMAKE_INSTALL_DEFAULT_PREFIX=/root/lib
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE $JSPI_FLAGS" emmake make
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_FLAGS="$JSPI_FLAGS" emmake make install
RUN sed -i 's/lib32/lib/g' /root/lib/lib32/pkgconfig/libjpeg.pc
# @TODO: Do not remove dependencies like this – it's too easy to miss something.
#        Instead, source them from another directory and end up with a clean build.
RUN rm -rf /root/lib/lib/pkgconfig /root/lib/lib/libz.a /root/lib/include/zconf.h /root/lib/include/zlib.h