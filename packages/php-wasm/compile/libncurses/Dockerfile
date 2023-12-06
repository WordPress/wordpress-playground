FROM playground-php-wasm:base

RUN set -euxo pipefail &&\
    # Install libncurses
    wget https://ftp.gnu.org/gnu/ncurses/ncurses-6.2.tar.gz && \
    tar -xzf ncurses-6.2.tar.gz;

    # https://github.com/jamesbiv/ncurses-emscripten
    # https://github.com/ilyaigpetrov/ncurses-for-emscripten/blob/27fefcd3784e7375212b75f444def4518ddabc21/COMPILE.md
RUN cd ncurses-6.2 && \
    ./configure \
        PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
        --build i386-pc-linux-gnu \
        --prefix=/root/lib/ \
        --enable-database;

RUN cd ncurses-6.2 && \
    make;

RUN cd ncurses-6.2 && \
    make install;

RUN cd ncurses-6.2 && \
    cd ncurses  && \
    cp make_hash make_hash_x86  && \
    cp make_keys make_keys_x86  && \
    cp report_offsets report_offsets_x86 && \
    cd /root/ncurses-6.2 && \
    make clean;

COPY ./libncurses/ncurses.patch /root/
RUN cd /root/ncurses-6.2 && \
    source /root/emsdk/emsdk_env.sh && \
    git apply --ignore-space-change --ignore-whitespace --no-index /root/ncurses.patch && \
    emconfigure ./configure \
        PKG_CONFIG_PATH=$PKG_CONFIG_PATH \
        --build i386-pc-linux-gnu \
        --prefix=/root/lib && \
    /root/replace.sh $'s/^\s+cd man.*$//g' Makefile && \
    /root/replace.sh $'s/^\s+cd progs.*$//g' Makefile && \
    /root/replace.sh $'s/^\s+cd test.*$//g' Makefile && \
    /root/replace.sh $'s/^\s+cd misc.*$//g' Makefile && \
    /root/replace.sh $'s/^\s+cd c\+\+.*$//g' Makefile;

RUN cd ncurses-6.2 && \
    source /root/emsdk/emsdk_env.sh && \
    emmake make;

RUN cd ncurses-6.2 && \
    source /root/emsdk/emsdk_env.sh && \
    emmake make install
