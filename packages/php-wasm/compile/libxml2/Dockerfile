FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ../libz/dist/root/lib/include /root/lib/include
COPY ../libz/dist/root/lib/lib /root/lib/lib

RUN source /root/emsdk/emsdk_env.sh && \
    env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
        --branch v2.9.10 \
        --single-branch     \
        --depth 1 && \
    cd libxml2 && \
    ./autogen.sh && \
    emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/install/ &&\
    EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
    emmake make install

RUN echo 1
RUN ls -R /root/install