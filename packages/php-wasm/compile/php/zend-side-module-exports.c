/**
 * Zend symbols required by dynamically-loaded PHP extension side modules.
 *
 * MAIN_MODULE=2 only exports explicitly requested symbols. These references
 * keep the symbols visible to the linker so the Dockerfile can export them.
 */
#include <main/php.h>
#include <main/SAPI.h>
#include <ext/standard/file.h>

#include "zend_API.h"
#include "zend_compile.h"
#include "zend_exceptions.h"
#include "zend_execute.h"
#include "zend_globals.h"
#include "zend_interfaces.h"
#include "zend_object_handlers.h"
#include "zend_objects.h"
#include "zend_variables.h"

#if PHP_VERSION_ID >= 70000
#include "zend_string.h"
#endif

#if PHP_VERSION_ID >= 80100
#include "zend_enum.h"
#endif

#define PLAYGROUND_SIDE_MODULE_EXPORT __attribute__((used, visibility("default")))

PLAYGROUND_SIDE_MODULE_EXPORT void *_playground_zend_side_module_data_exports[] = {
#if PHP_VERSION_ID >= 70000
	(void *)&zend_ce_exception,
#endif
	(void *)&zend_ce_traversable,
	(void *)&zend_ce_iterator,
	(void *)&zend_ce_aggregate,
	(void *)&zend_ce_arrayaccess,
#if PHP_VERSION_ID >= 70200
	(void *)&zend_ce_countable,
#endif
#if PHP_VERSION_ID >= 70000
	(void *)&zend_ce_throwable,
#endif
#if PHP_VERSION_ID < 90000
	(void *)&zend_ce_serializable,
#endif
#if PHP_VERSION_ID >= 80000
	(void *)&zend_ce_stringable,
	(void *)&zend_ce_unhandled_match_error,
	(void *)&zend_ce_division_by_zero_error,
#endif
#if PHP_VERSION_ID >= 80100
	(void *)&zend_ce_unit_enum,
	(void *)&zend_ce_backed_enum,
#endif
#if PHP_VERSION_ID >= 70300
	(void *)&zend_string_init_interned,
#endif
#if PHP_VERSION_ID >= 70000
	(void *)&zend_empty_string,
	(void *)&zend_one_char_string,
#endif
	(void *)&std_object_handlers,
	(void *)&executor_globals,
	(void *)&compiler_globals,
	(void *)&sapi_globals,
	(void *)&file_globals,
	(void *)&sapi_module,
	(void *)&zend_compile_string,
	NULL,
};

typedef void (*playground_side_module_function)(void);

PLAYGROUND_SIDE_MODULE_EXPORT
playground_side_module_function _playground_zend_side_module_function_exports[] = {
#if PHP_VERSION_ID >= 70000
	(playground_side_module_function)zend_get_executed_scope,
#endif
	(playground_side_module_function)zend_execute,
#if PHP_VERSION_ID >= 70000
	(playground_side_module_function)zval_ptr_dtor,
#endif
#if PHP_VERSION_ID >= 80100
	(playground_side_module_function)zend_destroy_static_vars,
#endif
#if PHP_VERSION_ID < 70000
	(playground_side_module_function)_zval_ptr_dtor,
#endif
	(playground_side_module_function)destroy_op_array,
	(playground_side_module_function)_efree,
	(playground_side_module_function)_zend_bailout,
	NULL,
};
