FROM playground-php-wasm:base

ARG JSPI
ARG GD_VERSION="2.3.3"

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
COPY ./libpng16/ /root/libpng16
COPY ./libjpeg/ /root/libjpeg
COPY ./libwebp/ /root/libwebp
COPY ./libavif/ /root/libavif
COPY ./libgd/libavifConfig.cmake /tmp/libavifConfig.cmake
COPY ./libgd/libavifConfigVersion.cmake /tmp/libavifConfigVersion.cmake

RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
        cp -r /root/libpng16/jspi/dist/root/lib/* /root/lib; \
        cp -r /root/libjpeg/jspi/dist/root/lib/* /root/lib; \
        cp -r /root/libwebp/jspi/dist/root/lib/* /root/lib; \
        cp -r /root/libavif/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
        cp -r /root/libpng16/asyncify/dist/root/lib/* /root/lib; \
        cp -r /root/libjpeg/asyncify/dist/root/lib/* /root/lib; \
        cp -r /root/libwebp/asyncify/dist/root/lib/* /root/lib; \
        cp -r /root/libavif/asyncify/dist/root/lib/* /root/lib; \
    fi
RUN mkdir -p /root/lib/lib/cmake/libavif && \
    cp /tmp/libavifConfig.cmake /root/lib/lib/cmake/libavif/libavifConfig.cmake && \
    cp /tmp/libavifConfigVersion.cmake /root/lib/lib/cmake/libavif/libavifConfigVersion.cmake

RUN wget https://github.com/libgd/libgd/releases/download/gd-$GD_VERSION/libgd-$GD_VERSION.tar.gz -O libgd.tar.gz
RUN tar -xzf libgd.tar.gz
WORKDIR /root/libgd-$GD_VERSION

# Patch gd_security.c to make overflow2 static (avoids duplicate symbol with PHP's gd_compat.o)
RUN sed -i 's/^int overflow2/static int overflow2/' /root/libgd-$GD_VERSION/src/gd_security.c

# Patch gdkanji.c to make iconv stubs static (avoids duplicate symbol with emscripten libc)
# Need to update both forward declarations and definitions
RUN sed -i 's/^iconv_t iconv_open (const char/static iconv_t iconv_open (const char/' /root/libgd-$GD_VERSION/src/gdkanji.c && \
    sed -i 's/^size_t iconv (iconv_t/static size_t iconv (iconv_t/' /root/libgd-$GD_VERSION/src/gdkanji.c && \
    sed -i 's/^int iconv_close (iconv_t/static int iconv_close (iconv_t/' /root/libgd-$GD_VERSION/src/gdkanji.c && \
    sed -i 's/^iconv_open (/static iconv_open (/' /root/libgd-$GD_VERSION/src/gdkanji.c && \
    sed -i 's/^iconv (/static iconv (/' /root/libgd-$GD_VERSION/src/gdkanji.c && \
    sed -i 's/^iconv_close (/static iconv_close (/' /root/libgd-$GD_VERSION/src/gdkanji.c

# Add stub implementations for FreeType functions when FreeType is disabled
# These are needed because PHP's GD extension expects them
RUN echo '' >> /root/libgd-$GD_VERSION/src/gd.c && \
    echo '/* Stub implementations for when FreeType is disabled */' >> /root/libgd-$GD_VERSION/src/gd.c && \
    echo '#ifndef HAVE_LIBFREETYPE' >> /root/libgd-$GD_VERSION/src/gd.c && \
    echo '#include "gd.h"' >> /root/libgd-$GD_VERSION/src/gd.c && \
    echo 'BGD_DECLARE(void) gdFontCacheShutdown(void) {}' >> /root/libgd-$GD_VERSION/src/gd.c && \
    echo 'BGD_DECLARE(void) gdFreeFontCache(void) {}' >> /root/libgd-$GD_VERSION/src/gd.c && \
    echo '#endif' >> /root/libgd-$GD_VERSION/src/gd.c

