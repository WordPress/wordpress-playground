/**
 * Public API for php.wasm.
 *
 * This file abstracts the entire PHP API with the minimal set
 * of functions required to run PHP code in JavaScript.
 */

#include "sapi/embed/php_embed.h"
#include "ext/standard/php_standard.h"
#include <emscripten.h>
#include <stdlib.h>
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "zend_hash.h"
#include "rfc1867.h"
#include "SAPI.h"

const char WASM_WARDCODED_INI[] =
	"html_errors=0\n"
	"register_argc_argv=1\n"
	"post_max_size=10000M\n"
	"implicit_flush=1\n"
	"output_buffering=0\n"
	"max_execution_time=0\n"
	"max_input_time=-1\n\0";

ZEND_BEGIN_ARG_INFO(arginfo_dl, 0)
	ZEND_ARG_INFO(0, extension_filename)
ZEND_END_ARG_INFO()
static const zend_function_entry additional_functions[] = {
	ZEND_FE(dl, arginfo_dl)
	{NULL, NULL, NULL}
};

#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 4) || PHP_MAJOR_VERSION >= 8
#include "sqlite3.h"
#include "sqlite3.c"
#endif
#if PHP_MAJOR_VERSION >= 8
// In PHP 8 the final linking step won't
// work without these includes:
#include "sqlite_driver.c"
#include "sqlite_statement.c"
#include "pdo_sqlite.c"
#endif

typedef struct wasm_array_entry {
    char *key;
    char *value;
    struct wasm_array_entry *next;
} wasm_array_entry_t;

typedef struct {
	char *query_string,
		*path_translated,
		*request_uri,
		*request_method,
		*content_type,
		*http_response_code,
		*request_body,
		*php_code
	;

	struct wasm_array_entry *server_array_entries;

	int content_length,
		proto_num;
} wasm_request;

static wasm_request *wasm_server_context;

void wasm_init_server_context() {
	wasm_server_context->query_string = NULL;
	wasm_server_context->path_translated = NULL;
	wasm_server_context->request_uri = NULL;
	wasm_server_context->request_method = NULL;
	wasm_server_context->content_type = NULL;
	wasm_server_context->content_length = -1;
	wasm_server_context->http_response_code = NULL;
	wasm_server_context->proto_num = -1;
	wasm_server_context->request_body = NULL;
	wasm_server_context->php_code = NULL;
	wasm_server_context->server_array_entries = NULL;
}

void wasm_destroy_server_context() {
	free(wasm_server_context->query_string);
	free(wasm_server_context->path_translated);
	free(wasm_server_context->request_uri);
	free(wasm_server_context->request_method);
	free(wasm_server_context->content_type);
	free(wasm_server_context->http_response_code);
	free(wasm_server_context->request_body);
	free(wasm_server_context->php_code);

	// Free wasm_server_context->server_array_entries
	wasm_array_entry_t *current = wasm_server_context->server_array_entries;
	while (current != NULL) {
		wasm_array_entry_t *next = current->next;
		free(current->key);
		free(current->value);
		free(current);
		current = next;
	}
	free(wasm_server_context->server_array_entries);
}

void wasm_add_SERVER_entry(char *key, char *value) {
	wasm_array_entry_t *entry = (wasm_array_entry_t*) malloc(sizeof(wasm_array_entry_t));
	entry->key = key;
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->server_array_entries;
	wasm_server_context->server_array_entries = entry;
}

void wasm_set_query_string(char* query_string) {
	wasm_server_context->query_string = strdup(query_string);
}
void wasm_set_path_translated(char* path_translated) {
	wasm_server_context->path_translated = strdup(path_translated);
}
void wasm_set_request_uri(char* request_uri) {
	wasm_server_context->request_uri = strdup(request_uri);
}
void wasm_set_request_method(char* request_method) {
	wasm_server_context->request_method = strdup(request_method);
}
void wasm_set_content_type(char* content_type) {
	wasm_server_context->content_type = strdup(content_type);
}
void wasm_set_http_response_code(char* http_response_code) {
	wasm_server_context->http_response_code = strdup(http_response_code);
}
void wasm_set_request_body(char* request_body) {
	wasm_server_context->request_body = strdup(request_body);
	wasm_server_context->content_length = strlen(request_body);
}
void wasm_set_php_code(char* code) {
	wasm_server_context->php_code = strdup(code);
}
void wasm_set_proto_num(int proto_num) {
	wasm_server_context->proto_num = proto_num;
}

/*
 * Function: redirect_stream_to_file
 * ----------------------------
 *   Redirects writes from a given stream to a file with a speciied path.
 *   Think of it as a the ">" operator in "echo foo > bar.txt" bash command.
 *
 *   This is useful to pass streams of bytes containing null bytes to JavaScript
 *   handlers. You can't do that via stdout and stderr because Emscripten truncates
 *   null bytes from these streams.
 *
 *   stream: The stream to redirect, e.g. stdout or stderr.
 *
 *   path: The path to the file to redirect to, e.g. "/tmp/stdout".
 *
 *   returns: The exit code: 0 on success, -1 on failure.
 */
