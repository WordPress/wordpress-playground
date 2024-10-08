base-image: base-image/.ready
base-image/.ready:
	cd base-image; docker build -f ./Dockerfile -t playground-php-wasm:base .

libz: libz/dist/root/lib/lib/libz.a
libz/dist/root/lib/lib/libz.a: base-image
	docker build -f ./libz/Dockerfile -t playground-php-wasm:libz ./ $(if $(JSPI),--build-arg JSPI=1)
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libz/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libz):/root/lib/lib ./$(if $(JSPI),jspi,asyncify)/libz/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libz):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/libz/dist/root/lib

libzip: libzip-1.2.0 libzip-1.9.2

libzip-1.2.0: libzip/dist/1.2.0/root/lib/lib/libzip.a
libzip/dist/1.2.0/root/lib/lib/libzip.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libzip/dist/1.2.0/root/lib
	docker build -f ./libzip/Dockerfile -t playground-php-wasm:libzip . --build-arg LIBZIP_VERSION=1.2.0 $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/lib ./$(if $(JSPI),jspi,asyncify)/libzip/dist/1.2.0/root/lib
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/include ./$(if $(JSPI),jspi,asyncify)/libzip/dist/1.2.0/root/lib

libzip-1.9.2: libzip/dist/1.9.2/root/lib/lib/libzip.a
libzip/dist/1.9.2/root/lib/lib/libzip.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libzip/dist/1.9.2/root/lib
	docker build -f ./libzip/Dockerfile -t playground-php-wasm:libzip . --build-arg LIBZIP_VERSION=1.9.2 $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/lib ./$(if $(JSPI),jspi,asyncify)/libzip/dist/1.9.2/root/lib
	docker cp $$(docker create playground-php-wasm:libzip):/root/install/include ./$(if $(JSPI),jspi,asyncify)/libzip/dist/1.9.2/root/lib

libpng16: libpng16/dist/root/lib/lib/libpng16.a
libpng16/dist/root/lib/lib/libpng16.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libpng16/dist/root/lib
	docker build -f ./libpng16/Dockerfile -t playground-php-wasm:libpng . $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libpng):/root/install/lib ./$(if $(JSPI),jspi,asyncify)/libpng16/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libpng):/root/install/include ./$(if $(JSPI),jspi,asyncify)/libpng16/dist/root/lib

libjpeg: libjpeg/dist/root/lib/lib/libjpeg.a
libjpeg/dist/root/lib/lib/libjpeg.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libjpeg/dist/root/lib
	docker build -f ./libjpeg/Dockerfile -t playground-php-wasm:libpng . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libpng):/root/lib/lib32 ./$(if $(JSPI),jspi,asyncify)/libjpeg/dist/root/lib
	mv ./$(if $(JSPI),jspi,asyncify)/libjpeg/dist/root/lib/lib32 ./$(if $(JSPI),jspi,asyncify)/libjpeg/dist/root/lib/lib
	docker cp $$(docker create playground-php-wasm:libpng):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/libjpeg/dist/root/lib

libwebp: libwebp/dist/root/lib/lib/libwebp.a
libwebp/dist/root/lib/lib/libwebp.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libwebp/dist/root/lib
	docker build -f ./libwebp/Dockerfile -t playground-php-wasm:libpng . $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libpng):/root/lib/lib ./$(if $(JSPI),jspi,asyncify)/libwebp/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libpng):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/libwebp/dist/root/lib

libxml2: libxml2/dist/root/lib/lib/libxml2.a
libxml2/dist/root/lib/lib/libxml2.a: base-image
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libxml2/dist/root/lib
	docker build -f ./libxml2/Dockerfile -t playground-php-wasm:libxml2 . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libxml2):/root/lib/bin ./$(if $(JSPI),jspi,asyncify)/libxml2/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libxml2):/root/lib/lib ./$(if $(JSPI),jspi,asyncify)/libxml2/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libxml2):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/libxml2/dist/root/lib

libopenssl: libopenssl/dist/root/lib/lib/libssl.a
libopenssl/dist/root/lib/lib/libssl.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libopenssl/dist/root/lib
	docker build -f ./libopenssl/Dockerfile -t playground-php-wasm:libopenssl . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libopenssl):/root/install/lib ./$(if $(JSPI),jspi,asyncify)/libopenssl/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libopenssl):/root/install/include ./$(if $(JSPI),jspi,asyncify)/libopenssl/dist/root/lib

libsqlite3: libsqlite3/dist/root/lib/lib/libsqlite3.a
libsqlite3/dist/root/lib/lib/libsqlite3.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libsqlite3/dist/root/lib
	docker build -f ./libsqlite3/Dockerfile -t playground-php-wasm:libsqlite3 . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libsqlite3):/root/lib/lib ./$(if $(JSPI),jspi,asyncify)/libsqlite3/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libsqlite3):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/libsqlite3/dist/root/lib

