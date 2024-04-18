base-image: base-image/.ready
base-image/.ready:
	cd base-image; docker build -f ./Dockerfile -t playground-php-wasm:base .

libz: libz/dist/root/lib/lib/libz.a
libz/dist/root/lib/lib/libz.a: base-image
	docker build -f ./libz/Dockerfile -t playground-php-wasm:libz ./
	mkdir -p ./libz/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libz):/root/lib/lib ./libz/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libz):/root/lib/include ./libz/dist/root/lib

libzip: libzip-1.2.0 libzip-1.9.2

libzip-1.2.0: libzip/dist/1.2.0/root/lib/lib/libzip.a
libzip/dist/1.2.0/root/lib/lib/libzip.a: base-image libz
	mkdir -p ./libzip/dist/1.2.0/root/lib
	docker build -f ./libzip/Dockerfile -t playground-php-wasm:libzip . --build-arg LIBZIP_VERSION=1.2.0
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/lib ./libzip/dist/1.2.0/root/lib
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/include ./libzip/dist/1.2.0/root/lib

libzip-1.9.2: libzip/dist/1.9.2/root/lib/lib/libzip.a
libzip/dist/1.9.2/root/lib/lib/libzip.a: base-image libz
	mkdir -p ./libzip/dist/1.9.2/root/lib
	docker build -f ./libzip/Dockerfile -t playground-php-wasm:libzip . --build-arg LIBZIP_VERSION=1.9.2
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/lib ./libzip/dist/1.9.2/root/lib
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/include ./libzip/dist/1.9.2/root/lib

libpng16: libpng16/dist/root/lib/lib/libpng16.a
libpng16/dist/root/lib/lib/libpng16.a: base-image libz
	mkdir -p ./libpng16/dist/root/lib
	docker build -f ./libpng16/Dockerfile -t playground-php-wasm:libpng .
	docker cp $$(docker create playground-php-wasm:libpng):/root/install/lib ./libpng16/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libpng):/root/install/include ./libpng16/dist/root/lib

libxml2: libxml2/dist/root/lib/lib/libxml2.a
libxml2/dist/root/lib/lib/libxml2.a: base-image
	mkdir -p ./libxml2/dist/root/lib
	docker build -f ./libxml2/Dockerfile -t playground-php-wasm:libxml2 . --progress=plain
	docker cp $$(docker create playground-php-wasm:libxml2):/root/lib/bin ./libxml2/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libxml2):/root/lib/lib ./libxml2/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libxml2):/root/lib/include ./libxml2/dist/root/lib

libopenssl: libopenssl/dist/root/lib/lib/libssl.a
libopenssl/dist/root/lib/lib/libssl.a: base-image libz
	mkdir -p ./libopenssl/dist/root/lib
	docker build -f ./libopenssl/Dockerfile -t playground-php-wasm:libopenssl . --progress=plain
	docker cp $$(docker create playground-php-wasm:libopenssl):/root/install/lib ./libopenssl/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libopenssl):/root/install/include ./libopenssl/dist/root/lib

libsqlite3: libsqlite3/dist/root/lib/lib/libsqlite3.a
libsqlite3/dist/root/lib/lib/libsqlite3.a: base-image libz
	mkdir -p ./libsqlite3/dist/root/lib
	docker build -f ./libsqlite3/Dockerfile -t playground-php-wasm:libsqlite3 . --progress=plain
	docker cp $$(docker create playground-php-wasm:libsqlite3):/root/install/lib ./libsqlite3/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libsqlite3):/root/install/include ./libsqlite3/dist/root/lib

libiconv: libiconv/dist/root/lib/lib/libiconv.a
libiconv/dist/root/lib/lib/libiconv.a: base-image libz
	mkdir -p ./libiconv/dist/root/lib
	docker build -f ./libiconv/Dockerfile -t playground-php-wasm:libiconv . --progress=plain
	docker cp $$(docker create playground-php-wasm:libiconv):/root/install/lib ./libiconv/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libiconv):/root/install/include ./libiconv/dist/root/lib

libncurses: libncurses/dist/root/lib/lib/libncurses.a
libncurses/dist/root/lib/lib/libncurses.a: base-image
	mkdir -p ./libncurses/dist/root/lib
	docker build -f ./libncurses/Dockerfile -t playground-php-wasm:libncurses . --progress=plain
	docker cp $$(docker create playground-php-wasm:libncurses):/root/lib/lib ./libncurses/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libncurses):/root/lib/include ./libncurses/dist/root/lib

libedit: libedit/dist/root/lib/lib/libedit.a
libedit/dist/root/lib/lib/libedit.a: base-image libncurses
	mkdir -p ./libedit/dist/root/lib
	docker build -f ./libedit/Dockerfile -t playground-php-wasm:libedit . --progress=plain
	docker cp $$(docker create playground-php-wasm:libedit):/root/install/lib ./libedit/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libedit):/root/install/include ./libedit/dist/root/lib

bison2.7: bison2.7/dist/usr/local/bison/bin/bison
bison2.7/dist/usr/local/bison/bin/bison: base-image
	mkdir -p ./bison2.7/dist/usr/local/bison
	docker build -f ./bison2.7/Dockerfile -t playground-php-wasm:bison2.7 . --progress=plain
	docker cp $$(docker create playground-php-wasm:bison2.7):/usr/local/bison ./bison2.7/dist/usr/local

oniguruma: oniguruma/dist/root/lib/lib/libonig.a
oniguruma/dist/root/lib/lib/libonig.a: base-image
	mkdir -p ./oniguruma/dist/root/lib/lib
	docker build -f ./oniguruma/Dockerfile -t playground-php-wasm:oniguruma . --progress=plain
	docker cp $$(docker create playground-php-wasm:oniguruma):/root/lib/lib ./oniguruma/dist/root/lib/
	docker cp $$(docker create playground-php-wasm:oniguruma):/root/lib/include ./oniguruma/dist/root/lib

libcurl: libcurl/dist/root/lib/lib/libcurl.a
libcurl/dist/root/lib/lib/libcurl.a: base-image libz libopenssl
	mkdir -p ./libcurl/dist/root/lib
	docker build -f ./libcurl/Dockerfile -t playground-php-wasm:libcurl . --progress=plain
	docker cp $$(docker create playground-php-wasm:libcurl):/root/curl-7.69.1/lib/.libs ./libcurl/dist/root/lib/lib
	docker cp $$(docker create playground-php-wasm:libcurl):/root/curl-7.69.1/include/ ./libcurl/dist/root/lib

all: libz libzip libpng16 libxml2 libopenssl libsqlite3 libiconv libncurses libedit bison2.7 oniguruma libcurl
clean:
	rm -rf ./libz/dist
	rm -rf ./libzip/dist
	rm -rf ./libpng16/dist
	rm -rf ./libxml2/dist
	rm -rf ./libopenssl/dist
	rm -rf ./libsqlite3/dist
	rm -rf ./libiconv/dist
	rm -rf ./libncurses/dist
	rm -rf ./libedit/dist
	rm -rf ./bison2.7/dist
	rm -rf ./oniguruma/dist
