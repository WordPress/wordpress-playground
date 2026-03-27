FROM playground-php-wasm:base

# Each version of PHP requires its own version of memcached
# because each version of PHP has a specific Zend Engine API version.
ARG PHP_VERSION

ARG JSPI

ARG DEBUG

# Install Bison, required to build PHP
RUN apt install -y bison

# Clone PHP
RUN git clone https://github.com/php/php-src.git php-src \
	--branch php-$PHP_VERSION \
	--single-branch \
	--depth 1;

# Build PHP
RUN cd php-src && ./buildconf --force

COPY ./php/php*.patch /root/
RUN cd /root && git apply --no-index /root/php${PHP_VERSION:0:3}*.patch -v

#
# This PHP compilation is not the runtime PHP used in Playground.
# It is only built because 'phpize' requires a matching PHP version.
#
# Therefore, this PHP build is intentionally configured with
# the smallest possible feature set.
#
# The resulting PHP version is not used at runtime.
# It only exists to enable 'phpize' to build extensions.
#
RUN source /root/emsdk/emsdk_env.sh && \
	cd php-src && \
	emconfigure ./configure \
	--disable-fiber-asm \
	--enable-embed \
	--disable-cgi \
	# PHP 8.5
	--disable-opcache-jit \
	# PHP < 8.5
	--disable-opcache \
	--disable-phpdbg \
	--without-pcre-jit \
	--disable-cli \
	# PHP < 8.5
	--disable-libxml \
	--without-libxml \
	--disable-dom \
	--disable-xml \
	--disable-simplexml \
	--disable-xmlreader \
	--disable-xmlwriter \
	--without-sqlite3 \
	--without-pdo-sqlite \
	# PHP 7.4
	--without-iconv

# Disable asm arithmetic.
RUN /root/replace.sh 's/ZEND_USE_ASM_ARITHMETIC 1/ZEND_USE_ASM_ARITHMETIC 0/g' /root/php-src/Zend/zend_operators.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_multiply.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
RUN /root/replace.sh 's/defined\(__clang__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c

RUN source /root/emsdk/emsdk_env.sh && \
	cd /root/php-src && \
	emmake make install

