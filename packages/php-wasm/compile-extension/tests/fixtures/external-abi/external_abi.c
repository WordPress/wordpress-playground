#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include "ext/standard/php_password.h"
#include <stdio.h>
#include <string.h>
#include <strings.h>

PHP_FUNCTION(external_abi_probe)
{
	zval value;
	char cleared[4] = {1, 1, 1, 1};
	int parsed = 0;
	/*
	 * Allocate compile-time-constant sizes on purpose. These are the calls
	 * that PHP would otherwise specialize into build-specific _emalloc_<size>()
	 * symbols; the Dockerfile.ext HAVE_BUILTIN_CONSTANT_P undef keeps them on
	 * the stable _emalloc() entry point, and loading this extension against a
	 * separately built runtime proves that entry point resolves.
	 */
	void *first = emalloc(160);
	void *second = emalloc(448);
	zend_string *algorithm = zend_string_init("bcrypt", sizeof("bcrypt") - 1, 0);
	zend_string *mixed_case = zend_string_init("Zstd", sizeof("Zstd") - 1, 0);
	int compared;

	ZVAL_LONG(&value, 1);
	convert_to_null(&value);
	php_password_algo_find(algorithm);
	php_password_algo_register("external_abi", &php_password_algo_bcrypt);
	explicit_bzero(cleared, sizeof(cleared));
	sscanf("42", "%d", &parsed);
	compared = strncasecmp(ZSTR_VAL(mixed_case), "zstd", 4);
	zend_string_release(algorithm);
	zend_string_release(mixed_case);
	efree(first);
	efree(second);
	RETURN_BOOL(cleared[0] == 0 && parsed == 42 && compared == 0);
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
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(external_abi)
#endif
