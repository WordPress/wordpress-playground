/**
 * This file is glue code for the opcache extension. It is used to build
 * the opcache extension as a static extension.
 */

#include "php.h"
#include "php_opcache.h"
#include "Zend/zend_extensions.h"

/* Dummy module functions */
PHP_MINIT_FUNCTION(opcache)
{
	/**
	 * Register the Zend extension
	 *
	 * NOTE: The name `zend_extension_entry` sounds generic but actually
	 * references the opcache-specific variable declared here:
	 * https://github.com/php/php-src/blob/0f731b455c3759cd15698d8aeb98535feb86f8f1/ext/opcache/ZendAccelerator.c#L5022
	 */
	extern zend_extension zend_extension_entry;
	zend_register_extension(&zend_extension_entry, NULL);
	return SUCCESS;
}

/* Dummy module shutdown function */
PHP_MSHUTDOWN_FUNCTION(opcache)
{
	/* The actual shutdown is handled by the Zend extension */
	return SUCCESS;
}

/* Dummy PHP module entry for static builds */
zend_module_entry opcache_module_entry = {
	STANDARD_MODULE_HEADER,
	"opcache",
	NULL, /* functions */
	PHP_MINIT(opcache),
	PHP_MSHUTDOWN(opcache),
	NULL, /* RINIT */
	NULL, /* RSHUTDOWN */
	NULL, /* MINFO */
	PHP_VERSION,
	STANDARD_MODULE_PROPERTIES
};
