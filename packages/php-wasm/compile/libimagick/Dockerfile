# Build ImageMagick libraries for WebAssembly (Emscripten)
# - Compiles ImageMagick from official source using emscripten/emsdk
# - Produces static libs (MagickCore, MagickWand) suitable for linking
# - Copies headers and a tiny link-test into /dist

ARG EMSDK_VERSION=3.1.64
ARG IMAGEMAGICK_VERSION=7.1.1-34

FROM --platform=linux/amd64 emscripten/emsdk:${EMSDK_VERSION} AS build

SHELL ["/bin/bash", "-lc"]

ARG IMAGEMAGICK_VERSION
ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
COPY ./libpng16/ /root/libpng16
COPY ./libjpeg/ /root/libjpeg

RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/*/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/*/asyncify/dist/root/lib/* /root/lib; \
    fi

# Install build helpers that aren’t preinstalled in the base image
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       ca-certificates curl xz-utils autoconf automake libtool pkg-config \
       make cmake ninja-build git file python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Fetch ImageMagick source from Git (avoid release tarball 404s)
RUN git clone https://github.com/ImageMagick/ImageMagick.git ImageMagick \
    && cd ImageMagick \
    && (git checkout "refs/tags/${IMAGEMAGICK_VERSION}" -b build-ref || git checkout "${IMAGEMAGICK_VERSION}")

WORKDIR /src/ImageMagick

# Configure for Emscripten
# Notes:
# - Disable features requiring OS/threads or delegates we won’t provide here.
# - Build static only; these .a archives are LLVM bitcode built by emcc.
# - Use emconfigure/emmake to cross-compile tests correctly.
ENV EMCC_CFLAGS="-O3 -s USE_ZLIB=1 -s USE_LIBPNG=1 -s USE_LIBJPEG=1 -s ALLOW_MEMORY_GROWTH=1"
ENV EMCC_LDFLAGS="-O3 -s USE_ZLIB=1 -s USE_LIBPNG=1 -s USE_LIBJPEG=1 -s ALLOW_MEMORY_GROWTH=1"

RUN \
  emconfigure ./configure \
    --build i386-pc-linux-gnu \
    --host=wasm32-unknown-emscripten \
	--prefix=/root/lib/ \
    --disable-shared \
    --enable-static \
    --disable-hdri \
    --with-quantum-depth=16 \
    --disable-openmp \
    --without-utilities \
    --without-perl \
    --without-x \
    --with-modules=no \
    --with-threads=no \
    --enable-delegate-build=no \
    --with-png=/root/lib \
    --with-jpeg=/root/lib \
    --with-zlib=/root/lib \
    --with-tiff=no \
    --with-xml=no \
    --with-lcms=no \
    --with-webp=no \
    --with-openjp2=no \
    --with-heic=no \
    --with-freetype=no \
    CFLAGS="${EMCC_CFLAGS}" CXXFLAGS="${EMCC_CFLAGS}" \
    LDFLAGS="${EMCC_LDFLAGS}" LIBS=""

# Build and install into a staging prefix
RUN emmake make -j"$(nproc)" \
 && emmake make install

# Prepare dist directory with headers, libs, and a tiny link test
WORKDIR /work
RUN mkdir -p /dist/lib /dist/include /dist/examples

