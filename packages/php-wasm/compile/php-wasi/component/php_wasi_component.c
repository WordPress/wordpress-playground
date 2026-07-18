#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "php/php.h"
#include "SAPI.h"
#include "php_main.h"
#include "php_variables.h"
#include "zend_stream.h"

#include "php.h"

typedef struct {
	char *key;
	size_t key_len;
	char *value;
	size_t value_len;
} request_entry_t;

typedef struct {
	char *request_uri;
	char *query_string;
	char *request_method;
	char *request_host;
	char *path_translated;
	char *content_type;
	char *cookies;
	uint8_t *body;
	size_t content_length;
	uint32_t request_port;
	bool stream_response;
	request_entry_t *server_entries;
	size_t server_entry_count;
	request_entry_t *env;
	size_t env_count;
} request_context_t;

static request_context_t current_request;
static php_list_string_t response_headers;
static size_t response_headers_capacity;
static uint16_t response_http_status;
static bool php_initialized;
static bool cli_invoked;
static bool response_headers_failed;

extern int wordpress_php_wasi_cli_main(int argc, char *argv[]);

static void emit(wordpress_php_wasi_output_channel_t destination,
		const void *bytes, size_t len)
{
	php_list_u8_t output = {
		.ptr = (uint8_t *) bytes,
		.len = len,
	};
	wordpress_php_wasi_output_write(destination, &output);
}

static void clear_response_headers(void)
{
	for (size_t i = 0; i < response_headers.len; i++) {
		php_string_free(&response_headers.ptr[i]);
	}
	free(response_headers.ptr);
	memset(&response_headers, 0, sizeof(response_headers));
	response_headers_capacity = 0;
	response_http_status = 200;
	response_headers_failed = false;
}

static bool response_headers_reserve(void)
{
	if (response_headers.len < response_headers_capacity) {
		return true;
	}
	size_t capacity = response_headers_capacity ? response_headers_capacity * 2 : 8;
	if (capacity < response_headers_capacity ||
		capacity > SIZE_MAX / sizeof(php_string_t)) {
		return false;
	}
	php_string_t *resized = realloc(response_headers.ptr,
		capacity * sizeof(php_string_t));
	if (!resized) {
		return false;
	}
	response_headers.ptr = resized;
	response_headers_capacity = capacity;
	return true;
}

static void free_entries(request_entry_t *entries, size_t count)
{
	for (size_t i = 0; i < count; i++) {
		free(entries[i].key);
		free(entries[i].value);
	}
	free(entries);
}

static void clear_request(void)
{
	free(current_request.request_uri);
	free(current_request.query_string);
	free(current_request.request_method);
	free(current_request.request_host);
	free(current_request.path_translated);
	free(current_request.content_type);
	free(current_request.cookies);
	free_entries(current_request.server_entries,
		current_request.server_entry_count);
	free_entries(current_request.env, current_request.env_count);
	memset(&current_request, 0, sizeof(current_request));
}

static bool copy_string(const php_string_t *source, char **target,
		const char **error)
{
	if ((source->len && !source->ptr) ||
		(source->len && memchr(source->ptr, '\0', source->len))) {
		*error = "request strings must not contain NUL bytes";
		return false;
	}
	if (source->len == SIZE_MAX) {
		*error = "request string is too large";
		return false;
	}
	char *copy = malloc(source->len + 1);
	if (!copy) {
		*error = "out of memory while copying request";
		return false;
	}
	if (source->len) {
		memcpy(copy, source->ptr, source->len);
	}
	copy[source->len] = '\0';
	*target = copy;
	return true;
}

static bool copy_entries(
		const exports_wordpress_php_wasi_handler_list_entry_t *source,
		request_entry_t **target, size_t *target_count, const char **error)
{
	if (!source->len) {
		return true;
	}
	if (!source->ptr || source->len > SIZE_MAX / sizeof(request_entry_t)) {
		*error = "request contains an invalid entry list";
		return false;
	}
	request_entry_t *entries = calloc(source->len, sizeof(request_entry_t));
	if (!entries) {
		*error = "out of memory while copying request entries";
		return false;
	}
	*target = entries;
	*target_count = source->len;
	for (size_t i = 0; i < source->len; i++) {
		const exports_wordpress_php_wasi_handler_entry_t *entry = &source->ptr[i];
		if (!copy_string(&entry->key, &entries[i].key, error) ||
			!copy_string(&entry->value, &entries[i].value, error)) {
			return false;
		}
		entries[i].key_len = entry->key.len;
		entries[i].value_len = entry->value.len;
	}
	return true;
}

