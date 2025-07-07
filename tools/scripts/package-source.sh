#!/usr/bin/env bash

set -euo pipefail

if [ $# -ne 2 ]; then
	echo "Usage: package-source.sh <branch-name> <output-path>"
	exit 1;
fi

BRANCH_NAME="$1"
OUTPUT_PATH="$2"

if [[ "$OUTPUT_PATH" != *.tar.gz ]]; then
	echo 'Output path must end in ".tar.gz"'
	exit 1
fi

PATH_LEN=${#OUTPUT_PATH}
GZ_LEN=3
UNZIPPED_TAR_PATH="${OUTPUT_PATH::(($PATH_LEN-$GZ_LEN))}"

git archive --format="tar" "$BRANCH_NAME" -o "$UNZIPPED_TAR_PATH"
tar -u -f "$UNZIPPED_TAR_PATH" isomorphic-git
tar -u -f "$UNZIPPED_TAR_PATH" -C tools/scripts/assets BUILD-FROM-SOURCE-RELEASE.md
gzip "$UNZIPPED_TAR_PATH"
