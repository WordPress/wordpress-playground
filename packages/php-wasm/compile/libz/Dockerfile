FROM playground-php-wasm:base

COPY ./libz/zlib-src /root/zlib
RUN chmod a+x /root/zlib/configure
RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/zlib && \
    emconfigure ./configure --prefix=/root/lib && \
    # emmake make fails, but only after it builds the library files.
    # Let's just ignore the errors and proceed with the built libraries.
    (EMCC_FLAGS="-sSIDE_MODULE -sSUPPORT_LONGJMP=wasm -fwasm-exceptions " emmake make || true) && \
    EMCC_FLAGS="-sSIDE_MODULE -sSUPPORT_LONGJMP=wasm -fwasm-exceptions " emmake make install
