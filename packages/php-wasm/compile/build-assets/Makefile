PKG_CONFIG_PATH=/root/lib/lib/pkgconfig
TIMER=(which pv > /dev/null && pv --name '${@}' || cat)

.PHONY: all
all: build

.PHONY: build
build: libz.a libzip.a libpng.a libxml2.a libsqlite3.a libbison.a
	$(TIMER) && echo "Done building"

.PHONY: clean
clean:
	docker rmi my-image

.PHONY: run
run:
	docker run my-image

.PHONY: shell
shell:
	docker run -it my-image /bin/bash

libz.a:
	chmod a+x zlib/configure;
	cd zlib && emconfigure ./configure --prefix=/root/lib
	cd zlib && (EMCC_FLAGS="-fPIC" emmake make || true)
	cd zlib && EMCC_FLAGS="-fPIC" emmake make install
	touch libz.a

# @TODO: Use 1.2.0 for PHP <= 7.3 and 1.9.2 versions for PHP > 7.4
libzip_old:
	curl -k https://libzip.org/download/libzip-1.2.0.tar.gz -o libzip.tar.gz && \
	tar -xzf libzip.tar.gz && \
	mv libzip-1.2.0 libzip_old && \
	mkdir -p libzip_old/build

libzip.a: libz.a libzip_old
	cd libzip_old/build && \
	emcmake cmake \
		-DCMAKE_INSTALL_PREFIX=/root/lib \
		-DZLIB_LIBRARY=/root/lib/lib/libz.a \
		-DZLIB_INCLUDE_DIR=/root/lib/include \
		.. && \
	EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE -sUSE_PTHREADS=1 " emmake make && \
	EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE -sUSE_PTHREADS=1 " emmake make install && \
	touch libzip.a

libxml2:
	env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
		--branch v2.9.10 \
		--single-branch \
		--depth 1

libxml2_configure: libxml2
	cd libxml2 && \
	./autogen.sh && \
	emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=yes --enable-shared=no --prefix=/root/lib/
	touch libxml2_configure

libxml2.a: libxml2_configure
	cd libxml2 && \
	EMCC_FLAGS=" -sSIDE_MODULE -sUSE_PTHREADS=1 " emmake make && \
	EMCC_FLAGS=" -sSIDE_MODULE -sUSE_PTHREADS=1 " emmake make install
	touch libxml2.a

bison-2.7_src:
	wget http://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz && \
	tar -xvf bison-2.7.tar.gz && \
	rm bison-2.7.tar.gz && \
	cd bison-2.7 && \
	git apply --no-index ../bison27.patch
	touch bison-2.7_src

bison-2.7_aclocal.m4: bison-2.7_src
	cd bison-2.7 && ./configure --prefix=/usr/local/bison --with-libiconv-prefix=/usr/local/libiconv/
	touch bison-2.7_aclocal.m4

libbison.a: bison-2.7_aclocal.m4
	cd bison-2.7 && make
	cd bison-2.7 && make install
	touch libbison.a

libbison3.a:
	apt install -y bison

sqlite3:
	wget --no-check-certificate https://www.sqlite.org/2022/sqlite-autoconf-3400100.tar.gz && \
	tar -xzvf sqlite-autoconf-3400100.tar.gz && \
	mv sqlite-autoconf-3400100 sqlite3 

sqlite3_configure: sqlite3
	cd sqlite3 && \
	emconfigure ./configure \
		--build i386-pc-linux-gnu \
		--target wasm32-unknown-emscripten \
		--prefix=/root/lib/
	touch sqlite3_configure

libsqlite3.a: sqlite3_configure
	cd sqlite3 && \
	EMCC_SKIP="-lc" EMCC_FLAGS=" -sSIDE_MODULE -sUSE_PTHREADS=1" emmake make && \
	emmake make install
	touch libsqlite3.a

libpng:
	wget http://prdownloads.sourceforge.net/libpng/libpng-1.6.39.tar.gz?download -O libpng-1.6.39.tar.gz
	tar -xzf libpng-1.6.39.tar.gz 
	mv libpng-1.6.39 libpng
	rm libpng-1.6.39.tar.gz
	touch libpng

