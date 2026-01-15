FROM playground-php-wasm:base

# Each version of PHP requires its own version of the Redis extension
# because each version of PHP has a specific Zend Engine API version.
ARG PHP_VERSION

ARG JSPI

ARG DEBUG

# Install Bison, required to build PHP
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
		apt install -y bison; \
	fi;

# Clone PHP
RUN git clone https://github.com/php/php-src.git php-src \
	--branch php-$PHP_VERSION \
	--single-branch \
	--depth 1;

# Build PHP
RUN cd php-src && ./buildconf --force

# PHP <= 7.3 Get and patch PHP
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
RUN if [[ ("${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -ge "4") || "${PHP_VERSION:0:1}" -ge "8" ]]; then \
		/root/replace.sh 's/ZEND_USE_ASM_ARITHMETIC 1/ZEND_USE_ASM_ARITHMETIC 0/g' /root/php-src/Zend/zend_operators.h; \
	elif [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "3" ]]; then \
		/root/replace.sh 's/defined\(HAVE_ASM_GOTO\)/0/g' /root/php-src/Zend/zend_operators.h; \
	fi;
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_multiply.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
RUN /root/replace.sh 's/defined\(__clang__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c

# PHP <= 7.3 is not very good at detecting the presence of the POSIX readdir_r function
# so we need to force it to be enabled.
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
		echo '#define HAVE_POSIX_READDIR_R 1' >> /root/php-src/main/php_config.h; \
	fi;

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
	\
	phpize . ; \
	\
	source /root/emsdk/emsdk_env.sh; \
	\
	# Use non-linux host type or configure will try to require linux kernel
	# features that are unsupported by emscripten (e.g., rtnetlink.h).
	emconfigure ./configure \
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
	\
	export EMCC_FLAGS="-sSIDE_MODULE -fPIC"; \
	\
	if [ "$DEBUG" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -O0 -g3"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -O3"; \
	fi; \
	\
	if [ "$JSPI" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -sASYNCIFY -sASYNCIFY_ADVISE"; \
	fi; \
	\
	# Patch the libtool to use emcc for linking
	/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS|' libtool; \
	\
	emmake make -j1;

# Post-process with wasm-opt
RUN	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		/root/phpredis/modules/redis.so \
		-o /root/phpredis/modules/redis.so;

RUN	mkdir -p /root/redis/modules; \
	mv /root/phpredis/modules/* /root/redis/modules;