static bool prepare_request(
		exports_wordpress_php_wasi_handler_request_t *request,
		const char **error)
{
	clear_request();
	if (request->body.len > ZEND_LONG_MAX ||
		(request->body.len && !request->body.ptr)) {
		*error = "request body is too large or invalid";
		return false;
	}
	if (!copy_string(&request->request_uri, &current_request.request_uri, error) ||
		!copy_string(&request->method, &current_request.request_method, error) ||
		!copy_string(&request->host, &current_request.request_host, error) ||
		!copy_string(&request->script_path, &current_request.path_translated, error)) {
		goto failed;
	}
	const char *query = strchr(current_request.request_uri, '?');
	php_string_t query_string = {
		.ptr = (uint8_t *) (query ? query + 1 : ""),
		.len = query ? strlen(query + 1) : 0,
	};
	if (!copy_string(&query_string, &current_request.query_string, error)) {
		goto failed;
	}
	if (request->content_type.is_some &&
		!copy_string(&request->content_type.val,
			&current_request.content_type, error)) {
		goto failed;
	}
	if (request->cookies.is_some &&
		!copy_string(&request->cookies.val, &current_request.cookies, error)) {
		goto failed;
	}
	if (!copy_entries(&request->server_entries,
			&current_request.server_entries,
			&current_request.server_entry_count, error) ||
		!copy_entries(&request->env, &current_request.env,
			&current_request.env_count, error)) {
		goto failed;
	}
	current_request.body = request->body.ptr;
	current_request.content_length = request->body.len;
	current_request.request_port = request->port;
	current_request.stream_response = request->stream_response;
	return true;

failed:
	clear_request();
	return false;
}

static void register_entries(zval *array, const request_entry_t *entries,
		size_t count)
{
	for (size_t i = 0; i < count; i++) {
		php_register_variable_safe(entries[i].key, entries[i].value,
			entries[i].value_len, array);
	}
}

#if PHP_VERSION_ID < 80000
static char *component_getenv(char *name, size_t name_len)
#else
static char *component_getenv(const char *name, size_t name_len)
#endif
{
	for (size_t i = 0; i < current_request.env_count; i++) {
		request_entry_t *entry = &current_request.env[i];
		if (entry->key_len == name_len && memcmp(entry->key, name, name_len) == 0) {
			return entry->value;
		}
	}
	return NULL;
}

static size_t component_write(const char *str, size_t len)
{
	emit(WORDPRESS_PHP_WASI_OUTPUT_CHANNEL_STDOUT, str, len);
	return len;
}

static void component_flush(void *server_context)
{
	(void) server_context;
	sapi_send_headers();
}

static size_t component_read_post(char *buffer, size_t count)
{
	size_t consumed = (size_t) SG(read_post_bytes);
	if (consumed >= current_request.content_length) {
		return 0;
	}
	size_t remaining = current_request.content_length - consumed;
	if (count > remaining) {
		count = remaining;
	}
	if (count) {
		memcpy(buffer, current_request.body + consumed, count);
	}
	return count;
}

static char *component_read_cookies(void)
{
	return current_request.cookies;
}

static void component_register_variables(zval *array)
{
	php_import_environment_variables(array);
	php_register_variable("REQUEST_URI", current_request.request_uri, array);
	php_register_variable("QUERY_STRING", current_request.query_string, array);
	php_register_variable("REQUEST_METHOD", current_request.request_method, array);
	php_register_variable("HTTP_HOST", current_request.request_host, array);
	php_register_variable("SCRIPT_FILENAME", current_request.path_translated, array);
	php_register_variable("PHP_SELF", current_request.request_uri, array);
	register_entries(array, current_request.server_entries,
		current_request.server_entry_count);
}

static void component_send_header(sapi_header_struct *header, void *server_context)
{
	(void) server_context;
	if (!header || response_headers_failed) {
		return;
	}
	if (!response_headers_reserve()) {
		response_headers_failed = true;
		return;
	}
	php_string_dup_n(&response_headers.ptr[response_headers.len],
		header->header, header->header_len);
	response_headers.len++;
}

