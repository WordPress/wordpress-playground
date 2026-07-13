//! Native advisory file locks for independent component workers.
//!
//! Whole-file locks use the platform's whole-file primitive (`flock` on Unix
//! and `LockFileEx` on Windows). Byte-range locks use absolute, half-open byte
//! ranges and the platform's record-lock primitive (`fcntl` on Unix and
//! `LockFileEx` on Windows).
//!
//! On Linux, Android, and Apple hosts, byte-range locks use open-file-description
//! commands so separate Wasmtime Stores in one process still conflict correctly.
//! Windows range locks are handle-owned. A process-local interval ledger maps
//! POSIX-style replacement and spanning unlocks onto exact `LockFileEx`
//! acquisitions. Overlapping conversions and queries cannot be atomic against
//! unrelated external processes. Other Unix targets fall back to process-owned
//! POSIX record locks and therefore require process-isolated workers for correct
//! byte-range lock ownership.

use std::fmt::{self, Display, Formatter};
use std::io;

#[cfg(unix)]
use std::os::fd::{AsRawFd, RawFd};
#[cfg(windows)]
use std::os::windows::io::{AsRawHandle, RawHandle};

/// Whether a lock permits other readers or excludes every other lock holder.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LockKind {
    Shared,
    Exclusive,
}

/// Whether an acquisition waits for a conflict to clear.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LockMode {
    Blocking,
    NonBlocking,
}

/// An absolute, half-open byte range.
///
/// `length: None` means every byte from `start` through end-of-file, including
/// bytes appended after the lock is acquired. A zero explicit length is
/// invalid rather than being overloaded with the native end-of-file meaning.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub length: Option<u64>,
}

impl ByteRange {
    pub const WHOLE_FILE: Self = Self {
        start: 0,
        length: None,
    };

    pub const fn new(start: u64, length: Option<u64>) -> Self {
        Self { start, length }
    }

    fn validate(self) -> Result<Self, LockError> {
        if self.length == Some(0) {
            return Err(LockError::InvalidRange);
        }
        if self
            .length
            .is_some_and(|length| self.start.checked_add(length).is_none())
        {
            return Err(LockError::Overflow);
        }
        Ok(self)
    }
}

/// A conflicting native record lock observed by `query_range`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LockState {
    Unlocked,
    Locked {
        kind: LockKind,
        range: ByteRange,
        /// Available for legacy POSIX record locks; absent for OFD/Windows.
        owner_process_id: Option<u32>,
    },
}

/// A stable, typed classification of native lock failures.
#[derive(Debug)]
pub enum LockError {
    WouldBlock,
    BadDescriptor,
    Interrupted,
    InvalidRange,
    Overflow,
    Deadlock,
    Unsupported,
    PermissionDenied,
    ResourceExhausted,
    Io(io::Error),
}

impl LockError {
    /// Returns the platform error code for an unclassified I/O failure.
    pub fn raw_os_error(&self) -> Option<u32> {
        match self {
            Self::Io(error) => error
                .raw_os_error()
                .and_then(|code| u32::try_from(code).ok()),
            _ => None,
        }
    }
}

impl Display for LockError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::WouldBlock => formatter.write_str("the requested lock would block"),
            Self::BadDescriptor => formatter.write_str("the descriptor is not lockable"),
            Self::Interrupted => formatter.write_str("the lock operation was interrupted"),
            Self::InvalidRange => formatter.write_str("the byte range is invalid"),
            Self::Overflow => formatter.write_str("the byte range is not representable"),
            Self::Deadlock => formatter.write_str("the lock would cause a deadlock"),
            Self::Unsupported => formatter.write_str("file locking is not supported"),
            Self::PermissionDenied => formatter.write_str("permission to lock the file was denied"),
            Self::ResourceExhausted => {
                formatter.write_str("the operating system lock table is exhausted")
            }
            Self::Io(error) => write!(formatter, "file lock I/O error: {error}"),
        }
    }
}

impl std::error::Error for LockError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io(error) => Some(error),
            _ => None,
        }
    }
}

#[cfg(unix)]
pub trait LockableFile {
    fn raw_lock_handle(&self) -> RawFd;
}

#[cfg(unix)]
impl<T: AsRawFd + ?Sized> LockableFile for T {
    fn raw_lock_handle(&self) -> RawFd {
        self.as_raw_fd()
    }
}

#[cfg(windows)]
pub trait LockableFile {
    fn raw_lock_handle(&self) -> RawHandle;
}

#[cfg(windows)]
impl<T: AsRawHandle + ?Sized> LockableFile for T {
    fn raw_lock_handle(&self) -> RawHandle {
        self.as_raw_handle()
    }
}

/// Acquires or converts a whole-file advisory lock.
///
/// Whole-file and record locks are separate lock namespaces on several Unix
/// filesystems. Callers should use one lock family consistently for a given
/// coordination protocol.
pub fn lock_whole<F: LockableFile + ?Sized>(
    file: &F,
    kind: LockKind,
    mode: LockMode,
) -> Result<(), LockError> {
    platform::lock_whole(file.raw_lock_handle(), kind, mode)
}

/// Releases a whole-file advisory lock held through `file`.
pub fn unlock_whole<F: LockableFile + ?Sized>(file: &F) -> Result<(), LockError> {
    platform::unlock_whole(file.raw_lock_handle())
}

/// Acquires or converts an advisory lock over an absolute byte range.
pub fn lock_range<F: LockableFile + ?Sized>(
    file: &F,
    range: ByteRange,
    kind: LockKind,
    mode: LockMode,
) -> Result<(), LockError> {
    platform::lock_range(file.raw_lock_handle(), range.validate()?, kind, mode)
}

/// Reports a conflicting shared or exclusive record lock.
///
/// This is a point-in-time advisory query. OFD hosts do not report a lock owned
/// by the queried open file description; legacy POSIX hosts do not report locks
/// owned by the calling process. Windows implements the query with nonblocking
/// lock probes, so another worker can change the result immediately afterward.
pub fn query_range<F: LockableFile + ?Sized>(
    file: &F,
    range: ByteRange,
    kind: LockKind,
) -> Result<LockState, LockError> {
    platform::query_range(file.raw_lock_handle(), range.validate()?, kind)
}

