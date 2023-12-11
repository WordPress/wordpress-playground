FROM playground-php-wasm:base

COPY ./bison2.7/bison27.patch /root/bison27.patch
RUN wget http://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz && \
    tar -xvf bison-2.7.tar.gz && \
    rm bison-2.7.tar.gz && \
    cd bison-2.7 && \
    git apply --no-index /root/bison27.patch && \
    ./configure --prefix=/usr/local/bison --with-libiconv-prefix=/usr/local/libiconv/ && \
    make && \
    make install
