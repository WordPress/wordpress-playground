#!/usr/bin/env bash
set -euo pipefail

if [ ! -d /src ]; then
	echo "Missing /src extension source mount." >&2
	exit 1
fi

if [ -z "${EXTENSION_NAME:-}" ]; then
	echo "Missing EXTENSION_NAME." >&2
	exit 1
fi

ASYNC_MODE="${ASYNC_MODE:-asyncify}"
OPTIMIZE="${OPTIMIZE:-2}"
ARTIFACT_FILENAME="${ARTIFACT_FILENAME:-${EXTENSION_NAME}-php${PHP_VERSION_SHORT:-unknown}-${ASYNC_MODE}.so}"
MAKE_JOBS="${MAKE_JOBS:-$(nproc)}"

rm -rf /build
mkdir -p /build /out
cp -R /src/. /build/
cd /build

phpize .
source /root/emsdk/emsdk_env.sh

BASE_CFLAGS="-DZEND_ENABLE_ZVAL_LONG64 -D__x86_64__ -fPIC -O${OPTIMIZE}"
BASE_LDFLAGS="-sSIDE_MODULE=1 -sWASM_BIGINT -fPIC -O${OPTIMIZE}"
ASYNC_FLAGS=""

if [ "$ASYNC_MODE" = "jspi" ]; then
	ASYNC_FLAGS="-sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI"
elif [ "$ASYNC_MODE" = "asyncify" ]; then
	ASYNC_FLAGS="-sASYNCIFY=1 -sASYNCIFY_ADVISE"
else
	echo "Unsupported ASYNC_MODE: ${ASYNC_MODE}" >&2
	exit 1
fi

export CFLAGS="${BASE_CFLAGS} ${EXTRA_CFLAGS:-}"
export CXXFLAGS="${BASE_CFLAGS} ${EXTRA_CFLAGS:-}"
export LDFLAGS="${BASE_LDFLAGS} ${ASYNC_FLAGS} ${EXTRA_LDFLAGS:-}"
export EMCC_FLAGS="${LDFLAGS}"

configure_args=("--host=i386-unknown-freebsd" "--enable-${EXTENSION_NAME}" "--disable-static" "--enable-shared")
config_args_count="${CONFIG_ARGS_COUNT:-0}"
for ((i = 0; i < config_args_count; i++)); do
	arg_name="CONFIG_ARG_${i}"
	configure_args+=("${!arg_name}")
done

emconfigure ./configure "${configure_args[@]}"

if [ -f libtool ]; then
	/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS|' libtool || true
fi

emmake make -j"${MAKE_JOBS}"

module_path="modules/${EXTENSION_NAME}.so"
if [ ! -f "$module_path" ]; then
	module_path="$(find modules -maxdepth 1 -name '*.so' -print -quit)"
fi

if [ -z "$module_path" ] || [ ! -f "$module_path" ]; then
	echo "Could not find a built .so under /build/modules." >&2
	exit 1
fi

if [ -x /root/emsdk/upstream/bin/wasm-opt ]; then
	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		"$module_path" \
		-o "$module_path"
fi

cp "$module_path" "/out/${ARTIFACT_FILENAME}"
