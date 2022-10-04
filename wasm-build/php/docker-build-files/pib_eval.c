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
#include "zend_execute.h"
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

#define HT_POISONED_PTR ((HashTable *) (intptr_t) -1)
#define IS_CONSISTENT(a)
#define SET_INCONSISTENT(n)

ZEND_API void ZEND_FASTCALL rc_dtor_func2(zend_refcounted *p);
static zend_always_inline void i_zval_ptr_dtor2(zval *zval_ptr)
{
	if (Z_REFCOUNTED_P(zval_ptr)) {
		zend_refcounted *ref = Z_COUNTED_P(zval_ptr);
		if (!GC_DELREF(ref)) {
			rc_dtor_func2(ref);
		} else {
			gc_check_possible_root(ref);
		}
	}
}

ZEND_API void zval_ptr_dtor2(zval *zval_ptr) /* {{{ */
{
	i_zval_ptr_dtor2(zval_ptr);
}

#define ZVAL_PTR_DTOR2 zval_ptr_dtor2



static zend_always_inline void zend_string_release2(zend_string *s)
{
	if (!ZSTR_IS_INTERNED(s)) {
		if (GC_DELREF(s) == 0) {
			pefree(s, GC_FLAGS(s) & IS_STR_PERSISTENT);
		}
	}
}

static zend_never_inline void ZEND_FASTCALL _zend_hash_iterators_remove2(HashTable *ht)
{
	HashTableIterator *iter = EG(ht_iterators);
	HashTableIterator *end  = iter + EG(ht_iterators_used);

	while (iter != end) {
		if (iter->ht == ht) {
			iter->ht = HT_POISONED_PTR;
		}
		iter++;
	}
}

static zend_always_inline void zend_hash_iterators_remove2(HashTable *ht)
{
	if (UNEXPECTED(HT_HAS_ITERATORS(ht))) {
		_zend_hash_iterators_remove2(ht);
	}
}
extern ZEND_API const HashTable zend_empty_array2;
#define ZVAL_EMPTY_ARRAY2(z) do {						\
		zval *__z = (z);								\
		Z_ARR_P(__z) = (zend_array*)&zend_empty_array2;	\
		Z_TYPE_INFO_P(__z) = IS_ARRAY; \
	} while (0)

ZEND_API void ZEND_FASTCALL zend_hash_destroy2(HashTable *ht)
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
						ht->pDestructor(&p->val);
					} while (++p != end);
				} else {
					do {
						if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
							ht->pDestructor(&p->val);
						}
					} while (++p != end);
				}
			} else if (HT_IS_WITHOUT_HOLES(ht)) {
				do {
					ht->pDestructor(&p->val);
					if (EXPECTED(p->key)) {
						zend_string_release2(p->key);
					}
				} while (++p != end);
			} else {
				do {
					if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
						ht->pDestructor(&p->val);
						if (EXPECTED(p->key)) {
							zend_string_release2(p->key);
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
							zend_string_release2(p->key);
						}
					}
				} while (++p != end);
			}
		}
		zend_hash_iterators_remove2(ht);
	}
    else if (EXPECTED(HT_FLAGS(ht) & HASH_FLAG_UNINITIALIZED)) {
      return;
    }
	free(HT_GET_DATA_ADDR(ht));
}


ZEND_API void ZEND_FASTCALL zend_array_destroy2(HashTable *ht)
{
	Bucket *p, *end;

	IS_CONSISTENT(ht);
	HT_ASSERT(ht, GC_REFCOUNT(ht) <= 1);

	/* break possible cycles */
	GC_REMOVE_FROM_BUFFER(ht);
	GC_TYPE_INFO(ht) = GC_NULL /*???| (GC_WHITE << 16)*/;

	if (ht->nNumUsed) {
		/* In some rare cases destructors of regular arrays may be changed */
		if (UNEXPECTED(ht->pDestructor != ZVAL_PTR_DTOR2))
		{
			printf(" test=%s", "abc");
		}

		p = ht->arData;
		end = p + ht->nNumUsed;
		SET_INCONSISTENT(HT_IS_DESTROYING);

		if (HT_HAS_STATIC_KEYS_ONLY(ht)) {
			do {
				i_zval_ptr_dtor2(&p->val);
			} while (++p != end);
		} else if (HT_IS_WITHOUT_HOLES(ht)) {
			do {
				i_zval_ptr_dtor2(&p->val);
				if (EXPECTED(p->key)) {
					zend_string_release_ex(p->key, 0);
				}
			} while (++p != end);
		} else {
			do {
				if (EXPECTED(Z_TYPE(p->val) != IS_UNDEF)) {
					i_zval_ptr_dtor2(&p->val);
					if (EXPECTED(p->key)) {
						zend_string_release_ex(p->key, 0);
					}
				}
			} while (++p != end);
		}
	}
	else if (EXPECTED(HT_FLAGS(ht) & HASH_FLAG_UNINITIALIZED)) {
		goto free_ht;
	}
	SET_INCONSISTENT(HT_DESTROYED);
	efree(HT_GET_DATA_ADDR(ht));
free_ht:
	zend_hash_iterators_remove2(ht);
//	FREE_HashTable(ht);
}