/// Releases this platform lock owner's advisory record locks over a range.
pub fn unlock_range<F: LockableFile + ?Sized>(file: &F, range: ByteRange) -> Result<(), LockError> {
    platform::unlock_range(file.raw_lock_handle(), range.validate()?)
}

#[cfg(unix)]
mod platform {
    use super::{ByteRange, LockError, LockKind, LockMode, LockState};
    use std::io;
    use std::os::fd::RawFd;

    pub(super) fn lock_whole(fd: RawFd, kind: LockKind, mode: LockMode) -> Result<(), LockError> {
        let operation = match kind {
            LockKind::Shared => libc::LOCK_SH,
            LockKind::Exclusive => libc::LOCK_EX,
        } | match mode {
            LockMode::Blocking => 0,
            LockMode::NonBlocking => libc::LOCK_NB,
        };
        call_flock(fd, operation)
    }

    pub(super) fn unlock_whole(fd: RawFd) -> Result<(), LockError> {
        call_flock(fd, libc::LOCK_UN)
    }

    pub(super) fn lock_range(
        fd: RawFd,
        range: ByteRange,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        let mut lock = native_range(range, kind)?;
        let command = set_lock_command(mode);
        call_fcntl(fd, command, &mut lock)
    }

    pub(super) fn query_range(
        fd: RawFd,
        range: ByteRange,
        kind: LockKind,
    ) -> Result<LockState, LockError> {
        let mut lock = native_range(range, kind)?;
        call_fcntl(fd, get_lock_command(), &mut lock)?;
        match lock_type_number(lock.l_type) {
            value if value == lock_type_number(libc::F_UNLCK) => Ok(LockState::Unlocked),
            value if value == lock_type_number(libc::F_RDLCK) => Ok(LockState::Locked {
                kind: LockKind::Shared,
                range: byte_range_from_native(&lock)?,
                owner_process_id: positive_process_id(lock.l_pid),
            }),
            value if value == lock_type_number(libc::F_WRLCK) => Ok(LockState::Locked {
                kind: LockKind::Exclusive,
                range: byte_range_from_native(&lock)?,
                owner_process_id: positive_process_id(lock.l_pid),
            }),
            _ => Err(LockError::Io(io::Error::new(
                io::ErrorKind::InvalidData,
                "fcntl returned an unknown lock type",
            ))),
        }
    }

    pub(super) fn unlock_range(fd: RawFd, range: ByteRange) -> Result<(), LockError> {
        let mut lock = native_range(range, LockKind::Exclusive)?;
        lock.l_type = libc::F_UNLCK as _;
        call_fcntl(fd, set_lock_command(LockMode::NonBlocking), &mut lock)
    }

    #[cfg(any(target_os = "linux", target_os = "android", target_vendor = "apple"))]
    fn set_lock_command(mode: LockMode) -> libc::c_int {
        match mode {
            LockMode::Blocking => libc::F_OFD_SETLKW,
            LockMode::NonBlocking => libc::F_OFD_SETLK,
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "android", target_vendor = "apple")))]
    fn set_lock_command(mode: LockMode) -> libc::c_int {
        match mode {
            LockMode::Blocking => libc::F_SETLKW,
            LockMode::NonBlocking => libc::F_SETLK,
        }
    }

    #[cfg(any(target_os = "linux", target_os = "android", target_vendor = "apple"))]
    fn get_lock_command() -> libc::c_int {
        libc::F_OFD_GETLK
    }

    #[cfg(not(any(target_os = "linux", target_os = "android", target_vendor = "apple")))]
    fn get_lock_command() -> libc::c_int {
        libc::F_GETLK
    }

    fn native_range(range: ByteRange, kind: LockKind) -> Result<libc::flock, LockError> {
        let start = libc::off_t::try_from(range.start).map_err(|_| LockError::Overflow)?;
        let length = match range.length {
            Some(length) => {
                let end = range.start.checked_add(length).ok_or(LockError::Overflow)?;
                libc::off_t::try_from(end).map_err(|_| LockError::Overflow)?;
                libc::off_t::try_from(length).map_err(|_| LockError::Overflow)?
            }
            None => 0,
        };
        let mut lock = unsafe { std::mem::zeroed::<libc::flock>() };
        lock.l_type = match kind {
            LockKind::Shared => libc::F_RDLCK as _,
            LockKind::Exclusive => libc::F_WRLCK as _,
        };
        lock.l_whence = libc::SEEK_SET as _;
        lock.l_start = start;
        lock.l_len = length;
        Ok(lock)
    }

    fn byte_range_from_native(lock: &libc::flock) -> Result<ByteRange, LockError> {
        if libc::c_int::from(lock.l_whence) != libc::SEEK_SET {
            return Err(LockError::Io(io::Error::new(
                io::ErrorKind::InvalidData,
                "fcntl returned a non-absolute lock range",
            )));
        }

        let start = i128::from(lock.l_start);
        let length = i128::from(lock.l_len);
        let (start, length) = if length < 0 {
            (
                start.checked_add(length).ok_or(LockError::Overflow)?,
                length.checked_neg().ok_or(LockError::Overflow)?,
            )
        } else {
            (start, length)
        };
        let start = u64::try_from(start).map_err(|_| LockError::Overflow)?;
        let length = if length == 0 {
            None
        } else {
            Some(u64::try_from(length).map_err(|_| LockError::Overflow)?)
        };
        Ok(ByteRange::new(start, length))
    }

    fn call_flock(fd: RawFd, operation: libc::c_int) -> Result<(), LockError> {
        let result = unsafe { libc::flock(fd, operation) };
        if result == 0 {
            Ok(())
        } else {
            Err(classify(io::Error::last_os_error()))
        }
    }

    fn call_fcntl(
        fd: RawFd,
        command: libc::c_int,
        lock: &mut libc::flock,
    ) -> Result<(), LockError> {
        let result = unsafe { libc::fcntl(fd, command, lock as *mut libc::flock) };
        if result == 0 {
            Ok(())
        } else {
            Err(classify(io::Error::last_os_error()))
        }
    }

    fn positive_process_id(pid: libc::pid_t) -> Option<u32> {
        (pid > 0).then(|| u32::try_from(pid).ok()).flatten()
    }

    fn lock_type_number<T: Into<i64>>(value: T) -> i64 {
        value.into()
    }

    fn classify(error: io::Error) -> LockError {
        let raw = error.raw_os_error();
        if raw == Some(libc::EAGAIN) || raw == Some(libc::EACCES) {
            LockError::WouldBlock
        } else if raw == Some(libc::EBADF) {
            LockError::BadDescriptor
        } else if raw == Some(libc::EINTR) {
            LockError::Interrupted
        } else if raw == Some(libc::EINVAL) {
            LockError::InvalidRange
        } else if raw == Some(libc::EOVERFLOW) || raw == Some(libc::EFBIG) {
            LockError::Overflow
        } else if raw == Some(libc::EDEADLK) {
            LockError::Deadlock
        } else if raw == Some(libc::ENOSYS)
            || raw == Some(libc::ENOTSUP)
            || raw == Some(libc::EOPNOTSUPP)
        {
            LockError::Unsupported
        } else if raw == Some(libc::EPERM) || raw == Some(libc::EROFS) {
            LockError::PermissionDenied
        } else if raw == Some(libc::ENOLCK) || raw == Some(libc::ENOMEM) {
            LockError::ResourceExhausted
        } else {
            LockError::Io(error)
        }
    }
}

