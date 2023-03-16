FROM emscripten/emsdk:3.1.24 as emscripten
SHELL ["/bin/bash", "-c"]
WORKDIR /root

ARG WP_ZIP_URL=https://wordpress.org/wordpress-6.1.1.zip
ENV WP_ZIP_URL ${WP_ZIP_URL}

ARG OUT_FILENAME=wp
ENV OUT_FILENAME ${OUT_FILENAME}

ARG KEEP_THEME
ENV KEEP_THEME ${KEEP_THEME}

RUN mkdir /root/output

RUN set -euxo pipefail;\
    apt-get update; \
    emsdk install latest

# Download specific version of WordPress
RUN wget -O wp.zip $WP_ZIP_URL && \
    unzip -q wp.zip && \
    rm wp.zip

# Enable the SQLite support:
# https://github.com/WordPress/sqlite-database-integration
RUN git clone https://github.com/WordPress/sqlite-database-integration.git \
    wordpress/wp-content/plugins/sqlite-database-integration \
    --branch main   \
    --single-branch \
    --depth 1 &&    \
    cat wordpress/wp-content/plugins/sqlite-database-integration/db.copy \
        | sed 's#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#'`pwd`'/wordpress/wp-content/plugins/sqlite-database-integration#g' \
        | sed 's#{SQLITE_PLUGIN}#sqlite-database-integration#g' \
        > wordpress/wp-content/db.php && \
    # Required by the SQLite integration plugin:
    cp wordpress/wp-config-sample.php wordpress/wp-config.php

# Separate WordPress static files
RUN cp -r wordpress wordpress-static && \
    cd wordpress-static && \ 
    find ./ -name '*.php' -delete && \
    # Keep only the static files inside the directories like wp-admin or wp-content:
    find . -maxdepth 1 -type f -delete && \
    # Remove all empty directories
    find . -type d -empty -delete

# Pair the site editor's nested iframe to the Service Worker.
# 
# Without the patch below, the site editor initiates network requests that
# aren't routed through the service worker. That's a known browser issue:
# 
# * https://bugs.chromium.org/p/chromium/issues/detail?id=880768
# * https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
# * https://github.com/w3c/ServiceWorker/issues/765
# 
# The problem with iframes using srcDoc and src="about:blank" as they
# fail to inherit the root site's service worker.
# 
# Gutenberg loads the site editor using <iframe srcDoc="<!doctype html">
# to force the standards mode and not the quirks mode:
# 
# https://github.com/WordPress/gutenberg/pull/38855
# 
# This commit patches the site editor to achieve the same result via
# <iframe src="/doctype.html"> and a doctype.html file containing just
# `<!doctype html>`. This allows the iframe to inherit the service worker
# and correctly load all the css, js, fonts, images, and other assets.
# 
# Ideally this issue would be fixed directly in Gutenberg and the patch
# below would be removed.
# 
# See https://github.com/WordPress/wordpress-playground/issues/42 for more details

RUN echo '<!doctype html>' > wordpress-static/wp-includes/empty.html &&  \
    sed -E 's#srcDoc:"[^"]+"#src:"/wp-includes/empty.html"#g' -i wordpress-static/wp-includes/js/dist/block-editor.min.js && \
    sed -E 's#srcDoc:"[^"]+"#src:"/wp-includes/empty.html"#g' -i wordpress-static/wp-includes/js/dist/block-editor.js