# define zend_string_destroy2 _efree
static void ZEND_FASTCALL zend_reference_destroy2(zend_reference *ref);
static void ZEND_FASTCALL zend_empty_destroy2(zend_reference *ref);
static zend_always_inline void zval_ptr_dtor_nogc2(zval *zval_ptr);

typedef void (ZEND_FASTCALL *zend_rc_dtor_func_t2)(zend_refcounted *p);

ZEND_API void ZEND_FASTCALL zend_ast_destroy2(zend_ast *ast)
{
tail_call:
	if (!ast) {
		return;
	}

	if (EXPECTED(ast->kind >= ZEND_AST_VAR)) {
		uint32_t i, children = zend_ast_get_num_children(ast);

		for (i = 1; i < children; i++) {
			zend_ast_destroy2(ast->child[i]);
		}
		ast = ast->child[0];
		goto tail_call;
	} else if (EXPECTED(ast->kind == ZEND_AST_ZVAL)) {
		zval_ptr_dtor_nogc2(zend_ast_get_zval(ast));
	} else if (EXPECTED(zend_ast_is_list(ast))) {
		zend_ast_list *list = zend_ast_get_list(ast);
		if (list->children) {
			uint32_t i;

			for (i = 1; i < list->children; i++) {
				zend_ast_destroy2(list->child[i]);
			}
			ast = list->child[0];
			goto tail_call;
		}
	} else if (EXPECTED(ast->kind == ZEND_AST_CONSTANT)) {
		zend_string_release_ex(zend_ast_get_constant_name(ast), 0);
	} else if (EXPECTED(ast->kind >= ZEND_AST_FUNC_DECL)) {
		zend_ast_decl *decl = (zend_ast_decl *) ast;

		if (decl->name) {
		    zend_string_release_ex(decl->name, 0);
		}
		if (decl->doc_comment) {
			zend_string_release_ex(decl->doc_comment, 0);
		}
		zend_ast_destroy2(decl->child[0]);
		zend_ast_destroy2(decl->child[1]);
		zend_ast_destroy2(decl->child[2]);
		zend_ast_destroy2(decl->child[3]);
		ast = decl->child[4];
		goto tail_call;
	}
}


ZEND_API void ZEND_FASTCALL zend_ast_ref_destroy2(zend_ast_ref *ast)
{
	zend_ast_destroy2(GC_AST(ast));
	efree(ast);
}

zend_result zend_call_function2(zend_fcall_info *fci, zend_fcall_info_cache *fci_cache);

ZEND_API void zend_call_known_function2(
		zend_function *fn, zend_object *object, zend_class_entry *called_scope, zval *retval_ptr,
		uint32_t param_count, zval *params, HashTable *named_params)
{
	zval retval;
	zend_fcall_info fci;
	zend_fcall_info_cache fcic;

	ZEND_ASSERT(fn && "zend_function must be passed!");

	fci.size = sizeof(fci);
	fci.object = object;
	fci.retval = retval_ptr ? retval_ptr : &retval;
	fci.param_count = param_count;
	fci.params = params;
	fci.named_params = named_params;
	ZVAL_UNDEF(&fci.function_name); /* Unused */

	fcic.function_handler = fn;
	fcic.object = object;
	fcic.called_scope = called_scope;

	zend_result result = zend_call_function2(&fci, &fcic);
	if (UNEXPECTED(result == FAILURE)) {
		if (!EG(exception)) {
			zend_error_noreturn(E_CORE_ERROR, "Couldn't execute method %s%s%s",
				fn->common.scope ? ZSTR_VAL(fn->common.scope->name) : "",
				fn->common.scope ? "::" : "", ZSTR_VAL(fn->common.function_name));
		}
	}

	if (!retval_ptr) {
		zval_ptr_dtor2(&retval);
	}
}