#[cfg(windows)]
mod platform {
    use super::{ByteRange, LockError, LockKind, LockMode, LockState};
    use std::collections::HashMap;
    use std::io;
    use std::os::windows::io::RawHandle;
    use std::sync::{Arc, Condvar, Mutex, OnceLock, RwLock};
    use std::time::Duration;
    use windows_sys::Win32::Foundation::{
        GetLastError, ERROR_ACCESS_DENIED, ERROR_INVALID_FUNCTION, ERROR_INVALID_HANDLE,
        ERROR_INVALID_PARAMETER, ERROR_IO_PENDING, ERROR_LOCK_VIOLATION, ERROR_NOT_ENOUGH_MEMORY,
        ERROR_NOT_LOCKED, ERROR_NOT_SUPPORTED, ERROR_OPERATION_ABORTED, ERROR_POSSIBLE_DEADLOCK,
        HANDLE,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        FileIdInfo, GetFileInformationByHandleEx, LockFileEx, UnlockFileEx, FILE_ID_INFO,
        LOCKFILE_EXCLUSIVE_LOCK, LOCKFILE_FAIL_IMMEDIATELY,
    };
    use windows_sys::Win32::System::IO::OVERLAPPED;

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct HeldLock {
        start: u64,
        end: u64,
        kind: LockKind,
    }

    #[derive(Default)]
    struct LockLedger {
        by_handle: HashMap<usize, Vec<HeldLock>>,
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    struct FileIdentity {
        volume_serial_number: u64,
        file_id: [u8; 16],
    }

    struct LockCoordinator {
        ledger: Mutex<LockLedger>,
        changed: Condvar,
    }

    static LOCK_COORDINATORS: OnceLock<RwLock<HashMap<FileIdentity, Arc<LockCoordinator>>>> =
        OnceLock::new();

    fn coordinator(handle: RawHandle) -> Result<Arc<LockCoordinator>, LockError> {
        let identity = file_identity(handle)?;
        let coordinators = LOCK_COORDINATORS.get_or_init(|| RwLock::new(HashMap::new()));

        if let Some(coordinator) = coordinators
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(&identity)
            .cloned()
        {
            return Ok(coordinator);
        }

        let mut coordinators = coordinators
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        // Coordinators retain handle-owned lock ledgers between API calls, so
        // keep them alive for the process lifetime. The registry guard is
        // dropped before any per-file ledger or native lock is acquired.
        Ok(Arc::clone(coordinators.entry(identity).or_insert_with(
            || {
                Arc::new(LockCoordinator {
                    ledger: Mutex::new(LockLedger::default()),
                    changed: Condvar::new(),
                })
            },
        )))
    }

    fn file_identity(handle: RawHandle) -> Result<FileIdentity, LockError> {
        let mut information = FILE_ID_INFO::default();
        let result = unsafe {
            GetFileInformationByHandleEx(
                handle as HANDLE,
                FileIdInfo,
                std::ptr::from_mut(&mut information).cast(),
                std::mem::size_of::<FILE_ID_INFO>() as u32,
            )
        };
        if result == 0 {
            return Err(classify_identity_error(unsafe { GetLastError() }));
        }
        let file_id = information.FileId.Identifier;
        if file_id == [0; 16] || file_id == [u8::MAX; 16] {
            // Windows specifies both values as sentinels for filesystems that
            // cannot provide a unique 128-bit identifier. A raw HANDLE or the
            // legacy 64-bit index would split same-file coordination or collide
            // on ReFS, respectively, so fail instead of guessing an identity.
            return Err(LockError::Unsupported);
        }
        Ok(FileIdentity {
            volume_serial_number: information.VolumeSerialNumber,
            file_id,
        })
    }

    fn classify_identity_error(code: u32) -> LockError {
        match code {
            ERROR_INVALID_HANDLE => LockError::BadDescriptor,
            ERROR_OPERATION_ABORTED => LockError::Interrupted,
            ERROR_INVALID_FUNCTION | ERROR_INVALID_PARAMETER | ERROR_NOT_SUPPORTED => {
                LockError::Unsupported
            }
            ERROR_ACCESS_DENIED => LockError::PermissionDenied,
            ERROR_NOT_ENOUGH_MEMORY => LockError::ResourceExhausted,
            _ => LockError::Io(io::Error::from_raw_os_error(code as i32)),
        }
    }

    pub(super) fn lock_whole(
        handle: RawHandle,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        set_lock(handle, ByteRange::WHOLE_FILE, kind, mode)
    }

    pub(super) fn unlock_whole(handle: RawHandle) -> Result<(), LockError> {
        remove_lock(handle, ByteRange::WHOLE_FILE)
    }

