#!/bin/bash

# This script finds the hostname assignment in mysqlnd driver
# and modifies it to use 127.0.0.1 instead of localhost.
# 
# We don't use a .patch file because the line numbers differ between
# PHP versions.

TARGET_FILE="php-src/ext/mysqlnd/mysqlnd_connection.c"

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: $TARGET_FILE not found"
    exit 1
fi

if grep -q "effective_host" "$TARGET_FILE"; then
    echo "Patch already applied to $TARGET_FILE"
    exit 0
fi

# Replace the hostname assignment line with our patched version
sed -i.bak 's/MYSQLND_CSTRING hostname = { host, host? strlen(host) : 0 };/\tconst char * effective_host = (host \&\& strcmp(host, "localhost") == 0) ? "127.0.0.1" : host;\
\tMYSQLND_CSTRING hostname = { effective_host, effective_host ? strlen(effective_host) : 0 };/' "$TARGET_FILE"

# Check if the replacement was successful
if grep -q "effective_host" "$TARGET_FILE"; then
    rm -f "$TARGET_FILE.bak"
    echo "Successfully applied mysqlnd patch to $TARGET_FILE"
else
    # Restore backup if replacement failed
    if [ -f "$TARGET_FILE.bak" ]; then
        mv "$TARGET_FILE.bak" "$TARGET_FILE"
    fi
    echo "Failed to apply mysqlnd patch to $TARGET_FILE"
    exit 1
fi
