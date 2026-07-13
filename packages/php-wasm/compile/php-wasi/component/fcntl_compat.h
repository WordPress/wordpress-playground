#ifndef WP_PLAYGROUND_WASI_FCNTL_COMPAT_H
#define WP_PLAYGROUND_WASI_FCNTL_COMPAT_H

/* wasi-libc implements fcntl but hides the unsupported record-lock commands. */
#ifndef SQLITE_DEFAULT_UNIX_VFS
#define SQLITE_DEFAULT_UNIX_VFS "unix"
#endif
#ifndef F_RDLCK
#define F_RDLCK 0
#endif
#ifndef F_WRLCK
#define F_WRLCK 1
#endif
#ifndef F_UNLCK
#define F_UNLCK 2
#endif
#ifndef F_GETLK
#define F_GETLK 5
#endif
#ifndef F_SETLK
#define F_SETLK 6
#endif
#ifndef F_SETLKW
#define F_SETLKW 7
#endif

#endif
