/* wasm_memory_storage extension for PHP */

#ifndef PHP_WASM_SAPI_OVERRIDE_H
# define PHP_WASM_SAPI_OVERRIDE_H

extern zend_module_entry wasm_sapi_override_module_entry;
# define phpext_wasm_sapi_override_ptr &wasm_sapi_override_module_entry

# define PHP_WASM_SAPI_OVERRIDE_MODULE_VERSION "0.0.1"

#endif	/* PHP_WASM_SAPI_OVERRIDE_H */
