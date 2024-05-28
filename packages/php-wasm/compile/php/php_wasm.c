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
#include <main/php_streams.h>
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
#include "proc_open.h"
#include "dns_polyfill.h"

unsigned int wasm_sleep(unsigned int time)
{
	emscripten_sleep(time * 1000); // emscripten_sleep takes time in milliseconds
	return time;
}

extern int *wasm_setsockopt(int sockfd, int level, int optname, intptr_t optval, size_t optlen, int dummy);
extern char *js_popen_to_file(const char *cmd, const char *mode, uint8_t *exit_code_ptr);
extern int __wasi_syscall_ret(__wasi_errno_t code);
extern __wasi_errno_t js_fd_read(
	__wasi_fd_t fd,
	const __wasi_iovec_t *iovs,
	size_t iovs_len,
	__wasi_size_t *nread);

// Exit code of the last exited child process call.
int wasm_pclose_ret = -1;

/**
 * Passes a message to the JavaScript module and writes the response
 * data, if any, to the response_buffer pointer.
 *
 * @param message The message to pass into JavaScript.
 * @param response_buffer The address where the response will be stored. The
 * JS module will allocate a memory block for the response buffer and write
 * its address to **response_buffer. The caller is responsible for freeing
 * that memory after use.
 *
 * @return The size of the response_buffer (it can contain null bytes).
 *
 * @note The caller should ensure that the memory allocated for response_buffer
 * is freed after its use to prevent memory leaks. It's also recommended
 * to handle exceptions and errors gracefully within the function to ensure
 * the stability of the system.
 */
extern size_t js_module_onMessage(const char *data, char **response_buffer);

// popen() shim
// -----------------------------------------------------------
// We have a custom popen handler because the original one calls
// fork() which emscripten does not support.
//
// This wasm_popen function is called by PHP_FUNCTION(popen) thanks
// to a patch applied in the Dockerfile.
//
// The `js_popen_to_file` is defined in phpwasm-emscripten-library.js.
// It runs the `cmd` command and returns the path to a file that contains the
// output. The exit code is assigned to the exit_code_ptr.

EMSCRIPTEN_KEEPALIVE FILE *wasm_popen(const char *cmd, const char *mode)
{
	FILE *fp;
	if (*mode == 'r')
	{
		uint8_t last_exit_code;
		char *file_path = js_popen_to_file(cmd, mode, &last_exit_code);
		fp = fopen(file_path, mode);
		FG(pclose_ret) = last_exit_code;
		wasm_pclose_ret = last_exit_code;
	}
	else if (*mode == 'w')
	{
		int current_procopen_call_id = ++procopen_call_id;
		char *device_path = js_create_input_device(current_procopen_call_id);
		int stdin_childend = current_procopen_call_id;
		fp = fopen(device_path, mode);

		php_file_descriptor_t stdout_pipe[2];
		php_file_descriptor_t stderr_pipe[2];
		if (0 != pipe(stdout_pipe) || 0 != pipe(stderr_pipe))
		{
			php_error_docref(NULL, E_WARNING, "unable to create pipe %s", strerror(errno));
			errno = EINVAL;
			return 0;
		}

		int *stdin = safe_emalloc(sizeof(int), 3, 0);
		int *stdout = safe_emalloc(sizeof(int), 3, 0);
		int *stderr = safe_emalloc(sizeof(int), 3, 0);

		stdin[0] = 0;
		stdin[1] = stdin_childend;
		stdin[2] = (int) NULL;

		stdout[0] = 1;
		stdout[1] = stdout_pipe[0];
		stdout[2] = stdout_pipe[1];

		stderr[0] = 2;
		stderr[1] = stderr_pipe[0];
		stderr[2] = stderr_pipe[1];

		int **descv = safe_emalloc(sizeof(int *), 3, 0);

		descv[0] = stdin;
		descv[1] = stdout;
		descv[2] = stderr;


		// the wasm way {{{
		js_open_process(
			cmd,
			NULL,
			0,
			descv,
			3,
			"",
			0,
			0,
			0
		);
		// }}}

		efree(stdin);
		efree(stdout);
		efree(stderr);

		efree(descv);
	}
	else
	{
		printf("wasm_popen: mode '%s' not supported (cmd: %s)! \n", mode, cmd);
		errno = EINVAL;
		return 0;
	}

	return fp;
}

