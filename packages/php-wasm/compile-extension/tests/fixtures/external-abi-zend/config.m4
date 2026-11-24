PHP_ARG_ENABLE([external_abi_zend], [whether to enable external_abi_zend], [--enable-external_abi_zend])

if test "$PHP_EXTERNAL_ABI_ZEND" != "no"; then
	PHP_NEW_EXTENSION([external_abi_zend], [external_abi_zend.c], [$ext_shared])
fi
