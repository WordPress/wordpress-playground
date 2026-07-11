//! Native advisory file locks for independent component workers.
//!
//! Whole-file locks use the platform's whole-file primitive (`flock` on Unix
//! and `LockFileEx` on Windows). Byte-range locks use absolute, half-open byte
//! ranges and the platform's record-lock primitive (`fcntl` on Unix and
//! `LockFileEx` on Windows).
//!
//! On Linux, Android, and Apple hosts, byte-range locks use open-file-description
//! commands so separate Wasmtime Stores in one process still conflict correctly.
//! Windows range locks are handle-owned. Other Unix targets fall back to
//! process-owned POSIX record locks and therefore require process-isolated
//! workers for correct byte-range lock ownership.

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
    use std::io;
    use std::os::windows::io::RawHandle;
    use windows_sys::Win32::Foundation::{
        GetLastError, ERROR_ACCESS_DENIED, ERROR_INVALID_FUNCTION, ERROR_INVALID_HANDLE,
        ERROR_INVALID_PARAMETER, ERROR_IO_PENDING, ERROR_LOCK_VIOLATION, ERROR_NOT_ENOUGH_MEMORY,
        ERROR_NOT_SUPPORTED, ERROR_OPERATION_ABORTED, ERROR_POSSIBLE_DEADLOCK, HANDLE,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        LockFileEx, UnlockFileEx, LOCKFILE_EXCLUSIVE_LOCK, LOCKFILE_FAIL_IMMEDIATELY,
    };
    use windows_sys::Win32::System::IO::OVERLAPPED;

    pub(super) fn lock_whole(
        handle: RawHandle,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        lock(handle, ByteRange::WHOLE_FILE, kind, mode)
    }

    pub(super) fn unlock_whole(handle: RawHandle) -> Result<(), LockError> {
        unlock(handle, ByteRange::WHOLE_FILE)
    }

    pub(super) fn lock_range(
        handle: RawHandle,
        range: ByteRange,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        lock(handle, range, kind, mode)
    }

    pub(super) fn query_range(
        handle: RawHandle,
        range: ByteRange,
        kind: LockKind,
    ) -> Result<LockState, LockError> {
        match lock(handle, range, kind, LockMode::NonBlocking) {
            Ok(()) => {
                unlock(handle, range)?;
                Ok(LockState::Unlocked)
            }
            Err(LockError::WouldBlock) if kind == LockKind::Exclusive => {
                match lock(handle, range, LockKind::Shared, LockMode::NonBlocking) {
                    Ok(()) => {
                        unlock(handle, range)?;
                        Ok(LockState::Locked {
                            kind: LockKind::Shared,
                            range,
                            owner_process_id: None,
                        })
                    }
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
        unlock(handle, range)
    }

    fn lock(
        handle: RawHandle,
        range: ByteRange,
        kind: LockKind,
        mode: LockMode,
    ) -> Result<(), LockError> {
        let (length_low, length_high, mut overlapped) = native_range(range)?;
        let mut flags = match kind {
            LockKind::Shared => 0,
            LockKind::Exclusive => LOCKFILE_EXCLUSIVE_LOCK,
        };
        if mode == LockMode::NonBlocking {
            flags |= LOCKFILE_FAIL_IMMEDIATELY;
        }
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

    fn unlock(handle: RawHandle, range: ByteRange) -> Result<(), LockError> {
        let (length_low, length_high, mut overlapped) = native_range(range)?;
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
            Ok(())
        } else {
            Err(classify(unsafe { GetLastError() }))
        }
    }

    fn native_range(range: ByteRange) -> Result<(u32, u32, OVERLAPPED), LockError> {
        let length = range
            .length
            .unwrap_or_else(|| u64::MAX.saturating_sub(range.start));
        if length == 0 {
            return Err(LockError::InvalidRange);
        }
        let mut overlapped = OVERLAPPED::default();
        overlapped.Anonymous.Anonymous.Offset = range.start as u32;
        overlapped.Anonymous.Anonymous.OffsetHigh = (range.start >> 32) as u32;
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