    pub(super) fn lock_range(
        handle: RawHandle,
        range: ByteRange,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        set_lock(handle, range, kind, mode)
    }

    pub(super) fn query_range(
        handle: RawHandle,
        range: ByteRange,
        kind: LockKind,
    ) -> Result<LockState, LockError> {
        let (start, end) = bounds(range)?;
        let coordinator = coordinator(handle)?;
        let mut ledger = coordinator
            .ledger
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let key = handle as usize;
        let tracked = ledger.by_handle.get(&key).cloned().unwrap_or_default();
        let (untouched, touched) = partition_locks(tracked, start, end);

        // F_GETLK ignores this open-file-description's own locks. LockFileEx
        // has no equivalent query and its probes see locks on the same handle,
        // so temporarily remove only this handle's intersecting acquisitions
        // while every in-process lock operation is excluded by the coordinator.
        // All native calls here are nonblocking; uncoordinated external processes
        // can only make this point-in-time result stale, just as with F_GETLK.
        let prior = release_tracked(handle, &touched)?;
        let result = query_without_own_locks(handle, range, start, end, kind);
        let (restored, restore_error) = acquire_prefix(handle, &prior);
        set_tracked(&mut ledger, key, join_locks(untouched, restored));
        if let Some(error) = restore_error {
            return Err(error);
        }
        result
    }

    fn query_without_own_locks(
        handle: RawHandle,
        range: ByteRange,
        start: u64,
        end: u64,
        kind: LockKind,
    ) -> Result<LockState, LockError> {
        let requested = HeldLock { start, end, kind };
        match probe(handle, requested) {
            Ok(()) => Ok(LockState::Unlocked),
            Err(LockError::WouldBlock) if kind == LockKind::Exclusive => {
                let shared = HeldLock {
                    kind: LockKind::Shared,
                    ..requested
                };
                match probe(handle, shared) {
                    Ok(()) => Ok(LockState::Locked {
                        kind: LockKind::Shared,
                        range,
                        owner_process_id: None,
                    }),
                    Err(LockError::WouldBlock) => Ok(LockState::Locked {
                        kind: LockKind::Exclusive,
                        range,
                        owner_process_id: None,
                    }),
                    Err(error) => Err(error),
                }
            }
            Err(LockError::WouldBlock) => Ok(LockState::Locked {
                kind: LockKind::Exclusive,
                range,
                owner_process_id: None,
            }),
            Err(error) => Err(error),
        }
    }

    pub(super) fn unlock_range(handle: RawHandle, range: ByteRange) -> Result<(), LockError> {
        remove_lock(handle, range)
    }

    fn set_lock(
        handle: RawHandle,
        range: ByteRange,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        let (start, end) = bounds(range)?;
        let coordinator = coordinator(handle)?;
        let mut ledger = coordinator
            .ledger
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        loop {
            match reconfigure(&coordinator, &mut ledger, handle, start, end, Some(kind)) {
                Err(LockError::WouldBlock) if mode == LockMode::Blocking => {
                    // Always issue FAIL_IMMEDIATELY native requests while the
                    // coordinator is locked. The condition-variable wait drops
                    // the mutex, allowing the conflicting worker to unlock.
                    // The timeout also observes locks released by other processes.
                    let (next, _) = coordinator
                        .changed
                        .wait_timeout(ledger, Duration::from_millis(10))
                        .unwrap_or_else(|poisoned| poisoned.into_inner());
                    ledger = next;
                }
                result => return result,
            }
        }
    }

    fn remove_lock(handle: RawHandle, range: ByteRange) -> Result<(), LockError> {
        let (start, end) = bounds(range)?;
        let coordinator = coordinator(handle)?;
        let mut ledger = coordinator
            .ledger
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        reconfigure(&coordinator, &mut ledger, handle, start, end, None)
    }

    fn reconfigure(
        coordinator: &LockCoordinator,
        ledger: &mut LockLedger,
        handle: RawHandle,
        start: u64,
        end: u64,
        replacement: Option<LockKind>,
    ) -> Result<(), LockError> {
        let key = handle as usize;
        let tracked = ledger.by_handle.get(&key).cloned().unwrap_or_default();
        let (untouched, touched) = partition_locks(tracked, start, end);
        let prior = release_tracked(handle, &touched)?;
        let desired = edited_locks(&prior, start, end, replacement);
        let (acquired, acquisition_error) = acquire_prefix(handle, &desired);

        if let Some(error) = acquisition_error {
            // A failed POSIX conversion leaves the old lock map unchanged.
            // Unrelated native acquisitions were never released. No other
            // in-process operation can take the touched ranges while the
            // coordinator is held, so restoring them is deterministic for the
            // worker pool. External processes may race, in which case the
            // restoration error is the more important result.
            let cleanup_error = release_exact(handle, &acquired).err();
            let (restored, restore_error) = acquire_prefix(handle, &prior);
            set_tracked(ledger, key, join_locks(untouched, restored));
            return Err(restore_error.or(cleanup_error).unwrap_or(error));
        }

        set_tracked(ledger, key, join_locks(untouched, desired));
        coordinator.changed.notify_all();
        Ok(())
    }

    fn release_tracked(
        handle: RawHandle,
        tracked: &[HeldLock],
    ) -> Result<Vec<HeldLock>, LockError> {
        let mut released = Vec::with_capacity(tracked.len());
        for held in tracked.iter().copied() {
            match unlock_native(handle, held) {
                Ok(true) => released.push(held),
                Ok(false) => {
                    // A closed file releases its OS locks. If Windows later
                    // reuses the numeric HANDLE, discard the stale acquisition.
                }
                Err(error) => {
                    let (_, restore_error) = acquire_prefix(handle, &released);
                    return Err(restore_error.unwrap_or(error));
                }
            }
        }
        Ok(released)
    }

    fn acquire_prefix(handle: RawHandle, locks: &[HeldLock]) -> (Vec<HeldLock>, Option<LockError>) {
        let mut acquired = Vec::with_capacity(locks.len());
        for held in locks.iter().copied() {
            match lock_native(handle, held) {
                Ok(()) => acquired.push(held),
                Err(error) => return (acquired, Some(error)),
            }
        }
        (acquired, None)
    }

