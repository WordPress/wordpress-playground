#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
IMAGE=${PHP_WASIP2_BUILD_IMAGE:-wordpress-playground/php-wasip2-build:local}
ACTION=${1:-build}
PHP_WASI_OPT_LEVEL=${PHP_WASI_OPT_LEVEL:-O2}
PHP_WASI_VM_KIND=${PHP_WASI_VM_KIND:-GOTO}
HOST_DIST_DIR=${PHP_WASIP2_DIST_DIR:-$ROOT/dist}

case "$PHP_WASI_OPT_LEVEL/$PHP_WASI_VM_KIND" in
	O2/HYBRID|O2/GOTO|O3/HYBRID|O3/GOTO) ;;
	*)
		echo "Unsupported PHP WASI profile: $PHP_WASI_OPT_LEVEL/$PHP_WASI_VM_KIND" >&2
		exit 2
		;;
esac

build_image() {
	docker build --tag "$IMAGE" "$ROOT"
}

case "$ACTION" in
	build)
		build_image
		mkdir -p "$HOST_DIST_DIR"
		HOST_DIST_DIR=$(cd "$HOST_DIST_DIR" && pwd)
		docker run --rm \
			--user "$(id -u):$(id -g)" \
			--env BUILD_DIR=/tmp/php-wasip2-build \
			--env DIST_DIR=/work/dist \
			--env PHP_WASI_OPT_LEVEL="$PHP_WASI_OPT_LEVEL" \
			--env PHP_WASI_VM_KIND="$PHP_WASI_VM_KIND" \
			--volume "$HOST_DIST_DIR:/work/dist" \
			"$IMAGE"
		;;
	validate)
		build_image
		docker run --rm \
			--user "$(id -u):$(id -g)" \
			--volume "$ROOT:/source:ro" \
			--entrypoint /source/validate.sh \
			"$IMAGE" /source/dist/php-wasi-component.wasm
		"$ROOT/verify-published.sh"
		;;
	*)
		echo "Usage: $0 [build|validate]" >&2
		exit 2
		;;
esac
