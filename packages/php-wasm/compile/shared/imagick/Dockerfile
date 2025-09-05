FROM playground-php-wasm:base

# Build arguments
# JSPI: when set to 1, builds with JSPI flags, otherwise Asyncify
ARG JSPI
ARG WITH_JSPI
ARG WITH_DEBUG
ARG DEBUG_DWARF_COMPILATION_DIR
ARG PHP_VERSION

# Prepare common lib directory and bring in prebuilt zlib/png/jpeg headers/libs
RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
COPY ./libpng16/ /root/libpng16
COPY ./libjpeg/ /root/libjpeg

# Select JSPI or Asyncify variants of third-party libs (zlib, libpng, libjpeg)
RUN if [ "1" = "1" ] || [ "$JSPI" = "1" ] || [ "$WITH_JSPI" = "yes" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib && \
        cp -r /root/libpng16/jspi/dist/root/lib/* /root/lib && \
        cp -r /root/libjpeg/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib && \
        cp -r /root/libpng16/asyncify/dist/root/lib/* /root/lib && \
        cp -r /root/libjpeg/asyncify/dist/root/lib/* /root/lib; \
    fi

ENV CFLAGS="-I/root/lib/include -O3" \
    CXXFLAGS="-I/root/lib/include -O3" \
    LDFLAGS="-L/root/lib/lib" \
    EM_PKG_CONFIG_PATH="/root/lib/lib/pkgconfig"

# Build PHP (to obtain phpize and headers)
# Install Bison (PHP requires it) – use 2.7 for <=7.3, otherwise distro bison
RUN mkdir -p /libs
COPY ./bison2.7/dist/ /libs/bison2.7
COPY ./bison2.7/bison27.patch /root/bison27.patch
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
        if /libs/bison2.7/usr/local/bison/bin/bison -h >/dev/null; then \
            mv /libs/bison2.7/usr/local/bison /usr/local/bison && \
            ln -s /usr/local/bison/bin/bison /usr/bin/bison && \
            ln -s /usr/local/bison/bin/yacc /usr/bin/yacc; \
        else \
            wget https://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz && \
            tar -xvf bison-2.7.tar.gz && \
            rm bison-2.7.tar.gz && \
            cd bison-2.7 && \
            git apply --no-index /root/bison27.patch && \
            ./configure --prefix=/usr/local && \
            make && \
            make install; \
            if [[ $? -ne 0 ]]; then \
                echo 'Failed to build Bison 2.7 dependency.'; \
                exit -1; \
            fi; \
        fi; \
    else \
        apt update && apt install -y bison; \
    fi;

# Clone and build PHP with a minimal configuration
RUN git clone https://github.com/php/php-src.git php-src \
    --branch PHP-$PHP_VERSION \
    --single-branch \
    --depth 1;
RUN cd php-src && ./buildconf --force
COPY ./php/php*.patch /root/
RUN cd /root && git apply --no-index /root/php${PHP_VERSION:0:3}*.patch -v || true
RUN source /root/emsdk/emsdk_env.sh && \
    cd php-src && \
    emconfigure ./configure \
    --disable-fiber-asm \
    --enable-embed \
    --disable-cgi \
    --disable-opcache \
    --disable-phpdbg \
    --without-pcre-jit \
    --disable-cli \
    --disable-libxml \
    --without-libxml \
    --disable-dom \
    --disable-xml \
    --disable-simplexml \
    --disable-xmlreader \
    --disable-xmlwriter \
    --without-sqlite3 \
    --without-pdo-sqlite \
    --without-iconv

# Disable ASM arithmetic and GCC/Clang specific code paths for wasm
RUN if [[ ("${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -ge "4") || "${PHP_VERSION:0:1}" -ge "8" ]]; then \
        /root/replace.sh 's/ZEND_USE_ASM_ARITHMETIC 1/ZEND_USE_ASM_ARITHMETIC 0/g' /root/php-src/Zend/zend_operators.h; \
    elif [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "3" ]]; then \
        /root/replace.sh 's/defined\(HAVE_ASM_GOTO\)/0/g' /root/php-src/Zend/zend_operators.h; \
    fi;
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_multiply.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
RUN /root/replace.sh 's/defined\(__clang__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c

# PHP <= 7.3 workaround for readdir_r detection
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
        echo '#define HAVE_POSIX_READDIR_R 1' >> /root/php-src/main/php_config.h; \
    fi;
RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/php-src && \
    emmake make install

COPY ./libimagick/ /root/libimagick

# Select correct ImageMagick wasm variant (JSPI vs Asyncify)
RUN if [ "1" = "1" ] || [ "$JSPI" = "1" ] || [ "$WITH_JSPI" = "yes" ]; then \
        cp -r /root/libimagick/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libimagick/asyncify/dist/root/lib/* /root/lib; \
    fi

## Build the Imagick PHP extension using the wasm ImageMagick already in the container

# Build Intl PHP extension
# https://github.com/Imagick/imagick is home of the PHP extension, not of
# the ImageMagick library.
RUN git clone https://github.com/Imagick/imagick

RUN cd /root/imagick && phpize

RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/imagick && \
	export CXXFLAGS="-sSIDE_MODULE -D__x86_64__"; \
	# Ensure pkg-config resolves our ImageMagick .pc files and their dependencies
	emconfigure ./configure \
        PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
		--host=i386-unknown-freebsd \
		--prefix=/root \
		--with-imagick=/root/lib \
        CFLAGS="${EMCC_CFLAGS}" CXXFLAGS="${EMCC_CFLAGS}" \
        LDFLAGS="${EMCC_LDFLAGS}" LIBS=""
	

RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/imagick && \
    emmake make

RUN source /root/emsdk/emsdk_env.sh && \
    cd /root/imagick && \
    emmake make install