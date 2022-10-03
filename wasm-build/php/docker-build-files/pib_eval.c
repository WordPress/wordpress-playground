#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "php_main.h"

#ifdef ZTS
invalid!
#endif

int main() { return 0; }

int EMSCRIPTEN_KEEPALIVE pib_init()
{
    #if defined(SIGPIPE) && defined(SIG_IGN)
        signal(SIGPIPE, SIG_IGN); /* ignore SIGPIPE in standalone mode so
                                     that sockets created via fsockopen()
                                     don't kill PHP if the remote site
                                     closes it.  in apache|apxs mode apache
                                     does that for us!  thies@thieso.net
                                     20000419 */
    #endif
    php_embed_shutdown();
    zend_signal_startup();
	sapi_startup(&php_embed_module);
    return 1; //php_tsrm_startup();
    //zend_signal_startup();

	//return 1; //php_embed_init(0, NULL);
}
