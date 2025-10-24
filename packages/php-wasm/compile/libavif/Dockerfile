FROM playground-php-wasm:base

ARG JSPI

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libz/ /root/libz
COPY ./libaom/ /root/libaom

RUN if [ "$JSPI" = "1" ]; then \
        cp -r /root/libz/jspi/dist/root/lib/* /root/lib; \
        cp -r /root/libaom/jspi/dist/root/lib/* /root/lib; \
    else \
        cp -r /root/libz/asyncify/dist/root/lib/* /root/lib; \
        cp -r /root/libaom/asyncify/dist/root/lib/* /root/lib; \
    fi

RUN wget https://github.com/AOMediaCodec/libavif/archive/refs/tags/v1.3.0.tar.gz -O libavif.tar.gz
RUN tar -xzf libavif.tar.gz
WORKDIR /root/libavif-1.3.0

RUN mkdir -p build && cd build && \
	source /root/emsdk/emsdk_env.sh && \
	export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
	emcmake cmake .. \
		-DCMAKE_BUILD_TYPE=Release \
		-DBUILD_SHARED_LIBS=OFF \
		-DAVIF_CODEC_AOM=ON \
		-DAVIF_LOCAL_AOM=OFF \
		-DAVIF_CODEC_DAV1D=OFF \
		-DAVIF_CODEC_RAV1E=OFF \
		-DAVIF_CODEC_SVT=OFF \
		-DAVIF_BUILD_APPS=OFF \
		-DAVIF_BUILD_TESTS=OFF \
		-DAVIF_LIBYUV=LOCAL \
		-DCMAKE_C_FLAGS="-I/root/lib/include -sSIDE_MODULE $JSPI_FLAGS" \
		-DCMAKE_CXX_FLAGS="-I/root/lib/include -sSIDE_MODULE $JSPI_FLAGS" \
		-DCMAKE_EXE_LINKER_FLAGS="-L/root/lib/lib" \
		-DCMAKE_INSTALL_PREFIX=/root/lib \
		-DAOM_INCLUDE_DIR=/root/lib/include \
		-DAOM_LIBRARY=/root/lib/lib/libaom.a

RUN cd build && \
	source /root/emsdk/emsdk_env.sh && \
	emmake make

RUN cd build && \
	source /root/emsdk/emsdk_env.sh && \
	emmake make install
