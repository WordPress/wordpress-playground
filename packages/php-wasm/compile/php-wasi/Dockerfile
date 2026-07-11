FROM debian:bookworm-slim@sha256:60eac759739651111db372c07be67863818726f754804b8707c90979bda511df

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends \
	automake \
	bison \
	build-essential \
	ca-certificates \
	curl \
	libtinfo6 \
	m4 \
	patch \
	perl \
	php8.2-cli \
	pkg-config \
	python3 \
	xz-utils \
	&& rm -rf /var/lib/apt/lists/*

COPY versions.env /opt/php-wasi/versions.env

RUN source /opt/php-wasi/versions.env \
	&& curl --fail --location --silent --show-error \
		"https://ftp.gnu.org/gnu/autoconf/autoconf-$AUTOCONF_VERSION.tar.xz" \
		--output /tmp/autoconf.tar.xz \
	&& printf '%s  %s\n' "$AUTOCONF_SHA256" /tmp/autoconf.tar.xz | sha256sum --check \
	&& mkdir /tmp/autoconf \
	&& tar -xJf /tmp/autoconf.tar.xz --strip-components=1 -C /tmp/autoconf \
	&& cd /tmp/autoconf \
	&& ./configure --prefix=/usr/local \
	&& make -j"$(nproc)" \
	&& make install \
	&& rm -rf /tmp/autoconf /tmp/autoconf.tar.xz

RUN source /opt/php-wasi/versions.env \
	&& curl --fail --location --silent --show-error \
		"https://github.com/skvadrik/re2c/releases/download/$RE2C_VERSION/re2c-$RE2C_VERSION.tar.xz" \
		--output /tmp/re2c.tar.xz \
	&& printf '%s  %s\n' "$RE2C_SHA256" /tmp/re2c.tar.xz | sha256sum --check \
	&& mkdir /tmp/re2c \
	&& tar -xJf /tmp/re2c.tar.xz --strip-components=1 -C /tmp/re2c \
	&& cd /tmp/re2c \
	&& ./configure --prefix=/usr/local \
	&& make -j"$(nproc)" \
	&& make install \
	&& rm -rf /tmp/re2c /tmp/re2c.tar.xz

RUN source /opt/php-wasi/versions.env \
	&& curl --fail --location --silent --show-error \
		"https://github.com/bytecodealliance/wit-bindgen/releases/download/v$WIT_BINDGEN_VERSION/wit-bindgen-$WIT_BINDGEN_VERSION-x86_64-linux.tar.gz" \
		--output /tmp/wit-bindgen.tar.gz \
	&& printf '%s  %s\n' "$WIT_BINDGEN_SHA256" /tmp/wit-bindgen.tar.gz | sha256sum --check \
	&& tar -xzf /tmp/wit-bindgen.tar.gz --strip-components=1 -C /tmp \
		"wit-bindgen-$WIT_BINDGEN_VERSION-x86_64-linux/wit-bindgen" \
	&& install -m 0755 /tmp/wit-bindgen /usr/local/bin/wit-bindgen \
	&& rm -f /tmp/wit-bindgen /tmp/wit-bindgen.tar.gz

RUN source /opt/php-wasi/versions.env \
	&& curl --fail --location --silent --show-error \
		"https://github.com/bytecodealliance/wasm-tools/releases/download/v$WASM_TOOLS_VERSION/wasm-tools-$WASM_TOOLS_VERSION-x86_64-linux.tar.gz" \
		--output /tmp/wasm-tools.tar.gz \
	&& printf '%s  %s\n' "$WASM_TOOLS_SHA256" /tmp/wasm-tools.tar.gz | sha256sum --check \
	&& tar -xzf /tmp/wasm-tools.tar.gz --strip-components=1 -C /tmp \
		"wasm-tools-$WASM_TOOLS_VERSION-x86_64-linux/wasm-tools" \
	&& install -m 0755 /tmp/wasm-tools /usr/local/bin/wasm-tools \
	&& rm -f /tmp/wasm-tools /tmp/wasm-tools.tar.gz

WORKDIR /work
COPY . /work

CMD ["./build.sh"]
