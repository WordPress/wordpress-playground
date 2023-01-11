# Originally forked from https://github.com/seanmorris/php-wasm
# ubuntu:lunar supports amd64 and arm64 (Apple Silicon) while
# emscripten/emsdk:3.1.24 supports amd64 only.
FROM ubuntu:lunar

SHELL ["/bin/bash", "-c"]
# The PHP version to build.
# This value must point to an existing branch of the
# https://github.com/php/php-src.git repository when prefixed
# with "PHP-".
# For example, "7.4.0" is valid because the branch PHP-7.4.0 exists,
# but just "7" is invalid because there's no branch PHP-7.
ARG PHP_VERSION=8.0.24
ENV PHP_VERSION ${PHP_VERSION}

# The PHP extensions to build:
ARG WITH_VRZNO=yes
ENV WITH_VRZNO ${WITH_VRZNO}

ARG WITH_LIBXML=no
ENV WITH_LIBXML ${WITH_LIBXML}

ARG WITH_LIBZIP=yes
ENV WITH_LIBZIP ${WITH_LIBZIP}

# Whether to include the NODEFS JavaScript library.
# It's useful for loading files and mounting directories
# from the local filesystem.
ARG WITH_NODEFS=no
ENV WITH_NODEFS ${WITH_NODEFS}

# The platform to build for: web or node
ARG EMSCRIPTEN_ENVIRONMENT=web
ENV EMSCRIPTEN_ENVIRONMENT ${EMSCRIPTEN_ENVIRONMENT}

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

# PHP <= 7.3 requires Bison 2.7
# PHP >= 7.4 and Bison 3.0
COPY ./build-assets/bison27.patch /root/bison27.patch
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
        wget http://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz && \
        tar -xvf bison-2.7.tar.gz && \
        rm bison-2.7.tar.gz && \
        cd bison-2.7 && \
        git apply --no-index /root/bison27.patch && \
        ./configure --prefix=/usr/local/bison --with-libiconv-prefix=/usr/local/libiconv/ && \
        make && \
        make install && \
        ln -s /usr/local/bison/bin/bison /usr/bin/bison && \
        ln -s /usr/local/bison/bin/yacc /usr/bin/yacc; \
    else \
        apt install -y bison; \
    fi;

# Install Emscripten from the repository. We'd use the official
# Docker image, but there is no arm64 image available which makes
# the build take forever on Apple Silicon.
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN git clone https://github.com/emscripten-core/emsdk.git && \
    ./emsdk/emsdk install latest && \
    /root/emsdk/emsdk activate latest

RUN touch /root/.configure-flags && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.emcc-php-wasm-sources && \
    touch /root/.emcc-php-wasm-flags && \
    touch /root/.EXTRA_EXPORTED_RUNTIME_METHODS

# Add Libxml2 if needed
RUN if [ "$WITH_LIBXML" = "yes" ]; \
    then \
        source /root/emsdk/emsdk_env.sh && \
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
        echo -n ' -I /root/libxml2' >> /root/.emcc-php-wasm-flags; \
        echo -n ' /root/lib/lib/libxml2.a' >> /root/.emcc-php-wasm-sources; \
    else \
        echo -n ' --without-libxml --disable-dom --disable-xml --disable-simplexml' >> /root/.php-configure-flags; \
    fi

# Get and patch PHP
RUN git clone https://github.com/php/php-src.git php-src \
    --branch PHP-$PHP_VERSION   \
    --single-branch          \
    --depth 1;
COPY ./build-assets/php*.patch /root/
RUN git apply --no-index /root/php${PHP_VERSION:0:3}.patch && \
    mkdir -p php-src/preload/Zend \
    && cp php-src/Zend/bench.php php-src/preload/Zend \
    && touch php-src/patched

# Add gzip and libzip if needed
COPY ./build-assets/zlib /root/zlib
RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
        source /root/emsdk/emsdk_env.sh && \
        cd /root/zlib && \
        emconfigure ./configure --prefix=/root/lib && \
        # emmake make fails after it built the library files – let's ignore the errors \
        (emmake make || true) && \
        emmake make install && \
        if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
            apt install -y zlib1g zlib1g-dev; \
            export LIBZIP_VERSION=1.2.0; \
        else \
            export LIBZIP_VERSION=1.9.2; \
        fi; \
        cd /root && \
        curl -k https://libzip.org/download/libzip-$LIBZIP_VERSION.tar.gz -o libzip-$LIBZIP_VERSION.tar.gz && \
        tar -xzf libzip-$LIBZIP_VERSION.tar.gz && \
        mv libzip-$LIBZIP_VERSION libzip && \
        cd libzip && \
        mkdir build && \
        cd build && \
        emcmake cmake \
            -DCMAKE_INSTALL_PREFIX=/root/lib \
            -DZLIB_LIBRARY=/root/lib/lib/libz.a \
            -DZLIB_INCLUDE_DIR=/root/lib/include \
            .. && \
        emmake make && \
        emmake make install; \
        if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
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
        fi; \
    fi

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
        echo -n ' -DWITH_VRZNO=1' >> /root/.emcc-php-wasm-flags; \
        echo -n ', "_exec_callback", "_del_callback"' >> /root/.EXTRA_EXPORTED_FUNCTIONS; \
    fi

