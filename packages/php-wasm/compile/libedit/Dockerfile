FROM playground-php-wasm:base

RUN mkdir -p /root/lib/include /root/lib/lib
COPY ./libncurses/dist/root/lib/include /root/lib/include
COPY ./libncurses/dist/root/lib/lib /root/lib/lib

RUN /root/copy-lib.sh lib-ncurses
RUN wget https://www.thrysoee.dk/editline/libedit-20221030-3.1.tar.gz && \
    tar -xzf libedit-20221030-3.1.tar.gz;

RUN cd libedit-20221030-3.1 && \
    source /root/emsdk/emsdk_env.sh && \
    CFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
    CPPFLAGS="-I/root/lib/include -I/root/lib/include/ncurses -I/root/lib/include/termcap " \
    LDFLAGS="-L/root/lib/lib " emconfigure ./configure \
        PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
        --build i386-pc-linux-gnu \
        --prefix=/root/install/;

# -D__STDC_ISO_10646__=201103L is needed because
# Libedit build fails when __STDC_ISO_10646__ is not defined, and that is
# the case when compiling with musl toolchains.
# Musl is ISO 10646 compliant but doesn't define __STDC_ISO_10646__, so
# let's define it manually. Learn more at:
# http://lists.busybox.net/pipermail/buildroot/2016-January/149100.html
RUN cd libedit-20221030-3.1 && \
    source /root/emsdk/emsdk_env.sh && \
    EMCC_SKIP="-lc -lncurses " EMCC_FLAGS=" -sSIDE_MODULE -D__STDC_ISO_10646__=201103L " \
    emmake make && \
    emmake make install
