/**
 * Allows changing the SAPI name at runtime.
 *
 * Affects:
 * - php_sapi_name()
 * - PHP_SAPI constant
 *
 * Usage:
 * ```php
 * set_sapi_name('wasm');
 * ```
 */
#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

#include "php.h"
#include "SAPI.h"
#include "zend_constants.h"
#include "ext/standard/info.h"
#include "wasm_sapi_override.h"
#include "ext/standard/php_string.h"
#include "zend_smart_string.h"

static char *set_sapi_name_original_name = NULL;
static char *set_sapi_name_prev_allocated = NULL;

/* {{{ proto bool set_sapi_name(string $new_name) */
PHP_FUNCTION(set_sapi_name)
{
    char  *new_name;
    size_t new_len;

    ZEND_PARSE_PARAMETERS_START(1, 1)
        Z_PARAM_STRING(new_name, new_len)
    ZEND_PARSE_PARAMETERS_END();

    /* --- overwrite sapi_module.name ------------------------------------- */
    if (!set_sapi_name_original_name) {
        set_sapi_name_original_name = sapi_module.name;  /* remember for restore */
    }

    char *buf = pemalloc(new_len + 1, 1);      /* persistent */
    memcpy(buf, new_name, new_len);
    buf[new_len] = '\0';

    if (set_sapi_name_prev_allocated) {
        pefree(set_sapi_name_prev_allocated, 1);
    }
    sapi_module.name = buf;
    set_sapi_name_prev_allocated   = buf;

    /* --- update PHP_SAPI constant --------------------------------------- */
    zend_string *const_name = zend_string_init("PHP_SAPI", sizeof("PHP_SAPI") - 1, 0);
    zend_constant *c        = zend_hash_find_ptr(EG(zend_constants), const_name);

    zend_string *new_zstr   = zend_string_init(new_name, new_len, 1); /* persistent */

    if (c) {
        if (Z_TYPE(c->value) == IS_STRING) {
            zend_string *old = Z_STR(c->value);
            /* Only release if it's not interned (interned strings live for entire process) */
            if (!ZSTR_IS_INTERNED(old)) {
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION == 2)
                zend_string_release(old);
#else
                zend_string_release_ex(old, 1);
#endif
            }
        }
        ZVAL_STR(&c->value, new_zstr);
    } else {
        zval zv;
        ZVAL_STR(&zv, new_zstr);
        zend_register_constant(&(zend_constant){
            .name          = const_name,
            .value         = zv,
        });
    }
    #if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION == 2)
        zend_string_release(const_name);
    #else
        zend_string_release_ex(const_name, 0);
    #endif

    RETURN_TRUE;
}
/* }}} */

/* arginfo */
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_set_sapi_name, 0, 1, _IS_BOOL, 0)
	ZEND_ARG_TYPE_INFO(0, new_name, IS_STRING, 0)
ZEND_END_ARG_INFO()

/* function list */
static const zend_function_entry wasm_sapi_override_functions[] = {
	PHP_FE(set_sapi_name, arginfo_set_sapi_name)
	PHP_FE_END
};

/* MINIT / MSHUTDOWN */
static PHP_MINIT_FUNCTION(wasm_sapi_override) { return SUCCESS; }

static PHP_MSHUTDOWN_FUNCTION(wasm_sapi_override)
{
	if (set_sapi_name_prev_allocated) {
		pefree(set_sapi_name_prev_allocated, 1);
		set_sapi_name_prev_allocated = NULL;
	}
	if (set_sapi_name_original_name) {
		sapi_module.name = set_sapi_name_original_name;
	}
	return SUCCESS;
}

/* info */
static PHP_MINFO_FUNCTION(wasm_sapi_override)
{
	php_info_print_table_start();
	php_info_print_table_row(2, "set_sapi_name support", "enabled");
	php_info_print_table_row(2, "version", PHP_WASM_SAPI_OVERRIDE_MODULE_VERSION);
	php_info_print_table_row(2, "current SAPI", sapi_module.name);
	php_info_print_table_end();
}

/* module entry */
zend_module_entry wasm_sapi_override_module_entry = {
	STANDARD_MODULE_HEADER,
	"wasm_sapi_override",              /* Extension name */
	wasm_sapi_override_functions,      /* Function entries */
	PHP_MINIT(wasm_sapi_override),     /* PHP_MINIT - Module initialization */
	PHP_MSHUTDOWN(wasm_sapi_override), /* PHP_MSHUTDOWN - Module shutdown */
	NULL,                         /* PHP_RINIT - Request initialization */
	NULL,                         /* PHP_RSHUTDOWN - Request shutdown */
	PHP_MINFO(wasm_sapi_override),     /* PHP_MINFO - Module info */
	PHP_WASM_SAPI_OVERRIDE_MODULE_VERSION,    /* Version */
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_WASM_SAPI_OVERRIDE
# ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
# endif
ZEND_GET_MODULE(wasm_sapi_override)
#endif
