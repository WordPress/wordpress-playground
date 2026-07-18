#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=versions.env
source "$ROOT/versions.env"
PHP_VM_GENERATOR_VERSION=8.2
export SOURCE_DATE_EPOCH
export TZ=UTC
export LC_ALL=C

BUILD_DIR=${BUILD_DIR:-$ROOT/.build}
DIST_DIR=${DIST_DIR:-$ROOT/dist}
DOWNLOAD_DIR="$BUILD_DIR/downloads"
SOURCE_DIR="$BUILD_DIR/src"
PREFIX="$BUILD_DIR/prefix"
GENERATED_DIR="$BUILD_DIR/generated"
LOG_DIR="$BUILD_DIR/logs"
JOBS=${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '4')}
PHP_WASI_OPT_LEVEL=${PHP_WASI_OPT_LEVEL:-O2}
PHP_WASI_VM_KIND=${PHP_WASI_VM_KIND:-GOTO}
PHP_WASI_VARIANT=${PHP_WASI_VARIANT:-base}

case "$PHP_WASI_OPT_LEVEL" in
	O2|O3) ;;
	*)
		echo "PHP_WASI_OPT_LEVEL must be O2 or O3; got: $PHP_WASI_OPT_LEVEL" >&2
		exit 2
		;;
esac
case "$PHP_WASI_VM_KIND" in
	HYBRID|GOTO) ;;
	*)
		echo "PHP_WASI_VM_KIND must be HYBRID or GOTO; got: $PHP_WASI_VM_KIND" >&2
		exit 2
		;;
esac
case "$PHP_WASI_VARIANT" in
	base)
		if [[ "$PHP_SERIES" == 8.2 ]]; then
			DEFAULT_COMPONENT_BASENAME=php-wasi-component.wasm
		else
			DEFAULT_COMPONENT_BASENAME="php-$PHP_SERIES-wasi-component.wasm"
		fi
		;;
	extended)
		if [[ "$PHP_SERIES" == 8.2 ]]; then
			DEFAULT_COMPONENT_BASENAME=php-wasi-extended-component.wasm
		else
			DEFAULT_COMPONENT_BASENAME="php-$PHP_SERIES-wasi-extended-component.wasm"
		fi
		;;
	*)
		echo "PHP_WASI_VARIANT must be base or extended; got: $PHP_WASI_VARIANT" >&2
		exit 2
		;;
