#include <emscripten.h>
#include <stdlib.h>

#include <stdio.h>
#include <signal.h>

#include "zend.h"
#include "zend_compile.h"
#include "zend_execute.h"
#include "zend_API.h"
#include "zend_stack.h"
#include "zend_constants.h"
#include "zend_extensions.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "zend_generators.h"
#include "zend_vm.h"
#include "zend_float.h"
#include "zend_weakrefs.h"
#include "zend_inheritance.h"
#include "zend_observer.h"
#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif
#ifdef HAVE_UNISTD_H
#include <unistd.h>
#endif


int main() { return 0; }



int EMSCRIPTEN_KEEPALIVE pib_init()
{
    zend_string *class_name;
    zend_lookup_class_ex(class_name, NULL, NULL);
//    zend_get_called_scope(EG(current_execute_data));


    return 1;
}

/*
The crash is NOT caused by either of these functions:

zend_get_class_fetch_type
zend_get_executed_scope
zend_get_called_scope

*/
