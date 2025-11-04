FROM playground-php-wasm:base

ARG JSPI

RUN wget https://aomedia.googlesource.com/aom/+archive/v3.13.1.tar.gz -O aom.tar.gz
RUN mkdir -p /root/aom && tar -xzf aom.tar.gz -C /root/aom
WORKDIR /root/aom

RUN mkdir -p build && cd build && \
	source /root/emsdk/emsdk_env.sh && \
	export JSPI_FLAGS=$(if [ "$JSPI" = "1" ]; then echo "-sSUPPORT_LONGJMP=wasm -fwasm-exceptions"; else echo ""; fi) && \
	emcmake cmake .. \
		-DCMAKE_BUILD_TYPE=Release \
		-DENABLE_CCACHE=1 \
		-DAOM_TARGET_CPU=generic \
		-DENABLE_DOCS=0 \
		-DENABLE_TESTS=0 \
		-DENABLE_TESTDATA=0 \
		-DENABLE_TOOLS=0 \
		-DENABLE_EXAMPLES=0 \
		-DCONFIG_ACCOUNTING=1 \
		-DCONFIG_INSPECTION=0 \
		-DCONFIG_MULTITHREAD=0 \
		-DCONFIG_RUNTIME_CPU_DETECT=0 \
		-DCONFIG_WEBM_IO=0 \
		-DCMAKE_C_FLAGS="-sSIDE_MODULE $JSPI_FLAGS" \
		-DCMAKE_INSTALL_PREFIX=/root/lib

RUN cd build && \
	source /root/emsdk/emsdk_env.sh && \
	emmake make

RUN cd build && \
	source /root/emsdk/emsdk_env.sh && \
	emmake make install