esac
COMPONENT_BASENAME=${PHP_WASI_COMPONENT_BASENAME:-$DEFAULT_COMPONENT_BASENAME}
if [[ "$COMPONENT_BASENAME" == */* || "$COMPONENT_BASENAME" != *.wasm ]]; then
	echo "PHP_WASI_COMPONENT_BASENAME must be a .wasm filename without directories; got: $COMPONENT_BASENAME" >&2
	exit 2
fi
COMPONENT_OUTPUT="$DIST_DIR/$COMPONENT_BASENAME"
OPTIMIZATION_FLAG="-$PHP_WASI_OPT_LEVEL"

mkdir -p "$DOWNLOAD_DIR" "$SOURCE_DIR" "$PREFIX" "$GENERATED_DIR" "$DIST_DIR"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

download() {
	local url=$1 destination=$2 checksum=$3
	if [[ ! -f "$destination" ]]; then
		curl --fail --location --silent --show-error "$url" --output "$destination"
	fi
	printf '%s  %s\n' "$checksum" "$destination" | sha256sum --check --status || {
		echo "Checksum mismatch: $destination" >&2
		return 1
	}
}

run_logged() {
	local log=$1
	shift
	if ! "$@" >"$log" 2>&1; then
		echo "Command failed; last 80 lines of $log:" >&2
		tail -n 80 "$log" >&2
		return 1
	fi
}

require_version() {
	local command=$1 expected=$2
	local actual
	actual=$($command --version | head -n 1)
	if [[ "$actual" != *"$expected"* ]]; then
		echo "$command $expected is required; found: $actual" >&2
		return 1
	fi
}

require_version autoconf "$AUTOCONF_VERSION"
require_version bison "$BISON_VERSION"
require_version re2c "$RE2C_VERSION"
require_version wit-bindgen "$WIT_BINDGEN_VERSION"
require_version wasm-tools "$WASM_TOOLS_VERSION"
if [[ "$PHP_WASI_VM_KIND" == "GOTO" ]]; then
	if [[ -z "${PHP_GOTO_VM_EXECUTE_SHA256:-}" || -z "${PHP_GOTO_VM_OPCODES_SHA256:-}" ]]; then
		echo "Pinned GOTO VM hashes are not available yet for PHP $PHP_SERIES" >&2
		exit 2
	fi
	require_version php "$PHP_VM_GENERATOR_VERSION"
fi
if [[ "$PHP_WASI_VARIANT" == "extended" ]]; then
	for required_command in cmake flex; do
		if ! command -v "$required_command" >/dev/null 2>&1; then
			echo "$required_command is required for the extended PHP WASI variant" >&2
			exit 1
		fi
	done
fi

WASI_ARCHIVE="$DOWNLOAD_DIR/wasi-sdk-$WASI_SDK_VERSION-x86_64-linux.tar.gz"
PHP_ARCHIVE="$DOWNLOAD_DIR/php-src-$PHP_COMMIT.tar.gz"
SQLITE_ARCHIVE="$DOWNLOAD_DIR/sqlite-autoconf-$SQLITE_AUTOCONF_VERSION.tar.gz"
PHPREDIS_ARCHIVE="$DOWNLOAD_DIR/phpredis-$PHPREDIS_VERSION.tar.gz"
PHP_MEMCACHED_ARCHIVE="$DOWNLOAD_DIR/php-memcached-$PHP_MEMCACHED_VERSION.tar.gz"
LIBMEMCACHED_ARCHIVE="$DOWNLOAD_DIR/libmemcached-$LIBMEMCACHED_VERSION.tar.gz"
ZLIB_ARCHIVE="$DOWNLOAD_DIR/zlib-$ZLIB_VERSION.tar.gz"
XDEBUG_ARCHIVE="$DOWNLOAD_DIR/xdebug-$XDEBUG_VERSION.tgz"

download \
	"https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-$WASI_SDK_VERSION-x86_64-linux.tar.gz" \
	"$WASI_ARCHIVE" "$WASI_SDK_SHA256"
download \
	"https://github.com/php/php-src/archive/$PHP_COMMIT.tar.gz" \
	"$PHP_ARCHIVE" "$PHP_SOURCE_SHA256"
download \
	"https://sqlite.org/$SQLITE_RELEASE_YEAR/sqlite-autoconf-$SQLITE_AUTOCONF_VERSION.tar.gz" \
	"$SQLITE_ARCHIVE" "$SQLITE_SOURCE_SHA256"
download "$ZLIB_SOURCE_URL" "$ZLIB_ARCHIVE" "$ZLIB_SOURCE_SHA256"
if [[ "$PHP_WASI_VARIANT" == "extended" ]]; then
	download "$PHPREDIS_SOURCE_URL" "$PHPREDIS_ARCHIVE" "$PHPREDIS_SOURCE_SHA256"
	download "$PHP_MEMCACHED_SOURCE_URL" "$PHP_MEMCACHED_ARCHIVE" "$PHP_MEMCACHED_SOURCE_SHA256"
	download "$LIBMEMCACHED_SOURCE_URL" "$LIBMEMCACHED_ARCHIVE" "$LIBMEMCACHED_SOURCE_SHA256"
	download "$XDEBUG_SOURCE_URL" "$XDEBUG_ARCHIVE" "$XDEBUG_SOURCE_SHA256"
fi

WASI_SDK="$BUILD_DIR/wasi-sdk-$WASI_SDK_VERSION"
PHP_SOURCE="$SOURCE_DIR/php-$PHP_COMMIT"
SQLITE_SOURCE="$SOURCE_DIR/sqlite-$SQLITE_AUTOCONF_VERSION"
SQLITE_BUILD="$BUILD_DIR/sqlite-build"
PHP_BUILD="$BUILD_DIR/php-build"
PHP_LIBTOOL_TARGET=libphp.la
PHP_STATIC_ARCHIVE="$PHP_BUILD/.libs/libphp.a"
if [[ "$PHP_SERIES" == 7.4 ]]; then
	PHP_LIBTOOL_TARGET=libphp7.la
	PHP_STATIC_ARCHIVE="$PHP_BUILD/.libs/libphp7.a"
fi
LIBMEMCACHED_SOURCE="$SOURCE_DIR/libmemcached-$LIBMEMCACHED_VERSION"
LIBMEMCACHED_BUILD="$BUILD_DIR/libmemcached-build"
ZLIB_SOURCE="$SOURCE_DIR/zlib-$ZLIB_VERSION"
ZLIB_BUILD="$BUILD_DIR/zlib-build"

if [[ ! -x "$WASI_SDK/bin/wasm32-wasip2-clang" ]]; then
	rm -rf "$WASI_SDK"
	mkdir -p "$WASI_SDK"
	tar -xzf "$WASI_ARCHIVE" --strip-components=1 -C "$WASI_SDK"
fi

rm -rf "$PHP_SOURCE" "$SQLITE_SOURCE" "$SQLITE_BUILD" "$PHP_BUILD" \
	"$LIBMEMCACHED_SOURCE" "$LIBMEMCACHED_BUILD" "$ZLIB_SOURCE" "$ZLIB_BUILD" \
	"$PREFIX" "$GENERATED_DIR"
mkdir -p "$PHP_SOURCE" "$SQLITE_SOURCE" "$SQLITE_BUILD" "$PHP_BUILD" \
	"$ZLIB_SOURCE" "$PREFIX" "$GENERATED_DIR/php" "$GENERATED_DIR/locks"
tar -xzf "$PHP_ARCHIVE" --strip-components=1 -C "$PHP_SOURCE"
tar -xzf "$SQLITE_ARCHIVE" --strip-components=1 -C "$SQLITE_SOURCE"
tar -xzf "$ZLIB_ARCHIVE" --strip-components=1 -C "$ZLIB_SOURCE"

if [[ "$PHP_SERIES" == 8.2 ]]; then
	PHP_PATCH_DIR="$ROOT/patches"
else
	PHP_PATCH_DIR="$ROOT/php-patches/$PHP_SERIES"
fi
if [[ ! -d "$PHP_PATCH_DIR" ]]; then
	echo "PHP $PHP_SERIES patch directory is missing: $PHP_PATCH_DIR" >&2
	exit 1
fi
mapfile -t PHP_PATCHES < <(find "$PHP_PATCH_DIR" -maxdepth 1 -type f -name '*.patch' -print | sort)
if [[ ${#PHP_PATCHES[@]} -eq 0 ]]; then
	echo "PHP $PHP_SERIES patch directory contains no patches: $PHP_PATCH_DIR" >&2
	exit 1
fi
for patch_file in "${PHP_PATCHES[@]}"; do
	run_logged "$LOG_DIR/$(basename "$patch_file").log" \
		patch --directory="$PHP_SOURCE" --strip=1 --forward --fuzz=0 --input="$patch_file"
done
for patch_file in "$ROOT"/sqlite-patches/*.patch; do
	run_logged "$LOG_DIR/$(basename "$patch_file").log" \
		patch --directory="$SQLITE_SOURCE" --strip=1 --forward --fuzz=0 --input="$patch_file"
done

if [[ "$PHP_WASI_VARIANT" == "extended" ]]; then
	mkdir -p "$PHP_SOURCE/ext/redis" "$PHP_SOURCE/ext/memcached" \
		"$PHP_SOURCE/ext/xdebug" "$LIBMEMCACHED_SOURCE"
	tar -xzf "$PHPREDIS_ARCHIVE" --strip-components=1 -C "$PHP_SOURCE/ext/redis"
	tar -xzf "$PHP_MEMCACHED_ARCHIVE" --strip-components=1 -C "$PHP_SOURCE/ext/memcached"
	tar -xzf "$XDEBUG_ARCHIVE" --strip-components=1 -C "$PHP_SOURCE/ext/xdebug"
	tar -xzf "$LIBMEMCACHED_ARCHIVE" --strip-components=1 -C "$LIBMEMCACHED_SOURCE"
	run_logged "$LOG_DIR/libmemcached-wasip2.patch.log" \
		patch --directory="$LIBMEMCACHED_SOURCE" --strip=1 --forward --fuzz=0 \
		--input="$ROOT/extension-patches/libmemcached-1.1.4-wasip2.patch"
	XDEBUG_PATCH="$ROOT/extension-patches/xdebug-$XDEBUG_PATCH_SERIES-static-wasi.patch"
	if [[ ! -f "$XDEBUG_PATCH" ]]; then
		echo "Xdebug $XDEBUG_VERSION static WASI patch is missing: $XDEBUG_PATCH" >&2
		exit 1
	fi
	run_logged "$LOG_DIR/$(basename "$XDEBUG_PATCH").log" \
		patch --directory="$PHP_SOURCE/ext/xdebug" --strip=1 --forward --fuzz=0 \
		--input="$XDEBUG_PATCH"
fi

if [[ "$PHP_WASI_VM_KIND" == "GOTO" ]]; then
	run_logged "$LOG_DIR/php-vm-gen.log" \
		php -n "$PHP_SOURCE/Zend/zend_vm_gen.php" --with-vm-kind=GOTO
	printf '%s  %s\n' "$PHP_GOTO_VM_EXECUTE_SHA256" "$PHP_SOURCE/Zend/zend_vm_execute.h" \
		| sha256sum --check --status || {
		echo "Generated GOTO executor checksum mismatch" >&2
		exit 1
	}
	printf '%s  %s\n' "$PHP_GOTO_VM_OPCODES_SHA256" "$PHP_SOURCE/Zend/zend_vm_opcodes.h" \
		| sha256sum --check --status || {
		echo "Generated GOTO opcode metadata checksum mismatch" >&2
		exit 1
	}
fi

CC="$WASI_SDK/bin/wasm32-wasip2-clang"
CXX="$WASI_SDK/bin/wasm32-wasip2-clang++"
AR="$WASI_SDK/bin/llvm-ar"
RANLIB="$WASI_SDK/bin/llvm-ranlib"
SJLJ_FLAGS=(-mllvm -wasm-enable-sjlj -mllvm -wasm-use-legacy-eh=false)
EMULATION_DEFINES=(-D_WASI_EMULATED_GETPID -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS)
EMULATION_LIBS=(-lsetjmp -lwasi-emulated-getpid -lwasi-emulated-signal -lwasi-emulated-process-clocks)
REPRODUCIBLE_PATH_FLAGS=(
	"-ffile-prefix-map=$BUILD_DIR=/build"
	"-ffile-prefix-map=$ROOT=/src"
)
DEPENDENCY_CFLAGS="$OPTIMIZATION_FLAG ${REPRODUCIBLE_PATH_FLAGS[*]}"

# WordPress core uses gzinflate() in its HTTP client, so zlib is part of the
# base runtime rather than an optional network-client dependency.
mkdir -p "$ZLIB_BUILD"
(
	cd "$ZLIB_BUILD"
	run_logged "$LOG_DIR/zlib-configure.log" env \
		CHOST=wasm32-wasip2 CC="$CC" AR="$AR" RANLIB="$RANLIB" \
		CFLAGS="$DEPENDENCY_CFLAGS" \
		"$ZLIB_SOURCE/configure" --static --prefix="$PREFIX"
)
run_logged "$LOG_DIR/zlib-build.log" \
	make -C "$ZLIB_BUILD" -j"$JOBS" libz.a
run_logged "$LOG_DIR/zlib-install.log" \
	make -C "$ZLIB_BUILD" install
if [[ ! -s "$PREFIX/lib/libz.a" ]]; then
	echo "PHP WASI zlib archive is missing: $PREFIX/lib/libz.a" >&2
	exit 1
fi

COMPONENT_LINKER="$CC"
EXTENDED_COMPONENT_LINK_ARGS=()
if [[ "$PHP_WASI_VARIANT" == "extended" ]]; then
	mkdir -p "$LIBMEMCACHED_BUILD"

	# Debian Bookworm's CMake predates Platform/WASI.cmake. Generic still gives
	# us a cross-compiling build while the compiler wrapper fixes the target to
	# wasm32-wasip2. Build library targets only: upstream's CLI tools require
	# signals and a fully threaded WASI libc that the PHP component does not use.
	run_logged "$LOG_DIR/libmemcached-configure.log" cmake \
		-S "$LIBMEMCACHED_SOURCE" -B "$LIBMEMCACHED_BUILD" \
		-DCMAKE_SYSTEM_NAME=Generic \
		-DCMAKE_SYSTEM_PROCESSOR=wasm32 \
		-DCMAKE_C_COMPILER="$CC" \
		-DCMAKE_CXX_COMPILER="$CXX" \
		-DCMAKE_AR="$AR" \
		-DCMAKE_RANLIB="$RANLIB" \
		-DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY \
		-DCMAKE_FIND_ROOT_PATH="$WASI_SDK/share/wasi-sysroot" \
		-DCMAKE_FIND_ROOT_PATH_MODE_PROGRAM=NEVER \
		-DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=ONLY \
		-DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=ONLY \
		-DCMAKE_FIND_ROOT_PATH_MODE_PACKAGE=ONLY \
		-DCMAKE_INSTALL_PREFIX="$PREFIX" \
		-DCMAKE_INSTALL_LIBDIR=lib \
		-DCMAKE_BUILD_TYPE=Release \
		-DCMAKE_C_FLAGS="$DEPENDENCY_CFLAGS" \
		-DCMAKE_CXX_FLAGS="$DEPENDENCY_CFLAGS" \
		-DCMAKE_C_FLAGS_RELEASE=-DNDEBUG \
		-DCMAKE_CXX_FLAGS_RELEASE=-DNDEBUG \
		-DBUILD_SHARED_LIBS=OFF \
		-DBUILD_TESTING=OFF \
		-DBUILD_DOCS=OFF \
		-DBUILD_DOCSONLY=OFF \
		-DENABLE_SASL=OFF \
		-DENABLE_OPENSSL_CRYPTO=OFF \
		-DENABLE_HASH_HSIEH=ON \
		-DENABLE_HASH_FNV64=ON \
		-DENABLE_HASH_MURMUR=ON \
		-DENABLE_MEMASLAP=OFF \
		-DENABLE_DTRACE=OFF
	run_logged "$LOG_DIR/libmemcached-build.log" cmake \
		--build "$LIBMEMCACHED_BUILD" --parallel "$JOBS" --target \
		libhashkit libmemcached libmemcachedutil libmemcachedprotocol
	run_logged "$LOG_DIR/libmemcached-install-lib.log" cmake \
		--install "$LIBMEMCACHED_BUILD" --prefix "$PREFIX" --component lib
	run_logged "$LOG_DIR/libmemcached-install-dev.log" cmake \
		--install "$LIBMEMCACHED_BUILD" --prefix "$PREFIX" --component dev

	for required_archive in \
		libhashkit.a libmemcached.a libmemcachedutil.a libp9y.a; do
		if [[ ! -s "$PREFIX/lib/$required_archive" ]]; then
			echo "Extended PHP WASI dependency archive is missing: $PREFIX/lib/$required_archive" >&2
			exit 1
		fi
	done

	# php-memcached links C++ static archives. Keep the C++ driver and the
	# whole-archive duplicate-symbol allowance confined to the extended artifact.
	COMPONENT_LINKER="$CXX"
	EXTENDED_COMPONENT_LINK_ARGS=(
		"-Wl,--allow-multiple-definition"
		"-Wl,--whole-archive"
		"$PREFIX/lib/libhashkit.a"
		"$PREFIX/lib/libmemcached.a"
		"$PREFIX/lib/libmemcachedutil.a"
		"$PREFIX/lib/libp9y.a"
		"-Wl,--no-whole-archive"
	)
fi

# SQLite's WAL mirror calls into the host bridge. Generate and compile that
# bridge before creating libsqlite3.a so PHP's configure-time SQLite link probes
# can resolve the mirror symbols just like the final component link can.
run_logged "$LOG_DIR/wit-locks.log" \
	wit-bindgen c --world bridge --out-dir "$GENERATED_DIR/locks" "$ROOT/wit/locks"
run_logged "$LOG_DIR/lock-bindings.log" "$CC" -c "$OPTIMIZATION_FLAG" \
	"${REPRODUCIBLE_PATH_FLAGS[@]}" -I"$GENERATED_DIR/locks" \
	"$GENERATED_DIR/locks/bridge.c" -o "$GENERATED_DIR/locks/bridge.o"
run_logged "$LOG_DIR/lock-bridge.log" "$CC" -c "$OPTIMIZATION_FLAG" \
	"${REPRODUCIBLE_PATH_FLAGS[@]}" -I"$GENERATED_DIR/locks" -I"$ROOT/component" \
	"$ROOT/component/fcntl_bridge.c" -o "$GENERATED_DIR/fcntl_bridge.o"

# SQLite defaults WASI builds to unix-dotfile, where even shared reader locks
# become exclusive lock directories. Use the POSIX VFS so independent component
# workers reach the fcntl bridge and its host-owned OFD locks instead. Since
# workers have private linear memories, exchange WAL shared-memory regions with
# a host-owned canonical image at SQLite's lock and barrier boundaries.
SQLITE_CFLAGS="$OPTIMIZATION_FLAG ${REPRODUCIBLE_PATH_FLAGS[*]} -include $ROOT/component/fcntl_compat.h -DSQLITE_WASI_SHM_MIRROR -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_FTS5 -DSQLITE_USE_URI -DSQLITE_OMIT_LOAD_EXTENSION"
SQLITE_CONFIGURE_ARGS=(
	--host=wasm32-wasi
	--build=x86_64-pc-linux-gnu
	--prefix="$PREFIX"
	--disable-shared
	--enable-static
	--disable-readline
	--disable-load-extension
	--enable-threadsafe
)
(
	cd "$SQLITE_BUILD"
	run_logged "$LOG_DIR/sqlite-configure.log" env \
		CC="$CC" AR="$AR" RANLIB="$RANLIB" CFLAGS="$SQLITE_CFLAGS" \
		"$SQLITE_SOURCE/configure" "${SQLITE_CONFIGURE_ARGS[@]}"
)
if ! grep -Eq '(^|[[:space:]])-DSQLITE_THREADSAFE=1([[:space:]]|$)' \
		"$SQLITE_BUILD/Makefile"; then
	echo "SQLite configure did not preserve SQLITE_THREADSAFE=1" >&2
	exit 1
fi
run_logged "$LOG_DIR/sqlite-build.log" make -C "$SQLITE_BUILD" -j"$JOBS" sqlite3.o
run_logged "$LOG_DIR/sqlite-archive.log" "$AR" rcs "$SQLITE_BUILD/libsqlite3.a" \
	"$SQLITE_BUILD/sqlite3.o" "$GENERATED_DIR/fcntl_bridge.o" \
	"$GENERATED_DIR/locks/bridge.o" \
	"$GENERATED_DIR/locks/bridge_component_type.o"
run_logged "$LOG_DIR/sqlite-ranlib.log" "$RANLIB" "$SQLITE_BUILD/libsqlite3.a"

mkdir -p "$PREFIX/include" "$PREFIX/lib/pkgconfig"
install -m 0644 "$SQLITE_SOURCE/sqlite3.h" "$SQLITE_SOURCE/sqlite3ext.h" "$PREFIX/include/"
install -m 0644 "$SQLITE_BUILD/libsqlite3.a" "$PREFIX/lib/"
install -m 0644 "$SQLITE_BUILD/sqlite3.pc" "$PREFIX/lib/pkgconfig/"
sed -i 's/[[:space:]]-ldl[[:space:]]*/ /g' "$PREFIX/lib/pkgconfig/sqlite3.pc"

(
	cd "$PHP_SOURCE"
	run_logged "$LOG_DIR/php-buildconf.log" ./buildconf --force
)

PHP_CFLAGS="$OPTIMIZATION_FLAG ${SJLJ_FLAGS[*]} ${EMULATION_DEFINES[*]} ${REPRODUCIBLE_PATH_FLAGS[*]}"
PHP_LDFLAGS="-L$PREFIX/lib ${SJLJ_FLAGS[*]} ${EMULATION_LIBS[*]}"
PHP_CPPFLAGS="-D_GNU_SOURCE -include $ROOT/component/fcntl_compat.h"
# PHP otherwise embeds `uname -a` in the binary. Docker supplies a randomly
# assigned hostname, making otherwise identical builds differ by a few bytes.
PHP_UNAME="WASI wasm32 PHP $PHP_VERSION WordPress Playground; component build is independent of the host operating system."
PHP_BUILD_SYSTEM="$PHP_UNAME"

PHP_CONFIGURE_ARGS=(
	--srcdir="$PHP_SOURCE" --host=wasm32-wasi --target=wasm32-wasi
	--disable-all --enable-ctype --enable-filter --enable-session
	--enable-pdo --with-pdo-sqlite --with-sqlite3 --with-zlib
	--without-libxml --without-iconv --without-pear --without-openssl
	--enable-phar --enable-opcache --disable-huge-code-pages
	--disable-zend-signals --without-pcre-jit
	--disable-cgi
)
if [[ "$PHP_SERIES" == 7.4 ]]; then
	# JSON was still an optional extension in PHP 7.4, so --disable-all turns it
	# off unless we explicitly restore it. PHP 8.0 made JSON part of core.
	PHP_CONFIGURE_ARGS+=(--enable-json)
else
	PHP_CONFIGURE_ARGS+=(--disable-opcache-jit)
fi
case "$PHP_SERIES" in
	7.4|8.0) ;;
	*) PHP_CONFIGURE_ARGS+=(--disable-fiber-asm) ;;
