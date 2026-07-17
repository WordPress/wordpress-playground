FROM playground-php-wasm:base

ARG JSPI=0
ARG LIBSODIUM_VERSION=1.0.20

RUN set -euxo pipefail; \
	wget https://download.libsodium.org/libsodium/releases/libsodium-$LIBSODIUM_VERSION.tar.gz; \
	tar -xzf libsodium-$LIBSODIUM_VERSION.tar.gz; \
	rm libsodium-$LIBSODIUM_VERSION.tar.gz

WORKDIR /root/libsodium-$LIBSODIUM_VERSION

RUN set -euxo pipefail; \
	source /root/emsdk/emsdk_env.sh; \
	emconfigure ./configure \
		--build=i386-pc-linux-gnu \
		--host=wasm32-unknown-emscripten \
		--prefix=/root/install \
		--disable-shared \
		--enable-static

RUN set -euxo pipefail; \
	source /root/emsdk/emsdk_env.sh; \
	export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; fi); \
	EMCC_FLAGS="-fPIC $JSPI_FLAGS" emmake make -j12; \
	emmake make install
