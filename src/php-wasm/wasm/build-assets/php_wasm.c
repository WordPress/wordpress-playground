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

// popen() shim
// -----------------------------------------------------------
// emscripten does not support popen() yet, so we use a shim
// that uses the JS API to run the command.
//
// js_popen_to_file is defined in js-shims.js. It runs the cmd
// command and returns the path to a file that contains the
// output. The exit code is assigned to the exit_code_ptr.
//
// The wasm_popen and wasm_pclose functions are called thanks
// to -Dpopen=wasm_popen and -Dpclose=wasm_pclose in the Dockerfile.

extern int *wasm_setsockopt(int sockfd, int level, int optname, intptr_t optval, size_t optlen, int dummy);
extern char *js_popen_to_file(const char *cmd, const char *mode, uint8_t *exit_code_ptr);

uint8_t last_exit_code;
EMSCRIPTEN_KEEPALIVE FILE *wasm_popen(const char *cmd, const char *mode)
{
    FILE *fp;
    if (*mode == 'r') {
		char *file_path = js_popen_to_file(cmd, mode, &last_exit_code);
		fp = fopen(file_path, mode);
	} else {
		printf("wasm_popen: mode '%s' not supported (cmd: %s)! \n", mode, cmd);
		errno = EINVAL;
		return 0;
	}

    return fp;
}

EMSCRIPTEN_KEEPALIVE uint8_t wasm_pclose(FILE *stream)
{
	fclose(stream);
    return last_exit_code;
}

// -----------------------------------------------------------

int wasm_socket_has_data(php_socket_t fd);
int wasm_poll_socket(php_socket_t fd, int events, int timeoutms);

/* hybrid select(2)/poll(2) for a single descriptor.
 * timeouttv follows same rules as select(2), but is reduced to millisecond accuracy.
 * Returns 0 on timeout, -1 on error, or the event mask (ala poll(2)).
 */
EMSCRIPTEN_KEEPALIVE inline int php_pollfd_for(php_socket_t fd, int events, struct timeval *timeouttv)
{
	php_pollfd p;
	int n;

	p.fd = fd;
	p.events = events;
	p.revents = 0;

	// must yield back to JS event loop to get the network response:
	wasm_poll_socket(fd, events, php_tvtoto(timeouttv));

	n = php_poll2(&p, 1, php_tvtoto(timeouttv));

	if (n > 0) {
		return p.revents;
	}

	return n;
}


ZEND_BEGIN_ARG_INFO(arginfo_dl, 0)
	ZEND_ARG_INFO(0, extension_filename)
ZEND_END_ARG_INFO()

#if WITH_CLI_SAPI == 1
#include "sapi/cli/php_cli_process_title.h"
#if PHP_MAJOR_VERSION >= 8
#include "sapi/cli/php_cli_process_title_arginfo.h"
#endif

extern int wasm_shutdown(int sockfd, int how);
extern int wasm_close(int sockfd);

/**
 * select(2) shim for PHP dev server.
 */
EMSCRIPTEN_KEEPALIVE int wasm_select(int max_fd, fd_set * read_fds, fd_set * write_fds, fd_set * except_fds, struct timeval * timeouttv) {
	emscripten_sleep(0); // always yield to JS event loop
	int timeoutms = php_tvtoto(timeouttv);
	int n = 0;
	for (int i = 0; i < max_fd; i++)
	{
		if (FD_ISSET(i, read_fds)) {
			n += wasm_poll_socket(i, POLLIN | POLLOUT, timeoutms);
		} else if (FD_ISSET(i, write_fds)) {
			n += wasm_poll_socket(i, POLLOUT, timeoutms);
		}
	}
	return n;
}

static const zend_function_entry additional_functions[] = {
	ZEND_FE(dl, arginfo_dl)
	PHP_FE(cli_set_process_title,        arginfo_cli_set_process_title)
	PHP_FE(cli_get_process_title,        arginfo_cli_get_process_title)
	{NULL, NULL, NULL}
};

typedef struct wasm_cli_arg {
    char *value;
    struct wasm_cli_arg *next;
} wasm_cli_arg_t;

int cli_argc = 0;
wasm_cli_arg_t *cli_argv;
void wasm_add_cli_arg(char *arg)
{
	++cli_argc;
	wasm_cli_arg_t *ll_entry = (wasm_cli_arg_t*) malloc(sizeof(wasm_cli_arg_t));
	ll_entry->value = strdup(arg);
	ll_entry->next = cli_argv;
	cli_argv = ll_entry;
}