libpng_configure: libpng libz.a
	cd libpng && \
	CPPFLAGS="-I/root/lib/include " \
	LDFLAGS="-L/root/lib/lib " \
	emconfigure ./configure \
		PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) \
		--build i386-pc-linux-gnu \
		--target wasm32-unknown-emscripten \
		--prefix=/root/lib/
	touch libpng_configure

libpng.a: libpng_configure
	cd libpng && \
	EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE -sUSE_PTHREADS=1" emmake make && \
	emmake make install
	touch libpng.a

openssl-1.1.0h: libz.a
	cd  && \
	wget https://www.openssl.org/openssl-1.1.0h.tar.gz -O openssl.tar.gz && \
	echo "Extracting..." && \
	tar -xzf openssl.tar.gz && \
	rm openssl.tar.gz

openssl_configure: openssl-1.1.0h
	cd openssl-1.1.0h && \
	emconfigure ./Configure dist \
		-DHAVE_FORK=0 \
		-DOPENSSL_NO_AFALGENG=1 \
		--prefix=/root/lib
	touch openssl_configure

libssl.a: openssl_configure
	cd openssl-1.1.0h && \
	sed -i "s|^CROSS_COMPILE.*$$|CROSS_COMPILE=|g" Makefile && \
	EMCC_FLAGS=" -sSIDE_MODULE " EMCC_SKIP="-lz" emmake make -j 12 build_generated libssl.a libcrypto.a && \
	cp -RL include/openssl /root/lib/include && \
	cp libcrypto.a libssl.a /root/lib/lib && \
	EMCC_FLAGS=" -sSIDE_MODULE " EMCC_SKIP="-lz" emmake make install;
	touch libssl.a

php-src:
	git clone https://github.com/php/php-src.git php-src \
		--branch PHP-7.4   \
		--single-branch	\
		--depth 1;

php-src-7-4-src-patched: php-src
	git apply --no-index /source/php7.4*.patch -v
	touch php-src-7-4-src-patched

php-src-7-4-configured:  libbison3.a
	. /source/build_config.sh && \
	cd php-src && \
	./buildconf --force

	. /source/build_config.sh && \
	cd php-src && \
	emconfigure ./configure \
	PKG_CONFIG_PATH=$(PKG_CONFIG_PATH) \
	--disable-fiber-asm \
	--enable-json	  \
	--enable-zts  \
	--enable-maintainer-zts \
	--enable-pthreads  \
	--enable-embed=static \
	--with-layout=GNU  \
	--disable-cgi	  \
	--disable-all	  \
	--enable-hash	  \
	--enable-static=yes \
	--enable-shared=no \
	--enable-session   \
	--enable-filter	\
	--enable-calendar  \
	--disable-rpath	\
	--disable-phpdbg   \
	--without-pear	 \
	--with-valgrind=no \
	--without-pcre-jit \
	--enable-bcmath	\
	--enable-ctype	 \
	--disable-mbregex  \
	--enable-tokenizer \
	--disable-libxml --without-libxml --disable-dom --disable-xml --disable-simplexml --disable-xmlwriter --disable-mbstring
	touch php-src-7-4-configured