    fn release_exact(handle: RawHandle, locks: &[HeldLock]) -> Result<(), LockError> {
        for held in locks.iter().copied() {
            if !unlock_native(handle, held)? {
                return Err(classify(ERROR_NOT_LOCKED));
            }
        }
        Ok(())
    }

    fn set_tracked(ledger: &mut LockLedger, key: usize, locks: Vec<HeldLock>) {
        if locks.is_empty() {
            ledger.by_handle.remove(&key);
        } else {
            ledger.by_handle.insert(key, locks);
        }
    }

    fn edited_locks(
        current: &[HeldLock],
        start: u64,
        end: u64,
        replacement: Option<LockKind>,
    ) -> Vec<HeldLock> {
        let mut edited = Vec::with_capacity(current.len() + 1);
        for held in current.iter().copied() {
            if held.end <= start || end <= held.start {
                edited.push(held);
                continue;
            }
            if held.start < start {
                edited.push(HeldLock { end: start, ..held });
            }
            if end < held.end {
                edited.push(HeldLock { start: end, ..held });
            }
        }
        if let Some(kind) = replacement {
            edited.push(HeldLock { start, end, kind });
        }
        sort_locks(edited)
    }

    fn partition_locks(
        locks: Vec<HeldLock>,
        start: u64,
        end: u64,
    ) -> (Vec<HeldLock>, Vec<HeldLock>) {
        locks
            .into_iter()
            .partition(|held| held.end <= start || end <= held.start)
    }

    fn join_locks(mut untouched: Vec<HeldLock>, touched: Vec<HeldLock>) -> Vec<HeldLock> {
        untouched.extend(touched);
        sort_locks(untouched)
    }

    fn sort_locks(mut locks: Vec<HeldLock>) -> Vec<HeldLock> {
        locks.sort_unstable_by_key(|held| (held.start, held.end));
        debug_assert!(locks.windows(2).all(|pair| pair[0].end <= pair[1].start));
        locks
    }

    fn probe(handle: RawHandle, requested: HeldLock) -> Result<(), LockError> {
        lock_native(handle, requested)?;
        if unlock_native(handle, requested)? {
            Ok(())
        } else {
            Err(classify(ERROR_NOT_LOCKED))
        }
    }

    fn lock_native(handle: RawHandle, held: HeldLock) -> Result<(), LockError> {
        let (length_low, length_high, mut overlapped) = native_range(held)?;
        let flags = match held.kind {
            LockKind::Shared => LOCKFILE_FAIL_IMMEDIATELY,
            LockKind::Exclusive => LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY,
        };
        let result = unsafe {
            LockFileEx(
                handle as HANDLE,
                flags,
                0,
                length_low,
                length_high,
                &mut overlapped,
            )
        };
        if result != 0 {
            Ok(())
        } else {
            Err(classify(unsafe { GetLastError() }))
        }
    }

    fn unlock_native(handle: RawHandle, held: HeldLock) -> Result<bool, LockError> {
        let (length_low, length_high, mut overlapped) = native_range(held)?;
        let result = unsafe {
            UnlockFileEx(
                handle as HANDLE,
                0,
                length_low,
                length_high,
                &mut overlapped,
            )
        };
        if result != 0 {
            Ok(true)
        } else {
            let code = unsafe { GetLastError() };
            if code == ERROR_NOT_LOCKED {
                Ok(false)
            } else {
                Err(classify(code))
            }
        }
    }

    fn bounds(range: ByteRange) -> Result<(u64, u64), LockError> {
        let end = match range.length {
            Some(length) => range.start.checked_add(length).ok_or(LockError::Overflow)?,
            None => u64::MAX,
        };
        if end == range.start {
            return Err(LockError::InvalidRange);
        }
        Ok((range.start, end))
    }

    fn native_range(held: HeldLock) -> Result<(u32, u32, OVERLAPPED), LockError> {
        let length = held.end.saturating_sub(held.start);
        if length == 0 {
            return Err(LockError::InvalidRange);
        }
        let mut overlapped = OVERLAPPED::default();
        overlapped.Anonymous.Anonymous.Offset = held.start as u32;
        overlapped.Anonymous.Anonymous.OffsetHigh = (held.start >> 32) as u32;
        Ok((length as u32, (length >> 32) as u32, overlapped))
    }

    fn classify(code: u32) -> LockError {
        match code {
            ERROR_LOCK_VIOLATION | ERROR_IO_PENDING => LockError::WouldBlock,
            ERROR_INVALID_HANDLE => LockError::BadDescriptor,
            ERROR_OPERATION_ABORTED => LockError::Interrupted,
            ERROR_INVALID_PARAMETER => LockError::InvalidRange,
            ERROR_POSSIBLE_DEADLOCK => LockError::Deadlock,
            ERROR_INVALID_FUNCTION | ERROR_NOT_SUPPORTED => LockError::Unsupported,
            ERROR_ACCESS_DENIED => LockError::PermissionDenied,
            ERROR_NOT_ENOUGH_MEMORY => LockError::ResourceExhausted,
            _ => LockError::Io(io::Error::from_raw_os_error(code as i32)),
        }
    }

    #[cfg(test)]
    mod ledger_tests {
        use super::*;
        use std::fs::{self, OpenOptions};
        use std::os::windows::io::AsRawHandle;
        use std::sync::{
            atomic::{AtomicU64, Ordering},
            Arc,
        };

        static NEXT_PATH: AtomicU64 = AtomicU64::new(0);

        #[test]
        fn partition_selects_only_intersecting_native_acquisitions() {
            let shared = HeldLock {
                start: 100,
                end: 110,
                kind: LockKind::Shared,
            };
            let reserved = HeldLock {
                start: 200,
                end: 201,
                kind: LockKind::Exclusive,
            };

            let (untouched, touched) = partition_locks(vec![shared, reserved], 200, 201);

            assert_eq!(untouched, vec![shared]);
            assert_eq!(touched, vec![reserved]);
        }

