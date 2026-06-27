use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::{vfs::normalize_vfs_path, CliError, Result};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Mount {
    pub host_path: PathBuf,
    pub canonical_host_path: Option<PathBuf>,
    pub vfs_path: String,
    pub auto_mounted: bool,
}

impl Mount {
    pub fn new(host_path: impl Into<PathBuf>, vfs_path: impl AsRef<str>) -> Result<Self> {
        let host_path = host_path.into();
        let canonical_host_path = fs::canonicalize(&host_path).ok();
        Ok(Self {
            host_path,
            canonical_host_path,
            vfs_path: normalize_vfs_path(vfs_path.as_ref())?,
            auto_mounted: false,
        })
    }

    pub fn auto(host_path: impl Into<PathBuf>, vfs_path: impl AsRef<str>) -> Result<Self> {
        let mut mount = Self::new(host_path, vfs_path)?;
        mount.auto_mounted = true;
        Ok(mount)
    }
}

pub fn parse_mount_with_delimiter_arguments(values: &[String]) -> Result<Vec<Mount>> {
    let mut mounts = Vec::with_capacity(values.len());
    for value in values {
        let parts = value.split(':').collect::<Vec<_>>();
        if parts.len() != 2 {
            return Err(CliError::new(format!(
				"Invalid mount format: {value}. Expected format: /host/path:/vfs/path. If your path contains a colon, use --mount-dir instead."
			)));
        }
        let host_path = PathBuf::from(parts[0]);
        if !host_path.exists() {
            return Err(CliError::new(format!(
                "Host path does not exist: {}",
                host_path.display()
            )));
        }
        mounts.push(Mount::new(host_path, parts[1])?);
    }
    Ok(mounts)
}

pub fn parse_mount_dir_arguments(values: &[String], cwd: &Path) -> Result<Vec<Mount>> {
    if !values.len().is_multiple_of(2) {
        return Err(CliError::new(
            "Invalid mount format. Expected: /host/path /vfs/path",
        ));
    }

    let mut mounts = Vec::with_capacity(values.len() / 2);
    for pair in values.chunks_exact(2) {
        let source = PathBuf::from(&pair[0]);
        let host_path = if source.is_absolute() {
            source
        } else {
            cwd.join(source)
        };
        if !host_path.exists() {
            return Err(CliError::new(format!(
                "Host path does not exist: {}",
                host_path.display()
            )));
        }
        mounts.push(Mount::new(host_path, &pair[1])?);
    }
    Ok(mounts)
}

pub fn get_mount_for_vfs_path<'a>(mounts: &'a [Mount], vfs_path: &str) -> Option<&'a Mount> {
    let normalized = normalize_vfs_path(vfs_path).ok()?;
    mounts.iter().find(|mount| mount.vfs_path == normalized)
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{parse_mount_dir_arguments, parse_mount_with_delimiter_arguments, Mount};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = env::temp_dir().join(format!("wp-playground-native-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn parses_delimited_mounts() {
        let dir = PathBuf::from(".");
        let value = format!("{}:/wordpress/wp-content/plugins/demo", dir.display());
        let mounts = parse_mount_with_delimiter_arguments(&[value]).unwrap();
        assert_eq!(mounts[0].host_path, dir);
        assert_eq!(mounts[0].vfs_path, "/wordpress/wp-content/plugins/demo");
    }

    #[test]
    fn caches_canonical_host_path_when_mount_is_created() {
        let dir = temp_dir("canonical");
        let mount = Mount::new(&dir, "/wordpress").unwrap();

        assert_eq!(mount.canonical_host_path, fs::canonicalize(&dir).ok());
    }

    #[test]
    fn rejects_colon_in_delimited_host_path() {
        let error = parse_mount_with_delimiter_arguments(&[
            "C:\\plugin:/wordpress/wp-content/plugins/plugin".to_string(),
        ])
        .unwrap_err();
        assert!(error.message().contains("--mount-dir"));
    }

    #[test]
    fn parses_mount_dir_pairs_relative_to_cwd() {
        let cwd = temp_dir("cwd");
        let host = cwd.join("plugin");
        fs::create_dir_all(&host).unwrap();
        let mounts = parse_mount_dir_arguments(
            &[
                "plugin".to_string(),
                "/wordpress/wp-content/plugins/plugin".to_string(),
            ],
            &cwd,
        )
        .unwrap();
        assert_eq!(mounts[0].host_path, host);
    }
}
