#!/bin/bash

set -e

root_dir=../..
dest_dir=$root_dir/src/node/wordpress

rm -rf $dest_dir/*

for dir in wp-admin wp-content wp-includes; do
  cp -r ./preload/wordpress-static/$dir $dest_dir/
done

cp -r ./preload/wordpress/* $dest_dir/
