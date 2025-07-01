#!/bin/bash 

# This script is used to replace strings in files and exit with a non-zero status if the string is not found.
# This version of the script can do replacements across multiple lines.

perl -0 -pi.bak -e "$1" "$2"
if [ $? -ne 0 ]; then
    echo "Failed to replace $1 in file $2 - exiting with non-zero status"
    exit 1
fi
if cmp --silent -- "$2" "$2.bak"; then
    echo "No matches found for $1 in file $2 - exiting with non-zero status"
    exit 1
fi