/**
 * Ship php_exec, the function powering the following PHP
 * functions:
 * * exec()
 * * passthru()
 * * system()
 * * shell_exec()
 *
 * The wasm_php_exec function is called thanks
 * to -Dphp_exec=wasm_php_exec in the Dockerfile and also a
 * small patch that removes php_exec and marks wasm_php_exec()
 * as external.
 *
 * {{{
 */

// These utility functions are copied from php-src/ext/standard/exec.c
static size_t strip_trailing_whitespace(char *buf, size_t bufl)
{
	size_t l = bufl;
	while (l-- > 0 && isspace(((unsigned char *)buf)[l]))
		;
	if (l != (bufl - 1))
	{
		bufl = l + 1;
		buf[bufl] = '\0';
	}
	return bufl;
}

static size_t handle_line(int type, zval *array, char *buf, size_t bufl)
{
	if (type == 1)
	{
		PHPWRITE(buf, bufl);
		if (php_output_get_level() < 1)
		{
			sapi_flush();
		}
	}
	else if (type == 2)
	{
		bufl = strip_trailing_whitespace(buf, bufl);
		add_next_index_stringl(array, buf, bufl);
	}
	return bufl;
}

/**
 * Shims read(2) functionallity.
 * Enables reading from blocking pipes. By default, Emscripten
 * will throw an EWOULDBLOCK error when trying to read from a
 * blocking pipe. This function overrides that behavior and
 * instead waits for the pipe to become readable.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/951
 * @see https://github.com/emscripten-core/emscripten/issues/13214
 */
EMSCRIPTEN_KEEPALIVE ssize_t wasm_read(int fd, void *buf, size_t count)
{
	struct __wasi_iovec_t iov = {
		.buf = buf,
		.buf_len = count};
	size_t num;
	if (__wasi_syscall_ret(js_fd_read(fd, &iov, 1, &num)))
	{
		return -1;
	}
	return num;
}

/*
 * If type==0, only last line of output is returned (exec)
 * If type==1, all lines will be printed and last lined returned (system)
 * If type==2, all lines will be saved to given array (exec with &$array)
 * If type==3, output will be printed binary, no lines will be saved or returned (passthru)
 */
EMSCRIPTEN_KEEPALIVE int wasm_php_exec(int type, const char *cmd, zval *array, zval *return_value)
{
	FILE *fp;
	char *buf;
	int pclose_return;
	char *b, *d = NULL;
	php_stream *stream;
	size_t buflen, bufl = 0;
#if PHP_SIGCHILD
	void (*sig_handler)() = NULL;
#endif

#if PHP_SIGCHILD
	sig_handler = signal(SIGCHLD, SIG_DFL);
#endif

	// Reuse the process-opening logic
	fp = wasm_popen(cmd, "r");
	if (!fp)
	{
		php_error_docref(NULL, E_WARNING, "Unable to fork [%s]", cmd);
		goto err;
	}

	stream = php_stream_fopen_from_pipe(fp, "rb");

	buf = (char *)emalloc(EXEC_INPUT_BUF);
	buflen = EXEC_INPUT_BUF;

	if (type != 3)
	{
		b = buf;

		while (php_stream_get_line(stream, b, EXEC_INPUT_BUF, &bufl))
		{
			/* no new line found, let's read some more */
			if (b[bufl - 1] != '\n' && !php_stream_eof(stream))
			{
				if (buflen < (bufl + (b - buf) + EXEC_INPUT_BUF))
				{
					bufl += b - buf;
					buflen = bufl + EXEC_INPUT_BUF;
					buf = erealloc(buf, buflen);
					b = buf + bufl;
				}
				else
				{
					b += bufl;
				}
				continue;
			}
			else if (b != buf)
			{
				bufl += b - buf;
			}

			bufl = handle_line(type, array, buf, bufl);
			b = buf;
		}
		if (bufl)
		{
			if (buf != b)
			{
				/* Process remaining output */
				bufl = handle_line(type, array, buf, bufl);
			}

			/* Return last line from the shell command */
			bufl = strip_trailing_whitespace(buf, bufl);
			RETVAL_STRINGL(buf, bufl);
		}
		else
		{ /* should return NULL, but for BC we return "" */
			RETVAL_EMPTY_STRING();
		}
	}
	else
	{
		ssize_t read;
		while ((read = php_stream_read(stream, buf, EXEC_INPUT_BUF)) > 0)
		{
			PHPWRITE(buf, read);
		}
	}

	pclose_return = php_stream_close(stream);
	if (pclose_return == -1)
	{
		pclose_return = wasm_pclose_ret;
	}
	efree(buf);

done:
#if PHP_SIGCHILD
	if (sig_handler)
	{
		signal(SIGCHLD, sig_handler);
	}
#endif
	if (d)
	{
		efree(d);
	}
	return pclose_return;
err:
	pclose_return = -1;
	RETVAL_FALSE;
	goto done;
}

