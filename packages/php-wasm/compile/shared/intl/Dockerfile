FROM playground-php-wasm:base

# Each version of PHP requires its own version of Intl
# because each version of PHP has a specific Zend Engine API version.
# Consequently, each version of Intl is designed to be
# compatible with a particular Zend Engine API version.
ARG PHP_VERSION

ARG JSPI

ARG DEBUG

# Install Bison, required to build PHP
RUN mkdir -p /libs
RUN apt install -y bison;

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
RUN /root/replace.sh 's/ZEND_USE_ASM_ARITHMETIC 1/ZEND_USE_ASM_ARITHMETIC 0/g' /root/php-src/Zend/zend_operators.h;
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_multiply.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
RUN /root/replace.sh 's/defined\(__clang__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c

RUN source /root/emsdk/emsdk_env.sh && \
	cd /root/php-src && \
	emmake make install

# Build ICU libraries
RUN set -euxo pipefail; \
	wget https://github.com/unicode-org/icu/releases/download/release-74-2/icu4c-74_2-src.tgz; \
	tar -xvf icu4c-74_2-src.tgz; \
	rm -rf /root/icu/source/data/; \
	rm icu4c-74_2-src.tgz; \

	wget https://github.com/unicode-org/icu/releases/download/release-74-2/icu4c-74_2-data.zip; \
	unzip icu4c-74_2-data.zip -d /root/icu/source; \
	rm icu4c-74_2-data.zip; \

	mkdir -p /root/native; \
	cd /root/native; \
	/root/icu/source/runConfigureICU Linux; \
	make -j1; \
	make install; \

	cd /root/icu/source; \
	mkdir -p /root; \
	source /root/emsdk/emsdk_env.sh; \
	export CFLAGS="-fPIC -D__x86_64__"; \
	export CXXFLAGS="-fPIC -D__x86_64__"; \

	emconfigure ./configure \
		--host=i386-unknown-freebsd \
		--prefix=/root \
		--with-cross-build=/root/native \
		--with-data-packaging=archive \
		--disable-extras \
		--enable-static \
		--disable-shared; \
	EMCC_FLAGS="-D__x86_64__" emmake make -j1; \
	EMCC_FLAGS="-D__x86_64__" emmake make install;

# Build Intl
RUN set -euxo pipefail; \
	cd php-src/ext/intl; \

	phpize . ; \

	source /root/emsdk/emsdk_env.sh; \

	# Use non-linux host type or configure will try to require linux kernel
	# features that are unsupported by emscripten (e.g., rtnetlink.h).
	emconfigure ./configure CXXFLAGS="-DZEND_ENABLE_ZVAL_LONG64" ICU_CFLAGS="-D__x86_64__ -I/root/include" ICU_LIBS="-L/root/lib" --host="i386-unknown-freebsd" --disable-static --enable-shared; \

	# Intl linking fails to produce a shared library because postdeps variable includes static libraries.
	# Let's explicitly skip them in the understanding that it is provided by Emscripten with the main module.
	/root/replace.sh 's|postdeps\s*=.*|postdeps="-L/root/emsdk/upstream/emscripten/cache/sysroot/lib/wasm32-emscripten -L/root/emsdk/upstream/emscripten/src/lib"|' libtool; \
	# Replace the default compiler invocation ($CC) with emcc and force-link the required ICU static libraries
	# into the shared object. The --whole-archive / --no-whole-archive flags ensure that *all* symbols from these
	# archives are included, preventing missing symbol errors at runtime when loading the intl extension.
	/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS -shared --whole-archive /root/lib/libicuio.a /root/lib/libicudata.a /root/lib/libicui18n.a /root/lib/libicuuc.a --no-whole-archive|' libtool; \

	export EMCC_FLAGS="-sSIDE_MODULE -D__x86_64__"; \

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

# Post-process with wasm-opt
RUN	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		/root/php-src/ext/intl/modules/intl.so \
		-o /root/php-src/ext/intl/modules/intl.so;

RUN	mkdir -p /root/intl/modules; \
	mv /root/php-src/ext/intl/modules/* /root/intl/modules;

RUN	mkdir -p /root/intl/data; \
	mv /root/share/icu/74.2/icudt74l.dat /root/intl/data/icu.dat;
