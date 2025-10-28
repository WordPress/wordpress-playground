FROM playground-php-wasm:base

ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib

# Copy pre-built dependencies that ImageMagick will use
COPY ./libz/ /root/libz
COPY ./libjpeg/ /root/libjpeg

# Copy dependencies to /root/lib based on JSPI mode
RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
        cp -r /root/libjpeg/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
        cp -r /root/libjpeg/asyncify/dist/root/lib/* /root/lib; \
    fi

# Download ImageMagick 7.1.1-39 (compatible with modern PHP imagick extension)
RUN wget https://github.com/ImageMagick/ImageMagick/archive/refs/tags/7.1.1-39.tar.gz -O ImageMagick.tar.gz
RUN tar -xzf ImageMagick.tar.gz
WORKDIR /root/ImageMagick-7.1.1-39

# Configure ImageMagick with minimal feature set suitable for web/WASM
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    CPPFLAGS="-I/root/lib/include" \
    LDFLAGS="-L/root/lib/lib" \
    emconfigure ./configure \
        PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
        --build i386-pc-linux-gnu \
        --target wasm32-unknown-emscripten \
        --prefix=/root/install \
        --disable-shared \
        --enable-static \
        --without-threads \
        --without-magick-plus-plus \
        --without-perl \
        --without-x \
        --without-dps \
        --without-djvu \
        --without-fftw \
        --without-fpx \
        --without-fontconfig \
        --without-freetype \
        --without-raqm \
        --without-gslib \
        --without-gvc \
        --without-heic \
        --without-jbig \
        --without-openjp2 \
        --without-lzma \
        --without-openexr \
        --without-pango \
        --without-rsvg \
        --without-tiff \
        --without-wmf \
        --without-xml \
        --without-zstd \
        --without-png \
        --with-jpeg=yes \
        --without-webp \
        --with-zlib=yes

# Build only the library targets (skip utilities which fail to link due to longjmp)
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_SKIP="-lc -lz -ljpeg" EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE $JSPI_FLAGS" emmake make MagickCore/libMagickCore-7.Q16HDRI.la MagickWand/libMagickWand-7.Q16HDRI.la

# Install the libraries, headers, and config scripts manually
# Headers need to be in ImageMagick-7/MagickWand/ and ImageMagick-7/MagickCore/ for imagick extension
RUN mkdir -p /root/install/lib /root/install/include/ImageMagick-7/MagickCore /root/install/include/ImageMagick-7/MagickWand /root/install/bin /root/install/lib/pkgconfig && \
    cp MagickCore/.libs/libMagickCore-7.Q16HDRI.a /root/install/lib/ && \
    cp MagickWand/.libs/libMagickWand-7.Q16HDRI.a /root/install/lib/ && \
    cp MagickCore/*.h /root/install/include/ImageMagick-7/MagickCore/ && \
    cp MagickWand/*.h /root/install/include/ImageMagick-7/MagickWand/ && \
    ln -s ImageMagick-7/MagickCore /root/install/include/MagickCore && \
    ln -s ImageMagick-7/MagickWand /root/install/include/MagickWand

# Generate config scripts for both wasm32-unknown-emscripten and standard names
# Note: prefix is set to /root/lib because that's where files will be copied in PHP container
RUN cd /root/install/bin && \
    echo '#!/bin/sh' > MagickWand-config && \
    echo 'prefix=/root/lib' >> MagickWand-config && \
    echo 'exec_prefix=${prefix}' >> MagickWand-config && \
    echo 'libdir=${exec_prefix}/lib' >> MagickWand-config && \
    echo 'includedir=${prefix}/include/ImageMagick-7' >> MagickWand-config && \
    echo 'case "$1" in' >> MagickWand-config && \
    echo '  --version) echo "7.1.1" ;;' >> MagickWand-config && \
    echo '  --cflags) echo "-I${includedir}/MagickWand -I${includedir}/MagickCore -DMAGICKCORE_HDRI_ENABLE=1 -DMAGICKCORE_QUANTUM_DEPTH=16" ;;' >> MagickWand-config && \
    echo '  --ldflags) echo "-L${libdir}" ;;' >> MagickWand-config && \
    echo '  --libs) echo "-lMagickWand-7.Q16HDRI -lMagickCore-7.Q16HDRI" ;;' >> MagickWand-config && \
    echo '  --prefix) echo "${prefix}" ;;' >> MagickWand-config && \
    echo '  *) echo "Unknown option: $1" >&2; exit 1 ;;' >> MagickWand-config && \
    echo 'esac' >> MagickWand-config && \
    chmod +x MagickWand-config && \
    cp MagickWand-config MagickCore-config && \
    cp MagickWand-config wasm32-unknown-emscripten-MagickWand-config && \
    cp MagickWand-config wasm32-unknown-emscripten-MagickCore-config

# Verify the libraries were built
RUN ls -la /root/install/lib/libMagickCore-7.Q16HDRI.a && \
    ls -la /root/install/lib/libMagickWand-7.Q16HDRI.a