/* Call the provided zend_function instance method on an object. */
static zend_always_inline void zend_call_known_instance_method2(
		zend_function *fn, zend_object *object, zval *retval_ptr,
		uint32_t param_count, zval *params)
{
	zend_call_known_function2(fn, object, object->ce, retval_ptr, param_count, params, NULL);
}

static zend_always_inline void zend_call_known_instance_method_with_0_params2(
		zend_function *fn, zend_object *object, zval *retval_ptr)
{
	zend_call_known_instance_method2(fn, object, retval_ptr, 0, NULL);
}


static inline zend_class_entry *i_get_exception_base2(zend_object *object) /* {{{ */
{
	return instanceof_function(object->ce, zend_ce_exception) ? zend_ce_exception : zend_ce_error;
}
void zend_exception_set_previous2(zend_object *exception, zend_object *add_previous) /* {{{ */
{
    zval *previous, *ancestor, *ex;
	zval  pv, zv, rv;
	zend_class_entry *base_ce;

	if (!exception || !add_previous) {
		return;
	}

	if (exception == add_previous || zend_is_unwind_exit(add_previous)) {
//		OBJ_RELEASE(add_previous);
		return;
	}

	ZEND_ASSERT(instanceof_function(add_previous->ce, zend_ce_throwable)
		&& "Previous execption must implement Throwable");

	ZVAL_OBJ(&pv, add_previous);
	ZVAL_OBJ(&zv, exception);
	ex = &zv;
	do {
		ancestor = zend_read_property_ex(i_get_exception_base2(add_previous), add_previous, ZSTR_KNOWN(ZEND_STR_PREVIOUS), 1, &rv);
		while (Z_TYPE_P(ancestor) == IS_OBJECT) {
			if (Z_OBJ_P(ancestor) == Z_OBJ_P(ex)) {
//				OBJ_RELEASE(add_previous);
				return;
			}
			ancestor = zend_read_property_ex(i_get_exception_base2(Z_OBJ_P(ancestor)), Z_OBJ_P(ancestor), ZSTR_KNOWN(ZEND_STR_PREVIOUS), 1, &rv);
		}
		base_ce = i_get_exception_base2(Z_OBJ_P(ex));
		previous = zend_read_property_ex(base_ce, Z_OBJ_P(ex), ZSTR_KNOWN(ZEND_STR_PREVIOUS), 1, &rv);
		if (Z_TYPE_P(previous) == IS_NULL) {
			zend_update_property_ex(base_ce, Z_OBJ_P(ex), ZSTR_KNOWN(ZEND_STR_PREVIOUS), &pv);
			GC_DELREF(add_previous);
			return;
		}
		ex = previous;
	} while (Z_OBJ_P(ex) != add_previous);
}
ZEND_API void zend_objects_destroy_object2(zend_object *object)
{
	zend_function *destructor = object->ce->destructor;

	if (destructor) {
		zend_object *old_exception;
		if (destructor->op_array.fn_flags & (ZEND_ACC_PRIVATE|ZEND_ACC_PROTECTED)) {
			if (destructor->op_array.fn_flags & ZEND_ACC_PRIVATE) {
				/* Ensure that if we're calling a private function, we're allowed to do so.
				 */
				if (EG(current_execute_data)) {
					zend_class_entry *scope = zend_get_executed_scope();

					if (object->ce != scope) {
						zend_throw_error(NULL,
							"Call to private %s::__destruct() from %s%s",
							ZSTR_VAL(object->ce->name),
							scope ? "scope " : "global scope",
							scope ? ZSTR_VAL(scope->name) : ""
						);
						return;
					}
				} else {
					zend_error(E_WARNING,
						"Call to private %s::__destruct() from global scope during shutdown ignored",
						ZSTR_VAL(object->ce->name));
					return;
				}
			} else {
				/* Ensure that if we're calling a protected function, we're allowed to do so.
				 */
				if (EG(current_execute_data)) {
					zend_class_entry *scope = zend_get_executed_scope();

					if (!zend_check_protected(zend_get_function_root_class(destructor), scope))
					{
						zend_throw_error(NULL,
							"Call to protected %s::__destruct() from %s%s",
							ZSTR_VAL(object->ce->name),
							scope ? "scope " : "global scope",
							scope ? ZSTR_VAL(scope->name) : ""
						);
						return;
					}
				} else {
					zend_error(E_WARNING,
						"Call to protected %s::__destruct() from global scope during shutdown ignored",
						ZSTR_VAL(object->ce->name));
					return;
				}
			}
		}

		GC_ADDREF(object);

		/* Make sure that destructors are protected from previously thrown exceptions.
		 * For example, if an exception was thrown in a function and when the function's
		 * local variable destruction results in a destructor being called.
		 */
		old_exception = NULL;
		if (EG(exception)) {
			if (EG(exception) == object) {
				zend_error_noreturn(E_CORE_ERROR, "Attempt to destruct pending exception");
			} else {
				old_exception = EG(exception);
				EG(exception) = NULL;
			}
		}

		zend_call_known_instance_method_with_0_params2(destructor, object, NULL);

		if (old_exception) {
			if (EG(exception)) {
				zend_exception_set_previous2(EG(exception), old_exception);
			} else {
				EG(exception) = old_exception;
			}
		}
//		OBJ_RELEASE(object);
	}
}

