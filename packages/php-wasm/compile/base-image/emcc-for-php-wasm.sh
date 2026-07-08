#!/bin/bash

set -euo pipefail

FAKE_DYLIBS_FLAG=""

# Passing extra flags breaks the version check
if [[ "$@" == "-v" ]]; then
	export EMCC_FLAGS=""
else
	# Emscripten 6.0.0 disabled FAKE_DYLIBS by default, making `-shared`
	# produce real WASM dylibs (implying -sSIDE_MODULE) and making linking
	# against .so files imply -sMAIN_MODULE=2. The library builds in this
	# repository rely on the pre-6.0 behavior where `-shared` emits object
	# files and .so files link statically. Explicit -sSIDE_MODULE and
	# -sMAIN_MODULE flags are unaffected by FAKE_DYLIBS.
	#
	# FAKE_DYLIBS is a link-only setting: passing it to compile-only
	# invocations is a hard error, so only add it when linking. It must be
	# passed on the command line, NOT via the exported EMCC_FLAGS: emcc
	# re-invokes this wrapper in subprocesses to compile system libraries
	# (with -c and -Werror), and those must not inherit the flag.
	linking=1
	for arg in "$@"; do
		case "$arg" in
			-c|-S|-E|-M|-MM) linking=0 ;;
		esac
	done
	if [[ "$linking" == "1" ]]; then
		FAKE_DYLIBS_FLAG="-sFAKE_DYLIBS"

		# EMCC_FLAGS carries -sSIDE_MODULE so that library objects are
		# compiled as PIC and .so targets become WASM side modules. Library
		# build systems, however, also link auxiliary executables (tests,
		# CLI tools) with the same flags. Emscripten 6 post-processes side
		# modules with a wasm-opt pass that aborts on executables, so drop
		# -sSIDE_MODULE when the link target is not a shared object.
		output=""
		prev=""
		for arg in "$@"; do
			if [[ "$prev" == "-o" ]]; then
				output="$arg"
			fi
			prev="$arg"
		done
		if [[ "$output" != *.so && "$output" != *.so.* && "$output" != *.wasm ]]; then
			EMCC_FLAGS="${EMCC_FLAGS:-}"
			if [[ "$EMCC_FLAGS" == *-sSIDE_MODULE* ]]; then
				# Also tolerate undefined symbols: EMCC_SKIP removes
				# dependency libs (-lz etc.) from these auxiliary links.
				# Side modules imported such symbols implicitly; a regular
				# executable link would fail on them. These executables
				# only need to build, they are never executed.
				EMCC_FLAGS="${EMCC_FLAGS//-sSIDE_MODULE/} -sERROR_ON_UNDEFINED_SYMBOLS=0"
				# Emscripten 6's wasm-opt aborts on a DWARF assertion
				# (wasm-debug.cpp AddrExprMap) when optimizing some -g
				# builds. Debug info is useless in these auxiliary
				# executables, so drop it.
				STRIP_DEBUG_FLAGS=1
			fi
		fi
	fi
fi

# Convert args to an array for filtering
args=("${@}")

# Remove flags that we do not want to pass to emcc
if [[ -n "${EMCC_SKIP:-}" ]]; then
    for ((i=0; i < ${#args[@]}; i++)); do
		if [[ " ${EMCC_SKIP[*]} " =~ " ${args[$i]} " ]]; then
			unset 'args[i]'
		fi
	done
fi

# See the STRIP_DEBUG_FLAGS comment above.
if [[ "${STRIP_DEBUG_FLAGS:-0}" == "1" ]]; then
	for ((i=0; i < ${#args[@]}; i++)); do
		case "${args[$i]:-}" in
			-g|-g[0-9]|-gsource-map|-gseparate-dwarf*) unset 'args[i]' ;;
		esac
	done
fi

# Remove duplicate library references to avoid linking errors.
# Begin at end because we generally want dependencies to come last,
# and if two things depend on a lib, we want the lib to come after both.
declare -A seen_libs
for ((i=${#args[@]} - 1; i >= 0; i--)); do
    # Skip empty args because array may be sparse
    [[ -z "${args[$i]:-}" ]] && continue

    arg=${args[i]}
    if (
        [[ "$arg" =~ ^-l([a-z]|[A-Z]|[0-9]|[\-_])+$ ]] ||
        [[ "$arg" =~ (^|/)lib([a-z]|[A-Z]|[0-9]|[\-_])+\.a$ ]]
    ); then
        if [[ -v seen_libs["$arg"] ]]; then
            unset 'args[i]'
        else
            seen_libs["$arg"]=1
        fi
    fi
done

/root/emsdk/upstream/emscripten/emcc2 "${args[@]}" ${EMCC_FLAGS:-} $FAKE_DYLIBS_FLAG
