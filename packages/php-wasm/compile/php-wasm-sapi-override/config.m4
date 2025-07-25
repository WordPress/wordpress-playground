dnl config.m4 for extension wasm_sapi_override

PHP_ARG_ENABLE(wasm_sapi_override, whether to enable wasm_sapi_override support,
[  --enable-wasm_sapi_override   Enable wasm_sapi_override support])

if test "$PHP_wasm_sapi_override" != "no"; then
  PHP_NEW_EXTENSION(wasm_sapi_override, wasm_sapi_override.c, $ext_shared)
fi 