static int component_send_headers(sapi_headers_struct *headers)
{
	(void) headers;
	clear_response_headers();
	int status = SG(sapi_headers).http_response_code;
	response_http_status = status > 0 && status <= UINT16_MAX ?
		(uint16_t) status : 500;
	zend_llist_apply_with_argument(&SG(sapi_headers).headers,
		(llist_apply_with_arg_func_t) component_send_header, SG(server_context));
	if (SG(sapi_headers).send_default_content_type) {
		sapi_header_struct default_header;
		sapi_get_default_content_type_header(&default_header);
		component_send_header(&default_header, SG(server_context));
		sapi_free_header(&default_header);
	}
	if (response_headers_failed) {
		return SAPI_HEADER_SEND_FAILED;
	}
	if (current_request.stream_response) {
		wordpress_php_wasi_output_headers(response_http_status, &response_headers);
	}
	return SAPI_HEADER_SENT_SUCCESSFULLY;
}

#if PHP_VERSION_ID < 80000
static void component_log(char *message, int syslog_type)
#else
static void component_log(const char *message, int syslog_type)
#endif
{
	(void) syslog_type;
	emit(WORDPRESS_PHP_WASI_OUTPUT_CHANNEL_STDERR, message, strlen(message));
	emit(WORDPRESS_PHP_WASI_OUTPUT_CHANNEL_STDERR, "\n", 1);
}

static int component_startup(sapi_module_struct *module)
{
#if PHP_VERSION_ID < 80200
	return php_module_startup(module, NULL, 0);
#else
	return php_module_startup(module, NULL);
#endif
}

static int component_shutdown(sapi_module_struct *module)
{
	(void) module;
	php_module_shutdown();
	return SUCCESS;
}

static int component_deactivate(void)
{
	return SUCCESS;
}

static sapi_module_struct component_sapi = {
	"wasi-component",
	"PHP WASI Preview 2 persistent component",
	component_startup,
	component_shutdown,
	NULL,
	component_deactivate,
	component_write,
	component_flush,
	NULL,
	component_getenv,
	php_error,
	NULL,
	component_send_headers,
	component_send_header,
	component_read_post,
	component_read_cookies,
	component_register_variables,
	component_log,
	NULL,
	NULL,
	STANDARD_SAPI_MODULE_PROPERTIES
};

bool exports_wordpress_php_wasi_handler_initialize(php_string_t *php_ini_path,
		php_string_t *err)
{
	if (php_initialized || cli_invoked) {
		php_string_dup(err, "PHP is already initialized in this worker");
		return false;
	}
	char *ini_path = malloc(php_ini_path->len + 1);
	if (!ini_path) {
		php_string_dup(err, "out of memory while copying the php.ini path");
		return false;
	}
	memcpy(ini_path, php_ini_path->ptr, php_ini_path->len);
	ini_path[php_ini_path->len] = '\0';

	sapi_startup(&component_sapi);
	if (php_ini_path->len) {
		component_sapi.php_ini_path_override = ini_path;
	} else {
		component_sapi.php_ini_ignore = 1;
		free(ini_path);
	}
	if (component_sapi.startup(&component_sapi) == FAILURE) {
		php_string_dup(err, "PHP module startup failed");
		return false;
	}
	php_initialized = true;
	return true;
}

static void free_cli_argv(char **argv, size_t argc)
{
	if (!argv) {
		return;
	}
	for (size_t i = 0; i < argc; i++) {
		free(argv[i]);
	}
	free(argv);
}

static bool apply_cli_environment(
		const exports_wordpress_php_wasi_cli_list_entry_t *env,
		const char **error)
{
	if (env->len && !env->ptr) {
		*error = "CLI environment list is invalid";
		return false;
	}
	for (size_t i = 0; i < env->len; i++) {
		char *key = NULL;
		char *value = NULL;
		if (!copy_string(&env->ptr[i].key, &key, error) ||
			!copy_string(&env->ptr[i].value, &value, error)) {
			free(key);
			free(value);
			return false;
		}
		if (!key[0] || strchr(key, '=')) {
			free(key);
			free(value);
			*error = "CLI environment names must be non-empty and must not contain '='";
			return false;
		}
		if (setenv(key, value, 1) != 0) {
			free(key);
			free(value);
			*error = "failed to set a CLI environment variable";
			return false;
		}
		free(key);
		free(value);
	}
	return true;
}

