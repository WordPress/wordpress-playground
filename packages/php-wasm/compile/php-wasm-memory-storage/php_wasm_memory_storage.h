/* wasm_memory_storage extension for PHP */

#ifndef PHP_WASM_MEMORY_STORAGE_H
# define PHP_WASM_MEMORY_STORAGE_H

extern zend_module_entry wasm_memory_storage_module_entry;
# define phpext_wasm_memory_storage_ptr &wasm_memory_storage_module_entry

# define PHP_WASM_MEMORY_STORAGE_VERSION "0.0.1"

#endif	/* PHP_WASM_MEMORY_STORAGE_H */
