FROM emscripten/emsdk:3.1.24 as emscripten
SHELL ["/bin/bash", "-c"]
WORKDIR /root

ARG WP_ZIP_URL=https://wordpress.org/wordpress-6.0.2.zip
ENV WP_ZIP_URL ${WP_ZIP_URL}

RUN mkdir /root/output

RUN set -euxo pipefail;\
    apt-get update; \
    emsdk install latest

# Download specific version of WordPress
RUN wget -O wp.zip $WP_ZIP_URL && \
    unzip -q wp.zip && \
    rm wp.zip

# Patch WordPress with sqlite support
# https://github.com/aaemnnosttv/wp-sqlite-integration
# https://github.com/aaemnnosttv/wp-sqlite-db
RUN curl https://raw.githubusercontent.com/aaemnnosttv/wp-sqlite-db/master/src/db.php \
   | sed 's/$exploded_parts = $values_data;/$exploded_parts = array( $values_data );/g' \
   > wordpress/wp-content/db.php && \
   # Required by the drop-in SQLite integration plugin:
   cp wordpress/wp-config-sample.php wordpress/wp-config.php 

# Separate WordPress static files
RUN cp -r wordpress wordpress-static && \
    cd wordpress-static && \ 
    find ./ -name '*.php' -delete && \
    # Keep only the static files inside the directories like wp-admin or wp-content:
    find . -maxdepth 1 -type f -delete && \
    # Remove all empty directories
    find . -type d -empty -delete

# Move the static files to the final output directory
RUN mv wordpress-static/* /root/output

# === Minify WordPress ===

# Remove non-default themes
RUN cd wordpress && \
    rm -r wp-content/themes/twentytwenty wp-content/themes/twentytwentyone

# Remove unused static files
RUN cd wordpress && \
    find ./ -type f \( \
        -name '*.eot' -o -name '*.gif' -name '*.htaccess' \
        -name '*.md' -o -name '*.mp4' -name '*.png' \
        -name '*.scss' -o -name '*.stylelintignore' -name '*.svg' \
        -name '*.ttf' -o -name '*.txt' -name '*.woff' \
        -name '*.wof2' -o -name '*.jpeg' -name '*.jpg' \
    \) -delete

# Keep only the CSS files that are read by PHP
RUN cd wordpress && \
    find ./ -type f -name '*.css' \
        -not -path '*/wp-includes/blocks/*/*.min.css' \
        -not -path '*/wp-content/themes/*/style.css' \
        -delete && \
    find ./ -type f -name '*-rtl.min.css' -delete && \
    # Keep only the JS files that are read by PHP
    find ./ -type f -name '*.js' \
        -not -path '*/wp-includes/blocks/*/*.min.js' \
        -not -name 'wp-emoji-loader.min.js' \
        -delete

RUN cd wordpress && \
    # Remove any empty directories
    find . -type d -empty -delete

# Strip whitespaces from PHP files.
# PHP 7.4 is a safe choice here: `php -w` ran on 7.4
# produces code compatible with PHP 8+, but the reverse
# isn't true.
FROM php:7.4-cli AS php
WORKDIR /root/
COPY --from=emscripten /root/wordpress ./wordpress
RUN cd wordpress && \
    for phpfile in $(find ./ -type f -name '*.php'); do \
        # Remove whitespace from PHP files
        php -w $phpfile > $phpfile.small && \
        # remove set_time_limit function calls as they invoke the
        # setitimer system call unsupported by emscripten
        perl -pe 's/@?set_time_limit\([^)]+\)//g' $phpfile.small > $phpfile && \
        rm $phpfile.small; \
    done

# === Run WordPress Installer ===
RUN cd wordpress && \
    nohup bash -c "php -S 127.0.0.1:8000&" && \
    sleep 6; \
    http_response=$(curl -o ./debug.txt -s -w "%{http_code}\n" -XPOST http://127.0.0.1:8000/wp-admin/install.php\?step\=2 --data "language=en&prefix=wp_&weblog_title=My WordPress Website&user_name=admin&admin_password=password&admin_password2=password&Submit=Install WordPress&pw_weak=1&admin_email=admin@localhost.com") && \
    if [ "$http_response" != "200" ]; then \
        cat debug.txt && \
        exit 'WordPress installation failed'; \
    fi

FROM emscripten as emscripten2
RUN rm -rf wordpress
COPY --from=php /root/wordpress ./wordpress

# === Postprocess WordPress ===

# Disable load-scripts.php
RUN cd wordpress && \
    sed "s/<?php/<?php define( 'CONCATENATE_SCRIPTS', false );/" wp-config.php > wp-config.php.new && \
    mv wp-config.php.new wp-config.php

# Bundle the .data file using Emscripten 
RUN mv wordpress /wordpress && \
    /emsdk/upstream/emscripten/tools/file_packager.py \
	/root/output/wp.data \
	--no-node \
	--preload /wordpress \
	--js-output=/root/output/wp.js \
	--export-name="PHPModule" 
