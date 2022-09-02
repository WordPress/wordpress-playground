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

# Prepare WordPress static files
cp -r wordpress wordpress-static
cd wordpress-static
find ./ -name '*.php' | xargs rm
cd ..;

# Install WordPress
cd wordpress;

# Remove unused static files
find ./ -type f -name '*.eot' | xargs rm -r
find ./ -type f -name '*.gif' | xargs rm -r
find ./ -type f -name '*.htaccess' | xargs rm -r
find ./ -type f -name '*.md' | xargs rm -r
find ./ -type f -name '*.mp4' | xargs rm -r
find ./ -type f -name '*.png' | xargs rm -r
find ./ -type f -name '*.scss' | xargs rm -r
find ./ -type f -name '*.stylelintignore' | xargs rm -r
find ./ -type f -name '*.svg' | xargs rm -r
find ./ -type f -name '*.ttf' | xargs rm -r
find ./ -type f -name '*.txt' | xargs rm -r
find ./ -type f -name '*.woff' | xargs rm -r
find ./ -type f -name '*.wof2' | xargs rm -r
find ./ -type f -name '*.jpeg' | xargs rm -r
find ./ -type f -name '*.jpg' | xargs rm -r

# load-styles.php reads the CSS files from the disk and concats them.
# However, with SCRIPT_DEBUG=false, it reads only the minified files.
# Therefore, we can remove the unminified CSS files when a minified version is available.
find ./ -type f -name '*.min.css' | sed 's/\.min\.css$/.css/g' | xargs rm 2> /dev/null

# Same as above, but for JS and load-scripts.php
find ./ -type f -name '*.min.js' | sed 's/\.min\.js$/.js/g' | xargs rm 2> /dev/null

# Remove the RTL styles at least for the MVP version of wordpress-wasm.
find ./ -type f -name '*-rtl.min.css' | xargs rm 2> /dev/null

# Remove non-default themes
rm -r wp-content/themes/twentytwenty wp-content/themes/twentytwentyone

# Remove whitespace from PHP files
for phpfile in $(find ./ -type f -name '*.php'); do
    php -w $phpfile > $phpfile.small;
    mv $phpfile.small $phpfile;
done;

# Let the WordPress installer do its magic
cp wp-config-sample.php wp-config.php # Required by the drop-in SQLite integration plugin
php -S 127.0.0.1:8000&
sleep 6;
http_response=$(curl -o ./debug.txt -s -w "%{http_code}\n" -XPOST http://127.0.0.1:8000/wp-admin/install.php\?step\=2 --data "language=en&prefix=wp_&weblog_title=My WordPress Website&user_name=admin&admin_password=password&admin_password2=password&Submit=Install WordPress&pw_weak=1&admin_email=admin@localhost.com")
pkill php
if [ $http_response != "200" ]; then
    exit 'WordPress installation failed';
    cat debug.txt;
fi;
