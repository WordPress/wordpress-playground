#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
PHP_VERSION="${PHP_VERSION:-8.4}"
ASYNC_MODE="${ASYNC_MODE:-jspi}"
WORK_DIR="${ROOT_DIR}/tmp/compile-extension-integration"
NODE_JSPI_FLAGS=()

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required for compile-extension integration tests." >&2
	exit 1
fi

if [ "$ASYNC_MODE" != "jspi" ]; then
	echo "Unsupported ASYNC_MODE: ${ASYNC_MODE}." >&2
	echo "Custom extensions are JSPI-only." >&2
	exit 1
fi
NODE_JSPI_FLAGS=(--experimental-wasm-jspi)
node "${NODE_JSPI_FLAGS[@]}" -e "import('wasm-feature-detect').then(async ({ jspi }) => { if (!(await jspi())) process.exit(1); })"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

NODE_TS=(
	node
	"${NODE_JSPI_FLAGS[@]}"
	--experimental-strip-types
	--experimental-transform-types
	--disable-warning=ExperimentalWarning
	--import "${ROOT_DIR}/packages/meta/src/node-es-module-loader/register.mts"
)
COMPILE_EXTENSION=(
	"${NODE_TS[@]}"
	"${ROOT_DIR}/packages/php-wasm/compile-extension/src/cli.ts"
)
VERIFY_EXTENSION=(
	"${NODE_TS[@]}"
	"${ROOT_DIR}/packages/php-wasm/compile-extension/tests/load-built-extension.mjs"
)

extension_image_tag() {
	local php_version_tag="${PHP_VERSION//./-}"
	echo "playground-php-wasm:compile-extension-php${php_version_tag}-${ASYNC_MODE}"
}

compile_extension() {
	"${COMPILE_EXTENSION[@]}" \
		--php-versions "$PHP_VERSION" \
		--jobs 1 \
		"$@"
}

verify_extension() {
	local manifest_path="$1"
	local php_code="$2"
	local expected_output="$3"
	"${VERIFY_EXTENSION[@]}" \
		"$manifest_path" \
		"$PHP_VERSION" \
		"$php_code" \
		"$expected_output"
}

build_string_score_dependency() {
	local source_dir="$1"
	docker run --rm \
		--entrypoint bash \
		-v "${source_dir}:/src" \
		"$(extension_image_tag)" \
		-lc '
			set -euo pipefail
			source /root/emsdk/emsdk_env.sh
			cd /src/vendor/string-score
			mkdir -p build install/include install/lib
			emcc -D__x86_64__ -fPIC -O2 -c string_score.c -o build/string_score.o
			emar rcs install/lib/libstring_score.a build/string_score.o
			emranlib install/lib/libstring_score.a
			cp string_score.h install/include/
			chmod -R a+rwX /src/vendor/string-score
		'
}

prepare_redis_source() {
	local source_dir="$1"
	git clone https://github.com/phpredis/phpredis.git "$source_dir" \
		--branch 6.3.0 \
		--single-branch \
		--depth 1
	# WASM32 `long` is 4 bytes, but Playground builds PHP with 64-bit
	# `zend_long`. phpredis uses this variadic call in command formatting.
	perl -pi -e 's/va_arg\(ap, long\)/va_arg(ap, zend_long)/g' "$source_dir/library.c"
}

echo "::group::Build and load simple extension"
compile_extension \
	--source packages/php-wasm/compile-extension/tests/fixtures/hello \
	--name playground_hello \
	--out "$WORK_DIR/hello"
verify_extension \
	"$WORK_DIR/hello/manifest.json" \
	"<?php echo playground_hello_greet();" \
	"hello from php-wasm"
echo "::endgroup::"

echo "::group::Build and load Redis extension"
REDIS_SOURCE="$WORK_DIR/phpredis"
prepare_redis_source "$REDIS_SOURCE"
compile_extension \
	--source "$REDIS_SOURCE" \
	--name redis \
	--out "$WORK_DIR/redis" \
	--extra-cflags "-Dsetsockopt=wasm_setsockopt -Dusleep=__wrap_usleep" \
	--config-args "--disable-redis-session --disable-redis-json --disable-redis-igbinary --disable-redis-msgpack --disable-redis-lzf --disable-redis-zstd --disable-redis-lz4"
verify_extension \
	"$WORK_DIR/redis/manifest.json" \
	"<?php echo class_exists('Redis') ? get_class(new Redis()) : 'missing';" \
	"Redis"
echo "::endgroup::"

# Some PECL extensions import PHP main-module data globals that are not yet
# exported in a side-module-compatible shape. ext/calendar is still a real
# multi-file phpize extension and gives this helper a non-trivial load test.
echo "::group::Build and load php-src ext/calendar"
git clone https://github.com/php/php-src.git "$WORK_DIR/php-src" \
	--branch php-8.4.20 \
	--single-branch \
	--depth 1 \
	--filter=blob:none \
	--sparse
git -C "$WORK_DIR/php-src" sparse-checkout set ext/calendar
compile_extension \
	--source "$WORK_DIR/php-src/ext/calendar" \
	--name calendar \
	--out "$WORK_DIR/calendar"
verify_extension \
	"$WORK_DIR/calendar/manifest.json" \
	"<?php echo cal_days_in_month(CAL_GREGORIAN, 2, 2024);" \
	"29"
echo "::endgroup::"

echo "::group::Build and load zlib-backed extension"
make -C "$ROOT_DIR/packages/php-wasm/compile" "libz_${ASYNC_MODE}"
DEPS_ROOT="/php-wasm-compile"
LIBZ_PREFIX="${DEPS_ROOT}/libz/${ASYNC_MODE}/dist/root/lib"
compile_extension \
	--source packages/php-wasm/compile-extension/tests/fixtures/zlib-probe \
	--name zlib_probe \
	--out "$WORK_DIR/zlib-probe" \
	--extra-cflags "-I${LIBZ_PREFIX}/include" \
	--extra-ldflags "${LIBZ_PREFIX}/lib/libz.a"
verify_extension \
	"$WORK_DIR/zlib-probe/manifest.json" \
	"<?php echo zlib_probe_roundtrip('dependency backed extension');" \
	"dependency backed extension"
echo "::endgroup::"

echo "::group::Build and load extension backed by non-Playground library"
EXTERNAL_SOURCE="$WORK_DIR/external-lib-probe"
cp -R \
	"$ROOT_DIR/packages/php-wasm/compile-extension/tests/fixtures/external-lib-probe" \
	"$EXTERNAL_SOURCE"
build_string_score_dependency "$EXTERNAL_SOURCE"
compile_extension \
	--source "$EXTERNAL_SOURCE" \
	--name external_lib_probe \
	--out "$WORK_DIR/external-lib-probe-dist" \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
verify_extension \
	"$WORK_DIR/external-lib-probe-dist/manifest.json" \
	"<?php echo external_lib_probe_score('wasm');" \
	"1094"
echo "::endgroup::"
