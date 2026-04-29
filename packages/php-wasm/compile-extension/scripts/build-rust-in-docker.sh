#!/usr/bin/env bash
#
# Build a Rust PHP extension as a wasm32-unknown-emscripten cdylib that
# Playground can load as a SIDE_MODULE.
#
# Required env (set by docker.ts):
#   EXTENSION_NAME      Output basename (without .so) — also the cdylib name
#   ASYNC_MODE          jspi | asyncify
#   PHP_VERSION_SHORT   e.g. 8.4
#   ARTIFACT_FILENAME   final filename written to /out
#
# Optional:
#   OPTIMIZE            cargo profile (default: release)
#   EXTRA_CFLAGS        -C link-arg= … forwarded to the linker
#   EXTRA_LDFLAGS       same; appended after async-mode flags
#
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
ARTIFACT_FILENAME="${ARTIFACT_FILENAME:-${EXTENSION_NAME}-php${PHP_VERSION_SHORT:-unknown}-${ASYNC_MODE}.so}"
USER_EXTRA_CFLAGS="${EXTRA_CFLAGS:-}"
USER_EXTRA_LDFLAGS="${EXTRA_LDFLAGS:-}"
unset EXTRA_CFLAGS EXTRA_LDFLAGS

rm -rf /build
mkdir -p /build /out
cp -R /src/. /build/
cd /build

source /root/emsdk/emsdk_env.sh

#
# Side-module link flags.
#
# emcc is the linker for wasm32-unknown-emscripten cargo targets, so we
# pass these via -C link-arg= rather than via LDFLAGS — Cargo only honors
# the former for the final cdylib link step.
#
LINK_ARGS=(
	"-C" "link-arg=-sSIDE_MODULE=1"
	"-C" "link-arg=-sWASM_BIGINT"
	"-C" "link-arg=-fPIC"
)

if [ "$ASYNC_MODE" = "jspi" ]; then
	LINK_ARGS+=(
		"-C" "link-arg=-sSUPPORT_LONGJMP=wasm"
		"-C" "link-arg=-fwasm-exceptions"
		"-C" "link-arg=-sJSPI"
	)
elif [ "$ASYNC_MODE" = "asyncify" ]; then
	LINK_ARGS+=(
		"-C" "link-arg=-sASYNCIFY=1"
		"-C" "link-arg=-sASYNCIFY_ADVISE"
	)
else
	echo "Unsupported ASYNC_MODE: ${ASYNC_MODE}" >&2
	exit 1
fi

for flag in $USER_EXTRA_LDFLAGS; do
	LINK_ARGS+=("-C" "link-arg=${flag}")
done

#
# ext-php-rs's build.rs runs bindgen against PHP headers. Point it at
# the cross-compiled headers from the base image.
#
export PHP_CONFIG="/usr/local/bin/php-config"
export EXT_PHP_RS_PHP_CONFIG="${PHP_CONFIG}"
export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/local/include/php -I/usr/local/include/php/main -I/usr/local/include/php/Zend -I/usr/local/include/php/TSRM -I/usr/local/include/php/ext"

#
# Emscripten's emcc-as-linker needs CC pointed at it explicitly under
# the Cargo wasm32-unknown-emscripten target.
#
export CARGO_TARGET_WASM32_UNKNOWN_EMSCRIPTEN_LINKER="emcc"
export CC_wasm32_unknown_emscripten="emcc"
export AR_wasm32_unknown_emscripten="emar"

if [ -n "$USER_EXTRA_CFLAGS" ]; then
	export CFLAGS="${USER_EXTRA_CFLAGS}"
	export EMCC_CFLAGS="${USER_EXTRA_CFLAGS}"
fi

cargo build \
	--release \
	--target wasm32-unknown-emscripten \
	--config "build.rustflags=[$(printf '"%s",' "${LINK_ARGS[@]}" | sed 's/,$//')]"

#
# Cargo writes lib<crate>.so under target/<triple>/release/. The cdylib
# name follows the [lib].name → [package].name lookup, with hyphens in
# crate names normalized to underscores.
#
crate_basename="$(echo "${EXTENSION_NAME}" | tr '-' '_')"
candidate="target/wasm32-unknown-emscripten/release/lib${crate_basename}.so"
if [ ! -f "$candidate" ]; then
	candidate="$(find target/wasm32-unknown-emscripten/release -maxdepth 1 -name '*.so' -print -quit)"
fi
if [ -z "$candidate" ] || [ ! -f "$candidate" ]; then
	echo "Could not find a Rust-built .so under target/wasm32-unknown-emscripten/release." >&2
	exit 1
fi

if [ -x /root/emsdk/upstream/bin/wasm-opt ]; then
	/root/emsdk/upstream/bin/wasm-opt -Oz \
		--enable-bulk-memory \
		--enable-nontrapping-float-to-int \
		--enable-sign-ext \
		--enable-mutable-globals \
		--enable-exception-handling \
		"$candidate" \
		-o "$candidate"
fi

cp "$candidate" "/out/${ARTIFACT_FILENAME}"
