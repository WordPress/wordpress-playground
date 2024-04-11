/**
 * wasm_memory_storage extension for PHP.
 *
 * The purpose of this extension is to work around a memory leak caused by
 * failing attempts to partially unmap memory allocated with mmap().
 * By providing custom memory storage, we can avoid mmap()/munmap() calls and
 * use posix_memalign()/free() instead.
 *
 * Background:
 * Issue: https://github.com/WordPress/wordpress-playground/issues/1128
 * PR: https://github.com/WordPress/wordpress-playground/pull/1189
 */

#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

#include <stdlib.h>
#include <string.h>
#include "php.h"
#include "ext/standard/info.h"
#include "Zend/zend_alloc.h"
#include "php_wasm_memory_storage.h"

/**
 * Allocate a chunk of memory.
 *
 * This function implements the PHP Zend custom memory storage operation "chunk_free()".
 *
 * Here is an example offered in the PHP source code:
 * https://github.com/php/php-src/blob/dbaeb62ab1e34067057170ab50cf39d1bde584d8/Zend/zend_alloc.h#L325
 *
 * @param storage   The zend_mm_storage struct for this allocation.
 * @param size      The number of bytes to allocate.
 * @param alignment The byte alignment of the memory allocation.
 * @returns A pointer to allocated memory or NULL on failure.
 */
void* wasm_memory_storage_chunk_alloc(zend_mm_storage* storage, size_t size, size_t alignment)
{
	void* ptr = NULL;
	if (posix_memalign(&ptr, alignment, size) == 0)
	{
		memset(ptr, 0, size);
		return ptr;
	} else {
		return NULL;
	}
}

/**
 * Free a chunk of memory.
 *
 * This function implements the PHP Zend custom memory storage operation "chunk_free()".
 *
 * Here is an example offered in the PHP source code:
 * https://github.com/php/php-src/blob/dbaeb62ab1e34067057170ab50cf39d1bde584d8/Zend/zend_alloc.h#L352
 *
 * @param storage The zend_mm_storage struct for this memory.
 * @param ptr	  The pointer to the memory to free.
 * @param size    The size of the memory to free. Ignored.
 * @returns void
 */
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

// These definitions are mirrored from zend_alloc.c:
// https://github.com/php/php-src/blob/dbaeb62ab1e34067057170ab50cf39d1bde584d8/Zend/zend_alloc.c#L131-L137
#ifndef ZEND_MM_CUSTOM
# define ZEND_MM_CUSTOM 1  /* support for custom memory allocator            */
#endif
#ifndef ZEND_MM_STORAGE
# define ZEND_MM_STORAGE 1 /* support for custom memory storage              */
#endif

// This struct mirrors the heap structure, which is declared privately
// in zend_alloc.c. We use this to more easily and clearly assign our custom memory storage handler.
// https://github.com/php/php-src/blob/dbaeb62ab1e34067057170ab50cf39d1bde584d8/Zend/zend_alloc.c#L234-L240
typedef struct _wasm_memory_storage_heap {
#if ZEND_MM_CUSTOM
	int custom;
#endif
#if ZEND_MM_STORAGE
	zend_mm_storage   *storage;
#endif
} wasm_memory_storage_heap;

PHP_MINIT_FUNCTION(wasm_memory_storage)
{
	wasm_memory_storage_heap* heap = (wasm_memory_storage_heap*) zend_mm_get_heap();
	heap->storage = &wasm_memory_storage_struct;

	return SUCCESS;
}

PHP_MSHUTDOWN_FUNCTION(wasm_memory_storage)
{
	wasm_memory_storage_heap* heap = (wasm_memory_storage_heap*) zend_mm_get_heap();
	heap->storage = NULL;

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
	"wasm_memory_storage",              /* Extension name */
	NULL,                               /* zend_function_entry */
	PHP_MINIT(wasm_memory_storage),     /* PHP_MINIT - Module initialization */
	PHP_MSHUTDOWN(wasm_memory_storage), /* PHP_MSHUTDOWN - Module shutdown */
	NULL,                               /* PHP_RINIT - Request initialization */
	NULL,                               /* PHP_RSHUTDOWN - Request shutdown */
	PHP_MINFO(wasm_memory_storage),     /* PHP_MINFO - Module info */
	PHP_WASM_MEMORY_STORAGE_VERSION,    /* Version */
	STANDARD_MODULE_PROPERTIES
};
/* }}} */
