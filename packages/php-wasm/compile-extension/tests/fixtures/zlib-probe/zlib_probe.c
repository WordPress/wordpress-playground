#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include <zlib.h>

PHP_FUNCTION(zlib_probe_roundtrip)
{
	zend_string *input;

	ZEND_PARSE_PARAMETERS_START(1, 1)
		Z_PARAM_STR(input)
	ZEND_PARSE_PARAMETERS_END();

	uLong source_length = (uLong) ZSTR_LEN(input);
	uLong compressed_length = compressBound(source_length);
	Bytef *compressed = emalloc(compressed_length);

	int status = compress2(
		compressed,
		&compressed_length,
		(const Bytef *) ZSTR_VAL(input),
		source_length,
		Z_BEST_SPEED
	);
	if (status != Z_OK) {
		efree(compressed);
		RETURN_FALSE;
	}

	zend_string *output = zend_string_alloc(ZSTR_LEN(input), 0);
	uLong output_length = source_length;
	status = uncompress(
		(Bytef *) ZSTR_VAL(output),
		&output_length,
		compressed,
		compressed_length
	);
	efree(compressed);

	if (status != Z_OK || output_length != source_length) {
		zend_string_release(output);
		RETURN_FALSE;
	}

	ZSTR_VAL(output)[output_length] = '\0';
	RETURN_STR(output);
}

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_zlib_probe_roundtrip, 0, 1, IS_STRING, 1)
	ZEND_ARG_TYPE_INFO(0, input, IS_STRING, 0)
ZEND_END_ARG_INFO()

static const zend_function_entry zlib_probe_functions[] = {
	PHP_FE(zlib_probe_roundtrip, arginfo_zlib_probe_roundtrip)
	PHP_FE_END
};

zend_module_entry zlib_probe_module_entry = {
	STANDARD_MODULE_HEADER,
	"zlib_probe",
	zlib_probe_functions,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	"0.1.0",
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_ZLIB_PROBE
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(zlib_probe)
#endif
