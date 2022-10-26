/**
 * Public API for php.wasm.
 * 
 * This file abstracts the entire PHP API with the minimal set
 * of functions required to run PHP code in JavaScript.
 */

#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "zend_hash.h"
#include "rfc1867.h"
#include "SAPI.h"

// The final linking step weirdly won't work without these includes:
#include "sqlite3.h"
#include "sqlite3.c"
#include "sqlite_driver.c"
#include "sqlite_statement.c"
#include "pdo_sqlite.c"

/*
 * Function: phpwasm_flush
 * ----------------------------
 *   Flush any buffered stdout and stderr contents.
 */
void phpwasm_flush()
{
	fflush(stdout);
	fprintf(stdout, "\n");

	fflush(stderr);
	fprintf(stderr, "\n");
}

/*
 * Function: phpwasm_run
 * ----------------------------
 *   Runs a PHP script. Writes the output to stdout and stderr,
 *
 *   code: The PHP code to run. Must include the `<?php` opener.
 *
 *   returns: the exit code. 0 means success, 1 means the code died, 2 means an error.
 */
int EMSCRIPTEN_KEEPALIVE phpwasm_run(char *code)
{
	int retVal = 255; // Unknown error.

	zend_try
	{
		retVal = zend_eval_string(code, NULL, "php-wasm run script");

		if(EG(exception))
		{
			zend_exception_error(EG(exception), E_ERROR);
			retVal = 2;
		}
	}
	zend_catch
	{
		retVal = 1; // Code died.
	}

	zend_end_try();

	phpwasm_flush();

	return retVal;
}
/*
 * Function: phpwasm_destroy_context
 * ----------------------------
 *   Destroy the current PHP context.
 *   This function trashes the entire memory including all loaded variables,
 *   functions, classes, etc. It's like the final cleanup after running a script.
 */
void EMSCRIPTEN_KEEPALIVE phpwasm_destroy_context()
{
	return php_embed_shutdown();
}

/*
 * Function: phpwasm_init_context
 * ----------------------------
 *   Creates a new PHP context.
 *   This function enables running PHP code, allocating variables, etc.
 *   It must be called before running any script.
 */
int EMSCRIPTEN_KEEPALIVE phpwasm_init_context()
{
	putenv("USE_ZEND_ALLOC=0");

	return php_embed_init(0, NULL);
}

/*
 * Function: phpwasm_refresh
 * ----------------------------
 *   Destroy the current PHP context (variables, functions, memory etc)
 *   and start a new one.
 */
int EMSCRIPTEN_KEEPALIVE phpwasm_refresh()
{
	phpwasm_destroy_context();

	return phpwasm_init_context();
}

// === FILE UPLOADS SUPPORT ===

/*
 * Function: free_filename
 * ----------------------------
 *   Frees the memory after a zval allocated to store the uploaded
 *   variable name.
 */
static void free_filename(zval *el) {
	// Uncommenting this code causes a runtime error in the browser:
	// @TODO evaluate whether keeping it commented leads to a memory leak
	//       and how to fix it if it does.
	// zend_string *filename = Z_STR_P(el);
	// zend_string_release_ex(filename, 0);
}

/*
 * Function: phpwasm_init_uploaded_files_hash
 * ----------------------------
 *   Allocates an internal HashTable to keep track of the legitimate uploads.
 *   
 *   Functions like `is_uploaded_file` or `move_uploaded_file` don't work with
 *   $_FILES entries that are not in an internal hash table. It's a security feature.
 *   This function allocates that internal hash table.
 *   
 *   @see PHP.initUploadedFilesHash in the JavaScript package for more details.
 */
void EMSCRIPTEN_KEEPALIVE phpwasm_init_uploaded_files_hash()
{
	zend_hash_init(&PG(rfc1867_protected_variables), 8, NULL, NULL, 0);

	HashTable *uploaded_files = NULL;
	ALLOC_HASHTABLE(uploaded_files);
	zend_hash_init(uploaded_files, 8, NULL, free_filename, 0);
	SG(rfc1867_uploaded_files) = uploaded_files;
}

/*
 * Function: phpwasm_register_uploaded_file
 * ----------------------------
 *   Registers an uploaded file in the internal hash table.
 *   
 *   @see PHP.initUploadedFilesHash in the JavaScript package for more details.
 */
void EMSCRIPTEN_KEEPALIVE phpwasm_register_uploaded_file(char *tmp_path_char)
{
	zend_string *tmp_path = zend_string_init(tmp_path_char, strlen(tmp_path_char), 1);
	zend_hash_add_ptr(SG(rfc1867_uploaded_files), tmp_path, tmp_path);
}

/*
 * Function: phpwasm_destroy_uploaded_files_hash
 * ----------------------------
 *   Destroys the internal hash table to free the memory.
 *   
 *   @see PHP.initUploadedFilesHash in the JavaScript package for more details.
 */
void EMSCRIPTEN_KEEPALIVE phpwasm_destroy_uploaded_files_hash()
{
	destroy_uploaded_files_hash();
}

#ifdef WITH_VRZNO
#include "../php-src/ext/vrzno/php_vrzno.h"

/*
 * Function: exec_callback
 * ----------------------------
 *   Required by the VRZNO module.
 *   Why? I'm not sure.
 *   
 *   @see https://github.com/seanmorris/vrzno
 */
int EMSCRIPTEN_KEEPALIVE exec_callback(zend_function *fptr)
{
	int retVal = vrzno_exec_callback(fptr);

	fflush(stdout);

	return retVal;
}

/*
 * Function: del_callback
 * ----------------------------
 *   Required by the VRZNO module.
 *   Why? I'm not sure.
 *   
 *   @see https://github.com/seanmorris/vrzno
 */
int EMSCRIPTEN_KEEPALIVE del_callback(zend_function *fptr)
{
	return vrzno_del_callback(fptr);
}
#endif
