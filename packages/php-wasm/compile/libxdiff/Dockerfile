FROM playground-php-wasm:base

ARG JSPI="0"

# Download and extract libxdiff
RUN wget http://www.xmailserver.org/libxdiff-0.23.tar.gz && \
    tar -xzf libxdiff-0.23.tar.gz

# Configure and build with Emscripten
RUN cd libxdiff-0.23 && \
    source /root/emsdk/emsdk_env.sh && \
    # Update config.guess and config.sub for better platform detection
    wget -O config.guess 'https://git.savannah.gnu.org/gitweb/?p=config.git;a=blob_plain;f=config.guess;hb=HEAD' && \
    wget -O config.sub 'https://git.savannah.gnu.org/gitweb/?p=config.git;a=blob_plain;f=config.sub;hb=HEAD' && \
    chmod +x config.guess config.sub && \
    if [ "$JSPI" = "1" ]; then \
        emconfigure ./configure --prefix=/root/lib --build=$(./config.guess) --host=wasm32-unknown-emscripten CFLAGS="-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; \
    else \
        emconfigure ./configure --prefix=/root/lib --build=$(./config.guess) --host=wasm32-unknown-emscripten; \
    fi && \
    emmake make && \
    emmake make install && \
    # Ensure the library is in the correct location
    mkdir -p /root/lib/lib && \
    # Verify the library was built and installed
    test -f /root/lib/lib/libxdiff.a || { echo "ERROR: libxdiff.a not found in /root/lib/lib/"; exit 1; } && \
    # Copy to final location and verify
    cp -f /root/lib/lib/libxdiff.a /root/lib/lib/ && \
    ls -la /root/lib/lib/libxdiff.a || { echo "ERROR: Failed to copy libxdiff.a"; exit 1; } && \
    echo "Successfully built and installed libxdiff.a"