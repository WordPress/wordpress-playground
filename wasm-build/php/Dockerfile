FROM trzeci/emscripten:1.39.18-fastcomp
SHELL ["/bin/bash", "-c"]

WORKDIR /root
COPY ./docker-build-files/* /root/
RUN mkdir lib

RUN set -euxo pipefail;\
    apt-get update; \
    emsdk install latest; \
    apt-get --no-install-recommends -y install \
    build-essential \
    automake-1.15 \
    libxml2-dev \
    autoconf \
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

ENV PKG_CONFIG_PATH /root/lib/lib/pkgconfig
ENV PRELOAD_ASSETS preload/
ENV ENVIRONMENT    web
ENV INITIAL_MEMORY 1024MB
ENV EMCC_ALLOW_FASTCOMP   1
ENV TIMER "(which pv > /dev/null && pv --name '${@}' || cat)"

# Get and patch PHP 7.0.30
RUN git clone https://github.com/php/php-src.git php7.4-src \
    --branch PHP-7.4.30   \
    --single-branch          \
    --depth 1 \
    && git apply --no-index /root/php7.4.patch \
    && mkdir -p php7.4-src/preload/Zend \
    && cp php7.4-src/Zend/bench.php php7.4-src/preload/Zend \
    && touch php7.4-src/patched


# Get and patch Sqlite3
RUN set -euxo pipefail;\
    wget --no-check-certificate https://sqlite.org/2020/sqlite-amalgamation-3330000.zip; \
    unzip sqlite-amalgamation-3330000.zip; \
    rm sqlite-amalgamation-3330000.zip; \
    mv sqlite-amalgamation-3330000 sqlite3.33-src; \
    git apply --no-index /root/sqlite3-wasm.patch; \
    cp -v sqlite3.33-src/sqlite3.h php7.4-src/main/sqlite3.h; \
    cp -v sqlite3.33-src/sqlite3.c php7.4-src/main/sqlite3.c;

# Get VRZNO
RUN git clone https://github.com/seanmorris/vrzno.git php7.4-src/ext/vrzno \
    --branch DomAccess \
    --single-branch          \
    --depth 1

# Get and build Libxml2
RUN env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
    --branch v2.9.10 \
    --single-branch     \
    --depth 1;

RUN cd libxml2 && ./autogen.sh
RUN cd libxml2 && emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/lib/
RUN cd libxml2 && emmake make
RUN cd libxml2 && emmake make install

# Build the patched PHP
RUN cd php7.4-src/ && PKG_CONFIG_PATH=$PKG_CONFIG_PATH ./buildconf --force

# RUN ls /root/lib/lib/; sleep 50

RUN cd php7.4-src/ && PKG_CONFIG_PATH=$PKG_CONFIG_PATH emconfigure ./configure \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    --enable-embed=static \
    --with-layout=GNU  \
    --with-libxml      \
    --disable-cgi      \
    --disable-cli      \
    --disable-all      \
    --with-sqlite3     \
    --enable-session   \
    --enable-filter    \
    --enable-calendar  \
    --enable-dom       \
    --enable-pdo       \
    --with-pdo-sqlite  \
    --disable-rpath    \
    --disable-phpdbg   \
    --without-pear     \
    --with-valgrind=no \
    --without-pcre-jit \
    --enable-bcmath    \
    --enable-json      \
    --enable-ctype     \
    --enable-mbstring  \
    --disable-mbregex  \
    --enable-tokenizer \
    --enable-vrzno     \
    --enable-xml       \
    --enable-simplexml \
    --with-gd

RUN cd php7.4-src/ && emmake make -j8

RUN cp -v php7.4-src/.libs/libphp7.la php7.4-src/.libs/libphp7.a /root/lib/

RUN cd php7.4-src/ && emcc -O3 \
    -I .     \
    -I Zend  \
    -I main  \
    -I TSRM/ \
    -I /root/libxml2 \
    /root/pib_eval.c \
    -o /root/lib/pib_eval.o;
