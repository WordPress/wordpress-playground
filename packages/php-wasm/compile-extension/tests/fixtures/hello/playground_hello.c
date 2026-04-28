#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"

PHP_FUNCTION(playground_hello_greet)
{
	RETURN_STRING("hello from php-wasm");
}

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_playground_hello_greet, 0, 0, IS_STRING, 0)
ZEND_END_ARG_INFO()

static const zend_function_entry playground_hello_functions[] = {
	PHP_FE(playground_hello_greet, arginfo_playground_hello_greet)
	PHP_FE_END
};

zend_module_entry playground_hello_module_entry = {
	STANDARD_MODULE_HEADER,
	"playground_hello",
	playground_hello_functions,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	"0.1.0",
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_PLAYGROUND_HELLO
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(playground_hello)
#endif
