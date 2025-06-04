#include "php.h"
#include "post_message_to_js.h"
#include "ext/standard/info.h"
#include <emscripten.h>

/**
 * Provided by php_wasm.c:
 */
extern size_t js_module_onMessage(const char *data, char **response_buffer);

/* {{{ PHP_FUNCTION */
PHP_FUNCTION(post_message_to_js)
{
    char *data;
    int data_len;

    if (zend_parse_parameters(ZEND_NUM_ARGS(), "s", &data, &data_len) == FAILURE) {
        return;
    }

    char *response;
    size_t response_len = js_module_onMessage(data, &response);
    if (response_len != -1) {
        zend_string *return_string = zend_string_init(response, response_len, 0);
        free(response);
        RETURN_NEW_STR(return_string);
    } else {
        RETURN_NULL();
    }
}
/* }}} */

/* {{{ PHP_MINFO_FUNCTION */
PHP_MINFO_FUNCTION(post_message_to_js)
{
    php_info_print_table_start();
    php_info_print_table_row(2, "post_message_to_js support", "enabled");
    php_info_print_table_end();
}
/* }}} */

/* {{{ post_message_to_js_functions[] */
const zend_function_entry post_message_to_js_functions[] = {
    PHP_FE(post_message_to_js, arginfo_post_message_to_js)
    PHP_FE_END
};
/* }}} */

/* {{{ post_message_to_js_module_entry */
zend_module_entry post_message_to_js_module_entry = {
    STANDARD_MODULE_HEADER,
    "post_message_to_js",                /* Extension name */
    post_message_to_js_functions,        /* zend_function_entry */
    NULL,                               /* PHP_MINIT - Module initialization */
    NULL,                               /* PHP_MSHUTDOWN - Module shutdown */
    NULL,                               /* PHP_RINIT - Request initialization */
    NULL,                               /* PHP_RSHUTDOWN - Request shutdown */
    PHP_MINFO(post_message_to_js),      /* PHP_MINFO - Module info */
    PHP_POST_MESSAGE_TO_JS_VERSION,     /* Version */
    STANDARD_MODULE_PROPERTIES
};
/* }}} */

#ifdef COMPILE_DL_POST_MESSAGE_TO_JS
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(post_message_to_js)
#endif 