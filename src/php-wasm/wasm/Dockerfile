# Originally forked from https://github.com/seanmorris/php-wasm
# ubuntu:lunar supports amd64 and arm64 (Apple Silicon) while
# emscripten/emsdk:3.1.24 supports amd64 only.
FROM ubuntu:lunar as emscripten
# replace aarch64-unknown-linux-gnu with linux-generic64?

SHELL ["/bin/bash", "-c"]

ENV PKG_CONFIG_PATH /root/lib/lib/pkgconfig
ENV TIMER "(which pv > /dev/null && pv --name '${@}' || cat)"

WORKDIR /root
RUN mkdir lib

RUN set -euxo pipefail;\
    apt-get update; \
    apt-get --no-install-recommends -y install \
    build-essential \
    automake \
    autoconf \
    libxml2-dev \
    libtool \
    pkgconf \
    flex \
    make \
    re2c \
    gdb \
    git \
    pv \
    ca-certificates \
    curl \
    wget \
    unzip \
    cmake \
    python3

# Install Emscripten from the repository. We'd use the official
# Docker image, but there is no arm64 image available which makes
# the build take forever on Apple Silicon.
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN git clone https://github.com/emscripten-core/emsdk.git && \
    ./emsdk/emsdk install latest && \
    /root/emsdk/emsdk activate latest

RUN mkdir -p /root/lib/lib /root/lib/include /root/lib/share /root/lib/bin

# Create a script to capture libraries build in other steps
RUN echo $'#!/bin/bash\n\
for dir in $(ls $1); do \n\
    mkdir -p /root/lib/$dir/ && \n\
    cp -r /root/$1/$dir/* /root/lib/$dir/ 2>/dev/null || :; \n\
    done ' > /root/copy-lib.sh
RUN chmod a+x /root/copy-lib.sh

# Patch emcc to allow skipping flags and passing additional flags using environment variables.
# 
# We're compiling libraries statically using emscripten's -sSIDE_MODULE. It differs from the usual unix
# process as we're *not* supposed to link intermediate libraries against their dependencies. Instead,
# We'll provide all the static libraries in the final linking step.
# 
# Unfortunately, most Makefiles stubbornly add -lz, -lxml2, etc. to the intermediate
# emcc calls, which causes the build to fail. This patch:
# * Enables force-removing linker options when running emcc
# * Enables adding -sSIDE_MODULE when running emcc
#
# Usage:
#  EMCC_SKIP="-lz -lxml2" EMCC_FLAGS="-sSIDE_MODULE" emmake make
#               ↑                            ↑
#    ┌──────────┴─────────────┐   ┌──────────┴─────────────┐
#    │  skip those flags when │   │  add these flags when  │
#    │      calling emcc      │   │    calling emcc        │
#    └────────────────────────┘   └────────────────────────┘
RUN cp /root/emsdk/upstream/emscripten/emcc /root/emsdk/upstream/emscripten/emcc2 && \
    cp /root/emsdk/upstream/emscripten/emcc.py /root/emsdk/upstream/emscripten/emcc2.py && \
    echo $'#!/bin/bash\n\
for arg do shift\n\ 
    [[ " ${EMCC_SKIP[*]} " =~ " ${arg} " ]] && continue \n\ 
    set -- "$@" "$arg" \n\
done\n\
/root/emsdk/upstream/emscripten/emcc2 "$@" $EMCC_FLAGS \n' > /root/emsdk/upstream/emscripten/emcc && \
    chmod a+x /root/emsdk/upstream/emscripten/emcc

# Compile libz
FROM emscripten AS emscripten-libz
COPY ./build-assets/zlib /root/zlib
RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/zlib && \
    emconfigure ./configure --prefix=/root/lib && \
    # emmake make fails after it built the library files – let's ignore the errors \
    (emmake make || true) && \
    emmake make install

# Compile libzip
FROM emscripten AS emscripten-libzip
ARG PHP_VERSION
COPY --from=emscripten-libz /root/lib /root/lib-libz
RUN /root/copy-lib.sh lib-libz
RUN     if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            export LIBZIP_VERSION=1.2.0; \
        else \
            export LIBZIP_VERSION=1.9.2; \
        fi && \
        cd /root && \
        curl -k https://libzip.org/download/libzip-$LIBZIP_VERSION.tar.gz -o libzip-$LIBZIP_VERSION.tar.gz && \
        tar -xzf libzip-$LIBZIP_VERSION.tar.gz && \
        mv libzip-$LIBZIP_VERSION libzip;
RUN mkdir -p libzip/build
RUN cd libzip/build && \
        source /root/emsdk/emsdk_env.sh && \
        emcmake cmake \
            -DCMAKE_INSTALL_PREFIX=/root/lib \
            -DZLIB_LIBRARY=/root/lib/lib/libz.a \
            -DZLIB_INCLUDE_DIR=/root/lib/include \
            ..
RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && emmake make
RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && emmake make install

