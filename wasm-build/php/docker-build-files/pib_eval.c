#include <emscripten.h>
#include <stdlib.h>

#include <stdio.h>
#include <signal.h>


#include "zend.h"
#include "zend_compile.h"
#include "zend_execute.h"
#include "zend_API.h"
#include "zend_ast.h"
#include "zend_globals.h"
#include "zend_constants.h"
#include "zend_list.h"
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
#include "zend_variables.h"
#ifdef HAVE_SYS_TIME_H
#include <sys/time.h>
#endif
#ifdef HAVE_UNISTD_H
#include <unistd.h>
#endif


#if defined(__aarch64__)
# include <arm_neon.h>
#endif

#ifdef __SSE2__
# include <mmintrin.h>
# include <emmintrin.h>
#endif

#if ZEND_DEBUG
# define HT_ASSERT(ht, expr) \
	ZEND_ASSERT((expr) || (HT_FLAGS(ht) & HASH_FLAG_ALLOW_COW_VIOLATION))
#else
# define HT_ASSERT(ht, expr)
#endif

#define HT_ASSERT_RC1(ht) HT_ASSERT(ht, GC_REFCOUNT(ht) == 1)

#define HT_POISONED_PTR ((HashTable2 *) (intptr_t) -1)
#define IS_CONSISTENT(a)
#define SET_INCONSISTENT(n)

typedef struct _zend_array2 HashTable2;

struct _zend_array2 {
	zend_refcounted_h gc;
	union {
		struct {
			ZEND_ENDIAN_LOHI_4(
				zend_uchar    flags,
				zend_uchar    _unused,
				zend_uchar    nIteratorsCount,
				zend_uchar    _unused2)
		} v;
		uint32_t flags;
	} u;
	uint32_t          nTableMask;
	uint32_t          *arData;
	uint32_t          nNumUsed;
	uint32_t          nNumOfElements;
	uint32_t          nTableSize;
	uint32_t          nInternalPointer;
	uint32_t         nNextFreeElement;
	uint32_t       pDestructor;
};


static zend_always_inline void zend_string_release2(zend_string *s)
{
	if (!ZSTR_IS_INTERNED(s)) {
		if (GC_DELREF(s) == 0) {
//			pefree(s, GC_FLAGS(s) & IS_STR_PERSISTENT);
		}
	}
}

ZEND_API void ZEND_FASTCALL zend_hash_destroy3(HashTable2 *ht)
{
	Bucket *p, *end;

	IS_CONSISTENT(ht);
	HT_ASSERT(ht, GC_REFCOUNT(ht) <= 1);

	if (ht->nNumUsed) {
//		p = ht->arData;
		end = p + ht->nNumUsed;
		if (ht->pDestructor) {
			SET_INCONSISTENT(HT_IS_DESTROYING);

			if (HT_HAS_STATIC_KEYS_ONLY(ht)) {
				if (HT_IS_WITHOUT_HOLES(ht)) {
					do {
//						ht->pDestructor(&p->val);
					} while (++p != end);
				} else {
					do {
						if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
//							ht->pDestructor(&p->val);
						}
					} while (++p != end);
				}
			} else if (HT_IS_WITHOUT_HOLES(ht)) {
				do {
//					ht->pDestructor(&p->val);
					if (EXPECTED(p->key)) {
//						zend_string_release(p->key);
					}
				} while (++p != end);
			} else {
				do {
					if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
//						ht->pDestructor(&p->val);
						if (EXPECTED(p->key)) {
//							zend_string_release(p->key);
						}
					}
				} while (++p != end);
			}

			SET_INCONSISTENT(HT_DESTROYED);
		} else {
			if (!HT_HAS_STATIC_KEYS_ONLY(ht)) {
				do {
					if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
						if (EXPECTED(p->key)) {
//							zend_string_release2(p->key);
						}
					}
				} while (++p != end);
			}
		}
//		zend_hash_iterators_remove(ht);
	}
    else if (EXPECTED(HT_FLAGS(ht) & HASH_FLAG_UNINITIALIZED)) {
      return;
    }
	free(HT_GET_DATA_ADDR(ht));
}

ZEND_API void ZEND_FASTCALL zend_hash_destroy2(HashTable2 *ht)
{
    printf(" test=%s", ((char*)((ht)->arData)));
}