# Move the static files to the final output directory
RUN mkdir /root/output/$OUT_FILENAME
RUN mv wordpress-static/* /root/output/$OUT_FILENAME/

# === Minify WordPress ===

# Remove non-default themes
RUN cd wordpress/wp-content/themes && \
    rm -r $(ls | grep -v $KEEP_THEME)

# Remove unused static files
RUN cd wordpress && \
    find ./ -type f \( \
    -name '*.eot' -o -name '*.gif' -o -name '*.htaccess' \
    -o -name '*.md' -o -name '*.mp4' -o -name '*.png' \
    -o -name '*.scss' -o -name '*.stylelintignore' -o -name '*.svg' \
    -o -name '*.ttf' -o -name '*.txt' -o -name '*.woff' \
    -o -name '*.woff2' -o -name '*.jpeg' -o -name '*.jpg' \
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

FROM php:7.4-cli AS php
WORKDIR /root/
COPY --from=emscripten /root/wordpress ./wordpress

# === Run WordPress Installer ===
RUN ls -la && \
    cd wordpress && \
    nohup bash -c "php -S 127.0.0.1:8000&" && \
    sleep 6; \
    http_response=$(curl -o ./debug.txt -s -w "%{http_code}\n" -XPOST http://127.0.0.1:8000/wp-admin/install.php\?step\=2 --data "language=en&prefix=wp_&weblog_title=My WordPress Website&user_name=admin&admin_password=password&admin_password2=password&Submit=Install WordPress&pw_weak=1&admin_email=admin@localhost.com") && \
    if [ "$http_response" != "200" ]; then \
    cat debug.txt && \
    exit 'WordPress installation failed'; \
    fi

# === Install WP-CLI ===
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
    chmod +x wp-cli.phar

# === Install WordPress Importer ===
RUN cd wordpress && \
    ../wp-cli.phar --allow-root plugin install wordpress-importer && \
    ../wp-cli.phar --allow-root plugin activate wordpress-importer

# Strip whitespaces from PHP files.
# PHP 7.4 is a safe choice here: `php -w` ran on 7.4
# produces code compatible with PHP 8+, but the reverse
# isn't true.
RUN cd wordpress && \
    for phpfile in $(find ./ -type f -name '*.php' -not -path '*wordpress-importer*' ); do \
    # Remove whitespace from PHP files
    php -w $phpfile > $phpfile.small && \
    # remove set_time_limit function calls as they invoke the
    # setitimer system call unsupported by emscripten
    perl -pe 's/@?set_time_limit\([^)]+\)//g' $phpfile.small > $phpfile && \
    rm $phpfile.small; \
    done

FROM emscripten as emscripten2
RUN rm -rf ./wordpress
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
    --export-name="PHPModule" \
    --no-node \
    --preload /wordpress \
    --js-output=/root/output/wp.js && \
    if [ "$OUT_FILENAME" != "wp" ]; then \
    mv /root/output/wp.data /root/output/$OUT_FILENAME.data; \
    fi

COPY ./build-assets/esm-prefix.js ./build-assets/esm-suffix.js /root/

# It's useful to add a "cache busting" query string to the .data file URL.
# This tells web browsers it's a new file and they should reload it.
RUN cat /root/output/wp.js \
    | sed -E "s#'[^']*wp\.data'#dependencyFilename#g" \
    > /tmp/wp.js && \
    mv /tmp/wp.js /root/output/wp.js;

# Manually turn the output into an esm module instead of relying on -s MODULARIZE=1.
# See esm-prefix.js for more details.

# First, populate the php.js module exports:
# * Total size of the loaded dependencies – useful for progress bars.
RUN cp /root/esm-prefix.js /tmp/esm-prefix.js && \
    export FILE_SIZE=$(stat -c%s "/root/output/$OUT_FILENAME.data") && \
    cat /tmp/esm-prefix.js \
    | sed "s#WP_DATA_SIZE#$FILE_SIZE#g" \
    | sed "s#WP_THEME_NAME#'$KEEP_THEME'#g" \
    > /root/esm-prefix.js

# Filename of the main dependency
RUN cp /root/esm-prefix.js /tmp/esm-prefix.js && \
    cat /tmp/esm-prefix.js | sed "s#WP_DATA_FILENAME#$OUT_FILENAME.data#g" > /root/esm-prefix.js

# Then, produce the final module:
RUN mv /root/output/wp.js /tmp/wp.js && \
    cat /root/esm-prefix.js /tmp/wp.js /root/esm-suffix.js > /root/output/$OUT_FILENAME.js && \
    rm /tmp/wp.js
