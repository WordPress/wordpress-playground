#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include <libxml/parser.h>
#include <libxml/tree.h>

PHP_FUNCTION(xml_probe_root_name)
{
	zend_string *xml;

	ZEND_PARSE_PARAMETERS_START(1, 1)
		Z_PARAM_STR(xml)
	ZEND_PARSE_PARAMETERS_END();

	xmlDocPtr document = xmlReadMemory(
		ZSTR_VAL(xml),
		(int) ZSTR_LEN(xml),
		"input.xml",
		NULL,
		XML_PARSE_NONET
	);
	if (document == NULL) {
		RETURN_FALSE;
	}

	xmlNodePtr root = xmlDocGetRootElement(document);
	if (root == NULL || root->name == NULL) {
		xmlFreeDoc(document);
		RETURN_FALSE;
	}

	RETVAL_STRING((const char *) root->name);
	xmlFreeDoc(document);
}

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_xml_probe_root_name, 0, 1, IS_STRING, 1)
	ZEND_ARG_TYPE_INFO(0, xml, IS_STRING, 0)
ZEND_END_ARG_INFO()

static const zend_function_entry xml_probe_functions[] = {
	PHP_FE(xml_probe_root_name, arginfo_xml_probe_root_name)
	PHP_FE_END
};

zend_module_entry xml_probe_module_entry = {
	STANDARD_MODULE_HEADER,
	"xml_probe",
	xml_probe_functions,
	NULL,
	NULL,
	NULL,
	NULL,
	NULL,
	"0.1.0",
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_XML_PROBE
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(xml_probe)
#endif
