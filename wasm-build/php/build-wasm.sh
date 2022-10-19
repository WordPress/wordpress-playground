#!/bin/bash

set -e

PHP_VERSION=${1:-8.0.24}
if [[ $PHP_VERSION == "7.*" ]]
then
  WITH_VRZNO="yes"
else
  WITH_VRZNO="no"
fi

if [ "$TARGET" = "nodejs" ]; then
  WITH_NODEFS="yes"
  EMSCRIPTEN_ENVIRONMENT="node"
else
  WITH_NODEFS="no"
  EMSCRIPTEN_ENVIRONMENT="web"
fi

rm -rf ./docker-output/* || true

docker build . \
  --tag=wasm-wordpress-php-builder \
  --progress=plain \
  --build-arg PHP_VERSION=$PHP_VERSION \
  --build-arg WITH_VRZNO="$WITH_VRZNO" \
  --build-arg WITH_LIBXML="no" \
  --build-arg WITH_LIBZIP="yes" \
  --build-arg WITH_NODEFS=$WITH_NODEFS \
  --build-arg EMSCRIPTEN_ENVIRONMENT=$EMSCRIPTEN_ENVIRONMENT

# Extract the output files
docker run \
  --name wasm-wordpress-php-cp \
  --rm \
  -v `pwd`/docker-output:/output \
  wasm-wordpress-php-builder \
  cp /root/output/{php.js,php.wasm} /output/

# Patch the buggy MEMFS.stream_ops.mmap method.
# It crashes when given a `stream` argument with null `stream.node.contents`.
# In practie, it makes copying empty files impossible, and
# installing plugins often involves copying empty files.
# Replace:
#   mmap:function(stream, address, length, position, prot, flags) {
#   // We don't currently support location hints for the address of the mapping
#      assert(address === 0);
# With:
#   mmap:function(stream, address, length, position, prot, flags) {
#      // We don't currently support location hints for the address of the mapping
#      assert(address === 0);
#      if (stream.node.contents === null) { stream.node.contents = new Uint8Array(0); };
 
cat ./docker-output/php.js | \
  perl -i -pe 'BEGIN{undef $/;} s#(mmap:\s*function\(\s*stream,\s*address,\s*length,\s*position,\s*prot,\s*flags\)\s*\{.*//[^\n]+\s*)(assert[^;]+;)#$1$2\nif (stream.node.contents === null) { stream.node.contents = new Uint8Array(0); };\n#sg' \
  > ./docker-output/php.js.tmp
mv ./docker-output/php.js.tmp ./docker-output/php.js

# Copy the build files to their relevant node.js and web directories
root_dir=../..
if [ "$TARGET" = "nodejs" ]; then
  # The default output file is already compatible with node.js
  # we only need to rename it
  mv ./docker-output/php.js ./docker-output/php-node.js
  cp ./docker-output/{php.wasm,php-node.js} $root_dir/src/node/
else
  # The webworker loader only differs by boolean flag.
  # Let's avoid a separate build and update the hardcoded
  # config value in the output file.
  cat ./docker-output/php.js \
      | sed 's/ENVIRONMENT_IS_WEB=true/ENVIRONMENT_IS_WEB=false/g' \
      | sed 's/ENVIRONMENT_IS_WORKER=false/ENVIRONMENT_IS_WORKER=true/g' \
      > ./docker-output/php-webworker.js

  # The default output file is already compatible with the web so
  # we only need to rename it
  mv ./docker-output/php.js ./docker-output/php-web.js
  cp ./docker-output/{php.wasm,php-web.js,php-webworker.js} $root_dir/dist-web/
fi

