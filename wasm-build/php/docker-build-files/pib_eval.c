#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"

#include "sqlite3.h"
#include "sqlite3.c"

int main() { return 0; }

int EMSCRIPTEN_KEEPALIVE pib_init()
{
	putenv("USE_ZEND_ALLOC=0");

	return php_embed_init(0, NULL);
}

void pib_finally()
{
	fflush(stdout);
	fprintf(stdout, "\n");

	fflush(stderr);
	fprintf(stderr, "\n");
}

char *EMSCRIPTEN_KEEPALIVE pib_exec(char *code)
{
	char *retVal = NULL;

	zend_try
	{
		zval retZv;

		zend_eval_string(code, &retZv, "php-wasm evaluate expression");

		convert_to_string(&retZv);

		retVal = Z_STRVAL(retZv);
	}
	zend_catch
	{
	}

	zend_end_try();

	pib_finally();

	return retVal;
}

int EMSCRIPTEN_KEEPALIVE pib_run(char *code)
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

	pib_finally();

	return retVal;
}

char *pib_tokenize(char *code)
{
	// tokenize_parse(zval zend_string)

	return "";
}

void EMSCRIPTEN_KEEPALIVE pib_destroy()
{
	return php_embed_shutdown();
}

int EMSCRIPTEN_KEEPALIVE pib_refresh()
{
	pib_destroy();

	return pib_init();
}

#ifdef WITH_VRZNO
#include "../php-src/ext/vrzno/php_vrzno.h"

int EMSCRIPTEN_KEEPALIVE exec_callback(zend_function *fptr)
{
	int retVal = vrzno_exec_callback(fptr);

	fflush(stdout);

	return retVal;
}

int EMSCRIPTEN_KEEPALIVE del_callback(zend_function *fptr)
{
	return vrzno_del_callback(fptr);
}
#endif
