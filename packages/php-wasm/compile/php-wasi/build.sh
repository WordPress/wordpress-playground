#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=versions.env
source "$ROOT/versions.env"
PHP_VM_GENERATOR_VERSION=${PHP_VERSION%.*}
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
	require_version php "$PHP_VM_GENERATOR_VERSION"
fi

WASI_ARCHIVE="$DOWNLOAD_DIR/wasi-sdk-$WASI_SDK_VERSION-x86_64-linux.tar.gz"
PHP_ARCHIVE="$DOWNLOAD_DIR/php-src-$PHP_COMMIT.tar.gz"
SQLITE_ARCHIVE="$DOWNLOAD_DIR/sqlite-autoconf-$SQLITE_AUTOCONF_VERSION.tar.gz"

download \
	"https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-$WASI_SDK_VERSION-x86_64-linux.tar.gz" \
	"$WASI_ARCHIVE" "$WASI_SDK_SHA256"
download \
	"https://github.com/php/php-src/archive/$PHP_COMMIT.tar.gz" \
	"$PHP_ARCHIVE" "$PHP_SOURCE_SHA256"
download \
	"https://sqlite.org/$SQLITE_RELEASE_YEAR/sqlite-autoconf-$SQLITE_AUTOCONF_VERSION.tar.gz" \
	"$SQLITE_ARCHIVE" "$SQLITE_SOURCE_SHA256"

WASI_SDK="$BUILD_DIR/wasi-sdk-$WASI_SDK_VERSION"
PHP_SOURCE="$SOURCE_DIR/php-$PHP_COMMIT"
SQLITE_SOURCE="$SOURCE_DIR/sqlite-$SQLITE_AUTOCONF_VERSION"
SQLITE_BUILD="$BUILD_DIR/sqlite-build"
PHP_BUILD="$BUILD_DIR/php-build"

if [[ ! -x "$WASI_SDK/bin/wasm32-wasip2-clang" ]]; then
	rm -rf "$WASI_SDK"
	mkdir -p "$WASI_SDK"
	tar -xzf "$WASI_ARCHIVE" --strip-components=1 -C "$WASI_SDK"
fi

rm -rf "$PHP_SOURCE" "$SQLITE_SOURCE" "$SQLITE_BUILD" "$PHP_BUILD" "$PREFIX" "$GENERATED_DIR"
mkdir -p "$PHP_SOURCE" "$SQLITE_SOURCE" "$SQLITE_BUILD" "$PHP_BUILD" "$PREFIX" "$GENERATED_DIR/php" "$GENERATED_DIR/locks"
tar -xzf "$PHP_ARCHIVE" --strip-components=1 -C "$PHP_SOURCE"
tar -xzf "$SQLITE_ARCHIVE" --strip-components=1 -C "$SQLITE_SOURCE"

for patch_file in "$ROOT"/patches/*.patch; do
	run_logged "$LOG_DIR/$(basename "$patch_file").log" \
		patch --directory="$PHP_SOURCE" --strip=1 --forward --input="$patch_file"
done
for patch_file in "$ROOT"/sqlite-patches/*.patch; do
	run_logged "$LOG_DIR/$(basename "$patch_file").log" \
		patch --directory="$SQLITE_SOURCE" --strip=1 --forward --input="$patch_file"
done

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

(
	cd "$PHP_BUILD"
	run_logged "$LOG_DIR/php-configure.log" env \
		CC="$CC" CXX="$CXX" AR="$AR" RANLIB="$RANLIB" \
		CFLAGS="$PHP_CFLAGS" CPPFLAGS="$PHP_CPPFLAGS" LDFLAGS="$PHP_LDFLAGS" \
		PHP_UNAME="$PHP_UNAME" PHP_BUILD_SYSTEM="$PHP_BUILD_SYSTEM" \
		PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" \
		"$PHP_SOURCE/configure" \
		--srcdir="$PHP_SOURCE" --host=wasm32-wasi --target=wasm32-wasi \
		--disable-all --enable-filter --enable-pdo --with-pdo-sqlite --with-sqlite3 \
		--without-libxml --without-iconv --without-pear --without-openssl \
		--disable-phar --enable-opcache --disable-opcache-jit --disable-huge-code-pages \
		--disable-zend-signals --without-pcre-jit \
		--disable-fiber-asm --disable-cgi
)
# PHP exposes its configure command through phpinfo(). Normalize paths that
# configure writes literally into build-defs.h; compiler prefix maps do not
# affect string literals generated by configure itself.
sed -i -e "s|$BUILD_DIR|/build|g" -e "s|$ROOT|/src|g" \
	"$PHP_BUILD/main/build-defs.h"
run_logged "$LOG_DIR/php-build.log" make -C "$PHP_BUILD" -j"$JOBS" libphp.la

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
run_logged "$LOG_DIR/component-link.log" "$CC" "$OPTIMIZATION_FLAG" -mexec-model=reactor \
	-Wl,-z,stack-size=8388608 \
	-Wl,--initial-memory=67108864 -Wl,--max-memory=1073741824 \
	"$GENERATED_DIR/php_wasi_component.o" \
	"$GENERATED_DIR/fcntl_bridge.o" \
	"$GENERATED_DIR/php/php.o" "$GENERATED_DIR/php/php_component_type.o" \
	"$GENERATED_DIR/locks/bridge.o" "$GENERATED_DIR/locks/bridge_component_type.o" \
	"$PHP_BUILD/.libs/libphp.a" -L"$PREFIX/lib" -lsqlite3 \
	"${EMULATION_LIBS[@]}" -o "$DIST_DIR/php-wasi-component.wasm"

install -m 0644 "$PHP_BUILD/.libs/libphp.a" "$DIST_DIR/libphp.a"
install -m 0644 "$PREFIX/lib/libsqlite3.a" "$DIST_DIR/libsqlite3.a"
"$ROOT/validate.sh" "$DIST_DIR/php-wasi-component.wasm"

echo "Built with $JOBS parallel jobs ($PHP_WASI_OPT_LEVEL/$PHP_WASI_VM_KIND, SQLite THREADSAFE=1):"
echo "  $DIST_DIR/php-wasi-component.wasm"
echo "  $DIST_DIR/libphp.a"
echo "  $DIST_DIR/libsqlite3.a"