/**
 * The main() function comes from PHP CLI SAPI in sapi/cli/php_cli.c
 * The file is provided by the linker and the main() function is not
 * exported from the final .wasm file at the moment.
 */
int main(int argc, char *argv[]);
int run_cli() {
	// Convert the argv linkedlist to an array:
	char **cli_argv_array = malloc(sizeof(char *) * (cli_argc ));
	wasm_cli_arg_t *current_arg = cli_argv;
	int i = 0;
	while (current_arg != NULL)
	{
		cli_argv_array[cli_argc - i - 1] = current_arg->value;
		++i;
		current_arg = current_arg->next;
	}

	return main(cli_argc, cli_argv_array);
}

#else 
static const zend_function_entry additional_functions[] = {
	ZEND_FE(dl, arginfo_dl)
	{NULL, NULL, NULL}
};
#endif

#if !defined(TSRMLS_DC)
#define TSRMLS_DC
#endif
#if !defined(TSRMLS_D)
#define TSRMLS_D
#endif
#if !defined(TSRMLS_CC)
#define TSRMLS_CC
#endif
#if !defined(TSRMLS_C)
#define TSRMLS_C
#endif
#if !defined(TSRMLS_FETCH)
#define TSRMLS_FETCH()
#endif

// Lowest precedence ini rules. May be overwritten by a /usr/local/etc/php.ini file:
const char WASM_HARDCODED_INI[] =
	"error_reporting = E_ALL\n"
	"display_errors = 1\n"
	"html_errors = 1\n"
	"display_startup_errors = On\n"
	"log_errors = 1\n"
	"always_populate_raw_post_data = -1\n"
	"upload_max_filesize = 2000M\n"
	"post_max_size = 2000M\n"
	"disable_functions = proc_open,popen,curl_exec,curl_multi_exec\n"
	"allow_url_fopen = Off\n"
	"allow_url_include = Off\n"
	"session.save_path = /home/web_user\n"
	"implicit_flush = 1\n"
	"output_buffering = 0\n"
	"max_execution_time = 0\n"
	"max_input_time = -1\n\0"
;

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

const int MODE_EVAL_CODE = 1;
const int MODE_EXECUTE_SCRIPT = 2;

typedef struct {
	char *query_string,
		*path_translated,
		*request_uri,
		*request_method,
		*request_host,
		*content_type,
		*request_body,
		*cookies,
		*php_code
	;

	struct wasm_array_entry *server_array_entries;
	struct wasm_uploaded_file *uploaded_files;

	int content_length,
		request_port,
		execution_mode,
		skip_shebang;
} wasm_server_context_t;

static wasm_server_context_t *wasm_server_context;

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
#if PHP_MAJOR_VERSION >= 8
static void wasm_sapi_log_message(const char *message TSRMLS_DC, int syslog_type_int);
#else
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 1)
static void wasm_sapi_log_message(char *message TSRMLS_DC, int syslog_type_int);
#else
static void wasm_sapi_log_message(char *message TSRMLS_DC);
#endif
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

char *phpini_path_override = NULL;
void wasm_set_phpini_path(char *path)
{
	free(phpini_path_override);
	phpini_path_override = strdup(path);
}

char *additional_phpini_entries = NULL;
void wasm_set_phpini_entries(char *ini_entries)
{
	free(additional_phpini_entries);
	additional_phpini_entries = strdup(ini_entries);
}

