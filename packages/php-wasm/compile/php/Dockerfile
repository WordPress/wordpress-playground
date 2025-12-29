FROM playground-php-wasm:base

ARG WITH_JSPI="no"
ENV PKG_CONFIG_PATH=/root/lib/lib/pkgconfig
ENV PATH="/root/lib/bin:${PATH}"

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

# Clone PHP from a tag [ php-$PHP_VERSION ] instead of a branch [ PHP-$PHP_VERSION ]
RUN git clone https://github.com/php/php-src.git php-src \
	--branch php-$PHP_VERSION \
	--single-branch  \
	--depth 1;

# Work around memory leak due to PHP using Emscripten's incomplete mmap/munmap support
COPY ./php-wasm-memory-storage /root/php-src/ext/wasm_memory_storage

# Polyfill for dns functions
COPY ./php-wasm-dns-polyfill/ /root/php-src/ext/dns_polyfill

# Polyfill for post_message_to_js functions
COPY ./php-post-message-to-js/ /root/php-src/ext/post_message_to_js

# Copy the opcache_module.c and php_opcache.h files.
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
COPY ./libImageMagick/ /root/builds/libImageMagick
COPY ./libgd/ /root/builds/libgd

RUN if [ "$WITH_JSPI" = "yes" ]; then \
	find /root/builds -path '*/jspi/dist/root/lib' -type d -exec cp -r {}/. /root/lib \; ; \
