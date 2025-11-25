FROM playground-php-wasm:base

# Each version of PHP requires its own version of Intl
# because each version of PHP has a specific Zend Engine API version.
# Consequently, each version of Intl is designed to be
# compatible with a particular Zend Engine API version.
ARG PHP_VERSION

ARG WITH_JSPI

ARG WITH_DEBUG

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
	--branch PHP-$PHP_VERSION \
	--single-branch \
	--depth 1;

# Workaround to add ICU FLAGS to intl below 7.3 to inject -fPIC.
RUN if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "2" ]]; then \
		sed -i "s/\$ICU_INCS/\$ICU_INCS \$ICU_CFLAGS/" /root/php-src/ext/intl/config.m4; \
	fi;

# Build PHP
RUN cd php-src && ./buildconf --force

# PHP <= 7.3 Get and patch PHP
COPY ./php/php*.patch /root/
RUN cd /root && git apply --no-index /root/php${PHP_VERSION:0:3}*.patch -v

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

	# Calling close() on a file descriptor acquired through WASI syscalls can trigger a JS call/await
	# during a non-resumable C++ stack frame, leading to "RuntimeError: trying to suspend JS frames".
	# Since ICU maps the file into memory and does not require the descriptor after mapping
	# under our build context, skipping close(fd) avoids that suspension error.
	# NOTE: This means the file descriptor will remain open until process teardown.
	# This is acceptable here because ICU data files are loaded only once at startup.
	/root/replace.sh 's/close\(fd\);//' /root/icu/source/common/umapfile.cpp; \

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
	if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
		/root/replace.sh 's/UBool operator/bool operator/' /root/php-src/ext/intl/breakiterator/codepointiterator_internal.h; \
		/root/replace.sh 's/UBool CodePointBreakIterator::operator/bool CodePointBreakIterator::operator/' /root/php-src/ext/intl/breakiterator/codepointiterator_internal.cpp; \
		/root/replace.sh 's/ getArg/ phpGetArg/g; s/::getArg/::phpGetArg/g; s/ getMessage/ phpGetMessage/g; s/::getMessage/::phpGetMessage/g' /root/php-src/ext/intl/msgformat/msgformat_helpers.cpp; \
	fi; \

	if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "2" ]]; then \
		files=( /root/php-src/ext/intl/collator/collator_sort.c /root/php-src/ext/intl/normalizer/normalizer_normalize.c /root/php-src/ext/intl/dateformat/dateformat_attr.c /root/php-src/ext/intl/timezone/timezone_class.cpp /root/php-src/ext/intl/timezone/timezone_methods.cpp /root/php-src/ext/intl/breakiterator/codepointiterator_internal.cpp ); \
		for file in "${files[@]}"; do /root/replace.sh 's/\bFALSE\b/false/g; s/\bTRUE\b/true/g' "$file"; done; \
	fi; \

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
	/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS -shared --whole-archive /root/lib/libicudata.a /root/lib/libicui18n.a /root/lib/libicuuc.a --no-whole-archive|' libtool; \
	# The generated Makefile incorrectly sets INTL_SHARED_LIBADD to include static ICU libraries.
	# This breaks building a dynamic intl extension with Emscripten.
	if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
		/root/replace.sh 's|INTL_SHARED_LIBADD\s*=.*||' Makefile; \
	fi; \

	export EMCC_FLAGS="-sSIDE_MODULE -D__x86_64__"; \

	if [ "$WITH_DEBUG" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -O0 -g3"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -O3"; \
	fi; \

	if [ "$WITH_JSPI" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -sASYNCIFY -sASYNCIFY_ADVISE"; \
	fi; \

	emmake make -j1;

RUN	mkdir -p /root/intl/modules; \
	mv /root/php-src/ext/intl/modules/* /root/intl/modules;

RUN	mkdir -p /root/intl/data; \
	mv /root/share/icu/74.2/icudt74l.dat /root/intl/data;