        #[test]
        fn separate_handles_for_the_same_file_share_a_coordinator() {
            let path = temp_path("same-file-coordinator");
            let first_file = open_new_file(&path);
            let second_file = OpenOptions::new()
                .read(true)
                .write(true)
                .open(&path)
                .unwrap();

            let first = coordinator(first_file.as_raw_handle()).unwrap();
            let second = coordinator(second_file.as_raw_handle()).unwrap();
            assert!(Arc::ptr_eq(&first, &second));

            drop(first_file);
            drop(second_file);
            fs::remove_file(path).unwrap();
        }

        #[test]
        fn different_files_have_independent_coordinator_mutexes() {
            let first_path = temp_path("first-file-coordinator");
            let second_path = temp_path("second-file-coordinator");
            let first_file = open_new_file(&first_path);
            let second_file = open_new_file(&second_path);
            let first = coordinator(first_file.as_raw_handle()).unwrap();
            let second = coordinator(second_file.as_raw_handle()).unwrap();

            assert!(!Arc::ptr_eq(&first, &second));
            let _first_guard = first
                .ledger
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let second_guard = second.ledger.try_lock();
            assert!(second_guard.is_ok());
            drop(second_guard);

            drop(first_file);
            drop(second_file);
            fs::remove_file(first_path).unwrap();
            fs::remove_file(second_path).unwrap();
        }

        #[test]
        fn missing_native_lock_purges_a_stale_handle_entry() {
            let path = temp_path("stale-lock");
            let file = open_new_file(&path);
            let handle = file.as_raw_handle();
            let key = handle as usize;
            let stale = HeldLock {
                start: 10,
                end: 11,
                kind: LockKind::Exclusive,
            };
            let coordinator = coordinator(handle).unwrap();
            coordinator
                .ledger
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .by_handle
                .insert(key, vec![stale]);

            remove_lock(handle, ByteRange::new(10, Some(1))).unwrap();
            assert!(!coordinator
                .ledger
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .by_handle
                .contains_key(&key));

            let fresh = ByteRange::new(20, Some(1));
            set_lock(handle, fresh, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
            let tracked = coordinator
                .ledger
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .by_handle
                .get(&key)
                .cloned()
                .unwrap();
            assert_eq!(
                tracked,
                vec![HeldLock {
                    start: 20,
                    end: 21,
                    kind: LockKind::Exclusive,
                }]
            );

            remove_lock(handle, ByteRange::WHOLE_FILE).unwrap();
            drop(file);
            fs::remove_file(path).unwrap();
        }

        fn temp_path(label: &str) -> std::path::PathBuf {
            std::env::temp_dir().join(format!(
                "wp-playground-{label}-{}-{}.tmp",
                std::process::id(),
                NEXT_PATH.fetch_add(1, Ordering::Relaxed)
            ))
        }

        fn open_new_file(path: &std::path::Path) -> std::fs::File {
            OpenOptions::new()
                .create_new(true)
                .read(true)
                .write(true)
                .open(path)
                .unwrap()
        }
    }
}

#[cfg(not(any(unix, windows)))]
compile_error!("native file locks require a Unix or Windows host");

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File, OpenOptions};
    use std::path::{Path, PathBuf};
    use std::process::{Child, Command, Output, Stdio};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::thread;
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    const HELPER_ACTION: &str = "WP_PLAYGROUND_LOCK_HELPER_ACTION";
    const HELPER_PATH: &str = "WP_PLAYGROUND_LOCK_HELPER_PATH";
    const HELPER_MARKER: &str = "WP_PLAYGROUND_LOCK_HELPER_MARKER";
    const HELPER_START: &str = "WP_PLAYGROUND_LOCK_HELPER_START";
    const HELPER_LENGTH: &str = "WP_PLAYGROUND_LOCK_HELPER_LENGTH";
    const HELPER_RESULT: &str = "WP_PLAYGROUND_LOCK_HELPER_RESULT=";

    static NEXT_PATH: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn whole_file_shared_and_exclusive_locks_conflict_across_processes() {
        let path = temp_file("whole-conflicts");
        let file = open_file(&path);

        lock_whole(&file, LockKind::Shared, LockMode::NonBlocking).unwrap();
        assert_eq!(run_helper(&path, "try-whole-shared", None), "acquired");
        assert_eq!(
            run_helper(&path, "try-whole-exclusive", None),
            "would-block"
        );
        unlock_whole(&file).unwrap();

        lock_whole(&file, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        assert_eq!(run_helper(&path, "try-whole-shared", None), "would-block");
        assert_eq!(
            run_helper(&path, "try-whole-exclusive", None),
            "would-block"
        );
        unlock_whole(&file).unwrap();

        remove_temp_file(path);
    }

    #[test]
    fn absolute_range_locks_distinguish_overlap_and_lock_kind() {
        let path = temp_file("range-conflicts");
        let file = open_file(&path);
        let range = ByteRange::new(10, Some(10));

        lock_range(&file, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-shared", Some(range)),
            "acquired"
        );
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(range)),
            "would-block"
        );
        assert_eq!(
            run_helper(
                &path,
                "try-range-exclusive",
                Some(ByteRange::new(20, Some(10)))
            ),
            "acquired"
        );
        assert_eq!(
            run_helper(&path, "query-range-shared", Some(range)),
            "unlocked"
        );
        assert_eq!(
            run_helper(&path, "query-range-exclusive", Some(range)),
            "shared"
        );
        unlock_range(&file, range).unwrap();

