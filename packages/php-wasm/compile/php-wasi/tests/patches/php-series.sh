#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PHP_SERIES=${1:?Usage: php-series.sh PHP_SERIES [SOURCE_ARCHIVE]}
export PHP_WASI_PHP_VERSION=$PHP_SERIES
# shellcheck source=../../versions.env
source "$ROOT/versions.env"

if [[ "$PHP_SERIES" == 8.2 ]]; then
	PATCH_DIR="$ROOT/patches"
else
	PATCH_DIR="$ROOT/php-patches/$PHP_SERIES"
fi
if [[ ! -d "$PATCH_DIR" ]]; then
	echo "PHP $PHP_SERIES patch directory is missing: $PATCH_DIR" >&2
	exit 2
fi
mapfile -t PATCHES < <(find "$PATCH_DIR" -maxdepth 1 -type f -name '*.patch' -print | sort)
if [[ ${#PATCHES[@]} -eq 0 ]]; then
	echo "PHP $PHP_SERIES patch directory contains no patches: $PATCH_DIR" >&2
	exit 2
fi
EXPECTED_PATCH_NUMBERS=(0001 0002 0003 0004 0005)
case "$PHP_SERIES" in
	7.4|8.0|8.1) ;;
	*) EXPECTED_PATCH_NUMBERS+=(0006) ;;
esac
EXPECTED_PATCH_NUMBERS+=(0007 0008 0009 0010 0011 0012 0013 0014)
if [[ "$PHP_SERIES" == 7.4 ]]; then
	EXPECTED_PATCH_NUMBERS+=(0015)
fi
if [[ ${#PATCHES[@]} -ne ${#EXPECTED_PATCH_NUMBERS[@]} ]]; then
	echo "PHP $PHP_SERIES patch inventory has ${#PATCHES[@]} patches; expected ${#EXPECTED_PATCH_NUMBERS[@]}" >&2
	exit 2
fi
for index in "${!EXPECTED_PATCH_NUMBERS[@]}"; do
	patch_name=$(basename "${PATCHES[$index]}")
	patch_number=${patch_name%%-*}
	if [[ "$patch_number" != "${EXPECTED_PATCH_NUMBERS[$index]}" ]]; then
		echo "PHP $PHP_SERIES patch $((index + 1)) is $patch_name; expected ${EXPECTED_PATCH_NUMBERS[$index]}-*" >&2
		exit 2
	fi
done

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT
ARCHIVE=${2:-$ROOT/.build/downloads/php-src-$PHP_COMMIT.tar.gz}
if [[ ! -f "$ARCHIVE" && $# -lt 2 ]]; then
	ARCHIVE="$WORK_DIR/php-$PHP_COMMIT.tar.gz"
	curl --fail --location --silent --show-error \
		"https://github.com/php/php-src/archive/$PHP_COMMIT.tar.gz" \
		--output "$ARCHIVE"
elif [[ ! -f "$ARCHIVE" ]]; then
	echo "PHP source archive is missing: $ARCHIVE" >&2
	exit 2
fi
printf '%s  %s\n' "$PHP_SOURCE_SHA256" "$ARCHIVE" | sha256sum --check --status || {
	echo "PHP $PHP_SERIES source archive checksum mismatch: $ARCHIVE" >&2
	exit 1
}

SOURCE="$WORK_DIR/php"
mkdir -p "$SOURCE"
tar -xzf "$ARCHIVE" --strip-components=1 -C "$SOURCE"
for patch_file in "${PATCHES[@]}"; do
	patch --directory="$SOURCE" --strip=1 --batch --forward --fuzz=0 \
		--input="$patch_file" >/dev/null
done

echo "PHP $PHP_VERSION WASIp2 patch series (${#PATCHES[@]} patches) applies with --fuzz=0"
