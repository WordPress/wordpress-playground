# Originally forked from https://github.com/seanmorris/php-wasm
# ubuntu:noble supports amd64 and arm64 (Apple Silicon)
FROM ubuntu:noble as emscripten

SHELL ["/bin/bash", "-c"]

ENV PKG_CONFIG_PATH /root/lib/lib/pkgconfig
ENV TIMER "(which pv > /dev/null && pv --name '${@}' || cat)"

WORKDIR /root
RUN mkdir lib

RUN set -euxo pipefail;\
    export DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC; \
    apt-get update; \
    apt-get --no-install-recommends -y install \
    build-essential \
    automake \
    autoconf \
    libxml2-dev \
    libtool \
    pkgconf \
    flex \
    make \
    re2c \
    gdb \
    git \
    pv \
    ca-certificates \
    curl \
    wget \
    unzip \
    cmake \
    python3

# Install Emscripten from the repository. We'd use the official
# Docker image, but there is no arm64 image available which makes
# the build take forever on Apple Silicon.
#
# ---- IMPORTANT ----
# When upgrading the Emscripten version, you will need to rebuild all the WebAssembly libraries
# shipped in this repository before you can rebuild PHP itself. The entire build, including every
# linked lib, must be produced by the same Emscripten version – otherwise you'll run into undefined
# behaviors and indeterministic failures like we did in these two PRs:
#
# * https://github.com/WordPress/wordpress-playground/pull/1471
# * https://github.com/WordPress/wordpress-playground/pull/1339
#
# WASM libraries to rebuild live here:
# https://github.com/WordPress/wordpress-playground/tree/67d916b5eccfe78e26e9c953598cc1a81f316931/packages/php-wasm/compile
#
# Version 6.0.2 is required. MAIN_MODULE should not be built as RELOCATABLE.
# That behavior shipped in 4.0.19 and the RELOCATABLE setting was removed
# entirely in Emscripten 5.0.3:
# https://github.com/emscripten-core/emscripten/commit/4d16f757adcc801fb3f990ccb6100b747c815650
#
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN bash -euxo pipefail <<'EOF'
    git clone https://github.com/emscripten-core/emsdk.git
    EMSDK_NOTTY=1 EMSDK_USE_CURL=1 ./emsdk/emsdk install --notty 6.0.2
    EMSDK_NOTTY=1 /root/emsdk/emsdk activate --notty 6.0.2
EOF

RUN mkdir -p /root/lib/lib /root/lib/include /root/lib/share /root/lib/bin

# Create a script to capture libraries build in other steps
RUN echo $'#!/bin/bash\n\
for dir in $(ls $1); do \n\
    mkdir -p /root/lib/$dir/ && \n\
    cp -r /root/$1/$dir/* /root/lib/$dir/ 2>/dev/null || :; \n\
    done ' > /root/copy-lib.sh
RUN chmod a+x /root/copy-lib.sh
# Scripts to replace strings in files and exit with a non-zero status if the string is not found.
COPY ./replace.sh /root/replace.sh
RUN chmod a+x /root/replace.sh
COPY ./replace-across-lines.sh /root/replace-across-lines.sh
RUN chmod a+x /root/replace-across-lines.sh

COPY ./emcc-for-php-wasm.sh /root/emcc-for-php-wasm.sh

# Disable compiler-rt profiling runtime introduced by emscripten 4.0.11 #24160
RUN /root/replace.sh "s/src_files\s*\+=\s*glob_in_path\(profile_src_dir,\s*'\*\.cpp'\)//g" /root/emsdk/upstream/emscripten/tools/system_libs.py

# Keep the Asyncify shared globals exported from MAIN_MODULE builds at -O3.
#
# Since emscripten 4.0.22 (emscripten-core/emscripten#25877), an Asyncify main
# module no longer imports __asyncify_state/__asyncify_data from JS. Instead,
# Binaryen's post-link asyncify pass defines AND exports them from the main
# module, and side modules import them from it. However, at -O3 emcc also runs
# wasm-metadce, which only roots user-requested exports — the asyncify globals
# are not among them and nothing in the JS glue references them, so metadce
# strips the exports. Side modules then fail to instantiate with:
#   LinkError: import env.__asyncify_state: imported mutable global must be a
#   WebAssembly.Global object
# Root the two globals in metadce's graph so the exports survive. This is a
# no-op for non-main-module and JSPI (ASYNCIFY=2) builds, where these exports
# don't exist.
RUN /root/replace.sh "s/required_symbols = user_requested_exports\.union\(set\(settings\.SIDE_MODULE_IMPORTS\)\)/required_symbols = user_requested_exports.union(set(settings.SIDE_MODULE_IMPORTS)).union({'__asyncify_state', '__asyncify_data'})/g" /root/emsdk/upstream/emscripten/tools/building.py

# Patch emcc to allow skipping flags and passing additional flags using environment variables.
#
# We're compiling libraries statically using emscripten's -sSIDE_MODULE. It differs from the usual unix
# process as we're *not* supposed to link intermediate libraries against their dependencies. Instead,
# We'll provide all the static libraries in the final linking step.
#
# Unfortunately, most Makefiles stubbornly add -lz, -lxml2, etc. to the intermediate
# emcc calls, which causes the build to fail. This patch:
# * Enables force-removing linker options when running emcc
# * Enables adding -sSIDE_MODULE when running emcc
#
# Usage:
#  EMCC_SKIP="-lz -lxml2" EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE" emmake make
#               ↑                            ↑
#    ┌──────────┴─────────────┐   ┌──────────┴─────────────┐
#    │  skip those flags when │   │  add these flags when  │
#    │      calling emcc      │   │    calling emcc        │
#    └────────────────────────┘   └────────────────────────┘
RUN <<EOF
    set -euo pipefail
    cp /root/emsdk/upstream/emscripten/emcc /root/emsdk/upstream/emscripten/emcc2
    cp /root/emsdk/upstream/emscripten/emcc.py /root/emsdk/upstream/emscripten/emcc2.py
    cp /root/emcc-for-php-wasm.sh /root/emsdk/upstream/emscripten/emcc
    chmod a+x /root/emsdk/upstream/emscripten/emcc
EOF
