PHP_ARG_ENABLE([external_lib_probe], [whether to enable external_lib_probe],
	[AS_HELP_STRING([--enable-external_lib_probe], [Enable external_lib_probe])],
	[no])

if test "$PHP_EXTERNAL_LIB_PROBE" != "no"; then
	PHP_NEW_EXTENSION([external_lib_probe], [external_lib_probe.c], [$ext_shared])
fi
