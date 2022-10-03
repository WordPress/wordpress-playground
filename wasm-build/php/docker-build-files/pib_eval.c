#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "php_main.h"
#include "SAPI.h"

#define ZEND_INCLUDE_FULL_WINDOWS_HEADERS

#include "php.h"
#include <stdio.h>
#include <fcntl.h>
#ifdef PHP_WIN32
#include "win32/time.h"
#include "win32/signal.h"
#include "win32/php_win32_globals.h"
#include "win32/winutil.h"
#include <process.h>
#endif
#if HAVE_SYS_TIME_H
#include <sys/time.h>
#endif
#if HAVE_UNISTD_H
#include <unistd.h>
#endif

#include <signal.h>
#include <locale.h>
#include "zend.h"
#include "zend_types.h"
#include "zend_extensions.h"
#include "php_ini.h"
#include "php_globals.h"
#include "php_main.h"
#include "php_syslog.h"
#include "fopen_wrappers.h"
#include "ext/standard/php_standard.h"
#include "ext/date/php_date.h"
#include "php_variables.h"
#include "ext/standard/credits.h"
#ifdef PHP_WIN32
#include <io.h>
#include "win32/php_registry.h"
#include "ext/standard/flock_compat.h"
#endif
#include "php_syslog.h"
#include "Zend/zend_exceptions.h"

#if PHP_SIGCHILD
#include <sys/types.h>
#include <sys/wait.h>
#endif

#include "zend_compile.h"
#include "zend_execute.h"
#include "zend_highlight.h"
#include "zend_extensions.h"
#include "zend_ini.h"
#include "zend_dtrace.h"
#include "zend_observer.h"
#include "zend_system_id.h"

#include "php_content_types.h"
#include "php_ticks.h"
#include "php_streams.h"
#include "php_open_temporary_file.h"

#include "SAPI.h"
#include "rfc1867.h"

#include "ext/standard/html_tables.h"

#ifdef ZTS
invalid!
#endif
#if defined(PHP_NEED_REENTRANCY)
invalid!
#endif

int main() { return 0; }



/*
   +----------------------------------------------------------------------+
   | Copyright (c) The PHP Group                                          |
   +----------------------------------------------------------------------+
   | This source file is subject to version 3.01 of the PHP license,      |
   | that is bundled with this package in the file LICENSE, and is        |
   | available through the world-wide-web at the following url:           |
   | https://www.php.net/license/3_01.txt                                 |
   | If you did not receive a copy of the PHP license and are unable to   |
   | obtain it through the world-wide-web, please send a note to          |
   | license@php.net so we can mail you a copy immediately.               |
   +----------------------------------------------------------------------+
   | Author: Edin Kadribasic <edink@php.net>                              |
   +----------------------------------------------------------------------+
*/

#include "ext/standard/php_standard.h"
#include "ext/standard/dl_arginfo.h"

#ifdef PHP_WIN32
#include <io.h>
#include <fcntl.h>
#endif

const char HARDCODED_INI[] =
	"html_errors=0\n"
	"register_argc_argv=1\n"
	"implicit_flush=1\n"
	"output_buffering=0\n"
	"max_execution_time=0\n"
	"max_input_time=-1\n\0";

#if defined(PHP_WIN32) && defined(ZTS)
ZEND_TSRMLS_CACHE_DEFINE()
#endif

static char* php_embed_read_cookies(void)
{
	return NULL;
}

static int php_embed_deactivate(void)
{
	fflush(stdout);
	return SUCCESS;
}

/* Here we prefer to use write(), which is unbuffered, over fwrite(), which is
 * buffered. Using an unbuffered write operation to stdout will ensure PHP's
 * output buffering feature does not compete with a SAPI output buffer and
 * therefore we avoid situations wherein flushing the output buffer results in
 * nondeterministic behavior.
 */
static inline size_t php_embed_single_write(const char *str, size_t str_length)
{
#ifdef PHP_WRITE_STDOUT
	zend_long ret;

	ret = write(STDOUT_FILENO, str, str_length);
	if (ret <= 0) return 0;
	return ret;
#else
	size_t ret;

	ret = fwrite(str, 1, MIN(str_length, 16384), stdout);
	return ret;
#endif
}

/* SAPIs only have unbuffered write operations. This is because PHP's output
 * buffering feature will handle any buffering of the output and invoke the
 * SAPI unbuffered write operation when it flushes the buffer.
 */
static size_t php_embed_ub_write(const char *str, size_t str_length)
{
	const char *ptr = str;
	size_t remaining = str_length;
	size_t ret;

	while (remaining > 0) {
		ret = php_embed_single_write(ptr, remaining);
		if (!ret) {
			php_handle_aborted_connection();
		}
		ptr += ret;
		remaining -= ret;
	}

	return str_length;
}

static void php_embed_flush(void *server_context)
{
	if (fflush(stdout)==EOF) {
		php_handle_aborted_connection();
	}
}

static void php_embed_send_header(sapi_header_struct *sapi_header, void *server_context)
{
}

/* The SAPI error logger that is called when the 'error_log' INI setting is not
 * set.
 *
 * https://www.php.net/manual/en/errorfunc.configuration.php#ini.error-log
 */
static void php_embed_log_message(const char *message, int syslog_type_int)
{
	fprintf(stderr, "%s\n", message);
}

static void php_embed_register_variables(zval *track_vars_array)
{
	php_import_environment_variables(track_vars_array);
}

/* Module initialization (MINIT) */
static int php_embed_startup(sapi_module_struct *sapi_module)
{
	return 0;
}

EMBED_SAPI_API sapi_module_struct php_embed_module2 = {
	NULL,                       /* name */
	NULL,        /* pretty name */

	NULL,             /* startup */
	NULL,   /* shutdown */

	NULL,                          /* activate */
	NULL,          /* deactivate */

	NULL,            /* unbuffered write */
	NULL,               /* flush */
	NULL,                          /* get uid */
	NULL,                          /* getenv */

	NULL,                     /* error handler */

	NULL,                          /* header handler */
	NULL,                          /* send headers handler */
	NULL,         /* send header handler */

	NULL,                          /* read POST data */
	NULL,        /* read Cookies */

	NULL,  /* register server variables */
	NULL,         /* Log message */
	NULL,                          /* Get request time */
	NULL,                          /* Child terminate */

	NULL
};
/* }}} */

static const zend_function_entry additional_functions[] = {
	ZEND_FE(dl, arginfo_dl)
	ZEND_FE_END
};

EMBED_SAPI_API int php_embed_init(int argc, char **argv)
{
	return 1;
}

EMBED_SAPI_API void php_embed_shutdown(void)
{
//	/* Request shutdown (RSHUTDOWN) */
	php_request_shutdown((void *) 0);
//
//	/* Module shutdown (MSHUTDOWN) */
//	php_module_shutdown();
//
//	/* SAPI shutdown (SSHUTDOWN) */
//	sapi_shutdown();
//
//#ifdef ZTS
//	tsrm_shutdown();
//#endif
//
//	if (php_embed_module2.ini_entries) {
//		free(php_embed_module2.ini_entries);
//		php_embed_module2.ini_entries = NULL;
//	}
}


SAPI_API sapi_module_struct private_sapi_module;
int EMSCRIPTEN_KEEPALIVE pib_init()
{
    php_request_shutdown(NULL);

    // This works:
    return 1;
}

