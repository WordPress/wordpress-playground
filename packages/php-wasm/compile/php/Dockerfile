FROM playground-php-wasm:base

ARG WITH_JSPI="no"

# The PHP version to build.
# This value must point to an existing branch of the
# https://github.com/php/php-src.git repository when prefixed
# with "PHP-".
# For example, "7.4.0" is valid because the branch PHP-7.4.0 exists,
# but just "7" is invalid because there's no branch PHP-7.
ARG PHP_VERSION

# Whether to build the opcache extension. The .m4 file is patched before the main
# ./buildconf script is generated.
ARG WITH_OPCACHE

# Clone PHP
RUN git clone https://github.com/php/php-src.git php-src \
	--branch PHP-$PHP_VERSION \
	--single-branch \
	--depth 1;

# Work around memory leak due to PHP using Emscripten's incomplete mmap/munmap support
COPY ./php-wasm-memory-storage /root/php-src/ext/wasm_memory_storage

# Polyfill for dns functions
COPY ./php-wasm-dns-polyfill/ /root/php-src/ext/dns_polyfill

# Polyfill for post_message_to_js functions
COPY ./php-post-message-to-js/ /root/php-src/ext/post_message_to_js

# Copy the dummy opcache_module.c and php_opcache.h files.
COPY ./opcache/ /root/php-src/ext/opcache

# Bring in the libraries
RUN mkdir -p /root/lib/include /root/lib/lib /libs
COPY ./bison2.7/dist/ /libs/bison2.7
COPY ./libiconv/ /root/builds/libiconv
COPY ./libcurl/ /root/builds/libcurl
COPY ./libopenssl/ /root/builds/libopenssl
COPY ./libpng16/ /root/builds/libpng16
COPY ./libjpeg/ /root/builds/libjpeg
COPY ./libwebp/ /root/builds/libwebp
COPY ./libaom/ /root/builds/libaom
COPY ./libavif/ /root/builds/libavif
COPY ./libsqlite3/ /root/builds/libsqlite3
COPY ./libxml2/ /root/builds/libxml2
COPY ./libz/ /root/builds/libz
COPY ./oniguruma/ /root/builds/oniguruma
COPY ./libintl/ /root/builds/libintl

