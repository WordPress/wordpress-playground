FROM playground-php-wasm:base


ARG JSPI


RUN set -euxo pipefail && \
    wget https://github.com/unicode-org/icu/releases/download/release-74-2/icu4c-74_2-src.tgz && \
    tar -xvf icu4c-74_2-src.tgz && \
    rm -rf /root/icu/source/data/ && \
    rm icu4c-74_2-src.tgz


RUN set -euxo pipefail && \
    wget https://github.com/unicode-org/icu/releases/download/release-74-2/icu4c-74_2-data.zip && \
    unzip icu4c-74_2-data.zip -d /root/icu/source && \
    rm icu4c-74_2-data.zip


RUN set -euxo pipefail && \
    mkdir -p /root/native && \
    cd /root/native && \
    /root/icu/source/runConfigureICU Linux \
        --disable-shared \
        --enable-static && \
    make -j"$(nproc)" && \
    make install


RUN set -euxo pipefail && \
    cd /root/icu/source && \
    mkdir -p /root/lib && \
    source /root/emsdk/emsdk_env.sh && \
    emconfigure ./configure \
        --build=i386-pc-linux-gnu \
        --target=wasm32-unknown-emscripten \
        --prefix=/root/lib \
        --with-cross-build=/root/native \
        --with-data-packaging=archive \
		--disable-extras \
        --disable-shared \
        --enable-static && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE $JSPI_FLAGS " emmake make -j"$(nproc)" && \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE $JSPI_FLAGS " emmake make install -i;


RUN set -euxo pipefail && \
    mkdir -p /root/lib/data && \
    mv /root/lib/share/icu/74.2/icudt74l.dat /root/lib/data
