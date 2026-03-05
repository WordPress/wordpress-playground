FROM playground-php-wasm:base

# Each version of PHP requires its own version of the Redis extension
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

# Get and patch PHP
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

# Copy extension headers that phpredis requires.
# These headers are not installed by default during `make install`
# but phpredis needs php_smart_string.h, php_random.h and other headers.
#
# In PHP 8.5+, ext/standard/php_smart_string.h was removed and moved to
# Zend/zend_smart_string.h. Create a compatibility shim for phpredis.
#
# phpredis includes <standard/php_random.h> but PHP 8.x has the random
# extension in ext/random/. We need to copy these headers too.
RUN mkdir -p /usr/local/include/php/ext/standard && \
	if [ -f /root/php-src/ext/standard/php_smart_string.h ]; then \
		cp /root/php-src/ext/standard/*.h /usr/local/include/php/ext/standard/; \
	else \
		echo '#include "Zend/zend_smart_string.h"' > /usr/local/include/php/ext/standard/php_smart_string.h; \
	fi && \
	if [ -d /root/php-src/ext/random ]; then \
		cp /root/php-src/ext/random/*.h /usr/local/include/php/ext/standard/; \
	fi

# Clone phpredis
# Use a specific version that supports all PHP versions we need
# Version 6.3.0 has PHP 8.4+ support
RUN git clone https://github.com/phpredis/phpredis.git /root/phpredis \
	--branch 6.3.0 \
	--single-branch \
	--depth 1;

# Build Redis extension
RUN set -euxo pipefail; \
	cd /root/phpredis; \

	phpize . ; \

	source /root/emsdk/emsdk_env.sh; \

	# Use non-linux host type or configure will try to require linux kernel
	# features that are unsupported by emscripten (e.g., rtnetlink.h).
	# ZEND_ENABLE_ZVAL_LONG64 is required to match PHP's zend_long type (64-bit)
	# which is used in function signatures like zend_throw_exception.
	emconfigure ./configure \
		CFLAGS="-DZEND_ENABLE_ZVAL_LONG64" \
		--host="i386-unknown-freebsd" \
		--disable-static \
		--enable-shared \
		--disable-redis-session \
		--disable-redis-json \
		--disable-redis-igbinary \
		--disable-redis-msgpack \
		--disable-redis-lzf \
		--disable-redis-zstd \
		--disable-redis-lz4; \

	export EMCC_FLAGS="-sSIDE_MODULE -D__x86_64__ -sWASM_BIGINT -Dsetsockopt=wasm_setsockopt -Dusleep=__wrap_usleep"; \

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

	# Patch the libtool to use emcc for linking
	/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS|' libtool; \

	emmake make -j1;

RUN	mkdir -p /root/redis/modules; \
	mv /root/phpredis/modules/* /root/redis/modules;

# Post-process with wasm-opt
RUN	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		/root/redis/modules/redis.so \
		-o /root/redis/modules/redis.so;
