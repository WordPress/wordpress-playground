FROM emscripten/emsdk:3.1.24
SHELL ["/bin/bash", "-c"]
ARG PHP_VERSION=8.0.24
ENV PHP_VERSION ${PHP_VERSION}
ARG WITH_VRZNO="yes"
ENV WITH_VRZNO ${WITH_VRZNO}
ARG WITH_LIBXML=no
ENV WITH_LIBXML ${WITH_LIBXML}
ARG WITH_LIBZIP=yes
ENV WITH_LIBZIP ${WITH_LIBZIP}
ARG WITH_NODEFS=no
ENV WITH_NODEFS ${WITH_NODEFS}
ARG EMSCRIPTEN_ENVIRONMENT=web
ENV EMSCRIPTEN_ENVIRONMENT ${EMSCRIPTEN_ENVIRONMENT}
ENV PKG_CONFIG_PATH /root/lib/lib/pkgconfig
ENV TIMER "(which pv > /dev/null && pv --name '${@}' || cat)"

WORKDIR /root
RUN mkdir lib

RUN set -euxo pipefail;\
    apt-get update; \
    emsdk install latest; \
    apt-get --no-install-recommends -y install \
    build-essential \
    automake-1.15 \
    autoconf \
    libxml2-dev \
    libtool \
    pkgconf \
    bison \
    flex \
    make \
    re2c \
    gdb \
    git \
    pv \
    ca-certificates

RUN touch /root/.configure-flags && \
    touch /root/.emcc-pib-eval-flags && \
    touch /root/.emcc-php-wasm-sources && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.EXTRA_EXPORTED_RUNTIME_METHODS

# Add Libxml2 if needed
RUN if [ "$WITH_LIBXML" = "yes" ]; \
    then \
        env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
            --branch v2.9.10 \
            --single-branch     \
            --depth 1 && \
        cd libxml2 && \
        buildautogen.sh && \
        emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/lib/ &&\
        emmake make && \
        emmake make install; \
        echo -n ' --with-libxml --enable-dom --enable-xml --enable-simplexml' >> /root/.php-configure-flags; \
        echo -n ' -I /root/libxml2' >> /root/.emcc-pib-eval-flags; \
        echo -n ' /root/lib/lib/libxml2.a' >> /root/.emcc-php-wasm-sources; \
    else \
        echo -n ' --without-libxml --disable-dom --disable-xml --disable-simplexml' >> /root/.php-configure-flags; \
    fi

# Add gzip and libzip if needed
COPY ./build-assets/zlib /root/zlib
RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
        cd /root/zlib && \
        emconfigure ./configure --prefix=/root/lib && \
        # emmake make fails after it built the library files – let's ignore the errors \
        (emmake make || true) && \
        emmake make install && \
        cd /root && \
        curl -k https://libzip.org/download/libzip-1.9.2.tar.gz -o libzip-1.9.2.tar.gz && \
        tar -xzf libzip-1.9.2.tar.gz && \
        mv libzip-1.9.2 libzip && \
        cd libzip && \
        mkdir build && \
        cd build && \
        emcmake cmake \
            -DCMAKE_INSTALL_PREFIX=/root/lib \
            -DZLIB_LIBRARY=/root/lib/lib/libz.a \
            -DZLIB_INCLUDE_DIR=/root/lib/include \
            --prefix=/root/lib/ .. && \
        emmake make && \
        emmake make install; \
    fi

RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
        echo -n ' --with-zip' >> /root/.php-configure-flags; \
        echo -n ' -I /root/zlib -I /root/libzip' >> /root/.emcc-pib-eval-flags; \
        echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a' >> /root/.emcc-php-wasm-sources; \
    fi

# Get and patch PHP
# It says php7.4 but it also works with php8
COPY ./build-assets/php7.4.patch /root/
RUN git clone https://github.com/php/php-src.git php-src \
    --branch PHP-$PHP_VERSION   \
    --single-branch          \
    --depth 1 \
    && git apply --no-index /root/php7.4.patch \
    && mkdir -p php-src/preload/Zend \
    && cp php-src/Zend/bench.php php-src/preload/Zend \
    && touch php-src/patched

