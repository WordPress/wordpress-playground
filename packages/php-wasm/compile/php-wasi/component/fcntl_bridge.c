#include "bridge.h"
#include "fcntl_compat.h"

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdint.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>
#include <wasi/wasip2.h>

typedef wordpress_playground_filesystem_locks_filesystem_locks_byte_range_t lock_range_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_error_t lock_error_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_kind_t lock_kind_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_mode_t lock_mode_t;
typedef wordpress_playground_filesystem_locks_filesystem_locks_lock_state_t lock_state_t;

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