RUN set -euxo pipefail; \
    source /root/emsdk/emsdk_env.sh; \
    export PKG_CONFIG_PATH=/root/lib/lib/pkgconfig:$PKG_CONFIG_PATH; \
    emcmake cmake -G"Unix Makefiles" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/root/install \
        -DCMAKE_PREFIX_PATH=/root/lib \
        -DZLIB_LIBRARY=/root/lib/lib/libz.a \
        -DZLIB_INCLUDE_DIR=/root/lib/include \
        -DPNG_LIBRARY=/root/lib/lib/libpng16.a \
        -DPNG_PNG_INCLUDE_DIR=/root/lib/include \
        -DJPEG_LIBRARY=/root/lib/lib/libjpeg.a \
        -DJPEG_INCLUDE_DIR=/root/lib/include \
        -DWEBP_LIBRARY=/root/lib/lib/libwebp.a \
        -DWEBP_LIBRARIES="/root/lib/lib/libwebp.a;/root/lib/lib/libsharpyuv.a" \
        -DWEBP_INCLUDE_DIR=/root/lib/include \
        -DAVIF_LIBRARY=/root/lib/lib/libavif.a \
        -DAVIF_INCLUDE_DIR=/root/lib/include \
        -Dlibavif_DIR=/root/lib/lib/cmake/libavif \
        -DBUILD_STATIC_LIBS=ON \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_TEST=OFF \
        -DBUILD_PROGRAMS=OFF \
        -DENABLE_CPP=OFF \
        -DENABLE_GD_FORMATS=ON \
        -DENABLE_PNG=ON \
        -DENABLE_JPEG=ON \
        -DENABLE_WEBP=ON \
        -DENABLE_AVIF=ON \
        -DENABLE_LIQ=OFF \
        -DENABLE_TIFF=OFF \
        -DENABLE_ICONV=OFF \
        -DENABLE_XPM=OFF \
        -DENABLE_FREETYPE=OFF \
        -DENABLE_FONTCONFIG=OFF \
        -DENABLE_HEIF=OFF \
        -DENABLE_RAQM=OFF

# Build as side module, skipping all dependency libraries (they'll be linked with PHP later)
RUN source /root/emsdk/emsdk_env.sh && \
    export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
    EMCC_SKIP="-lc -lz -lpng -lpng16 -ljpeg -lwebp -lavif -liconv" \
    EMCC_FLAGS=" -D__x86_64__ -sSIDE_MODULE $JSPI_FLAGS" \
    emmake make gd_static -j"$(nproc)"

# Manually stage the static lib and headers (skip installing programs)
RUN set -euxo pipefail && \
    mkdir -p /root/install/lib /root/install/include /root/install/lib/pkgconfig /root/install/bin && \
    LIBFILE=$(find /root/libgd-2.3.3 -maxdepth 4 -name "libgd*.a" | head -n1) && \
    if [ -z "$LIBFILE" ]; then echo "libgd static archive not found"; exit 1; fi && \
    cp "$LIBFILE" /root/install/lib/libgd.a && \
    (cp /root/libgd-2.3.3/src/gd_config.h /root/install/include/ || true) && \
    (cp /root/libgd-2.3.3/gd_config.h /root/install/include/ || true) && \
    cp /root/libgd-2.3.3/src/*.h /root/install/include/ && \
    (cp /root/libgd-2.3.3/gd.h /root/install/include/ || true) && \
    (cp /root/libgd-2.3.3/gd_errors.h /root/install/include/ || true)

RUN cat > /root/install/lib/pkgconfig/gdlib.pc <<'EOF'
prefix=/root/lib
exec_prefix=${prefix}
libdir=${exec_prefix}/lib
includedir=${prefix}/include

Name: gdlib
Description: GD graphics library
Version: 2.3.3
Requires.private: libpng libjpeg libwebp libavif zlib
Libs: -L${libdir} -lgd -lpng16 -lz -ljpeg -lwebp -lsharpyuv -lavif
Cflags: -I${includedir}
EOF

RUN cat > /root/install/bin/gdlib-config <<'EOF'
#!/bin/sh
case "$1" in
  --version) echo 2.3.3 ;;
  --features) echo "PNG JPEG WEBP AVIF GIF XBM WBMP FREETYPE" ;;
  --libs) echo "-L/root/lib/lib -lgd -lpng16 -lz -ljpeg -lwebp -lsharpyuv -lavif" ;;
  --cflags|--includes) echo "-I/root/lib/include" ;;
  --libdir) echo "/root/lib/lib" ;;
  --includedir) echo "/root/lib/include" ;;
  *) echo "--version --features --libs --cflags --includedir --libdir" ;;
esac
EOF

RUN chmod +x /root/install/bin/gdlib-config

RUN rm -rf /root/libgd-$GD_VERSION libgd.tar.gz
