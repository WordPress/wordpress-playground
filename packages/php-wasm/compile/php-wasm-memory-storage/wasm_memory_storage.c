/* wasm_memory_storage extension for PHP */

#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

#include <stdio.h>
#include "php.h"
#include "ext/standard/info.h"
#include "Zend/zend_alloc.h"
#include "php_wasm_memory_storage.h"

void* wasm_memory_storage_chunk_alloc(zend_mm_storage* storage, size_t size, size_t alignment)
{
	void* ptr = NULL;
	if (posix_memalign(&ptr, alignment, size) == 0)
	{
		return ptr;
	} else {
		return NULL;
	}
}

void wasm_memory_storage_chunk_free(zend_mm_storage* storage, void* ptr, size_t size)
{
	free(ptr);
}

zend_mm_storage wasm_memory_storage_struct = {
	.handlers = {
		.chunk_alloc = &wasm_memory_storage_chunk_alloc,
		.chunk_free = &wasm_memory_storage_chunk_free,
		.chunk_truncate = NULL,
		.chunk_extend = NULL,
	},
	.data = NULL,
};

// TODO: Show where this was derived from. Defaults in zend_alloc.c
#ifndef ZEND_MM_CUSTOM
# define ZEND_MM_CUSTOM 1  /* support for custom memory allocator            */
#endif
#ifndef ZEND_MM_STORAGE
# define ZEND_MM_STORAGE 1 /* support for custom memory storage              */
#endif

// TODO: Link to struct decl that is being mirrored
typedef struct _wasm_memory_storage_heap {
#if ZEND_MM_CUSTOM
	int custom;
#endif
#if ZEND_MM_STORAGE
	zend_mm_storage   *storage;
#endif
} wasm_memory_storage_heap;

PHP_RINIT_FUNCTION(wasm_memory_storage)
{
	wasm_memory_storage_heap* heap = (wasm_memory_storage_heap*) zend_mm_get_heap();
	heap->storage = &wasm_memory_storage_struct;

	return SUCCESS;
}

/* {{{ PHP_MINFO_FUNCTION */
PHP_MINFO_FUNCTION(wasm_memory_storage)
{
	php_info_print_table_start();
	php_info_print_table_row(2, "wasm_memory_storage support", "enabled");
	php_info_print_table_end();
}
/* }}} */

/* {{{ wasm_memory_storage_module_entry */
zend_module_entry wasm_memory_storage_module_entry = {
	STANDARD_MODULE_HEADER,
	"wasm_memory_storage",			/* Extension name */
	NULL,					        /* zend_function_entry */
	NULL,                           /* PHP_MINIT - Module initialization */
	NULL,							/* PHP_MSHUTDOWN - Module shutdown */
	PHP_RINIT(wasm_memory_storage),	/* PHP_RINIT - Request initialization */
	NULL,							/* PHP_RSHUTDOWN - Request shutdown */
	PHP_MINFO(wasm_memory_storage),			/* PHP_MINFO - Module info */
	PHP_WASM_MEMORY_STORAGE_VERSION,		/* Version */
	STANDARD_MODULE_PROPERTIES
};
/* }}} */
