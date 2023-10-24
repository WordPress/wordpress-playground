# Originally forked from https://github.com/seanmorris/php-wasm
# ubuntu:lunar supports amd64 and arm64 (Apple Silicon) while
# emscripten/emsdk:3.1.24 supports amd64 only.
FROM ubuntu:lunar as emscripten

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
# Script to replace strings in files and exit with a non-zero status if the string is not found.
COPY ./build-assets/replace.sh /root/replace.sh
RUN chmod a+x /root/replace.sh

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
# Passing extra flags breaks the version check \n\
if [[ "$@" == "-v" ]]; then\n\
    export EMCC_FLAGS=""\n\
fi\n\
/root/emsdk/upstream/emscripten/emcc2 "$@" $EMCC_FLAGS \n' > /root/emsdk/upstream/emscripten/emcc && \
    chmod a+x /root/emsdk/upstream/emscripten/emcc

# Compile libz
FROM emscripten AS emscripten-libz
COPY ./build-assets/zlib /root/zlib
RUN chmod a+x /root/zlib/configure
RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/zlib && \
    emconfigure ./configure --prefix=/root/lib && \
    # emmake make fails, but only after it builds the library files. 
    # Let's just ignore the errors and proceed with the built libraries.
    (EMCC_FLAGS="-fPIC" emmake make || true) && \
    EMCC_FLAGS="-fPIC" emmake make install

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
RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE " emmake make
RUN cd libzip/build && source /root/emsdk/emsdk_env.sh && EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE " emmake make install

# Compile libiconv
FROM emscripten AS emscripten-iconv
RUN set -euxo pipefail; \
	wget https://ftp.gnu.org/pub/gnu/libiconv/libiconv-1.17.tar.gz; \
	tar -xvf libiconv-1.17.tar.gz; \
	rm libiconv-1.17.tar.gz;
WORKDIR /root/libiconv-1.17
RUN set -euxo pipefail; \
	source /root/emsdk/emsdk_env.sh; \
	CPPFLAGS="-I/root/lib/include " \
	LDFLAGS="-L/root/lib/lib " \
	emconfigure ./configure \
		PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
		--build i386-pc-linux-gnu \
		--target wasm32-unknown-emscripten \
		--prefix=/root/lib/ \
		--enable-shared=no \
		--enable-static=yes; \
	EMCC_FLAGS="-fPIC" emmake make; \
	emmake make install;

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
            --build i386-pc-linux-gnu \
            --prefix=/root/lib/ \
            --enable-database && \
        make && \
        make install  && \
        cd ncurses  && \
        cp make_hash make_hash_x86  && \
        cp make_keys make_keys_x86  && \
        cp report_offsets report_offsets_x86   && \
        cd /root/ncurses-6.2 && \
        make clean && \
        git apply --ignore-space-change --ignore-whitespace --no-index /root/ncurses.patch && \
        source /root/emsdk/emsdk_env.sh && \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build i386-pc-linux-gnu \
            --prefix=/root/lib && \
        /root/replace.sh $'s/^\s+cd man.*$//g' Makefile && \
        /root/replace.sh $'s/^\s+cd progs.*$//g' Makefile && \
        /root/replace.sh $'s/^\s+cd test.*$//g' Makefile && \
        /root/replace.sh $'s/^\s+cd misc.*$//g' Makefile && \
        /root/replace.sh $'s/^\s+cd c\+\+.*$//g' Makefile && \
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
            --build i386-pc-linux-gnu \
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
            --build i386-pc-linux-gnu \
            --target wasm32-unknown-emscripten \
            --prefix=/root/lib/ && \
        EMCC_SKIP="-lc" EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
        emmake make install

# Compile OpenSSL
# Inspired by: https://github.com/TrueBitFoundation/wasm-ports/blob/79aac7272729baaf131ca0c49cc3b684eedff835/openssl.sh
FROM emscripten AS emscripten-openssl
ARG PHP_VERSION
COPY --from=emscripten-libz /root/lib /root/lib-libz
RUN /root/copy-lib.sh lib-libz
RUN set -euxo pipefail && \
    source /root/emsdk/emsdk_env.sh && \
    export OPENSSL_VERSION=1.1.0h && \
    wget https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz && \
    tar xf openssl-$OPENSSL_VERSION.tar.gz && \
    cd openssl-$OPENSSL_VERSION && \
    emconfigure ./Configure dist -DHAVE_FORK=0 -DOPENSSL_NO_AFALGENG=1 no-threads --prefix=/root/lib && \
    sed -i 's|^CROSS_COMPILE.*$|CROSS_COMPILE=|g' Makefile && \
    EMCC_FLAGS=" -sSIDE_MODULE " EMCC_SKIP="-lz" emmake make -j 12 build_generated libssl.a libcrypto.a; \
    cp -RL include/openssl /root/lib/include && \
    cp libcrypto.a libssl.a /root/lib/lib && \
    EMCC_FLAGS=" -sSIDE_MODULE " EMCC_SKIP="-lz" emmake make install;

# Compile libpng
FROM emscripten AS emscripten-libpng
COPY --from=emscripten-libz /root/lib /root/lib-libz
RUN /root/copy-lib.sh lib-libz
RUN wget http://prdownloads.sourceforge.net/libpng/libpng-1.6.39.tar.gz?download -O libpng-1.6.39.tar.gz
RUN tar -xzf libpng-1.6.39.tar.gz 
WORKDIR /root/libpng-1.6.39
RUN     source /root/emsdk/emsdk_env.sh && \
        CPPFLAGS="-I/root/lib/include " \
        LDFLAGS="-L/root/lib/lib " \
        emconfigure ./configure \
            PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
            --build i386-pc-linux-gnu \
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
ARG WITH_ICONV
ARG WITH_WS_NETWORKING_PROXY

