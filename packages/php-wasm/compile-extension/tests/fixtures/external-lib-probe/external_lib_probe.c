#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include <string_score.h>

PHP_FUNCTION(external_lib_probe_score)
{
	zend_string *input;

	ZEND_PARSE_PARAMETERS_START(1, 1)
		Z_PARAM_STR(input)
	ZEND_PARSE_PARAMETERS_END();

	RETURN_LONG(
		(zend_long) string_score_weighted_sum(
			ZSTR_VAL(input),
			ZSTR_LEN(input)
		)
	);
}

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_external_lib_probe_score, 0, 1, IS_LONG, 0)
	ZEND_ARG_TYPE_INFO(0, input, IS_STRING, 0)
ZEND_END_ARG_INFO()

static const zend_function_entry external_lib_probe_functions[] = {
	PHP_FE(external_lib_probe_score, arginfo_external_lib_probe_score)
	PHP_FE_END
};

zend_module_entry external_lib_probe_module_entry = {
	STANDARD_MODULE_HEADER,
	"external_lib_probe",
	external_lib_probe_functions,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	"0.1.0",
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_EXTERNAL_LIB_PROBE
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(external_lib_probe)
#endif
