/**
 * PHP WebAssembly SAPI module.
 *
 * This file abstracts the entire PHP API with the minimal set
 * of functions required to run PHP code from JavaScript.
 */

#include <main/php.h>
#include <main/SAPI.h>
#include <main/php_main.h>
#include <main/php_variables.h>
#include <main/php_ini.h>
#include <zend_ini.h>
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

// Lowest precedence ini rules. May be overwritten by a /usr/local/etc/php.ini file:
const char WASM_HARDCODED_INI[] =
	"error_reporting = E_ALL\n"
	"display_errors = 1\n"
	"html_errors = 1\n"
	"display_startup_errors = On\n"
	"log_errors = 1\n"
	"always_populate_raw_post_data = -1\n"
	// "error_log = /tmp/stderr\n"
	"upload_max_filesize = 2000M\n"
	"post_max_size = 2000M\n"
	"session.save_path = /home/web_user\n"
	"implicit_flush = 1\n"
	"output_buffering = 0\n"
	"max_execution_time = 0\n"
	"max_input_time = -1\n\0"
;

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

typedef struct wasm_uploaded_file {
	char *key,
		 *name,
		 *type,
		 *tmp_name;
	int error, size;
	struct wasm_uploaded_file *next;
} wasm_uploaded_file_t;

typedef struct {
	char *query_string,
		*path_translated,
		*request_uri,
		*request_method,
		*content_type,
		*request_body,
		*cookies,
		*php_code
	;

	struct wasm_array_entry *server_array_entries;
	struct wasm_uploaded_file *uploaded_files;

	int content_length,
		proto_num;
} wasm_request;

static wasm_request *wasm_server_context;

int wasm_sapi_module_startup(sapi_module_struct *sapi_module);
int wasm_sapi_shutdown_wrapper(sapi_module_struct *sapi_globals);
void wasm_sapi_module_shutdown();
static int wasm_sapi_deactivate(TSRMLS_D);
#if PHP_MAJOR_VERSION == 5
static int wasm_sapi_ub_write(const char *str, uint str_length TSRMLS_DC);
static int wasm_sapi_read_post_body(char *buffer, uint count_bytes);
#else
static size_t wasm_sapi_ub_write(const char *str, size_t str_length TSRMLS_DC);
static size_t wasm_sapi_read_post_body(char *buffer, size_t count_bytes);
#endif
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 1) || PHP_MAJOR_VERSION >= 8
static void wasm_sapi_log_message(char *message TSRMLS_DC, int syslog_type_int);
#else
static void wasm_sapi_log_message(char *message TSRMLS_DC);
#endif
static void wasm_sapi_flush(void *server_context);
static int wasm_sapi_send_headers(sapi_headers_struct *sapi_headers TSRMLS_DC);
static void wasm_sapi_send_header(sapi_header_struct *sapi_header, void *server_context TSRMLS_DC);
static char *wasm_sapi_read_cookies(TSRMLS_D);
static void wasm_sapi_register_server_variables(zval *track_vars_array TSRMLS_DC);
void wasm_init_server_context();
static char *int_to_string(int i);
static int EMSCRIPTEN_KEEPALIVE run_php(char *code);

SAPI_API sapi_module_struct php_wasm_sapi_module = {
	"wasm",                        /* name */
	"PHP WASM SAPI",               /* pretty name */
	
	wasm_sapi_module_startup,      /* startup */
	wasm_sapi_shutdown_wrapper,    /* shutdown */
  
	NULL,                          /* activate */
	wasm_sapi_deactivate,          /* deactivate */
  
	wasm_sapi_ub_write,            /* unbuffered write */
	wasm_sapi_flush,               /* flush */
	NULL,                          /* get uid */
	NULL,                          /* getenv */
  
	php_error,                     /* error handler */
  
	NULL,                          /* header handler */
	wasm_sapi_send_headers,        /* send headers handler */
	wasm_sapi_send_header,         /* send header handler */
	
	wasm_sapi_read_post_body,      /* read POST data */
	wasm_sapi_read_cookies,        /* read Cookies */
  
	wasm_sapi_register_server_variables,   /* register server variables */
	wasm_sapi_log_message,          /* Log message */
	NULL,							/* Get request time */
	NULL,							/* Child terminate */
  
	STANDARD_SAPI_MODULE_PROPERTIES
};