# Build the patched PHP
RUN cd php-src/ && PKG_CONFIG_PATH=$PKG_CONFIG_PATH ./buildconf --force
RUN source /root/emsdk/emsdk_env.sh && \
    cd php-src/ && \
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
    --disable-cli      \
    --disable-all      \
    --with-sqlite3     \
    --enable-pdo       \
    --with-pdo-sqlite  \
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
    --disable-mbstring  \
    --disable-mbregex  \
    --enable-tokenizer \
    $(cat /root/.php-configure-flags)

# PHP <= 7.3 is not very good at detecting the presence of the POSIX readdir_r function
# so we need to force it to be enabled.
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]] || [ "${PHP_VERSION:0:1}" -le "5" ]; then \
        echo '#define HAVE_POSIX_READDIR_R 1' >> php-src/main/php_config.h; \
    fi;

RUN source /root/emsdk/emsdk_env.sh && \
    cd php-src/ && \
    emmake make -j8

RUN cp -v php-src/.libs/libphp*.la /root/lib/libphp.la
RUN cp -v php-src/.libs/libphp*.a /root/lib/libphp.a

COPY ./build-assets/php_wasm.c /root/

# Add nodefs when requested
RUN if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
        echo -n ' -lnodefs.js' >> /root/.emcc-php-wasm-flags; \
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
RUN source /root/emsdk/emsdk_env.sh && \
    export EXPORTED_FUNCTIONS='["_php_wasm_init", "_wasm_sapi_handle_request", "_wasm_add_uploaded_file", "_wasm_add_SERVER_entry","_wasm_set_query_string","_wasm_set_cookies","_wasm_set_path_translated","_wasm_set_request_uri","_wasm_set_request_method","_wasm_set_content_type","_wasm_set_request_body","_wasm_set_php_code","_wasm_set_proto_num", "_phpwasm_init_uploaded_files_hash", "_phpwasm_register_uploaded_file", "_phpwasm_destroy_uploaded_files_hash" '"$(cat /root/.EXTRA_EXPORTED_RUNTIME_METHODS)"']'; \
    cd php-src/ && \
    emcc -O0 -g2 \
    -I .     \
    -I ext   \
    -I ext/pdo_sqlite   \
    -I ext/json   \
    -I Zend  \
    -I main  \
    -I TSRM/ \
    $(cat /root/.emcc-php-wasm-flags) \
    -o /root/output/php.js \
    -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8", "FS", "PROXYFS"]' \
    -s INITIAL_MEMORY=1024MB \
    -s ALLOW_MEMORY_GROWTH=1         \
    -s ASSERTIONS=0                  \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0  \
    -s INVOKE_RUN=0                  \
        /root/lib/libphp.a \
        /root/php_wasm.c \
        $(cat /root/.emcc-php-wasm-sources) \
    -s ENVIRONMENT=$EMSCRIPTEN_ENVIRONMENT \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORT_NAME="'PHPLoader'"

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
        cat /root/output/php.js \
            | sed 's#"php\.wasm"#dependencyFilename#g' \
            | sed "s#'php\.wasm'#dependencyFilename#g" \
            > /tmp/php.js && \
        mv /tmp/php.js /root/output/php.js && \
        # Replace the hardcoded ENVIRONMENT variable with a dynamic computation.
            # The JavaScript code of the web loader and web worker loader is identical,
            # but Emscripten forces running different code paths by setting
            #
            # ENVIRONMENT_IS_WEB = true; ENVIRONMENT_IS_WORKER = false
            #
            # This project supports both environments and would have to maintain two
            # separate copies of the code. Instead, we use a dynamic computation of the
            # environment, based on the `Env` variable, which is an argument to the
            # wrapper function.
            cat /root/output/php.js \
                | sed -E 's/ENVIRONMENT_IS_([A-Z]+)\s*=\s*(true|false)/ENVIRONMENT_IS_\1=Env==="\1"/g' \
                > /tmp/php.js && \
            mv /tmp/php.js /root/output/php.js && \
    # Turn the php.js file into an ES module
        # Manually turn the output into a esm module instead of relying on -s MODULARIZE=1.
        # which pollutes the global namespace and does not play well with import() mechanics.
        echo "export const dependenciesTotalSize = $FILE_SIZE; export const dependencyFilename = '$WASM_URL'; export default function(Env, PHPLoader) {" >> /root/output/php-module.js && \
        cat /root/output/php.js >> /root/output/php-module.js && \
        echo " return PHPLoader; }" >> /root/output/php-module.js && \
        \
        # Remove the old php.js file
        rm /root/output/php.js && \
        \
        # Rename the build files to their final names
        mv /root/output/php-module.js "/root/output/$JS_FILENAME" && \
        mv /root/output/php.wasm "/root/output/$WASM_FILENAME"

