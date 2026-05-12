#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include "ext/standard/info.h"
#include "vendor/sqlite/sqlite3.h"

#define sqlite3_extension_init sqlite_markdown_sqlite3_extension_init
#include "sqlite_markdown.c"
#undef sqlite3_extension_init

/*
 * sqlite3ext.h maps sqlite3_auto_extension to sqlite3_api->auto_extension for
 * loadable SQLite extensions. This PHP extension runs before SQLite passes an
 * API table to sqlite_markdown_sqlite3_extension_init(), so use the exported
 * libsqlite3 symbol directly.
 */
#undef sqlite3_auto_extension
#undef sqlite3_cancel_auto_extension
extern int sqlite3_auto_extension(void (*xEntryPoint)(void));
extern int sqlite3_cancel_auto_extension(void (*xEntryPoint)(void));

PHP_MINIT_FUNCTION(sqlite_markdown)
{
	sqlite3_auto_extension((void (*)(void)) sqlite_markdown_sqlite3_extension_init);
	return SUCCESS;
}

PHP_MSHUTDOWN_FUNCTION(sqlite_markdown)
{
	sqlite3_cancel_auto_extension(
		(void (*)(void)) sqlite_markdown_sqlite3_extension_init
	);
	return SUCCESS;
}

PHP_MINFO_FUNCTION(sqlite_markdown)
{
	php_info_print_table_start();
	php_info_print_table_header(2, "sqlite_markdown support", "enabled");
	php_info_print_table_end();
}

zend_module_entry sqlite_markdown_module_entry = {
	STANDARD_MODULE_HEADER,
	"sqlite_markdown",
	NULL,
	PHP_MINIT(sqlite_markdown),
	PHP_MSHUTDOWN(sqlite_markdown),
	NULL,
	NULL,
	PHP_MINFO(sqlite_markdown),
	"0.1.0",
	STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_SQLITE_MARKDOWN
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(sqlite_markdown)
#endif