esac
if [[ "$PHP_WASI_VARIANT" == "extended" ]]; then
	PHP_CONFIGURE_ARGS+=(
		--enable-redis
		--disable-redis-session
		--disable-redis-json
		--disable-redis-igbinary
		--disable-redis-msgpack
		--disable-redis-lzf
		--disable-redis-zstd
		--disable-redis-lz4
		--enable-memcached
		--with-zlib-dir="$PREFIX"
		--with-libmemcached-dir="$PREFIX"
		--disable-memcached-session
		--disable-memcached-sasl
		--disable-memcached-igbinary
		--disable-memcached-json
		--disable-memcached-msgpack
		--disable-memcached-protocol
		--enable-xdebug
		--without-xdebug-compression
	)
fi

(
	cd "$PHP_BUILD"
	# Keep host-specific pkg-config launchers out of PHP's recorded configure
	# command. The canonical container resolves pkg-config through PATH.
	run_logged "$LOG_DIR/php-configure.log" env -u PKG_CONFIG \
		CC="$CC" CXX="$CXX" AR="$AR" RANLIB="$RANLIB" \
		CFLAGS="$PHP_CFLAGS" CPPFLAGS="$PHP_CPPFLAGS" LDFLAGS="$PHP_LDFLAGS" \
		PHP_UNAME="$PHP_UNAME" PHP_BUILD_SYSTEM="$PHP_BUILD_SYSTEM" \
		ac_cv_func_getaddrinfo=yes \
		php_cv_func_getaddrinfo=yes \
		PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" \
		"$PHP_SOURCE/configure" "${PHP_CONFIGURE_ARGS[@]}"
)
# PHP exposes its configure command through phpinfo(). Normalize paths that
# configure writes literally into build-defs.h; compiler prefix maps do not
# affect string literals generated by configure itself.
sed -i -e "s|$BUILD_DIR|/build|g" -e "s|$ROOT|/src|g" \
	"$PHP_BUILD/main/build-defs.h"