# php-src-7-4-configured
php-src-7-4-configure-patched:
	# Silence the errors "munmap() failed: [28] Invalid argument" 
	# @TODO: Identify the root cause behind these errors and fix them properly 
	echo '#define ZEND_MM_ERROR 0' >> php-src/main/php_config.h

	# With HAVE_UNISTD_H=1 PHP complains about the missing getdtablesize() function 
	# bash /source/replace.sh 's/define HAVE_UNISTD_H 1/define HAVE_UNISTD_H 0/g' /source/php-src/main/php_config.h

	# Rename the original php_pollfd_for() implementation so that we can link our own version.
	bash /source/replace.sh 's/static inline int php_pollfd_for\(/int php_pollfd_for(php_socket_t fd, int events, struct timeval *timeouttv); static inline int __real_php_pollfd_for(/g' php-src/main/php_network.h
	bash /source/replace.sh 's/static int php_cli_server_poller_poll/extern int wasm_select(int, fd_set * __restrict, fd_set * __restrict, fd_set * __restrict, struct timeval * __restrict); static int php_cli_server_poller_poll/g' ./sapi/cli/php_cli_server.c

	# Provide a custom implementation of the php_select() function. 
	bash /source/replace.sh 's/return php_select\(/return wasm_select(/g' php-src/sapi/cli/php_cli_server.c

	# Provide a custom implementation of the shutdown() function. 
	perl -pi.bak -e 's/(\s+)shutdown\(/$$1 wasm_shutdown(/g' php-src/sapi/cli/php_cli_server.c
	perl -pi.bak -e 's/(\s+)closesocket\(/$$1 wasm_close(/g' php-src/sapi/cli/php_cli_server.c
	echo 'extern int wasm_shutdown(int fd, int how);' >> php-src/main/php_config.h;
	echo 'extern int wasm_close(int fd);' >> php-src/main/php_config.h; 
	touch php-src-7-4-configure-patched

php-src-7-4-built: php-src-7-4-configure-patched libbison3.a
	# We're compiling PHP as emscripten's side module which 
	# means we must skip all the libraries - they will be provided in the final linking step.
	cd php-src && \
	EMCC_FLAGS=" -sSIDE_MODULE -sUSE_PTHREADS=1 -pthread -Dsetsockopt=wasm_setsockopt -Dpopen=wasm_popen -Dpclose=wasm_pclose " \
	EMCC_SKIP="-lz -ledit -ldl -lncurses -lzip -lpng16 -lssl -lcrypto -lxml2 -lc -lm -lsqlite3 /root/lib/lib/libxml2.a /root/lib/lib/libsqlite3.so /root/lib/lib/libsqlite3.a /root/lib/lib/libpng16.so" \
	emmake make -j8
	php-src-7-4-built

# php-src-7-4-built
php-src-7-4-linked: 
	. /source/build_config.sh && \
	cd php-src && \
	emcc -O3 \
	--js-library /source/phpwasm-emscripten-library.js \
	-I .  \
	-I ext   \
	-I ext/json   \
	-I Zend  \
	-I main  \
	-I TSRM/ \
	-I /root/lib/include \
	-L/root/lib -L/root/lib/lib/ \
	${EMCC_PHP_WASM_FLAGS} \
	-o /root/output/php.js \
	-s EXPORTED_FUNCTIONS="${EXPORTED_FUNCTIONS}" \
	-s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "UTF8ToString", "lengthBytesUTF8", "FS", "PROXYFS"]' \
	-s INITIAL_MEMORY=1024MB \
	-s ALLOW_MEMORY_GROWTH=1		 \
	-s ASSERTIONS=0				  \
	-s ERROR_ON_UNDEFINED_SYMBOLS=0  \
	-s NODEJS_CATCH_EXIT=0		   \
	-s INVOKE_RUN=0				  \
	-s EXIT_RUNTIME=1				\
		/root/lib/libphp.a \
		/root/php_wasm.c \
		${EMCC_PHP_WASM_FLAGS} \
	-s ENVIRONMENT=${EMSCRIPTEN_ENVIRONMENT} \
	-s FORCE_FILESYSTEM=1 \
	-s EXPORT_NAME="'PHPLoader'"
	# Emscripten complains it can't find some Asyncify functions
	# listed in ASYNCIFY_IMPORTS. The culprit is those functions
	# are actually used and delisting them breaks php_pollfd_for().
	# Sooo... just ignore Emscripten's warnings.

