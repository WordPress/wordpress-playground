PHP_ARG_ENABLE([playground_hello], [whether to enable playground_hello],
	[AS_HELP_STRING([--enable-playground_hello], [Enable playground_hello])],
	[no])

if test "$PHP_PLAYGROUND_HELLO" != "no"; then
	PHP_NEW_EXTENSION([playground_hello], [playground_hello.c], [$ext_shared])
fi
