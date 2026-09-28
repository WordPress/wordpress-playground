#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include "Zend/zend_extensions.h"

/*
 * A pure Zend extension, like Xdebug or opcache: it exposes a
 * zend_extension_entry and the extension_version_info stamp that PHP's
 * zend_load_extension() looks up, but intentionally has NO
 * ZEND_GET_MODULE()/get_module() entry point. It is loaded with a
 * `zend_extension=` directive rather than `extension=`.
 *
 * This fixture exists to prove the build accepts extensions whose only entry
 * point is zend_extension_entry (see build-in-docker.sh's export check) and
 * that such an extension registers against a separately built PHP.wasm runtime.
 */

ZEND_DLEXPORT int external_abi_zend_startup(zend_extension *extension)
{
	/*
	 * Allocate a compile-time-constant size on the stable _emalloc() entry
	 * point, mirroring the standard-module fixture. Without the
	 * HAVE_BUILTIN_CONSTANT_P undef this would bind to a build-specific
	 * _emalloc_<size>() symbol instead.
	 */
	void *probe = emalloc(96);
	efree(probe);
	return SUCCESS;
}

/*
 * Emit the version stamp that PHP's zend_load_extension() checks. This is what
 * the ZEND_EXTENSION() macro produces, but that macro expands to ZEND_EXT_API,
 * which is not defined in this extension build's header context; ZEND_DLEXPORT
 * gives the same default visibility and is already used above.
 */
ZEND_DLEXPORT zend_extension_version_info extension_version_info = {
	ZEND_EXTENSION_API_NO,
	ZEND_EXTENSION_BUILD_ID
};

ZEND_DLEXPORT zend_extension zend_extension_entry = {
	"external_abi_zend",
	"0.1.0",
	"WordPress Playground",
	"https://developer.wordpress.org/playground/",
	"Copyright (c) WordPress Playground contributors",
	external_abi_zend_startup,
	NULL, /* shutdown */
	NULL, /* activate */
	NULL, /* deactivate */
	NULL, /* message_handler */
	NULL, /* op_array_handler */
	NULL, /* statement_handler */
	NULL, /* fcall_begin_handler */
	NULL, /* fcall_end_handler */
	NULL, /* op_array_ctor */
	NULL, /* op_array_dtor */
	STANDARD_ZEND_EXTENSION_PROPERTIES
};
