PHP_ARG_ENABLE([hello_dolly_wasm], [whether to enable hello_dolly_wasm],
	[AS_HELP_STRING([--enable-hello_dolly_wasm], [Enable hello_dolly_wasm])],
	[no])

if test "$PHP_HELLO_DOLLY_WASM" != "no"; then
	PHP_NEW_EXTENSION([hello_dolly_wasm], [hello_dolly_wasm.c], [$ext_shared])
fi