// }}}

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

	if (n > 0)
	{
		return p.revents;
	}

	return n;
}

ZEND_BEGIN_ARG_INFO_EX(arginfo_post_message_to_js, 0, 1, 1)
ZEND_ARG_INFO(0, data)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO(arginfo_dl, 0)
ZEND_ARG_INFO(0, extension_filename)
ZEND_END_ARG_INFO()



/* Enable PHP to exchange messages with JavaScript */
PHP_FUNCTION(post_message_to_js)
{
	char *data;
	int data_len;

	if (zend_parse_parameters(ZEND_NUM_ARGS(), "s", &data, &data_len) == FAILURE)
	{
		return;
	}

	char *response;
	size_t response_len = js_module_onMessage(data, &response);
	if (response_len != -1)
	{
		zend_string *return_string = zend_string_init(response, response_len, 0);
		free(response);
		RETURN_NEW_STR(return_string);
	}
	else
	{
		RETURN_NULL();
	}
}

/**
 * select(2).
 */
EMSCRIPTEN_KEEPALIVE int __wrap_select(int max_fd, fd_set *read_fds, fd_set *write_fds, fd_set *except_fds, struct timeval *timeouttv)
{
	emscripten_sleep(0); // always yield to JS event loop
	int timeoutms = php_tvtoto(timeouttv);
	int n = 0;
	for (int i = 0; i < max_fd; i++)
	{
		if (FD_ISSET(i, read_fds))
		{
			n += wasm_poll_socket(i, POLLIN | POLLOUT, timeoutms);
		}
		if (FD_ISSET(i, write_fds))
		{
			n += wasm_poll_socket(i, POLLOUT, timeoutms);
		}
		if (FD_ISSET(i, except_fds))
		{
			n += wasm_poll_socket(i, POLLERR, timeoutms);
			FD_CLR(i, except_fds);
		}
	}
	return n;
}

#if WITH_CLI_SAPI == 1
#include "sapi/cli/php_cli_process_title.h"
#if PHP_MAJOR_VERSION >= 8
#include "sapi/cli/php_cli_process_title_arginfo.h"
#endif

extern int wasm_shutdown(int sockfd, int how);
extern int wasm_close(int sockfd);


static const zend_function_entry additional_functions[] = {
	ZEND_FE(dl, arginfo_dl)
	ZEND_FE(dns_get_mx, arginfo_dns_get_mx)
	ZEND_FALIAS(getmxrr, dns_get_mx, arginfo_getmxrr)
	ZEND_FALIAS(checkdnsrr, dns_check_record, arginfo_checkdnsrr)
	ZEND_FE(dns_check_record, arginfo_dns_check_record)
	ZEND_FE(dns_get_record, arginfo_dns_get_record)
	PHP_FE(cli_set_process_title, arginfo_cli_set_process_title)
	PHP_FE(cli_get_process_title, arginfo_cli_get_process_title)
	PHP_FE(post_message_to_js, arginfo_post_message_to_js){NULL, NULL, NULL}
};

typedef struct wasm_cli_arg
{
	char *value;
	struct wasm_cli_arg *next;
} wasm_cli_arg_t;

