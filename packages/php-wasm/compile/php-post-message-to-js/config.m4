dnl config.m4 for extension post_message_to_js

PHP_ARG_ENABLE(post_message_to_js, whether to enable post_message_to_js support,
[  --enable-post_message_to_js   Enable post_message_to_js support])

if test "$PHP_POST_MESSAGE_TO_JS" != "no"; then
  PHP_NEW_EXTENSION(post_message_to_js, post_message_to_js.c, $ext_shared)
fi 