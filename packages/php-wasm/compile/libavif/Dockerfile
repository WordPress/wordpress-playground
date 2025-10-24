FROM playground-php-wasm:base

ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib

RUN wget https://github.com/AOMediaCodec/libavif/archive/refs/tags/v1.3.0.tar.gz -O libavif.tar.gz
RUN tar -xzf libavif.tar.gz
WORKDIR /root/libavif-1.3.0

RUN mkdir -p build && cd build && \
	source /root/emsdk/emsdk_env.sh && \
	export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
	emcmake cmake .. \
		-DCMAKE_BUILD_TYPE=Release \
		-DBUILD_SHARED_LIBS=OFF \
		-DAVIF_CODEC_AOM=LOCAL \
		-DAOM_TARGET_CPU=generic \
		-DAVIF_CODEC_DAV1D=OFF \
		-DAVIF_CODEC_RAV1E=OFF \
		-DAVIF_CODEC_SVT=OFF \
		-DAVIF_BUILD_APPS=OFF \
		-DAVIF_BUILD_TESTS=OFF \
		-DAVIF_LIBYUV=OFF \
		-DCMAKE_C_FLAGS="-sSIDE_MODULE $JSPI_FLAGS" \
		-DCMAKE_CXX_FLAGS="-sSIDE_MODULE $JSPI_FLAGS" \
		-DCMAKE_INSTALL_PREFIX=/root/lib

RUN cd build && \
	source /root/emsdk/emsdk_env.sh && \
	emmake make

RUN cd build && \
	source /root/emsdk/emsdk_env.sh && \
	emmake make install
