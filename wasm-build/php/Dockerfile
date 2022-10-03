FROM trzeci/emscripten:1.39.18-fastcomp
SHELL ["/bin/bash", "-c"]
ARG VRZNO_FLAG="--disable-vrzno"
ENV VRZNO_FLAG ${VRZNO_FLAG}
ARG PHP_VERSION=8.0.24
ENV PHP_VERSION ${PHP_VERSION}

WORKDIR /root
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

# Get and patch PHP
COPY ./docker-build-files/php7.4.patch /root/
RUN git clone https://github.com/php/php-src.git php-src \
    --branch PHP-$PHP_VERSION   \
    --single-branch          \
    --depth 1 \
    && git apply --no-index /root/php7.4.patch \
    && mkdir -p php-src/preload/Zend \
    && cp php-src/Zend/bench.php php-src/preload/Zend \
    && touch php-src/patched

# Build the patched PHP
RUN cd php-src/ && PKG_CONFIG_PATH=$PKG_CONFIG_PATH ./buildconf --force

# RUN ls /root/lib/lib/; sleep 50

RUN cd php-src/ && PKG_CONFIG_PATH=$PKG_CONFIG_PATH emconfigure ./configure \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    --enable-embed=static \
    --with-layout=GNU  \
    --disable-all      \
    --without-sqlite3     \
    --without-zlib     \
    --disable-session   \
    --disable-filter    \
    --disable-calendar  \
    --disable-dom       \
    --disable-pdo       \
    --without-pdo-sqlite  \
    --without-tsrm-pthreads  \
    --disable-rpath    \
    --disable-phpdbg   \
    --without-pear     \
    --without-pcre-jit \
    --disable-bcmath    \
    --disable-shared    \
    --disable-libgcc    \
    --disable-rpath    \
    --disable-static    \
    --without-gnu-ld    \
    --disable-cli    \
    --disable-cgi    \
    --disable-phpdbg    \
    --without-servlet    \
    --disable-json      \
    --disable-ctype     \
    --disable-mbstring  \
    --disable-mbregex  \
    --disable-tokenizer \
    --disable-xml       \
    --disable-simplexml \
    --without-gd

RUN cd php-src/ && emmake make -j8

RUN cp -v php-src/.libs/libphp.la /root/lib/libphp7.la
RUN cp -v php-src/.libs/libphp.a /root/lib//libphp7.a

COPY ./docker-build-files/pib_eval.c /root/

RUN cd php-src/ && \
    emcc -O3 \
    -I .     \
    -I Zend  \
    -I main  \
    -I TSRM/ \
    $DEFINES \
    /root/pib_eval.c \
    -o /root/lib/pib_eval.o;

