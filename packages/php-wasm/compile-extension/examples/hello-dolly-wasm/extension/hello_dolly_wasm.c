#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"

static const char *hello_dolly_wasm_lyrics[] = {
	"Hello from a PHP.wasm extension",
	"Native code can join WordPress hooks",
	"Small modules can power focused features",
	"The lyric picker is running in WebAssembly",
	"WordPress rendered this through an mu-plugin",
	"Hooks stay in PHP while logic moves to WASM",
	"Playground loaded this module before PHP started",
	"Compiled extensions can expose ordinary PHP functions",
	"This greeting crossed the WASM boundary",
	"Hello Dolly, Playground edition"
};

PHP_FUNCTION(hello_dolly_wasm_get_lyric)
{
	zend_long index = 0;
	size_t lyric_count = sizeof(hello_dolly_wasm_lyrics) / sizeof(hello_dolly_wasm_lyrics[0]);

	ZEND_PARSE_PARAMETERS_START(0, 1)
		Z_PARAM_OPTIONAL
		Z_PARAM_LONG(index)
	ZEND_PARSE_PARAMETERS_END();

	if (index < 0) {
		index = -index;
	}

	RETURN_STRING(hello_dolly_wasm_lyrics[index % lyric_count]);
}

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_hello_dolly_wasm_get_lyric, 0, 0, IS_STRING, 0)
	ZEND_ARG_TYPE_INFO(0, index, IS_LONG, 0)
ZEND_END_ARG_INFO()

static const zend_function_entry hello_dolly_wasm_functions[] = {
	PHP_FE(hello_dolly_wasm_get_lyric, arginfo_hello_dolly_wasm_get_lyric)
	PHP_FE_END
};

zend_module_entry hello_dolly_wasm_module_entry = {
	STANDARD_MODULE_HEADER,
	"hello_dolly_wasm",
	hello_dolly_wasm_functions,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	"0.1.0",
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_HELLO_DOLLY_WASM
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(hello_dolly_wasm)
#endif
