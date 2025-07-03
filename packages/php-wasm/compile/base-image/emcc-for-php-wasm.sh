#!/bin/bash

set -euo pipefail

# Passing extra flags breaks the version check
if [[ "$@" == "-v" ]]; then
	export EMCC_FLAGS=""
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

/root/emsdk/upstream/emscripten/emcc2 "${args[@]}" ${EMCC_FLAGS:-}