ZEND_API void ZEND_FASTCALL zend_array_destroy2(HashTable2 *ht)
{
	Bucket *p, *end;

	IS_CONSISTENT(ht);
	HT_ASSERT(ht, GC_REFCOUNT(ht) <= 1);

	/* break possible cycles */
	GC_REMOVE_FROM_BUFFER(ht);
	GC_TYPE_INFO(ht) = GC_NULL /*???| (GC_WHITE << 16)*/;

	if (ht->nNumUsed) {
		/* In some rare cases destructors of regular arrays may be changed */
		if (UNEXPECTED(ht->pDestructor != ZVAL_PTR_DTOR)) {
			zend_hash_destroy2(ht);
//			goto free_ht;
		}

//		p = ht->arData;
//		end = p + ht->nNumUsed;
//		SET_INCONSISTENT(HT_IS_DESTROYING);
//
//		if (HT_HAS_STATIC_KEYS_ONLY(ht)) {
//			do {
//				i_zval_ptr_dtor(&p->val);
//			} while (++p != end);
//		} else if (HT_IS_WITHOUT_HOLES(ht)) {
//			do {
//				i_zval_ptr_dtor(&p->val);
//				if (EXPECTED(p->key)) {
//					zend_string_release_ex(p->key, 0);
//				}
//			} while (++p != end);
//		} else {
//			do {
//				if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
//					i_zval_ptr_dtor(&p->val);
//					if (EXPECTED(p->key)) {
//						zend_string_release_ex(p->key, 0);
//					}
//				}
//			} while (++p != end);
//		}
	}
//	else if (EXPECTED(HT_FLAGS(ht) & HASH_FLAG_UNINITIALIZED)) {
//		goto free_ht;
//	}
//	SET_INCONSISTENT(HT_DESTROYED);
//	efree(HT_GET_DATA_ADDR(ht));
free_ht:
    return;
//	zend_hash_iterators_remove(ht);
//	FREE_HashTable2(ht);
}

# define zend_string_destroy2 _efree
static void ZEND_FASTCALL zend_reference_destroy2(zend_reference *ref);
static void ZEND_FASTCALL zend_empty_destroy2(zend_reference *ref);

typedef void (ZEND_FASTCALL *zend_rc_dtor_func_t2)(zend_refcounted *p);

static const zend_rc_dtor_func_t2 zend_rc_dtor_func2[] = {
//	/* IS_UNDEF        */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
//	/* IS_NULL         */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
//	/* IS_FALSE        */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
//	/* IS_TRUE         */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
//	/* IS_LONG         */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
//	/* IS_DOUBLE       */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
//	/* IS_STRING       */ (zend_rc_dtor_func_t2)zend_string_destroy2,
	/* IS_ARRAY        */ (zend_rc_dtor_func_t2)zend_array_destroy2,
//	/* IS_OBJECT       */ (zend_rc_dtor_func_t2)zend_objects_store_del,
//	/* IS_RESOURCE     */ (zend_rc_dtor_func_t2)zend_list_free,
//	/* IS_REFERENCE    */ (zend_rc_dtor_func_t2)zend_reference_destroy2,
//	/* IS_CONSTANT_AST */ (zend_rc_dtor_func_t2)zend_ast_ref_destroy
};

ZEND_API void ZEND_FASTCALL rc_dtor_func2(zend_refcounted *p)
{
	ZEND_ASSERT(GC_TYPE(p) <= IS_CONSTANT_AST);
	zend_rc_dtor_func2[GC_TYPE(p)](p);
}

static zend_always_inline void zval_ptr_dtor_nogc2(zval *zval_ptr)
{
	if (Z_REFCOUNTED_P(zval_ptr) && !Z_DELREF_P(zval_ptr)) {
		rc_dtor_func2(Z_COUNTED_P(zval_ptr));
	}
}

