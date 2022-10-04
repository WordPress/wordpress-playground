#include <emscripten.h>
#include <stdlib.h>

#include "zend.h"
#include "zend_constants.h"
#include "zend_exceptions.h"
#include "zend_execute.h"
#include "zend_variables.h"
#include "zend_operators.h"
#include "zend_globals.h"
#include "zend_API.h"


int main() { return 0; }



int EMSCRIPTEN_KEEPALIVE pib_init()
{
    zend_string *cname;
	const char *name = ZSTR_VAL(cname);
	size_t name_len = ZSTR_LEN(cname);
    zend_string *class_name = zend_string_init(name, 10, 0);
    zend_fetch_class(class_name, 0);
//    zend_get_called_scope(EG(current_execute_data));


    return 1;
}