php-src-7-4-bundle: php-src-7-4-linked
	# Figure out the target file names and URLs
	# The .js and .wasm filenames should reflect the build configuration, e.g.:
	# * `php-7.4.node.js` and `php-7.4.node.wasm`
	# * `php-8.0.js` and `php-8.0.wasm`
	# In addition, the `.wasm` file URL should have a "cache busting" query string on the
	# web, so that web browsers will reload it when the file contents change.
	# Precompute export variables:
	export FILE_SIZE=$(stat -c%s "/root/output/php.wasm")
	export PHP_VERSION_ESCAPED="${PHP_VERSION//./_}"
	export FILENAME_PREFIX="php_${PHP_VERSION_ESCAPED:0:3}";
	export EXT_PREFIX="";
	export JS_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.js";
	export WASM_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.wasm";

	# Make the php.wasm URL configurable via the dependencyFilename loader argument:
	/source/replace.sh $'s/["\']php\.wasm[\'"]/dependencyFilename/g' /root/output/php.js

	# Patch a "property undefined" error
	# Emscripten produces an if that checkes a stream.stream_ops.poll property. However,
	# stream.stream_ops is sometimes undefined and the check fails. Let's adjust it to
	# tolerate a null stream.stream_ops value.
	/source/replace.sh "s/if\s*\(stream\.stream_ops\.poll\)/if (stream.stream_ops?.poll)/g" /root/output/php.js

	# Make Emscripten websockets configurable
	# Emscripten makes the Websocket proxy connect to a fixed URL.
	# This assumes the traffic is always forwarded to the same target.
	# However, we want to support arbitrary targets, so we need to
	# replace the hardcoded websocket target URL with a dynamic callback.
	/source/replace.sh $'s/if\s*\(\s*["\']string["\']\s*===\s*typeof Module\[["\']websocket["\']\]\[["\']url["\']\]\s*\)/if("function"===typeof Module["websocket"]["url"]) {\nurl = Module["websocket"]["url"](...arguments);\n}else if ("string" === typeof Module["websocket"]["url"])/g' \
		/root/output/php.js

	# Enable custom WebSocket constructors to support socket options.
	/source/replace.sh "s/ws\s*=\s*new WebSocketConstructor/if (Module['websocket']['decorator']) {WebSocketConstructor = Module['websocket']['decorator'](WebSocketConstructor);}ws = new WebSocketConstructor/g" /root/output/php.js
	if [ "$WITH_WS_NETWORKING_PROXY" = "yes" ]; then \
		/source/replace.sh "s/sock\.server\s*=\s*new WebSocketServer/if (Module['websocket']['serverDecorator']) {WebSocketServer = Module['websocket']['serverDecorator'](WebSocketServer);}sock.server = new WebSocketServer/g" /root/output/php.js; \
	fi;

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
		/source/replace.sh 's/sock\.sock_ops\.recvmsg\(sock,\s*len\);/sock.sock_ops.recvmsg(sock, len, typeof flags !== "undefined" ? flags : 0);/g' /root/output/php.js
		/source/replace.sh 's/recvmsg:\s*function\(sock,\s*length\)/recvmsg: function(sock, length, flags)/g' /root/output/php.js
		/source/replace.sh 's/if\s*\(sock\.type\s*===\s*1\s*&&\s*bytesRead\s*<\s*queuedLength\)/if (flags&2) {bytesRead = 0;} if (sock.type === 1 && bytesRead < queuedLength)/g' /root/output/php.js; \
	fi ;

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
	/source/replace.sh $'s/ENVIRONMENT_IS_([A-Z]+)\s*=\s*(true|false)/ENVIRONMENT_IS_$1=RuntimeName==="$1"/g' /root/output/php.js
	/source/replace.sh 's/var ENV\s*=\s*\{\}/var ENV = PHPLoader.ENV || {}/g' /root/output/php.js

	# Turn the php.js file into an ES module
	# Manually turn the output into a esm module instead of relying on -s MODULARIZE=1.
	# which pollutes the global namespace and does not play well with import() mechanics.
	echo "export const dependenciesTotalSize = $FILE_SIZE; " >> /root/output/php-module.js
	if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
		echo "const dependencyFilename = __dirname + '/$WASM_FILENAME'; " >> /root/output/php-module.js; \
	else \
		echo "import dependencyFilename from './$WASM_FILENAME'; " >> /root/output/php-module.js; \
	fi; \
	echo " export { dependencyFilename }; export function init(RuntimeName, PHPLoader) {" >> /root/output/php-module.js
	cat /root/output/php.js >> /root/output/php-module.js
	cat /root/append-before-return.js >> /root/output/php-module.js
	echo " return PHPLoader; }" >> /root/output/php-module.js

	# Remove the old php.js file
	rm /root/output/php.js
	
	# Rename the build files to their final names
	mv /root/output/php-module.js "/root/output/$JS_FILENAME"
	mv /root/output/php.wasm "/root/output/$WASM_FILENAME"
	touch php-src-7-4-bundle