static zend_always_inline void zend_vm_stack_free_args2(zend_execute_data *call)
{
	uint32_t num_args = ZEND_CALL_NUM_ARGS(call);

	if (EXPECTED(num_args > 0)) {
		zval *p = ZEND_CALL_ARG(call, 1);

		do {
			zval_ptr_dtor_nogc2(p);
			p++;
		} while (--num_args);
	}
}


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

		if( false )// (!zend_is_callable_ex(&fci->function_name, fci->object, IS_CALLABLE_CHECK_SILENT, NULL, fci_cache, &error))
		{
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
						zend_vm_stack_free_args2(call);
//						zend_vm_stack_free_call_frame(call);
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
//				target = zend_handle_named_arg(&call, name, &arg_num, cache_slot);
                goto cleanup_args;
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
		if ( fci_cache != NULL ) { // (zend_handle_undef_args(call) == FAILURE) {
//			zend_vm_stack_free_args(call);
			zend_vm_stack_free_call_frame(call);
			if (EG(current_execute_data) == &dummy_execute_data) {
				EG(current_execute_data) = dummy_execute_data.prev_execute_data;
			}
			return SUCCESS;
		}
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
//		zend_vm_stack_free_args(call);
		if (UNEXPECTED(ZEND_CALL_INFO(call) & ZEND_CALL_HAS_EXTRA_NAMED_PARAMS)) {
//			zend_array_release(call->extra_named_params);
		}

		if (EG(exception)) {
//			zval_ptr_dtor(fci->retval);
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

//	zend_vm_stack_free_call_frame(call);

	if (EG(current_execute_data) == &dummy_execute_data) {
		EG(current_execute_data) = dummy_execute_data.prev_execute_data;
	}

	if (UNEXPECTED(EG(exception))) {
		if (UNEXPECTED(!EG(current_execute_data))) {
//			zend_throw_exception_internal(NULL);
		} else if (EG(current_execute_data)->func &&
		           ZEND_USER_CODE(EG(current_execute_data)->func->common.type)) {
			zend_rethrow_exception(EG(current_execute_data));
		}
	}

	return SUCCESS;
}
/* }}} */

void zend_exception_save2(void) /* {{{ */
{
	if (EG(prev_exception)) {
//		zend_object_release(EG(prev_exception));
		zend_call_function2(NULL, NULL);
	}
	if (EG(exception)) {
		EG(prev_exception) = EG(exception);
	}
	EG(exception) = NULL;
}

ZEND_API zend_class_entry *zend_lookup_class2(zend_string *name, zend_string *key, uint32_t flags) /* {{{ */
{
	zend_class_entry *ce = NULL;
	zval *zv;
	zend_string *lc_name;
	zend_string *autoload_name;

	if (key) {
		lc_name = key;
	} else {
		if (name == NULL || !ZSTR_LEN(name)) {
			return NULL;
		}

		if (ZSTR_VAL(name)[0] == '\\') {
			lc_name = zend_string_alloc(ZSTR_LEN(name) - 1, 0);
			zend_str_tolower_copy(ZSTR_VAL(lc_name), ZSTR_VAL(name) + 1, ZSTR_LEN(name) - 1);
		} else {
			lc_name = zend_string_tolower(name);
		}
	}

	zv = zend_hash_find(EG(class_table), lc_name);
	if (zv) {
		if (!key) {
			zend_string_release_ex(lc_name, 0);
		}
		ce = (zend_class_entry*)Z_PTR_P(zv);
		if (UNEXPECTED(!(ce->ce_flags & ZEND_ACC_LINKED))) {
			if ((flags & ZEND_FETCH_CLASS_ALLOW_UNLINKED) ||
				((flags & ZEND_FETCH_CLASS_ALLOW_NEARLY_LINKED) &&
					(ce->ce_flags & ZEND_ACC_NEARLY_LINKED))) {
				ce->ce_flags |= ZEND_ACC_HAS_UNLINKED_USES;
				return ce;
			}
			return NULL;
		}
		return ce;
	}

	/* The compiler is not-reentrant. Make sure we autoload only during run-time. */
	if ((flags & ZEND_FETCH_CLASS_NO_AUTOLOAD) || zend_is_compiling()) {
		if (!key) {
			zend_string_release_ex(lc_name, 0);
		}
		return NULL;
	}

	if (!zend_autoload) {
		if (!key) {
			zend_string_release_ex(lc_name, 0);
		}
		return NULL;
	}

	/* Verify class name before passing it to the autoloader. */
	if (!key && !zend_is_valid_class_name(name)) {
		zend_string_release_ex(lc_name, 0);
		return NULL;
	}

	if (EG(in_autoload) == NULL) {
//		ALLOC_HashTable(EG(in_autoload));
		zend_hash_init(EG(in_autoload), 8, NULL, NULL, 0);
	}

	if (zend_hash_add_empty_element(EG(in_autoload), lc_name) == NULL) {
		if (!key) {
			zend_string_release_ex(lc_name, 0);
		}
		return NULL;
	}

	if (ZSTR_VAL(name)[0] == '\\') {
		autoload_name = zend_string_init(ZSTR_VAL(name) + 1, ZSTR_LEN(name) - 1, 0);
	} else {
		autoload_name = zend_string_copy(name);
	}

	zend_exception_save2();
//	ce = zend_autoload(autoload_name, lc_name);
//	zend_exception_restore();

	zend_string_release_ex(autoload_name, 0);
	zend_hash_del(EG(in_autoload), lc_name);

	if (!key) {
		zend_string_release_ex(lc_name, 0);
	}
	return ce;
}
/* }}} */

static zend_always_inline zend_class_entry *get_scope(zend_execute_data *frame)
{
	return frame && frame->func ? frame->func->common.scope : NULL;
}


static bool zend_is_callable_check_class(zend_string *name, zend_class_entry *scope, zend_execute_data *frame, zend_fcall_info_cache *fcc, bool *strict_class, char **error) /* {{{ */
{
	bool ret = 0;
	zend_class_entry *ce;
	size_t name_len = ZSTR_LEN(name);
	zend_string *lcname;
	ALLOCA_FLAG(use_heap);

	ZSTR_ALLOCA_ALLOC(lcname, name_len, use_heap);
	zend_str_tolower_copy(ZSTR_VAL(lcname), ZSTR_VAL(name), name_len);

	*strict_class = 0;
	if (zend_string_equals_literal(lcname, "self")) {
		if (!scope) {
			if (error) *error = estrdup("cannot access \"self\" when no class scope is active");
		} else {
			fcc->called_scope = zend_get_called_scope(frame);
			if (!fcc->called_scope || !instanceof_function(fcc->called_scope, scope)) {
				fcc->called_scope = scope;
			}
			fcc->calling_scope = scope;
			if (!fcc->object) {
				fcc->object = zend_get_this_object(frame);
			}
			ret = 1;
		}
	} else if (zend_string_equals_literal(lcname, "parent")) {
		if (!scope) {
			if (error) *error = estrdup("cannot access \"parent\" when no class scope is active");
		} else if (!scope->parent) {
			if (error) *error = estrdup("cannot access \"parent\" when current class scope has no parent");
		} else {
			fcc->called_scope = zend_get_called_scope(frame);
			if (!fcc->called_scope || !instanceof_function(fcc->called_scope, scope->parent)) {
				fcc->called_scope = scope->parent;
			}
			fcc->calling_scope = scope->parent;
			if (!fcc->object) {
				fcc->object = zend_get_this_object(frame);
			}
			*strict_class = 1;
			ret = 1;
		}
	} else if (zend_string_equals_literal(lcname, "static")) {
		zend_class_entry *called_scope = zend_get_called_scope(frame);

		if (!called_scope) {
			if (error) *error = estrdup("cannot access \"static\" when no class scope is active");
		} else {
			fcc->called_scope = called_scope;
			fcc->calling_scope = called_scope;
			if (!fcc->object) {
				fcc->object = zend_get_this_object(frame);
			}
			*strict_class = 1;
			ret = 1;
		}
	} else if (scope != NULL) {
	    ce = zend_lookup_class2(name, NULL, 0);
		zend_class_entry *scope = get_scope(frame);
		fcc->calling_scope = ce;
		if (scope && !fcc->object) {
			zend_object *object = zend_get_this_object(frame);

			if (object &&
			    instanceof_function(object->ce, scope) &&
			    instanceof_function(scope, ce)) {
				fcc->object = object;
				fcc->called_scope = object->ce;
			} else {
				fcc->called_scope = ce;
			}
		} else {
			fcc->called_scope = fcc->object ? fcc->object->ce : ce;
		}
		*strict_class = 1;
		ret = 1;
	} else {
		if (error) zend_spprintf(error, 0, "class \"%.*s\" not found", (int)name_len, ZSTR_VAL(name));
	}
	ZSTR_ALLOCA_FREE(lcname, use_heap);
	return ret;
}

ZEND_API zend_bool zend_is_callable_at_frame2(
		zval *callable, zend_object *object, zend_execute_data *frame,
		uint32_t check_flags, zend_fcall_info_cache *fcc, char **error) /* {{{ */
{
	zend_bool ret;
	zend_fcall_info_cache fcc_local;
	bool strict_class = 0;

	if (fcc == NULL) {
		fcc = &fcc_local;
	}
	if (error) {
		*error = NULL;
	}

	fcc->calling_scope = NULL;
	fcc->called_scope = NULL;
	fcc->function_handler = NULL;
	fcc->object = NULL;

again:
	switch (Z_TYPE_P(callable)) {
		case IS_STRING:
			if (object) {
				fcc->object = object;
				fcc->calling_scope = object->ce;
			}

			if (check_flags & IS_CALLABLE_CHECK_SYNTAX_ONLY) {
				fcc->called_scope = fcc->calling_scope;
				return 1;
			}

check_func:
//			ret = zend_is_callable_check_func(check_flags, callable, frame, fcc, strict_class, error);
			if (fcc == &fcc_local) {
				zend_release_fcall_info_cache(fcc);
			}
			return ret;

		case IS_ARRAY:
			{
				zval *method = NULL;
				zval *obj = NULL;

				if (zend_hash_num_elements(Z_ARRVAL_P(callable)) == 2) {
					obj = zend_hash_index_find(Z_ARRVAL_P(callable), 0);
					method = zend_hash_index_find(Z_ARRVAL_P(callable), 1);
				}

				do {
					if (obj == NULL || method == NULL) {
						break;
					}

					ZVAL_DEREF(method);
					if (Z_TYPE_P(method) != IS_STRING) {
						break;
					}

					ZVAL_DEREF(obj);
					if (Z_TYPE_P(obj) == IS_STRING) {
						if (check_flags & IS_CALLABLE_CHECK_SYNTAX_ONLY) {
							return 1;
						}

						if (!zend_is_callable_check_class(Z_STR_P(obj), get_scope(frame), frame, fcc, &strict_class, error)) {
							return 0;
						}

					} else if (Z_TYPE_P(obj) == IS_OBJECT) {

						fcc->calling_scope = Z_OBJCE_P(obj); /* TBFixed: what if it's overloaded? */

						fcc->object = Z_OBJ_P(obj);

						if (check_flags & IS_CALLABLE_CHECK_SYNTAX_ONLY) {
							fcc->called_scope = fcc->calling_scope;
							return 1;
						}
					} else {
						break;
					}

					callable = method;
					goto check_func;

				} while (0);
				if (zend_hash_num_elements(Z_ARRVAL_P(callable)) == 2) {
					if (!obj || (!Z_ISREF_P(obj)?
								(Z_TYPE_P(obj) != IS_STRING && Z_TYPE_P(obj) != IS_OBJECT) :
								(Z_TYPE_P(Z_REFVAL_P(obj)) != IS_STRING && Z_TYPE_P(Z_REFVAL_P(obj)) != IS_OBJECT))) {
						if (error) *error = estrdup("first array member is not a valid class name or object");
					} else {
						if (error) *error = estrdup("second array member is not a valid method");
					}
				} else {
					if (error) *error = estrdup("array must have exactly two members");
				}
			}
			return 0;
		case IS_OBJECT:
			if (Z_OBJ_HANDLER_P(callable, get_closure) && Z_OBJ_HANDLER_P(callable, get_closure)(Z_OBJ_P(callable), &fcc->calling_scope, &fcc->function_handler, &fcc->object, 1) == SUCCESS) {
				fcc->called_scope = fcc->calling_scope;
				if (fcc == &fcc_local) {
					zend_release_fcall_info_cache(fcc);
				}
				return 1;
			}
			if (error) *error = estrdup("no array or string given");
			return 0;
		case IS_REFERENCE:
			callable = Z_REFVAL_P(callable);
			goto again;
		default:
			if (error) *error = estrdup("no array or string given");
			return 0;
	}
}
/* }}} */


void EMSCRIPTEN_KEEPALIVE pib_init2(
                                  		zval *callable, zend_object *object, zend_execute_data *frame,
                                  		uint32_t check_flags, zend_fcall_info_cache *fcc, char **error
)
{
    zend_is_callable_at_frame2(callable, object, frame, check_flags, fcc, error);
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