        lock_range(&file, range, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-shared", Some(range)),
            "would-block"
        );
        assert_eq!(
            run_helper(&path, "query-range-shared", Some(range)),
            "exclusive"
        );
        assert_eq!(
            run_helper(&path, "query-range-exclusive", Some(range)),
            "exclusive"
        );
        unlock_range(&file, range).unwrap();

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn range_lock_replaces_same_handle_lock_on_windows() {
        let path = temp_file("same-handle-range-replacement");
        let file = open_file(&path);
        let range = ByteRange::new(10, Some(10));

        lock_range(&file, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        lock_range(&file, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        lock_range(&file, range, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        unlock_range(&file, range).unwrap();

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn adjacent_windows_locks_can_be_unlocked_by_their_union() {
        let path = temp_file("adjacent-range-unlock");
        let file = open_file(&path);
        let first = ByteRange::new(10, Some(1));
        let second = ByteRange::new(11, Some(1));
        let union = ByteRange::new(10, Some(2));

        lock_range(&file, first, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        lock_range(&file, second, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        unlock_range(&file, union).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(union)),
            "acquired"
        );

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn disjoint_windows_edit_preserves_shared_range() {
        let path = temp_file("disjoint-range-edit");
        let file = open_file(&path);
        let shared = ByteRange::new(100, Some(10));
        let reserved = ByteRange::new(200, Some(1));

        lock_range(&file, shared, LockKind::Shared, LockMode::NonBlocking).unwrap();
        lock_range(&file, reserved, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(shared)),
            "would-block"
        );
        unlock_range(&file, reserved).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(shared)),
            "would-block"
        );
        unlock_range(&file, shared).unwrap();

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn whole_range_unlock_releases_narrower_windows_locks() {
        let path = temp_file("whole-range-unlock");
        let file = open_file(&path);
        let narrow = ByteRange::new(20, Some(4));

        lock_range(&file, narrow, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        unlock_range(&file, ByteRange::WHOLE_FILE).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(narrow)),
            "acquired"
        );

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn partial_windows_unlock_splits_the_owned_lock() {
        let path = temp_file("partial-range-unlock");
        let file = open_file(&path);
        let whole = ByteRange::new(30, Some(10));
        let middle = ByteRange::new(34, Some(2));
        let left = ByteRange::new(30, Some(4));
        let right = ByteRange::new(36, Some(4));

        lock_range(&file, whole, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        unlock_range(&file, middle).unwrap();
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(middle)),
            "acquired"
        );
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(left)),
            "would-block"
        );
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(right)),
            "would-block"
        );
        unlock_range(&file, ByteRange::WHOLE_FILE).unwrap();

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn failed_windows_conversion_restores_the_prior_shared_lock() {
        let path = temp_file("failed-range-conversion");
        let first = open_file(&path);
        let second = open_file(&path);
        let range = ByteRange::new(50, Some(8));

        lock_range(&first, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        lock_range(&second, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        assert!(matches!(
            lock_range(&first, range, LockKind::Exclusive, LockMode::NonBlocking),
            Err(LockError::WouldBlock)
        ));
        unlock_range(&second, range).unwrap();
        assert!(matches!(
            lock_range(&second, range, LockKind::Exclusive, LockMode::NonBlocking),
            Err(LockError::WouldBlock)
        ));
        unlock_range(&first, range).unwrap();

        remove_temp_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn windows_query_ignores_and_restores_same_handle_locks() {
        let path = temp_file("same-handle-query");
        let file = open_file(&path);
        let range = ByteRange::new(70, Some(6));

        lock_range(&file, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        assert_eq!(
            query_range(&file, range, LockKind::Exclusive).unwrap(),
            LockState::Unlocked
        );
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(range)),
            "would-block"
        );
        unlock_range(&file, range).unwrap();

        remove_temp_file(path);
    }

    #[cfg(any(target_os = "linux", target_os = "android", target_vendor = "apple"))]
    #[test]
    fn ofd_range_locks_conflict_between_same_process_descriptors() {
        let path = temp_file("same-process-range-conflicts");
        let first = open_file(&path);
        let second = open_file(&path);
        let range = ByteRange::new(4, Some(8));

        lock_range(&first, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        lock_range(&second, range, LockKind::Shared, LockMode::NonBlocking).unwrap();
        unlock_range(&second, range).unwrap();
        assert!(matches!(
            lock_range(&second, range, LockKind::Exclusive, LockMode::NonBlocking),
            Err(LockError::WouldBlock)
        ));
        assert_eq!(
            query_range(&second, range, LockKind::Shared).unwrap(),
            LockState::Unlocked
        );
        assert!(matches!(
            query_range(&second, range, LockKind::Exclusive).unwrap(),
            LockState::Locked {
                kind: LockKind::Shared,
                range: conflicting_range,
                ..
            } if conflicting_range == range
        ));

        unlock_range(&first, range).unwrap();
        lock_range(&second, range, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        unlock_range(&second, range).unwrap();
        remove_temp_file(path);
    }

    #[cfg(any(target_os = "linux", target_os = "android", target_vendor = "apple"))]
    #[test]
    fn closing_an_unrelated_descriptor_does_not_release_ofd_lock() {
        let path = temp_file("unrelated-close-keeps-range-lock");
        let owner = open_file(&path);
        let contender = open_file(&path);
        let range = ByteRange::new(2, Some(5));

        lock_range(&owner, range, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        drop(open_file(&path));
        assert!(matches!(
            lock_range(
                &contender,
                range,
                LockKind::Exclusive,
                LockMode::NonBlocking
            ),
            Err(LockError::WouldBlock)
        ));

        unlock_range(&owner, range).unwrap();
        remove_temp_file(path);
    }

    #[test]
    fn record_lock_is_released_when_the_file_closes() {
        let path = temp_file("close-release");
        let range = ByteRange::new(3, None);
        {
            let file = open_file(&path);
            lock_range(&file, range, LockKind::Exclusive, LockMode::NonBlocking).unwrap();
        }
        assert_eq!(
            run_helper(&path, "try-range-exclusive", Some(range)),
            "acquired"
        );
        remove_temp_file(path);
    }

    #[test]
    fn record_lock_is_released_when_the_owner_process_is_killed() {
        let path = temp_file("process-release");
        let marker = marker_path(&path);
        let range = ByteRange::new(7, Some(11));
        let mut child = ChildGuard(spawn_holding_helper(&path, &marker, range));
        wait_for_marker(&marker, &mut child.0);

        let file = open_file(&path);
        assert!(matches!(
            query_range(&file, range, LockKind::Exclusive).unwrap(),
            LockState::Locked {
                kind: LockKind::Exclusive,
                range: conflicting_range,
                ..
            } if conflicting_range == range
        ));
        assert!(matches!(
            lock_range(&file, range, LockKind::Exclusive, LockMode::NonBlocking),
            Err(LockError::WouldBlock)
        ));

        child.0.kill().unwrap();
        child.0.wait().unwrap();
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            match lock_range(&file, range, LockKind::Exclusive, LockMode::NonBlocking) {
                Ok(()) => break,
                Err(LockError::WouldBlock) if Instant::now() < deadline => {
                    thread::sleep(Duration::from_millis(10));
                }
                result => panic!("lock was not released after process exit: {result:?}"),
            }
        }
        unlock_range(&file, range).unwrap();

        let _ = fs::remove_file(marker);
        remove_temp_file(path);
    }

    #[test]
    fn invalid_and_overflowing_ranges_are_typed() {
        let path = temp_file("invalid-range");
        let file = open_file(&path);
        assert!(matches!(
            lock_range(
                &file,
                ByteRange::new(0, Some(0)),
                LockKind::Shared,
                LockMode::NonBlocking
            ),
            Err(LockError::InvalidRange)
        ));
        assert!(matches!(
            lock_range(
                &file,
                ByteRange::new(u64::MAX, Some(2)),
                LockKind::Shared,
                LockMode::NonBlocking
            ),
            Err(LockError::Overflow)
        ));
        remove_temp_file(path);
    }

    #[test]
    fn lock_helper_process() {
        let Ok(action) = std::env::var(HELPER_ACTION) else {
            return;
        };
        let path = PathBuf::from(std::env::var_os(HELPER_PATH).unwrap());
        let file = open_file(&path);
        let range = helper_range();
        let result = match action.as_str() {
            "try-whole-shared" => {
                lock_label(lock_whole(&file, LockKind::Shared, LockMode::NonBlocking))
            }
            "try-whole-exclusive" => lock_label(lock_whole(
                &file,
                LockKind::Exclusive,
                LockMode::NonBlocking,
            )),
            "try-range-shared" => lock_label(lock_range(
                &file,
                range.unwrap(),
                LockKind::Shared,
                LockMode::NonBlocking,
            )),
            "try-range-exclusive" => lock_label(lock_range(
                &file,
                range.unwrap(),
                LockKind::Exclusive,
                LockMode::NonBlocking,
            )),
            "query-range-shared" => {
                query_label(query_range(&file, range.unwrap(), LockKind::Shared))
            }
            "query-range-exclusive" => {
                query_label(query_range(&file, range.unwrap(), LockKind::Exclusive))
            }
            "hold-range-exclusive" => {
                lock_range(
                    &file,
                    range.unwrap(),
                    LockKind::Exclusive,
                    LockMode::NonBlocking,
                )
                .unwrap();
                fs::write(std::env::var_os(HELPER_MARKER).unwrap(), b"ready").unwrap();
                loop {
                    thread::sleep(Duration::from_secs(1));
                }
            }
            unknown => panic!("unknown lock helper action: {unknown}"),
        };
        println!("{HELPER_RESULT}{result}");
    }

    fn run_helper(path: &Path, action: &str, range: Option<ByteRange>) -> String {
        let mut command = helper_command(path, action, range);
        let output = command.output().unwrap();
        helper_output(output)
    }

    fn spawn_holding_helper(path: &Path, marker: &Path, range: ByteRange) -> Child {
        let mut command = helper_command(path, "hold-range-exclusive", Some(range));
        command
            .env(HELPER_MARKER, marker)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap()
    }

    fn helper_command(path: &Path, action: &str, range: Option<ByteRange>) -> Command {
        let test_module = module_path!()
            .split_once("::")
            .map(|(_, module)| module)
            .unwrap_or(module_path!());
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .arg("--exact")
            .arg(format!("{test_module}::lock_helper_process"))
            .arg("--nocapture")
            .env(HELPER_ACTION, action)
            .env(HELPER_PATH, path);
        if let Some(range) = range {
            command.env(HELPER_START, range.start.to_string()).env(
                HELPER_LENGTH,
                range
                    .length
                    .map(|length| length.to_string())
                    .unwrap_or_else(|| "none".to_string()),
            );
        }
        command
    }

    fn helper_output(output: Output) -> String {
        assert!(
            output.status.success(),
            "lock helper failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find_map(|line| line.strip_prefix(HELPER_RESULT))
            .unwrap_or_else(|| panic!("lock helper returned no result: {output:?}"))
            .to_string()
    }

    fn helper_range() -> Option<ByteRange> {
        let start = std::env::var(HELPER_START).ok()?.parse().unwrap();
        let length = match std::env::var(HELPER_LENGTH).unwrap().as_str() {
            "none" => None,
            length => Some(length.parse().unwrap()),
        };
        Some(ByteRange::new(start, length))
    }

    fn lock_label(result: Result<(), LockError>) -> &'static str {
        match result {
            Ok(()) => "acquired",
            Err(LockError::WouldBlock) => "would-block",
            Err(error) => panic!("unexpected lock helper error: {error}"),
        }
    }

    fn query_label(result: Result<LockState, LockError>) -> &'static str {
        match result.unwrap() {
            LockState::Unlocked => "unlocked",
            LockState::Locked {
                kind: LockKind::Shared,
                ..
            } => "shared",
            LockState::Locked {
                kind: LockKind::Exclusive,
                ..
            } => "exclusive",
        }
    }

    fn wait_for_marker(marker: &Path, child: &mut Child) {
        let deadline = Instant::now() + Duration::from_secs(2);
        while !marker.exists() {
            if let Some(status) = child.try_wait().unwrap() {
                panic!("lock holder exited before becoming ready: {status}");
            }
            assert!(
                Instant::now() < deadline,
                "timed out waiting for lock holder"
            );
            thread::sleep(Duration::from_millis(10));
        }
    }

    fn temp_file(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "wp-playground-{label}-{}-{nonce}-{sequence}.lock",
            std::process::id()
        ));
        File::create(&path).unwrap();
        path
    }

    fn marker_path(path: &Path) -> PathBuf {
        path.with_extension("ready")
    }

    fn open_file(path: &Path) -> File {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(path)
            .unwrap()
    }

    fn remove_temp_file(path: PathBuf) {
        fs::remove_file(path).unwrap();
    }

    struct ChildGuard(Child);

    impl Drop for ChildGuard {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
}
