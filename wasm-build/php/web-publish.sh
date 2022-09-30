#!/bin/bash

set -e

root_dir=../..
dest_dir=$root_dir/dist-web

cp ./docker-output/webworker-* $dest_dir/
cp $root_dir/src/shared/etc/php.ini $dest_dir/etc/