void wasm_init_server_context() {
	wasm_server_context->query_string = NULL;
	wasm_server_context->path_translated = NULL;
	wasm_server_context->request_uri = NULL;
	wasm_server_context->request_method = NULL;
	wasm_server_context->content_type = NULL;
	wasm_server_context->content_length = -1;
	wasm_server_context->proto_num = -1;
	wasm_server_context->request_body = NULL;
	wasm_server_context->cookies = NULL;
	wasm_server_context->php_code = NULL;
	wasm_server_context->server_array_entries = NULL;
	wasm_server_context->uploaded_files = NULL;
}

void wasm_destroy_server_context() {
	if(wasm_server_context->query_string != NULL) {
		free(wasm_server_context->query_string);
	}
	if(wasm_server_context->path_translated != NULL) {
		free(wasm_server_context->path_translated);
	}
	if(wasm_server_context->request_uri != NULL) {
		free(wasm_server_context->request_uri);
	}
	if(wasm_server_context->request_method != NULL) {
		free(wasm_server_context->request_method);
	}
	if(wasm_server_context->content_type != NULL) {
		free(wasm_server_context->content_type);
	}
	if(wasm_server_context->request_body != NULL) {
		free(wasm_server_context->request_body);
	}
	if(wasm_server_context->cookies != NULL) {
		free(wasm_server_context->cookies);
	}
	if(wasm_server_context->php_code != NULL) {
		free(wasm_server_context->php_code);
	}

	// Free wasm_server_context->server_array_entries
	wasm_array_entry_t *current_entry = wasm_server_context->server_array_entries;
	while (current_entry != NULL) {
		wasm_array_entry_t *next_entry = current_entry->next;
		free(current_entry->key);
		free(current_entry->value);
		free(current_entry);
		current_entry = next_entry;
	}

	// Free wasm_server_context->uploaded_files
	wasm_uploaded_file_t *current_file = wasm_server_context->uploaded_files;
	while (current_file != NULL) {
		wasm_uploaded_file_t *next_file = current_file->next;
		free(current_file->key);
		free(current_file->name);
		free(current_file->type);
		free(current_file->tmp_name);
		free(current_file);
		current_file = next_file;
	}
}

void wasm_add_SERVER_entry(char *key, char *value) {
	wasm_array_entry_t *entry = (wasm_array_entry_t*) malloc(sizeof(wasm_array_entry_t));
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->server_array_entries;
	wasm_server_context->server_array_entries = entry;
}

