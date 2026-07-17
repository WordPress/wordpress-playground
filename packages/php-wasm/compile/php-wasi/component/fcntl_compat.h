#ifndef WP_PLAYGROUND_WASI_FCNTL_COMPAT_H
#define WP_PLAYGROUND_WASI_FCNTL_COMPAT_H

#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>

/*
 * WASI has no process user/group identity or process umask. PHP only uses
 * these calls to select POSIX permission bits and defaults for archive
 * extraction. Give every component the same deterministic synthetic identity
 * and an empty umask instead of disabling Phar's normal permission checks.
 */
#if defined(__wasi__)
#ifndef getuid
#define getuid() 1
#endif
#ifndef getgid
#define getgid() 1
#endif
#ifndef getgroups
#define getgroups(size, list) 0
#endif
#ifndef umask
#define umask(mask) ((mode_t) 0)
#endif
#endif

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

/*
 * Small C ABI between the patched SQLite unix VFS and the component-model
 * sqlite-wal-shm import implemented by fcntl_bridge.c. Keep generated WIT
 * binding types out of sqlite3.c so SQLite can be built before wit-bindgen is
 * run and so this header remains suitable for PHP's configure probes.
 */
#define WP_WASI_WAL_SHM_INVALID_HANDLE INT32_C(-1)

typedef int32_t wp_wasi_wal_shm_handle_t;

typedef struct wp_wasi_wal_shm_range {
    uint32_t region;
    uint32_t offset;
    uint32_t data_offset;
    uint32_t length;
} wp_wasi_wal_shm_range_t;

typedef struct wp_wasi_wal_shm_exchange_result {
    uint64_t epoch;
    uint64_t *generations;
    size_t generations_len;
    wp_wasi_wal_shm_range_t *updates;
    size_t updates_len;
    uint8_t *data;
    size_t data_len;
} wp_wasi_wal_shm_exchange_result_t;

int wp_wasi_wal_shm_open(int fd, wp_wasi_wal_shm_handle_t *handle_out);
int wp_wasi_wal_shm_reset(wp_wasi_wal_shm_handle_t handle);
int wp_wasi_wal_shm_current_epoch(
    wp_wasi_wal_shm_handle_t handle,
    uint64_t *epoch_out
);
int wp_wasi_wal_shm_exchange(
    wp_wasi_wal_shm_handle_t handle,
    uint32_t region_size,
    const uint64_t *known_generations,
    size_t known_generations_len,
    const wp_wasi_wal_shm_range_t *dirty_ranges,
    size_t dirty_ranges_len,
    const uint8_t *expected,
    const uint8_t *replacement,
    size_t data_len,
    int force_refresh,
    wp_wasi_wal_shm_exchange_result_t *result_out
);
void wp_wasi_wal_shm_exchange_result_free(
    wp_wasi_wal_shm_exchange_result_t *result
);
void wp_wasi_wal_shm_close(wp_wasi_wal_shm_handle_t handle);

#endif
