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

void EMSCRIPTEN_KEEPALIVE pib_init(zend_object *object)
{

	ZEND_ASSERT(GC_REFCOUNT(object) == 0);

	/* GC might have released this object already. */
	if (UNEXPECTED(GC_TYPE(object) == IS_NULL)) {
		return;
	}

	/*	Make sure we hold a reference count during the destructor call
		otherwise, when the destructor ends the storage might be freed
		when the refcount reaches 0 a second time
	 */
	if (!(OBJ_FLAGS(object) & IS_OBJ_DESTRUCTOR_CALLED)) {
		GC_ADD_FLAGS(object, IS_OBJ_DESTRUCTOR_CALLED);

		if (object->handlers->dtor_obj != zend_objects_destroy_object
				|| object->ce->destructor) {
			GC_SET_REFCOUNT(object, 1);
			object->handlers->dtor_obj(object);
			GC_DELREF(object);
		}
	}
}