run_logged "$LOG_DIR/php-build.log" make -C "$PHP_BUILD" -j"$JOBS" "$PHP_LIBTOOL_TARGET"
run_logged "$LOG_DIR/php-cli-objects.log" make -C "$PHP_BUILD" -j"$JOBS" \
	EXTRA_CFLAGS=-DPHP_WASI_COMPONENT_CLI \
	sapi/cli/php_cli.lo sapi/cli/php_http_parser.lo sapi/cli/ps_title.lo \
	sapi/cli/php_cli_process_title.lo

run_logged "$LOG_DIR/wit-php.log" \
	wit-bindgen c --world php --out-dir "$GENERATED_DIR/php" "$ROOT/wit/php"

PHP_INCLUDES=(
	-I"$PHP_BUILD" -I"$PHP_BUILD/main" -I"$PHP_BUILD/TSRM" -I"$PHP_BUILD/Zend"
	-I"$PHP_SOURCE" -I"$PHP_SOURCE/main" -I"$PHP_SOURCE/TSRM"
	-I"$PHP_SOURCE/Zend" -I"$PHP_SOURCE/ext" -I"$PHP_SOURCE/ext/date/lib"
)

run_logged "$LOG_DIR/component-sapi.log" "$CC" -c "$OPTIMIZATION_FLAG" \
	"${SJLJ_FLAGS[@]}" "${EMULATION_DEFINES[@]}" \
	"${REPRODUCIBLE_PATH_FLAGS[@]}" -D_GNU_SOURCE \
	"${PHP_INCLUDES[@]}" -I"$PREFIX/include" -I"$GENERATED_DIR" \
	"$ROOT/component/php_wasi_component.c" -o "$GENERATED_DIR/php_wasi_component.o"