# The platform to build for: web or node
ARG EMSCRIPTEN_ENVIRONMENT=web

RUN touch /root/.configure-flags && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.emcc-php-wasm-sources && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.EXPORTED_FUNCTIONS

COPY --from=emscripten-php-src /root/php-src /root/php-src
RUN cd php-src && ./buildconf --force

# Add libzip and zlib files if needed
COPY --from=emscripten-libz /root/lib /root/lib-libz
COPY --from=emscripten-libzip /root/lib /root/lib-libzip
RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
        /root/copy-lib.sh lib-libz; \
        /root/copy-lib.sh lib-libzip && \
        if [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            /root/replace.sh 's/ZEND_MODULE_GLOBALS_CTOR_N/(void (*)(void *))ZEND_MODULE_GLOBALS_CTOR_N/g' /root/php-src/ext/zlib/zlib.c; \
        fi;\
        if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            apt install -y zlib1g zlib1g-dev; \
            # https://php-legacy-docs.zend.com/manual/php5/en/zlib.installation
            echo -n ' --with-zlib --with-zlib-dir=/root/lib --enable-zip --with-libzip=/root/lib ' >> /root/.php-configure-flags; \
            echo -n ' -I /root/zlib -I /root/libzip ' >> /root/.emcc-php-wasm-flags; \
            echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a' >> /root/.emcc-php-wasm-sources; \
            cp /root/lib/lib/libzip/include/zipconf.h /root/lib/lib; \
            cp /root/lib/lib/libzip/include/zipconf.h /root/lib/include; \
            echo '#define LIBZIP_VERSION "1.2.0"' >> /root/lib/include/zipconf.h; \
            cp /root/lib/include/*.h /root/php-src; \
        else \
            # https://www.php.net/manual/en/zlib.installation.php
            echo -n ' --with-zlib --with-zlib-dir=/root/lib --with-zip' >> /root/.php-configure-flags; \
            echo -n ' -I /root/zlib -I /root/libzip' >> /root/.emcc-php-wasm-flags; \
            echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a' >> /root/.emcc-php-wasm-sources; \
        fi && \
        /root/replace.sh 's/pharcmd=pharcmd/pharcmd=/g' /root/php-src/configure && \
        /root/replace.sh 's/pharcmd_install=install-pharcmd/pharcmd_install=/g' /root/php-src/configure; \
    fi;

# Add ncurses if needed and libedit if needed
COPY --from=emscripten-libedit /root/lib /root/lib-libedit
COPY --from=emscripten-ncurses /root/lib /root/lib-ncurses
RUN if [ "$WITH_CLI_SAPI" = "yes" ]; \
    then \
        /root/copy-lib.sh lib-ncurses && \
        /root/copy-lib.sh lib-libedit && \
        # Configure build flags
        echo -n ' --enable-phar --enable-cli=static --enable-readline --with-libedit=/root/lib ' >> /root/.php-configure-flags && \
        echo -n ' sapi/cli/php_cli_process_title.c sapi/cli/ps_title.c sapi/cli/php_http_parser.c sapi/cli/php_cli_server.c sapi/cli/php_cli.c ' \
            >> /root/.emcc-php-wasm-sources && \
        echo -n ', "_run_cli", "_wasm_add_cli_arg"' >> /root/.EXPORTED_FUNCTIONS && \
        echo -n ' -DWITH_CLI_SAPI=1 -lncurses -ledit ' >> /root/.emcc-php-wasm-flags && \
        # Disable dlopen() in the readline PHP extension
        echo '#undef COMPILE_DL_READLINE' >> /root/php-src/main/php_config.h && \
        /root/replace.sh 's/GET_SHELL_CB\(cb\);/(cb) = php_cli_get_shell_callbacks();/g' /root/php-src/ext/readline/readline_cli.c; \
    else \
        echo -n ' --disable-cli ' >> /root/.php-configure-flags; \
    fi;

# Add Libxml2 if needed
COPY --from=emscripten-libxml /root/lib /root/lib-libxml
RUN if [ "$WITH_LIBXML" = "yes" ]; \
    then \
        set -euxo pipefail;\
        bash /root/copy-lib.sh lib-libxml && \
        echo -n ' --enable-libxml --with-libxml --with-libxml-dir=/root/lib --enable-dom --enable-xml --enable-simplexml --enable-xmlreader --enable-xmlwriter' >> /root/.php-configure-flags && \
        echo -n ' -I /root/libxml2 -lxml2' >> /root/.emcc-php-wasm-flags && \
        echo -n ' /root/lib/lib/libxml2.a' >> /root/.emcc-php-wasm-sources && \
        # Libxml check is wrong in PHP < 7.4.0.
        # In the regular cc it's just a warning, but in the emscripten's emcc that's an error:
        perl -pi.bak -e 's/char xmlInitParser/void xmlInitParser/g' /root/php-src/configure; \
        # On PHP < 7.1.0, the dom_iterators.c file implicitly converts *char to const *char causing emcc error
        if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "0" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            /root/replace.sh 's/xmlHashScan\(ht, itemHashScanner, iter\);/xmlHashScan(ht, (xmlHashScanner)itemHashScanner, iter);/g' /root/php-src/ext/dom/dom_iterators.c; \
        fi; \
    else \
        echo -n ' --disable-libxml --without-libxml --disable-dom --disable-xml --disable-simplexml --disable-xmlwriter' >> /root/.php-configure-flags; \
    fi

# Add sqlite3 if needed
COPY --from=emscripten-sqlite3 /root/lib /root/lib-sqlite3
RUN if [ "$WITH_SQLITE" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-sqlite3 && \
        echo -n ' --with-sqlite3 --enable-pdo --with-pdo-sqlite=/root/lib ' >> /root/.php-configure-flags && \
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
        bash /root/copy-lib.sh lib-openssl; \
        echo -n ' --with-openssl --with-openssl-dir=/root/lib ' >> /root/.php-configure-flags; \
        echo -n ' -lssl -lcrypto ' >> /root/.emcc-php-wasm-flags; \
    fi;

# Add iconv if needed
COPY --from=emscripten-iconv /root/lib /root/lib-iconv
RUN if [ "$WITH_ICONV" = "yes" ]; \
    then \
        bash /root/copy-lib.sh lib-iconv; \
        echo -n ' --with-iconv=/root/lib ' >> /root/.php-configure-flags; \
		echo -n ' /root/lib/lib/libiconv.a' >> /root/.emcc-php-wasm-sources; \
    fi;

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
    git apply --no-index /root/php${PHP_VERSION:0:3}*.patch -v && \
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
        echo -n ' --enable-mysql --enable-pdo --with-mysql=mysqlnd --with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd ' >> /root/.php-configure-flags; \
    fi

# Build the patched PHP
WORKDIR /root/php-src
RUN source /root/emsdk/emsdk_env.sh && \
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
    --enable-hash      \
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

# With HAVE_UNISTD_H=1 PHP complains about the missing getdtablesize() function 
RUN /root/replace.sh 's/define php_sleep sleep/define php_sleep wasm_sleep/g' /root/php-src/main/php.h
RUN echo 'extern unsigned int wasm_sleep(unsigned int time);' >> /root/php-src/main/php.h; 

RUN /root/replace.sh 's/define HAVE_UNISTD_H 1/define HAVE_UNISTD_H 0/g' /root/php-src/main/php_config.h
RUN /root/replace.sh 's/\(proc_open\)/(php_proc_open)/g' /root/php-src/ext/standard/proc_open.c
RUN /root/replace.sh 's/PHPAPI int php_exec(.+)$/PHPAPI extern int php_exec\1; int php_exec_old\1/g' /root/php-src/ext/standard/exec.c

# PHP <= 7.3 is not very good at detecting the presence of the POSIX readdir_r function
# so we need to force it to be enabled.
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
        echo '#define HAVE_POSIX_READDIR_R 1' >> /root/php-src/main/php_config.h; \
    fi;

# Rename the original php_pollfd_for() implementation so that we can link our own version.
RUN /root/replace.sh 's/static inline int php_pollfd_for\(/int php_pollfd_for(php_socket_t fd, int events, struct timeval *timeouttv); static inline int __real_php_pollfd_for(/g' /root/php-src/main/php_network.h
RUN /root/replace.sh 's/static int php_cli_server_poller_poll/extern int wasm_select(int, fd_set * __restrict, fd_set * __restrict, fd_set * __restrict, struct timeval * __restrict); static int php_cli_server_poller_poll/g' /root/php-src/sapi/cli/php_cli_server.c

# Provide a custom implementation of the php_select() function.
RUN /root/replace.sh 's/return php_select\(/return wasm_select(/g' /root/php-src/sapi/cli/php_cli_server.c
RUN /root/replace.sh 's/VCWD_POPEN\(/wasm_popen(/g' /root/php-src/ext/standard/file.c
RUN /root/replace.sh 's/PHP_FUNCTION\(popen\)/extern FILE *wasm_popen(const char *cmd, const char *mode);PHP_FUNCTION(popen)/g' /root/php-src/ext/standard/file.c

# Provide a custom implementation of the shutdown() function.
RUN perl -pi.bak -e $'s/(\s+)shutdown\(/$1 wasm_shutdown(/g' /root/php-src/sapi/cli/php_cli_server.c
RUN perl -pi.bak -e $'s/(\s+)closesocket\(/$1 wasm_close(/g' /root/php-src/sapi/cli/php_cli_server.c
RUN echo 'extern int wasm_shutdown(int fd, int how);' >> /root/php-src/main/php_config.h; 
RUN echo 'extern int wasm_close(int fd);' >> /root/php-src/main/php_config.h; 

# Provide a custom implementation of the proc_open() function.
RUN echo '' > /root/php-src/ext/standard/proc_open.h;
RUN echo '' > /root/php-src/ext/standard/proc_open.c; 

RUN source /root/emsdk/emsdk_env.sh && \
    # We're compiling PHP as emscripten's side module...
    EMCC_FLAGS=" -sSIDE_MODULE -Dsetsockopt=wasm_setsockopt -Dphp_exec=wasm_php_exec " \
    # ...which means we must skip all the libraries - they will be provided in the final linking step.
    EMCC_SKIP="-lz -ledit -ldl -lncurses -lzip -lpng16 -lssl -lcrypto -lxml2 -lc -lm -lsqlite3 /root/lib/lib/libxml2.a /root/lib/lib/libsqlite3.so /root/lib/lib/libsqlite3.a /root/lib/lib/libpng16.so" \
    emmake make -j8

RUN cp -v /root/php-src/.libs/libphp*.la /root/lib/libphp.la
RUN cp -v /root/php-src/.libs/libphp*.a /root/lib/libphp.a

COPY ./build-assets/php_wasm.c /root/
COPY ./build-assets/proc_open* /root/

RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
         cp /root/proc_open7.0.c /root/proc_open.c; \
         cp /root/proc_open7.0.h /root/proc_open.h; \
    else \
         cp /root/proc_open7.4.c /root/proc_open.c; \
         cp /root/proc_open7.4.h /root/proc_open.h; \
    fi


RUN if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
        # Add nodefs when building for node.js
        echo -n ' -lnodefs.js ' >> /root/.emcc-php-wasm-flags; \
        # Preserve symbol names in node.js build – the bundle size doesn't matter as much
        # as on the web, and this makes debugging **much** easier.
        echo -n ' -g2 ' >> /root/.emcc-php-wasm-flags; \
    fi

# PHP < 8.0 errors out with "null function or function signature mismatch"
# unless EMULATE_FUNCTION_POINTER_CASTS is enabled. The error originates in
# the rc_dtor_func which traces back to calling the zend_list_free function.
# The signatures are the same on the face value, but the wasm runtime is not
# happy somehow. This can probably be patched in PHP, but for now we just
# enable the flag and pay the price of the additional overhead.
# https://emscripten.org/docs/porting/guidelines/function_pointer_issues.html
RUN if [ "${PHP_VERSION:0:1}" -lt "8" ]; then \
        echo -n ' -s EMULATE_FUNCTION_POINTER_CASTS=1' >> /root/.emcc-php-wasm-flags; \
    fi

# Add ws networking proxy support if needed
RUN if [ "$WITH_WS_NETWORKING_PROXY" = "yes" ]; \
    then \
        echo -n ' -lwebsocket.js ' >> /root/.emcc-php-wasm-flags; \
    fi

RUN echo -n ' -s ASYNCIFY=1 -s ASYNCIFY_IGNORE_INDIRECT=1 ' >> /root/.emcc-php-wasm-flags; \
    # Emscripten supports yielding from sync functions to JavaScript event loop, but all
    # the synchronous functions doing that must be explicitly listed here. This is an
    # exhaustive list that was created by compiling PHP with ASYNCIFY, running code that
    # uses networking, observing the error, and listing the missing functions.
    #
    # If you a get an error similar to the one below, you need to add all the function on
    # the stack to the "ASYNCIFY_ONLY" list below (in this case, it's php_mysqlnd_net_open_tcp_or_unix_pub):
    # 
    # RuntimeError: unreachable
    # at php_mysqlnd_net_open_tcp_or_unix_pub (<anonymous>:wasm-function[9341]:0x5e42b8)
    # at byn$fpcast-emu$php_mysqlnd_net_open_tcp_or_unix_pub (<anonymous>:wasm-function[17222]:0x7795e9)
    # at php_mysqlnd_net_connect_ex_pub (<anonymous>:wasm-function[9338]:0x5e3f02)
    #
    # Node cuts the trace short by default so use the --stack-trace-limit=50 CLI flag
    # to get the entire stack.
    #
    # -------
    # 
    # Related: Any errors like Fatal error: Cannot redeclare function ...
    # are caused by dispatching a PHP request while an execution is paused 
    # due to an async call – it means the same PHP files are loaded before
    # the previous request, where they're already loaded, is concluded.
    export ASYNCIFY_IMPORTS=$'["_dlopen_js",\n\
"invoke_i",\n\
"invoke_ii",\n\
"invoke_iii",\n\
"invoke_iiii",\n\
"invoke_iiiii",\n\
"invoke_iiiiii",\n\
"invoke_iiiiiii",\n\
"invoke_iiiiiiii",\n\
"invoke_iiiiiiiiii",\n\
"invoke_v",\n\
"invoke_vi",\n\
"invoke_vii",\n\
"invoke_viidii",\n\
"invoke_viii",\n\
"invoke_viiii",\n\
"invoke_viiiii",\n\
"invoke_viiiiii",\n\
"invoke_viiiiiii",\n\
"invoke_viiiiiiiii",\n\
"js_open_process",\n\
"js_popen_to_file",\n\
"wasm_poll_socket",\n\
"wasm_shutdown"]'; \
    echo -n " -s ASYNCIFY_IMPORTS=$ASYNCIFY_IMPORTS " | tr -d "\n" >> /root/.emcc-php-wasm-flags; \
    export ASYNCIFY_ONLY_UNPREFIXED=$'"dynCall_dd",\
"dynCall_i",\
"dynCall_ii",\
"dynCall_iidiiii",\
"dynCall_iii",\
"dynCall_iiid",\
"dynCall_iiii",\
"dynCall_iiiii",\
"dynCall_iiiiii",\
"dynCall_iiiiiii",\
"dynCall_iiiiiiii",\
"dynCall_iiiiiiiii",\
"dynCall_iiiiiiiiii",\
"dynCall_iiij",\
"dynCall_iiiji",\
"dynCall_ji",\
"dynCall_jii",\
"dynCall_jiiiji",\
"dynCall_jiij",\
"dynCall_jiiji",\
"dynCall_jiji",\
"dynCall_jj",\
"dynCall_v",\
"dynCall_vi",\
"dynCall_vii",\
"dynCall_viidii",\
"dynCall_viii",\
"dynCall_viiii",\
"dynCall_viiiii",\
"dynCall_viiiiiii",\
"dynCall_viiiiiiii",'; \
    export ASYNCIFY_ONLY=$'"__fwritex",\
"zif_sleep",\
"zif_stream_get_contents",\
"php_stdiop_read",\
"fwrite",\
"zif_fwrite",\
"php_stdiop_write",\
"zif_array_filter",\
"zend_call_known_instance_method_with_2_params",\
"zend_fetch_dimension_address_read_R",\
"_zval_dtor_func_for_ptr",\
"ZEND_ASSIGN_DIM_SPEC_CV_CONST_HANDLER",\
"zend_fetch_dimension_address_read",\
"php_if_fopen",\
"zend_std_has_dimension",\
"zend_isset_isempty_dim_prop_obj_handler_SPEC_CV_CONST",\
"zend_assign_to_object",\
"ZEND_ASSIGN_OBJ_SPEC_CV_CONST_HANDLER",\
"zend_std_call_user_call",\
"zend_objects_store_del_ref_by_handle_ex",\
"zend_objects_store_del_ref",\
"_zval_dtor_func",\
"_zval_ptr_dtor",\
"zend_hash_del_key_or_index",\
"zend_delete_variable",\
"ZEND_UNSET_VAR_SPEC_CV_UNUSED_HANDLER",\
"zend_std_unset_dimension",\
"ZEND_UNSET_DIM_SPEC_CV_CONST_HANDLER",\
"zend_std_read_dimension",\
"zend_fetch_dimension_address_read_R_slow",\
"ZEND_FETCH_DIM_R_SPEC_CV_CONST_HANDLER",\
"zend_call_method",\
"zend_assign_to_object_dim",\
"ZEND_ASSIGN_DIM_SPEC_CV_CONST_OP_DATA_CONST_HANDLER",\
"zend_std_write_dimension",\
"zend_isset_dim_slow",\
"ZEND_ISSET_ISEMPTY_DIM_OBJ_SPEC_CV_CONST_HANDLER",\
"zend_std_write_property",\
"ZEND_ASSIGN_OBJ_SPEC_CV_CONST_OP_DATA_CONST_HANDLER",\
"zend_objects_store_del",\
"ZEND_UNSET_CV_SPEC_CV_UNUSED_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_FCALL_SPEC_CONST_HANDLER",\
"ZEND_DO_FCALL_SPEC_HANDLER",\
"ZEND_DO_FCALL_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_FCALL_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_FCALL_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_ICALL_SPEC_HANDLER",\
"ZEND_DO_ICALL_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_ICALL_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_UCALL_SPEC_OBSERVER_HANDLER",\
"ZEND_FETCH_OBJ_FUNC_ARG_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_TMPVAR_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_TMPVAR_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_TMPVAR_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_TMPVAR_HANDLER",\
"cli",\
"wasm_sleep",\
"wasm_php_exec",\
"wasm_sapi_handle_request",\
"_call_user_function_ex",\
"_call_user_function_impl",\
"_mysqlnd_run_command",\
"_php_stream_copy_to_mem",\
"_php_stream_eof",\
"_php_stream_fill_read_buffer",\
"_php_stream_free",\
"_php_stream_get_line",\
"_php_stream_open_wrapper_ex",\
"_php_stream_read",\
"_php_stream_set_option",\
"_php_stream_write",\
"_php_stream_xport_create",\
"do_cli",\
"do_cli_server",\
"execute_ex",\
"list_entry_destructor",\
"main",\
"mysql_handle_begin",\
"mysql_handle_closer",\
"mysql_handle_commit",\
"mysql_handle_doer",\
"mysql_handle_preparer",\
"mysql_handle_quoter",\
"mysql_handle_rollback",\
"mysql_stmt_execute",\
"mysqli_commit_or_rollback_libmysql",\
"mysqli_common_connect",\
"mysqlnd_com_handshake_run",\
"mysqlnd_com_init_db_run",\
"mysqlnd_com_stmt_execute_run",\
"mysqlnd_com_stmt_prepare_run",\
"mysqlnd_connect",\
"mysqlnd_connection_connect",\
"mysqlnd_mysqlnd_command_handshake_pub",\
"mysqlnd_mysqlnd_command_init_db_pub",\
"mysqlnd_mysqlnd_command_reap_result_pub",\
"mysqlnd_mysqlnd_conn_connect_pub",\
"mysqlnd_mysqlnd_conn_data_connect_handshake_pub",\
"mysqlnd_mysqlnd_conn_data_connect_pub",\
"mysqlnd_mysqlnd_conn_data_next_result_pub",\
"mysqlnd_mysqlnd_conn_data_query_pub",\
"mysqlnd_mysqlnd_conn_data_reap_query_pub",\
"mysqlnd_mysqlnd_conn_data_select_db_pub",\
"mysqlnd_mysqlnd_conn_data_set_charset_pub",\
"mysqlnd_mysqlnd_conn_data_store_result_pub",\
"mysqlnd_mysqlnd_conn_data_tx_commit_or_rollback_pub",\
"mysqlnd_mysqlnd_pfc_receive_pub",\
"mysqlnd_mysqlnd_pfc_send_pub",\
"mysqlnd_mysqlnd_protocol_send_command_handle_OK_pub",\
"mysqlnd_mysqlnd_protocol_send_command_handle_response_pub",\
"mysqlnd_mysqlnd_protocol_send_command_pub",\
"mysqlnd_mysqlnd_res_store_result_fetch_data_pub",\
"mysqlnd_mysqlnd_res_store_result_pub",\
"mysqlnd_mysqlnd_stmt_execute_pub",\
"mysqlnd_mysqlnd_stmt_prepare_pub",\
"mysqlnd_mysqlnd_stmt_send_execute_pub",\
"mysqlnd_mysqlnd_vio_connect_pub",\
"mysqlnd_mysqlnd_vio_network_read_pub",\
"mysqlnd_mysqlnd_vio_network_write_pub",\
"mysqlnd_mysqlnd_vio_open_tcp_or_unix_pub",\
"mysqlnd_query_read_result_set_header",\
"mysqlnd_read_body_name",\
"mysqlnd_read_buffer",\
"mysqlnd_read_buffer_is_empty",\
"mysqlnd_read_header",\
"mysqlnd_read_header_name",\
"mysqlnd_read_packet_header_and_body",\
"mysqlnd_run_authentication",\
"mysqlnd_stmt_execute",\
"mysqlnd_stmt_execute_parse_response",\
"pdo_mysql_handle_factory",\
"pdo_mysql_stmt_col_meta",\
"pdo_mysql_stmt_describe",\
"pdo_mysql_stmt_execute",\
"pdo_mysql_stmt_execute_prepared",\
"pdo_mysql_stmt_fetch",\
"pdo_mysql_stmt_get_col",\
"phar_file_get_contents",\
"phar_fopen",\
"php_call_shutdown_functions",\
"php_cli_server_do_event_for_each_fd_callback",\
"php_cli_server_poller_poll",\
"php_cli_server_recv_event_read_request",\
"php_exec",\
"php_execute_script",\
"php_fsockopen_stream",\
"php_getimagesize_from_any",\
"php_mysqlnd_auth_response_read",\
"php_mysqlnd_cmd_write",\
"php_mysqlnd_conn_connect_pub",\
"php_mysqlnd_conn_data_connect_handshake_pub",\
"php_mysqlnd_conn_data_connect_pub",\
"php_mysqlnd_conn_data_next_result_pub",\
"php_mysqlnd_conn_data_query_pub",\
"php_mysqlnd_conn_data_reap_query_pub",\
"php_mysqlnd_conn_data_select_db_pub",\
"php_mysqlnd_conn_data_set_charset_pub",\
"php_mysqlnd_conn_data_simple_command_pub",\
"php_mysqlnd_conn_data_simple_command_send_request_pub",\
"php_mysqlnd_conn_data_store_result_pub",\
"php_mysqlnd_conn_data_tx_commit_or_rollback_pub",\
"php_mysqlnd_eof_read",\
"php_mysqlnd_greet_read",\
"php_mysqlnd_net_connect_ex_pub",\
"php_mysqlnd_net_network_read_ex_pub",\
"php_mysqlnd_net_network_write_ex_pub",\
"php_mysqlnd_net_open_tcp_or_unix_pub",\
"php_mysqlnd_net_receive_ex_pub",\
"php_mysqlnd_net_send_ex_pub",\
"php_mysqlnd_ok_read",\
"php_mysqlnd_prepare_read",\
"php_mysqlnd_res_meta_read_metadata_pub",\
"php_mysqlnd_res_read_result_metadata_pub",\
"php_mysqlnd_res_store_result_fetch_data_pub",\
"php_mysqlnd_res_store_result_pub",\
"php_mysqlnd_rowp_read",\
"php_mysqlnd_rset_field_read",\
"php_mysqlnd_rset_header_read",\
"php_mysqlnd_stmt_execute_pub",\
"php_mysqlnd_stmt_prepare_pub",\
"php_network_accept_incoming",\
"php_network_connect_socket",\
"php_network_connect_socket_to_host",\
"php_openssl_enable_crypto",\
"php_openssl_sockop_close",\
"php_openssl_sockop_io",\
"php_openssl_sockop_read",\
"php_openssl_sockop_set_option",\
"php_openssl_sockop_write",\
"php_pollfd_for",\
"php_replace_in_subject_func",\
"php_request_shutdown",\
"php_sock_stream_wait_for_data",\
"php_sockop_read",\
"php_sockop_read_close",\
"php_sockop_set_option",\
"php_sockop_write",\
"php_stream_read_to_str",\
"php_stream_url_wrap_http",\
"php_stream_url_wrap_http_ex",\
"php_stream_xport_crypto_enable",\
"php_tcp_sockop_set_option",\
"preg_replace_func_impl",\
"readline_shell_run",\
"reflection_method_invoke",\
"run_cli",\
"run_php",\
"user_shutdown_function_call",\
"shutdown_executor",\
"shutdown_destructors",\
"stream_resource_regular_dtor",\
"wasm_select",\
"zend_call_function",\
"zend_call_known_function",\
"zend_close_rsrc_list",\
"zend_deactivate",\
"zend_destroy_rsrc_list",\
"zend_do_fcall_common_helper_SPEC",\
"zend_eval_string_ex",\
"zend_eval_string",\
"zend_eval_stringl",\
"zend_execute",\
"zend_execute_scripts",\
"zend_error",\
"zend_error_va_list",\
"zend_hash_apply",\
"zend_hash_graceful_reverse_destroy",\
"zend_internal_type_error",\
"zend_objects_destroy_object",\
"zend_objects_store_call_destructors",\
"zend_parse_parameters",\
"zend_parse_va_args",\
"zend_std_call_getter",\
"zend_std_has_property",\
"zend_std_read_property",\
"zif_array_map",\
"zif_array_reduce",\
"zif_call_user_func",\
"zif_call_user_func_array",\
"zif_fclose",\
"zif_feof",\
"zif_file_get_contents",\
"zif_fopen",\
"zif_fread",\
"zif_fsockopen",\
"zif_getimagesize",\
"zif_mysqli_begin_transaction",\
"zif_mysqli_connect",\
"zif_mysqli_data_seek",\
"zif_mysqli_errno",\
"zif_mysqli_error",\
"zif_mysqli_fetch_fields",\
"zif_mysqli_fetch_object",\
"zif_mysqli_fetch_row",\
"zif_mysqli_get_charset",\
"zif_mysqli_multi_query",\
"zif_mysqli_next_result",\
"zif_mysqli_prepare",\
"zif_mysqli_query",\
"zif_mysqli_real_connect",\
"zif_mysqli_reap_async_query",\
"zif_mysqli_select_db",\
"zif_mysqli_set_charset",\
"zif_mysqli_stmt_execute",\
"zif_mysqli_stmt_fetch",\
"zif_preg_replace_callback",\
"zif_popen",\
"php_exec_ex",\
"wasm_popen",\
"zif_wasm_popen",\
"zif_system",\
"zif_exec",\
"zif_passthru",\
"zif_shell_exec",\
"zif_proc_open",\
"zif_stream_socket_client",\
"zim_PDOStatement_execute",\
"zim_PDO___construct",\
"zim_PDO_beginTransaction",\
"zim_PDO_commit",\
"zim_PDO_commitTransaction",\
"zim_PDO_dbh_constructor",\
"zim_PDO_exec",\
"zim_PDO_query",\
"zim_PDO_rollBack",\
"zim_ReflectionMethod_invoke",\
"zim_ReflectionMethod_invokeArgs",\
"zim_ReflectionClass_newInstanceArgs",\
"zim_reflection_class_newInstanceArgs",\
"zim_reflection_method_invoke",\
"zim_reflection_method_invokeArgs"'; \
    # If pointer casts are enabled, we need to asyncify both the prefixed and unprefixed names
    if [ "${PHP_VERSION:0:1}" -lt "8" ]; then \
        export ASYNCIFY_ONLY="$ASYNCIFY_ONLY,"$(echo "$ASYNCIFY_ONLY" | sed -E $'s/"([a-zA-Z])/"byn$fpcast-emu$\\1/g'); \
    fi; \
    echo -n ' -s ASYNCIFY_ONLY=['$ASYNCIFY_ONLY_UNPREFIXED$ASYNCIFY_ONLY'] '| tr -d "\n" >> /root/.emcc-php-wasm-flags;

# Build the final .wasm file
RUN mkdir /root/output
COPY ./build-assets/phpwasm-emscripten-library.js /root/phpwasm-emscripten-library.js
RUN source /root/emsdk/emsdk_env.sh && \
    export EXPORTED_FUNCTIONS=$'["_php_wasm_init", \n\
"_phpwasm_destroy_uploaded_files_hash", \n\
"_phpwasm_init_uploaded_files_hash", \n\
"_phpwasm_register_uploaded_file", \n\
"_emscripten_sleep", \n\
"_wasm_sleep", \n\
"_wasm_set_phpini_path", \n\
"_wasm_set_phpini_entries", \n\
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
    emcc -O3 \
    --js-library /root/phpwasm-emscripten-library.js \
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
    -s ASSERTIONS=0                  \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
    -s NODEJS_CATCH_EXIT=0           \
    -s INVOKE_RUN=0                  \
    -s EXIT_RUNTIME=1                \
        /root/lib/libphp.a \
        /root/proc_open.c \
        /root/php_wasm.c \
        $(cat /root/.emcc-php-wasm-sources) \
    -s ENVIRONMENT=$EMSCRIPTEN_ENVIRONMENT \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORT_NAME="'PHPLoader'"
    # Emscripten complains it can't find some Asyncify functions
    # listed in ASYNCIFY_IMPORTS. The culprit is those functions
    # are actually used and delisting them breaks php_pollfd_for().
    # Sooo... just ignore Emscripten's warnings.

RUN ls /root/output/
# # At the moment terminfo is baked into the repository in
# # src/php-cli/terminfo, but if we ever need to update it, we can
# # use the terminfo database produced by the ncurses make script:
# RUN if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
#         mkdir -p /root/output/terminfo/x && \
#         cp -v /root/lib/share/terminfo/x/xterm* /root/output/terminfo/x/; \
#     fi

# Postprocess the build php.js module:
COPY ./build-assets/esm-prefix.js /root/esm-prefix.js
COPY ./build-assets/esm-suffix.js /root/esm-suffix.js
RUN \
    # Figure out the target file names and URLs
        # The .js and .wasm filenames should reflect the build configuration, e.g.:
        # * `php-7.4.node.js` and `php-7.4.node.wasm`
        # * `php-8.0.js` and `php-8.0.wasm`
        # In addition, the `.wasm` file URL should have a "cache busting" query string on the
        # web, so that web browsers will reload it when the file contents change.
    # Precompute export variables:
        export FILE_SIZE=$(stat -c%s "/root/output/php.wasm") && \
        export PHP_VERSION_ESCAPED="${PHP_VERSION//./_}" && \
        export FILENAME_PREFIX="php_${PHP_VERSION_ESCAPED:0:3}"; \
        export EXT_PREFIX=""; \
        export JS_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.js"; \
        export WASM_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.wasm"; \
    # Make the php.wasm URL configurable via the dependencyFilename loader argument:
        /root/replace.sh $'s/["\']php\.wasm[\'"]/dependencyFilename/g' /root/output/php.js && \
    # Patch a "property undefined" error
        # Emscripten produces an if that checks a stream.stream_ops.poll property. However,
        # stream.stream_ops is sometimes undefined and the check fails. Let's adjust it to
        # tolerate a null stream.stream_ops value.
        /root/replace.sh "s/if\s*\(stream\.stream_ops\.poll\)/if (stream.stream_ops?.poll)/g" /root/output/php.js && \
    # Make Emscripten websockets configurable
        # Emscripten makes the Websocket proxy connect to a fixed URL.
        # This assumes the traffic is always forwarded to the same target.
        # However, we want to support arbitrary targets, so we need to
        # replace the hardcoded websocket target URL with a dynamic callback.
        /root/replace.sh $'s/if\s*\(\s*["\']string["\']\s*===\s*typeof Module\[["\']websocket["\']\]\[["\']url["\']\]\s*\)/if("function"===typeof Module["websocket"]["url"]) {\nurl = Module["websocket"]["url"](...arguments);\n}else if ("string" === typeof Module["websocket"]["url"])/g' \
            /root/output/php.js && \
        # Enable custom WebSocket constructors to support socket options.
        /root/replace.sh "s/ws\s*=\s*new WebSocketConstructor/if (Module['websocket']['decorator']) {WebSocketConstructor = Module['websocket']['decorator'](WebSocketConstructor);}ws = new WebSocketConstructor/g" /root/output/php.js && \
        if [ "$WITH_WS_NETWORKING_PROXY" = "yes" ]; then \
            /root/replace.sh "s/sock\.server\s*=\s*new WebSocketServer/if (Module['websocket']['serverDecorator']) {WebSocketServer = Module['websocket']['serverDecorator'](WebSocketServer);}sock.server = new WebSocketServer/g" /root/output/php.js; \
        fi; \
    # Add MSG_PEEK flag support in recvfrom
        #
        # Emscripten ignores the flags argument to ___syscall_recvfrom.
        # However, PHP relies on passing the MSG_PEEK (== integer 2) flag when polling
        # the stream for data.
        # MSG_PEEK enables reading bytes without moving the stream pointer forward.
        # Without the patch below, PHP consumes the first byte from the top of the 
        # response stream, typically "H" in "HTTP/1.1 200 OK", and then fails after
        # reading the remaining "TTP/1.1 200 OK" and not recognizing it as a valid
        # status line.
        # We need to patch the syscall to support the MSG_PEEK flag.
        if [ "$WITH_WS_NETWORKING_PROXY" = "yes" ]; then \
            /root/replace.sh 's/sock\.sock_ops\.recvmsg\(sock,\s*len\);/sock.sock_ops.recvmsg(sock, len, typeof flags !== "undefined" ? flags : 0);/g' /root/output/php.js && \
            /root/replace.sh 's/recvmsg:\s*function\(sock,\s*length\)/recvmsg: function(sock, length, flags)/g' /root/output/php.js && \
            /root/replace.sh 's/if\s*\(sock\.type\s*===\s*1\s*&&\s*bytesRead\s*<\s*queuedLength\)/if (flags&2) {bytesRead = 0;} if (sock.type === 1 && bytesRead < queuedLength)/g' /root/output/php.js; \
        fi ; \
    # Replace the hardcoded ENVIRONMENT variable with a dynamic computation
        #
        # The JavaScript code of the web loader and web worker loader is identical,
        # but Emscripten forces running different code paths by setting
        #
        # ENVIRONMENT_IS_WEB = true; ENVIRONMENT_IS_WORKER = false
        #
        # This project supports both environments and would have to maintain two
        # separate copies of the code. Instead, we use a dynamic computation of the
        # environment, based on the `RuntimeName` variable, which is an argument to the
        # wrapper function.
        /root/replace.sh $'s/ENVIRONMENT_IS_([A-Z]+)\s*=\s*(true|false)/ENVIRONMENT_IS_$1=RuntimeName==="$1"/g' /root/output/php.js && \
        /root/replace.sh 's/var ENV\s*=\s*\{\}/var ENV = PHPLoader.ENV || {}/g' /root/output/php.js && \
    # Turn the php.js file into an ES module
        # Manually turn the output into a esm module instead of relying on -s MODULARIZE=1.
        # which pollutes the global namespace and does not play well with import() mechanics.
        if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
            echo "const dependencyFilename = __dirname + '/$WASM_FILENAME'; " >> /root/output/php-module.js; \
        else \
            echo "import dependencyFilename from './$WASM_FILENAME'; " >> /root/output/php-module.js; \
        fi; \
        echo " export { dependencyFilename }; " >> /root/output/php-module.js && \
        echo "export const dependenciesTotalSize = $FILE_SIZE; " >> /root/output/php-module.js && \
        cat /root/esm-prefix.js >> /root/output/php-module.js && \
        cat /root/output/php.js >> /root/output/php-module.js && \
        cat /root/esm-suffix.js >> /root/output/php-module.js && \
        \
        # Remove the old php.js file
        rm /root/output/php.js && \
        \
        # Rename the build files to their final names
        mv /root/output/php-module.js "/root/output/$JS_FILENAME" && \
        mv /root/output/php.wasm "/root/output/$WASM_FILENAME"