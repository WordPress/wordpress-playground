#include "sapi/embed/php_embed.h"
#include <emscripten.h>
#include <stdlib.h>

#include "zend_API.h"

int main() { return 0; }

int EMSCRIPTEN_KEEPALIVE pib_init()
{
    zend_call_function(NULL, NULL);

    // This works:
    return 1;
}

