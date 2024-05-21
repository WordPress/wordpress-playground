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
        CMAKE_INSTALL_DEFAULT_PREFIX="/root/lib " \
        emcmake cmake -G"Unix Makefiles" -DCMAKE_INSTALL_DEFAULT_PREFIX=/root/lib
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE" emmake make
RUN source /root/emsdk/emsdk_env.sh && emmake make install
RUN sed -i 's/lib32/lib/g' /root/lib/lib32/pkgconfig/libjpeg.pc
# @TODO: Do not remove dependencies like this – it's too easy to miss something.
#        Instead, source them from another directory and end up with a clean build.
RUN rm -rf /root/lib/lib/pkgconfig /root/lib/lib/libz.a /root/lib/include/zconf.h /root/lib/include/zlib.h