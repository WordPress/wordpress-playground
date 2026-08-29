#include "bridge.h"
#include "fcntl_compat.h"

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>
#include <wasi/wasip2.h>

typedef wordpress_playground_filesystem_locks_filesystem_locks_byte_range_t lock_range_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_error_t lock_error_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_kind_t lock_kind_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_mode_t lock_mode_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_state_t lock_state_t;
typedef wordpress_playground_filesystem_locks_sqlite_wal_shm_borrow_wal_shm_t wal_shm_borrow_t;
typedef wordpress_playground_filesystem_locks_sqlite_wal_shm_exchange_result_t wal_shm_exchange_result_t;
typedef wordpress_playground_filesystem_locks_sqlite_wal_shm_list_shm_range_t wal_shm_range_list_t;
typedef wordpress_playground_filesystem_locks_sqlite_wal_shm_own_wal_shm_t wal_shm_own_t;
typedef wordpress_playground_filesystem_locks_sqlite_wal_shm_shm_error_t shm_error_t;
typedef wordpress_playground_filesystem_locks_sqlite_wal_shm_shm_range_t shm_range_t;

_Static_assert(sizeof(wp_wasi_wal_shm_range_t) == sizeof(shm_range_t),
    "SQLite SHM range ABI must match wit-bindgen");
_Static_assert(offsetof(wp_wasi_wal_shm_range_t, region) == offsetof(shm_range_t, region),
    "SQLite SHM range region offset must match wit-bindgen");
_Static_assert(offsetof(wp_wasi_wal_shm_range_t, offset) == offsetof(shm_range_t, offset),
    "SQLite SHM range offset must match wit-bindgen");
_Static_assert(offsetof(wp_wasi_wal_shm_range_t, data_offset) == offsetof(shm_range_t, data_offset),
    "SQLite SHM range data offset must match wit-bindgen");
_Static_assert(offsetof(wp_wasi_wal_shm_range_t, length) == offsetof(shm_range_t, length),
    "SQLite SHM range length must match wit-bindgen");

/* Private ABI from wasi-sdk 33's pinned wasi-libc e2507dd. */
typedef struct descriptor_vtable {
    uintptr_t free_slot;
    uintptr_t get_read_stream_slot;
    uintptr_t get_write_stream_slot;
    uintptr_t set_blocking_slot;
    uintptr_t fstat_slot;
    int (*get_file)(void *, filesystem_borrow_descriptor_t *);
    uintptr_t seek_slot;
    uintptr_t close_streams_slot;
    int (*fcntl_getfl)(void *);
    int (*fcntl_setfl)(void *, int);
} descriptor_vtable;

typedef struct descriptor_table_entry {
    void *data;
    descriptor_vtable *vtable;
} descriptor_table_entry;

extern descriptor_table_entry *descriptor_table_get_ref(int fd);

static int lock_error(lock_error_t error) {
    switch (error.tag) {
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_WOULD_BLOCK:
            errno = EAGAIN;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_BAD_DESCRIPTOR:
            errno = EBADF;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_INTERRUPTED:
            errno = EINTR;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_INVALID_RANGE:
            errno = EINVAL;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_OVERFLOW:
            errno = EOVERFLOW;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_DEADLOCK:
            errno = EDEADLK;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_UNSUPPORTED:
            errno = ENOTSUP;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_PERMISSION_DENIED:
            errno = EACCES;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_ERROR_RESOURCE_EXHAUSTED:
            errno = ENOLCK;
            break;
        default:
            errno = EIO;
            break;
    }
    return -1;
}

static int shm_error(shm_error_t error) {
    switch (error.tag) {
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_SQLITE_WAL_SHM_SHM_ERROR_BAD_DESCRIPTOR:
            errno = EBADF;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_SQLITE_WAL_SHM_SHM_ERROR_INVALID_ARGUMENT:
            errno = EINVAL;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_SQLITE_WAL_SHM_SHM_ERROR_CONFLICT:
            errno = EBUSY;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_SQLITE_WAL_SHM_SHM_ERROR_RESOURCE_EXHAUSTED:
            errno = ENOMEM;
            break;
        case WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_SQLITE_WAL_SHM_SHM_ERROR_IO_ERROR:
            if (error.val.io_error.is_some && error.val.io_error.val != 0) {
                errno = (int)error.val.io_error.val;
            } else {
                errno = EIO;
            }
            break;
        default:
            errno = EIO;
            break;
    }
    return -1;
}

