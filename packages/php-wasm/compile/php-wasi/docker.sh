#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
IMAGE=${PHP_WASIP2_BUILD_IMAGE:-wordpress-playground/php-wasip2-build:local}
ACTION=${1:-build}
PHP_WASI_OPT_LEVEL=${PHP_WASI_OPT_LEVEL:-O2}
PHP_WASI_VM_KIND=${PHP_WASI_VM_KIND:-GOTO}
PHP_WASI_PHP_VERSION=${PHP_WASI_PHP_VERSION:-8.2}
PHP_WASI_VARIANT=${PHP_WASI_VARIANT:-base}
HOST_DIST_DIR=${PHP_WASIP2_DIST_DIR:-$ROOT/dist}

case "$PHP_WASI_OPT_LEVEL/$PHP_WASI_VM_KIND" in
	O2/HYBRID|O2/GOTO|O3/HYBRID|O3/GOTO) ;;
	*)
		echo "Unsupported PHP WASI profile: $PHP_WASI_OPT_LEVEL/$PHP_WASI_VM_KIND" >&2
		exit 2
		;;
esac
case "$PHP_WASI_PHP_VERSION" in
	7.4|8.0|8.1|8.2|8.3|8.4|8.5) ;;
	*)
		echo "Unsupported PHP WASI version: $PHP_WASI_PHP_VERSION" >&2
		exit 2
		;;
esac
case "$PHP_WASI_VARIANT" in
	base|extended) ;;
	*)
		echo "Unsupported PHP WASI variant: $PHP_WASI_VARIANT" >&2
		exit 2
		;;
esac

if [[ "$PHP_WASI_PHP_VERSION" == 8.2 ]]; then
	COMPONENT_BASENAME=php-wasi-component.wasm
	if [[ "$PHP_WASI_VARIANT" == extended ]]; then
		COMPONENT_BASENAME=php-wasi-extended-component.wasm
	fi
else
	COMPONENT_BASENAME="php-$PHP_WASI_PHP_VERSION-wasi-component.wasm"
	if [[ "$PHP_WASI_VARIANT" == extended ]]; then
		COMPONENT_BASENAME="php-$PHP_WASI_PHP_VERSION-wasi-extended-component.wasm"
	fi
fi

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
			--env PHP_WASI_PHP_VERSION="$PHP_WASI_PHP_VERSION" \
			--env PHP_WASI_VARIANT="$PHP_WASI_VARIANT" \
			--volume "$HOST_DIST_DIR:/work/dist" \
			"$IMAGE"
		;;
	validate)
		build_image
		docker run --rm \
			--user "$(id -u):$(id -g)" \
			--env PHP_WASI_PHP_VERSION="$PHP_WASI_PHP_VERSION" \
			--env PHP_WASI_VARIANT="$PHP_WASI_VARIANT" \
			--volume "$ROOT:/source:ro" \
			--entrypoint /source/validate.sh \
			"$IMAGE" "/source/dist/$COMPONENT_BASENAME"
		PHP_WASI_PHP_VERSION="$PHP_WASI_PHP_VERSION" \
			PHP_WASI_VARIANT="$PHP_WASI_VARIANT" \
			"$ROOT/verify-published.sh"
		;;
	*)
		echo "Usage: $0 [build|validate]" >&2
		exit 2
		;;
esac