# Copy extension headers that php-memcached may require
# PHP 8.5 moved php_smart_string.h to Zend/zend_smart_string.h
RUN mkdir -p /usr/local/include/php/ext/standard && \
	if [ -f /root/php-src/ext/standard/php_smart_string.h ]; then \
		cp /root/php-src/ext/standard/*.h /usr/local/include/php/ext/standard/; \
	else \
		echo '#include "Zend/zend_smart_string.h"' > /usr/local/include/php/ext/standard/php_smart_string.h; \
	fi && \
	if [ -d /root/php-src/ext/random ]; then \
		cp /root/php-src/ext/random/*.h /usr/local/include/php/ext/standard/; \
	fi

# Copy prebuilt zlib from the repo (already compiled for Emscripten)
# Use the asyncify or jspi version based on the build mode
# The prebuilt zlib has structure: dist/root/lib/include and dist/root/lib/lib/libz.a
# We flatten it to: /root/zlib/include and /root/zlib/lib/libz.a
COPY ./libz/asyncify/dist/root/lib/include /root/zlib-asyncify/include
COPY ./libz/asyncify/dist/root/lib/lib /root/zlib-asyncify/lib
COPY ./libz/jspi/dist/root/lib/include /root/zlib-jspi/include
COPY ./libz/jspi/dist/root/lib/lib /root/zlib-jspi/lib
RUN if [ "$JSPI" = "yes" ]; then \
		mv /root/zlib-jspi /root/zlib && rm -rf /root/zlib-asyncify; \
	else \
		mv /root/zlib-asyncify /root/zlib && rm -rf /root/zlib-jspi; \
	fi

# Build libmemcached for Emscripten
# Using libmemcached-awesome (maintained fork) version 1.1.4
#
# We build libmemcached without socket redirections first. The recv/setsockopt
# calls in libmemcached will import the POSIX names. Later, we'll handle this
# by having the main PHP module export these functions.
RUN set -euxo pipefail; \
	apt-get update && apt-get install -y cmake; \
	source /root/emsdk/emsdk_env.sh; \
	git clone https://github.com/awesomized/libmemcached.git /root/libmemcached \
		--branch 1.1.4 \
		--single-branch \
		--depth 1; \
	cd /root/libmemcached; \
	mkdir build && cd build; \
	# Build with minimal features, disabling things that won't work in WASM

	emcmake cmake .. \
		-DCMAKE_INSTALL_PREFIX=/root/libmemcached-install \
		-DCMAKE_C_FLAGS="-fPIC -D__x86_64__" \
		-DCMAKE_CXX_FLAGS="-fPIC -D__x86_64__" \
		-DBUILD_SHARED_LIBS=OFF \
		-DBUILD_TESTING=OFF \
		-DBUILD_DOCS=OFF \
		-DENABLE_SASL=OFF \
		-DENABLE_OPENSSL=OFF \
		-DENABLE_HASH_HSIEH=ON \
		-DENABLE_HASH_FNV64=ON \
		-DENABLE_HASH_MURMUR=ON \
		-DENABLE_MEMASLAP=OFF \
		-DENABLE_DTRACE=OFF; \

	emmake make -j$(nproc); \
	emmake make install;

# Clone php-memcached (the PHP extension)
# Using version 3.4.0 which supports PHP 7.4 through 8.5
RUN git clone https://github.com/php-memcached-dev/php-memcached.git /root/php-memcached \
	--branch v3.4.0 \
	--single-branch \
	--depth 1;

COPY ./shared/memcached/shims/socket.c /root/php-memcached/wasm_socket_shims.c
# Build php-memcached
RUN set -euxo pipefail; \
	cd /root/php-memcached; \

	/root/replace.sh 's|PHP_NEW_EXTENSION\(memcached,|PHP_NEW_EXTENSION\(memcached, wasm_socket_shims.c|' /root/php-memcached/config.m4; \

	phpize . ; \

	source /root/emsdk/emsdk_env.sh; \

	# Use non-linux host type or configure will try to require linux kernel
	# features that are unsupported by emscripten (e.g., rtnetlink.h).
	# ZEND_ENABLE_ZVAL_LONG64 is required to match PHP's zend_long type (64-bit)
	# which is used in function signatures like zend_throw_exception.
	emconfigure ./configure \
		CFLAGS="-DZEND_ENABLE_ZVAL_LONG64 -I/root/zlib/include -I/root/libmemcached-install/include" \
		LDFLAGS="-L/root/zlib/lib -L/root/libmemcached-install/lib" \
		--host="i386-unknown-freebsd" \
		--disable-static \
		--enable-shared \
		--with-zlib-dir=/root/zlib \
		--with-libmemcached-dir=/root/libmemcached-install \
		--disable-memcached-session \
		--disable-memcached-sasl \
		--disable-memcached-igbinary \
		--disable-memcached-json \
		--disable-memcached-msgpack \
		--disable-memcached-protocol; \

	# Patch the libtool to use emcc for linking with static libraries.
	# We must include all required static libraries with --whole-archive to ensure
	# all symbols are available in the shared module.
	# --allow-multiple-definition is needed because libmemcached and libmemcachedutil share some code
	# libhashkit.a provides hashkit_* functions used by libmemcached
	/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS -shared -Wl,--allow-multiple-definition --whole-archive /root/zlib/lib/libz.a /root/libmemcached-install/lib/libhashkit.a /root/libmemcached-install/lib/libmemcached.a /root/libmemcached-install/lib/libmemcachedutil.a --no-whole-archive|' libtool; \
	# Skip dependency checking that prevents shared library creation
	/root/replace.sh 's|^deplibs_check_method=.*|deplibs_check_method=pass_all|' libtool; \
	# Remove the duplicate -l flags from the Makefile since we're already linking static libs
	/root/replace.sh 's|-lz||g; s|-lmemcached||g; s|-lmemcachedutil||g' Makefile; \

	# Build as a side module
	export EMCC_FLAGS="-sSIDE_MODULE -D__x86_64__ -sWASM_BIGINT"; \

	if [ "$DEBUG" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -O0 -g3"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -O3"; \
	fi; \

	if [ "$JSPI" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -sASYNCIFY -sASYNCIFY_ADVISE"; \
	fi; \

	emmake make -j1;

RUN	mkdir -p /root/memcached/modules; \
	mv /root/php-memcached/modules/* /root/memcached/modules;

# Post-process with wasm-opt
RUN	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		/root/memcached/modules/memcached.so \
		-o /root/memcached/modules/memcached.so;