static int descriptor_for_fd(
    int fd,
    descriptor_table_entry **entry_out,
    wasi_filesystem_types_borrow_descriptor_t *descriptor_out
) {
    descriptor_table_entry *entry = descriptor_table_get_ref(fd);
    if (entry == NULL) {
        return -1;
    }
    if (entry->vtable == NULL || entry->vtable->get_file == NULL) {
        errno = EBADF;
        return -1;
    }
    filesystem_borrow_descriptor_t descriptor;
    if (entry->vtable->get_file(entry->data, &descriptor) < 0) {
        return -1;
    }
    *entry_out = entry;
    descriptor_out->__handle = descriptor.__handle;
    return 0;
}

static wal_shm_own_t wal_shm_own(wp_wasi_wal_shm_handle_t handle) {
    wal_shm_own_t resource = { .__handle = handle };
    return resource;
}

static wal_shm_borrow_t wal_shm_borrow(wp_wasi_wal_shm_handle_t handle) {
    wal_shm_borrow_t resource = { .__handle = handle };
    return resource;
}

int wp_wasi_wal_shm_open(int fd, wp_wasi_wal_shm_handle_t *handle_out) {
    descriptor_table_entry *entry;
    wasi_filesystem_types_borrow_descriptor_t descriptor;
    wal_shm_own_t resource;
    shm_error_t error;

    if (handle_out == NULL) {
        errno = EINVAL;
        return -1;
    }
    *handle_out = WP_WASI_WAL_SHM_INVALID_HANDLE;
    if (descriptor_for_fd(fd, &entry, &descriptor) < 0) {
        return -1;
    }
    (void)entry;
    if (!wordpress_playground_filesystem_locks_sqlite_wal_shm_open(
            descriptor, &resource, &error)) {
        return shm_error(error);
    }
    *handle_out = resource.__handle;
    return 0;
}

int wp_wasi_wal_shm_reset(wp_wasi_wal_shm_handle_t handle) {
    shm_error_t error;
    if (handle == WP_WASI_WAL_SHM_INVALID_HANDLE) {
        errno = EBADF;
        return -1;
    }
    if (!wordpress_playground_filesystem_locks_sqlite_wal_shm_reset(
            wal_shm_borrow(handle), &error)) {
        return shm_error(error);
    }
    return 0;
}

int wp_wasi_wal_shm_current_epoch(
    wp_wasi_wal_shm_handle_t handle,
    uint64_t *epoch_out
) {
    shm_error_t error;
    if (handle == WP_WASI_WAL_SHM_INVALID_HANDLE) {
        errno = EBADF;
        return -1;
    }
    if (epoch_out == NULL) {
        errno = EINVAL;
        return -1;
    }
    *epoch_out = 0;
    if (!wordpress_playground_filesystem_locks_sqlite_wal_shm_current_epoch(
            wal_shm_borrow(handle), epoch_out, &error)) {
        return shm_error(error);
    }
    return 0;
}

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
) {
    bridge_list_u64_t generations = {
        .ptr = (uint64_t *)known_generations,
        .len = known_generations_len,
    };
    wal_shm_range_list_t ranges = {
        .ptr = (shm_range_t *)dirty_ranges,
        .len = dirty_ranges_len,
    };
    bridge_list_u8_t expected_bytes = {
        .ptr = (uint8_t *)expected,
        .len = data_len,
    };
    bridge_list_u8_t replacement_bytes = {
        .ptr = (uint8_t *)replacement,
        .len = data_len,
    };
    wal_shm_exchange_result_t result;
    shm_error_t error;

    if (result_out == NULL
        || handle == WP_WASI_WAL_SHM_INVALID_HANDLE
        || (known_generations_len != 0 && known_generations == NULL)
        || (dirty_ranges_len != 0 && dirty_ranges == NULL)
        || (data_len != 0 && (expected == NULL || replacement == NULL))) {
        errno = EINVAL;
        return -1;
    }
    memset(result_out, 0, sizeof(*result_out));
    if (!wordpress_playground_filesystem_locks_sqlite_wal_shm_exchange(
            wal_shm_borrow(handle), region_size, &generations, &ranges,
            &expected_bytes, &replacement_bytes, force_refresh != 0,
            &result, &error)) {
        return shm_error(error);
    }

    result_out->epoch = result.epoch;
    result_out->generations = result.generations.ptr;
    result_out->generations_len = result.generations.len;
    result_out->updates = (wp_wasi_wal_shm_range_t *)result.updates.ptr;
    result_out->updates_len = result.updates.len;
    result_out->data = result.data.ptr;
    result_out->data_len = result.data.len;
    return 0;
}