void wasm_init_server_context() {
	wasm_server_context->query_string = NULL;
	wasm_server_context->path_translated = NULL;
	wasm_server_context->request_uri = NULL;
	wasm_server_context->request_method = NULL;
	wasm_server_context->request_host = NULL;
	wasm_server_context->content_type = NULL;
	wasm_server_context->content_length = -1;
	wasm_server_context->request_port = -1;
	wasm_server_context->request_body = NULL;
	wasm_server_context->cookies = NULL;
	wasm_server_context->php_code = NULL;
	wasm_server_context->execution_mode = MODE_EXECUTE_SCRIPT;
	wasm_server_context->skip_shebang = 0;
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
	if(wasm_server_context->request_host != NULL) {
		free(wasm_server_context->request_host);
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


/**
 * Function: wasm_add_SERVER_entry
 * ----------------------------
 *   Adds a new entry to $_SERVER array.
 * 
 *   key: the key of the entry
 *   value: the value of the entry
 */
void wasm_add_SERVER_entry(char *key, char *value) {
	wasm_array_entry_t *entry = (wasm_array_entry_t*) malloc(sizeof(wasm_array_entry_t));
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->server_array_entries;
	wasm_server_context->server_array_entries = entry;
}

/**
 * Function: wasm_add_uploaded_file
 * ----------------------------
 *  Adds a new entry to the $_FILES array.
 * 
 *  key: the key of the $_FILES entry, e.g. my_file for $_FILES['my_file']
 *  name: the name of the file, e.g. notes.txt
 *  type: the type of the file, e.g. text/plain
 *  tmp_name: the path where the uploaded file is stored, e.g. /tmp/php1234
 *  error: the error code associated with this file upload
 *  size: the size of the file in bytes
 */
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

/**
 * Function: wasm_set_query_string
 * ----------------------------
 *  Sets the query string for the next request.
 *  
 *  query_string: the query string, e.g. "name=John&age=30"
 */
void wasm_set_query_string(char* query_string) {
	wasm_server_context->query_string = strdup(query_string);
}

/**
 * Function: wasm_set_path_translated
 * ----------------------------
 *  Sets the filesystem path of the PHP script to run during the next request.
 *  
 *  path_translated: the script path, e.g. "/var/www/myapp/index.php"
 */
void wasm_set_path_translated(char* path_translated) {
	wasm_server_context->path_translated = strdup(path_translated);
}

/**
 * Function: wasm_set_skip_shebang
 * ----------------------------
 */
void wasm_set_skip_shebang(int should_skip_shebang) {
	wasm_server_context->skip_shebang = should_skip_shebang;
}

/**
 * Function: wasm_set_request_uri
 * ----------------------------
 *  Sets the request path (without the query string) for the next request.
 *  
 *  path_translated: the request path, e.g. "/index.php"
 */
void wasm_set_request_uri(char* request_uri) {
	wasm_server_context->request_uri = strdup(request_uri);
}

/**
 * Function: wasm_set_request_method
 * ----------------------------
 *  Sets the request method for the next request.
 *  
 *  request_method: the request method, e.g. "GET" or "POST"
 */
void wasm_set_request_method(char* request_method) {
	wasm_server_context->request_method = strdup(request_method);
}

/**
 * Function: wasm_set_request_host
 * ----------------------------
 *  Sets the request host for the next request.
 *  
 *  request_host: the request host, e.g. "localhost:8080"
 */
void wasm_set_request_host(char* request_host) {
	wasm_server_context->request_host = strdup(request_host);
}

/**
 * Function: wasm_set_content_type
 * ----------------------------
 *  Sets the content type associated with the next request.
 *  
 *  content_type: the content type, e.g. "application/x-www-form-urlencoded"
 */
void wasm_set_content_type(char* content_type) {
	wasm_server_context->content_type = strdup(content_type);
}

/**
 * Function: wasm_set_request_body
 * ----------------------------
 *  Sets the request body for the next request.
 *  
 *  request_body: the request body, e.g. "name=John&age=30"
 */
void wasm_set_request_body(char* request_body) {
	wasm_server_context->request_body = strdup(request_body);
}

/**
 * Function: wasm_set_content_length
 * ----------------------------
 *  Sets the content length associated with the next request.
 *  
 *  content_length: the content length, e.g. 20
 */
void wasm_set_content_length(int content_length) {
	wasm_server_context->content_length = content_length;
}

/**
 * Function: wasm_set_cookies
 * ----------------------------
 *  Sets the cookies associated with the next request.
 *  
 *  cookies: the cookies, e.g. "name=John; age=30"
 */
void wasm_set_cookies(char* cookies) {
	wasm_server_context->cookies = strdup(cookies);
}

/**
 * Function: wasm_set_php_code
 * ----------------------------
 *  Sets the PHP code to run during the next request. If set,
 *  the script at the path specified by wasm_set_path_translated()
 *  will be represented in $_SERVER but will not be executed.
 *  
 *  code: the PHP code, e.g. "echo 'Hello World!';"
 */
void wasm_set_php_code(char* code) {
	wasm_server_context->php_code = strdup(code);
	wasm_server_context->execution_mode = MODE_EVAL_CODE;
}

/**
 * Function: wasm_set_request_port
 * ----------------------------
 *  Sets the request port for the next request.
 *  
 *  port: the request port, e.g. 8080
 */
void wasm_set_request_port(int port) {
	wasm_server_context->request_port = port;
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

/*
 * Function: wasm_sapi_read_cookies
 * ----------------------------
 *   Called by PHP to retrieve the cookies associated with the currently
 *   processed request.
 */
static char *wasm_sapi_read_cookies(TSRMLS_D)
{
	return wasm_server_context->cookies;
}

/**
 * Function: wasm_sapi_read_post_body
 * ----------------------------
 *   Called by PHP to retrieve the request body associated with the currently
 *   processed request.
 * 
 *   buffer: the buffer to read the request body into
 *   count_bytes: the number of bytes to read
 */
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

/**
 * Function: wasm_sapi_module_startup
 * ----------------------------
 *   Called by PHP to initialize the SAPI module.
 * 
 *   sapi_module: the WASM SAPI module struct.
 */
int wasm_sapi_module_startup(sapi_module_struct *sapi_module) {
	// php_module_startup signature changed in:
	// https://github.com/php/php-src/commit/b5db594fd277464104fce814d22f0b2207d6502d
#if PHP_MAJOR_VERSION > 8 || (PHP_MAJOR_VERSION == 8 && PHP_MINOR_VERSION >= 2)
	int startup_result = php_module_startup(sapi_module, NULL);
#else
	int startup_result = php_module_startup(sapi_module, NULL, 0);
#endif
	if (startup_result==FAILURE) {
		return FAILURE;
	}
	return SUCCESS;
}

/**
 * Function: wasm_sapi_register_server_variables
 * ----------------------------
 *   Called by PHP to register the $_SERVER variables.
 * 
 *   track_vars_array: the array where the $_SERVER keys and values are stored.
 */
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
		char *port_str = int_to_string(wasm_server_context->request_port);
		php_register_variable("SERVER_PORT", port_str, track_vars_array TSRMLS_CC);
		free(port_str);
	}

	/* SERVER_NAME */
	value = wasm_server_context->request_host;
	if (value != NULL) {
		php_register_variable("SERVER_NAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("HTTP_HOST", value, track_vars_array TSRMLS_CC);
	}

	/* REQUEST_METHOD */
	value = (char*)SG(request_info).request_method;
	if (value != NULL) {
		php_register_variable("REQUEST_METHOD", value, track_vars_array TSRMLS_CC);
		if (!strcmp(value, "HEAD")) {
			SG(request_info).headers_only = 1;
		} else {
			SG(request_info).headers_only = 0;
		}
	}

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


/**
 * Function: wasm_sapi_request_init
 * ----------------------------
 *   Initializes the PHP request. This is the first step
 *   required to run the PHP code.
 */
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
	SG(request_info).request_method = wasm_server_context->request_method;
	SG(request_info).content_type = wasm_server_context->content_type;
	SG(request_info).content_length = wasm_server_context->content_length;
	SG(request_info).proto_num = 1000; // For HTTP 1.0
	SG(sapi_headers).http_response_code = 200;

	if (php_request_startup(TSRMLS_C)==FAILURE) {
		wasm_sapi_module_shutdown();
		return FAILURE;
	}

#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 4) || PHP_MAJOR_VERSION >= 8
	if(wasm_server_context->skip_shebang == 1) {
		CG(skip_shebang) = 1;
	} else {
		CG(skip_shebang) = 0;
	}
#endif

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

/**
 * Function: wasm_sapi_request_shutdown
 * ----------------------------
 *   Cleans up after the PHP request. This is the last step
 *   required to run the PHP code.
 */
void wasm_sapi_request_shutdown() {
	TSRMLS_FETCH();
	if(SG(rfc1867_uploaded_files) != NULL) {
		phpwasm_destroy_uploaded_files_hash();
	}
	// Destroy the old server context and shutdown the request
	wasm_destroy_server_context();
	php_request_shutdown(NULL);
	SG(server_context) = NULL;
	
	// Let's flush the output buffers. It must happen here because
	// ob_start() buffers are not flushed until the shutdown handler
	// runs.
	fflush(stdout);
	fflush(stderr);

	// Restore the regular stdout and stderr stream handlers
	restore_stream_handler(stdout, stdout_replacement);
	restore_stream_handler(stderr, stderr_replacement);

	// Prepare a fresh request context
	wasm_init_server_context();
}

/**
 * Function: wasm_sapi_handle_request
 * ----------------------------
 *   Runs the PHP code snippet set up with wasm_set_php_code or,
 *   if missing, executes the PHP file set up with wasm_set_path_translated.
 */
int EMSCRIPTEN_KEEPALIVE wasm_sapi_handle_request() {
	int result;
	if (wasm_sapi_request_init() == FAILURE)
	{
		result = -1;
		goto wasm_request_done;
	}

	TSRMLS_FETCH();
	if (wasm_server_context->execution_mode == MODE_EXECUTE_SCRIPT)
	{
		zend_file_handle file_handle;

		file_handle.type = ZEND_HANDLE_FILENAME;
#if PHP_MAJOR_VERSION >= 8
		zend_string *filename = zend_string_init(
			SG(request_info).path_translated,
			strlen(SG(request_info).path_translated),
			1
		);
		file_handle.filename = filename;
#else
		file_handle.filename = SG(request_info).path_translated;
#endif
#if PHP_MAJOR_VERSION < 8
		file_handle.free_filename = 0;
		file_handle.opened_path = NULL;
#endif

		// https://bugs.php.net/bug.php?id=77561
		// https://github.com/php/php-src/commit/c5f1b384b591009310370f0b06b10868d2d62741
		// https://www.mail-archive.com/internals@lists.php.net/msg43642.html
		// http://git.php.net/?p=php-src.git;a=commit;h=896dad4c794f7826812bcfdbaaa9f0b3518d9385
		if (php_fopen_primary_script(&file_handle TSRMLS_CC) == FAILURE) {
			zend_try {
				if (errno == EACCES) {
					SG(sapi_headers).http_response_code = 403;
					PUTS("Access denied.\n");
				} else {
					SG(sapi_headers).http_response_code = 404;
					PUTS("No input file specified.\n");
				}
			} zend_catch {
			} zend_end_try();
			goto wasm_request_done;
		}

		result = php_execute_script(&file_handle TSRMLS_CC);
	}
	else
	{
		result = run_php(wasm_server_context->php_code);
	}
wasm_request_done:
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

/**
 * Function: wasm_sapi_shutdown_wrapper
 * ----------------------------
 *  Cleans up after the WASM SAPI module. Call once you will not want
 *  to execute any more PHP code.
 */
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

/**
 * Function: wasm_sapi_ub_write
 * ----------------------------
 *   Called by PHP to write to stdout.
 * 
 *   str: the string to write.
 *   str_length: the length of the string.
 */
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


#if PHP_MAJOR_VERSION >= 8
static void wasm_sapi_log_message(const char *message TSRMLS_DC, int syslog_type_int)
#else
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 1)
static void wasm_sapi_log_message(char *message TSRMLS_DC, int syslog_type_int)
#else
static void wasm_sapi_log_message(char *message TSRMLS_DC)
#endif
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
	wasm_server_context = malloc(sizeof(wasm_server_context_t));
	wasm_init_server_context();

#ifdef ZTS
	void ***tsrm_ls = NULL;
	tsrm_startup(1, 1, 0, NULL);
	tsrm_ls = ts_resource(0);
	*ptsrm_ls = tsrm_ls;
#endif
	sapi_startup(&php_wasm_sapi_module);
	if(phpini_path_override != NULL) {
		free(php_wasm_sapi_module.php_ini_path_override);
		php_wasm_sapi_module.php_ini_path_override = phpini_path_override;
	}

	if(additional_phpini_entries != NULL) {
		int ini_entries_len = strlen(additional_phpini_entries);
		additional_phpini_entries = realloc(additional_phpini_entries, ini_entries_len + sizeof(WASM_HARDCODED_INI));
		memmove(additional_phpini_entries + sizeof(WASM_HARDCODED_INI) - 2, additional_phpini_entries, ini_entries_len + 1);
		memcpy(additional_phpini_entries, WASM_HARDCODED_INI, sizeof(WASM_HARDCODED_INI) - 2);
		php_wasm_sapi_module.ini_entries = strdup(additional_phpini_entries);
		free(additional_phpini_entries);
	}
	else
	{
		php_wasm_sapi_module.ini_entries = malloc(sizeof(WASM_HARDCODED_INI));
		memcpy(php_wasm_sapi_module.ini_entries, WASM_HARDCODED_INI, sizeof(WASM_HARDCODED_INI));
	}

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