RUN if [ "$WITH_JSPI" = "yes" ]; then \
	cp -r /root/builds/*/jspi/dist/root/lib/* /root/lib; \
else \
	cp -r /root/builds/*/asyncify/dist/root/lib/* /root/lib; \
fi

COPY ./libzip/ /root/builds-libzip/
RUN mkdir -p /libs/libzip
RUN if [ "$WITH_JSPI" = "yes" ]; then \
	cp -r /root/builds-libzip/jspi/dist/1.2.0/root/lib /libs/libzip/1.2.0; \
	cp -r /root/builds-libzip/jspi/dist/1.9.2/root/lib /libs/libzip/1.9.2; \
else \
	cp -r /root/builds-libzip/asyncify/dist/1.2.0/root/lib /libs/libzip/1.2.0; \
	cp -r /root/builds-libzip/asyncify/dist/1.9.2/root/lib /libs/libzip/1.9.2; \
fi

COPY ./libopenssl/ /root/builds-libopenssl/
RUN mkdir -p /libs/libopenssl
RUN if [ "$WITH_JSPI" = "yes" ]; then \
	cp -r /root/builds-libopenssl/jspi/dist/root/lib /libs/libopenssl; \
else \
	cp -r /root/builds-libopenssl/asyncify/dist/root/lib /libs/libopenssl; \
fi

# Workaround to add ICU FLAGS to intl below 7.3 to inject -fPIC.
RUN if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "2" ]]; then \
		sed -i "s/\$ICU_INCS/\$ICU_INCS \$ICU_CFLAGS/" /root/php-src/ext/intl/config.m4; \
	fi;

# Workaround to unbundle sqlite from PHP <7.4.
# Prior to 7.4, PHP bundled sqlite internally,
# leading compilation to fail with : wasm-ld: error: duplicate symbol: [sqlite3_xxx]
# Unbundling sqlite manually by copying files from 7.4 solves the issue
# Related discussion: https://github.com/WordPress/wordpress-playground/pull/2248#issuecomment-2988044885
# And 7.4 commit reference: https://github.com/php/php-src/commit/6083a38
RUN if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
		cp /root/builds/libsqlite3/before_7_4/pdo_sqlite_config.m4 /root/php-src/ext/pdo_sqlite/config.m4; \
		cp /root/builds/libsqlite3/before_7_4/sqlite_config0.m4 /root/php-src/ext/sqlite3/config0.m4; \
	fi;

# Patch OPcache config.m4 file if needed
RUN if [ "$WITH_OPCACHE" = "yes" ]; \
	then \
		# Ensure mmap() shared memory is recognized, even if not true.
		# This will #declare HAVE_SHM_MMAP_ANON 1 in php_config.h
		if [[ "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -eq "4" ]]; then \
			# Name changed in 8.4. See https://github.com/php/php-src/commit/ca55603d8a27b4e1f9c12cf72acd0fd39a6ac059
			/root/replace.sh 's/php_cv_shm_mmap_anon=no/php_cv_shm_mmap_anon=yes/g' /root/php-src/ext/opcache/config.m4; \
		else \
			/root/replace.sh 's/have_shm_mmap_anon=no/have_shm_mmap_anon=yes/g' /root/php-src/ext/opcache/config.m4; \
			# PHP bug: PHP_NEW_EXTENSION do not read $ext_shared from the config.m4 file.
			# https://github.com/php/php-src/blob/f35a22adba8a7ddf709c6cc98ecb57ba4dd8fe8c/ext/opcache/config.m4#L313
			/root/replace.sh 's/shared,,/no,,/g' /root/php-src/ext/opcache/config.m4; \
		fi; \
		# Force OPcache to be built as a static extension. OPcache is always built as a shared extension.
		/root/replace.sh 's/ext_shared=yes/ext_shared=no/g' /root/php-src/ext/opcache/config.m4; \
		# Add the dummy opcache_module.c to the list of files to build.
		/root/replace.sh 's/shared_alloc_mmap.c/shared_alloc_mmap.c opcache_module.c/g' /root/php-src/ext/opcache/config.m4; \
		# Enable OPcache.
		echo -n ' --enable-opcache --disable-opcache-jit --disable-huge-code-pages ' >> /root/.php-configure-flags; \
	else \
		# Be sure to disable OPcache if not needed.
		echo -n ' --disable-opcache ' >> /root/.php-configure-flags; \
	fi

RUN cd php-src && ./buildconf --force

# Build PHP

# The PHP extensions to build:
ARG WITH_CURL
ARG WITH_FILEINFO
ARG WITH_LIBXML
ARG WITH_LIBZIP
ARG WITH_EXIF
ARG WITH_GD
ARG WITH_MBSTRING
ARG WITH_MBREGEX
ARG WITH_CLI_SAPI
ARG WITH_SQLITE
ARG WITH_MYSQL
ARG WITH_OPENSSL
ARG WITH_ICONV
ARG WITH_SOURCEMAPS
ARG OUTPUT_DIR_ON_HOST
ARG WITH_DEBUG
ARG DEBUG_DWARF_COMPILATION_DIR
ARG WITH_WS_NETWORKING_PROXY
ARG WITH_INTL

# The platform to build for: web or node
ARG EMSCRIPTEN_ENVIRONMENT=web

RUN touch /root/.configure-flags && \
	touch /root/.emcc-php-wasm-flags && \
	touch /root/.emcc-php-wasm-sources && \
	touch /root/.EXPORTED_FUNCTIONS

# Grab Bison 2.7 patch in case we need it
COPY ./bison2.7/bison27.patch /root/bison27.patch

# PHP <= 7.3 requires Bison 2.7
# PHP >= 7.4 and Bison 3.0
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

# Add libzip and zlib files if needed
RUN if [ "$WITH_LIBZIP" = "yes" ]; then \
		if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
			apt install -y zlib1g zlib1g-dev; \
            cp -r /libs/libzip/1.2.0/* /root/lib; \
			# https://php-legacy-docs.zend.com/manual/php5/en/zlib.installation
			echo -n ' --with-zlib --with-zlib-dir=/root/lib --enable-zip --with-libzip=/root/lib ' >> /root/.php-configure-flags; \
			echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a ' >> /root/.emcc-php-wasm-sources; \
			cp /root/lib/lib/libzip/include/zipconf.h /root/lib/lib; \
			cp /root/lib/lib/libzip/include/zipconf.h /root/lib/include; \
			echo '#define LIBZIP_VERSION "1.2.0"' >> /root/lib/include/zipconf.h; \
			cp /root/lib/include/*.h /root/php-src; \
		else \
            cp -r /libs/libzip/1.9.2/* /root/lib; \
			# https://www.php.net/manual/en/zlib.installation.php
			echo -n ' --with-zlib --with-zlib-dir=/root/lib --with-zip ' >> /root/.php-configure-flags; \
			echo -n ' /root/lib/lib/libzip.a /root/lib/lib/libz.a ' >> /root/.emcc-php-wasm-sources; \
		fi && \
		/root/replace.sh 's/pharcmd=pharcmd/pharcmd=/g' /root/php-src/configure && \
		/root/replace.sh 's/pharcmd_install=install-pharcmd/pharcmd_install=/g' /root/php-src/configure; \
	fi;


# Add ncurses if needed and libedit if needed
RUN if [ "$WITH_CLI_SAPI" = "yes" ]; \
	then \
		# Configure build flags
		echo -n ' --enable-phar --enable-cli=static ' >> /root/.php-configure-flags && \
		echo -n ' /root/php-src/sapi/cli/php_cli_process_title.c /root/php-src/sapi/cli/ps_title.c ' \
			# Use absolute paths to help path mapping for DWARF debug info
			'/root/php-src/sapi/cli/php_http_parser.c /root/php-src/sapi/cli/php_cli_server.c ' \
			'/root/php-src/sapi/cli/php_cli.c ' \
			>> /root/.emcc-php-wasm-sources && \
		echo -n ', "_run_cli", "_wasm_add_cli_arg"' >> /root/.EXPORTED_FUNCTIONS && \
		echo -n ' -DWITH_CLI_SAPI=1 ' >> /root/.emcc-php-wasm-flags && \
		/root/replace.sh 's/GET_SHELL_CB\(cb\);/(cb) = php_cli_get_shell_callbacks();/g' /root/php-src/ext/readline/readline_cli.c; \
		# Avoid a symbol conflict between php_cli.c and php_embed.c
		/root/replace.sh 's/\bHARDCODED_INI\b/HARDCODED_EMBED_INI/g' /root/php-src/sapi/embed/php_embed.c \
	else \
		echo -n ' --disable-cli ' >> /root/.php-configure-flags; \
	fi;

# Add Libxml2 if needed
RUN if [ "$WITH_LIBXML" = "yes" ]; \
	then \
		set -euxo pipefail;\
		echo -n ' --enable-libxml --with-libxml --with-libxml-dir=/root/lib --enable-dom --enable-xml --enable-simplexml --enable-xmlreader --enable-xmlwriter ' >> /root/.php-configure-flags && \
		echo -n ' /root/lib/lib/libxml2.a ' >> /root/.emcc-php-wasm-sources && \
		# Libxml check is wrong in PHP < 7.4.0.
		# In the regular cc it's just a warning, but in the emscripten's emcc that's an error:
		perl -pi.bak -e 's/char xmlInitParser/void xmlInitParser/g' /root/php-src/configure; \
		# On PHP < 7.1.0, the dom_iterators.c file implicitly converts *char to const *char causing emcc error
		if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "0" ]]; then \
			/root/replace.sh 's/xmlHashScan\(ht, itemHashScanner, iter\);/xmlHashScan(ht, (xmlHashScanner)itemHashScanner, iter);/g' /root/php-src/ext/dom/dom_iterators.c; \
		fi; \
	else \
		echo -n ' --disable-libxml --without-libxml --disable-dom --disable-xml --disable-simplexml --disable-xmlreader --disable-xmlwriter' >> /root/.php-configure-flags; \
	fi

# Add sqlite3 if needed
RUN if [ "$WITH_SQLITE" = "yes" ]; \
	then \
		echo -n ' --with-sqlite3 --enable-pdo --with-pdo-sqlite=/root/lib ' >> /root/.php-configure-flags; \
		echo -n ' /root/lib/lib/libsqlite3.a ' >> /root/.emcc-php-wasm-sources; \
	else \
		echo -n ' --without-sqlite3 --disable-pdo ' >> /root/.php-configure-flags; \
	fi

# Add GD if needed
RUN if [ "$WITH_GD" = "yes" ]; \
	then \
		if [[ "${PHP_VERSION:0:1}" -eq "7" ]] && [ "${PHP_VERSION:0:3}" != "7.4" ]; then \
			# @TODO support webp for PHP 7.0 – 7.3
			echo -n ' --with-png-dir=/root/lib --with-jpeg-dir=/root/lib --with-gd --enable-gd ' >> /root/.php-configure-flags; \
		else \
			if [[ "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -ge "1" ]]; then \
				echo -n ' --with-avif ' >> /root/.php-configure-flags; \
			fi; \
			echo -n ' --with-png-dir=/root/lib --with-jpeg --with-webp --with-gd --enable-gd ' >> /root/.php-configure-flags; \
		fi; \

		if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "4" ]]; then \
			/root/replace.sh 's/static long php_jpeg_emit_message/static void php_jpeg_emit_message/g' /root/php-src/ext/gd/libgd/gd_jpeg.c; \
			sed -i '84s/.*return 1;.*//' /root/php-src/ext/gd/libgd/gd_jpeg.c; \
			/root/replace.sh 's/cinfo.err->emit_message = \(void \(*\)\(j_common_ptr,int\)\) php_jpeg_emit_message;/cinfo.err->emit_message = php_jpeg_emit_message;/g' /root/php-src/ext/gd/libgd/gd_jpeg.c; \
		fi; \

		if [[ "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -ge "1" ]]; then \
			echo -n ' /root/lib/lib/libjpeg.a /root/lib/lib/libpng16.a /root/lib/lib/libwebp.a /root/lib/lib/libsharpyuv.a /root/lib/lib/libavif.a ' >> /root/.emcc-php-wasm-sources; \
		else \
			echo -n ' /root/lib/lib/libjpeg.a /root/lib/lib/libpng16.a /root/lib/lib/libwebp.a /root/lib/lib/libsharpyuv.a ' >> /root/.emcc-php-wasm-sources; \
		fi; \
	fi;

# Add openssl if needed
RUN if [ "$WITH_OPENSSL" = "yes" ]; \
	then \
		cp -r /libs/libopenssl/* /root/lib; \
		echo -n ' --with-openssl --with-openssl-dir=/root/lib ' >> /root/.php-configure-flags; \
		echo -n ' /root/lib/lib/libcrypto.a /root/lib/lib/libssl.a ' >> /root/.emcc-php-wasm-sources; \
	fi;

# Remove fileinfo if needed
RUN if [ "$WITH_FILEINFO" = "yes" ]; \
    then \
		echo -n ' --enable-fileinfo' >> /root/.php-configure-flags; \
	else \
        # light bundle should compile without fileinfo and libmagic
        echo -n ' --disable-fileinfo' >> /root/.php-configure-flags; \
    fi;

# Add iconv if needed
RUN if [ "$WITH_ICONV" = "yes" ]; \
	then \
		echo -n ' --with-iconv=/root/lib ' >> /root/.php-configure-flags; \
		echo -n ' /root/lib/lib/libiconv.a ' >> /root/.emcc-php-wasm-sources; \
		# PHP >= 8.0 posix is no longer supported.
		# PHP ≤= 7.4 posix is supported.
	else \
		echo -n ' --without-iconv ' >> /root/.php-configure-flags; \
	fi;

# Add curl if needed
RUN if [ "$WITH_CURL" = "yes" ]; \
	then \
		# libcurl version check fails in PHP <= 7.3 even though
		# the version is correct. Let's make the check always pass.
		/root/replace.sh 's/\$PKG_CONFIG --atleast-version 7.\d+.\d+ \$PKNAME/test "1" = "1"/g' /root/php-src/configure; \
		/root/replace.sh 's/test "\$curl_version" -ge 7010005/test "1" = "1"/g' /root/php-src/configure; \
		echo -n ' --with-curl=/root/lib ' >> /root/.php-configure-flags; \
		echo -n ' /root/lib/lib/libcurl.a ' >> /root/.emcc-php-wasm-sources; \
		# The way we build libcurl doesn't produce a `.pc` file that seems
		# to be required by PHP <= 7.3. Let's create  manually.
		echo 'prefix=/root/lib \
exec_prefix=${prefix} \
libdir=${exec_prefix}/lib \
includedir=${prefix}/include \
modules=1 \
\
Name: libcurl\
Version: 7.69.1\
Description: libcurl.\
Requires:\
Libs: -L${libdir} -lcurl\
Cflags: -I${includedir}' > /root/lib/lib/pkgconfig/libcurl.pc; \
	fi;

# Add mbstring if needed
# mbstring is required for the exif extension
RUN if [ "$WITH_MBSTRING" = "yes" ] || [ "$WITH_EXIF" = "yes" ]; \
	then echo -n ' --enable-mbstring ' >> /root/.php-configure-flags; \
	else echo -n ' --disable-mbstring ' >> /root/.php-configure-flags; \
	fi;

# Add exif if needed
RUN if [ "$WITH_EXIF" = "yes" ]; \
	then \
		echo -n ' --enable-exif ' >> /root/.php-configure-flags; \
	else \
		echo -n ' --disable-exif ' >> /root/.php-configure-flags; \
	fi;

# Add intl if needed
RUN if [ "$WITH_INTL" = "yes" ]; \
	then \
		if [ "${PHP_VERSION:0:1}" -eq "8" ] || [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -ge "2" ]]; then \
			echo -n ' --enable-intl ' >> /root/.php-configure-flags; \
			echo -n ' /root/lib/lib/libicudata.a /root/lib/lib/libicui18n.a /root/lib/lib/libicuio.a /root/lib/lib/libicutest.a /root/lib/lib/libicutu.a /root/lib/lib/libicuuc.a ' >> /root/.emcc-php-wasm-sources; \

			if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
				/root/replace.sh 's/UBool operator/bool operator/' /root/php-src/ext/intl/breakiterator/codepointiterator_internal.h; \
				/root/replace.sh 's/UBool CodePointBreakIterator::operator/bool CodePointBreakIterator::operator/' /root/php-src/ext/intl/breakiterator/codepointiterator_internal.cpp; \
				/root/replace.sh 's/ getArg/ phpGetArg/g; s/::getArg/::phpGetArg/g; s/ getMessage/ phpGetMessage/g; s/::getMessage/::phpGetMessage/g' /root/php-src/ext/intl/msgformat/msgformat_helpers.cpp; \
			fi; \

			if [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "2" ]]; then \
				files=( /root/php-src/ext/intl/collator/collator_sort.c /root/php-src/ext/intl/normalizer/normalizer_normalize.c /root/php-src/ext/intl/dateformat/dateformat_attr.c /root/php-src/ext/intl/timezone/timezone_class.cpp /root/php-src/ext/intl/timezone/timezone_methods.cpp /root/php-src/ext/intl/breakiterator/codepointiterator_internal.cpp ); \
				for file in "${files[@]}"; do /root/replace.sh 's/\bFALSE\b/false/g; s/\bTRUE\b/true/g' "$file"; done; \
			fi; \
		fi; \
	fi

# Add mbregex if needed
RUN if [ "$WITH_MBREGEX" = "yes" ] && [ "${PHP_VERSION:0:3}" != "7.0" ]; \
	then \
		echo -n ' --enable-mbregex --with-onig=/root/lib ' >> /root/.php-configure-flags; \
		echo -n ' /root/lib/lib/libonig.a ' >> /root/.emcc-php-wasm-sources; \
	else \
		echo -n ' --disable-mbregex ' >> /root/.php-configure-flags; \
	fi;

# Get and patch PHP
COPY ./php/php*.patch /root/
COPY ./php/apply-mysqlnd-patch.sh /root/
RUN cd /root && \
	git apply --no-index /root/php${PHP_VERSION:0:3}*.patch -v && \
	chmod +x /root/apply-mysqlnd-patch.sh && \
	/root/apply-mysqlnd-patch.sh && \
	( [[ "${PHP_VERSION:0:3}" == '8.3' ]] && \
		git apply --no-index /root/php-chunk-alloc-zend-assert-8.3.patch -v || \
		( [[ "${PHP_VERSION:0:3}" == '8.4' ]] && \
			git apply --no-index /root/php-chunk-alloc-zend-assert-8.4.patch -v || \
			git apply --no-index /root/php-chunk-alloc-zend-assert.patch -v \
		) \
	) && \
	touch php-src/patched

# Install Mysql support if needed
RUN if [ "$WITH_MYSQL" = "yes" ]; then \
		echo -n ' --enable-mysql --enable-pdo --with-mysql=mysqlnd --with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd ' >> /root/.php-configure-flags; \
		echo -n ' -DMYSQLND_FORCE_TCP_LOCALHOST ' >> /root/.emcc-php-wasm-flags; \
	fi

# Build the patched PHP
WORKDIR /root/php-src
RUN source /root/emsdk/emsdk_env.sh && \
ICU_CFLAGS="-D__x86_64__ -fPIC -I/root/lib/include" \
CURL_CFLAGS="-I/root/lib/include" \
WEBP_LIBS="-L/root/lib/lib" \
WEBP_CFLAGS="-I/root/lib/include" \
CURL_LIBS="-I/root/lib/lib -L/root/lib/lib" \
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
	--enable-phar \
	# --enable-json for PHP < 8.0:
	--enable-json      \
	--enable-embed=static \
	--with-layout=GNU  \
	--disable-cgi      \
	--disable-opcache  \
	--disable-posix    \
	--enable-hash      \
	--enable-static    \
	--enable-shared    \
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
	--enable-tokenizer \
	--enable-wasm_memory_storage \
	--enable-dns_polyfill \
	--enable-post_message_to_js \
	$(cat /root/.php-configure-flags)

# Silence the errors "munmap() failed: [28] Invalid argument"
# @TODO: Identify the root cause behind these errors and fix them properly
RUN echo '#define ZEND_MM_ERROR 0' >> /root/php-src/main/php_config.h;

# 64 bit long support {{{
# PHP uses custom typedefs for 64 bit integers in many places, e.g.
# timelib_long is int64_t when __x86_64__ is defined and int32_t otherwise.
#
# We're defining __x86_64__ in all emcc calls in this project, which
# works well, but also has some side effects in the PHP codebase.
#
# Specifically, PHP has a lot of inlined asm for 64bit processors that is used
# when __x86_64__ is defined. Inline asm won't build to WebAssembly so we need to
# disable every instance of inlined asm.
RUN echo '#undef HAVE_ASM_GOTO' >> /root/php-src/main/php_config.h;
RUN echo '#define HAVE_ASM_GOTO 0' >> /root/php-src/main/php_config.h;
# Disable asm arithmetic.
RUN if [[ ("${PHP_VERSION:0:1}" -ge "7" && "${PHP_VERSION:2:1}" -ge "4") || "${PHP_VERSION:0:1}" -ge "8" ]]; then \
		/root/replace.sh 's/ZEND_USE_ASM_ARITHMETIC 1/ZEND_USE_ASM_ARITHMETIC 0/g' /root/php-src/Zend/zend_operators.h; \
	elif [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -eq "3" ]]; then \
		/root/replace.sh 's/defined\(HAVE_ASM_GOTO\)/0/g' /root/php-src/Zend/zend_operators.h; \
	elif [[ "${PHP_VERSION:0:1}" -eq "7" && "${PHP_VERSION:2:1}" -le "1" ]]; then \
		/root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_operators.h; \
	fi;
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_multiply.h
RUN /root/replace.sh 's/defined\(__GNUC__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
RUN /root/replace.sh 's/defined\(__clang__\)/0/g' /root/php-src/Zend/zend_cpuinfo.c
# }}}

# With HAVE_UNISTD_H=1 PHP complains about the missing getdtablesize() function
RUN /root/replace.sh 's/define php_sleep sleep/define php_sleep wasm_sleep/g' /root/php-src/main/php.h
RUN echo 'extern unsigned int wasm_sleep(unsigned int time);' >> /root/php-src/main/php.h;

RUN /root/replace.sh 's/define HAVE_UNISTD_H 1/define HAVE_UNISTD_H 0/g' /root/php-src/main/php_config.h

# PHP <= 7.3 is not very good at detecting the presence of the POSIX readdir_r function
# so we need to force it to be enabled.
RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
		echo '#define HAVE_POSIX_READDIR_R 1' >> /root/php-src/main/php_config.h; \
	fi;

# Rename the original php_pollfd_for() implementation so that we can link our own version.
RUN /root/replace.sh 's/static inline int php_pollfd_for\(/int php_pollfd_for(php_socket_t fd, int events, struct timeval *timeouttv); static inline int __real_php_pollfd_for(/g' /root/php-src/main/php_network.h

RUN echo 'extern ssize_t wasm_read(int fd, void *buf, size_t count);' >> /root/php-src/main/php.h;
RUN /root/replace.sh 's/ret = read/ret = wasm_read/g' /root/php-src/main/streams/plain_wrapper.c

# Provide a custom implementation of the php_exec() function that handles spawning
# the process inside exec(), passthru(), system(), etc.
# We effectively remove the php_exec() implementation from the build by renaming it
# to an unused identifier "php_exec_old", and then we mark php_exec as extern.
RUN /root/replace.sh 's/PHPAPI int php_exec(.+)$/PHPAPI extern int php_exec\1; int php_exec_old\1/g' /root/php-src/ext/standard/exec.c

# Provide a custom implementation of the VCWD_POPEN() function that handles spawning
# the process inside PHP_FUNCTION(popen).
RUN /root/replace.sh 's/#define VCWD_POPEN.+/#define VCWD_POPEN(command, type) wasm_popen(command,type)/g' /root/php-src/Zend/zend_virtual_cwd.h
RUN echo 'extern FILE *wasm_popen(const char *cmd, const char *mode);' >> /root/php-src/Zend/zend_virtual_cwd.h

# Provide a custom implementation of the shutdown() function.
RUN perl -pi.bak -e $'s/(\s+)shutdown\(/$1 wasm_shutdown(/g' /root/php-src/sapi/cli/php_cli_server.c
RUN perl -pi.bak -e $'s/(\s+)closesocket\(/$1 wasm_close(/g' /root/php-src/sapi/cli/php_cli_server.c

# Provide custom implementation fo the shutdown() function.
# This is used by intl ( which links C++ code ) and need C linkage.
RUN cat >> /root/php-src/main/php_config.h <<EOF
#ifdef __cplusplus
extern "C" {
#endif

extern int wasm_shutdown(int fd, int how);
extern int wasm_close(int fd);

#ifdef __cplusplus
}
#endif
EOF

# This is used by intl ( which links C++ code ) and need C linkage. Needed in PHP < 7.4.
RUN sed -i '/^extern char \*\*environ;/d' /root/php-src/main/php.h \
 && cat <<EOF >> /root/php-src/main/php.h
#ifdef __cplusplus
extern "C" {
#endif

extern char **environ;

#ifdef __cplusplus
}
#endif
EOF

# Don't ship PHP_FUNCTION(proc_open) with the PHP build
# so that we can ship a patched version with php_wasm.c
RUN echo '' > /root/php-src/ext/standard/proc_open.h;
RUN echo '' > /root/php-src/ext/standard/proc_open.c;

ARG OUTPUT_DIR_ON_HOST
ARG DEBUG_DWARF_COMPILATION_DIR
RUN source /root/emsdk/emsdk_env.sh && \
	# We're compiling PHP as emscripten's side module...
	export JSPI_FLAGS=$(if [ "$WITH_JSPI" = "yes" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
	export PHP_VERSION_ESCAPED="${PHP_VERSION//./_}" && \
	EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE -Dsetsockopt=wasm_setsockopt -Dphp_exec=wasm_php_exec \
		$JSPI_FLAGS \
		-fdebug-compilation-dir=${DEBUG_DWARF_COMPILATION_DIR}/ \
		-fdebug-prefix-map=/root/php-src/=${OUTPUT_DIR_ON_HOST}/${PHP_VERSION_ESCAPED}/php-src/ " \
	# ...which means we must skip all the libraries - they will be provided in the final linking step.
	emmake make -j1

RUN cp -v /root/php-src/.libs/libphp*.la /root/lib/libphp.la
RUN cp -v /root/php-src/.libs/libphp*.a /root/lib/libphp.a

COPY ./php/php_wasm.c /root/
COPY ./php/proc_open* /root/

RUN if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "3" ]]; then \
		 cp /root/proc_open7.0.c /root/proc_open.c; \
		 cp /root/proc_open7.0.h /root/proc_open.h; \
	else \
		 cp /root/proc_open7.4.c /root/proc_open.c; \
		 cp /root/proc_open7.4.h /root/proc_open.h; \
	fi

ARG WITH_SOURCEMAPS
ARG OUTPUT_DIR_ON_HOST
ARG DEBUG_DWARF_COMPILATION_DIR
ARG WITH_DEBUG
RUN set -euxo pipefail; \
	if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
		# Add nodefs when building for node.js
		echo -n ' -lnodefs.js ' >> /root/.emcc-php-wasm-flags; \
	fi; \
	if [ "${WITH_SOURCEMAPS}" = "yes" ] || [ "${WITH_DEBUG}" = "yes" ]; then \
		echo -n ' -g3 ' >> /root/.emcc-php-wasm-flags; \
		# Make source file paths relative to the location of the .wasm file
		# so we can debug without additional config in host OS.
		export PHP_VERSION_ESCAPED="${PHP_VERSION//./_}"; \
		echo -n " -fdebug-compilation-dir=${DEBUG_DWARF_COMPILATION_DIR}/ " \
			"-fdebug-prefix-map=/root/php_wasm.c=${DEBUG_DWARF_COMPILATION_DIR}/compile/php/php_wasm.c " \
			"-fdebug-prefix-map=/root/php-src/=${OUTPUT_DIR_ON_HOST}/${PHP_VERSION_ESCAPED}/php-src/ " \
			"-fdebug-prefix-map=./=${OUTPUT_DIR_ON_HOST}/${PHP_VERSION_ESCAPED}/php-src/ " \
			"-fdebug-prefix-map=/emsdk/emscripten/==${OUTPUT_DIR_ON_HOST}/${PHP_VERSION_ESCAPED}/emscripten/ " \
			"-fdebug-prefix-map=/root/emsdk/upstream/emscripten/=${OUTPUT_DIR_ON_HOST}/${PHP_VERSION_ESCAPED}/emscripten/ " \
			>> /root/.emcc-php-wasm-flags; \
		if [ "${WITH_SOURCEMAPS}" = "yes" ]; then \
			echo -n ' -gsource-map' >> /root/.emcc-php-wasm-flags; \
			# Ensure source maps are loaded from the correct URL on the web.
			# Without this, browsers will try the wasm:// protocol and never load the source map.
			if [ "$EMSCRIPTEN_ENVIRONMENT" = "web" ]; then \
				echo -n " --source-map-base http://127.0.0.1:5400/@fs${OUTPUT_DIR_ON_HOST}/${PHP_VERSION_ESCAPED}/" >> /root/.emcc-php-wasm-flags; \
			fi; \
		fi; \
	else \
		# Preserve symbol names in node.js build – the bundle size doesn't matter as much
		# as on the web, and this makes debugging **much** easier.
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			echo -n ' -g2 ' >> /root/.emcc-php-wasm-flags; \
		fi; \
	fi;

# Add ws networking proxy support if needed
RUN if [ "$WITH_WS_NETWORKING_PROXY" = "yes" ]; \
	then \
		echo -n ' -lwebsocket.js ' >> /root/.emcc-php-wasm-flags; \
	fi

# Emscripten supports yielding from sync functions to JavaScript event loop, but all
# the synchronous functions doing that must be explicitly listed here. This is an
# exhaustive list that was created by compiling PHP with ASYNCIFY, running code that
# uses networking, observing the error, and listing the missing functions.
#
# If you a get an error similar to the one below, you need to add all the function on
# the stack to the "ASYNCIFY_ONLY" list below (in this case, it's php_mysqlnd_net_open_tcp_or_unix_pub):
#
# RuntimeError: unreachable
# at php_mysqlnd_net_open_tcp_or_unix_pub (<anonymous>:wasm-function[9341]:0x5e42b8)
# at byn$fpcast-emu$php_mysqlnd_net_open_tcp_or_unix_pub (<anonymous>:wasm-function[17222]:0x7795e9)
# at php_mysqlnd_net_connect_ex_pub (<anonymous>:wasm-function[9338]:0x5e3f02)
#
# Node cuts the trace short by default so use the --stack-trace-limit=50 CLI flag
# to get the entire stack.
#
# -------
#
# Related: Any errors like Fatal error: Cannot redeclare function ...
# are caused by dispatching a PHP request while an execution is paused
# due to an async call – it means the same PHP files are loaded before
# the previous request, where they're already loaded, is concluded.
# TODO: Consider reverting asyncify additions before merging this PR if file locking doesn't support asyncify.
RUN export ASYNCIFY_IMPORTS=$'[\n\
"invoke_i",\n\
"invoke_ii",\n\
"invoke_iii",\n\
"invoke_iiii",\n\
"invoke_iiiii",\n\
"invoke_iiiiii",\n\
"invoke_iiiiiii",\n\
"invoke_iiiiiiii",\n\
"invoke_iiiiiiiiii",\n\
"invoke_v",\n\
"invoke_vi",\n\
"invoke_vii",\n\
"invoke_viidii",\n\
"invoke_viii",\n\
"invoke_viiii",\n\
"invoke_viiiii",\n\
"invoke_viiiiii",\n\
"invoke_viiiiiii",\n\
"invoke_viiiiiiiii",\n\
"invoke_i",\
"invoke_ii",\
"invoke_iii",\
"invoke_iiii",\
"invoke_iiiii",\
"invoke_iiiiii",\
"invoke_iiiiiii",\
"invoke_iiiiiiii",\
"invoke_iiiiiiiiii",\
"invoke_iij",\
"invoke_iiji",\
"invoke_iijii",\
"invoke_iijiji",\
"invoke_jii",\
"invoke_jiii",\
"invoke_viijii",\
"invoke_vji",\
"js_open_process",\n\
"_js_open_process",\n\
"_asyncjs__js_open_process",\n\
"js_popen_to_file",\n\
"_js_popen_to_file",\n\
"_asyncjs__js_popen_to_file",\n\
"__syscall_fcntl64",\n\
"___syscall_fcntl64",\n\
"_asyncjs___syscall_fcntl64",\n\
"js_release_file_locks",\n\
"_js_release_file_locks",\n\
"_async_js_release_file_locks",\n\
"js_flock",\n\
"_js_flock",\n\
"_async_js_flock",\n\
"js_fd_read",\n\
"_js_fd_read",\n\
"fd_close",\n\
"_fd_close",\n\
"_asyncjs__fd_close",\n\
"close",\n\
"_close",\n\
"js_module_onMessage",\n\
"_js_module_onMessage",\n\
"_asyncjs__js_module_onMessage",\n\
"js_waitpid",\n\
"_js_waitpid",\n\
"_asyncjs__js_waitpid",\n\
"wasm_poll_socket",\n\
"_wasm_poll_socket",\n\
"_asyncjs__wasm_poll_socket",\n\
"_wasm_shutdown",\n\
"_asyncjs__wasm_shutdown"]'; \
	echo -n " -s ASYNCIFY_IMPORTS=$ASYNCIFY_IMPORTS " | tr -d "\n" >> /root/.emcc-php-asyncify-flags; \
	export ASYNCIFY_ONLY_UNPREFIXED=$'"null.<anonymous>",\
"__stdio_close",\
"zend_stream_stdio_closer",\
"zend_destroy_file_handle",\
"php_init_config",\
"zend_register_constant",\
"zend_register_ini_entries_ex",\
"php_module_startup",\
"wasm_sapi_module_startup",\
"__fseeko_unlocked",\
"__ftello_unlocked",\
"__funcs_on_exit",\
"__fwritex",\
"__netlink_enumerate",\
"__overflow",\
"__synccall",\
"__toread",\
"__uflow",\
"__vfprintf_internal",\
"__wrap_select",\
"__zend_malloc",\
"_call_user_function_ex",\
"_call_user_function_impl",\
"_emalloc_large",\
"_erealloc",\
"_erealloc2",\
"_estrdup",\
"_get_zval_cv_lookup",\
"_is_numeric_string_ex",\
"_mysqlnd_init_ps_subsystem",\
"_mysqlnd_run_command",\
"_pcre2_memctl_malloc_8",\
"_pdo_mysql_error",\
"_php_error_log_ex",\
"_php_import_environment_variables",\
"_php_stream_cast",\
"_php_stream_copy_to_mem",\
"_php_stream_copy_to_stream_ex",\
"_php_stream_eof",\
"_php_stream_fill_read_buffer",\
"_php_stream_filter_flush",\
"_php_stream_flush",\
"_php_stream_free_enclosed",\
"_php_stream_free",\
"_php_stream_get_line",\
"_php_stream_mkdir",\
"_php_stream_open_wrapper_ex",\
"_php_stream_opendir",\
"_php_stream_passthru",\
"_php_stream_read",\
"_php_stream_rmdir",\
"_php_stream_seek",\
"_php_stream_set_option",\
"_php_stream_stat_path",\
"_php_stream_stat",\
"_php_stream_sync",\
"_php_stream_truncate_set_size",\
"_php_stream_write_buffer",\
"_php_stream_write_filtered",\
"_php_stream_write",\
"_php_stream_xport_create",\
"_php_image_create_from",\
"zif_imagecreatefromavif",\
"_safe_emalloc",\
"_try_convert_to_string",\
"_zend_hash_init",\
"_zend_new_array_0",\
"_zend_new_array",\
"_zend_observe_fcall_begin",\
"_zend_observer_class_linked_notify",\
"_zend_observer_error_notify",\
"_zend_observer_function_declared_notify",\
"_zval_dtor_func_for_ptr",\
"_zval_dtor_func",\
"_zval_ptr_dtor",\
"autoVacuumCommit",\
"bsearch",\
"btreeCellSizeCheck",\
"btreeEndTransaction",\
"btreeParseCell",\
"call_extract_if_dead",\
"call",\
"callCollNeeded",\
"callFinaliser",\
"checkTreePage",\
"cleanup_unfinished_calls",\
"clearDatabasePage",\
"cli_register_file_handles",\
"cli",\
"close_stmt_and_copy_errors",\
"close",\
"__stdio_close",\
"closeUnixFile",\
"compile_file",\
"createCollation",\
"createFunctionApi",\
"createModule",\
"ctype_fallback",\
"Curl_conncache_foreach",\
"curl_easy_perform",\
"Curl_http_connect",\
"Curl_is_connected",\
"curl_multi_perform",\
"curl_multi_poll",\
"curl_multi_wait",\
"Curl_multi_wait",\
"Curl_ossl_connect_nonblocking",\
"Curl_ossl_seed",\
"Curl_poll",\
"Curl_proxy_connect",\
"Curl_readwrite",\
"Curl_setup_conn",\
"Curl_socket_check",\
"Curl_ssl_connect_nonblocking",\
"Curl_wait_ms",\
"curlx_nonblock",\
"dbh_free",\
"dbh_get_gc",\
"decrement_function",\
"deflate",\
"deflateEnd",\
"deflateInit2_",\
"defragmentPage",\
"destroy_op_array",\
"do_cli_server",\
"do_cli",\
"do_fetch_common",\
"do_fetch",\
"dotlockCheckReservedLock",\
"dotlockLock",\
"dotlockUnlock",\
"doWalCallbacks",\
"dynCall_dd",\
"dynCall_ddd",\
"dynCall_di",\
"dynCall_dii",\
"dynCall_i",\
"dynCall_ii",\
"dynCall_iidiiii",\
"dynCall_iii",\
"dynCall_iiid",\
"dynCall_iiii",\
"dynCall_iiiii",\
"dynCall_iiiiii",\
"dynCall_iiiiiii",\
"dynCall_iiiiiiii",\
"dynCall_iiiiiiiii",\
"dynCall_iiiiiiiiii",\
"dynCall_iiiiiiiiiii",\
"dynCall_iiiiiiiiiiii",\
"dynCall_iiiiiiiiiiij",\
"dynCall_iiiiiij",\
"dynCall_iiiiijii",\
"dynCall_iiiij",\
"dynCall_iiiiji",\
"dynCall_iiiijii",\
"dynCall_iiiijji",\
"dynCall_iiij",\
"dynCall_iiiji",\
"dynCall_iij",\
"dynCall_iiji",\
"dynCall_iijii",\
"dynCall_iijiji",\
"dynCall_iijj",\
"dynCall_ij",\
"dynCall_j",\
"dynCall_ji",\
"dynCall_jii",\
"dynCall_jiii",\
"dynCall_jiiii",\
"dynCall_jiiiji",\
"dynCall_jiij",\
"dynCall_jiiji",\
"dynCall_jiji",\
"dynCall_jijj",\
"dynCall_jj",\
"dynCall_v",\
"dynCall_vi",\
"dynCall_vid",\
"dynCall_vii",\
"dynCall_viidii",\
"dynCall_viii",\
"dynCall_viiii",\
"dynCall_viiiii",\
"dynCall_viiiiii",\
"dynCall_viiiiiii",\
"dynCall_viiiiiiii",\
"dynCall_viiji",\
"dynCall_viijii",\
"dynCall_vij",\
"dynCall_vijii",\
"dynCall_vji",\
"dynCall_vjiii",\
"easy_perform",\
"easy_transfer",\
"RAND_poll",\
"rand_bytes",\
"RAND_bytes",\
"SSL_CTX_new",\
"rand_nopseudo_bytes",\
"rand_enough",\
"Curl_ossl_seed",\
"zif_curl_multi_exec",\
"zif_curl_multi_select",\
"ossl_connect_common",\
"Curl_ossl_connect_nonblocking",\
"Curl_ssl_connect_nonblocking",\
"https_connecting",\
"Curl_readwrite",\
"zend_fetch_debug_backtrace",\
"zend_default_exception_new",\
"zend_throw_exception_zstr",\
"zend_throw_exception",\
"zend_type_error",\
"zend_generator_iterator_move_forward",\
"ZEND_FE_FETCH_R_SPEC_VAR_HANDLER",\
"zend_generator_resume",\
"zend_generator_iterator_rewind",\
"zend_fe_reset_iterator",\
"ZEND_FE_RESET_R_SPEC_VAR_HANDLER",\
"zend_user_it_get_new_iterator",\
"ZEND_ADD_ARRAY_UNPACK_SPEC_HANDLER",\
"ZEND_COUNT_SPEC_CV_UNUSED_HANDLER",\
"__fwritex",\
"read",\
"zif_sleep",\
"zif_stream_get_contents",\
"zif_stream_select",\
"_php_stream_fill_read_buffer",\
"_php_stream_read",\
"php_sqlite3_object_free_storage",\
"php_sqlite3_error",\
"sqlite3_reset",\
"php_stream_read_to_str",\
"php_userstreamop_read",\
"zif_fread",\
"wasm_read",\
"php_stdiop_read",\
"fwrite",\
"zif_fwrite",\
"php_stdiop_write",\
"zif_array_filter",\
"zend_unclean_zval_ptr_dtor",\
"zend_call_known_instance_method_with_2_params",\
"zend_fetch_dimension_address_read_R",\
"_zval_dtor_func_for_ptr",\
"ZEND_ASSIGN_DIM_SPEC_CV_CONST_HANDLER",\
"zend_fetch_dimension_address_read",\
"php_if_fopen",\
"_php_stream_cast",\
"php_stream_temp_cast",\
"php_stream_temp_flush",\
"_php_stream_flush",\
"php_stream_flush",\
"_php_stream_write",\
"php_stream_write",\
"_php_stream_free",\
"_php_stream_free_enclosed",\
"stream_resource_persistent_dtor",\
"stream_resource_regular_dtor",\
"zend_std_has_dimension",\
"zend_isset_isempty_dim_prop_obj_handler_SPEC_CV_CONST",\
"zend_assign_to_object",\
"zif_file_put_contents",\
"ZEND_ASSIGN_OBJ_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_CV_CV_HANDLER",\
"zend_std_call_user_call",\
"zend_objects_store_del_ref_by_handle_ex",\
"zend_objects_store_del_ref",\
"_zval_dtor_func",\
"_zval_ptr_dtor",\
"zend_hash_del_key_or_index",\
"zend_delete_variable",\
"ZEND_UNSET_VAR_SPEC_CV_UNUSED_HANDLER",\
"zend_std_unset_dimension",\
"ZEND_UNSET_DIM_SPEC_CV_CONST_HANDLER",\
"zend_std_read_dimension",\
"zend_fetch_dimension_address_read_R_slow",\
"zend_call_method",\
"zend_assign_to_object_dim",\
"ZEND_ASSIGN_DIM_SPEC_CV_CONST_OP_DATA_CONST_HANDLER",\
"zend_std_write_dimension",\
"zend_isset_dim_slow",\
"ZEND_ISSET_ISEMPTY_DIM_OBJ_SPEC_CV_CONST_HANDLER",\
"zend_std_write_property",\
"ZEND_ASSIGN_OBJ_SPEC_CV_CONST_OP_DATA_CONST_HANDLER",\
"zend_objects_store_del",\
"ZEND_UNSET_CV_SPEC_CV_UNUSED_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_FCALL_SPEC_CONST_HANDLER",\
"ZEND_DO_FCALL_SPEC_HANDLER",\
"ZEND_DO_FCALL_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_FCALL_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_FCALL_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_ICALL_SPEC_HANDLER",\
"ZEND_DO_ICALL_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_ICALL_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_UCALL_SPEC_OBSERVER_HANDLER",\
"ZEND_FETCH_OBJ_FUNC_ARG_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_TMPVAR_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_TMPVAR_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_TMPVAR_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_TMPVAR_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CV_OP_DATA_CV_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_CV_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_VAR_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_TMP_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_CONST_HANDLER",\
"ZEND_ASSIGN_SPEC_CV_VAR_RETVAL_UNUSED_HANDLER",\
"cli",\
"wasm_sleep",\
"wasm_php_stream_flush",\
"wasm_php_stream_read",\
"php_crc32_stream_bulk_update",\
"phar_parse_zipfile",\
"get_http_body",\
"wasm_php_exec",\
"wasm_sapi_handle_request",\
"wasm_sapi_request_shutdown",\
"execute_internal",\
"_call_user_function_ex",\
"_call_user_function_impl",\
"_mysqlnd_run_command",\
"_php_stream_copy_to_mem",\
"_php_stream_copy_to_stream_ex",\
"_php_stream_eof",\
"_php_stream_fill_read_buffer",\
"_php_stream_free",\
"_php_stream_get_line",\
"_php_stream_open_wrapper_ex",\
"_php_stream_read",\
"_php_stream_set_option",\
"_php_stream_write",\
"_php_stream_xport_create",\
"zif_stream_socket_enable_crypto",\
"do_cli",\
"do_cli_server",\
"execute_ex",\
"EVP_PKEY_encrypt",\
"exif_error_docref",\
"fclose",\
"fcntl",\
"fcntlSizeHint",\
"fetch_value",\
"fflush",\
"file_handle_dtor",\
"fileHasMovedunixCheckReservedLock",\
"fillInUnixFile",\
"find_implicit_binds_recursively",\
"findInodeInfo",\
"findReusableFd",\
"flock",\
"fread",\
"functionDestroy",\
"fwrite",\
"get_http_body",\
"get_line",\
"getFileMode",\
"hasHotJournal",\
"https_connecting",\
"iter_wrapper_free",\
"iter_wrapper_get_gc",\
"lex_scan",\
"list_entry_destructor",\
"zend_hash_index_del",\
"zend_list_free",\
"lockBtree",\
"lockTrace",\
"main",\
"mallocWithAlarm",\
"match",\
"modifyPagePointer",\
"module_destructor",\
"mul_function_slow",\
"multi_runsingle",\
"multipart_buffer_read",\
"mysql_handle_begin",\
"mysql_handle_closer",\
"mysql_handle_commit",\
"mysql_handle_doer",\
"mysql_handle_preparer",\
"mysql_handle_quoter",\
"mysql_handle_rollback",\
"mysql_stmt_execute",\
"mysqli_commit_or_rollback_libmysql",\
"mysqli_common_connect",\
"mysqlnd_caching_sha2_handle_server_response",\
"mysqlnd_com_handshake_run",\
"mysqlnd_com_init_db_run",\
"mysqlnd_com_stmt_execute_run",\
"mysqlnd_com_stmt_prepare_run",\
"mysqlnd_com_set_option_run",\
"mysqlnd_com_ping_run",\
"mysqlnd_com_set_option_run",\
"mysqlnd_com_debug_run",\
"mysqlnd_com_init_db_run",\
"mysqlnd_com_ping_run",\
"mysqlnd_com_statistics_run",\
"mysqlnd_com_process_kill_run",\
"mysqlnd_com_refresh_run",\
"mysqlnd_com_quit_run",\
"mysqlnd_com_query_run",\
"mysqlnd_com_change_user_run",\
"mysqlnd_com_reap_result_run",\
"mysqlnd_com_stmt_prepare_run",\
"mysqlnd_com_stmt_reset_run",\
"mysqlnd_com_stmt_send_long_data_run",\
"mysqlnd_com_stmt_close_run",\
"mysqlnd_com_enable_ssl_run",\
"mysqlnd_com_handshake_run",\
"mysqlnd_connect",\
"mysqlnd_connection_connect",\
"mysqlnd_mysqlnd_command_handshake_pub",\
"mysqlnd_mysqlnd_command_init_db_pub",\
"mysqlnd_mysqlnd_command_ping_pub",\
"mysqlnd_mysqlnd_command_reap_result_pub",\
"mysqlnd_mysqlnd_command_set_option_pub",\
"mysqlnd_mysqlnd_conn_connect_pub",\
"mysqlnd_mysqlnd_conn_data_connect_handshake_pub",\
"mysqlnd_mysqlnd_conn_data_connect_pub",\
"mysqlnd_mysqlnd_conn_data_next_result_pub",\
"mysqlnd_mysqlnd_conn_data_ping_pub",\
"mysqlnd_mysqlnd_conn_data_query_pub",\
"mysqlnd_mysqlnd_conn_data_reap_query_pub",\
"mysqlnd_mysqlnd_conn_data_select_db_pub",\
"mysqlnd_mysqlnd_conn_data_set_charset_pub",\
"mysqlnd_mysqlnd_conn_data_set_server_option_pub",\
"mysqlnd_mysqlnd_conn_data_store_result_pub",\
"mysqlnd_mysqlnd_conn_data_tx_commit_or_rollback_pub",\
"mysqlnd_mysqlnd_pfc_receive_pub",\
"mysqlnd_mysqlnd_pfc_send_pub",\
"mysqlnd_mysqlnd_protocol_send_command_handle_EOF_pub",\
"mysqlnd_mysqlnd_protocol_send_command_handle_OK_pub",\
"mysqlnd_mysqlnd_protocol_send_command_handle_response_pub",\
"mysqlnd_mysqlnd_protocol_send_command_pub",\
"mysqlnd_mysqlnd_res_store_result_fetch_data_pub",\
"mysqlnd_mysqlnd_res_store_result_pub",\
"mysqlnd_mysqlnd_stmt_execute_pub",\
"mysqlnd_mysqlnd_stmt_prepare_pub",\
"mysqlnd_mysqlnd_stmt_send_execute_pub",\
"mysqlnd_mysqlnd_vio_connect_pub",\
"mysqlnd_mysqlnd_vio_network_read_pub",\
"mysqlnd_mysqlnd_vio_network_write_pub",\
"mysqlnd_mysqlnd_vio_open_tcp_or_unix_pub",\
"mysqlnd_query_read_result_set_header",\
"mysqlnd_read_body_name",\
"mysqlnd_read_buffer_is_empty",\
"mysqlnd_read_buffer",\
"mysqlnd_read_header_name",\
"mysqlnd_read_header",\
"mysqlnd_read_packet_header_and_body",\
"mysqlnd_run_authentication",\
"mysqlnd_stmt_execute_parse_response",\
"mysqlnd_stmt_execute",\
"nodeAcquire",\
"nodeNew",\
"nodeRelease",\
"nodeWrite",\
"object_and_properties_init",\
"object_common",\
"object_custom",\
"object_init_ex",\
"open_file_for_scanning",\
"openDatabase",\
"osLocaltime",\
"ossl_connect_common",\
"page_wait_on_lock",\
"pager_end_transaction",\
"pager_playback_one_page",\
"pager_unlock",\
"pager_wait_on_lock",\
"pagerLockDb",\
"pagerUndoCallback",\
"pagerUnlockAndRollback",\
"pagerUnlockDb",\
"pagerUnlockIfUnused",\
"param_dtor",\
"parentWrite",\
"pcacheUnpin",\
"persistent_stream_open_function",\
"pdo_dbh_attribute_set",\
"pdo_dbh_free_storage",\
"pdo_dbstmt_free_storage",\
"pdo_handle_error",\
"pdo_hash_methods",\
"pdo_mysql_check_liveness",\
"pdo_mysql_fill_stmt_from_result",\
"pdo_mysql_get_attribute",\
"pdo_mysql_handle_factory",\
"pdo_mysql_in_transaction",\
"pdo_mysql_last_insert_id",\
"pdo_mysql_request_shutdown",\
"pdo_mysql_set_attribute",\
"pdo_mysql_stmt_after_execute_prepared",\
"pdo_mysql_stmt_col_meta",\
"pdo_mysql_stmt_cursor_closer",\
"pdo_mysql_stmt_describe",\
"pdo_mysql_stmt_dtor",\
"pdo_mysql_stmt_execute_prepared",\
"pdo_mysql_stmt_execute",\
"pdo_mysql_stmt_fetch",\
"pdo_mysql_stmt_get_col",\
"pdo_mysql_stmt_next_rowset",\
"pdo_mysql_stmt_param_hook",\
"pdo_parse_params",\
"pdo_sqlite_stmt_dtor",\
"pdo_sqlite_stmt_execute",\
"pdo_sqlite_stmt_fetch",\
"pdo_stmt_describe_columns",\
"pdo_stmt_do_next_rowset",\
"pdo_stmt_init",\
"phar_compile_file",\
"phar_file_get_contents",\
"phar_fopen",\
"phar_parse_zipfile",\
"php_call_shutdown_functions",\
"php_cli_server_do_event_for_each_fd_callback",\
"php_cli_server_poller_poll",\
"php_cli_server_recv_event_read_request",\
"php_crc32_stream_bulk_update",\
"php_error_docref",\
"php_exec_ex",\
"php_exec",\
"php_execute_script_ex",\
"php_execute_script",\
"php_fopen_primary_script",\
"php_fsockopen_stream",\
"php_getimagesize_from_any",\
"php_if_fopen",\
"php_mysqlnd_auth_response_read",\
"php_mysqlnd_cached_sha2_result_read",\
"php_mysqlnd_cmd_write",\
"php_mysqlnd_conn_connect_pub",\
"php_mysqlnd_conn_data_connect_handshake_pub",\
"php_mysqlnd_conn_data_connect_pub",\
"php_mysqlnd_conn_data_next_result_pub",\
"php_mysqlnd_conn_data_query_pub",\
"php_mysqlnd_conn_data_reap_query_pub",\
"php_mysqlnd_conn_data_select_db_pub",\
"php_mysqlnd_conn_data_set_charset_pub",\
"php_mysqlnd_conn_data_simple_command_pub",\
"php_mysqlnd_conn_data_simple_command_send_request_pub",\
"php_mysqlnd_conn_data_store_result_pub",\
"php_mysqlnd_conn_data_tx_commit_or_rollback_pub",\
"php_mysqlnd_eof_read",\
"php_mysqlnd_greet_read",\
"php_mysqlnd_net_connect_ex_pub",\
"php_mysqlnd_net_network_read_ex_pub",\
"php_mysqlnd_net_network_write_ex_pub",\
"php_mysqlnd_net_open_tcp_or_unix_pub",\
"php_mysqlnd_net_receive_ex_pub",\
"php_mysqlnd_net_send_ex_pub",\
"php_mysqlnd_ok_read",\
"php_mysqlnd_prepare_read",\
"php_mysqlnd_res_meta_read_metadata_pub",\
"php_mysqlnd_res_read_result_metadata_pub",\
"php_mysqlnd_res_store_result_fetch_data_pub",\
"php_mysqlnd_res_store_result_pub",\
"php_mysqlnd_rowp_read",\
"php_mysqlnd_rset_field_read",\
"php_mysqlnd_rset_header_read",\
"php_mysqlnd_sha256_pk_request_response_read",\
"php_mysqlnd_stmt_execute_pub",\
"php_mysqlnd_stmt_prepare_pub",\
"php_network_accept_incoming",\
"php_network_connect_socket_to_host",\
"php_network_connect_socket",\
"php_openssl_enable_crypto",\
"php_openssl_sockop_close",\
"php_openssl_sockop_io",\
"php_openssl_sockop_read",\
"php_openssl_sockop_set_option",\
"php_openssl_sockop_write",\
"php_pcre_replace_func_impl",\
"php_pdo_free_statement",\
"php_pollfd_for",\
"php_replace_in_subject_func",\
"php_request_shutdown",\
"php_sock_stream_wait_for_data",\
"php_sockop_read_close",\
"php_sockop_read",\
"php_sockop_set_option",\
"php_sockop_write",\
"php_stdiop_read",\
"php_stdiop_set_option",\
"php_stdiop_write",\
"php_stream_bucket_attach",\
"php_stream_context_free",\
"php_stream_filter_append_ex",\
"php_stream_filter_create",\
"php_stream_filter_free",\
"php_stream_filter_register_factory",\
"php_stream_filter_remove",\
"php_stream_flush",\
"php_stream_notification_free",\
"php_stream_notification_notify",\
"php_stream_open_for_zend",\
"php_stream_read_to_str",\
"php_stream_temp_cast",\
"php_stream_temp_flush",\
"php_stream_url_wrap_http_ex",\
"php_stream_url_wrap_http",\
"php_stream_write",\
"php_stream_xport_crypto_enable",\
"php_stream_xport_crypto_setup",\
"php_stream_xport_register",\
"php_tcp_sockop_set_option",\
"php_tick_iterator",\
"php_url_encode_hash_ex",\
"php_userstreamop_read",\
"php_userstreamop_set_option",\
"php_var_dump",\
"php_var_serialize_intern",\
"php_var_unserialize_internal",\
"php_verror",\
"php_wasm_init",\
"php_zend_stream_closer",\
"php_zip_extract_file",\
"php_zip_get_properties",\
"php_zip_has_property",\
"php_zip_read_property",\
"php_zip_register_prop_handler",\
"php_zlib_filter_create",\
"php_zlib_output_compression_start",\
"php_zval_filter",\
"pkey_rsa_encrypt",\
"plist_entry_destructor",\
"pop_arg",\
"populateCellCache",\
"posixUnlock",\
"pow_function",\
"preg_replace_func_impl",\
"printf_core",\
"proc_open_rsrc_dtor",\
"ptrmapPutOvflPtr",\
"raise",\
"rand_bytes",\
"RAND_bytes",\
"rand_enough",\
"rand_nopseudo_bytes",\
"RAND_poll",\
"rand_status",\
"RAND_status",\
"rc_dtor_func",\
"read_file",\
"read",\
"readline_shell_run",\
"really_register_bound_param",\
"rebuild_object_properties",\
"reflection_method_invoke",\
"Reinsert",\
"releasePageOne",\
"renderLogMsg",\
"resetCursor",\
"result_current_field_read",\
"result_field_count_read",\
"result_lengths_read",\
"result_num_rows_read",\
"rfc1867_post_handler",\
"robust_close",\
"robust_ftruncate",\
"robust_open",\
"robustFchown",\
"rowidWrite",\
"RSA_padding_add_PKCS1_OAEP_mgf1",\
"rtreeCallbackConstraint",\
"rtreeInsertCell",\
"run_cli",\
"schemaIsValid",\
"seekAndRead",\
"seekAndWriteFd",\
"selectExpander",\
"shutdown_destructors",\
"shutdown_executor",\
"sifttrinkle",\
"singleipconnect",\
"slow_index_convert",\
"smart_str_append_printf",\
"smart_str_erealloc",\
"spl_append_it_fetch",\
"spl_append_it_next_iterator",\
"spl_caching_it_next",\
"spl_dual_it_construct",\
"spl_dual_it_fetch",\
"spl_dual_it_free",\
"spl_dual_it_get_method",\
"spl_filesystem_object_clone",\
"spl_filesystem_object_free_storage",\
"spl_filter_it_fetch",\
"spl_heap_object_free_storage",\
"spl_heap_object_new_ex",\
"spl_iterator_apply",\
"spl_iterator_to_array_apply",\
"spl_iterator_to_values_apply",\
"spl_limit_it_seek",\
"spl_ptr_heap_delete_top",\
"spl_ptr_heap_insert",\
"spl_recursive_it_get_current_data",\
"spl_recursive_it_get_current_key",\
"spl_recursive_it_get_method",\
"spl_recursive_it_it_construct",\
"spl_recursive_it_move_forward_ex",\
"spl_recursive_it_rewind_ex",\
"spl_recursive_it_valid",\
"SplitNode",\
"splitNodeStartree",\
"sqlite_handle_closer",\
"sqlite_handle_doer",\
"sqlite_handle_preparer",\
"sqlite3_autovacuum_pages",\
"sqlite3_backup_step",\
"sqlite3_bind_pointer",\
"sqlite3_exec",\
"sqlite3_finalize",\
"sqlite3_free",\
"sqlite3_malloc64",\
"sqlite3_msize",\
"sqlite3_mutex_alloc",\
"sqlite3_mutex_enter",\
"sqlite3_mutex_free",\
"sqlite3_mutex_leave",\
"sqlite3_mutex_try",\
"sqlite3_prepare_v2",\
"sqlite3_set_auxdata",\
"sqlite3_step",\
"sqlite3AuthCheck",\
"sqlite3AuthReadCol",\
"sqlite3AutoLoadExtensions",\
"sqlite3BeginBenignMalloc",\
"sqlite3BtreeBeginTrans",\
"sqlite3BtreeClose",\
"sqlite3BtreeCommit",\
"sqlite3BtreeCommitPhaseTwo",\
"sqlite3BtreeDelete",\
"sqlite3BtreeIndexMoveto",\
"sqlite3BtreeInsert",\
"sqlite3BtreeRollback",\
"sqlite3Close",\
"sqlite3DbMallocSize",\
"sqlite3EndBenignMalloc",\
"sqlite3FaultSim",\
"sqlite3Fts3CacheDeferredDoclists",\
"sqlite3Fts3HashFindElem",\
"sqlite3Fts3HashInsert",\
"sqlite3Fts3InitTokenizer",\
"sqlite3Fts3Offsets",\
"sqlite3Fts3OpenTokenizer",\
"sqlite3Fts5AuxInit",\
"sqlite3Fts5ConfigFree",\
"sqlite3Fts5ExprFirst",\
"sqlite3Fts5ExprNext",\
"sqlite3Fts5GetTokenizer",\
"sqlite3Fts5IndexQuery",\
"sqlite3Fts5ParserAlloc",\
"sqlite3Fts5ParserFree",\
"sqlite3Fts5Tokenize",\
"sqlite3Fts5TokenizerInit",\
"sqlite3Init",\
"sqlite3InitOne",\
"sqlite3Insert",\
"sqlite3InvokeBusyHandler",\
"sqlite3IsShadowTableOf",\
"sqlite3LeaveMutexAndCloseZombie",\
"sqlite3LoadExtension",\
"sqlite3LocateTable",\
"sqlite3LocateTableItem",\
"sqlite3LockAndPrepare",\
"sqlite3Malloc",\
"sqlite3MallocInit",\
"sqlite3MallocSize",\
"sqlite3MarkAllShadowTablesOf",\
"sqlite3MutexAlloc",\
"sqlite3MutexInitsqlite3_db_status",\
"sqlite3OsAccess",\
"sqlite3OsCheckReservedLock",\
"sqlite3OsClose",\
"sqlite3OsCurrentTimeInt64",\
"sqlite3OsDelete",\
"sqlite3OsDeviceCharacteristics",\
"sqlite3OsDlClose",\
"sqlite3OsDlError",\
"sqlite3OsDlOpensqlite3OsDlSym",\
"sqlite3OsFileControl",\
"sqlite3OsFileControlHint",\
"sqlite3OsFileSize",\
"sqlite3OsFullPathname",\
"sqlite3OsGetLastError",\
"sqlite3OsLock",\
"sqlite3OsOpen",\
"sqlite3OsRandomness",\
"sqlite3OsRead",\
"sqlite3OsSectorSize",\
"sqlite3OsShmBarrier",\
"sqlite3OsShmLock",\
"sqlite3OsShmMap",\
"sqlite3OsShmUnmap",\
"sqlite3OsSleep",\
"sqlite3OsSync",\
"sqlite3OsTruncate",\
"sqlite3OsUnlock",\
"sqlite3OsWrite",\
"sqlite3PagerBegin",\
"sqlite3PagerClose",\
"sqlite3PagerCommitPhaseTwo",\
"sqlite3PagerExclusiveLock",\
"sqlite3PagerGet",\
"sqlite3PagerRollback",\
"sqlite3PagerSharedLock",\
"sqlite3PagerUnrefPageOne",\
"sqlite3ParseObjectReset",\
"sqlite3Parser",\
"sqlite3ParserAddCleanup",\
"sqlite3PcacheClose",\
"sqlite3PcacheDrop",\
"sqlite3PcacheFetch",\
"sqlite3PcacheFetchStress",\
"sqlite3PcacheInitialize",\
"sqlite3PcacheMove",\
"sqlite3PcachePagecount",\
"sqlite3PcacheSetCachesize",\
"sqlite3PcacheSetPageSize",\
"sqlite3PcacheShrink",\
"sqlite3PcacheTruncate",\
"sqlite3Prepare",\
"sqlite3ReadSchema",\
"sqlite3Realloc",\
"sqlite3RollbackAll",\
"sqlite3RunParser",\
"sqlite3Select",\
"sqlite3SelectPrep",\
"sqlite3SrcListLookup",\
"sqlite3StartTable",\
"sqlite3Step",\
"sqlite3ThreadCreate",\
"sqlite3VdbeDeleteAuxData",\
"sqlite3VdbeExec",\
"sqlite3VdbeFreeCursorNN",\
"sqlite3VdbeHalt",\
"sqlite3VdbeMemAggValue",\
"sqlite3VdbeMemFinalizevdbeCommit",\
"sqlite3VdbeMemGrow",\
"sqlite3VdbeMemSetStr",\
"sqlite3VdbeReset",\
"sqlite3VtabBegin",\
"sqlite3VtabCallDestroy",\
"sqlite3VtabModuleUnref",\
"sqlite3VtabOverloadFunction",\
"sqlite3VtabSavepoint",\
"sqlite3VtabSync",\
"sqlite3VtabUnlock",\
"sqlite3WalkSelect",\
"sqlite3WalUndo",\
"SSL_CTX_new",\
"stem",\
"stmt_affected_rows_read",\
"stmt_errno_read",\
"stmt_error_read",\
"stmt_field_count_read",\
"stmt_insert_id_read",\
"stmt_num_rows_read",\
"stmt_param_count_read",\
"stmt_sqlstate_read",\
"stream_array_from_fd_set",\
"stream_resource_persistent_dtor",\
"stream_resource_regular_dtor",\
"strfilter_convert_append_bucket",\
"strfilter_convert_dtor",\
"sub_function_slow",\
"syscall",\
"tsrm_realpath",\
"unixAccess",\
"unixCheckReservedLock",\
"unixClose",\
"unixDelete",\
"unixDlSym",\
"unixFcntlExternalReader",\
"unixFileLock",\
"unixFileSize",\
"unixFullPathname",\
"unixGetTempname",\
"unixLock",\
"unixLockSharedMemory",\
"unixOpen",\
"unixOpenSharedMemory",\
"unixShmMap",\
"unixShmPurge",\
"unixShmRegionPerMap",\
"unixShmSystemLock",\
"unixShmUnmap",\
"unixSync",\
"unixTempFileDir",\
"unixUnlock",\
"unlockBtreeIfUnused",\
"UpdateDefaultFilter",\
"updateMapping",\
"updatewindow",\
"user_shutdown_function_call",\
"userfilter_filter",\
"vdbeCommit",\
"vdbeCompareMemString",\
"vdbeMemClearExternAndSetNull",\
"vdbeMergeEngineCompare",\
"vdbeMergeEngineStep",\
"vdbeSorterMerge",\
"verifyDbFile",\
"virtual_chdir_file",\
"virtual_file_ex",\
"vtabBestIndex",\
"vtabCallConstructor",\
"walBusyLock",\
"walkExpr",\
"wasm_php_exec",\
"wasm_php_stream_flush",\
"wasm_php_stream_read",\
"wasm_popen",\
"wasm_read",\
"wasm_sapi_handle_request",\
"wasm_sapi_request_shutdown",\
"wasm_sleep",\
"wrapper_cmp",\
"yy_reduce",\
"zend_activate_auto_globals",\
"zend_activate_modules",\
"ZEND_ADD_ARRAY_UNPACK_SPEC_HANDLER",\
"zend_add_class_name_literal",\
"zend_add_const_name_literal",\
"zend_add_func_name_literal",\
"zend_add_helper_SPEC",\
"zend_add_literal",\
"zend_add_ns_func_name_literal",\
"zend_alter_ini_entry_ex",\
"zend_argument_count_error",\
"zend_array_destroy",\
"zend_array_dup",\
"zend_array_key_exists_error",\
"zend_array_key_exists_fast",\
"ZEND_ASSIGN_DIM_SPEC_CV_CONST_HANDLER",\
"ZEND_ASSIGN_DIM_SPEC_CV_CONST_OP_DATA_CONST_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_CV_CONST_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_CV_CONST_OP_DATA_CONST_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_CONST_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_CV_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_TMP_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CONST_OP_DATA_VAR_HANDLER",\
"ZEND_ASSIGN_OBJ_SPEC_VAR_CV_OP_DATA_CV_HANDLER",\
"zend_assign_to_object_dim",\
"zend_assign_to_object",\
"zend_ast_apply",\
"zend_ast_evaluate_inner",\
"zend_attach_symbol_table",\
"ZEND_BEGIN_SILENCE_SPEC_HANDLER",\
"zend_binary_assign_op_dim_slow",\
"zend_binary_assign_op_obj_dim",\
"zend_binary_assign_op_typed_prop",\
"zend_binary_assign_op_typed_ref",\
"zend_bind_class_in_slot",\
"zend_call_destructors",\
"zend_call_function",\
"zend_call_known_function",\
"zend_call_known_instance_method_with_2_params",\
"zend_call_method_if_exists",\
"zend_call_method",\
"zend_close_rsrc",\
"zend_close_rsrc_list",\
"ZEND_COUNT_SPEC_CV_UNUSED_HANDLER",\
"zend_deactivate",\
"zend_default_exception_new",\
"zend_delete_variable",\
"zend_deprecated_function",\
"zend_destroy_rsrc_list",\
"ZEND_DO_FCALL_BY_NAME_SPEC_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_FCALL_BY_NAME_SPEC_RETVAL_USED_HANDLER",\
"zend_do_fcall_common_helper_SPEC",\
"ZEND_DO_FCALL_SPEC_CONST_HANDLER",\
"ZEND_DO_FCALL_SPEC_HANDLER",\
"ZEND_DO_FCALL_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_FCALL_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_FCALL_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_ICALL_SPEC_HANDLER",\
"ZEND_DO_ICALL_SPEC_RETVAL_UNUSED_HANDLER",\
"ZEND_DO_ICALL_SPEC_RETVAL_USED_HANDLER",\
"ZEND_DO_ICALL_SPEC_OBSERVER_HANDLER",\
"ZEND_DO_UCALL_SPEC_OBSERVER_HANDLER",\
"zend_emit_op_tmp",\
"zend_emit_op",\
"zend_enum_add_case_cstr",\
"zend_error_noreturn",\
"zend_error_va_list",\
"zend_error_va",\
"zend_error_zstr_at",\
"zend_error_zstr",\
"zend_error",\
"zend_eval_const_expr",\
"zend_eval_string_ex",\
"zend_eval_string",\
"zend_eval_stringl",\
"zend_exception_error",\
"zend_exception_restore",\
"zend_execute_script",\
"zend_execute_scripts",\
"zend_execute",\
"zend_extension_statement_handler",\
"ZEND_EXT_STMT_SPEC_HANDLER",\
"ZEND_FE_FETCH_R_SPEC_VAR_HANDLER",\
"zend_fe_reset_iterator",\
"ZEND_FE_RESET_R_SPEC_VAR_HANDLER",\
"zend_fetch_class_by_name",\
"zend_fetch_debug_backtrace",\
"ZEND_FETCH_DIM_R_SPEC_CV_CONST_HANDLER",\
"zend_fetch_dimension_address_read_R_slow",\
"zend_fetch_dimension_address_read_R",\
"zend_fetch_dimension_address_read",\
"ZEND_FETCH_OBJ_FUNC_ARG_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_CV_CONST_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_CV_CV_HANDLER",\
"ZEND_FETCH_OBJ_R_SPEC_TMPVAR_CONST_HANDLER",\
"zend_fiber_switch_context",\
"zend_fiber_trampoline",\
"zend_file_handle_dtor",\
"zend_find_array_dim_slow",\
"zend_free_extra_named_params",\
"zend_generate_anon_class_name",\
"zend_generator_close",\
"ZEND_GENERATOR_CREATE_SPEC_HANDLER",\
"zend_generator_get_next_delegated_value",\
"zend_generator_iterator_move_forward",\
"zend_generator_iterator_rewind",\
"zend_generator_resume",\
"ZEND_GENERATOR_RETURN_SPEC_CONST_HANDLER",\
"ZEND_GENERATOR_RETURN_SPEC_CV_HANDLER",\
"ZEND_GENERATOR_RETURN_SPEC_OBSERVER_HANDLER",\
"ZEND_GENERATOR_RETURN_SPEC_TMP_HANDLER",\
"ZEND_GENERATOR_RETURN_SPEC_VAR_HANDLER",\
"zend_hash_apply",\
"zend_hash_del_key_or_index",\
"zend_hash_graceful_reverse_destroy",\
"zend_hash_reverse_apply",\
"ZEND_INCLUDE_OR_EVAL_SPEC_CV_HANDLER",\
"ZEND_INCLUDE_OR_EVAL_SPEC_OBSERVER_HANDLER",\
"zend_include_or_eval",\
"compile_filename",\
"zend_internal_type_error",\
"zend_interrupt_helper_SPEC",\
"zend_invalid_class_constant_type_error",\
"zend_invalid_method_call",\
"zend_isset_dim_slow",\
"ZEND_ISSET_ISEMPTY_DIM_OBJ_SPEC_CV_CONST_HANDLER",\
"zend_isset_isempty_dim_prop_obj_handler_SPEC_CV_CONST",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_CV_TMPVAR_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_TMPVAR_CONST_HANDLER",\
"ZEND_ISSET_ISEMPTY_PROP_OBJ_SPEC_TMPVAR_HANDLER",\
"zend_iterator_dtor",\
"zend_leave_helper_SPEC",\
"zend_lex_tstring",\
"zend_list_close",\
"zend_llist_apply_with_argument",\
"zend_llist_apply_with_arguments",\
"zend_llist_apply_with_del",\
"zend_llist_apply",\
"zend_llist_clean",\
"zend_llist_del_element",\
"zend_llist_destroy",\
"zend_load_extension_handle",\
"zend_lookup_class_ex",\
"zend_merge_properties",\
"zend_message_dispatcher",\
"zend_mm_alloc_huge",\
"zend_mm_alloc_pages_efree_160",\
"zend_mm_free_huge",\
"zend_mm_free_pages",\
"zend_mm_gc",\
"zend_mm_realloc_huge",\
"zend_mm_shutdown_emalloc_24",\
"zend_multibyte_check_lexer_compatibility",\
"ZEND_NEW_SPEC_CONST_UNUSED_HANDLER",\
"zend_non_static_method_call",\
"zend_objects_destroy_object",\
"zend_objects_store_call_destructors",\
"zend_objects_store_del_ref_by_handle_ex",\
"zend_objects_store_del_ref",\
"zend_objects_store_del",\
"zend_objects_store_free_object_storage",\
"zend_observer_fcall_begin_prechecked",\
"zend_observer_fcall_begin",\
"zend_observer_fcall_end",\
"zend_observer_fcall_end_prechecked",\
"zend_parse_arg_number_or_str_slow",\
"zend_parse_arg_str_weak",\
"zend_parse_arg",\
"zend_parse_method_parameters",\
"zend_parse_parameters",\
"zend_parse_va_args",\
"zend_post_deactivate_modules",\
"zend_post_startup",\
"zend_prepare_string_for_scanning",\
"zend_print_zval_r_to_buf",\
"zend_print_zval_r",\
"zend_print_zval",\
"zend_ptr_stack_clean",\
"zend_ptr_stack_reverse_apply",\
"zend_quick_get_constant",\
"zend_read_property_ex",\
"zend_read_property",\
"zend_readonly_property_modification_error",\
"zend_rebuild_symbol_table",\
"zend_ref_add_type_source",\
"zend_scan_escape_string",\
"zend_separate_class_constants_table",\
"zend_set_memory_limit",\
"zend_set_timeout",\
"zend_short_circuiting_commit",\
"zend_shutdown_executor_values",\
"zend_signal_handler",\
"zend_sort_4",\
"zend_sort",\
"zend_spprintf",\
"zend_stack_apply_with_argument",\
"zend_stack_clean",\
"zend_startup_module_ex",\
"zend_startup",\
"zend_std_call_getter",\
"zend_std_call_user_call",\
"zend_std_compare_objects",\
"zend_std_has_dimension",\
"zend_std_has_property",\
"zend_std_read_dimension",\
"zend_std_read_property",\
"zend_std_unset_dimension",\
"zend_std_write_dimension",\
"zend_std_write_property",\
"zend_stream_fixup",\
"zend_stream_open",\
"zend_strip",\
"zend_strtod",\
"zend_symtable_to_proptable",\
"zend_this_not_in_object_context_helper_SPEC",\
"zend_throw_error",\
"zend_throw_exception_ex",\
"zend_throw_exception_internal",\
"zend_throw_exception_object",\
"zend_throw_exception_zstr",\
"zend_throw_exception",\
"zend_throw_non_object_error",\
"zend_throw_unwind_exit",\
"ZEND_TICKS_SPEC_HANDLER",\
"zend_timeout_handler",\
"zend_trace_to_string",\
"zend_try_compile_cv",\
"zend_try_ct_eval_binary_op",\
"zend_try_ct_eval_unary_op",\
"zend_type_error",\
"zend_undefined_index",\
"ZEND_UNSET_CV_SPEC_CV_UNUSED_HANDLER",\
"ZEND_UNSET_DIM_SPEC_CV_CONST_HANDLER",\
"ZEND_UNSET_DIM_SPEC_CV_CV_HANDLER",\
"ZEND_UNSET_DIM_SPEC_CV_TMPVAR_HANDLER",\
"ZEND_UNSET_DIM_SPEC_VAR_CONST_HANDLER",\
"ZEND_UNSET_DIM_SPEC_VAR_CV_HANDLER",\
"ZEND_UNSET_DIM_SPEC_VAR_TMPVAR_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_CV_CONST_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_CV_CV_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_CV_TMPVAR_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_UNUSED_CONST_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_UNUSED_CV_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_UNUSED_TMPVAR_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_VAR_CONST_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_VAR_CV_HANDLER",\
"ZEND_UNSET_OBJ_SPEC_VAR_TMPVAR_HANDLER",\
"zend_unset_property",\
"ZEND_UNSET_VAR_SPEC_CV_UNUSED_HANDLER",\
"zend_update_class_constant",\
"zend_update_class_constants",\
"zend_update_property_ex",\
"zend_update_property_long",\
"zend_update_property_str",\
"zend_update_property_string",\
"zend_update_property",\
"zend_use_new_element_for_string",\
"zend_use_tmp_in_write_context_helper_SPEC",\
"zend_use_undef_in_read_context_helper_SPEC",\
"zend_user_it_get_current_data",\
"zend_user_it_get_new_iterator",\
"ZEND_USER_OPCODE_SPEC_HANDLER",\
"ZEND_INCLUDE_OR_EVAL_SPEC_CONST_HANDLER",\
"ZEND_INCLUDE_OR_EVAL_SPEC_TMPVAR_HANDLER",\
"zend_value_error",\
"zend_verify_ref_array_assignable",\
"zend_vm_stack_extend",\
"zend_vspprintf",\
"zend_vstrpprintf",\
"zend_wrong_assign_to_variable_reference",\
"zend_wrong_clone_call",\
"zend_wrong_property_read",\
"ZEND_YIELD_FROM_SPEC_CV_HANDLER",\
"ZEND_YIELD_FROM_SPEC_TMPVAR_HANDLER",\
"zendi_smart_streq",\
"zendi_try_get_long",\
"zif_array_filter",\
"zif_array_map",\
"zif_array_product",\
"zif_array_reduce",\
"zif_array_sum",\
"zif_array_unique",\
"zif_cal_days_in_month",\
"zif_cal_from_jd",\
"zif_cal_to_jd",\
"zif_call_user_func_array",\
"zif_call_user_func",\
"zif_chmod",\
"zif_count",\
"zif_curl_exec",\
"zif_curl_multi_exec",\
"zif_curl_multi_select",\
"zif_current",\
"zif_debug_print_backtrace",\
"zif_define",\
"zif_end",\
"zif_exec",\
"zif_exif_imagetype",\
"zif_exif_read_data",\
"zif_exif_thumbnail",\
"zif_fclose",\
"zif_feof",\
"zif_file_get_contents",\
"zif_file_put_contents",\
"zif_fopen",\
"zif_fread",\
"zif_fsockopen",\
"zif_fwrite",\
"zif_gc_collect_cycles",\
"zif_get_mangled_object_vars",\
"zif_get_object_vars",\
"zif_getenv",\
"zif_getimagesize",\
"zif_hash_copy",\
"zif_hash_final",\
"zif_hash_hkdf",\
"zif_hash_init",\
"zif_hash_pbkdf2",\
"zif_hash_update_file",\
"zif_hash_update_stream",\
"zif_hash_update",\
"zif_http_build_query",\
"zif_iterator_apply",\
"zif_iterator_count",\
"zif_json_encode",\
"zif_key",\
"zif_lcg_value",\
"zif_method_exists",\
"zif_mysqli_begin_transaction",\
"zif_mysqli_connect",\
"zif_mysqli_data_seek",\
"zif_mysqli_errno",\
"zif_mysqli_error",\
"zif_mysqli_fetch_fields",\
"zif_mysqli_fetch_object",\
"zif_mysqli_fetch_row",\
"zif_mysqli_get_charset",\
"zif_mysqli_link_construct",\
"zif_mysqli_multi_query",\
"zif_mysqli_next_result",\
"zif_mysqli_ping",\
"zif_mysqli_prepare",\
"zif_mysqli_query",\
"zif_mysqli_real_connect",\
"zif_mysqli_reap_async_query",\
"zif_mysqli_select_db",\
"zif_mysqli_set_charset",\
"zif_mysqli_stmt_execute",\
"zif_mysqli_stmt_fetch",\
"zif_next",\
"zif_passthru",\
"zif_phar_file_get_contents",\
"zif_phar_fopen",\
"zif_popen",\
"zif_post_message_to_js",\
"zif_preg_replace_callback",\
"zif_prev",\
"zif_proc_close",\
"zif_proc_open",\
"zif_property_exists",\
"zif_rand",\
"zif_rename",\
"zif_reset",\
"zif_shell_exec",\
"zif_sleep",\
"zif_spl_autoload_call",\
"zif_spl_autoload",\
"zif_str_shuffle",\
"zif_stream_get_contents",\
"zif_stream_resolve_include_path",\
"zif_stream_select",\
"zif_stream_socket_client",\
"zif_stream_socket_enable_crypto",\
"zif_system",\
"zif_touch",\
"zif_unlink",\
"zif_wasm_popen",\
"zim_AppendIterator_append",\
"zim_AppendIterator_current",\
"zim_AppendIterator_next",\
"zim_AppendIterator_rewind",\
"zim_CachingIterator_hasNext",\
"zim_CachingIterator_rewind",\
"zim_DateInterval___wakeup",\
"zim_DatePeriod___wakeup",\
"zim_DateTime___wakeup",\
"zim_DateTimeImmutable___wakeup",\
"zim_DateTimeZone___wakeup",\
"zim_FilterIterator_next",\
"zim_FilterIterator_rewind",\
"zim_HashContext___serialize",\
"zim_HashContext___unserialize",\
"zim_mysqli___construct",\
"zim_mysqli_result___construct",\
"zim_mysqli_stmt___construct",\
"zim_NoRewindIterator_current",\
"zim_NoRewindIterator_key",\
"zim_NoRewindIterator_next",\
"zim_NoRewindIterator_valid",\
"zim_PDO___construct",\
"zim_PDO_beginTransaction",\
"zim_PDO_commit",\
"zim_PDO_commitTransaction",\
"zim_PDO_dbh_constructor",\
"zim_PDO_errorInfo",\
"zim_PDO_exec",\
"zim_PDO_getAttribute",\
"zim_PDO_inTransaction",\
"zim_PDO_lastInsertId",\
"zim_PDO_prepare",\
"zim_PDO_query",\
"zim_PDO_quote",\
"zim_PDO_rollBack",\
"zim_PDOStatement_closeCursor",\
"zim_PDOStatement_errorInfo",\
"zim_PDOStatement_execute",\
"zim_PDOStatement_fetch",\
"zim_PDOStatement_fetchAll",\
"zim_PDOStatement_getAttribute",\
"zim_PDOStatement_getColumnMeta",\
"zim_PDOStatement_setAttribute",\
"zim_reflection_class_newInstanceArgs",\
"zim_reflection_method_invoke",\
"zim_reflection_method_invokeArgs",\
"zim_ReflectionClass_newInstanceArgs",\
"zim_ReflectionMethod_invoke",\
"zim_ReflectionMethod_invokeArgs",\
"zim_SessionHandler_create_sid",\
"zim_SessionHandler_destroy",\
"zim_SessionHandler_gc",\
"zim_SessionHandler_read",\
"zim_SessionHandler_write",\
"zim_SplObjectStorage___debugInfo",\
"zim_sqlite3_backup",\
"zim_SQLite3_backup",\
"zim_SQLite3_exec",\
"zim_sqlite3_exec",\
"zim_sqlite3_query",\
"zim_sqlite3_querySingle",\
"zim_sqlite3result_fetchArray",\
"php_cli_startup",\
"php_stdiop_close",\
"zend_parse_ini_file",\
"php_embed_startup",\
"zip_source_file_common_new",\
"zip_source_function_create",\
"zip_source_layered_create",\
"zm_startup_basic",\
"zm_startup_core",\
"zm_startup_date",\
"zm_startup_dir",\
"zm_startup_hash",\
"zm_startup_json",\
"zm_startup_mysqli",\
"zm_startup_password",\
"zm_startup_pdo",\
"zm_startup_random",\
"zm_startup_reflection",\
"zm_startup_session",\
"zm_startup_spl_array",\
"zm_startup_spl_directory",\
"zm_startup_spl_dllist",\
"zm_startup_spl_exceptions",\
"zm_startup_spl_fixedarray",\
"zm_startup_spl_heap",\
"zm_startup_spl_iterators",\
"zm_startup_spl_observer",\
"zm_startup_sqlite3",\
"zm_startup_tokenizer",\
"zm_startup_user_filters",\
"zm_startup_zlib",\
"zval_copy_ctor_func",\
"zval_get_double_func",\
"zval_get_long_func",\
"zval_get_string_func",\
"zval_make_interned_string",\
"zval_ptr_dtor",\
"zval_try_get_string_func",\
"zval_undefined_cv",\
"zval_update_constant_ex"';\
	# If pointer casts are enabled, we need to asyncify both the prefixed and unprefixed names
	if [ "${PHP_VERSION:0:1}" -lt "8" ]; then \
		export ASYNCIFY_ONLY="$ASYNCIFY_ONLY_UNPREFIXED,"$(echo "$ASYNCIFY_ONLY_UNPREFIXED" | sed -E $'s/"([a-zA-Z])/"byn$fpcast-emu$\\1/g'); \
	else \
		export ASYNCIFY_ONLY="$ASYNCIFY_ONLY_UNPREFIXED"; \
	fi; \

	echo -n ' -s ASYNCIFY_ONLY=['$ASYNCIFY_ONLY'] '| tr -d "\n" >> /root/.emcc-php-asyncify-flags;

# Build the final .wasm file
RUN mkdir /root/output
COPY ./php/phpwasm-emscripten-library.js /root/phpwasm-emscripten-library.js
COPY ./php/phpwasm-emscripten-library-dynamic-linking.js /root/phpwasm-emscripten-library-dynamic-linking.js
COPY ./php/phpwasm-emscripten-library-file-locking-for-node.js /root/phpwasm-emscripten-library-file-locking-for-node.js
COPY ./php/phpwasm-emscripten-library-known-undefined-functions.js /root/phpwasm-emscripten-library-known-undefined-functions.js
ARG WITH_SOURCEMAPS
ARG WITH_DEBUG
ARG STACK_SIZE
RUN set -euxo pipefail; \
	mkdir -p /build/output; \
	source /root/emsdk/emsdk_env.sh; \
	if [ "$WITH_JSPI" = "yes" ]; then \
		# Both imports and exports are required for inter-module communication with wrapped methods, e.g., wasm_recv.
		export JSPI_ADD_IMPORTS=""; \
		export JSPI_ADD_EXPORTS=""; \
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			export JSPI_ADD_IMPORTS=",fd_close"; \
			export JSPI_ADD_EXPORTS=",fd_close"; \
		fi; \
		export ASYNCIFY_FLAGS=" -s ASYNCIFY=2 -sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI_IMPORTS=js_open_process,js_fd_read,js_waitpid,js_process_status,js_create_input_device,wasm_setsockopt,wasm_shutdown,wasm_close,wasm_recv,__syscall_fcntl64,js_flock,js_release_file_locks,js_waitpid$JSPI_ADD_IMPORTS -sJSPI_EXPORTS=php_wasm_init,wasm_sleep,wasm_read,emscripten_sleep,wasm_sapi_handle_request,wasm_sapi_request_shutdown,wasm_poll_socket,wrap_select,__wrap_select,select,php_pollfd_for,fflush,wasm_popen,wasm_read,wasm_php_exec,run_cli,wasm_recv$JSPI_ADD_EXPORTS -s EXTRA_EXPORTED_RUNTIME_METHODS=ccall,PROXYFS,wasmExports,_malloc,setErrNo "; \
		echo '#define PLAYGROUND_JSPI 1' > /root/php_wasm_asyncify.h; \
	else \
		export ASYNCIFY_FLAGS=" -s ASYNCIFY=1 -s ASYNCIFY_IGNORE_INDIRECT=1 -s EXPORTED_RUNTIME_METHODS=ccall,PROXYFS,wasmExports,setErrNo $(cat /root/.emcc-php-asyncify-flags)  "; \
		echo '' > /root/php_wasm_asyncify.h; \
	fi; \
	export EXPORTED_FUNCTIONS=$'["_exit", \n\
"UTF8ToString", \n\
"stringToUTF8", \n\
"lengthBytesUTF8", \n\
"FS", \n\
"___wrap_select", \n\
"_wasm_set_sapi_name", \n\
"_php_wasm_init", \n\
"_emscripten_sleep", \n\
"_wasm_sleep", \n\
"_wasm_set_phpini_path", \n\
"_wasm_add_SERVER_entry", \n\
"_wasm_add_ENV_entry", \n\
"_wasm_read", \n\
"_wasm_free", \n\
"_wasm_sapi_handle_request", \n\
"_wasm_sapi_request_shutdown", \n\
"_wasm_set_content_length", \n\
"_wasm_set_content_type", \n\
"_wasm_set_cookies", \n\
"_wasm_set_path_translated", \n\
"_wasm_set_query_string", \n\
"_wasm_set_request_body", \n\
"_wasm_set_request_host", \n\
"_wasm_set_request_method", \n\
"_wasm_set_request_port", \n\
"_wasm_set_request_uri", \n\
"_wasm_set_skip_shebang" '"$(cat /root/.EXPORTED_FUNCTIONS)"']'; \
	export OPTIMIZATION_FLAGS="-O3"; \
	if [ "${WITH_SOURCEMAPS}" = "yes" ] || [ "${WITH_DEBUG}" = "yes" ]; then \
		export OPTIMIZATION_FLAGS="-O0"; \
	fi; \
	PLATFORM_SPECIFIC_ARGS=''; \
	if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
		PLATFORM_SPECIFIC_ARGS="$PLATFORM_SPECIFIC_ARGS -DPHP_WASM_FILE_LOCKING_SUPPORT=1"; \
		PLATFORM_SPECIFIC_ARGS="$PLATFORM_SPECIFIC_ARGS --js-library /root/phpwasm-emscripten-library-dynamic-linking.js"; \
		PLATFORM_SPECIFIC_ARGS="$PLATFORM_SPECIFIC_ARGS --js-library /root/phpwasm-emscripten-library-file-locking-for-node.js -Wl,--wrap=getpid"; \
		PLATFORM_SPECIFIC_ARGS="$PLATFORM_SPECIFIC_ARGS -s MAIN_MODULE"; \
	fi; \
	emcc $OPTIMIZATION_FLAGS \
	--js-library /root/phpwasm-emscripten-library.js \
	--js-library /root/phpwasm-emscripten-library-known-undefined-functions.js \
	$PLATFORM_SPECIFIC_ARGS \
	-I .  \
	-I ext   \
	-I ext/json   \
	-I Zend  \
	-I main  \
	-I TSRM/ \
	-I/root/lib -I/root/lib/include \
	-L/root/lib -L/root/lib/lib/ \
	-D__x86_64__\
	-lproxyfs.js \
	$ASYNCIFY_FLAGS \
	$(cat /root/.emcc-php-wasm-flags) \
	-s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
	-s WASM_BIGINT=1 \
	-s MIN_NODE_VERSION=200900 \
	-s INITIAL_MEMORY=1024MB \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s STACK_SIZE="$STACK_SIZE" \
	-s ASSERTIONS=0 \
	-s ERROR_ON_UNDEFINED_SYMBOLS=1 \
	-s NODEJS_CATCH_EXIT=0 \
	-s NODEJS_CATCH_REJECTION=0 \
	-s INVOKE_RUN=0 \
	-o /build/output/php.js \
	-s EXIT_RUNTIME=1 \
	-Wl,--wrap=select \
	-Wl,--wrap=usleep \
		/root/lib/libphp.a \
		/root/proc_open.c \
		/root/php_wasm.c \
		$(cat /root/.emcc-php-wasm-sources) \
	-s ENVIRONMENT=$EMSCRIPTEN_ENVIRONMENT \
	-s FORCE_FILESYSTEM=1 \
	-s EXPORT_NAME="'PHPLoader'"
	# Emscripten complains it can't find some Asyncify functions
	# listed in ASYNCIFY_IMPORTS. The culprit is those functions
	# are actually used and delisting them breaks php_pollfd_for().
	# Sooo... just ignore Emscripten's warnings.

# # At the moment terminfo is baked into the repository in
# # src/php-cli/terminfo, but if we ever need to update it, we can
# # use the terminfo database produced by the ncurses make script:
# RUN if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
#         mkdir -p /root/output/terminfo/x && \
#         cp -v /root/lib/share/terminfo/x/xterm* /root/output/terminfo/x/; \
#     fi

# Postprocess the build php.js module:
COPY ./php/esm-node-boilerplate.js /root/esm-node-boilerplate.js
COPY ./php/esm-prefix.js /root/esm-prefix.js
COPY ./php/esm-suffix.js /root/esm-suffix.js
RUN set -euxo pipefail; \
	cp -rfv /build/output/* /root/output/; \
	# Figure out the target file names and URLs
		# The .js and .wasm filenames should reflect the build configuration, e.g.:
		# * `php-7.4.node.js` and `php-7.4.node.wasm`
		# * `php-8.0.js` and `php-8.0.wasm`
		# In addition, the `.wasm` file URL should have a "cache busting" query string on the
		# web, so that web browsers will reload it when the file contents change.
	# Precompute export variables:
		export FILE_SIZE=$(stat -c%s "/root/output/php.wasm") && \
		export PHP_VERSION_ESCAPED="${PHP_VERSION//./_}" && \
		export FILENAME_PREFIX="php_${PHP_VERSION_ESCAPED:0:3}"; \
		export EXT_PREFIX=""; \
		export JS_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.js"; \
		export WASM_FILENAME="${FILENAME_PREFIX}${EXT_PREFIX}.wasm"; \
	# Make the php.wasm URL configurable via the dependencyFilename loader argument:
		/root/replace.sh $'s/["\']php\.wasm[\'"]/dependencyFilename/g' /root/output/php.js; \
	# Patch a "property undefined" error
		# Emscripten produces an if that checks a stream.stream_ops.poll property. However,
		# stream.stream_ops is sometimes undefined and the check fails. Let's adjust it to
		# tolerate a null stream.stream_ops value.
		/root/replace.sh "s/if\s*\(stream\.stream_ops\.poll\)/if (stream.stream_ops?.poll)/g" /root/output/php.js; \
	# Emscripten allows only directories to be mounted, but in Playground we support mounting files, directories, and symlinks.
		# For file mounting to work, we need to remove the directory check.
		/root/replace-across-lines.sh 's/(\s*)if\s*\(\s*!FS\.isDir\(node\.mode\)\s*\)\s*\{\s*throw\s*new\s*FS\.ErrnoError\(54\)\s*;?\s*\}(\s*)/$1$2/s' /root/output/php.js; \
	# Make Emscripten websockets configurable
		# Emscripten makes the Websocket proxy connect to a fixed URL.
		# This assumes the traffic is always forwarded to the same target.
		# However, we want to support arbitrary targets, so we need to
		# replace the hardcoded websocket target URL with a dynamic callback.
		/root/replace.sh $'s/if\s*\(\s*SOCKFS\.websocketArgs\[[\'"]url[\'"]\]\s*\)/if("function"===typeof SOCKFS.websocketArgs["url"]) {\nurl = SOCKFS.websocketArgs["url"](...arguments);\n}else if ("string" === typeof SOCKFS.websocketArgs["url"])/g' \
			/root/output/php.js; \
		# Enable custom WebSocket constructors to support socket options.
		/root/replace.sh "s/ws\s*=\s*new WebSocketConstructor/if (Module['websocket']['decorator']) {WebSocketConstructor = Module['websocket']['decorator'](WebSocketConstructor);}ws = new WebSocketConstructor/g" /root/output/php.js && \
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			if [ "$WITH_WS_NETWORKING_PROXY" = "yes" ]; then \
				/root/replace.sh "s/sock\.server\s*=\s*new WebSocketServer/if (Module['websocket']['serverDecorator']) {WebSocketServer = Module['websocket']['serverDecorator'](WebSocketServer);}sock.server = new WebSocketServer/g" /root/output/php.js; \
			fi; \
		fi; \
		# PIPEFS: return 0 (success) instead of 6 (EWOULDBLOCK) when reached end of data
		# and the other end of the pipe is closed.
		/root/replace-across-lines.sh 's/if\s*\(\s*currentLength\s*==\s*0\s*\)\s*\{.{0,200}throw new FS.ErrnoError\(\s*6\s*\)/if(currentLength==0){if(pipe.refcnt<2){return 0;}throw new FS.ErrnoError(6)/sg' /root/output/php.js; \
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
			/root/replace.sh 's/sock\.sock_ops\.recvmsg\(sock,\s*len\);/sock.sock_ops.recvmsg(sock, len, typeof flags !== "undefined" ? flags : 0);/g' /root/output/php.js; \
			/root/replace.sh 's/recvmsg\(sock,\s*length\)\s*{/recvmsg(sock, length, flags) {/g' /root/output/php.js; \
			/root/replace.sh 's/if\s*\(sock\.type\s*===\s*1\s*&&\s*bytesRead\s*<\s*queuedLength\)/if (flags&2) {bytesRead = 0;} if (sock.type === 1 && bytesRead < queuedLength)/g' /root/output/php.js; \
		fi ; \
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
		/root/replace.sh $'s/ENVIRONMENT_IS_([A-Z]+)\s*=\s*(true|false)/ENVIRONMENT_IS_$1=RuntimeName==="$1"/g' /root/output/php.js; \
		/root/replace.sh 's/var ENV\s*=\s*\{/var ENV = PHPLoader.ENV || {/g' /root/output/php.js; \
	# Patch Emscripten exit status to include a stack trace
		# Override Emscripten's default ExitStatus class which gets
		# thrown on failure. Unfortunately, the default object is not
		# a subclass of Error and does not provide any stack trace.
		#
		# This is a deliberate behavior on Emscripten's end to prevent
		# memory leaks after the program exits. See:
		#
		# https://github.com/emscripten-core/emscripten/pull/9108
		#
		# In case of WordPress Playground, the worker in which the PHP
		# runs will typically exit after the PHP program finishes, so
		# we don't have to worry about memory leaks.
		/root/replace-across-lines.sh "s/(class\\s+ExitStatus\\s*{\\s*name\\s*=\\s*['\"]ExitStatus['\"];\\s*constructor\\s*\(\\s*status\\s*\)\\s*{\\s*this\\.message\\s*=\\s*\`Program terminated with exit\(\\\${status}\)\`;\s*this\\.status\\s*=\\s*status;?\\s*}\\s*})/\$1\nExitStatus = class PHPExitStatus extends Error {\n	constructor\(status\) {\n		super\(status\);\n		this.name = 'ExitStatus';\n		this.message = 'Program terminated with exit\(' + status + '\)';\n		this.status = status;\n	}\n};/" /root/output/php.js; \
	# Restore quit handling to Emscripten
		# Quit callback customization was removed from Emscripten by:
		# https://github.com/emscripten-core/emscripten/pull/22371
		# But the alternative `onExit()` handling is conditional and has different semantics.
		# To avoid bugs due to this change, let's just restore support for quit callback customization.
		/root/replace.sh "s/(if\s*\(Module\[['\"]thisProgram['\"]\]\)\s*thisProgram\s*=\s*Module\[['\"]thisProgram['\"]\];)/\$1\nif (Module[\"quit\"]) quit_=Module[\"quit\"];/" /root/output/php.js; \
	# Node.js: Add __dirname declaration and create a require() function
	# because Emscripten generates Node.js code that requires them.
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			cat /root/esm-node-boilerplate.js >> /root/output/php-module.js; \
		fi; \
	# Turn the php.js file into an ES module
		# Manually turn the output into a esm module instead of relying on -s MODULARIZE=1.
		# which pollutes the global namespace and does not play well with import() mechanics.
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			echo "const dependencyFilename = path.join(__dirname, '${PHP_VERSION_ESCAPED}', '$WASM_FILENAME');" >> /root/output/php-module.js;\
		else \
			echo "import dependencyFilename from './${PHP_VERSION_ESCAPED}/$WASM_FILENAME'; " >> /root/output/php-module.js; \
		fi; \
		echo "export { dependencyFilename }; " >> /root/output/php-module.js && \
		echo "export const dependenciesTotalSize = $FILE_SIZE; " >> /root/output/php-module.js && \
		echo "const phpVersionString = '$PHP_VERSION';" >> /root/output/php-module.js && \
		cat /root/esm-prefix.js >> /root/output/php-module.js && \
		cat /root/output/php.js >> /root/output/php-module.js && \
		cat /root/esm-suffix.js >> /root/output/php-module.js && \
		\
		# Remove the old php.js file
		rm /root/output/php.js && \
		\
		# Rename the build files to their final names
		mv /root/output/php-module.js "/root/output/$JS_FILENAME"; \
		mkdir -p /root/output/${PHP_VERSION_ESCAPED}/; \
		mv /root/output/php.wasm "/root/output/${PHP_VERSION_ESCAPED}/$WASM_FILENAME"; \
		if [ "${WITH_SOURCEMAPS}" = "yes" ]; then \
			# Make the source map paths relative to the .wasm file, not the build directory
			sed -i 's#"\.\./\.\./root/#"#g' /root/output/php.wasm.map; \
			mv /root/output/php.wasm.map "/root/output/${PHP_VERSION_ESCAPED}/php.wasm.map"; \
		fi; \
		if [ "${WITH_SOURCEMAPS}" = "yes" ] || [ "${WITH_DEBUG}" = "yes" ]; then \
			# Make PHP source available for use with step debugger
			rm -rf /root/php-src/.git; \
			cp -r /root/php-src /root/output/"${PHP_VERSION_ESCAPED}"/php-src; \
			# Copy emscripten source files
			mkdir -p /root/output/"${PHP_VERSION_ESCAPED}"/emscripten; \
			cp -r /root/emsdk/upstream/emscripten/cache /root/output/"${PHP_VERSION_ESCAPED}"/emscripten/; \
			cp -r /root/emsdk/upstream/emscripten/system /root/output/"${PHP_VERSION_ESCAPED}"/emscripten/; \
		fi;