run_logged "$LOG_DIR/component-bindings.log" "$CC" -c "$OPTIMIZATION_FLAG" \
	"${REPRODUCIBLE_PATH_FLAGS[@]}" -I"$GENERATED_DIR/php" \
	"$GENERATED_DIR/php/php.c" -o "$GENERATED_DIR/php/php.o"
run_logged "$LOG_DIR/component-link.log" "$COMPONENT_LINKER" "$OPTIMIZATION_FLAG" -mexec-model=reactor \
	-Wl,-z,stack-size=8388608 \
	-Wl,--initial-memory=67108864 -Wl,--max-memory=1073741824 \
	"$GENERATED_DIR/php_wasi_component.o" \
	"$GENERATED_DIR/fcntl_bridge.o" \
	"$GENERATED_DIR/php/php.o" "$GENERATED_DIR/php/php_component_type.o" \
	"$GENERATED_DIR/locks/bridge.o" "$GENERATED_DIR/locks/bridge_component_type.o" \
	"$PHP_BUILD/sapi/cli/php_cli.o" \
	"$PHP_BUILD/sapi/cli/php_http_parser.o" \
	"$PHP_BUILD/sapi/cli/ps_title.o" \
	"$PHP_BUILD/sapi/cli/php_cli_process_title.o" \
	"$PHP_STATIC_ARCHIVE" -L"$PREFIX/lib" -lsqlite3 \
	"${EXTENDED_COMPONENT_LINK_ARGS[@]}" \
	-lz \
	"${EMULATION_LIBS[@]}" -o "$COMPONENT_OUTPUT"