bool exports_wordpress_php_wasi_cli_run(
		exports_wordpress_php_wasi_cli_request_t *request,
		int32_t *ret, php_string_t *err)
{
	if (php_initialized || cli_invoked) {
		php_string_dup(err, "CLI may only run once in a fresh component instance");
		return false;
	}
	cli_invoked = true;
	if (!request->argv.len || !request->argv.ptr ||
		request->argv.len > INT32_MAX) {
		php_string_dup(err, "CLI argv must contain at least one entry");
		return false;
	}

	const char *error = NULL;
	char **argv = calloc(request->argv.len + 1, sizeof(char *));
	if (!argv) {
		php_string_dup(err, "out of memory while copying CLI argv");
		return false;
	}
	for (size_t i = 0; i < request->argv.len; i++) {
		if (!copy_string(&request->argv.ptr[i], &argv[i], &error)) {
			free_cli_argv(argv, request->argv.len);
			php_string_dup(err, error);
			return false;
		}
	}
	if (!apply_cli_environment(&request->env, &error)) {
		free_cli_argv(argv, request->argv.len);
		php_string_dup(err, error);
		return false;
	}
	if (request->cwd.is_some) {
		char *cwd = NULL;
		if (!copy_string(&request->cwd.val, &cwd, &error)) {
			free_cli_argv(argv, request->argv.len);
			php_string_dup(err, error);
			return false;
		}
		if (chdir(cwd) != 0) {
			char message[512];
			snprintf(message, sizeof(message),
				"failed to change CLI working directory to %s: %s",
				cwd, strerror(errno));
			free(cwd);
			free_cli_argv(argv, request->argv.len);
			php_string_dup(err, message);
			return false;
		}
		free(cwd);
	}

	*ret = wordpress_php_wasi_cli_main((int) request->argv.len, argv);
	free_cli_argv(argv, request->argv.len);
	return true;
}

bool exports_wordpress_php_wasi_handler_handle_request(
		exports_wordpress_php_wasi_handler_request_t *request,
		exports_wordpress_php_wasi_handler_response_t *ret, php_string_t *err)
{
	if (!php_initialized) {
		php_string_dup(err, "initialize must be called before handle-request");
		return false;
	}
	clear_response_headers();
	const char *request_error = NULL;
	if (!prepare_request(request, &request_error)) {
		php_string_dup(err, request_error);
		return false;
	}

	/* These values cross Zend's setjmp/longjmp bailout boundary. C leaves
	 * non-volatile locals modified after setjmp indeterminate after longjmp. */
	volatile bool request_started = false;
	volatile bool bailed_out = false;
	volatile int exit_status = 0;

	zend_first_try {
		SG(options) |= SAPI_OPTION_NO_CHDIR;
		SG(server_context) = &current_request;
		SG(request_info).query_string = current_request.query_string;
		SG(request_info).path_translated = current_request.path_translated;
		SG(request_info).request_uri = current_request.request_uri;
		SG(request_info).request_method = current_request.request_method;
		SG(request_info).content_type = current_request.content_type;
		SG(request_info).content_length = current_request.content_length;
		SG(request_info).proto_num = 1001;
		SG(sapi_headers).http_response_code = 200;

		if (php_request_startup() == FAILURE) {
			exit_status = 255;
		} else {
			request_started = true;
			EG(exit_status) = 0;
			zend_file_handle file_handle;
			zend_stream_init_filename(&file_handle, current_request.path_translated);
			if (php_fopen_primary_script(&file_handle) == FAILURE) {
				SG(sapi_headers).http_response_code = errno == EACCES ? 403 : 404;
				component_write(errno == EACCES ? "Access denied.\n" :
					"No input file specified.\n",
					errno == EACCES ? sizeof("Access denied.\n") - 1 :
						sizeof("No input file specified.\n") - 1);
			} else {
				php_execute_script(&file_handle);
			}
			exit_status = EG(exit_status);
		}
	} zend_catch {
		bailed_out = true;
		exit_status = 255;
	} zend_end_try();

	if (request_started) {
		/* php_request_shutdown() first runs user shutdown callbacks and then
		 * deactivates the output layer, which sends even header-only responses.
		 * Sending here would commit the response before callbacks (including
		 * phpMyAdmin's renderer) have had their standard opportunity to add
		 * headers. */
		zend_first_try {
			php_request_shutdown(NULL);
		} zend_catch {
			bailed_out = true;
			exit_status = 255;
		} zend_end_try();
	}
	SG(server_context) = NULL;
	clear_request();
	ret->exit_status = exit_status;
	ret->http_status = response_http_status;
	ret->headers = response_headers;
	memset(&response_headers, 0, sizeof(response_headers));
	response_headers_capacity = 0;
	if (bailed_out) {
		/* A PHP fatal error is a completed request, not a component trap. */
		return true;
	}
	return true;
}
