#include <emscripten.h>
#include <stdlib.h>

#include <stdio.h>
#include <signal.h>

#include "zend.h"
#include "zend_API.h"
#include "zend_builtin_functions.h"
#include "zend_interfaces.h"
#include "zend_exceptions.h"
#include "zend_vm.h"
#include "zend_dtrace.h"
#include "zend_smart_str.h"
#include "zend_exceptions_arginfo.h"
#include "zend_observer.h"
#include "zend_globals.h"
#include "zend_variables.h"
#include "zend_weakrefs.h"


void EMSCRIPTEN_KEEPALIVE pib_init(zend_object *object)
{
	zend_function *destructor = object->ce->destructor;
    zend_call_known_instance_method_with_0_params(destructor, object, NULL);
}
