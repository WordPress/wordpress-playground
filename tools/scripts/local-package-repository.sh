#!/bin/bash

for arg in "$@"; do
  case $arg in
    --version=*)
      VERSION="${arg#*=}"
      shift
      ;;
    --skip-packaging)
      SKIP_PACKAGING=1
      shift
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  VERSION=$(openssl rand -hex 12)
fi
PACKAGE_JSON_VERSION=$(jq -r '.version' ./lerna.json)

PORT=9724
HOST_URL="http://127.0.0.1:$PORT/$VERSION"
HOST_PATH="./dist/packages-for-self-hosting/http%3A%2F%2F127.0.0.1%3A$PORT%2F$VERSION"

# Create the package repository
if [ -z "$SKIP_PACKAGING" ]; then
  npx nx run-many --all --target=package-for-self-hosting -- --hostingBaseUrl="$HOST_URL"
fi

echo "Package repository is running at $HOST_URL"

# List all files from the package host path as urls
ls -la "$HOST_PATH/v$PACKAGE_JSON_VERSION" | awk '{print "'$HOST_URL'/v'$PACKAGE_JSON_VERSION'/" $9}'

printf "%s" "$VERSION" | pbcopy
echo "Version number $VERSION copied to clipboard"
echo "Use Ctrl+C to stop the server"

node \
  --no-warnings \
  --experimental-wasm-stack-switching \
  --experimental-wasm-jspi \
  --loader=./packages/meta/src/node-es-module-loader/loader.mts \
  ./packages/playground/cli/src/cli.ts server \
  --port=$PORT \
  --mount="$HOST_PATH:/wordpress/$VERSION" \
  --quiet
