FROM playground-php-wasm:base

ARG JSPI


ENV PKG_CONFIG_PATH=/root/install/lib/pkgconfig:$PKG_CONFIG_PATH
ENV ICU_CFLAGS="-I/root/lib/include"
ENV CFLAGS="-I/root/icu/source/common -I/root/lib/lib/icu/source/common -fPIC"
ENV CXXFLAGS="-I/root/icu/source/common -I/root/lib/lib/icu/source/common -fPIC"
ENV CPPFLAGS="-I/root/lib/include"
ENV LDFLAGS="-L/root/lib/lib -fPIC"
ENV JSPI_FLAGS=""

RUN set -eux; \
    wget https://github.com/unicode-org/icu/releases/download/release-74-2/icu4c-74_2-src.tgz && \
    tar -xvf icu4c-74_2-src.tgz && \
    rm icu4c-74_2-src.tgz

WORKDIR /root/icu/source

RUN mkdir -p /root/icu-native-build \
    && cd /root/icu-native-build \
    && ../icu/source/configure \
         --disable-shared \
         --enable-static \
    && make clean \
    && make -j"$(nproc)"

RUN set -eux; \
    cd /root/icu/source/config && \
    cp mh-linux mh-unknown && \
    sed -i 's/^CC *=.*/CC = emcc/' mh-unknown && \
    sed -i 's/^CXX *=.*/CXX = em++/' mh-unknown && \
    sed -i 's/^AR *=.*/AR = emar/' mh-unknown && \
    sed -i 's/^RANLIB *=.*/RANLIB = emranlib/' mh-unknown && \
    sed -i 's/^SHARED_FLAGS *=.*/SHARED_FLAGS =/' mh-unknown

RUN set -eux; \
    cd /root/icu/source && \
    source /root/emsdk/emsdk_env.sh && \
    curl -L -o config.sub 'https://git.savannah.gnu.org/gitweb/?p=config.git;a=blob_plain;f=config.sub' && \
    curl -L -o config.guess 'https://git.savannah.gnu.org/gitweb/?p=config.git;a=blob_plain;f=config.guess' && \
    chmod +x config.sub config.guess && \
    sed -i '/-linux-gnu\*)/a \
        -emscripten*) os=-emscripten ;;' config.sub && \
    mkdir -p /root/install && \
    emconfigure ./configure \
        --host=wasm32-unknown-emscripten \
        --prefix=/root/install \
        --disable-shared \
        --enable-static \
        --disable-extras \
        --disable-tests \
        --disable-samples \
        --with-cross-build=/root/icu-native-build \
        --with-data-packaging=files \
        CC=emcc CXX=em++ AR=emar RANLIB=emranlib && \
    emmake make clean && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
     EMCC_SKIP="-lz" EMCC_FLAGS=" -fPIC -sSIDE_MODULE $JSPI_FLAGS" emmake make -j"$(nproc)" && \
    mkdir -p /root/install/share/icu/74.2/icudt74l/{brkitr,coll,curr,lang,rbnf,region,translit,unit,zone}

RUN cd /root/icu/source && \
        source /root/emsdk/emsdk_env.sh && \
        emmake make install

COPY gettext-0.21.1.tar.gz /root

RUN set -eux; \
    cd /tmp && \
    tar -xvf /root/gettext-0.21.1.tar.gz && \
    cd gettext-0.21.1/gettext-runtime && \
    source /root/emsdk/emsdk_env.sh && \
    emconfigure ./configure \
      --host=wasm32-unknown-emscripten \
      --disable-shared \
      --enable-static \
      --disable-java \
      --disable-native-java \
      --disable-csharp \
      --disable-openmp \
      --disable-c++ \
      --disable-threads \
      --without-emacs \
      --without-git \
      --prefix=/root/lib/ && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
     EMCC_SKIP="-lz" EMCC_FLAGS=" -fPIC -sSIDE_MODULE $JSPI_FLAGS" emmake make -j"$(nproc)" V=1

RUN cd /tmp/gettext-0.21.1/gettext-runtime && \
        source /root/emsdk/emsdk_env.sh && \
	    emmake make install

RUN cp /tmp/gettext-0.21.1/gettext-runtime/intl/.libs/libgnuintl.a /root/install/lib/libintl.a