ZEND_API void ZEND_FASTCALL zend_objects_store_del2(zend_object *object) /* {{{ */
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

		if (object->handlers->dtor_obj != zend_objects_destroy_object2
				|| object->ce->destructor) {
            printf(" test=%s", "abc");
			GC_SET_REFCOUNT(object, 1);
			object->handlers->dtor_obj(object);
			GC_DELREF(object);
		}
	}

	if (GC_REFCOUNT(object) == 0) {
		uint32_t handle = object->handle;
		void *ptr;

		ZEND_ASSERT(EG(objects_store).object_buckets != NULL);
		ZEND_ASSERT(IS_OBJ_VALID(EG(objects_store).object_buckets[handle]));
		EG(objects_store).object_buckets[handle] = SET_OBJ_INVALID(object);
		if (!(OBJ_FLAGS(object) & IS_OBJ_FREE_CALLED)) {
			GC_ADD_FLAGS(object, IS_OBJ_FREE_CALLED);
			GC_SET_REFCOUNT(object, 1);
			object->handlers->free_obj(object);
		}
		ptr = ((char*)object) - object->handlers->offset;
		GC_REMOVE_FROM_BUFFER(object);
		efree(ptr);
		ZEND_OBJECTS_STORE_ADD_TO_FREE_LIST(handle);
	}
}

ZEND_API void ZEND_FASTCALL zend_list_free2(zend_resource *res)
{
	ZEND_ASSERT(GC_REFCOUNT(res) == 0);
	zend_hash_index_del(&EG(regular_list), res->handle);
}

static void ZEND_FASTCALL zend_reference_destroy2(zend_reference *ref)
{
	ZEND_ASSERT(!ZEND_REF_HAS_TYPE_SOURCES(ref));
	i_zval_ptr_dtor2(&ref->val);
	efree_size(ref, sizeof(zend_reference));
}

