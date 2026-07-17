use std::{
    fs::{self, OpenOptions},
    io::{self, ErrorKind, Write},
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT_ATOMIC_WRITE_ID: AtomicU64 = AtomicU64::new(1);

/// Replaces `path` with `bytes` without exposing a missing or partially-written destination.
///
/// The temporary is created in the destination directory so the final move remains on one
/// filesystem. An unsuccessful final move leaves the old destination in place and removes the
/// temporary on a best-effort basis.
pub(crate) fn atomic_replace_file(path: &Path, bytes: &[u8]) -> io::Result<()> {
    atomic_write_file(path, |file| file.write_all(bytes))
}

/// Copies `source` to `path` without truncating either hard-linked aliases or exposing a partial
/// destination. The source is fully copied into a same-directory temporary before replacement.
pub(crate) fn atomic_copy_file(source: &Path, path: &Path) -> io::Result<()> {
    let mut source_options = OpenOptions::new();
    source_options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        source_options.custom_flags(libc::O_NOFOLLOW);
    }
    let mut source_file = source_options.open(source)?;
    atomic_write_file(path, move |destination| {
        io::copy(&mut source_file, destination).map(|_| ())
    })
}

fn atomic_write_file(
    path: &Path,
    write_contents: impl FnOnce(&mut fs::File) -> io::Result<()>,
) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(ErrorKind::InvalidInput, "write path has no parent"))?;

    for _ in 0..16 {
        let id = NEXT_ATOMIC_WRITE_ID.fetch_add(1, Ordering::Relaxed);
        let temporary = parent.join(format!(
            ".wp-playground-write.{}.{}.tmp",
            std::process::id(),
            id
        ));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.custom_flags(libc::O_NOFOLLOW).mode(0o600);
        }
        let mut file = match options.open(&temporary) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        };
        let result = (|| -> io::Result<()> {
            write_contents(&mut file)?;
            file.sync_all()?;
            drop(file);
            replace_same_directory(&temporary, path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        return result;
    }

    Err(io::Error::new(
        ErrorKind::AlreadyExists,
        "could not allocate an atomic write temporary",
    ))
}

#[cfg(not(windows))]
fn replace_same_directory(temporary: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(temporary, destination)
}

#[cfg(windows)]
fn replace_same_directory(temporary: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temporary = temporary
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    // Both paths have the same parent, so this is a same-volume replacement. In particular, do
    // not remove the destination first: a failed move must leave the previous contents visible.
    let result = unsafe {
        MoveFileExW(
            temporary.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    #[cfg(unix)]
    use super::atomic_copy_file;
    use super::atomic_replace_file;

    static NEXT_TEST_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn replaces_an_existing_file_without_leaving_a_temporary() {
        let root = test_root("replace-existing");
        fs::create_dir(&root).unwrap();
        let destination = root.join("destination");
        fs::write(&destination, b"old").unwrap();

        atomic_replace_file(&destination, b"new").unwrap();

        assert_eq!(fs::read(&destination).unwrap(), b"new");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_replacement_preserves_the_destination_and_cleans_the_temporary() {
        let root = test_root("preserve-on-failure");
        let destination = root.join("destination");
        fs::create_dir_all(&destination).unwrap();
        fs::write(destination.join("sentinel"), b"old").unwrap();

        assert!(atomic_replace_file(&destination, b"new").is_err());

        assert_eq!(fs::read(destination.join("sentinel")).unwrap(), b"old");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn copying_between_hard_links_preserves_the_source() {
        use std::os::unix::fs::MetadataExt;

        let root = test_root("copy-hard-link");
        fs::create_dir(&root).unwrap();
        let source = root.join("source");
        let destination = root.join("destination");
        fs::write(&source, b"preserved").unwrap();
        fs::hard_link(&source, &destination).unwrap();
        assert_eq!(
            fs::metadata(&source).unwrap().ino(),
            fs::metadata(&destination).unwrap().ino()
        );

        atomic_copy_file(&source, &destination).unwrap();

        assert_eq!(fs::read(&source).unwrap(), b"preserved");
        assert_eq!(fs::read(&destination).unwrap(), b"preserved");
        assert_ne!(
            fs::metadata(&source).unwrap().ino(),
            fs::metadata(&destination).unwrap().ino()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn replaces_a_destination_symlink_instead_of_following_it() {
        use std::os::unix::fs::symlink;

        let root = test_root("replace-symlink");
        fs::create_dir(&root).unwrap();
        let outside = root.join("outside");
        let destination = root.join("destination");
        fs::write(&outside, b"outside").unwrap();
        symlink(&outside, &destination).unwrap();

        atomic_replace_file(&destination, b"replacement").unwrap();

        assert_eq!(fs::read(&outside).unwrap(), b"outside");
        assert_eq!(fs::read(&destination).unwrap(), b"replacement");
        assert!(!fs::symlink_metadata(&destination)
            .unwrap()
            .file_type()
            .is_symlink());
        fs::remove_dir_all(root).unwrap();
    }

    fn test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "wp-playground-native-atomic-file-test-{label}-{}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos(),
            NEXT_TEST_ID.fetch_add(1, Ordering::Relaxed)
        ))
    }
}