# @TODO – port ncurses and readline:
# Compile ncurses
# FROM emscripten AS emscripten-ncurses
# COPY ./build-assets/ncurses.patch /root/
# RUN	 set -euxo pipefail &&\
#		 # Install libncurses
#		 wget https://ftp.gnu.org/gnu/ncurses/ncurses-6.2.tar.gz
#		 tar -xzf ncurses-6.2.tar.gz
#		 # https://github.com/jamesbiv/ncurses-emscripten
#		 # https://github.com/ilyaigpetrov/ncurses-for-emscripten/blob/27fefcd3784e7375212b75f444def4518ddabc21/COMPILE.md
#		 cd ncurses-6.2
#		 ./configure \
#			 PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
#			 --build i386-pc-linux-gnu \
#			 --prefix=/root/lib/ \
#			 --enable-database
#		 make
#		 make install 
#		 cd ncurses 
#		 cp make_hash make_hash_x86 
#		 cp make_keys make_keys_x86 
#		 cp report_offsets report_offsets_x86  
#		 cd /root/ncurses-6.2
#		 make clean
#		 git apply --ignore-space-change --ignore-whitespace --no-index /root/ncurses.patch
#		 source /root/emsdk/emsdk_env.sh
#		 emconfigure ./configure \
#			 PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
#			 --build i386-pc-linux-gnu \
#			 --prefix=/root/lib
#		 /source/replace.sh $'s/^\s+cd man.*$//g' Makefile
#		 /source/replace.sh $'s/^\s+cd progs.*$//g' Makefile
#		 /source/replace.sh $'s/^\s+cd test.*$//g' Makefile
#		 /source/replace.sh $'s/^\s+cd misc.*$//g' Makefile
#		 /source/replace.sh $'s/^\s+cd c\+\+.*$//g' Makefile
#		 emmake make
#		 emmake make install

# # Compile libedit (readline alternative)
# FROM emscripten AS emscripten-libedit
# COPY --from=emscripten-ncurses /root/lib /root/lib-ncurses
# RUN /root/copy-lib.sh lib-ncurses
# RUN	 wget https://www.thrysoee.dk/editline/libedit-20221030-3.1.tar.gz
#		 tar -xzf libedit-20221030-3.1.tar.gz 
#		 source /root/emsdk/emsdk_env.sh
#		 cd libedit-20221030-3.1
#		 CFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
#		 CPPFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
#		 LDFLAGS="-L/root/lib/lib " emconfigure ./configure \
#			 PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
#			 --build i386-pc-linux-gnu \
#			 --prefix=/root/lib/
#		 # -D__STDC_ISO_10646__=201103L is needed because
#		 # Libedit build fails when __STDC_ISO_10646__ is not defined, and that is
#		 # the case when compiling with musl toolchains.
#		 # Musl is ISO 10646 compliant but doesn't define __STDC_ISO_10646__, so
#		 # let's define it manually. Learn more at:
#		 # http://lists.busybox.net/pipermail/buildroot/2016-January/149100.html
#		 EMCC_SKIP="-lc -lncurses " EMCC_FLAGS=" -sSIDE_MODULE -D__STDC_ISO_10646__=201103L " \
#		 emmake make
#		 emmake make install