libiconv: libiconv/dist/root/lib/lib/libiconv.a
libiconv/dist/root/lib/lib/libiconv.a: base-image libz
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libiconv/dist/root/lib
	docker build -f ./libiconv/Dockerfile -t playground-php-wasm:libiconv . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libiconv):/root/install/lib ./$(if $(JSPI),jspi,asyncify)/libiconv/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libiconv):/root/install/include ./$(if $(JSPI),jspi,asyncify)/libiconv/dist/root/lib

libncurses: libncurses/dist/root/lib/lib/libncurses.a
libncurses/dist/root/lib/lib/libncurses.a: base-image
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libncurses/dist/root/lib
	docker build -f ./libncurses/Dockerfile -t playground-php-wasm:libncurses . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libncurses):/root/lib/lib ./$(if $(JSPI),jspi,asyncify)/libncurses/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libncurses):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/libncurses/dist/root/lib

libedit: libedit/dist/root/lib/lib/libedit.a
libedit/dist/root/lib/lib/libedit.a: base-image libncurses
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libedit/dist/root/lib
	docker build -f ./libedit/Dockerfile -t playground-php-wasm:libedit . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libedit):/root/install/lib ./$(if $(JSPI),jspi,asyncify)/libedit/dist/root/lib
	docker cp $$(docker create playground-php-wasm:libedit):/root/install/include ./$(if $(JSPI),jspi,asyncify)/libedit/dist/root/lib

bison2.7: bison2.7/dist/usr/local/bison/bin/bison
bison2.7/dist/usr/local/bison/bin/bison: base-image
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/bison2.7/dist/usr/local/bison
	docker build -f ./bison2.7/Dockerfile -t playground-php-wasm:bison2.7 . --progress=plain
	docker cp $$(docker create playground-php-wasm:bison2.7):/usr/local/bison ./$(if $(JSPI),jspi,asyncify)/bison2.7/dist/usr/local

oniguruma: oniguruma/dist/root/lib/lib/libonig.a
oniguruma/dist/root/lib/lib/libonig.a: base-image
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/oniguruma/dist/root/lib/lib
	docker build -f ./oniguruma/Dockerfile -t playground-php-wasm:oniguruma . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:oniguruma):/root/lib/lib ./$(if $(JSPI),jspi,asyncify)/oniguruma/dist/root/lib/
	docker cp $$(docker create playground-php-wasm:oniguruma):/root/lib/include ./$(if $(JSPI),jspi,asyncify)/oniguruma/dist/root/lib

libcurl: libcurl/dist/root/lib/lib/libcurl.a
libcurl/dist/root/lib/lib/libcurl.a: base-image libz libopenssl
	mkdir -p ./$(if $(JSPI),jspi,asyncify)/libcurl/dist/root/lib
	docker build -f ./libcurl/Dockerfile -t playground-php-wasm:libcurl . --progress=plain $(if $(JSPI),--build-arg JSPI=1)
	docker cp $$(docker create playground-php-wasm:libcurl):/root/curl-7.69.1/lib/.libs ./$(if $(JSPI),jspi,asyncify)/libcurl/dist/root/lib/lib
	docker cp $$(docker create playground-php-wasm:libcurl):/root/curl-7.69.1/include/ ./$(if $(JSPI),jspi,asyncify)/libcurl/dist/root/lib

all: libz libzip libpng16 libjpeg libwebp libxml2 libopenssl libsqlite3 libiconv libncurses libedit bison2.7 oniguruma libcurl
clean:
	rm -rf ./jspi/libz/dist
	rm -rf ./asyncify/libz/dist
	rm -rf ./jspi/libzip/dist
	rm -rf ./asyncify/libzip/dist
	rm -rf ./jspi/libpng16/dist
	rm -rf ./asyncify/libpng16/dist
	rm -rf ./jspi/libjpeg/dist
	rm -rf ./asyncify/libjpeg/dist
	rm -rf ./jspi/libwebp/dist
	rm -rf ./asyncify/libwebp/dist
	rm -rf ./jspi/libxml2/dist
	rm -rf ./asyncify/libxml2/dist
	rm -rf ./jspi/libopenssl/dist
	rm -rf ./asyncify/libopenssl/dist
	rm -rf ./jspi/libsqlite3/dist
	rm -rf ./asyncify/libsqlite3/dist
	rm -rf ./jspi/libiconv/dist
	rm -rf ./asyncify/libiconv/dist
	rm -rf ./jspi/libncurses/dist
	rm -rf ./asyncify/libncurses/dist
	rm -rf ./jspi/libedit/dist
	rm -rf ./asyncify/libedit/dist
	rm -rf ./jspi/bison2.7/dist
	rm -rf ./asyncify/bison2.7/dist
	rm -rf ./jspi/oniguruma/dist
	rm -rf ./asyncify/oniguruma/dist
