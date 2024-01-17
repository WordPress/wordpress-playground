FROM emscripten/emsdk:3.1.24 as emscripten
SHELL ["/bin/bash", "-c"]
WORKDIR /root

ARG WP_ZIP_URL=https://wordpress.org/wordpress-6.1.1.zip
ENV WP_ZIP_URL ${WP_ZIP_URL}

ARG OUT_FILENAME=wp
ENV OUT_FILENAME ${OUT_FILENAME}

RUN mkdir /root/output

RUN set -euxo pipefail;\
    apt-get update; \
    emsdk install latest;

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
    rm -rf wordpress/wp-content/plugins/sqlite-database-integration/.git && \
    # Required by the SQLite integration plugin:
    cp wordpress/wp-content/plugins/sqlite-database-integration/db.copy wordpress/wp-content/db.php && \
    cp wordpress/wp-config-sample.php wordpress/wp-config.php

# Remove the akismet plugin as it's not likely Playground sites will
# get many spammy comments :-)
RUN rm -rf wordpress/wp-content/plugins/akismet

# Separate WordPress static files
RUN cp -r wordpress wordpress-static && \
    cd wordpress-static && \
    find ./ -name '*.php' -delete && \
    # Keep only the static files inside the directories like wp-admin or wp-content:
    find . -maxdepth 1 -type f -delete && \
    # Remove all empty directories
    find . -type d -empty -delete

# Move the static files to the final output directory
RUN mkdir /root/output/$OUT_FILENAME
RUN mv wordpress-static/* /root/output/$OUT_FILENAME/

# === Minify WordPress ===

# Remove non-default themes

RUN cat wordpress/wp-includes/default-constants.php | awk -F"'" "/define\( 'WP_DEFAULT_THEME'/"'{print $4}' > wordpress/.default_theme

RUN export KEEP_THEME=$(cat wordpress/.default_theme); \
    cd wordpress/wp-content/themes && \
    rm -r $(ls | grep -v $KEEP_THEME)

# Remove unused static files
RUN cd wordpress && \
    find ./ -type f \( \
    -name '*.eot' -o -name '*.gif' -o -name '*.htaccess' \
    -o -name '*.md' -o -name '*.mp4' -o -name '*.png' \
    -o -name '*.scss' -o -name '*.stylelintignore' -o -name '*.svg' \
    -o -name '*.ttf' -o -name '*.txt' -o -name '*.woff' \
    -o -name '*.woff2' -o -name '*.jpeg' -o -name '*.jpg' \
    \) \
    # Preserve the wp-admin SVG files that are read  by PHP
    -not -path '*/wp-admin/images/*.svg' \
    # Some plugins use the dashicons font. See #729.
    -not -path '*/wp-includes/fonts/dashicons.svg' \
    # WordPress functions like wp_mime_type_icon() use
    # the icons shipped in images/media. See #770.
    -not -path '*/wp-includes/images/media/*' \
    -delete

# Keep only the CSS files that are read by PHP
RUN cd wordpress && \
    find ./ -type f -name '*.css' \
    -not -path '*/wp-includes/blocks/*/*.min.css' \
    -not -path '*/wp-content/themes/*/style.css' \
    -not -path '*/wp-includes/css/wp-embed-template.min.css' \
    -delete && \
    find ./ -type f -name '*-rtl.min.css' -delete && \
    # Keep only the JS files that are read by PHP
    find ./ -type f -name '*.js' \
    -not -path '*/wp-includes/blocks/*/*.min.js' \
    -not -name 'wp-emoji-loader.min.js' \
    -not -path '*/wp-includes/js/wp-embed.min.js' \
    -not -path '*/wp-includes/js/wp-embed-template.min.js' \
    # This file is patched in JavaScript and needs to
    # be served from VFS. See #703
    -not -path '*/wp-includes/js/dist/block-editor*.js' \
    # Akismet is shipped with WordPress and it
    # requires the included files to be present
    -not -path '*/wp-content/plugins/akismet/*' \
    -delete

RUN cd wordpress && \
    # Remove any empty directories
    find . -type d -empty -delete

FROM php:7.4-cli AS php
WORKDIR /root/
COPY --from=emscripten /root/wordpress ./wordpress
RUN apt update && apt install unzip

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

# === Create the mu-plugins directory ===
RUN mkdir wordpress/wp-content/mu-plugins

# === Install WP-CLI ===
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
    chmod +x wp-cli.phar

# === Install WordPress Importer ===
COPY ./build-assets/import-wxz.patch /root/
RUN cd wordpress/wp-content/plugins && \
    curl -L $(curl -s https://api.github.com/repos/WordPress/wordpress-importer/releases/latest | grep zip | cut -d '"' -f 4) > out && \
    unzip out && \
    rm out && \
    mv WordPress-* wordpress-importer && \
    cd wordpress-importer && \
    # Patch the WordPress Importer to support .wxz files
    patch -p1 < /root/import-wxz.patch && \
    cd ../../../ && \
    ../wp-cli.phar --allow-root plugin activate wordpress-importer

# === Install WordPress WXZ Exporter ===
COPY ./build-assets/export-wxz.php /root/
RUN cd wordpress && \
    cp /root/export-wxz.php wp-content/mu-plugins/export-wxz.php

# Strip whitespaces from PHP files.
# PHP 7.4 is a safe choice here: `php -w` ran on 7.4
# produces code compatible with PHP 8+, but the reverse
# isn't true.
RUN cd wordpress && \
    for phpfile in $(find ./ -type f -name '*.php' -not -path '*wordpress-importer*' -not -path '*wp-content*' ); do \
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
    | sed -E 's#xhr.onerror = #xhr.onerror = onLoadingFailed; const z = #g' \
    | sed -E 's#throw new Error\(xhr.+$#onLoadingFailed(event);#g' \
    | sed -E "s#Module\['removeRunDependency'\]\(dependencyFilename\);#Module['removeRunDependency'](dependencyFilename); resolve();#g" \
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
    > /root/esm-prefix.js

# Filename of the main dependency
RUN cp /root/esm-prefix.js /tmp/esm-prefix.js && \
    cat /tmp/esm-prefix.js | sed "s#WP_DATA_FILENAME#$OUT_FILENAME.data#g" > /root/esm-prefix.js

# Then, produce the final module:
RUN mv /root/output/wp.js /tmp/wp.js && \
    cat /root/esm-prefix.js /tmp/wp.js /root/esm-suffix.js > /root/output/$OUT_FILENAME.js && \
    rm /tmp/wp.js