void wasm_add_uploaded_file(
	char *key, 
	char *name, 
	char *type, 
	char *tmp_name,
	int error,
	int size
) {
	wasm_uploaded_file_t *entry = (wasm_uploaded_file_t*) malloc(sizeof(wasm_uploaded_file_t));
	entry->key = strdup(key);
	entry->name = strdup(name);
	entry->type = strdup(type);
	entry->tmp_name = strdup(tmp_name);
	entry->error = error;
	entry->size = size;
	entry->next = wasm_server_context->uploaded_files;
	wasm_server_context->uploaded_files = entry;
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
void wasm_set_request_body(char* request_body) {
	wasm_server_context->request_body = strdup(request_body);
}
void wasm_set_content_length(int content_length) {
	wasm_server_context->content_length = content_length;
}
void wasm_set_cookies(char* cookies) {
	wasm_server_context->cookies = strdup(cookies);
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

int stdout_replacement;
int stderr_replacement;

static char *wasm_sapi_read_cookies(TSRMLS_D)
{
	return wasm_server_context->cookies;
}

#if PHP_MAJOR_VERSION == 5
static int wasm_sapi_read_post_body(char *buffer, uint count_bytes)
#else
static size_t wasm_sapi_read_post_body(char *buffer, size_t count_bytes)
#endif
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
 *   $_FILES entries that are not in an internal hash table – it's a security feature:
 * 
 *   > is_uploaded_file
 *   >
 *   > Returns true if the file named by filename was uploaded via HTTP POST. This is
 *   > useful to help ensure that a malicious user hasn't tried to trick the script into
 *   > working on files upon which it should not be working--for instance, /etc/passwd.
 *   >
 *   > This sort of check is especially important if there is any chance that anything
 *   > done with uploaded files could reveal their contents to the user, or even to other
 *   > users on the same system.
 *   >
 *   > For proper working, the function is_uploaded_file() needs an argument like
 *   > $_FILES['userfile']['tmp_name'], - the name of the uploaded file on the client's
 *   > machine $_FILES['userfile']['name'] does not work.
 * 
 *   This function allocates that internal hash table.
 * ```
 */
void EMSCRIPTEN_KEEPALIVE phpwasm_init_uploaded_files_hash()
{
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
 *   @see phpwasm_init_uploaded_files_hash
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
 *   Destroys the internal hash table to free the memory and
 *   removes the temporary files from the filesystem.
 *
 *   @see phpwasm_init_uploaded_files_hash
 */
void EMSCRIPTEN_KEEPALIVE phpwasm_destroy_uploaded_files_hash()
{
	destroy_uploaded_files_hash();
}

int wasm_sapi_module_startup(sapi_module_struct *sapi_module) {
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

	/* SERVER_SOFTWARE */
	php_register_variable("SERVER_SOFTWARE", "PHP.wasm", track_vars_array TSRMLS_CC);

	/* SERVER_PROTOCOL */
	if(SG(request_info).proto_num != -1) {
		char* port_str = int_to_string( SG(request_info).proto_num );
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

int wasm_sapi_request_init()
{
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
	SG(sapi_headers).http_response_code = 200;

	if (php_request_startup(TSRMLS_C)==FAILURE) {
		wasm_sapi_module_shutdown();
		return FAILURE;
	}

	php_register_variable("PHP_SELF", "-", NULL TSRMLS_CC);

	// Set $_FILES in case any were passed via the wasm_server_context->uploaded_files
	// linked list
	wasm_uploaded_file_t *entry = wasm_server_context->uploaded_files;
	if (entry != NULL) {
		if( SG(rfc1867_uploaded_files) == NULL ) {
			phpwasm_init_uploaded_files_hash();
		}

		#if PHP_MAJOR_VERSION == 5
		zval *files = PG(http_globals)[TRACK_VARS_FILES];
		#else
		zval *files = &PG(http_globals)[TRACK_VARS_FILES];
		#endif
		int max_param_size = strlen(entry->key) + 11 /*[tmp_name]\0*/;
		char *param;
		char *value_buf;
		while (entry != NULL)
		{
			phpwasm_register_uploaded_file(estrdup(entry->tmp_name));

			// Set $_FILES['key']['name']
			param = malloc(max_param_size);
			snprintf(param, max_param_size, "%s[name]", entry->key);
			php_register_variable_safe(param, entry->name, strlen(entry->name), files);
			free(param);

			// Set $_FILES['key']['tmp_name']
			param = malloc(max_param_size);
			snprintf(param, max_param_size, "%s[tmp_name]", entry->key);
			php_register_variable_safe(param, entry->tmp_name, strlen(entry->tmp_name), files);
			free(param);

			// Set $_FILES['key']['type']
			param = malloc(max_param_size);
			snprintf(param, max_param_size, "%s[type]", entry->key);
			php_register_variable_safe(param, entry->type, strlen(entry->type), files);
			free(param);

			// Set $_FILES['key']['error']
			param = malloc(max_param_size);
			snprintf(param, max_param_size, "%s[error]", entry->key);
			value_buf = malloc(4);
			snprintf(value_buf, 4, "%d", entry->error);
			php_register_variable_safe(param, value_buf, strlen(value_buf), files);
			free(value_buf);
			free(param);

			// Set $_FILES['key']['size']
			param = malloc(max_param_size);
			snprintf(param, max_param_size, "%s[size]", entry->key);
			value_buf = malloc(16);
			snprintf(value_buf, 16, "%d", entry->size);
			php_register_variable_safe(param, value_buf, strlen(value_buf), files);
			free(value_buf);
			free(param);

			entry = entry->next;
		}
	}

	return SUCCESS;
}

void wasm_sapi_request_shutdown() {
	// Let's flush the output buffers. It must happen here because
	// ob_start() buffers are not flushed until the shutdown handler
	// runs.
	fflush(stdout);
	fflush(stderr);

	// Restore the regular stdout and stderr stream handlers
	restore_stream_handler(stdout, stdout_replacement);
	restore_stream_handler(stderr, stderr_replacement);

	TSRMLS_FETCH();
	if(SG(rfc1867_uploaded_files) != NULL) {
		phpwasm_destroy_uploaded_files_hash();
	}
	php_request_shutdown(NULL);
	SG(server_context) = NULL;
	
	// Destroy the old request information and prepare a fresh request
	// object.
	wasm_destroy_server_context();
	wasm_init_server_context();
}

int EMSCRIPTEN_KEEPALIVE wasm_sapi_handle_request() {
	if (wasm_sapi_request_init() == FAILURE)
	{
		wasm_sapi_request_shutdown();
	    return -1;
	}

	TSRMLS_FETCH();
	int result = run_php(wasm_server_context->php_code);
	wasm_sapi_request_shutdown();
	return result;
}

void wasm_sapi_module_shutdown() {
	php_module_shutdown(TSRMLS_C);
	sapi_shutdown();
#ifdef ZTS
    tsrm_shutdown();
#endif
	if (php_wasm_sapi_module.ini_entries) {
		free(php_wasm_sapi_module.ini_entries);
		php_wasm_sapi_module.ini_entries = NULL;
	}
}

int wasm_sapi_shutdown_wrapper(sapi_module_struct *sapi_globals)
{
	TSRMLS_FETCH();
	wasm_sapi_module_shutdown();
	return SUCCESS;
}

static int wasm_sapi_deactivate(TSRMLS_D)
{
	fflush(stdout);
	return SUCCESS;
}

static inline size_t wasm_sapi_single_write(const char *str, uint str_length)
{
#ifdef PHP_WRITE_STDOUT
	long ret;

	ret = write(STDOUT_FILENO, str, str_length);
	if (ret <= 0) return 0;
	return ret;
#else
	size_t ret;

	ret = fwrite(str, 1, MIN(str_length, 16384), stdout);
	return ret;
#endif
}

#if PHP_MAJOR_VERSION == 5
static int wasm_sapi_ub_write(const char *str, uint str_length TSRMLS_DC)
#else
static size_t wasm_sapi_ub_write(const char *str, size_t str_length TSRMLS_DC)
#endif
{
	const char *ptr = str;
	uint remaining = str_length;
	size_t ret;

	while (remaining > 0) {
		ret = wasm_sapi_single_write(ptr, remaining);
		if (!ret) {
			php_handle_aborted_connection();
		}
		ptr += ret;
		remaining -= ret;
	}

	return str_length;
}

static void wasm_sapi_flush(void *server_context)
{
	if (fflush(stdout)==EOF) {
		php_handle_aborted_connection();
	}
	sapi_send_headers(TSRMLS_C);
}

static int _fwrite(FILE *file, char *str)
{
	return fwrite(str, sizeof(char), strlen(str), file);
}

static char* int_to_string(int i)
{
	int length = snprintf( NULL, 0, "%d", i );
	char* port_str = malloc( length + 1 );
	snprintf( port_str, length + 1, "%d", i );
	return port_str;
}

FILE *headers_file;
/*
 * Function: wasm_sapi_send_headers
 * ----------------------------
 *   Saves the response HTTP status code and the response headers
 *   to a JSON file located at /tmp/headers.json.
 * 
 *   Called by PHP in the request shutdown handler.
 */
static int wasm_sapi_send_headers(sapi_headers_struct *sapi_headers TSRMLS_DC)
{
	headers_file = fopen("/tmp/headers.json", "w");
	if (headers_file == NULL)
	{
		return FAILURE;
	}

	_fwrite(headers_file, "{ \"status\": ");
	char* response_code = int_to_string( SG(sapi_headers).http_response_code );
	_fwrite(headers_file, response_code);
	free(response_code);
	_fwrite(headers_file, ", \"headers\": [");

	zend_llist_apply_with_argument(&SG(sapi_headers).headers, (llist_apply_with_arg_func_t) sapi_module.send_header, SG(server_context) TSRMLS_CC);
	if(SG(sapi_headers).send_default_content_type) {
		sapi_header_struct default_header;

		sapi_get_default_content_type_header(&default_header TSRMLS_CC);
		sapi_module.send_header(&default_header, SG(server_context) TSRMLS_CC);
		sapi_free_header(&default_header);
	}
	sapi_module.send_header(NULL, SG(server_context) TSRMLS_CC);
			
	_fwrite(headers_file, "]}");
	fclose(headers_file);
	headers_file = NULL;

	return SAPI_HEADER_SENT_SUCCESSFULLY;
}

/*
 * Function: wasm_sapi_send_header
 * ----------------------------
 *   Appends a single header line to the headers JSON file.
 */
static void wasm_sapi_send_header(sapi_header_struct *sapi_header, void *server_context TSRMLS_DC) {
	if (sapi_header == NULL)
	{
		fseek(headers_file, ftell(headers_file) - 2, SEEK_SET);
		fwrite(&"  ", sizeof( char ), 2, headers_file);
		return;
	}
	_fwrite(headers_file, "\"");
	for (int i = 0, max = sapi_header->header_len; i < max; i++){
		if(sapi_header->header[i] == '"') {
			fwrite(&"\\", sizeof( char ), 1, headers_file);
		}

		fwrite(&sapi_header->header[i], sizeof( char ), 1, headers_file);
	}
	_fwrite(headers_file, "\",\n");
}


#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 1) || PHP_MAJOR_VERSION >= 8
static void wasm_sapi_log_message(char *message TSRMLS_DC, int syslog_type_int)
#else
static void wasm_sapi_log_message(char *message TSRMLS_DC)
#endif
{
	fprintf (stderr, "%s\n", message);
}


/*
 * Function: php_wasm_init
 * ----------------------------
 *   Initiates the PHP wasm SAPI. Call this before calling any
 *   other function.
 */
int php_wasm_init() {
	wasm_init_server_context();
	wasm_server_context = malloc(sizeof(wasm_request));

#ifdef ZTS
	void ***tsrm_ls = NULL;
	tsrm_startup(1, 1, 0, NULL);
	tsrm_ls = ts_resource(0);
	*ptsrm_ls = tsrm_ls;
#endif

	sapi_startup(&php_wasm_sapi_module);

	php_wasm_sapi_module.ini_entries = malloc(sizeof(WASM_HARDCODED_INI));
	memcpy(php_wasm_sapi_module.ini_entries, WASM_HARDCODED_INI, sizeof(WASM_HARDCODED_INI));
	php_wasm_sapi_module.additional_functions = additional_functions;

	if (php_wasm_sapi_module.startup(&php_wasm_sapi_module)==FAILURE) {
		return FAILURE;
	}
	return SUCCESS;
}


/*
 * Function: phpwasm_run
 * ----------------------------
 *   Runs a PHP script. Writes the output to stdout and stderr,
 *
 *   code: The PHP code to run.
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

