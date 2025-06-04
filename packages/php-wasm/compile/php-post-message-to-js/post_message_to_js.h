#ifndef PHP_POST_MESSAGE_TO_JS_H
#define PHP_POST_MESSAGE_TO_JS_H

extern zend_module_entry post_message_to_js_module_entry;
#define phpext_post_message_to_js_ptr &post_message_to_js_module_entry

ZEND_BEGIN_ARG_INFO_EX(arginfo_post_message_to_js, 0, 1, 1)
ZEND_ARG_INFO(0, data)
ZEND_END_ARG_INFO()

PHP_FUNCTION(post_message_to_js);

#define PHP_POST_MESSAGE_TO_JS_VERSION "1.0.0"

#endif // PHP_POST_MESSAGE_TO_JS_H 