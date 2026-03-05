FROM playground-php-wasm:base

# Each version of PHP requires its own version of Xdebug
# because each version of PHP has a specific Zend Engine API version.
# Consequently, each version of Xdebug is designed to be
# compatible with a particular Zend Engine API version.
ARG PHP_VERSION

ARG JSPI

ARG DEBUG

# Install Bison, required to build PHP
RUN mkdir -p /libs
RUN apt install -y bison;

# Build PHP
RUN git clone https://github.com/php/php-src.git php-src \
	--branch php-$PHP_VERSION \
	--single-branch \
	--depth 1;

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
RUN /root/replace.sh 's/ZEND_USE_ASM_ARITHMETIC 1/ZEND_USE_ASM_ARITHMETIC 0/g' /root/php-src/Zend/zend_operators.h;
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_multiply.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
RUN /root/replace.sh 's/defined\(__clang__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c

RUN source /root/emsdk/emsdk_env.sh && \
	cd /root/php-src && \
	emmake make install

# Build Xdebug
RUN set -euxo pipefail; \
	if [[ "${PHP_VERSION:0:1}" -ge "8" && "${PHP_VERSION:2:1}" -ge "5" ]]; then \
		export XDEBUG_BRANCH="xdebug_3_5"; \
	elif [[ "${PHP_VERSION:0:1}" -ge 8 ]]; then \
		export XDEBUG_BRANCH="xdebug_3_4"; \
	else \
		export XDEBUG_BRANCH="xdebug_3_1"; \
	fi; \

	git clone https://github.com/xdebug/xdebug.git xdebug \
		--branch "${XDEBUG_BRANCH}" \
		--single-branch \
		--depth 1;

# Fix root-level .xdebug mapping discovery.
# Strict `>` checks skipped resolving "/" for shallow paths.
# Using `>=` ensures "/.xdebug" is properly scanned.
# Pending upstream pull request : https://github.com/xdebug/xdebug/pull/1062
RUN if [[ "${PHP_VERSION:0:3}" != "7.4" ]]; then \
		/root/replace.sh 's/current_dir\s*=\s*parts->c\s*>\s*2/current_dir = parts->c >= 2/g' /root/xdebug/src/lib/maps/maps.c; \
		/root/replace.sh 's/parent_dir\s*=\s*parts->c\s*>\s*3/parent_dir = parts->c >= 3/g' /root/xdebug/src/lib/maps/maps.c; \
		/root/replace.sh 's/grand_dir\s*=\s*parts->c\s*>\s*4/grand_dir = parts->c >= 4/g' /root/xdebug/src/lib/maps/maps.c; \
	fi;

RUN	cd xdebug; \

	phpize . ; \

	source /root/emsdk/emsdk_env.sh; \
	# Use non-linux host type or configure will try to require linux kernel
	# features that are unsupported by emscripten (e.g., rtnetlink.h).
	emconfigure ./configure --host="i386-unknown-freebsd" --disable-static --enable-shared; \
	# XDebug linking fails to produce a shared lib because libm is missing.
	# Let's explicitly skip libm in the understanding that it is provided by Emscripten
	# with the main module.
	/root/replace.sh 's/^(XDEBUG_SHARED_LIBADD\s*=.*\s*)-lm\b/$1/' Makefile; \

	export EMCC_FLAGS="-sSIDE_MODULE -D__x86_64__ -sWASM_BIGINT -Dsetsockopt=wasm_setsockopt -Drecv=wasm_recv -Dgetpid=__wrap_getpid"; \

	if [ "$DEBUG" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -O0 -g3"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -O3"; \
	fi; \

	if [ "$JSPI" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI -sJSPI_IMPORTS=wasm_recv -sJSPI_EXPORTS=wasm_recv"; \
	else \
		# execute_internal must be in ASYNCIFY_IMPORTS for Xdebug to trace internal PHP functions.
		# This enables async unwinding during breakpoints or stepping inside internal calls.
		export EMCC_FLAGS="${EMCC_FLAGS} -sASYNCIFY -sASYNCIFY_ADVISE -sASYNCIFY_IMPORTS=wasm_recv,execute_internal -sASYNCIFY_EXPORTS=wasm_recv"; \
	fi; \

	emmake make -j1

# Post-process with wasm-opt
RUN	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		/root/xdebug/modules/xdebug.so \
		-o /root/xdebug/modules/xdebug.so;
