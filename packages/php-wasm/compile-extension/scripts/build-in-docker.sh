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

ASYNC_MODE="${ASYNC_MODE:-jspi}"
OPTIMIZE="${OPTIMIZE:-2}"
ARTIFACT_FILENAME="${ARTIFACT_FILENAME:-${EXTENSION_NAME}-php${PHP_VERSION_SHORT:-unknown}-${ASYNC_MODE}.so}"
MAKE_JOBS="${MAKE_JOBS:-$(nproc)}"
USER_EXTRA_CFLAGS="${EXTRA_CFLAGS:-}"
USER_EXTRA_LDFLAGS="${EXTRA_LDFLAGS:-}"
unset EXTRA_CFLAGS EXTRA_LDFLAGS

rm -rf /build
mkdir -p /build /out
cp -R /src/. /build/
cd /build

phpize .
source /root/emsdk/emsdk_env.sh
export EMSDK_SYSROOT="${EMSDK_SYSROOT:-${EMSDK}/upstream/emscripten/cache/sysroot}"

BASE_CFLAGS="-DZEND_ENABLE_ZVAL_LONG64 -D__x86_64__ -fPIC -O${OPTIMIZE}"
BASE_LDFLAGS="-sSIDE_MODULE=1 -sWASM_BIGINT -fPIC -O${OPTIMIZE}"

if [ "$ASYNC_MODE" != "jspi" ]; then
	echo "Unsupported ASYNC_MODE: ${ASYNC_MODE}." >&2
	echo "Custom extensions can only be built for JSPI runtimes." >&2
	exit 1
fi
ASYNC_FLAGS="-sSUPPORT_LONGJMP=wasm -fwasm-exceptions -sJSPI"

EXTRA_LINK_FLAGS=""
EXTRA_STATIC_ARCHIVES=""
for flag in $USER_EXTRA_LDFLAGS; do
	if [[ "$flag" == *.a ]]; then
		EXTRA_STATIC_ARCHIVES="${EXTRA_STATIC_ARCHIVES} ${flag}"
	else
		EXTRA_LINK_FLAGS="${EXTRA_LINK_FLAGS} ${flag}"
	fi
done

export CFLAGS="${BASE_CFLAGS} ${USER_EXTRA_CFLAGS}"
export CXXFLAGS="${BASE_CFLAGS} ${USER_EXTRA_CFLAGS}"
export BINDGEN_EXTRA_CLANG_ARGS="--target=wasm32-unknown-emscripten --sysroot=${EMSDK_SYSROOT} -DZEND_ENABLE_ZVAL_LONG64 -D__x86_64__ ${BINDGEN_EXTRA_CLANG_ARGS:-}"
export CFLAGS_wasm32_unknown_emscripten="-fPIC ${CFLAGS_wasm32_unknown_emscripten:-}"
export CXXFLAGS_wasm32_unknown_emscripten="-fPIC ${CXXFLAGS_wasm32_unknown_emscripten:-}"
export CC_wasm32_unknown_emscripten="${CC_wasm32_unknown_emscripten:-emcc}"
export CXX_wasm32_unknown_emscripten="${CXX_wasm32_unknown_emscripten:-em++}"
export AR_wasm32_unknown_emscripten="${AR_wasm32_unknown_emscripten:-emar}"
export RANLIB_wasm32_unknown_emscripten="${RANLIB_wasm32_unknown_emscripten:-emranlib}"
CONFIGURE_LDFLAGS="${BASE_LDFLAGS} ${ASYNC_FLAGS}"
BUILD_LDFLAGS="${CONFIGURE_LDFLAGS} ${EXTRA_LINK_FLAGS}"
export LDFLAGS="${CONFIGURE_LDFLAGS}"
# The libtool patch below injects EMCC_FLAGS into the final archive command.
# Keep dependency archives out of LDFLAGS so libtool does not drop or duplicate them.
export EMCC_FLAGS="${BUILD_LDFLAGS}"
export EMCC_STATIC_ARCHIVES="${EXTRA_STATIC_ARCHIVES}"

configure_args=("--host=i386-unknown-freebsd" "--enable-${EXTENSION_NAME}" "--disable-static" "--enable-shared")
config_args_count="${CONFIG_ARGS_COUNT:-0}"
for ((i = 0; i < config_args_count; i++)); do
	arg_name="CONFIG_ARG_${i}"
	configure_args+=("${!arg_name}")
done

if ! emconfigure ./configure "${configure_args[@]}"; then
	if [ -f config.log ]; then
		cat config.log >&2
	fi
	exit 1
fi

if [ -f libtool ]; then
	if [ -n "$EMCC_STATIC_ARCHIVES" ]; then
		/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS -shared --whole-archive \\\$EMCC_STATIC_ARCHIVES --no-whole-archive|' libtool || true
	else
		/root/replace.sh 's|^archive_cmds="\\\$CC|archive_cmds="emcc \\\$EMCC_FLAGS|' libtool || true
	fi
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

mkdir -p /out
cp "$module_path" "/out/${ARTIFACT_FILENAME}"
