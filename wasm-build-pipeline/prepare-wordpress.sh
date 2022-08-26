#!/bin/bash

# Remove previous WordPress installation
rm -rf volume/*

set -e;

cd volume;

# Download WordPress
wget https://wordpress.org/wordpress-6.0.1.tar.gz
tar -xzvf wordpress-6.0.1.tar.gz

# Patch WordPress with sqlite support
# https://github.com/aaemnnosttv/wp-sqlite-integration
# https://github.com/aaemnnosttv/wp-sqlite-db
curl https://raw.githubusercontent.com/aaemnnosttv/wp-sqlite-db/master/src/db.php \
   | sed 's/$exploded_parts = $values_data;/$exploded_parts = array( $values_data );/g' \
   > wordpress/wp-content/db.php

# Install WordPress
cd wordpress;
cp wp-config-sample.php wp-config.php
php -S 127.0.0.1:8000&
sleep 6;
http_response=$(curl -o ./debug.txt -s -w "%{http_code}\n" -XPOST http://127.0.0.1:8000/wp-admin/install.php\?step\=2 --data "language=en&prefix=wp_&weblog_title=My WordPress Website&user_name=admin&admin_password=password&admin_password2=password&Submit=Install WordPress&pw_weak=1&admin_email=admin@localhost.com")
if [ $http_response != "200" ]; then
    exit 'WordPress installation failed';
    cat debug.txt;
else
pkill php

# Prepare WordPress static files
cd ..;
cp -r wordpress wordpress-static
cd wordpress-static
find ./ -name '*.php' | xargs rm
