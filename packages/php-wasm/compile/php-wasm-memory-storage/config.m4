dnl config.m4 for extension wasm_memory_storage

dnl Comments in this file start with the string 'dnl'.
dnl Remove where necessary.

dnl If your extension references something external, use 'with':

dnl PHP_ARG_WITH([wasm_memory_storage],
dnl   [for wasm_memory_storage support],
dnl   [AS_HELP_STRING([--with-wasm_memory_storage],
dnl     [Include wasm_memory_storage support])])

dnl Otherwise use 'enable':

PHP_ARG_ENABLE([wasm_memory_storage],
  [whether to enable wasm_memory_storage support],
  [AS_HELP_STRING([--enable-wasm_memory_storage],
    [Enable wasm_memory_storage support])],
  [no])

if test "$PHP_WASM_MEMORY_STORAGE" != "no"; then
  dnl Write more examples of tests here...

  dnl Remove this code block if the library does not support pkg-config.
  dnl PKG_CHECK_MODULES([LIBFOO], [foo])
  dnl PHP_EVAL_INCLINE($LIBFOO_CFLAGS)
  dnl PHP_EVAL_LIBLINE($LIBFOO_LIBS, WASM_MEMORY_STORAGE_SHARED_LIBADD)

  dnl If you need to check for a particular library version using PKG_CHECK_MODULES,
  dnl you can use comparison operators. For example:
  dnl PKG_CHECK_MODULES([LIBFOO], [foo >= 1.2.3])
  dnl PKG_CHECK_MODULES([LIBFOO], [foo < 3.4])
  dnl PKG_CHECK_MODULES([LIBFOO], [foo = 1.2.3])

  dnl Remove this code block if the library supports pkg-config.
  dnl --with-wasm_memory_storage -> check with-path
  dnl SEARCH_PATH="/usr/local /usr"     # you might want to change this
  dnl SEARCH_FOR="/include/wasm_memory_storage.h"  # you most likely want to change this
  dnl if test -r $PHP_WASM_MEMORY_STORAGE/$SEARCH_FOR; then # path given as parameter
  dnl   WASM_MEMORY_STORAGE_DIR=$PHP_WASM_MEMORY_STORAGE
  dnl else # search default path list
  dnl   AC_MSG_CHECKING([for wasm_memory_storage files in default path])
  dnl   for i in $SEARCH_PATH ; do
  dnl     if test -r $i/$SEARCH_FOR; then
  dnl       WASM_MEMORY_STORAGE_DIR=$i
  dnl       AC_MSG_RESULT(found in $i)
  dnl     fi
  dnl   done
  dnl fi
  dnl
  dnl if test -z "$WASM_MEMORY_STORAGE_DIR"; then
  dnl   AC_MSG_RESULT([not found])
  dnl   AC_MSG_ERROR([Please reinstall the wasm_memory_storage distribution])
  dnl fi

  dnl Remove this code block if the library supports pkg-config.
  dnl --with-wasm_memory_storage -> add include path
  dnl PHP_ADD_INCLUDE($WASM_MEMORY_STORAGE_DIR/include)

  dnl Remove this code block if the library supports pkg-config.
  dnl --with-wasm_memory_storage -> check for lib and symbol presence
  dnl LIBNAME=WASM_MEMORY_STORAGE # you may want to change this
  dnl LIBSYMBOL=WASM_MEMORY_STORAGE # you most likely want to change this

  dnl If you need to check for a particular library function (e.g. a conditional
  dnl or version-dependent feature) and you are using pkg-config:
  dnl PHP_CHECK_LIBRARY($LIBNAME, $LIBSYMBOL,
  dnl [
  dnl   AC_DEFINE(HAVE_WASM_MEMORY_STORAGE_FEATURE, 1, [ ])
  dnl ],[
  dnl   AC_MSG_ERROR([FEATURE not supported by your wasm_memory_storage library.])
  dnl ], [
  dnl   $LIBFOO_LIBS
  dnl ])

  dnl If you need to check for a particular library function (e.g. a conditional
  dnl or version-dependent feature) and you are not using pkg-config:
  dnl PHP_CHECK_LIBRARY($LIBNAME, $LIBSYMBOL,
  dnl [
  dnl   PHP_ADD_LIBRARY_WITH_PATH($LIBNAME, $WASM_MEMORY_STORAGE_DIR/$PHP_LIBDIR, WASM_MEMORY_STORAGE_SHARED_LIBADD)
  dnl   AC_DEFINE(HAVE_WASM_MEMORY_STORAGE_FEATURE, 1, [ ])
  dnl ],[
  dnl   AC_MSG_ERROR([FEATURE not supported by your wasm_memory_storage library.])
  dnl ],[
  dnl   -L$WASM_MEMORY_STORAGE_DIR/$PHP_LIBDIR -lm
  dnl ])
  dnl
  dnl PHP_SUBST(WASM_MEMORY_STORAGE_SHARED_LIBADD)

  dnl In case of no dependencies
  AC_DEFINE(HAVE_WASM_MEMORY_STORAGE, 1, [ Have wasm_memory_storage support ])

  PHP_NEW_EXTENSION(wasm_memory_storage, wasm_memory_storage.c, $ext_shared)
fi