# Get and patch Sqlite3
COPY ./build-assets/sqlite3-wasm.patch /root/
RUN set -euxo pipefail;\
    wget --no-check-certificate https://sqlite.org/2020/sqlite-amalgamation-3330000.zip; \
    unzip sqlite-amalgamation-3330000.zip; \
    rm sqlite-amalgamation-3330000.zip; \
    mv sqlite-amalgamation-3330000 sqlite3.33-src; \
    git apply --no-index /root/sqlite3-wasm.patch; \
    cp -v sqlite3.33-src/sqlite3.h php-src/main/sqlite3.h; \
    cp -v sqlite3.33-src/sqlite3.c php-src/main/sqlite3.c;

# Add VRZNO if needed
RUN if [ "$WITH_VRZNO" = "yes" ]; \
    then \
        git clone https://github.com/seanmorris/vrzno.git php-src/ext/vrzno \
            --branch DomAccess \
            --single-branch    \
            --depth 1; \
        echo -n ' --enable-vrzno' >> /root/.php-configure-flags; \
        echo -n ' -DWITH_VRZNO=1' >> /root/.emcc-pib-eval-flags; \
        echo -n ', "_exec_callback", "_del_callback"' >> /root/.EXTRA_EXPORTED_FUNCTIONS; \
    fi

# Build the patched PHP
RUN cd php-src/ && PKG_CONFIG_PATH=$PKG_CONFIG_PATH ./buildconf --force

RUN cd php-src/ && emconfigure ./configure \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    --enable-embed=static \
    --with-layout=GNU  \
    --disable-cgi      \
    --disable-cli      \
    --disable-all      \
    --with-sqlite3     \
    --enable-session   \
    --enable-filter    \
    --enable-calendar  \
    --enable-pdo       \
    --with-pdo-sqlite  \
    --disable-rpath    \
    --disable-phpdbg   \
    --without-pear     \
    --with-valgrind=no \
    --without-pcre-jit \
    --enable-bcmath    \
    --enable-ctype     \
    --enable-mbstring  \
    --disable-mbregex  \
    --enable-tokenizer \
    $(cat /root/.php-configure-flags)

RUN cd php-src/ && emmake make -j8

RUN cp -v php-src/.libs/libphp*.la /root/lib/libphp.la
RUN cp -v php-src/.libs/libphp*.a /root/lib/libphp.a

COPY ./build-assets/pib_eval.c /root/

# Build the higher-level PHP bindings
RUN cd php-src/ && \
    emcc -O3 \
    -I .     \
    -I ext   \
    -I ext/pdo_sqlite   \
    -I Zend  \
    -I main  \
    -I TSRM/ \
    $(cat /root/.emcc-pib-eval-flags) \
    /root/pib_eval.c \
    -c -o /root/lib/pib_eval.o 

# Add nodefs when requested
RUN if [ "$WITH_NODEFS" = "yes" ]; then \
        echo -n ' -lnodefs.js' >> /root/.emcc-php-wasm-flags; \
    fi

# Build the final .wasm file
RUN mkdir /root/output
COPY ./build-assets/support-onPreInit.js /root/

RUN export EXPORTED_FUNCTIONS='["_pib_init", "_pib_destroy", "_pib_run", "_pib_refresh", "_main", "_php_embed_init", "_php_embed_shutdown", "_php_embed_shutdown", "_zend_eval_string", "_pib_init_uploaded_files_hash", "_pib_register_uploaded_file", "_pib_destroy_uploaded_files_hash" '"$(cat /root/.EXTRA_EXPORTED_RUNTIME_METHODS)"']'; \
    emcc -O3 \
    -o /root/output/php.js \
    -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8", "FS", "PROXYFS"]' \
    -s INITIAL_MEMORY=1024MB \
    -s ALLOW_MEMORY_GROWTH=1         \
    -s ASSERTIONS=0                  \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
    -s EXPORT_NAME="'PHPLoader'"           \
    -s MODULARIZE=1                  \
    -s INVOKE_RUN=0                  \
        /root/lib/libphp.a \
        /root/lib/pib_eval.o \
        $(cat /root/.emcc-php-wasm-sources) \
    $(cat /root/.emcc-php-wasm-flags) \
    --pre-js /root/support-onPreInit.js \
    -s ENVIRONMENT=$EMSCRIPTEN_ENVIRONMENT \
    -s FORCE_FILESYSTEM=1
