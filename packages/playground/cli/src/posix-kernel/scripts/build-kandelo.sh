#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

cd "$(dirname "$0")/../../../../../../kandelo"

if [ -z "${KANDELO_DEV_SHELL_TOOL_PATH:-}" ]; then
	exec scripts/dev-shell.sh bash "$script"
fi

deduplicate_flags() {
	local -A seen=()
	local -a words kept=()
	local i flag
	read -ra words <<< "${!1:-}"
	for ((i = 0; i < ${#words[@]}; i++)); do
		flag=${words[i]}
		case $flag in
			-isystem | -idirafter | -iframework) flag+=" ${words[++i]}" ;;
		esac
		[ -n "${seen[$flag]:-}" ] && continue
		seen[$flag]=1
		kept+=("$flag")
	done
	export "$1=${kept[*]}"
}

for variable in NIX_CFLAGS_COMPILE NIX_CFLAGS_COMPILE_FOR_BUILD; do
	deduplicate_flags "$variable"
done

export PATH="$KANDELO_DEV_SHELL_TOOL_PATH"

host="$(rustc -vV | sed -n 's/^host: //p')"
cargo build -p xtask --target "$host"

directory="$(mktemp -d)"
trap 'rm -rf "$directory"' EXIT
cp "target/$host/debug/xtask" "$directory/xtask"

for target in kernel host nginx php platform-rootfs; do
	"$directory/xtask" bootstrap "$target"
done