void wp_wasi_wal_shm_exchange_result_free(
    wp_wasi_wal_shm_exchange_result_t *result
) {
    wal_shm_exchange_result_t generated;
    if (result == NULL) {
        return;
    }
    generated.epoch = result->epoch;
    generated.generations.ptr = result->generations;
    generated.generations.len = result->generations_len;
    generated.updates.ptr = (shm_range_t *)result->updates;
    generated.updates.len = result->updates_len;
    generated.data.ptr = result->data;
    generated.data.len = result->data_len;

    /*
     * The pinned wit-bindgen C generator omits this final list field from the
     * generated record destructor. Free it explicitly, then clear it so this
     * remains safe when a future generator starts freeing all record fields.
     */
    bridge_list_u8_free(&generated.data);
    generated.data.ptr = NULL;
    generated.data.len = 0;
    wordpress_playground_filesystem_locks_sqlite_wal_shm_exchange_result_free(
        &generated
    );
    memset(result, 0, sizeof(*result));
}

void wp_wasi_wal_shm_close(wp_wasi_wal_shm_handle_t handle) {
    if (handle != WP_WASI_WAL_SHM_INVALID_HANDLE) {
        wordpress_playground_filesystem_locks_sqlite_wal_shm_wal_shm_drop_own(
            wal_shm_own(handle)
        );
    }
}

static int range_from_flock(int fd, const struct flock *lock, lock_range_t *range) {
    __int128 base;
    switch (lock->l_whence) {
        case SEEK_SET:
            base = 0;
            break;
        case SEEK_CUR: {
            off_t current = lseek(fd, 0, SEEK_CUR);
            if (current < 0) {
                return -1;
            }
            base = current;
            break;
        }
        case SEEK_END: {
            struct stat metadata;
            if (fstat(fd, &metadata) < 0) {
                return -1;
            }
            base = metadata.st_size;
            break;
        }
        default:
            errno = EINVAL;
            return -1;
    }

    __int128 start = base + (__int128)lock->l_start;
    __int128 length = (__int128)lock->l_len;
    if (length < 0) {
        start += length;
        length = -length;
    }
    if (start < 0 || start > UINT64_MAX || length > UINT64_MAX) {
        errno = EOVERFLOW;
        return -1;
    }
    range->start = (uint64_t)start;
    range->length.is_some = length != 0;
    range->length.val = (uint64_t)length;
    return 0;
}

static lock_kind_t kind_from_flock(short type) {
    return type == F_RDLCK
        ? WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_KIND_SHARED
        : WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_KIND_EXCLUSIVE;
}

