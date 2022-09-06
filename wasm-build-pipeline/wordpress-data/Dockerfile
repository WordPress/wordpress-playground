FROM trzeci/emscripten:1.39.18-fastcomp
SHELL ["/bin/bash", "-c"]

WORKDIR /root
COPY ./copy-to-docker-image/* /root
RUN mkdir lib

RUN set -euxo pipefail;\
    apt-get update; \
    emsdk install latest; \
    apt-get --no-install-recommends -y install \
    build-essential \
    automake-1.15 \
    libxml2-dev \
    autoconf \
    libtool \
    pkgconf \
    bison \
    flex \
    make \
    re2c \
    gdb \
    git \
    pv \
    ca-certificates

ENV PKG_CONFIG_PATH /root/lib/lib/pkgconfig
ENV PRELOAD_ASSETS preload/
ENV ENVIRONMENT    web
ENV INITIAL_MEMORY 1024MB
ENV EMCC_ALLOW_FASTCOMP   1
