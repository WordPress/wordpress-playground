PHP_ARG_ENABLE([external_abi], [whether to enable external_abi], [--enable-external_abi])

if test "$PHP_EXTERNAL_ABI" != "no"; then
	PHP_NEW_EXTENSION([external_abi], [external_abi.c], [$ext_shared])
fi
