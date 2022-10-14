#!/bin/bash

set -e

root_dir=../..
dest_dir=$root_dir/dist-web

cp ./docker-output/* $dest_dir/

for dir in wp-admin wp-content wp-includes; do
  rm -rf $dest_dir/$dir
  cp -r ./preload/wordpress-static/$dir $dest_dir/
done
