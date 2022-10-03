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



/* {{{ php_request_shutdown */
void php_request_shutdown2(void *dummy)
{
	bool report_memleaks;

	EG(flags) |= EG_FLAGS_IN_SHUTDOWN;

	report_memleaks = PG(report_memleaks);

	/* EG(current_execute_data) points into nirvana and therefore cannot be safely accessed
	 * inside zend_executor callback functions.
	 */
	EG(current_execute_data) = NULL;

	php_deactivate_ticks();

	/* 0. Call any open observer end handlers that are still open after a zend_bailout */
	if (ZEND_OBSERVER_ENABLED) {
		zend_observer_fcall_end_all();
	}

	/* 1. Call all possible shutdown functions registered with register_shutdown_function() */
	if (PG(modules_activated)) {
		php_call_shutdown_functions();
	}

	/* 2. Call all possible __destruct() functions */
	zend_try {
		zend_call_destructors();
	} zend_end_try();

	/* 3. Flush all output buffers */
	zend_try {
		php_output_end_all();
	} zend_end_try();
}
/* }}} */

int EMSCRIPTEN_KEEPALIVE pib_init()
{
    php_request_shutdown2(NULL);

    // This works:
    return 1;
}