if [[ "$PHP_WASI_VARIANT" == "base" && "$PHP_SERIES" == 8.2 ]]; then
	LIBPHP_OUTPUT="$DIST_DIR/libphp.a"
elif [[ "$PHP_WASI_VARIANT" == "base" ]]; then
	LIBPHP_OUTPUT="$DIST_DIR/libphp-$PHP_SERIES.a"
elif [[ "$PHP_SERIES" == 8.2 ]]; then
	LIBPHP_OUTPUT="$DIST_DIR/libphp-extended.a"
else
	LIBPHP_OUTPUT="$DIST_DIR/libphp-$PHP_SERIES-extended.a"
fi
install -m 0644 "$PHP_STATIC_ARCHIVE" "$LIBPHP_OUTPUT"
install -m 0644 "$PREFIX/lib/libsqlite3.a" "$DIST_DIR/libsqlite3.a"
"$ROOT/validate.sh" "$COMPONENT_OUTPUT"

echo "Built PHP $PHP_VERSION with $JOBS parallel jobs ($PHP_WASI_VARIANT, $PHP_WASI_OPT_LEVEL/$PHP_WASI_VM_KIND, SQLite THREADSAFE=1):"
echo "  $COMPONENT_OUTPUT"
echo "  $LIBPHP_OUTPUT"
echo "  $DIST_DIR/libsqlite3.a"
