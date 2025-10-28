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

# Build libraries only (utilities would fail to link due to longjmp)
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_SKIP="-lc -lz -ljpeg" EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE $JSPI_FLAGS" emmake make || true

# Install what was built (libraries install even if utilities fail)
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE $JSPI_FLAGS" emmake make install || true

# Verify the libraries were built
RUN ls -la /root/install/lib/libMagickCore-7.Q16HDRI.a && \
    ls -la /root/install/lib/libMagickWand-7.Q16HDRI.a