# Compile ncurses
FROM emscripten AS emscripten-ncurses
COPY ./build-assets/ncurses.patch /root/
RUN     set -euxo pipefail &&\
        # Install libncurses
        wget https://ftp.gnu.org/gnu/ncurses/ncurses-6.2.tar.gz && \
        tar -xzf ncurses-6.2.tar.gz && \
        # https://github.com/jamesbiv/ncurses-emscripten
        # https://github.com/ilyaigpetrov/ncurses-for-emscripten/blob/27fefcd3784e7375212b75f444def4518ddabc21/COMPILE.md
        cd ncurses-6.2 && \
        ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build aarch64-unknown-linux-gnu \
            --prefix=/root/lib/ \
            --enable-database && \
        make && \
        make install  && \
        cd ncurses  && \
        cp make_hash make_hash_x86  && \
        cp make_keys make_keys_x86  && \
        cp report_offsets report_offsets_x86  && \
        cd /root/ncurses-6.2 && \
        make clean && \
        git apply --no-index /root/ncurses.patch && \
        perl -pi.bak -e 's/\.\/make_hash/.\/make_hash_x86/g' ncurses/tinfo/MKcaptab.sh && \
        perl -pi.bak -e 's/\.\/make_hash/.\/make_hash_x86/g' ncurses/tinfo/MKuserdefs.sh && \
        perl -pi.bak -e 's/make_hash\$\(BUILD_EXEEXT/make_hash_x86\$(BUILD_EXEEXT/g' ncurses/Makefile.in && \
        perl -pi.bak -e 's/make_keys\$\(BUILD_EXEEXT/make_keys_x86\$(BUILD_EXEEXT/g' ncurses/Makefile.in && \
        perl -pi.bak -e 's/\.\/report_offsets\$\(BUILD_EXEEXT/.\/report_offsets_x86\$(BUILD_EXEEXT/g' ncurses/Makefile.in && \
        source /root/emsdk/emsdk_env.sh && \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build aarch64-unknown-linux-gnu \
            --prefix=/root/lib && \
        perl -pi.bak -e 's/^\s+cd man.*$//g' Makefile && \
        perl -pi.bak -e 's/^\s+cd progs.*$//g' Makefile && \
        perl -pi.bak -e 's/^\s+cd test.*$//g' Makefile && \
        perl -pi.bak -e 's/^\s+cd misc.*$//g' Makefile && \
        perl -pi.bak -e 's/^\s+cd c\+\+.*$//g' Makefile && \
        emmake make && \
        emmake make install


# Compile libedit (readline alternative)
FROM emscripten AS emscripten-libedit
COPY --from=emscripten-ncurses /root/lib /root/lib-ncurses
RUN /root/copy-lib.sh lib-ncurses
RUN     wget https://www.thrysoee.dk/editline/libedit-20221030-3.1.tar.gz && \
        tar -xzf libedit-20221030-3.1.tar.gz  && \
        source /root/emsdk/emsdk_env.sh && \
        cd libedit-20221030-3.1 && \
        CFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
        CPPFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
        LDFLAGS="-L/root/lib/lib " emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build aarch64-unknown-linux-gnu \
            --prefix=/root/lib/ && \
        # -D__STDC_ISO_10646__=201103L is needed because
        # Libedit build fails when __STDC_ISO_10646__ is not defined, and that is
        # the case when compiling with musl toolchains.
        # Musl is ISO 10646 compliant but doesn't define __STDC_ISO_10646__, so
        # let's define it manually. Learn more at:
        # http://lists.busybox.net/pipermail/buildroot/2016-January/149100.html
        EMCC_SKIP="-lc -lncurses " EMCC_FLAGS=" -sSIDE_MODULE -D__STDC_ISO_10646__=201103L " \
        emmake make && \
        emmake make install

# Compile Libxml2
FROM emscripten AS emscripten-libxml
RUN source /root/emsdk/emsdk_env.sh && \
    env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
        --branch v2.9.10 \
        --single-branch     \
        --depth 1 && \
    cd libxml2 && \
    ./autogen.sh && \
    emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/lib/ &&\
    EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
    emmake make install

# Compile Bison 2.7 (for PHP  <=7.3)
FROM emscripten AS emscripten-bison-2-7
COPY ./build-assets/bison27.patch /root/bison27.patch
RUN wget http://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz && \
    tar -xvf bison-2.7.tar.gz && \
    rm bison-2.7.tar.gz && \
    cd bison-2.7 && \
    git apply --no-index /root/bison27.patch && \
    ./configure --prefix=/usr/local/bison --with-libiconv-prefix=/usr/local/libiconv/ && \
    make && \
    make install

# Compile Sqlite3
FROM emscripten AS emscripten-sqlite3
COPY --from=emscripten-libz /root/lib /root/lib-libz
RUN /root/copy-lib.sh lib-libz
RUN     set -euxo pipefail &&\
        wget --no-check-certificate https://www.sqlite.org/2022/sqlite-autoconf-3400100.tar.gz && \
        tar -xzvf sqlite-autoconf-3400100.tar.gz && \
        cd sqlite-autoconf-3400100 && \
        source /root/emsdk/emsdk_env.sh && \
        emconfigure ./configure \
            --build aarch64-unknown-linux-gnu \
            --target wasm32-unknown-emscripten \
            --prefix=/root/lib/ && \
        EMCC_SKIP="-lc" EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
        emmake make install

