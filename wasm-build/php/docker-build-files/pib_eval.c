#include <emscripten.h>
#include <stdlib.h>

#include "zend_ast.h"
#include "zend_API.h"
#include "zend_operators.h"
#include "zend_language_parser.h"
#include "zend_smart_str.h"
#include "zend_exceptions.h"
#include "zend_constants.h"

int main() { return 0; }



int EMSCRIPTEN_KEEPALIVE pib_init()
{
    int t = 1;
    zval *zv;
    zend_throw_error(NULL, NULL);
    zend_ast_get_zval(NULL);
    zend_ast_get_constant_name(NULL);
    uint32_t t2 = 1;
    zend_get_constant_ex(NULL,NULL,t2);
    zend_is_true(zv);
    zend_ast_get_list(NULL);
    zend_error_noreturn(t,NULL);
    zend_fetch_dimension_const(NULL,NULL,NULL,t);

    // This works:
    return 1;
}

