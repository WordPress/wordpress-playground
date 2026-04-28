PHP_ARG_ENABLE([xml_probe], [whether to enable xml_probe],
	[AS_HELP_STRING([--enable-xml_probe], [Enable xml_probe])],
	[no])

if test "$PHP_XML_PROBE" != "no"; then
	PHP_NEW_EXTENSION([xml_probe], [xml_probe.c], [$ext_shared])
fi