# Compile OpenSSL
# Inspired by: https://github.com/TrueBitFoundation/wasm-ports/blob/79aac7272729baaf131ca0c49cc3b684eedff835/openssl.sh
FROM emscripten AS emscripten-openssl
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    wget https://www.openssl.org/source/openssl-1.1.0h.tar.gz && \
    tar xf openssl-1.1.0h.tar.gz && \
    cd openssl-1.1.0h && \
    rm crypto/bn/asm/* && \
    emconfigure ./Configure dist -DHAVE_FORK=0 -DOPENSSL_NO_AFALGENG=1 no-threads --prefix=/root/lib && \
    sed -i 's|^CROSS_COMPILE.*$|CROSS_COMPILE=|g' Makefile && \
    EMCC_FLAGS=" -sSIDE_MODULE " emmake make -j 12 build_generated libssl.a libcrypto.a && \
    EMCC_FLAGS=" -sSIDE_MODULE " emmake make install && \
    cp -R include/openssl /root/lib/include && \
    cp libcrypto.a libssl.a /root/lib/lib

# Compile libcurl
FROM emscripten AS emscripten-libcurl
COPY --from=emscripten-openssl /root/lib /root/lib-ssl
RUN /root/copy-lib.sh lib-ssl
RUN wget https://curl.se/download/curl-7.87.0.tar.gz -O curl-7.87.0.tar.gz
RUN tar -xzf curl-7.87.0.tar.gz 
WORKDIR /root/curl-7.87.0
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build aarch64-unknown-linux-gnu \
            --target wasm32-unknown-emscripten \
            --with-openssl \
    --prefix=/root/lib/
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz -lssl" EMCC_FLAGS="-sSIDE_MODULE" emmake make
RUN source /root/emsdk/emsdk_env.sh && emmake make install

# Compile libpng
FROM emscripten AS emscripten-libpng
COPY --from=emscripten-libz /root/lib /root/lib-libz
RUN /root/copy-lib.sh lib-libz
RUN     wget http://prdownloads.sourceforge.net/libpng/libpng-1.6.39.tar.gz?download -O libpng-1.6.39.tar.gz
RUN tar -xzf libpng-1.6.39.tar.gz 
WORKDIR /root/libpng-1.6.39
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build aarch64-unknown-linux-gnu \
            --target wasm32-unknown-emscripten \
            --prefix=/root/lib/
RUN source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE" emmake make
RUN source /root/emsdk/emsdk_env.sh && emmake make install

# Clone PHP
FROM emscripten AS emscripten-php-src
ARG PHP_VERSION
RUN git clone https://github.com/php/php-src.git php-src \
    --branch PHP-$PHP_VERSION   \
    --single-branch          \
    --depth 1;


# Build PHP
FROM emscripten AS emscripten-php

# The PHP version to build.
# This value must point to an existing branch of the
# https://github.com/php/php-src.git repository when prefixed
# with "PHP-".
# For example, "7.4.0" is valid because the branch PHP-7.4.0 exists,
# but just "7" is invalid because there's no branch PHP-7.
ARG PHP_VERSION

# The PHP extensions to build:
ARG WITH_VRZNO
ARG WITH_LIBXML
ARG WITH_LIBZIP
ARG WITH_LIBPNG
ARG WITH_MBSTRING
ARG WITH_CLI_SAPI
ARG WITH_SQLITE
ARG WITH_MYSQL
ARG WITH_OPENSSL
ARG WITH_CURL

# Whether to include the NODEFS JavaScript library.
# It's useful for loading files and mounting directories
# from the local filesystem.
ARG WITH_NODEFS=no

# The platform to build for: web or node
ARG EMSCRIPTEN_ENVIRONMENT=web

RUN touch /root/.configure-flags && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.emcc-php-wasm-sources && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.EXPORTED_FUNCTIONS

COPY --from=emscripten-php-src /root/php-src /root/php-src
RUN cd php-src && ./buildconf --force

# Copy over libz files
COPY --from=emscripten-libz /root/lib /root/lib-libz
RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
        /root/copy-lib.sh lib-libz; \
    fi;

# Add libzip if needed
COPY --from=emscripten-libzip /root/lib /root/lib-libzip
RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
        /root/copy-lib.sh lib-libzip && \
        if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            apt install -y zlib1g zlib1g-dev; \
            echo -n ' --enable-zip --with-libzip=/root/lib ' >> /root/.php-configure-flags; \
            echo -n ' -I /root/zlib -I /root/libzip ' >> /root/.emcc-php-wasm-flags; \
            echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a' >> /root/.emcc-php-wasm-sources; \
            cp /root/lib/lib/libzip/include/zipconf.h /root/lib/lib; \
            cp /root/lib/lib/libzip/include/zipconf.h /root/lib/include; \
            echo '#define LIBZIP_VERSION "1.2.0"' >> /root/lib/include/zipconf.h; \
            cp /root/lib/include/*.h /root/php-src; \
        else \
            echo -n ' --with-zip' >> /root/.php-configure-flags; \
            echo -n ' -I /root/zlib -I /root/libzip' >> /root/.emcc-php-wasm-flags; \
            echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a' >> /root/.emcc-php-wasm-sources; \
        fi && \
        perl -pi.bak -e 's/pharcmd=pharcmd/pharcmd=/g' /root/php-src/configure && \
        perl -pi.bak -e 's/pharcmd_install=install-pharcmd/pharcmd_install=/g' /root/php-src/configure; \
    fi;

# Add ncurses if needed
COPY --from=emscripten-ncurses /root/lib /root/lib-ncurses
RUN if [ "$WITH_CLI_SAPI" = "yes" ]; \
    then \
        /root/copy-lib.sh lib-ncurses; \
    else \
        echo -n ' --disable-cli ' >> /root/.php-configure-flags; \
    fi;

# Add libedit if needed
COPY --from=emscripten-libedit /root/lib /root/lib-libedit
RUN if [ "$WITH_CLI_SAPI" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-libedit && \
        # Configure build flags
        echo -n ' --enable-phar --enable-cli=static --enable-readline --with-libedit=/root/lib ' >> /root/.php-configure-flags && \
        echo -n ' sapi/cli/php_cli_process_title.c sapi/cli/ps_title.c sapi/cli/php_http_parser.c sapi/cli/php_cli_server.c sapi/cli/php_cli.c ' \
            >> /root/.emcc-php-wasm-sources && \
        echo -n ', "_run_cli", "_wasm_add_cli_arg"' >> /root/.EXPORTED_FUNCTIONS && \
        echo -n ' -DWITH_CLI_SAPI=1 -lncurses -ledit ' >> /root/.emcc-php-wasm-flags; \
    else \
        echo -n ' --disable-cli ' >> /root/.php-configure-flags; \
    fi;

# Add Libxml2 if needed
COPY --from=emscripten-libxml /root/lib /root/lib-libxml
RUN if [ "$WITH_LIBXML" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-libxml && \
        echo -n ' --enable-libxml --with-libxml --with-libxml-dir=/root/lib --enable-dom --enable-xml --enable-simplexml --enable-xmlwriter' >> /root/.php-configure-flags; \
        echo -n ' -I /root/libxml2 -lxml2' >> /root/.emcc-php-wasm-flags; \
        echo -n ' /root/lib/lib/libxml2.a' >> /root/.emcc-php-wasm-sources; \
        # Libxml check is wrong in PHP < 7.4.0.
        # In the regular cc it's just a warning,
        # but in the emscripten's emcc that's an error:
        perl -pi.bak -e "s/char xmlInitParser/void xmlInitParser/g" /root/php-src/configure; \
        # On PHP < 7.1.0, the dom_iterators.c file implicitly converts *char to const *char causing emcc error
        if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "0" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            perl -pi.bak -e 's/xmlHashScan\(ht, itemHashScanner, iter\);/xmlHashScan(ht, (xmlHashScanner)itemHashScanner, iter);/g' /root/php-src/ext/dom/dom_iterators.c; \
        fi; \
    else \
        echo -n ' --disable-libxml --without-libxml --disable-dom --disable-xml --disable-simplexml --disable-xmlwriter' >> /root/.php-configure-flags; \
    fi

# Add sqlite3 if needed
COPY --from=emscripten-sqlite3 /root/lib /root/lib-sqlite3
RUN if [ "$WITH_SQLITE" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-sqlite3 && \
        echo -n ' --with-sqlite3 --enable-pdo --with-pdo-sqlite ' >> /root/.php-configure-flags && \
        echo -n ' -I ext/pdo_sqlite ' >> /root/.emcc-php-wasm-flags; \
        if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -ge "4" ]] || [ "${PHP_VERSION:0:1}" -eq "8" ]; then \
            echo -n ' -lsqlite3 ' >> /root/.emcc-php-wasm-flags; \
        fi; \
    fi;

# Add libpng if needed
COPY --from=emscripten-libpng /root/lib /root/lib-libpng
RUN if [ "$WITH_LIBPNG" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-libpng && \
        echo -n ' --with-png-dir=/root/lib --with-gd --enable-gd ' >> /root/.php-configure-flags && \
        echo -n ' -I /root/zlib -I /root/libpng16 -lz -lpng16 ' >> /root/.emcc-php-wasm-flags; \
    fi;

# Add openssl if needed
COPY --from=emscripten-openssl /root/lib /root/lib-openssl
RUN if [ "$WITH_OPENSSL" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-openssl && \
        echo -n ' --with-openssl=/root/lib ' >> /root/.php-configure-flags && \
        echo -n ' -lssl -lcrypto ' >> /root/.emcc-php-wasm-flags; \
    fi;

# Add curl if needed
# COPY --from=emscripten-libcurl /root/lib /root/lib-curl
# RUN if [ "$WITH_CURL" = "yes" ]; \
#     then \
#         bash /root/copy-lib.sh lib-curl; \
#         echo -n ' --with-curl ' >> /root/.php-configure-flags && \
#         echo -n ' -lcurl ' >> /root/.emcc-php-wasm-flags; \
#     fi;

# PHP <= 7.3 requires Bison 2.7
# PHP >= 7.4 and Bison 3.0
COPY --from=emscripten-bison-2-7 /usr/local/bison /root/linked-bison-27
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
        mv /root/linked-bison-27 /usr/local/bison && \
        ln -s /usr/local/bison/bin/bison /usr/bin/bison && \
        ln -s /usr/local/bison/bin/yacc /usr/bin/yacc; \
    else \
        apt install -y bison; \
    fi;

# Add mbstring if needed
RUN if [ "$WITH_MBSTRING" = "yes" ]; \
    then echo -n ' --enable-mbstring ' >> /root/.php-configure-flags; \
    else echo -n ' --disable-mbstring ' >> /root/.php-configure-flags; \
    fi;

# Get and patch PHP
COPY ./build-assets/php*.patch /root/
RUN cd /root && \
    git apply --no-index /root/php${PHP_VERSION:0:3}.patch -v && \
    touch php-src/patched

# Add VRZNO if needed
RUN if [ "$WITH_VRZNO" = "yes" ]; \
    then \
        git clone https://github.com/seanmorris/vrzno.git php-src/ext/vrzno \
            --branch DomAccess \
            --single-branch    \
            --depth 1; \
        echo -n ' --enable-vrzno' >> /root/.php-configure-flags; \
        echo -n ' -DWITH_VRZNO=1' >> /root/.emcc-php-wasm-flags; \
        echo -n ', "_exec_callback", "_del_callback"' >> /root/.EXPORTED_FUNCTIONS; \
    fi

# Install Mysql support if needed
RUN if [ "$WITH_MYSQL" = "yes" ]; then \
        echo -n ' --enable-mysql --enable-pdo --with-pdo-mysql --with-mysqli ' >> /root/.php-configure-flags; \
    fi

# Build the patched PHP
WORKDIR /root/php-src
RUN source /root/emsdk/emsdk_env.sh && \
    export OPENSSL_CFLAGS="-I/root/lib/include" && \
    emconfigure ./configure \
    PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
    # Fibers are a PHP 8.1+ feature. They are compiled as 
    # a custom assembly implementation by default. However,
    # that implementation does not work with emscripten.
    #
    # The line below disables it, forcing PHP to use the
    # C implementation instead.
    #
    # See https://github.com/WordPress/wordpress-playground/issues/92
    # for more context.
    --disable-fiber-asm \
    # --enable-json for PHP < 8.0:
    --enable-json      \
    --enable-embed=static \
    --with-layout=GNU  \
    --disable-cgi      \
    --disable-all      \
    --enable-static=yes \
    --enable-shared=no \
    --enable-session   \
    --enable-filter    \
    --enable-calendar  \
    --disable-rpath    \
    --disable-phpdbg   \
    --without-pear     \
    --with-valgrind=no \
    --without-pcre-jit \
    --enable-bcmath    \
    --enable-ctype     \
    --disable-mbregex  \
    --enable-tokenizer \
    $(cat /root/.php-configure-flags)

# Silence the errors "munmap() failed: [28] Invalid argument"
# @TODO: Identify the root cause behind these errors and fix them properly
RUN echo '#define ZEND_MM_ERROR 0' >> /root/php-src/main/php_config.h; 
# Disable dlopen() in the readline PHP extension
RUN perl -pi.bak -e 's/define HAVE_DLOPEN 1/define HAVE_DLOPEN 0/g' /root/php-src/main/php_config.h
RUN echo '#undef COMPILE_DL_READLINE' >> /root/php-src/main/php_config.h
RUN perl -pi.bak -e 's/GET_SHELL_CB\(cb\);/(cb) = php_cli_get_shell_callbacks();/g' /root/php-src/ext/readline/readline_cli.c

# With HAVE_UNISTD_H=1 PHP complains about the missing getdtablesize() function 
RUN perl -pi.bak -e 's/define HAVE_UNISTD_H 1/define HAVE_UNISTD_H 0/g' /root/php-src/main/php_config.h

# PHP <= 7.3 is not very good at detecting the presence of the POSIX readdir_r function
# so we need to force it to be enabled.
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
        echo '#define HAVE_POSIX_READDIR_R 1' >> /root/php-src/main/php_config.h; \
    fi;

RUN perl -pi.bak -e 's/define HAVE_UNISTD_H 1/define HAVE_UNISTD_H 0/g' /root/php-src/main/php_config.h
RUN perl -pi.bak -e 's/static inline int php_pollfd_for\(/int php_pollfd_for(php_socket_t fd, int events, struct timeval *timeouttv); static inline int __real_php_pollfd_for\(/g' /root/php-src/main/php_network.h
# RUN perl -pi.bak -e 's/use_ssl = / use_ssl = 0; \/\//g' /root/php-src/ext/standard/http_fopen_wrapper.c

RUN source /root/emsdk/emsdk_env.sh && \
    # We're compiling PHP as emscripten's side module...
    EMCC_FLAGS=" -sSIDE_MODULE -Dpopen=wasm_popen -Dpclose=wasm_pclose " \
    # ...which means we must skip all the libraries - they will be provided in the final linking step.
    EMCC_SKIP="-lz -ledit -ldl -lncurses -lzip -lpng16 -lssl -lcrypto -lxml2 -lc -lm -lsqlite3 /root/lib/lib/libxml2.a /root/lib/lib/libsqlite3.so /root/lib/lib/libsqlite3.a /root/lib/lib/libpng16.so" \
    emmake make -j8

RUN cp -v /root/php-src/.libs/libphp*.la /root/lib/libphp.la
RUN cp -v /root/php-src/.libs/libphp*.a /root/lib/libphp.a

COPY ./build-assets/php_wasm.c /root/

# Add nodefs when building for node.js
RUN if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
        echo -n ' -lnoderawfs.js -s NODERAWFS=1 ' >> /root/.emcc-php-wasm-flags; \
    fi

# PHP < 8.0 errors out with "null function or function signature mismatch"
# unless EMULATE_FUNCTION_POINTER_CASTS is enabled. The error originates in
# the rc_dtor_func which traces back to calling the zend_list_free function.
# The signatures are the same on the face value, but the wasm runtime is not
# happy with them. This can probably be patched in PHP, but for now we just
# enable the flag and pay the price of the additional overhead.
# https://emscripten.org/docs/porting/guidelines/function_pointer_issues.html
RUN if [ "${PHP_VERSION:0:1}" -lt "8" ]; then \
    echo -n ' -s EMULATE_FUNCTION_POINTER_CASTS=1' >> /root/.emcc-php-wasm-flags; \
    fi

# Build the final .wasm file
RUN mkdir /root/output
COPY ./build-assets/js-shims.js /root/js-shims.js
RUN source /root/emsdk/emsdk_env.sh && \
    export EXPORTED_FUNCTIONS=$'["_php_wasm_init", \n\
"_phpwasm_destroy_uploaded_files_hash", \n\
"_phpwasm_init_uploaded_files_hash", \n\
"_phpwasm_register_uploaded_file", \n\
"_wasm_add_SERVER_entry", \n\
"_wasm_add_uploaded_file", \n\
"_wasm_sapi_handle_request", \n\
"_wasm_set_content_length", \n\
"_wasm_set_content_type", \n\
"_wasm_set_cookies", \n\
"_wasm_set_path_translated", \n\
"_wasm_set_php_code", \n\
"_wasm_set_query_string", \n\
"_wasm_set_request_body", \n\
"_wasm_set_request_host", \n\
"_wasm_set_request_method", \n\
"_wasm_set_request_port", \n\
"_wasm_set_request_uri", \n\
"_wasm_set_skip_shebang" '"$(cat /root/.EXPORTED_FUNCTIONS)"']'; \
    emcc -O3 -g2 \
    # -flto \
    -lwebsocket.js \
    --js-library /root/js-shims.js \
    -I .  \
    -I ext   \
    -I ext/json   \
    -I Zend  \
    -I main  \
    -I TSRM/ \
    -I /root/lib/include \
    -L/root/lib -L/root/lib/lib/ \
    $(cat /root/.emcc-php-wasm-flags) \
    -o /root/output/php.js \
    -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8", "FS", "PROXYFS"]' \
    -s INITIAL_MEMORY=1024MB \
    -s ALLOW_MEMORY_GROWTH=1         \
    -s ASSERTIONS=3                  \
    -s ASYNCIFY=1                    \
    -s ASYNCIFY_ONLY=$'["cli",\n\
"do_cli",\n\
"dynCall_dd", \n\
"dynCall_i", \n\
"dynCall_ii", \n\
"dynCall_iidiiii", \n\
"dynCall_iii", \n\
"dynCall_iiid", \n\
"dynCall_iiii", \n\
"dynCall_iiiii", \n\
"dynCall_iiiiii", \n\
"dynCall_iiiiiii", \n\
"dynCall_iiiiiiii", \n\
"dynCall_iiiiiiiii", \n\
"dynCall_iiiiiiiiii", \n\
"dynCall_iiij", \n\
"dynCall_iiiji", \n\
"dynCall_ji", \n\
"dynCall_jii", \n\
"dynCall_jiiiji", \n\
"dynCall_jiij", \n\
"dynCall_jiiji", \n\
"dynCall_jiji", \n\
"dynCall_jj", \n\
"dynCall_v", \n\
"dynCall_vi", \n\
"dynCall_vii", \n\
"dynCall_viidii", \n\
"dynCall_viii", \n\
"dynCall_viiii", \n\
"dynCall_viiiii", \n\
"dynCall_viiiiiii", \n\
"dynCall_viiiiiiii", \n\
"execute_ex", \n\
"main", \n\
"zim_PDO___construct", \n\
"zim_PDO_query", \n\
"zim_PDO_exec", \n\
"zim_PDOStatement_execute", \n\
"zim_PDO_beginTransaction", \n\
"zim_PDO_rollBack", \n\
"zim_PDO_commit", \n\
"zim_PDO_commitTransaction", \n\
"pdo_mysql_handle_factory", \n\
"pdo_mysql_stmt_describe", \n\
"pdo_mysql_stmt_get_col", \n\
"pdo_mysql_stmt_col_meta", \n\
"pdo_mysql_stmt_fetch", \n\
"pdo_mysql_stmt_execute", \n\
"pdo_mysql_stmt_execute_prepared", \n\
"php_mysqlnd_greet_read", \n\
"php_mysqlnd_auth_response_read", \n\
"php_mysqlnd_rset_header_read", \n\
"mysql_handle_doer", \n\
"mysql_handle_closer", \n\
"mysql_handle_preparer", \n\
"mysql_handle_quoter", \n\
"mysql_handle_begin", \n\
"mysql_handle_commit", \n\
"mysql_handle_rollback", \n\
"mysqlnd_query_read_result_set_header", \n\
"mysqlnd_read_buffer_is_empty", \n\
"mysqlnd_read_buffer", \n\
"mysqlnd_connection_connect", \n\
"mysqlnd_read_header", \n\
"mysqlnd_read_header_name", \n\
"mysqlnd_read_body_name", \n\
"mysqlnd_read_packet_header_and_body", \n\
"mysqlnd_run_authentication", \n\
"mysqlnd_mysqlnd_command_handshake_pub", \n\
"mysqlnd_mysqlnd_command_reap_result_pub", \n\
"mysqlnd_mysqlnd_conn_data_tx_commit_or_rollback_pub", \n\
"mysqlnd_mysqlnd_conn_data_query_pub", \n\
"mysqlnd_mysqlnd_conn_data_reap_query_pub", \n\
"mysqlnd_mysqlnd_conn_connect_pub", \n\
"mysqlnd_mysqlnd_conn_data_connect_pub", \n\
"mysqlnd_mysqlnd_conn_data_connect_handshake_pub", \n\
"mysqlnd_mysqlnd_pfc_receive_pub", \n\
"mysqlnd_mysqlnd_vio_network_read_pub", \n\
"mysqlnd_mysqlnd_vio_connect_pub", \n\
"mysqlnd_mysqlnd_vio_open_tcp_or_unix_pub", \n\
"phar_file_get_contents", \n\
"phar_fopen",\n\
"php_execute_script", \n\
"php_fsockopen_stream", \n\
"php_network_accept_incoming", \n\
"php_network_connect_socket", \n\
"php_network_connect_socket", \n\
"php_openssl_enable_crypto", \n\
"php_openssl_sockop_close", \n\
"php_openssl_sockop_io", \n\
"php_openssl_sockop_read", \n\
"php_openssl_sockop_set_option", \n\
"php_openssl_sockop_set_option", \n\
"php_pollfd_for", \n\
"php_sock_stream_wait_for_data", \n\
"php_sockop_read", \n\
"php_sockop_read_close", \n\
"php_sockop_set_option", \n\
"php_sockop_write", \n\
"_php_stream_copy_to_mem", \n\
"_php_stream_eof", \n\
"_php_stream_fill_read_buffer", \n\
"_php_stream_get_line", \n\
"_php_stream_open_wrapper_ex", \n\
"_php_stream_read", \n\
"php_stream_read_to_str", \n\
"_php_stream_set_option", \n\
"php_stream_url_wrap_http", \n\
"php_stream_url_wrap_http_ex", \n\
"_php_stream_xport_create", \n\
"php_stream_xport_crypto_enable", \n\
"php_tcp_sockop_set_option", \n\
"readline_shell_run", \n\
"run_cli", \n\
"ZEND_DO_FCALL_BY_NAME_SPEC_OBSERVER_HANDLER", \n\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_UNUSED_HANDLER", \n\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_USED_HANDLER", \n\
"ZEND_DO_FCALL_SPEC_OBSERVER_HANDLER", \n\
"ZEND_DO_FCALL_SPEC_RETVAL_UNUSED_HANDLER", \n\
"ZEND_DO_FCALL_SPEC_RETVAL_USED_HANDLER", \n\
"ZEND_DO_ICALL_SPEC_RETVAL_UNUSED_HANDLER", \n\
"ZEND_DO_ICALL_SPEC_RETVAL_USED_HANDLER", \n\
"ZEND_DO_UCALL_SPEC_OBSERVER_HANDLER", \n\
"zend_eval_stringl", \n\
"zend_eval_string_ex", \n\
"zend_execute", \n\
"zend_execute_scripts", \n\
"zif_fclose", \n\
"zif_file_get_contents", \n\
"zif_fopen", \n\
"zif_fread", \n\
"zif_fsockopen"]' \
    -s ASYNCIFY_IMPORTS=$'["_dlopen_js", \n\
"invoke_i", \n\
"invoke_ii", \n\
"invoke_iii", \n\
"invoke_iiii", \n\
"invoke_iiiii", \n\
"invoke_iiiiii", \n\
"invoke_iiiiiii", \n\
"invoke_iiiiiiii", \n\
"invoke_iiiiiiiiii", \n\
"invoke_v", \n\
"invoke_vi", \n\
"invoke_vii", \n\
"invoke_viidii", \n\
"invoke_viii", \n\
"invoke_viiii", \n\
"invoke_viiiii", \n\
"invoke_viiiiii", \n\
"invoke_viiiiiii", \n\
"invoke_viiiiiiiii"]' \
    -s ASYNCIFY_IGNORE_INDIRECT=1                  \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
    -s INVOKE_RUN=0                  \
        /root/lib/libphp.a \
        /root/php_wasm.c \
        $(cat /root/.emcc-php-wasm-sources) \
    -s ENVIRONMENT=$EMSCRIPTEN_ENVIRONMENT \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORT_NAME="'PHPLoader'" 

RUN ls /root/output/
# # At the moment terminfo is baked into the repository in
# # src/php-cli/terminfo, but if we ever need to update it, we can
# # use the terminfo database produced by the ncurses make script:
# RUN if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
#         mkdir -p /root/output/terminfo/x && \
#         cp -v /root/lib/share/terminfo/x/xterm* /root/output/terminfo/x/; \
#     fi

# Postprocess the build php.js module:
# ## Wrap it in an ES module with proper `export` statements.
# - Export the PHPLoader object as the default export.
# - Export the cache buster string.
# - Export the .wasm filename
# - Rename the output files to reflect the build configuration, e.g. `php-7.4.node.js` or `php-8.0.js`
RUN \
    # Figure out the target file names and URLs
        # The goal:
            # The .js and .wasm filenames should reflect the build configuration, e.g.:
            # * `php-7.4.node.js` and `php-7.4.node.wasm`
            # * `php-8.0.js` and `php-8.0.wasm`
            # In addition, the `.wasm` file URL should have a "cache busting" query string on the
            # web, so that web browsers will reload it when the file contents change.
        # Precompute export variables:
        export FILE_SIZE=$(stat -c%s "/root/output/php.wasm") && \
        export FILENAME_PREFIX="php-${PHP_VERSION:0:3}"; \
        if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then export EXT_PREFIX=".node"; \
        else export EXT_PREFIX=""; fi; \
        export JS_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.js"; \
        export WASM_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.wasm"; \
        # Handle cache busting:
        if [ "$EMSCRIPTEN_ENVIRONMENT" = "web" ]; then \
            export CACHE_BUSTER=$(md5sum /root/output/php.wasm | awk '{print $1}'); \
            export WASM_URL="$WASM_FILENAME?$CACHE_BUSTER"; \
        else \
            export WASM_URL="$WASM_FILENAME"; \
        fi; \
    # Preprocess the php.js file
        # php.js relies on a hardcoded "php.wasm" filename. Let's make it
        # rely on a `dependencyFilename` variable instead.
        perl -pi.bak -e 's#"php\.wasm"#dependencyFilename#g' /root/output/php.js && \
        perl -pi.bak -e "s#'php\.wasm'#dependencyFilename#g" /root/output/php.js && \
        # Emscripten produces an if that checkes a stream.stream_ops.poll property. However,
        # stream.stream_ops is sometimes undefined and the check fails. Let's adjust it to
        # tolerate a null stream.stream_ops value.
        perl -pi.bak -e "s#if\s*\(stream\.stream_ops\.poll\)#if (stream.stream_ops?.poll)#g" /root/output/php.js && \
        # Emscripten makes the Websocket proxy connect to a fixed URL.
        # This assumes the traffic is always forwarded to the same target.
        # However, we want to support arbitrary targets, so we need to
        # replace the hardcoded websocket target URL with a dynamic callback.
        perl -pi.bak -e $'s#if\s*\(\s*["\']string["\']\s*===\s*typeof Module\[["\']websocket["\']\]\[["\']url["\']\]\s*\)#if("function"===typeof Module["websocket"]["url"]) {\nurl = Module["websocket"]["url"](...arguments);\n}else if ("string" === typeof Module["websocket"]["url"])#g' \
            /root/output/php.js && \
        # Emscripten ignores the flags argument to ___syscall_recvfrom.
        # However, PHP relies on passing the MSG_PEEK (== integer 2) flag when polling
        # the stream for data.
        # MSG_PEEK enables reading bytes without moving the stream pointer forward.
        # Without the patch below, PHP consumes the first byte from the top of the 
        # response stream, typically "H" in "HTTP/1.1 200 OK", and then fails after
        # reading the remaining "TTP/1.1 200 OK" and not recognizing it as a valid
        # status line.
        # We need to patch the syscall to support the MSG_PEEK flag.
        perl -pi.bak -e 's#sock\.sock_ops\.recvmsg\(sock,\s*len\);#sock.sock_ops.recvmsg(sock, len, typeof flags !== "undefined" ? flags : 0);#g' /root/output/php.js && \
        perl -pi.bak -e 's#recvmsg:\s*function\(sock,\s*length\)#recvmsg: function(sock, length, flags)#g' /root/output/php.js && \
        perl -pi.bak -e 's#if\s*\(sock\.type\s*===\s*1\s*&&\s*bytesRead\s*<\s*queuedLength\)#if (flags&2) {bytesRead = 0;} if (sock.type === 1 && bytesRead < queuedLength)#g' /root/output/php.js && \
        # Replace the hardcoded ENVIRONMENT variable with a dynamic computation.
            # The JavaScript code of the web loader and web worker loader is identical,
            # but Emscripten forces running different code paths by setting
            #
            # ENVIRONMENT_IS_WEB = true; ENVIRONMENT_IS_WORKER = false
            #
            # This project supports both environments and would have to maintain two
            # separate copies of the code. Instead, we use a dynamic computation of the
            # environment, based on the `RuntimeName` variable, which is an argument to the
            # wrapper function.
            perl -pi.bak -e 's/ENVIRONMENT_IS_([A-Z]+)\s*=\s*(true|false)/ENVIRONMENT_IS_\1=RuntimeName==="\1"/g' /root/output/php.js && \
            perl -pi.bak -e 's/var ENV\s*=\s*\{\}/var ENV = PHPLoader.ENV || {}/g' /root/output/php.js && \
    # Turn the php.js file into an ES module
        # Manually turn the output into a esm module instead of relying on -s MODULARIZE=1.
        # which pollutes the global namespace and does not play well with import() mechanics.
        echo "export const dependenciesTotalSize = $FILE_SIZE; export const dependencyFilename = '$WASM_URL'; export default function(RuntimeName, PHPLoader, EnvVariables) {" >> /root/output/php-module.js && \
        cat /root/output/php.js >> /root/output/php-module.js && \
        echo " return PHPLoader; }" >> /root/output/php-module.js && \
        \
        # Remove the old php.js file
        rm /root/output/php.js && \
        \
        # Rename the build files to their final names
        mv /root/output/php-module.js "/root/output/$JS_FILENAME" && \
        mv /root/output/php.wasm "/root/output/$WASM_FILENAME"
