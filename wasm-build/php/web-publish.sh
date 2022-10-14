#!/bin/bash

set -e

root_dir=../..
dest_dir=$root_dir/dist-web

cp ./docker-output/php* $dest_dir/
cp $root_dir/src/web/etc/php.ini $dest_dir/etc/