static const zend_rc_dtor_func_t2 zend_rc_dtor_func2[] = {
	/* IS_UNDEF        */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
	/* IS_NULL         */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
	/* IS_FALSE        */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
	/* IS_TRUE         */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
	/* IS_LONG         */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
	/* IS_DOUBLE       */ (zend_rc_dtor_func_t2)zend_empty_destroy2,
	/* IS_STRING       */ (zend_rc_dtor_func_t2)zend_string_destroy2,
	/* IS_ARRAY        */ (zend_rc_dtor_func_t2)zend_array_destroy2,
	/* IS_OBJECT       */ (zend_rc_dtor_func_t2)zend_objects_store_del2,
	/* IS_RESOURCE     */ (zend_rc_dtor_func_t2)zend_list_free2,
	/* IS_REFERENCE    */ (zend_rc_dtor_func_t2)zend_reference_destroy2,
	/* IS_CONSTANT_AST */ (zend_rc_dtor_func_t2)zend_ast_ref_destroy2
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

ZEND_API zend_bool zend_is_callable_at_frame2(
		zval *callable, zend_object *object, zend_execute_data *frame,
		uint32_t check_flags, zend_fcall_info_cache *fcc, char **error);

ZEND_API zend_bool zend_is_callable_ex2(zval *callable, zend_object *object, uint32_t check_flags, zend_string **callable_name, zend_fcall_info_cache *fcc, char **error) /* {{{ */
{
	/* Determine callability at the first parent user frame. */
	zend_execute_data *frame = EG(current_execute_data);
	while (frame && (!frame->func || !ZEND_USER_CODE(frame->func->type))) {
		frame = frame->prev_execute_data;
	}

	zend_bool ret = zend_is_callable_at_frame2(callable, object, frame, check_flags, fcc, error);
	if (callable_name) {
		*callable_name = zend_get_callable_name_ex(callable, object);
	}
	return ret;
}

static zend_always_inline void init_func_run_time_cache2_i(zend_op_array *op_array) /* {{{ */
{
	void **run_time_cache;

	ZEND_ASSERT(RUN_TIME_CACHE(op_array) == NULL);
	run_time_cache = zend_arena_alloc(&CG(arena), op_array->cache_size);
	memset(run_time_cache, 0, op_array->cache_size);
	ZEND_MAP_PTR_SET(op_array->run_time_cache, run_time_cache);
}
/* }}} */

static zend_never_inline void ZEND_FASTCALL init_func_run_time_cache2(zend_op_array *op_array) /* {{{ */
{
	init_func_run_time_cache2_i(op_array);
}

static zend_execute_data *start_fake_frame2(zend_execute_data *call, const zend_op *opline) {
	zend_execute_data *old_prev_execute_data = call->prev_execute_data;
	call->prev_execute_data = EG(current_execute_data);
	call->opline = opline;
	EG(current_execute_data) = call;
	return old_prev_execute_data;
}

static void end_fake_frame2(zend_execute_data *call, zend_execute_data *old_prev_execute_data) {
	zend_execute_data *prev_execute_data = call->prev_execute_data;
	EG(current_execute_data) = prev_execute_data;
	call->prev_execute_data = old_prev_execute_data;
	if (UNEXPECTED(EG(exception)) && ZEND_USER_CODE(prev_execute_data->func->common.type)) {
		zend_rethrow_exception(prev_execute_data);
	}
}


static zend_string *try_parse_string2(const char *str, size_t len, char quote) {
	if (len == 0) {
		return ZSTR_EMPTY_ALLOC();
	}

	for (size_t i = 0; i < len; i++) {
		if (str[i] == '\\' || str[i] == quote) {
			return NULL;
		}
	}
	return zend_string_init(str, len, 0);
}


static zend_always_inline uint32_t zval_gc_flags2(uint32_t gc_type_info) {
	return (gc_type_info >> GC_FLAGS_SHIFT) & (GC_FLAGS_MASK >> GC_FLAGS_SHIFT);
}

ZEND_API zend_result zend_get_default_from_internal_arg_info2(
		zval *default_value_zval, zend_internal_arg_info *arg_info)
{
	const char *default_value = arg_info->default_value;
	if (!default_value) {
		return FAILURE;
	}

	/* Avoid going through the full AST machinery for some simple and common cases. */
	size_t default_value_len = strlen(default_value);
	zend_ulong lval;
	if (default_value_len == sizeof("null")-1
			&& !memcmp(default_value, "null", sizeof("null")-1)) {
		ZVAL_NULL(default_value_zval);
		return SUCCESS;
	} else if (default_value_len == sizeof("true")-1
			&& !memcmp(default_value, "true", sizeof("true")-1)) {
		ZVAL_TRUE(default_value_zval);
		return SUCCESS;
	} else if (default_value_len == sizeof("false")-1
			&& !memcmp(default_value, "false", sizeof("false")-1)) {
		ZVAL_FALSE(default_value_zval);
		return SUCCESS;
	} else if (default_value_len >= 2
			&& (default_value[0] == '\'' || default_value[0] == '"')
			&& default_value[default_value_len - 1] == default_value[0]) {
		zend_string *str = try_parse_string2(
			default_value + 1, default_value_len - 2, default_value[0]);
		if (str) {
			ZVAL_STR(default_value_zval, str);
			return SUCCESS;
		}
	} else if (default_value_len == sizeof("[]")-1
			&& !memcmp(default_value, "[]", sizeof("[]")-1)) {
		ZVAL_EMPTY_ARRAY2(default_value_zval);

		return SUCCESS;
	} else if (ZEND_HANDLE_NUMERIC_STR(default_value, default_value_len, lval)) {
		ZVAL_LONG(default_value_zval, lval);
		return SUCCESS;
	}

#if 0
	fprintf(stderr, "Evaluating %s via AST\n", default_value);
#endif
	return SUCCESS; //get_default_via_ast(default_value_zval, default_value);
}

static zend_result zend_ast_add_array_element(zval *result, zval *offset, zval *expr)
{
	switch (Z_TYPE_P(offset)) {
		case IS_UNDEF:
			if (!zend_hash_next_index_insert(Z_ARRVAL_P(result), expr)) {
				zend_throw_error(NULL,
					"Cannot add element to the array as the next element is already occupied");
				return FAILURE;
			}
			break;
		case IS_STRING:
			zend_symtable_update(Z_ARRVAL_P(result), Z_STR_P(offset), expr);
			zval_ptr_dtor_str(offset);
			break;
		case IS_NULL:
			zend_symtable_update(Z_ARRVAL_P(result), ZSTR_EMPTY_ALLOC(), expr);
			break;
		case IS_LONG:
			zend_hash_index_update(Z_ARRVAL_P(result), Z_LVAL_P(offset), expr);
			break;
		case IS_FALSE:
			zend_hash_index_update(Z_ARRVAL_P(result), 0, expr);
			break;
		case IS_TRUE:
			zend_hash_index_update(Z_ARRVAL_P(result), 1, expr);
			break;
		case IS_DOUBLE:
			zend_hash_index_update(Z_ARRVAL_P(result), zend_dval_to_lval(Z_DVAL_P(offset)), expr);
			break;
		case IS_RESOURCE:
			zend_error(E_WARNING, "Resource ID#%d used as offset, casting to integer (%d)", Z_RES_HANDLE_P(offset), Z_RES_HANDLE_P(offset));
			zend_hash_index_update(Z_ARRVAL_P(result), Z_RES_HANDLE_P(offset), expr);
			break;
		default:
			zend_type_error("Illegal offset type");
			return FAILURE;
 	}
	return SUCCESS;
}

static zend_result zend_ast_add_unpacked_element(zval *result, zval *expr) {
	if (EXPECTED(Z_TYPE_P(expr) == IS_ARRAY)) {
		HashTable *ht = Z_ARRVAL_P(expr);
		zval *val;
		zend_string *key;

		ZEND_HASH_FOREACH_STR_KEY_VAL(ht, key, val) {
			if (key) {
				zend_throw_error(NULL, "Cannot unpack array with string keys");
				return FAILURE;
			} else {
				if (!zend_hash_next_index_insert(Z_ARRVAL_P(result), val)) {
					zend_throw_error(NULL,
						"Cannot add element to the array as the next element is already occupied");
					return FAILURE;
				}
				Z_TRY_ADDREF_P(val);
			}
		} ZEND_HASH_FOREACH_END();
		return SUCCESS;
	}

	/* Objects or references cannot occur in a constant expression. */
	zend_throw_error(NULL, "Only arrays and Traversables can be unpacked");
	return FAILURE;
}


ZEND_API zval* ZEND_FASTCALL zend_hash_add_empty_element2(HashTable *ht, zend_string *key)
{
	zval dummy;

	ZVAL_NULL(&dummy);
	return zend_hash_add(ht, key, &dummy);
}

ZEND_API extern zend_string  *zend_empty_string2;
ZEND_API extern zend_string  *zend_one_char_string2[256];
ZEND_API extern zend_string **zend_known_strings2;
#define ZSTR_EMPTY_ALLOC2() zend_empty_string2
#define ZVAL_EMPTY_STRING2(z) do {				\
    zend_empty_string2;		\
} while (0)

