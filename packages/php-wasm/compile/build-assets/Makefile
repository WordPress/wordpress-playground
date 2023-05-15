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
	EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
	EMCC_SKIP="-lz" EMCC_FLAGS=" -sSIDE_MODULE " emmake make install && \
	touch libzip.a

libxml2:
	env GIT_SSL_NO_VERIFY=true git clone https://gitlab.gnome.org/GNOME/libxml2.git libxml2 \
		--branch v2.9.10 \
		--single-branch \
		--depth 1

libxml2_configure: libxml2
	cd libxml2 && \
	./autogen.sh && \
	emconfigure ./configure --with-http=no --with-ftp=no --with-python=no --with-threads=no --enable-shared=no --prefix=/root/lib/
	touch libxml2_configure

libxml2.a: libxml2_configure
	cd libxml2 && \
	EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
	EMCC_FLAGS=" -sSIDE_MODULE " emmake make install
	touch libxml2.a

bison-2.7:
	wget http://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz && \
	tar -xvf bison-2.7.tar.gz && \
	rm bison-2.7.tar.gz && \
	cd bison-2.7 && \
	git apply --no-index ../../bison27.patch

bison-2.7_aclocal.m4: bison-2.7
	cd bison-2.7 && ./configure --prefix=/usr/local/bison --with-libiconv-prefix=/usr/local/libiconv/
	touch bison-2.7_aclocal.m4

libbison.a: bison-2.7_aclocal.m4
	cd bison-2.7 && make
	cd bison-2.7 && make install
	touch libbison.a

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
	EMCC_SKIP="-lc" EMCC_FLAGS=" -sSIDE_MODULE " emmake make && \
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
		PKG_CONFIG_PATH=/root/lib/lib/pkgconfig \
		--build i386-pc-linux-gnu \
		--target wasm32-unknown-emscripten \
		--prefix=/root/lib/
	touch libpng_configure

libpng.a: libpng_configure
	cd libpng && \
	EMCC_SKIP="-lc -lz" EMCC_FLAGS="-sSIDE_MODULE" emmake make && \
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
		no-threads \
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

PHP_VERSION := "7.4"
php-src-$(PHP_VERSION):
	cd source && \
	git clone https://github.com/php/php-src.git php-src \
		--branch PHP-$PHP_VERSION   \
		--single-branch          \
		--depth 1;

php-src-$(PHP_VERSION)/aclocal.m4: php-src-$(PHP_VERSION)
	cd php-src-* && \ emconfigure ./configure

# @TODO – port ncurses and readline:
# Compile ncurses
# FROM emscripten AS emscripten-ncurses
# COPY ./build-assets/ncurses.patch /root/
# RUN     set -euxo pipefail &&\
#         # Install libncurses
#         wget https://ftp.gnu.org/gnu/ncurses/ncurses-6.2.tar.gz && \
#         tar -xzf ncurses-6.2.tar.gz && \
#         # https://github.com/jamesbiv/ncurses-emscripten
#         # https://github.com/ilyaigpetrov/ncurses-for-emscripten/blob/27fefcd3784e7375212b75f444def4518ddabc21/COMPILE.md
#         cd ncurses-6.2 && \
#         ./configure \
#             PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
#             --build i386-pc-linux-gnu \
#             --prefix=/root/lib/ \
#             --enable-database && \
#         make && \
#         make install  && \
#         cd ncurses  && \
#         cp make_hash make_hash_x86  && \
#         cp make_keys make_keys_x86  && \
#         cp report_offsets report_offsets_x86   && \
#         cd /root/ncurses-6.2 && \
#         make clean && \
#         git apply --ignore-space-change --ignore-whitespace --no-index /root/ncurses.patch && \
#         source /root/emsdk/emsdk_env.sh && \
#         emconfigure ./configure \
#             PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
#             --build i386-pc-linux-gnu \
#             --prefix=/root/lib && \
#         /root/replace.sh $'s/^\s+cd man.*$//g' Makefile && \
#         /root/replace.sh $'s/^\s+cd progs.*$//g' Makefile && \
#         /root/replace.sh $'s/^\s+cd test.*$//g' Makefile && \
#         /root/replace.sh $'s/^\s+cd misc.*$//g' Makefile && \
#         /root/replace.sh $'s/^\s+cd c\+\+.*$//g' Makefile && \
#         emmake make && \
#         emmake make install

# # Compile libedit (readline alternative)
# FROM emscripten AS emscripten-libedit
# COPY --from=emscripten-ncurses /root/lib /root/lib-ncurses
# RUN /root/copy-lib.sh lib-ncurses
# RUN     wget https://www.thrysoee.dk/editline/libedit-20221030-3.1.tar.gz && \
#         tar -xzf libedit-20221030-3.1.tar.gz  && \
#         source /root/emsdk/emsdk_env.sh && \
#         cd libedit-20221030-3.1 && \
#         CFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
#         CPPFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
#         LDFLAGS="-L/root/lib/lib " emconfigure ./configure \
#             PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
#             --build i386-pc-linux-gnu \
#             --prefix=/root/lib/ && \
#         # -D__STDC_ISO_10646__=201103L is needed because
#         # Libedit build fails when __STDC_ISO_10646__ is not defined, and that is
#         # the case when compiling with musl toolchains.
#         # Musl is ISO 10646 compliant but doesn't define __STDC_ISO_10646__, so
#         # let's define it manually. Learn more at:
#         # http://lists.busybox.net/pipermail/buildroot/2016-January/149100.html
#         EMCC_SKIP="-lc -lncurses " EMCC_FLAGS=" -sSIDE_MODULE -D__STDC_ISO_10646__=201103L " \
#         emmake make && \
#         emmake make install
