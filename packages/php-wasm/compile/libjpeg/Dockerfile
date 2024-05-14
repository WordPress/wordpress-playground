FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/dist/root/lib/include /root/lib/include
COPY ./libz/dist/root/lib/lib /root/lib/lib

RUN wget https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.0.3/libjpeg-turbo-3.0.3.tar.gz -O libjpeg.tar.gz
RUN tar -xzf libjpeg.tar.gz
WORKDIR /root/libjpeg-turbo-3.0.3
RUN ls -a
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emcmake cmake -G"Unix Makefiles" -DCMAKE_PREFIX_PATH=/root/lib
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE" emmake make
RUN source /root/emsdk/emsdk_env.sh && emmake make install