static int fcntl_lock(int fd, int command, struct flock *lock) {
    if (lock == NULL || (lock->l_type != F_RDLCK && lock->l_type != F_WRLCK && lock->l_type != F_UNLCK)) {
        errno = EINVAL;
        return -1;
    }
    descriptor_table_entry *entry;
    wasi_filesystem_types_borrow_descriptor_t descriptor;
    if (descriptor_for_fd(fd, &entry, &descriptor) < 0) {
        return -1;
    }
    (void)entry;

    lock_range_t range;
    if (range_from_flock(fd, lock, &range) < 0) {
        return -1;
    }
    lock_error_t error;

    if (command == F_GETLK) {
        if (lock->l_type == F_UNLCK) {
            errno = EINVAL;
            return -1;
        }
        lock_state_t state;
        bool ok = wordpress_playground_filesystem_locks_filesystem_locks_query_range(
            descriptor, &range, kind_from_flock(lock->l_type), &state, &error
        );
        if (!ok) {
            return lock_error(error);
        }
        if (state.tag == WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_STATE_UNLOCKED) {
            lock->l_type = F_UNLCK;
            return 0;
        }
        lock->l_type = state.val.locked.kind == WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_KIND_SHARED
            ? F_RDLCK
            : F_WRLCK;
        lock->l_whence = SEEK_SET;
        if (state.val.locked.range.start > INT64_MAX ||
            (state.val.locked.range.length.is_some && state.val.locked.range.length.val > INT64_MAX)) {
            errno = EOVERFLOW;
            return -1;
        }
        lock->l_start = (off_t)state.val.locked.range.start;
        lock->l_len = state.val.locked.range.length.is_some
            ? (off_t)state.val.locked.range.length.val
            : 0;
        lock->l_pid = state.val.locked.owner_process_id.is_some
            ? (pid_t)state.val.locked.owner_process_id.val
            : (pid_t)-1;
        return 0;
    }

    if (lock->l_type == F_UNLCK) {
        bool ok = wordpress_playground_filesystem_locks_filesystem_locks_unlock_range(
            descriptor, &range, &error
        );
        return ok ? 0 : lock_error(error);
    }

    lock_mode_t mode = command == F_SETLKW
        ? WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_MODE_BLOCKING
        : WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_MODE_NON_BLOCKING;
    bool ok = wordpress_playground_filesystem_locks_filesystem_locks_lock_range(
        descriptor, &range, kind_from_flock(lock->l_type), mode, &error
    );
    return ok ? 0 : lock_error(error);
}

int fcntl(int fd, int command, ...) {
    descriptor_table_entry *entry = descriptor_table_get_ref(fd);
    if (entry == NULL) {
        return -1;
    }

    switch (command) {
        case F_GETFD:
            return FD_CLOEXEC;
        case F_SETFD:
            return 0;
        case F_GETFL:
            if (entry->vtable == NULL || entry->vtable->fcntl_getfl == NULL) {
                errno = EINVAL;
                return -1;
            }
            return entry->vtable->fcntl_getfl(entry->data);
        case F_SETFL: {
            va_list arguments;
            va_start(arguments, command);
            int flags = va_arg(arguments, int);
            va_end(arguments);
            if (entry->vtable == NULL || entry->vtable->fcntl_setfl == NULL) {
                errno = EINVAL;
                return -1;
            }
            return entry->vtable->fcntl_setfl(entry->data, flags);
        }
        case F_GETLK:
        case F_SETLK:
        case F_SETLKW: {
            va_list arguments;
            va_start(arguments, command);
            struct flock *lock = va_arg(arguments, struct flock *);
            va_end(arguments);
            return fcntl_lock(fd, command, lock);
        }
        default:
            errno = EINVAL;
            return -1;
    }
}

int flock(int fd, int operation) {
    const int allowed = LOCK_SH | LOCK_EX | LOCK_UN | LOCK_NB;
    if ((operation & ~allowed) != 0) {
        errno = EINVAL;
        return -1;
    }
    int action = operation & ~LOCK_NB;
    if (action != LOCK_SH && action != LOCK_EX && action != LOCK_UN) {
        errno = EINVAL;
        return -1;
    }

    descriptor_table_entry *entry;
    wasi_filesystem_types_borrow_descriptor_t descriptor;
    if (descriptor_for_fd(fd, &entry, &descriptor) < 0) {
        return -1;
    }
    (void)entry;
    lock_error_t error;
    if (action == LOCK_UN) {
        bool ok = wordpress_playground_filesystem_locks_filesystem_locks_unlock_whole(
            descriptor, &error
        );
        return ok ? 0 : lock_error(error);
    }
    lock_kind_t kind = action == LOCK_SH
        ? WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_KIND_SHARED
        : WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_KIND_EXCLUSIVE;
    lock_mode_t mode = (operation & LOCK_NB) != 0
        ? WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_MODE_NON_BLOCKING
        : WORDPRESS_PLAYGROUND_FILESYSTEM_LOCKS_FILESYSTEM_LOCKS_LOCK_MODE_BLOCKING;
    bool ok = wordpress_playground_filesystem_locks_filesystem_locks_lock_whole(
        descriptor, kind, mode, &error
    );
    return ok ? 0 : lock_error(error);
}
