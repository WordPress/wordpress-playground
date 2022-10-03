#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

int main() { return 0; }

int EMSCRIPTEN_KEEPALIVE pib_init()
{
    php_embed_shutdown();
	return 0; //php_embed_init(0, NULL);
}
