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

# === Create the mu-plugins directory ===
RUN mkdir wordpress/wp-content/mu-plugins

# Enable the SQLite support as a mu-plugin to:
# * Ensure it won't accidentally be disabled by the user
# * Prevent it from blocking a multisite setup where disabling all the plugins is required
# https://github.com/WordPress/sqlite-database-integration
RUN git clone https://github.com/WordPress/sqlite-database-integration.git \
    wordpress/wp-content/mu-plugins/sqlite-database-integration \
    --branch main   \
    --single-branch \
    --depth 1 &&    \
    rm -rf wordpress/wp-content/mu-plugins/sqlite-database-integration/.git && \
    # Required by the SQLite integration plugin:
    cat wordpress/wp-content/mu-plugins/sqlite-database-integration/db.copy \
    | sed "s#'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'#__DIR__.'/mu-plugins/sqlite-database-integration/'#g" \
    | sed "s#'{SQLITE_PLUGIN}'#__DIR__.'/mu-plugins/sqlite-database-integration/load.php'#g" \
    > wordpress/wp-content/db.php && \
    echo '<?php require_once __DIR__ . "/sqlite-database-integration/load.php"; ' > \
    wordpress/wp-content/mu-plugins/0-sqlite.php && \
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

# Remove the sqlite database integration from the static files
RUN rm -rf wordpress-static/wp-content/mu-plugins

# List assets that will be available to remotely so Playground can judge whether
# to request a remote asset or delegate the request for a missing file to PHP.
RUN find wordpress-static -type f | sed 's#^wordpress-static/##'> wordpress-remote-asset-paths

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

FROM php:8.0-cli AS php
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

# === Install WP-CLI ===
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
    chmod +x wp-cli.phar

# Strip whitespaces from PHP files.
# PHP >= 8.0 is needed to preserve PHP 8.0 attributes,
# like #[Attribute] and #[Pure]. In PHP 7.4, they are
# treated as comments and removed by the whitespace stripping.
COPY ./build-assets/add-newlines-after-annotations.php /root/
RUN cd wordpress && \
    for phpfile in $(\
    find ./ -type f -name '*.php' \
    -not -path '*wp-content*' \
    # wp-cli expects an unminified wp-config.php
    -not -path '*wp-config.php' \
    ); do \
    # Remove whitespace from PHP files
    php -w $phpfile > $phpfile.small && \
    # remove set_time_limit function calls as they invoke the
    # setitimer system call unsupported by emscripten
    perl -pe 's/@?set_time_limit\([^)]+\)//g' $phpfile.small > $phpfile && \
    # Add newlines after PHP 8.0 attributes
    php /root/add-newlines-after-annotations.php $phpfile && \
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

# Build the final wp.zip file
RUN mv wordpress /wordpress && \
    cp wordpress-remote-asset-paths /wordpress/ && \
    cd /wordpress && \
    zip /root/output/$OUT_FILENAME.zip -r .