else \
	find /root/builds -path '*/asyncify/dist/root/lib' -type d -exec cp -r {}/. /root/lib \; ; \
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
		if [[ "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -ge "4" ]]; then \
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
		# Add the opcache_module.c to the list of files to build for PHP < 8.5.0.
		# PHP 8.5 made OPcache a non-optional part of PHP https://wiki.php.net/rfc/make_opcache_required
		if [[ "${PHP_VERSION:0:1}" -lt "8" || ("${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -le "4") ]]; then \
			/root/replace.sh 's/shared_alloc_mmap.c/shared_alloc_mmap.c opcache_module.c/g' /root/php-src/ext/opcache/config.m4; \
		fi; \
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
ARG WITH_SOAP
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
ARG WITH_IMAGICK

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
		fi; \
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

# Add SOAP if needed (requires libxml)
RUN if [ "$WITH_SOAP" = "yes" ]; \
	then \
		echo -n ' --enable-soap' >> /root/.php-configure-flags; \
	else \
		echo -n ' --disable-soap' >> /root/.php-configure-flags; \
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
		# Use external libgd for PHP 8.1+; fall back to bundled gd for <= 8.0 (and 7.x) to avoid missing symbols
		if [[ "${PHP_VERSION:0:1}" -gt "8" || ( "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -ge "1" ) ]]; then \
			echo -n ' --with-external-gd=/root/lib --enable-gd  ' >> /root/.php-configure-flags; \
			echo -n ' /root/lib/lib/libgd.a /root/lib/lib/libjpeg.a /root/lib/lib/libpng16.a /root/lib/lib/libwebp.a /root/lib/lib/libsharpyuv.a /root/lib/lib/libavif.a ' >> /root/.emcc-php-wasm-sources; \
			if [[ "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -ge "1" ]]; then \
				echo -n ' --with-avif ' >> /root/.php-configure-flags; \
			fi; \
		else \
			# Bundled gd for PHP 7.x and 8.0
			echo -n ' --enable-gd ' >> /root/.php-configure-flags; \
			if [[ "${PHP_VERSION:0:1}" -eq "7" ]] && [ "${PHP_VERSION:0:3}" != "7.4" ]; then \
				# PHP 7.0 – 7.3 need older-style flags
				echo -n ' --with-png-dir=/root/lib --with-jpeg-dir=/root/lib --with-gd ' >> /root/.php-configure-flags; \
			fi; \
			if [[ "${PHP_VERSION:0:1}" -le "7" && "${PHP_VERSION:2:1}" -le "4" ]]; then \
				/root/replace.sh 's/static long php_jpeg_emit_message/static void php_jpeg_emit_message/g' /root/php-src/ext/gd/libgd/gd_jpeg.c; \
				sed -i '84s/.*return 1;.*//' /root/php-src/ext/gd/libgd/gd_jpeg.c; \
				/root/replace.sh 's/cinfo.err->emit_message = \(void \(*\)\(j_common_ptr,int\)\) php_jpeg_emit_message;/cinfo.err->emit_message = php_jpeg_emit_message;/g' /root/php-src/ext/gd/libgd/gd_jpeg.c; \
			fi; \
			echo -n ' /root/lib/lib/libjpeg.a /root/lib/lib/libpng16.a /root/lib/lib/libwebp.a /root/lib/lib/libsharpyuv.a ' >> /root/.emcc-php-wasm-sources; \
		fi; \
		echo -n ' --with-png-dir=/root/lib --with-jpeg --with-webp ' >> /root/.php-configure-flags; \
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
	if [[ "${PHP_VERSION:0:3}" == "7.3" || "${PHP_VERSION:0:3}" == "7.2" ]]; then \
		# Emscripten >= 4.0.19 Does not tolerate implicit declarations of strcmp/strchr/memcpy with clang >= C99.
		# Let's backfill the required includes.
		sed -i '1i#include <string.h>' /root/php-src/ext/mbstring/libmbfl/filters/mbfilter_htmlent.c; \
		sed -i '1i#include <string.h>' /root/php-src/ext/mbstring/libmbfl/mbfl/mbfilter.c; \
		sed -i '1i#include <stdlib.h>' /root/php-src/ext/mbstring/libmbfl/mbfl/mbfl_allocators.c; \
	fi && \
	chmod +x /root/apply-mysqlnd-patch.sh && \
	/root/apply-mysqlnd-patch.sh && \
	if [[ "${PHP_VERSION:0:3}" < '8.3' ]]; then \
		git apply --no-index /root/php-chunk-alloc-zend-assert-up-to-8.2.patch -v; \
	elif [[ "${PHP_VERSION:0:3}" == '8.3' ]]; then \
		git apply --no-index /root/php-chunk-alloc-zend-assert-8.3.patch -v; \
	elif [[ "${PHP_VERSION:0:3}" == '8.4' ]]; then \
		git apply --no-index /root/php-chunk-alloc-zend-assert-8.4.patch -v; \
	elif [[ "${PHP_VERSION:0:3}" == '8.5' ]]; then \
		git apply --no-index /root/php-chunk-alloc-zend-assert-8.5.patch -v; \
	fi && \
	touch php-src/patched

# Install Mysql support if needed
RUN if [ "$WITH_MYSQL" = "yes" ]; then \
		echo -n ' --enable-mysql --enable-pdo --with-mysql=mysqlnd --with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd ' >> /root/.php-configure-flags; \
		echo -n ' -DMYSQLND_FORCE_TCP_LOCALHOST ' >> /root/.emcc-php-wasm-flags; \
	fi

# Download and prepare imagick extension if needed (PHP 7.2+)
# Use version 3.7.0 for PHP 7.x, master for PHP 8.x
RUN 	if [ "${PHP_VERSION:0:1}" -eq "7" ]; then \
			IMAGICK_BRANCH="3.7.0"; \
		else \
			IMAGICK_BRANCH="master"; \
		fi && \
		git clone https://github.com/Imagick/imagick.git /root/imagick \
			--branch "$IMAGICK_BRANCH" \
			--single-branch \
			--depth 1 && \
		cp -r /root/imagick /root/php-src/ext/imagick && \
		cd /root/php-src && \
		if [ "${PHP_VERSION:0:1}" -eq "7" ]; then \
			cp configure configure.backup && \
			./buildconf --force && \
			(/root/replace.sh 's/char xmlInitParser/void xmlInitParser/g' configure || true) && \
			(/root/replace.sh 's/\$PKG_CONFIG --atleast-version 7.\d+.\d+ \$PKNAME/test "1" = "1"/g' configure || true) && \
			(/root/replace.sh 's/test "\$curl_version" -ge 7010005/test "1" = "1"/g' configure || true) && \
			perl -pi.bak -e 's/ret = read/ret = wasm_read/g' configure; \
		else \
			./buildconf --force; \
		fi && \
		echo -n ' --with-imagick=/root/lib --with-imagick-config=/root/lib/bin/wasm32-unknown-emscripten-MagickWand-config ' >> /root/.php-configure-flags && \
		echo -n ' /root/lib/lib/libMagickWand-7.Q16HDRI.a /root/lib/lib/libMagickCore-7.Q16HDRI.a ' >> /root/.emcc-php-wasm-sources

# Disable phar.php generation for all builds (WASM binaries can't execute during build)
# This must run after buildconf but before configure
RUN /root/replace.sh 's/pharcmd=pharcmd/pharcmd=/g' /root/php-src/configure && \
	/root/replace.sh 's/pharcmd_install=install-pharcmd/pharcmd_install=/g' /root/php-src/configure

# Build the patched PHP
WORKDIR /root/php-src
RUN source /root/emsdk/emsdk_env.sh && \
	ICU_CFLAGS="-D__x86_64__ -fPIC -I/root/lib/include" \
	CURL_CFLAGS="-I/root/lib/include" \
	WEBP_LIBS="-L/root/lib/lib -lwebp -lsharpyuv" \
	WEBP_CFLAGS="-I/root/lib/include" \
	CURL_LIBS="-I/root/lib/lib -L/root/lib/lib" \
	JPEG_CFLAGS="-I/root/lib/include" \
	JPEG_LIBS="-L/root/lib/lib -ljpeg" \
	PNG_CFLAGS="-I/root/lib/include" \
	PNG_LIBS="-L/root/lib/lib -lpng16 -lz" \
	AVIF_CFLAGS="-I/root/lib/include" \
	AVIF_LIBS="-L/root/lib/lib -lavif" \
	GDLIB_CFLAGS="-I/root/lib/include" \
	GDLIB_LIBS="-L/root/lib/lib -lgd -lpng16 -lz -ljpeg -lwebp -lsharpyuv -lavif" \
	PKG_CONFIG_PATH="/root/lib/lib/pkgconfig:${PKG_CONFIG_PATH}" \
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

# Force GD JPEG/PNG/WebP/AVIF support for external GD builds (PHP 8.1+)
# Configure checks may fail during cross-compilation, so we explicitly enable them
# after verifying the external libgd was built with these features.
RUN if [ "$WITH_GD" = "yes" ]; then \
	if [[ "${PHP_VERSION:0:1}" -gt "8" || ( "${PHP_VERSION:0:1}" -eq "8" && "${PHP_VERSION:2:1}" -ge "1" ) ]]; then \
		echo '/* Force GD format support for external libgd */' >> /root/php-src/main/php_config.h; \
		echo '#ifndef HAVE_GD_JPG' >> /root/php-src/main/php_config.h; \
		echo '#define HAVE_GD_JPG 1' >> /root/php-src/main/php_config.h; \
		echo '#endif' >> /root/php-src/main/php_config.h; \
		echo '#ifndef HAVE_GD_PNG' >> /root/php-src/main/php_config.h; \
		echo '#define HAVE_GD_PNG 1' >> /root/php-src/main/php_config.h; \
		echo '#endif' >> /root/php-src/main/php_config.h; \
		echo '#ifndef HAVE_GD_WEBP' >> /root/php-src/main/php_config.h; \
		echo '#define HAVE_GD_WEBP 1' >> /root/php-src/main/php_config.h; \
		echo '#endif' >> /root/php-src/main/php_config.h; \
		echo '#ifndef HAVE_GD_AVIF' >> /root/php-src/main/php_config.h; \
		echo '#define HAVE_GD_AVIF 1' >> /root/php-src/main/php_config.h; \
		echo '#endif' >> /root/php-src/main/php_config.h; \
	fi; \
fi;

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
	emmake make -j14

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
COPY ./php/asyncify-imports.list /root/asyncify-imports.list
RUN sed 's/.*/"&",/' /root/asyncify-imports.list \
    | sed '$ s/,$//' \
    | sed '1s/^/[\n/; $s/$/\n]/' \
    | tr -d "\n" \
    | sed 's/^/ -s ASYNCIFY_IMPORTS=/' \
    >> /root/.emcc-php-asyncify-flags

COPY ./php/asyncify-only.list /root/asyncify-only.list
RUN sed 's/.*/"&",/' /root/asyncify-only.list \
    | sed '$ s/,$//' \
    | sed '1s/^/[\n/; $s/$/\n]/' \
    | tr -d "\n" \
    | sed 's/^/ -s ASYNCIFY_ONLY=/' \
    >> /root/.emcc-php-asyncify-flags

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
		export ASYNCIFY_FLAGS=" -s ASYNCIFY=2 -sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI_IMPORTS=js_open_process,js_fd_read,js_waitpid,js_process_status,js_create_input_device,wasm_setsockopt,wasm_shutdown,wasm_close,wasm_recv,__syscall_fcntl64,js_flock,js_release_file_locks,js_waitpid -sJSPI_EXPORTS=php_wasm_init,wasm_sleep,wasm_read,emscripten_sleep,wasm_sapi_handle_request,wasm_sapi_request_shutdown,wasm_poll_socket,wrap_select,__wrap_select,select,php_pollfd_for,fflush,wasm_popen,wasm_read,wasm_php_exec,run_cli,wasm_recv,__wasm_call_ctors,__errno_location,__funcs_on_exit -s EXPORTED_RUNTIME_METHODS=HEAPU32,HEAPU8,ccall,PROXYFS,wasmExports "; \
		echo '#define PLAYGROUND_JSPI 1' > /root/php_wasm_asyncify.h; \
	else \
		export ASYNCIFY_FLAGS=" -s ASYNCIFY=1 -s ASYNCIFY_IGNORE_INDIRECT=1 -s EXPORTED_RUNTIME_METHODS=HEAPU32,HEAPU8,ccall,PROXYFS,wasmExports $(cat /root/.emcc-php-asyncify-flags)  "; \
		echo '' > /root/php_wasm_asyncify.h; \
	fi; \
	export EXPORTED_FUNCTIONS=$'["_exit", \n\
"UTF8ToString", \n\
"stringToUTF8", \n\
"lengthBytesUTF8", \n\
"FS", \n\
"_malloc", \n\
"___errno_location", \n\
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
	ENVIRONMENT="$EMSCRIPTEN_ENVIRONMENT"; \
	if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
		PLATFORM_SPECIFIC_ARGS="$PLATFORM_SPECIFIC_ARGS -DPHP_WASM_FILE_LOCKING_SUPPORT=1"; \
		PLATFORM_SPECIFIC_ARGS="$PLATFORM_SPECIFIC_ARGS --js-library /root/phpwasm-emscripten-library-file-locking-for-node.js -Wl,--wrap=getpid"; \
	else \
		# Prevents "document is not defined" errors in Web Workers when using MAIN_MODULE.
		# By default, Emscripten assumes MAIN_MODULE runs only in a web environment,
		# so it injects WebGL and other browser-only APIs. Explicitly adding "worker"
		# ensures the runtime is compatible with Web Workers as well.
		ENVIRONMENT="$EMSCRIPTEN_ENVIRONMENT,worker"; \
	fi; \
	emcc $OPTIMIZATION_FLAGS \
	--js-library /root/phpwasm-emscripten-library.js \
	--js-library /root/phpwasm-emscripten-library-dynamic-linking.js \
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
	-s MAIN_MODULE=2 \
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
	-s ENVIRONMENT=$ENVIRONMENT \
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
		/root/replace.sh $'s/ENVIRONMENT_IS_([A-Z]+)\s*=[^;]*;/ENVIRONMENT_IS_$1=RuntimeName==="$1";/g' /root/output/php.js; \
		/root/replace.sh 's/var ENV\s*=\s*\{/var ENV = PHPLoader.ENV || {/g' /root/output/php.js; \
	# Expose required functions to the module.
		# Emscripten 4.0.10 removed the runtime exposure of `_malloc` and `_free`,
		# so we rebind them from `wasmExports` and attach them to PHPLoader.
		/root/replace.sh "s/_wasm_free\s*=\s*Module\[[\"']_wasm_free[\"']\]/_wasm_free = PHPLoader['free'] = Module['_wasm_free']/g" /root/output/php.js; \
		/root/replace.sh "s/_malloc\s*=\s*Module\[[\"']_malloc[\"']\]/_malloc = PHPLoader['malloc'] = Module['_malloc']/g" /root/output/php.js; \
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
	# Node.js: Create a require() function and add 'currentDirPath' declaration
	# because Emscripten generates Node.js code that requires them.
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			cat /root/esm-node-boilerplate.js >> /root/output/php-module.js; \
		fi; \
	# Turn the php.js file into an ES module
		# Manually turn the output into a esm module instead of relying on -s MODULARIZE=1.
		# which pollutes the global namespace and does not play well with import() mechanics.
		if [ "$EMSCRIPTEN_ENVIRONMENT" = "node" ]; then \
			echo "const dependencyFilename = path.join(currentDirPath, '${PHP_VERSION_ESCAPED}', '$WASM_FILENAME');" >> /root/output/php-module.js;\
			/root/replace.sh "s/scriptDirectory\s*=\s*__dirname/scriptDirectory = currentDirPath/" /root/output/php.js; \
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
