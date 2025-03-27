GENCCODE_ASSEMBLY_TYPE=
SO=so
SOBJ=so
A=a
LIBPREFIX=lib
LIB_EXT_ORDER=.74.2
COMPILE=emcc -I/root/lib/include -D_REENTRANT  -DU_HAVE_ELF_H=1 -DU_HAVE_STRTOD_L=1 -DU_HAVE_XLOCALE_H=1 -DU_HAVE_STRING_VIEW=1  -DU_ATTRIBUTE_DEPRECATED= -I/root/icu/source/common -I/root/lib/lib/icu/source/common -fPIC -std=c11 -Wall -pedantic -Wshadow -Wpointer-arith -Wmissing-prototypes -Wwrite-strings   -c
LIBFLAGS=-I/root/install/include -DPIC -fPIC
GENLIB=emcc -I/root/icu/source/common -I/root/lib/lib/icu/source/common -fPIC -std=c11 -Wall -pedantic -Wshadow -Wpointer-arith -Wmissing-prototypes -Wwrite-strings   -L/root/lib/lib -fPIC  -shared -Wl,-Bsymbolic
LDICUDTFLAGS=-nodefaultlibs -nostdlib
LD_SONAME=-Wl,-soname -Wl,
RPATH_FLAGS=
BIR_LDFLAGS=-Wl,-Bsymbolic
AR=emar
ARFLAGS=r
RANLIB=emranlib
INSTALL_CMD=/usr/bin/install -c
