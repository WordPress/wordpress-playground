FROM playground-php-wasm:base

# Each version of PHP requires its own version of Xdebug
# because each version of PHP has a specific Zend Engine API version.
# Consequently, each version of Xdebug is designed to be
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

# Build PHP
RUN git clone https://github.com/php/php-src.git php-src \
	--branch PHP-$PHP_VERSION \
	--single-branch \
	--depth 1;

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

# Build Xdebug
RUN set -euxo pipefail; \

	if [[ "${PHP_VERSION:0:1}" -ge 8 ]]; then \
		export XDEBUG_BRANCH="xdebug_3_4"; \
	else \
		export XDEBUG_BRANCH="xdebug_3_1"; \
	fi; \

	git clone https://github.com/xdebug/xdebug.git xdebug \
		--branch "${XDEBUG_BRANCH}" \
		--single-branch \
		--depth 1; \

	cd xdebug; \

	phpize . ; \

	source /root/emsdk/emsdk_env.sh; \
	# Use non-linux host type or configure will try to require linux kernel
	# features that are unsupported by emscripten (e.g., rtnetlink.h).
	emconfigure ./configure --host="i386-unknown-freebsd" --disable-static --enable-shared; \
	# XDebug linking fails to produce a shared lib because libm is missing.
	# Let's explicitly skip libm in the understanding that it is provided by Emscripten
	# with the main module.
	/root/replace.sh 's/^(XDEBUG_SHARED_LIBADD\s*=.*\s*)-lm\b/$1/' Makefile; \

	export EMCC_FLAGS="-sSIDE_MODULE -D__x86_64__ -sWASM_BIGINT -Dsetsockopt=wasm_setsockopt -Drecv=wasm_recv"; \

	if [ "$WITH_DEBUG" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -O0 -g3"; \
	else \
		export EMCC_FLAGS="${EMCC_FLAGS} -O3"; \
	fi; \

	if [ "$WITH_JSPI" = "yes" ]; then \
		export EMCC_FLAGS="${EMCC_FLAGS} -sJSPI -sJSPI_IMPORTS=wasm_recv -sJSPI_EXPORTS=wasm_recv"; \
	else \
		# execute_internal must be in ASYNCIFY_IMPORTS for Xdebug to trace internal PHP functions.
		# This enables async unwinding during breakpoints or stepping inside internal calls.
		export EMCC_FLAGS="${EMCC_FLAGS} -sASYNCIFY -sASYNCIFY_ADVISE -sASYNCIFY_IMPORTS=wasm_recv,execute_internal -sASYNCIFY_EXPORTS=wasm_recv"; \
	fi; \

	emmake make -j1
