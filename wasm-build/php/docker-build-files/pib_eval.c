#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "php_main.h"
#include "SAPI.h"

#ifdef ZTS
invalid!
#endif
#ifdef defined(PHP_NEED_REENTRANCY)
invalid!
#endif

int main() { return 0; }

SAPI_API sapi_module_struct private_sapi_module;
int EMSCRIPTEN_KEEPALIVE pib_init()
{
    php_embed_shutdown();
    zend_signal_startup();
    // This causes the crash:
    // https://github.com/php/php-src/blob/master/main/SAPI.c
	(&php_embed_module)->ini_entries = NULL;
	private_sapi_module = *(&php_embed_module);

    return 1;
}