static int redirect_stream_to_file(FILE *stream, char *file_path)
{
	int out = open(file_path, O_TRUNC | O_WRONLY | O_CREAT, 0600);
	if (-1 == out)
	{
		return -1;
	}

	int replacement_stream = dup(fileno(stream));
	if (-1 == dup2(out, fileno(stream)))
	{
		perror("cannot redirect stdout");
		return -1;
	}

	return replacement_stream;
}

/*
 * Function: restore_stream_handler
 * ----------------------------
 *   Restores a stream handler to its original state from before the redirect_stream_to_file
 *   function was called.
 *
 *   stream: The stream to restore, e.g. stdout or stderr.
 *
 *   replacement_stream: The replacement stream returned by the redirect_stream_to_file function.
 */
static void restore_stream_handler(FILE *original_stream, int replacement_stream)
{
	dup2(replacement_stream, fileno(original_stream));
	close(replacement_stream);
}

/*
 * Function: phpwasm_run
 * ----------------------------
 *   Runs a PHP script. Writes the output to stdout and stderr,
 *
 *   code: The PHP code to run. Must include the `<?php` opener.
 *
 *   returns: The exit code. 0 means success, 1 means the code died, 2 means an error.
 */
static int EMSCRIPTEN_KEEPALIVE run_php(char *code)
{
	int retVal = 255; // Unknown error.


	zend_try
	{
		retVal = zend_eval_string(code, NULL, "php-wasm run script");

		if (EG(exception))
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

	return retVal;
}

int stdout_replacement;
int stderr_replacement;

static int wasm_sapi_read_post_body(char *buffer, uint count_bytes)
{
	if (wasm_server_context == NULL || wasm_server_context->request_body == NULL)
	{
		return 0;
	}

	count_bytes = MIN(count_bytes, SG(request_info).content_length - SG(read_post_bytes));
	if(count_bytes > 0) {
		memcpy(buffer + SG(read_post_bytes), wasm_server_context->request_body + SG(read_post_bytes), count_bytes);
	}
	return count_bytes;
}

// === FILE UPLOADS SUPPORT ===

/*
 * Function: free_filename
 * ----------------------------
 *   Frees the memory after a zval allocated to store the uploaded
 *   variable name.
 */
static void free_filename(zval *el)
{
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
	#if PHP_MAJOR_VERSION == 5
	zend_hash_init(uploaded_files, 5, NULL, (dtor_func_t) free_estring, 0);
	#else
	zend_hash_init(uploaded_files, 8, NULL, free_filename, 0);
	#endif
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
	#if PHP_MAJOR_VERSION == 5
		zend_hash_add(SG(rfc1867_uploaded_files), tmp_path_char, strlen(tmp_path_char) + 1, &tmp_path_char, sizeof(char *), NULL);
	#else
		zend_string *tmp_path = zend_string_init(tmp_path_char, strlen(tmp_path_char), 1);
		zend_hash_add_ptr(SG(rfc1867_uploaded_files), tmp_path, tmp_path);
	#endif
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

int wasm_sapi_module_startup(sapi_module_struct *sapi_module) {
	SG(server_context) = wasm_server_context;
	SG(request_info).query_string = wasm_server_context->query_string;
	SG(request_info).path_translated = wasm_server_context->path_translated;
	SG(request_info).request_uri = wasm_server_context->request_uri;
	SG(request_info).request_method = wasm_server_context->request_method;
	SG(request_info).proto_num = wasm_server_context->proto_num;
	SG(request_info).content_type = wasm_server_context->content_type;
	SG(request_info).content_length = wasm_server_context->content_length;
	SG(sapi_headers).http_response_code = 200; //r->status;
	if (php_module_startup(sapi_module, NULL, 0)==FAILURE) {
		return FAILURE;
	}
	return SUCCESS;
}

static void wasm_sapi_register_server_variables(zval *track_vars_array TSRMLS_DC)
{
	php_import_environment_variables(track_vars_array TSRMLS_CC);

	char *value;
	/* PHP_SELF and REQUEST_URI */
	value = SG(request_info).request_uri;
	if (value != NULL) {
		php_register_variable("SCRIPT_NAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("SCRIPT_FILENAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("PHP_SELF", value, track_vars_array TSRMLS_CC);
		php_register_variable("REQUEST_URI", value, track_vars_array TSRMLS_CC);
	}

	/* argv */
	value = SG(request_info).query_string;
	if (value != NULL)
		php_register_variable("argv", value, track_vars_array TSRMLS_CC);

	/* SERVER_NAME and HTTP_HOST */
	// value = lstFset_get(rc->t->req_hdrs, "host");
	// if (value != NULL) {
	// 	php_register_variable("HTTP_HOST", value, track_vars_array TSRMLS_CC);
	// 	/* TODO: This should probably scrub the port value if one is present. */
	// 	php_register_variable("SERVER_NAME", value, track_vars_array TSRMLS_CC);
	// }

	/* SERVER_SOFTWARE */
	php_register_variable("SERVER_SOFTWARE", "PHP.wasm", track_vars_array TSRMLS_CC);

	/* SERVER_PROTOCOL */
	if(SG(request_info).proto_num != -1) {
		int length = snprintf( NULL, 0, "%d", SG(request_info).proto_num );
		char* port_str = malloc( length + 1 );
		snprintf( port_str, length + 1, "%d", SG(request_info).proto_num );
		php_register_variable("SERVER_PROTOCOL", port_str, track_vars_array TSRMLS_CC);
		free(port_str);
	}

	/* REQUEST_METHOD */
	value = SG(request_info).request_method;
	if (value != NULL) 
		php_register_variable("REQUEST_METHOD", value, track_vars_array TSRMLS_CC);

	/* QUERY_STRING */
	value = SG(request_info).query_string;
	if (value != NULL)
		php_register_variable("QUERY_STRING", value, track_vars_array TSRMLS_CC);

	// Register entries from wasm_server_context->server_array_entries linked list
	wasm_array_entry_t *entry = wasm_server_context->server_array_entries;
	while (entry != NULL) {
		php_register_variable(entry->key, entry->value, track_vars_array TSRMLS_CC);
		entry = entry->next;
	}
}

int wasm_sapi_request_init() {
	putenv("USE_ZEND_ALLOC=0");

	// Write to files instead of stdout and stderr because Emscripten truncates null
	// bytes from stdout and stderr, and null bytes are a valid output when streaming
	// binary data.
	stdout_replacement = redirect_stream_to_file(stdout, "/tmp/stdout");
	stderr_replacement = redirect_stream_to_file(stderr, "/tmp/stderr");
	if (stdout_replacement == -1 || stderr_replacement == -1)
	{
		return -1;
	}

	zend_llist global_vars;
	zend_llist_init(&global_vars, sizeof(char *), NULL, 0);  

	/* Set some Embedded PHP defaults */
	SG(options) |= SAPI_OPTION_NO_CHDIR;

	SG(server_context) = wasm_server_context;
	SG(request_info).query_string = wasm_server_context->query_string;
	SG(request_info).path_translated = wasm_server_context->path_translated;
	SG(request_info).request_uri = wasm_server_context->request_uri;
	SG(request_info).proto_num = wasm_server_context->proto_num;
	SG(request_info).request_method = wasm_server_context->request_method;
	SG(request_info).content_type = wasm_server_context->content_type;
	SG(request_info).content_length = wasm_server_context->content_length;
	SG(sapi_headers).http_response_code = 200; //r->status;

	if (php_request_startup(TSRMLS_C)==FAILURE) {
		php_module_shutdown(TSRMLS_C);
		return FAILURE;
	}

	SG(headers_sent) = 1;
	SG(request_info).no_headers = 1;
	php_register_variable("PHP_SELF", "-", NULL TSRMLS_CC);

	return SUCCESS;
}

void wasm_sapi_request_shutdown() {
	TSRMLS_FETCH();
	SG(server_context) = NULL;
	// php_embed_shutdown();

	// Let's flush the output buffers. It must happen here because
	// ob_start() buffers are not flushed until the shutdown handler
	// runs.
	fflush(stdout);
	fflush(stderr);

	// Restore the regular stdout and stderr stream handlers
	restore_stream_handler(stdout, stdout_replacement);
	restore_stream_handler(stderr, stderr_replacement);
	
	// Destroy the old request information and prepare a fresh request
	// object.
	wasm_destroy_server_context();
	wasm_init_server_context();
}

int EMSCRIPTEN_KEEPALIVE wasm_sapi_handle_request() {
    if (wasm_sapi_request_init() == FAILURE ) {
		wasm_sapi_request_shutdown();
        return -1;
    }
	
	TSRMLS_FETCH();
	int result = run_php(wasm_server_context->php_code);
	wasm_sapi_request_shutdown();
	return result;
}


int php_wasm_init() {
	wasm_init_server_context();

	php_embed_module.read_post = *wasm_sapi_read_post_body;
	php_embed_module.startup = *wasm_sapi_module_startup;
	php_embed_module.register_server_variables = *wasm_sapi_register_server_variables;
	wasm_server_context = malloc(sizeof(wasm_request));

#ifdef ZTS
	void ***tsrm_ls = NULL;
	tsrm_startup(1, 1, 0, NULL);
	tsrm_ls = ts_resource(0);
	*ptsrm_ls = tsrm_ls;
#endif

	php_embed_module.ini_entries = malloc(sizeof(WASM_WARDCODED_INI));
	memcpy(php_embed_module.ini_entries, WASM_WARDCODED_INI, sizeof(WASM_WARDCODED_INI));
	php_embed_module.additional_functions = additional_functions;

	sapi_startup(&php_embed_module);
	if (php_embed_module.startup(&php_embed_module)==FAILURE) {
		return FAILURE;
	}
	return SUCCESS;
}

#ifdef WITH_VRZNO
#include "../php-src/ext/vrzno/php_vrzno.h"

/*
 * Function: exec_callback
 * ----------------------------
 *   Required by the VRZNO module.
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
 *
 *   @see https://github.com/seanmorris/vrzno
 */
int EMSCRIPTEN_KEEPALIVE del_callback(zend_function *fptr)
{
	return vrzno_del_callback(fptr);
}
#endif

