FROM playground-php-wasm:base

RUN source /root/emsdk/emsdk_env.sh && \
    env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
        --branch v2.9.10 \
        --single-branch     \
        --depth 1 && \
    cd libxml2 && \
    ./autogen.sh && \
    emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/lib/ &&\
    EMCC_FLAGS=" -sSIDE_MODULE -sSUPPORT_LONGJMP=wasm -fwasm-exceptions" emmake make && \
    emmake make install
