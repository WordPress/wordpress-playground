#include "php.h"
#include "ext/standard/php_password.h"

PHP_FUNCTION(external_abi_probe)
{
	zval value;
	void *first = emalloc(160);
	void *second = emalloc(448);
	zend_string *algorithm = zend_string_init("bcrypt", sizeof("bcrypt") - 1, 0);

	ZVAL_LONG(&value, 1);
	convert_to_null(&value);
	php_password_algo_find(algorithm);
	php_password_algo_register("external_abi", &php_password_algo_bcrypt);
	zend_string_release(algorithm);
	efree(first);
	efree(second);
	RETURN_TRUE;
}

static const zend_function_entry external_abi_functions[] = {
	PHP_FE(external_abi_probe, NULL)
	PHP_FE_END
};

zend_module_entry external_abi_module_entry = {
	STANDARD_MODULE_HEADER,
	"external_abi",
	external_abi_functions,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	"0.1.0",
	STANDARD_MODULE_PROPERTIES,
};

#ifdef COMPILE_DL_EXTERNAL_ABI
ZEND_GET_MODULE(external_abi)
#endif
