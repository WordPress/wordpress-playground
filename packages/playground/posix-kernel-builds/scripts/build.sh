#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
package="$(dirname "$(dirname "$script")")"

cd "$package/../../../kandelo"

if [ -n "${KANDELO_DEV_SHELL_TOOL_PATH:-}" ]; then
	host="$(rustc -vV | sed -n 's/^host: //p')"
	for target in kernel host nginx php platform-rootfs; do
		cargo run -p xtask --target "$host" -- bootstrap "$target"
	done
	exit
fi

scripts/dev-shell.sh bash "$script"

mkdir -p "$package/host/dist"
for entry in index node-kernel-worker-entry worker-entry; do
	grep -v '^//# sourceMappingURL=' "host/dist/$entry.js" > "$package/host/dist/$entry.js"
done

rsync -a --delete --delete-excluded \
	--include=/.kandelo/ --include=/.kandelo/source-only-program-projection-v1.json \
	--include=/kernel.wasm --include=/kandelo_image_module32.wasm \
	--include=/programs/ --include=/programs/wasm32/ \
	--include=/programs/wasm32/nginx.wasm --include=/programs/wasm32/rootfs.vfs.zst \
	--include=/programs/wasm32/bash.wasm --include=/programs/wasm32/coreutils.wasm \
	--include=/programs/wasm32/php/ --include='/programs/wasm32/php/*' \
	--exclude='*' \
	local-binaries/source-only-v1/ "$package/local-binaries/source-only-v1/"