ZEND_API zend_result ZEND_FASTCALL zend_ast_evaluate2(zval *result, zend_ast *ast, zend_class_entry *scope)
{
	return SUCCESS;
}

ZEND_API zend_result ZEND_FASTCALL zend_handle_undef_args2(zend_execute_data *call) {
	zend_function *fbc = call->func;
	if (fbc->type == ZEND_USER_FUNCTION) {
		zend_op_array *op_array = &fbc->op_array;
		uint32_t num_args = ZEND_CALL_NUM_ARGS(call);
		for (uint32_t i = 0; i < num_args; i++) {
			zval *arg = ZEND_CALL_VAR_NUM(call, i);
			if (!Z_ISUNDEF_P(arg)) {
				continue;
			}

			zend_op *opline = &op_array->opcodes[i];
			if (EXPECTED(opline->opcode == ZEND_RECV_INIT)) {
				zval *default_value = RT_CONSTANT(opline, opline->op2);
				if (Z_OPT_TYPE_P(default_value) == IS_CONSTANT_AST) {
					if (UNEXPECTED(!RUN_TIME_CACHE(op_array))) {
						init_func_run_time_cache2(op_array);
					}

					void *run_time_cache = RUN_TIME_CACHE(op_array);
					zval *cache_val =
						(zval *) ((char *) run_time_cache + Z_CACHE_SLOT_P(default_value));

					if (Z_TYPE_P(cache_val) != IS_UNDEF) {
						/* We keep in cache only not refcounted values */
						ZVAL_COPY_VALUE(arg, cache_val);
					} else {
						/* Update constant inside a temporary zval, to make sure the CONSTANT_AST
						 * value is not accessible through back traces. */
						zval tmp;
						ZVAL_COPY(&tmp, default_value);
						zend_execute_data *old = start_fake_frame2(call, opline);
						zend_result ret; // = zval_update_constant_ex2(&tmp, fbc->op_array.scope);
						end_fake_frame2(call, old);
						if (UNEXPECTED(ret == FAILURE)) {
							zval_ptr_dtor_nogc2(&tmp);
							return FAILURE;
						}
						ZVAL_COPY_VALUE(arg, &tmp);
						if (!Z_REFCOUNTED(tmp)) {
							ZVAL_COPY_VALUE(cache_val, &tmp);
						}
					}
				} else {
					ZVAL_COPY(arg, default_value);
				}
			} else {
				ZEND_ASSERT(opline->opcode == ZEND_RECV);
				zend_execute_data *old = start_fake_frame2(call, opline);
				zend_argument_error(zend_ce_argument_count_error, i + 1, "not passed");
				end_fake_frame2(call, old);
				return FAILURE;
			}
		}

		return SUCCESS;
	} else {
		if (fbc->common.fn_flags & ZEND_ACC_USER_ARG_INFO) {
			/* Magic function, let it deal with it. */
			return SUCCESS;
		}

		uint32_t num_args = ZEND_CALL_NUM_ARGS(call);
		for (uint32_t i = 0; i < num_args; i++) {
			zval *arg = ZEND_CALL_VAR_NUM(call, i);
			if (!Z_ISUNDEF_P(arg)) {
				continue;
			}

			zend_internal_arg_info *arg_info = &fbc->internal_function.arg_info[i];
			if (i < fbc->common.required_num_args) {
				zend_execute_data *old = start_fake_frame2(call, NULL);
				zend_argument_error(zend_ce_argument_count_error, i + 1, "not passed");
				end_fake_frame2(call, old);
				return FAILURE;
			}

			zval default_value;
			if (zend_get_default_from_internal_arg_info2(&default_value, arg_info) == FAILURE) {
				zend_execute_data *old = start_fake_frame2(call, NULL);
				zend_argument_error(zend_ce_argument_count_error, i + 1,
					"must be passed explicitly, because the default value is not known");
				end_fake_frame2(call, old);
				return FAILURE;
			}

			if (Z_TYPE(default_value) == IS_CONSTANT_AST) {
				zend_execute_data *old = start_fake_frame2(call, NULL);
				zend_result ret; // = zval_update_constant_ex2(&default_value, fbc->common.scope);
				end_fake_frame2(call, old);
				if (ret == FAILURE) {
					return FAILURE;
				}
			}

			ZVAL_COPY_VALUE(arg, &default_value);
			if (ZEND_ARG_SEND_MODE(arg_info) & ZEND_SEND_BY_REF) {
				ZVAL_NEW_REF(arg, arg);
			}
		}
	}

	return SUCCESS;
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

		if( !zend_is_callable_ex2(&fci->function_name, fci->object, IS_CALLABLE_CHECK_SILENT, NULL, fci_cache, &error))
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
		if ( (zend_handle_undef_args2(call) == FAILURE)) {
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

	if (zend_hash_add_empty_element2(EG(in_autoload), lc_name) == NULL) {
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
}
