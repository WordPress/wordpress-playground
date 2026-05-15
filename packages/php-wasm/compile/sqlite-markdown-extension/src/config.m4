PHP_ARG_ENABLE(
	[sqlite_markdown],
	[whether to enable sqlite_markdown],
	[AS_HELP_STRING([--enable-sqlite-markdown], [Enable sqlite-markdown virtual tables])],
	[no]
)

if test "$PHP_SQLITE_MARKDOWN" != "no"; then
	PHP_ADD_INCLUDE($srcdir/vendor/sqlite)
	PHP_NEW_EXTENSION([sqlite_markdown], [sqlite_markdown_php.c], [$ext_shared])
fi
