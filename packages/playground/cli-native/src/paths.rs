use std::path::{Path, PathBuf};

use crate::{
    mount::{get_mount_for_vfs_path, Mount},
    sha256::sha256_hex,
    CliError, Result,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WordPressInstallMode {
    DownloadAndInstall,
    InstallFromExistingFiles,
    InstallFromExistingFilesIfNeeded,
    DoNotAttemptInstalling,
}

impl WordPressInstallMode {
    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "download-and-install" => Ok(Self::DownloadAndInstall),
            "install-from-existing-files" => Ok(Self::InstallFromExistingFiles),
            "install-from-existing-files-if-needed" => Ok(Self::InstallFromExistingFilesIfNeeded),
            "do-not-attempt-installing" => Ok(Self::DoNotAttemptInstalling),
            _ => Err(CliError::new(format!(
                "Invalid --wordpress-install-mode value \"{value}\""
            ))),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::DownloadAndInstall => "download-and-install",
            Self::InstallFromExistingFiles => "install-from-existing-files",
            Self::InstallFromExistingFilesIfNeeded => "install-from-existing-files-if-needed",
            Self::DoNotAttemptInstalling => "do-not-attempt-installing",
        }
    }
}

pub fn persistent_site_path(home_dir: &Path, site_identity_path: &Path) -> PathBuf {
    home_dir
        .join(".wordpress-playground")
        .join("sites")
        .join(sha256_hex(site_identity_path.to_string_lossy().as_bytes()))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SiteStorage {
    Managed(PathBuf),
    ExplicitMount(PathBuf),
}

pub fn resolve_site_storage(
    home_dir: &Path,
    site_identity_path: &Path,
    mounts: &[Mount],
    mounts_before_install: &[Mount],
) -> SiteStorage {
    if let Some(mount) = get_mount_for_vfs_path(mounts_before_install, "/wordpress")
        .or_else(|| get_mount_for_vfs_path(mounts, "/wordpress"))
    {
        return SiteStorage::ExplicitMount(mount.host_path.clone());
    }
    SiteStorage::Managed(persistent_site_path(home_dir, site_identity_path))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::{
        mount::Mount,
        paths::{persistent_site_path, resolve_site_storage, SiteStorage},
    };

    #[test]
    fn hashes_persistent_site_path() {
        let home = PathBuf::from("/home/example");
        let site = PathBuf::from("/tmp/my-plugin");
        assert_eq!(
            persistent_site_path(&home, &site),
            home.join(".wordpress-playground")
                .join("sites")
                .join("1a1e26088dc26f5fa4dd7086e6c3e3da26ed2c3a908b2657f63a93d83b395850")
        );
    }

    #[test]
    fn explicit_wordpress_mount_wins_over_managed_path() {
        let mount = Mount::new("/site", "/wordpress").unwrap();
        let storage = resolve_site_storage(
            &PathBuf::from("/home/example"),
            &PathBuf::from("/cwd"),
            &[],
            &[mount],
        );
        assert_eq!(storage, SiteStorage::ExplicitMount(PathBuf::from("/site")));
    }
}
