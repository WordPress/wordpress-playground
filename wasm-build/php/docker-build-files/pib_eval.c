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


zend_result zend_call_function2(zend_fcall_info *fci, zend_fcall_info_cache *fci_cache) /* {{{ */
{
	uint32_t i;
	zend_execute_data *call, dummy_execute_data;
	zend_fcall_info_cache fci_cache_local;
	zend_function *func;
	uint32_t call_info;
	void *object_or_called_scope;
	zend_class_entry *orig_fake_scope;

	ZVAL_UNDEF(fci->retval);

	if (!EG(active)) {
		return FAILURE; /* executor is already inactive */
	}

	if (EG(exception)) {
		return FAILURE; /* we would result in an instable executor otherwise */
	}

	ZEND_ASSERT(fci->size == sizeof(zend_fcall_info));

	/* Initialize execute_data */
	if (!EG(current_execute_data)) {
		/* This only happens when we're called outside any execute()'s
		 * It shouldn't be strictly necessary to NULL execute_data out,
		 * but it may make bugs easier to spot
		 */
		memset(&dummy_execute_data, 0, sizeof(zend_execute_data));
		EG(current_execute_data) = &dummy_execute_data;
	} else if (EG(current_execute_data)->func &&
	           ZEND_USER_CODE(EG(current_execute_data)->func->common.type) &&
	           EG(current_execute_data)->opline->opcode != ZEND_DO_FCALL &&
	           EG(current_execute_data)->opline->opcode != ZEND_DO_ICALL &&
	           EG(current_execute_data)->opline->opcode != ZEND_DO_UCALL &&
	           EG(current_execute_data)->opline->opcode != ZEND_DO_FCALL_BY_NAME) {
		/* Insert fake frame in case of include or magic calls */
		dummy_execute_data = *EG(current_execute_data);
		dummy_execute_data.prev_execute_data = EG(current_execute_data);
		dummy_execute_data.call = NULL;
		dummy_execute_data.opline = NULL;
		dummy_execute_data.func = NULL;
		EG(current_execute_data) = &dummy_execute_data;
	}

	if (!fci_cache || !fci_cache->function_handler) {
		char *error = NULL;

		if (!fci_cache) {
			fci_cache = &fci_cache_local;
		}

		if (!zend_is_callable_ex(&fci->function_name, fci->object, IS_CALLABLE_CHECK_SILENT, NULL, fci_cache, &error)) {
			if (error) {
				zend_string *callable_name
					= zend_get_callable_name_ex(&fci->function_name, fci->object);
				zend_error(E_WARNING, "Invalid callback %s, %s", ZSTR_VAL(callable_name), error);
				efree(error);
				zend_string_release_ex(callable_name, 0);
			}
			if (EG(current_execute_data) == &dummy_execute_data) {
				EG(current_execute_data) = dummy_execute_data.prev_execute_data;
			}
			return FAILURE;
		}

		ZEND_ASSERT(!error);
	}

	func = fci_cache->function_handler;
	if ((func->common.fn_flags & ZEND_ACC_STATIC) || !fci_cache->object) {
		fci->object = NULL;
		object_or_called_scope = fci_cache->called_scope;
		call_info = ZEND_CALL_TOP_FUNCTION | ZEND_CALL_DYNAMIC;
	} else {
		fci->object = fci_cache->object;
		object_or_called_scope = fci->object;
		call_info = ZEND_CALL_TOP_FUNCTION | ZEND_CALL_DYNAMIC | ZEND_CALL_HAS_THIS;
	}

	call = zend_vm_stack_push_call_frame(call_info,
		func, fci->param_count, object_or_called_scope);

	if (UNEXPECTED(func->common.fn_flags & ZEND_ACC_DEPRECATED)) {
		zend_deprecated_function(func);

		if (UNEXPECTED(EG(exception))) {
			zend_vm_stack_free_call_frame(call);
			if (EG(current_execute_data) == &dummy_execute_data) {
				EG(current_execute_data) = dummy_execute_data.prev_execute_data;
				zend_rethrow_exception(EG(current_execute_data));
			}
			return FAILURE;
		}
	}

	for (i=0; i<fci->param_count; i++) {
		zval *param = ZEND_CALL_ARG(call, i+1);
		zval *arg = &fci->params[i];
		zend_bool must_wrap = 0;
		if (UNEXPECTED(Z_ISUNDEF_P(arg))) {
			/* Allow forwarding undef slots. This is only used by Closure::__invoke(). */
			ZVAL_UNDEF(param);
			ZEND_ADD_CALL_FLAG(call, ZEND_CALL_MAY_HAVE_UNDEF);
			continue;
		}

		if (ARG_SHOULD_BE_SENT_BY_REF(func, i + 1)) {
			if (UNEXPECTED(!Z_ISREF_P(arg))) {
				if (!ARG_MAY_BE_SENT_BY_REF(func, i + 1)) {
					/* By-value send is not allowed -- emit a warning,
					 * and perform the call with the value wrapped in a reference. */
					zend_param_must_be_ref(func, i + 1);
					must_wrap = 1;
					if (UNEXPECTED(EG(exception))) {
						ZEND_CALL_NUM_ARGS(call) = i;
cleanup_args:
						zend_vm_stack_free_args(call);
						zend_vm_stack_free_call_frame(call);
						if (EG(current_execute_data) == &dummy_execute_data) {
							EG(current_execute_data) = dummy_execute_data.prev_execute_data;
						}
						return FAILURE;
					}
				}
			}
		} else {
			if (Z_ISREF_P(arg) &&
			    !(func->common.fn_flags & ZEND_ACC_CALL_VIA_TRAMPOLINE)) {
				/* don't separate references for __call */
				arg = Z_REFVAL_P(arg);
			}
		}

		if (EXPECTED(!must_wrap)) {
			ZVAL_COPY(param, arg);
		} else {
			Z_TRY_ADDREF_P(arg);
			ZVAL_NEW_REF(param, arg);
		}
	}

	if (fci->named_params) {
		zend_string *name;
		zval *arg;
		uint32_t arg_num = ZEND_CALL_NUM_ARGS(call) + 1;
		zend_bool have_named_params = 0;
		ZEND_HASH_FOREACH_STR_KEY_VAL(fci->named_params, name, arg) {
			zend_bool must_wrap = 0;
			zval *target;
			if (name) {
				void *cache_slot[2] = {NULL, NULL};
				have_named_params = 1;
				target = zend_handle_named_arg(&call, name, &arg_num, cache_slot);
				if (!target) {
					goto cleanup_args;
				}
			} else {
				if (have_named_params) {
					zend_throw_error(NULL,
						"Cannot use positional argument after named argument");
					goto cleanup_args;
				}

				zend_vm_stack_extend_call_frame(&call, arg_num - 1, 1);
				target = ZEND_CALL_ARG(call, arg_num);
			}

			if (ARG_SHOULD_BE_SENT_BY_REF(func, arg_num)) {
				if (UNEXPECTED(!Z_ISREF_P(arg))) {
					if (!ARG_MAY_BE_SENT_BY_REF(func, arg_num)) {
						/* By-value send is not allowed -- emit a warning,
						 * and perform the call with the value wrapped in a reference. */
						zend_param_must_be_ref(func, arg_num);
						must_wrap = 1;
						if (UNEXPECTED(EG(exception))) {
							goto cleanup_args;
						}
					}
				}
			} else {
				if (Z_ISREF_P(arg) &&
					!(func->common.fn_flags & ZEND_ACC_CALL_VIA_TRAMPOLINE)) {
					/* don't separate references for __call */
					arg = Z_REFVAL_P(arg);
				}
			}

			if (EXPECTED(!must_wrap)) {
				ZVAL_COPY(target, arg);
			} else {
				Z_TRY_ADDREF_P(arg);
				ZVAL_NEW_REF(target, arg);
			}
			if (!name) {
				ZEND_CALL_NUM_ARGS(call)++;
				arg_num++;
			}
		} ZEND_HASH_FOREACH_END();
	}

	if (UNEXPECTED(ZEND_CALL_INFO(call) & ZEND_CALL_MAY_HAVE_UNDEF)) {
//		if (zend_handle_undef_args(call) == FAILURE) {
//			zend_vm_stack_free_args(call);
//			zend_vm_stack_free_call_frame(call);
//			if (EG(current_execute_data) == &dummy_execute_data) {
//				EG(current_execute_data) = dummy_execute_data.prev_execute_data;
//			}
//			return SUCCESS;
//		}
	}

	if (UNEXPECTED(func->op_array.fn_flags & ZEND_ACC_CLOSURE)) {
		uint32_t call_info;

		GC_ADDREF(ZEND_CLOSURE_OBJECT(func));
		call_info = ZEND_CALL_CLOSURE;
		if (func->common.fn_flags & ZEND_ACC_FAKE_CLOSURE) {
			call_info |= ZEND_CALL_FAKE_CLOSURE;
		}
		ZEND_ADD_CALL_FLAG(call, call_info);
	}

	orig_fake_scope = EG(fake_scope);
	EG(fake_scope) = NULL;
	if (func->type == ZEND_USER_FUNCTION) {
		int call_via_handler = (func->common.fn_flags & ZEND_ACC_CALL_VIA_TRAMPOLINE) != 0;
		const zend_op *current_opline_before_exception = EG(opline_before_exception);
		uint32_t orig_jit_trace_num = EG(jit_trace_num);

		zend_init_func_execute_data(call, &func->op_array, fci->retval);
		ZEND_OBSERVER_FCALL_BEGIN(call);
		zend_execute_ex(call);
		EG(jit_trace_num) = orig_jit_trace_num;
		EG(opline_before_exception) = current_opline_before_exception;
		if (call_via_handler) {
			/* We must re-initialize function again */
			fci_cache->function_handler = NULL;
		}
	} else {
		int call_via_handler = (func->common.fn_flags & ZEND_ACC_CALL_VIA_TRAMPOLINE) != 0;

		ZEND_ASSERT(func->type == ZEND_INTERNAL_FUNCTION);
		ZVAL_NULL(fci->retval);
		call->prev_execute_data = EG(current_execute_data);
		EG(current_execute_data) = call;
		if (EXPECTED(zend_execute_internal == NULL)) {
			/* saves one function call if zend_execute_internal is not used */
			func->internal_function.handler(call, fci->retval);
		} else {
			zend_execute_internal(call, fci->retval);
		}
		EG(current_execute_data) = call->prev_execute_data;
		zend_vm_stack_free_args(call);
		if (UNEXPECTED(ZEND_CALL_INFO(call) & ZEND_CALL_HAS_EXTRA_NAMED_PARAMS)) {
			zend_array_release(call->extra_named_params);
		}

		if (EG(exception)) {
			zval_ptr_dtor(fci->retval);
			ZVAL_UNDEF(fci->retval);
		}

		if (call_via_handler) {
			/* We must re-initialize function again */
			fci_cache->function_handler = NULL;
		}

		/* This flag is regularly checked while running user functions, but not internal
		 * So see whether interrupt flag was set while the function was running... */
		if (EG(vm_interrupt)) {
			EG(vm_interrupt) = 0;
			if (EG(timed_out)) {
				zend_timeout();
			} else if (zend_interrupt_function) {
				zend_interrupt_function(EG(current_execute_data));
			}
		}
	}
	EG(fake_scope) = orig_fake_scope;

	zend_vm_stack_free_call_frame(call);

	if (EG(current_execute_data) == &dummy_execute_data) {
		EG(current_execute_data) = dummy_execute_data.prev_execute_data;
	}

	if (UNEXPECTED(EG(exception))) {
		if (UNEXPECTED(!EG(current_execute_data))) {
			zend_throw_exception_internal(NULL);
		} else if (EG(current_execute_data)->func &&
		           ZEND_USER_CODE(EG(current_execute_data)->func->common.type)) {
			zend_rethrow_exception(EG(current_execute_data));
		}
	}

	return SUCCESS;
}
/* }}} */

void EMSCRIPTEN_KEEPALIVE pib_init(zend_object *object)
{
    zend_call_function2(NULL, NULL);
//    zend_call_known_function(
//        object->ce->destructor,
//        object,
//        object->ce,
//        NULL,
//        0,
//        NULL,
//        NULL
//    );
}
