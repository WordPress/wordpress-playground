PHP_ARG_ENABLE([zlib_probe], [whether to enable zlib_probe],
	[AS_HELP_STRING([--enable-zlib_probe], [Enable zlib_probe])],
	[no])

if test "$PHP_ZLIB_PROBE" != "no"; then
	PHP_NEW_EXTENSION([zlib_probe], [zlib_probe.c], [$ext_shared])
fi
