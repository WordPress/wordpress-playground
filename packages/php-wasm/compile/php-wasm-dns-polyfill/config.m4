dnl config.m4 for extension dns_polyfill

PHP_ARG_ENABLE(dns_polyfill, whether to enable dns_polyfill support,
[  --enable-dns_polyfill   Enable dns_polyfill support])

if test "$PHP_WASM_DNS_POLYFILL" != "no"; then
  PHP_NEW_EXTENSION(dns_polyfill, dns_polyfill.c, $ext_shared)
fi