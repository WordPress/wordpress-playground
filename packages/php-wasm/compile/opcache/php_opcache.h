/**
 * This file is glue code for the opcache extension. It is used to build
 * the opcache extension as a static extension.
 */

#ifndef PHP_OPCACHE_H
#define PHP_OPCACHE_H

extern zend_module_entry opcache_module_entry;
#define phpext_opcache_ptr &opcache_module_entry

#endif /* PHP_OPCACHE_H */