int cli_argc = 0;
wasm_cli_arg_t *cli_argv;
void wasm_add_cli_arg(char *arg)
{
	++cli_argc;
	wasm_cli_arg_t *ll_entry = (wasm_cli_arg_t *)malloc(sizeof(wasm_cli_arg_t));
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
int run_cli()
{
	// Convert the argv linkedlist to an array:
	char **cli_argv_array = malloc(sizeof(char *) * (cli_argc));
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
	ZEND_FE(dns_get_mx, arginfo_dns_get_mx)
	ZEND_FALIAS(getmxrr, dns_get_mx, arginfo_getmxrr)
	ZEND_FALIAS(checkdnsrr, dns_check_record, arginfo_checkdnsrr)
	ZEND_FE(dns_check_record, arginfo_dns_check_record)
	ZEND_FE(dns_get_record, arginfo_dns_get_record)
	PHP_FE(post_message_to_js, arginfo_post_message_to_js){NULL, NULL, NULL}
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

typedef struct wasm_array_entry
{
	char *key;
	char *value;
	struct wasm_array_entry *next;
} wasm_array_entry_t;

typedef struct wasm_uploaded_file
{
	char *key,
		*name,
		*type,
		*tmp_name;
	int error, size;
	struct wasm_uploaded_file *next;
} wasm_uploaded_file_t;

typedef struct
{
	char *document_root,
		*query_string,
		*path_translated,
		*request_uri,
		*request_method,
		*request_host,
		*content_type,
		*request_body,
		*cookies;

	struct wasm_array_entry *server_array_entries;
	struct wasm_array_entry *env_array_entries;

	int content_length,
		request_port,
		skip_shebang;
} wasm_server_context_t;

static wasm_server_context_t *wasm_server_context;

int wasm_sapi_module_startup(sapi_module_struct *sapi_module);
int wasm_sapi_shutdown_wrapper(sapi_module_struct *sapi_globals);
void wasm_sapi_module_shutdown();
static int wasm_sapi_deactivate(TSRMLS_D);
static size_t wasm_sapi_ub_write(const char *str, size_t str_length TSRMLS_DC);
static size_t wasm_sapi_read_post_body(char *buffer, size_t count_bytes);
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


#if (PHP_MAJOR_VERSION >= 8)
static char *wasm_sapi_getenv(const char *name, size_t name_len)
#else
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 4)
static char *wasm_sapi_getenv(char *name, size_t name_len)
#else
static char *wasm_sapi_getenv(char *name, unsigned long name_len)
#endif
#endif
{
	wasm_array_entry_t *current_entry = wasm_server_context->env_array_entries;
	while (current_entry != NULL)
	{
		if (strncmp(current_entry->key, name, name_len) == 0)
		{
			return current_entry->value;
		}
		current_entry = current_entry->next;
	}
	return NULL;
}


SAPI_API sapi_module_struct php_wasm_sapi_module = {
	"wasm",			 /* name */
	"PHP WASM SAPI", /* pretty name */

	wasm_sapi_module_startup,	/* startup */
	wasm_sapi_shutdown_wrapper, /* shutdown */

	NULL,				  /* activate */
	wasm_sapi_deactivate, /* deactivate */

	wasm_sapi_ub_write, /* unbuffered write */
	wasm_sapi_flush,	/* flush */
	NULL,				/* get uid */
	wasm_sapi_getenv,	/* getenv */

	php_error, /* error handler */

	NULL,					/* header handler */
	wasm_sapi_send_headers, /* send headers handler */
	wasm_sapi_send_header,	/* send header handler */

	wasm_sapi_read_post_body, /* read POST data */
	wasm_sapi_read_cookies,	  /* read Cookies */

	wasm_sapi_register_server_variables, /* register server variables */

	wasm_sapi_log_message, /* Log message */
	NULL,				   /* Get request time */
	NULL,				   /* Child terminate */

	STANDARD_SAPI_MODULE_PROPERTIES};

int php_sapi_started = 0;
int wasm_set_sapi_name(char *name)
{
	if(php_sapi_started == 1) {
		return 1;
	}
	php_wasm_sapi_module.name = strdup(name);
	return 0;
}

char *phpini_path_override = NULL;
void wasm_set_phpini_path(char *path)
{
	free(phpini_path_override);
	phpini_path_override = strdup(path);
}


void wasm_init_server_context()
{
	wasm_server_context->document_root = NULL;
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
	wasm_server_context->skip_shebang = 0;
	wasm_server_context->server_array_entries = NULL;
	wasm_server_context->env_array_entries = NULL;
}

void wasm_destroy_server_context()
{
	if (wasm_server_context->document_root != NULL)
	{
		free(wasm_server_context->document_root);
	}
	if (wasm_server_context->query_string != NULL)
	{
		free(wasm_server_context->query_string);
	}
	if (wasm_server_context->path_translated != NULL)
	{
		free(wasm_server_context->path_translated);
	}
	if (wasm_server_context->request_uri != NULL)
	{
		free(wasm_server_context->request_uri);
	}
	if (wasm_server_context->request_method != NULL)
	{
		free(wasm_server_context->request_method);
	}
	if (wasm_server_context->request_host != NULL)
	{
		free(wasm_server_context->request_host);
	}
	if (wasm_server_context->content_type != NULL)
	{
		free(wasm_server_context->content_type);
	}
	if (wasm_server_context->cookies != NULL)
	{
		free(wasm_server_context->cookies);
	}

	// Free wasm_server_context->server_array_entries
	wasm_array_entry_t *current_entry = wasm_server_context->server_array_entries;
	while (current_entry != NULL)
	{
		wasm_array_entry_t *next_entry = current_entry->next;
		free(current_entry->key);
		free(current_entry->value);
		free(current_entry);
		current_entry = next_entry;
	}

	// Free wasm_server_context->env_array_entries
	wasm_array_entry_t *current_env_entry = wasm_server_context->env_array_entries;
	while (current_env_entry != NULL)
	{
		wasm_array_entry_t *next_entry = current_env_entry->next;
		free(current_env_entry->key);
		free(current_env_entry->value);
		free(current_env_entry);
		current_env_entry = next_entry;
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
void wasm_add_SERVER_entry(char *key, char *value)
{
	wasm_array_entry_t *entry = (wasm_array_entry_t *)malloc(sizeof(wasm_array_entry_t));
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->server_array_entries;
	wasm_server_context->server_array_entries = entry;

	/**
	 * Keep track of the document root separately so it can be reused
	 * later to compute PHP_SELF.
	 */
	if (strcmp(key, "DOCUMENT_ROOT") == 0)
	{
		wasm_server_context->document_root = strdup(value);
	}
}

/**
 * Function: wasm_add_ENV_entry
 * ----------------------------
 *   Exposes a new entry to the getenv() function.
 *
 *   key: the key of the entry
 *   value: the value of the entry
 */
void wasm_add_ENV_entry(char *key, char *value)
{
	wasm_array_entry_t *entry = (wasm_array_entry_t *)malloc(sizeof(wasm_array_entry_t));
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->env_array_entries;
	wasm_server_context->env_array_entries = entry;
}

/**
 * Function: wasm_set_query_string
 * ----------------------------
 *  Sets the query string for the next request.
 *
 *  query_string: the query string, e.g. "name=John&age=30"
 */
void wasm_set_query_string(char *query_string)
{
	wasm_server_context->query_string = strdup(query_string);
}

/**
 * Function: wasm_set_path_translated
 * ----------------------------
 *  Sets the filesystem path of the PHP script to run during the next request.
 *
 *  path_translated: the script path, e.g. "/var/www/myapp/index.php"
 */
void wasm_set_path_translated(char *path_translated)
{
	wasm_server_context->path_translated = strdup(path_translated);
}

/**
 * Function: wasm_set_skip_shebang
 * ----------------------------
 */
void wasm_set_skip_shebang(int should_skip_shebang)
{
	wasm_server_context->skip_shebang = should_skip_shebang;
}

/**
 * Function: wasm_set_request_uri
 * ----------------------------
 *  Sets the request path (without the query string) for the next request.
 *
 *  path_translated: the request path, e.g. "/index.php"
 */
void wasm_set_request_uri(char *request_uri)
{
	wasm_server_context->request_uri = strdup(request_uri);
}

/**
 * Function: wasm_set_request_method
 * ----------------------------
 *  Sets the request method for the next request.
 *
 *  request_method: the request method, e.g. "GET" or "POST"
 */
void wasm_set_request_method(char *request_method)
{
	wasm_server_context->request_method = strdup(request_method);
}

/**
 * Function: wasm_set_request_host
 * ----------------------------
 *  Sets the request host for the next request.
 *
 *  request_host: the request host, e.g. "localhost:8080"
 */
void wasm_set_request_host(char *request_host)
{
	wasm_server_context->request_host = strdup(request_host);
}

/**
 * Function: wasm_set_content_type
 * ----------------------------
 *  Sets the content type associated with the next request.
 *
 *  content_type: the content type, e.g. "application/x-www-form-urlencoded"
 */
void wasm_set_content_type(char *content_type)
{
	wasm_server_context->content_type = strdup(content_type);
}

/**
 * Function: wasm_set_request_body
 * ----------------------------
 *  Sets the request body for the next request.
 *
 *  request_body: the Heap pointer to the request body, e.g. "name=John&age=30"
 */
void wasm_set_request_body(char *request_body)
{
	wasm_server_context->request_body = request_body;
}

/**
 * Function: wasm_set_content_length
 * ----------------------------
 *  Sets the content length associated with the next request.
 *
 *  content_length: the content length, e.g. 20
 */
void wasm_set_content_length(int content_length)
{
	wasm_server_context->content_length = content_length;
}

/**
 * Function: wasm_set_cookies
 * ----------------------------
 *  Sets the cookies associated with the next request.
 *
 *  cookies: the cookies, e.g. "name=John; age=30"
 */
void wasm_set_cookies(char *cookies)
{
	wasm_server_context->cookies = strdup(cookies);
}

/**
 * Function: wasm_set_request_port
 * ----------------------------
 *  Sets the request port for the next request.
 *
 *  port: the request port, e.g. 8080
 */
void wasm_set_request_port(int port)
{
	wasm_server_context->request_port = port;
}

/*
 * Function: redirect_stream_to_file
 * ----------------------------
 *   Redirects writes from a given stream to a file with a specified path.
 *   Think of it as a the ">" operator in "echo foo > bar.txt" bash command.
 *
 *   This is useful to pass streams of bytes containing null bytes to JavaScript
 *   handlers. You can't do that via stdout and stderr because Emscripten truncates
 *   null bytes from these streams.
 *
 *   stream: The stream to redirect, e.g. stdout or stderr.
 *
 *   path: The path to the file to redirect to, e.g. "/internal/stdout".
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
static size_t wasm_sapi_read_post_body(char *buffer, size_t count_bytes)
{
	if (wasm_server_context == NULL || wasm_server_context->request_body == NULL)
	{
		return 0;
	}

	count_bytes = MIN(count_bytes, SG(request_info).content_length - SG(read_post_bytes));
	if (count_bytes > 0)
	{
		memcpy(buffer, wasm_server_context->request_body + SG(read_post_bytes), count_bytes);
	}
	return count_bytes;
}

// === FILE UPLOADS SUPPORT ===

/**
 * Function: wasm_sapi_module_startup
 * ----------------------------
 *   Called by PHP to initialize the SAPI module.
 *
 *   sapi_module: the WASM SAPI module struct.
 */
int wasm_sapi_module_startup(sapi_module_struct *sapi_module)
{
	// php_module_startup signature changed in:
	// https://github.com/php/php-src/commit/b5db594fd277464104fce814d22f0b2207d6502d
#if PHP_MAJOR_VERSION > 8 || (PHP_MAJOR_VERSION == 8 && PHP_MINOR_VERSION >= 2)
	int startup_result = php_module_startup(sapi_module, NULL);
#else
	int startup_result = php_module_startup(sapi_module, NULL, 0);
#endif
	if (startup_result == FAILURE)
	{
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
	if (value != NULL)
	{
		php_register_variable("REQUEST_URI", value, track_vars_array TSRMLS_CC);
	}

	int php_self_set = 0;
	if (wasm_server_context->document_root != NULL && wasm_server_context->path_translated != NULL)
	{
		// Confirm path translated starts with the document root
		/**
		 * PHP_SELF is the script path relative to the document root.
		 *
		 * For example:
		 *
		 * If the document root is /var/www/html and the requested path is /dir/index.php,
		 * PHP_SELF will be /dir/index.php.
		 *
		 * If the document root is /var/www/html and the requested path /nice/urls is
		 * served from /var/www/html/another/directory/script.php, PHP_SELF will be
		 * /another/directory/script.php
		 *
		 * @see https://www.php.net/manual/en/reserved.variables.server.php#:~:text=PHP_SELF
		 */
		if (strncmp(wasm_server_context->document_root, wasm_server_context->path_translated, strlen(wasm_server_context->document_root)) == 0)
		{
			// Substring of path translated starting after document root
			char *script_name = wasm_server_context->path_translated + strlen(wasm_server_context->document_root);
			char *script_filename = wasm_server_context->path_translated;
			char *php_self = wasm_server_context->path_translated + strlen(wasm_server_context->document_root);
			php_register_variable("SCRIPT_NAME", estrdup(script_name), track_vars_array TSRMLS_CC);
			php_register_variable("SCRIPT_FILENAME", estrdup(script_filename), track_vars_array TSRMLS_CC);
			php_register_variable("PHP_SELF", estrdup(php_self), track_vars_array TSRMLS_CC);
			php_self_set = 1;
		}
	}

	if (php_self_set == 0 && value != NULL)
	{
		// Default to REQUEST_URI
		php_register_variable("SCRIPT_NAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("SCRIPT_FILENAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("PHP_SELF", value, track_vars_array TSRMLS_CC);
	}

	/* argv */
	value = SG(request_info).query_string;
	if (value != NULL)
		php_register_variable("argv", value, track_vars_array TSRMLS_CC);

	/* SERVER_SOFTWARE */
	php_register_variable("SERVER_SOFTWARE", "PHP.wasm", track_vars_array TSRMLS_CC);

	/* SERVER_PROTOCOL */
	if (SG(request_info).proto_num != -1)
	{
		char *port_str = int_to_string(wasm_server_context->request_port);
		php_register_variable("SERVER_PORT", port_str, track_vars_array TSRMLS_CC);
		free(port_str);
	}

	/* SERVER_NAME */
	value = wasm_server_context->request_host;
	if (value != NULL)
	{
		php_register_variable("SERVER_NAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("HTTP_HOST", value, track_vars_array TSRMLS_CC);
	}

	/* REQUEST_METHOD */
	value = (char *)SG(request_info).request_method;
	if (value != NULL)
	{
		php_register_variable("REQUEST_METHOD", value, track_vars_array TSRMLS_CC);
		if (!strcmp(value, "HEAD"))
		{
			SG(request_info).headers_only = 1;
		}
		else
		{
			SG(request_info).headers_only = 0;
		}
	}

	/* QUERY_STRING */
	value = SG(request_info).query_string;
	if (value != NULL)
		php_register_variable("QUERY_STRING", value, track_vars_array TSRMLS_CC);

	// Register entries from wasm_server_context->server_array_entries linked list
	wasm_array_entry_t *entry = wasm_server_context->server_array_entries;
	while (entry != NULL)
	{
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
	// We'll use the /internal directory instead of /tmp, because a child process sharing
	// the same filesystem and /tmp mount would write to the same stdout and stderr files
	// and produce unreadable output intertwined with the parent process output. The /internal
	// directory should always stay in per-process MEMFS space and never be shared with
	// any other process.
	stdout_replacement = redirect_stream_to_file(stdout, "/internal/stdout");
	stderr_replacement = redirect_stream_to_file(stderr, "/internal/stderr");
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

	if (php_request_startup(TSRMLS_C) == FAILURE)
	{
		wasm_sapi_module_shutdown();
		return FAILURE;
	}

#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 4) || PHP_MAJOR_VERSION >= 8
	if (wasm_server_context->skip_shebang == 1)
	{
		CG(skip_shebang) = 1;
	}
	else
	{
		CG(skip_shebang) = 0;
	}
#endif

	php_register_variable("PHP_SELF", "-", NULL TSRMLS_CC);
	return SUCCESS;
}

/**
 * Function: wasm_sapi_request_shutdown
 * ----------------------------
 *   Cleans up after the PHP request. This is the last step
 *   required to run the PHP code.
 */
void wasm_sapi_request_shutdown()
{
	TSRMLS_FETCH();
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
 *   Executes the PHP file set up with wasm_set_path_translated.
 */
int EMSCRIPTEN_KEEPALIVE wasm_sapi_handle_request()
{
	int result;
	if (wasm_sapi_request_init() == FAILURE)
	{
		result = -1;
		goto wasm_request_done;
	}

	EG(exit_status) = 0;

	TSRMLS_FETCH();
	zend_file_handle file_handle;

	file_handle.type = ZEND_HANDLE_FILENAME;
#if PHP_MAJOR_VERSION >= 8
	zend_string *filename = zend_string_init(
		SG(request_info).path_translated,
		strlen(SG(request_info).path_translated),
		1);
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
	if (php_fopen_primary_script(&file_handle TSRMLS_CC) == FAILURE)
	{
		zend_try
		{
			if (errno == EACCES)
			{
				SG(sapi_headers).http_response_code = 403;
				PUTS("Access denied.\n");
			}
			else
			{
				SG(sapi_headers).http_response_code = 404;
				PUTS("No input file specified.\n");
			}
		}
		zend_catch
		{
		}
		zend_end_try();
		goto wasm_request_done;
	}

	php_execute_script(&file_handle TSRMLS_CC);

	result = EG(exit_status);
wasm_request_done:
	wasm_sapi_request_shutdown();
	return result;
}

void wasm_sapi_module_shutdown()
{
	php_module_shutdown(TSRMLS_C);
	sapi_shutdown();
#ifdef ZTS
	tsrm_shutdown();
#endif
	if (php_wasm_sapi_module.ini_entries)
	{
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
	if (ret <= 0)
		return 0;
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
static size_t wasm_sapi_ub_write(const char *str, size_t str_length TSRMLS_DC)
{
	const char *ptr = str;
	uint remaining = str_length;
	size_t ret;

	while (remaining > 0)
	{
		ret = wasm_sapi_single_write(ptr, remaining);
		if (!ret)
		{
			php_handle_aborted_connection();
		}
		ptr += ret;
		remaining -= ret;
	}

	return str_length;
}

static void wasm_sapi_flush(void *server_context)
{
	if (fflush(stdout) == EOF)
	{
		php_handle_aborted_connection();
	}
	sapi_send_headers(TSRMLS_C);
}

static int _fwrite(FILE *file, char *str)
{
	return fwrite(str, sizeof(char), strlen(str), file);
}

static char *int_to_string(int i)
{
	int length = snprintf(NULL, 0, "%d", i);
	char *port_str = malloc(length + 1);
	snprintf(port_str, length + 1, "%d", i);
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
	headers_file = fopen("/internal/headers.json", "w");
	if (headers_file == NULL)
	{
		return FAILURE;
	}

	_fwrite(headers_file, "{ \"status\": ");
	char *response_code = int_to_string(SG(sapi_headers).http_response_code);
	_fwrite(headers_file, response_code);
	free(response_code);
	_fwrite(headers_file, ", \"headers\": [");

	zend_llist_apply_with_argument(&SG(sapi_headers).headers, (llist_apply_with_arg_func_t)sapi_module.send_header, SG(server_context) TSRMLS_CC);
	if (SG(sapi_headers).send_default_content_type)
	{
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
static void wasm_sapi_send_header(sapi_header_struct *sapi_header, void *server_context TSRMLS_DC)
{
	if (sapi_header == NULL)
	{
		fseek(headers_file, ftell(headers_file) - 2, SEEK_SET);
		fwrite(&"  ", sizeof(char), 2, headers_file);
		return;
	}
	_fwrite(headers_file, "\"");
	for (int i = 0, max = sapi_header->header_len; i < max; i++)
	{
		if (sapi_header->header[i] == '"' || sapi_header->header[i] == '\\')
		{
			fwrite(&"\\", sizeof(char), 1, headers_file);
		}

		fwrite(&sapi_header->header[i], sizeof(char), 1, headers_file);
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
	fprintf(stderr, "%s\n", message);
}

/*
 * Function: php_wasm_init
 * ----------------------------
 *   Initiates the PHP wasm SAPI. Call this before calling any
 *   other function.
 */
int php_wasm_init()
{
	wasm_server_context = malloc(sizeof(wasm_server_context_t));
	wasm_init_server_context();

#ifdef ZTS
	void ***tsrm_ls = NULL;
	tsrm_startup(1, 1, 0, NULL);
	tsrm_ls = ts_resource(0);
	*ptsrm_ls = tsrm_ls;
#endif
	sapi_startup(&php_wasm_sapi_module);
	if (phpini_path_override != NULL)
	{
		free(php_wasm_sapi_module.php_ini_path_override);
		php_wasm_sapi_module.php_ini_path_override = phpini_path_override;
	}

	php_sapi_started = 1;
	php_wasm_sapi_module.additional_functions = additional_functions;
	if (php_wasm_sapi_module.startup(&php_wasm_sapi_module) == FAILURE)
	{
		return FAILURE;
	}
	return SUCCESS;
}
