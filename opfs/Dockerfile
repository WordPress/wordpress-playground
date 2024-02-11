# Originally forked from https://github.com/seanmorris/php-wasm
# ubuntu:lunar supports amd64 and arm64 (Apple Silicon) while
# emscripten/emsdk:3.1.24 supports amd64 only.
FROM ubuntu:lunar as emscripten

SHELL ["/bin/bash", "-c"]

ENV PKG_CONFIG_PATH /root/lib/lib/pkgconfig
ENV TIMER "(which pv > /dev/null && pv --name '${@}' || cat)"

WORKDIR /root
RUN mkdir lib

RUN set -euxo pipefail;\
    apt-get update; \
    apt-get --no-install-recommends -y install \
    build-essential \
    automake \
    autoconf \
    libxml2-dev \
    libtool \
    pkgconf \
    flex \
    make \
    re2c \
    gdb \
    git \
    pv \
    ca-certificates \
    curl \
    wget \
    unzip \
    cmake \
    python3

# Install Emscripten from the repository. We'd use the official
# Docker image, but there is no arm64 image available which makes
# the build take forever on Apple Silicon.
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN git clone https://github.com/emscripten-core/emsdk.git && \
    ./emsdk/emsdk install 3.1.43 && \
    /root/emsdk/emsdk activate 3.1.43