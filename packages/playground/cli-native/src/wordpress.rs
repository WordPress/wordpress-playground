use std::{
    fs, io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;
use zip::ZipArchive;

use crate::{
    args::{CliOptions, DefinedConstant},
    download::{cached_download_with_validator, url_cache_key},
    host::PhpConstantValue,
    mount::Mount,
    paths::WordPressInstallMode,
    CliError, Result,
};

const WORDPRESS_BUILDS_DIR: &str = "packages/playground/wordpress-builds/src/wordpress";
const SQLITE_BUILDS_DIR: &str =
    "packages/playground/wordpress-builds/src/sqlite-database-integration";
const SQLITE_PLUGIN_VFS_PATH: &str = "/wordpress/wp-content/plugins/sqlite-database-integration";
const WORDPRESS_VERSION_CHECK_URL: &str =
    "https://api.wordpress.org/core/version-check/1.7/?channel=beta";
const WORDPRESS_TRUNK_ZIP_URL: &str =
    "https://github.com/WordPress/WordPress/archive/refs/heads/master.zip";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedWordPress {
    pub document_root: PathBuf,
    pub installed_files_available: bool,
}

pub fn ensure_wordpress_mount(mounts: &mut Vec<Mount>) -> Result<PathBuf> {
    if let Some(path) = wordpress_mount_path(mounts) {
        fs::create_dir_all(&path)?;
        return Ok(path);
    }

    let path = std::env::temp_dir().join(format!(
        "wp-playground-native-wordpress-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    fs::create_dir_all(&path)?;
    mounts.push(Mount::new(path.clone(), "/wordpress")?);
    Ok(path)
}

pub fn prepare_wordpress(
    repo_root: &Path,
    options: &CliOptions,
    mounts: &[Mount],
) -> Result<PreparedWordPress> {
    let document_root = wordpress_mount_path(mounts)
        .ok_or_else(|| CliError::new("Missing /wordpress mount after preparation"))?;
    fs::create_dir_all(&document_root)?;

    match options.wordpress_install_mode {
        WordPressInstallMode::DownloadAndInstall => {
            let zip_path = wordpress_zip(repo_root, &options.wp)?;
            extract_wordpress_zip_without_overwriting(&zip_path, &document_root)?;
        }
        WordPressInstallMode::InstallFromExistingFiles
        | WordPressInstallMode::InstallFromExistingFilesIfNeeded => {
            if !contains_wordpress_files(&document_root) {
                return Err(CliError::new(format!(
                    "The /wordpress mount does not contain a WordPress tree: {}",
                    document_root.display()
                )));
            }
        }
        WordPressInstallMode::DoNotAttemptInstalling => {}
    }

    ensure_wp_config(&document_root)?;
    if !options.skip_sqlite_setup {
        ensure_sqlite_integration(repo_root, &document_root, &options.php)?;
    }

    Ok(PreparedWordPress {
        installed_files_available: contains_wordpress_files(&document_root),
        document_root,
    })
}

pub fn wordpress_mount_path(mounts: &[Mount]) -> Option<PathBuf> {
    mounts
        .iter()
        .find(|mount| mount.vfs_path == "/wordpress")
        .map(|mount| mount.host_path.clone())
}

pub fn defined_constants_for_host(
    constants: &[DefinedConstant],
    document_root: Option<&Path>,
) -> Vec<(String, PhpConstantValue)> {
    constants
        .iter()
        .filter(|constant| {
            !constant.is_default
                || !document_root
                    .is_some_and(|root| wp_config_defines_constant(root, &constant.name))
        })
        .map(DefinedConstant::as_host_pair)
        .collect()
}

fn wp_config_defines_constant(document_root: &Path, name: &str) -> bool {
    let path = document_root.join("wp-config.php");
    let Ok(contents) = fs::read_to_string(path) else {
        return false;
    };
    contents
        .lines()
        .any(|line| line_defines_constant(line, name))
}

fn line_defines_constant(line: &str, name: &str) -> bool {
    let Some(after_define) = line.trim_start().strip_prefix("define") else {
        return false;
    };
    let after_define = after_define.trim_start();
    let Some(after_paren) = after_define.strip_prefix('(') else {
        return false;
    };
    let after_paren = after_paren.trim_start();
    for quote in ['\'', '"'] {
        let Some(after_quote) = after_paren.strip_prefix(quote) else {
            continue;
        };
        let Some(after_name) = after_quote.strip_prefix(name) else {
            continue;
        };
        if after_name.starts_with(quote) {
            return true;
        }
    }
    false
}

pub fn contains_wordpress_files(path: &Path) -> bool {
    path.join("wp-admin").is_dir()
        && path.join("wp-includes").is_dir()
        && path.join("wp-content").is_dir()
}

fn wordpress_zip(repo_root: &Path, wp: &str) -> Result<PathBuf> {
    if let Some(path) = bundled_wordpress_zip_if_available(repo_root, wp)? {
        return Ok(path);
    }

    let release = resolve_wordpress_release(wp)?;
    cached_download_with_validator(
        &release.release_url,
        &format!("{}.zip", release.version),
        validate_wordpress_zip,
    )
}

fn bundled_wordpress_zip_if_available(repo_root: &Path, wp: &str) -> Result<Option<PathBuf>> {
    let version = match wp {
        "latest" => match latest_bundled_wordpress_version(repo_root) {
            Ok(version) => version,
            Err(_) => return Ok(None),
        },
        "beta" => "beta".to_string(),
        "trunk" | "nightly" => return Ok(None),
        value if is_http_url(value) => return Ok(None),
        value => bundled_version_prefix(value),
    };

    let filename = if version == "beta" {
        "wp-beta.zip".to_string()
    } else {
        format!("wp-{version}.zip")
    };
    let path = repo_root.join(WORDPRESS_BUILDS_DIR).join(filename);
    if path.is_file() {
        validate_wordpress_zip(&path)?;
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WordPressRelease {
    release_url: String,
    version: String,
}

#[derive(Debug, Deserialize)]
struct VersionCheckResponse {
    offers: Vec<VersionOffer>,
}

#[derive(Debug, Deserialize)]
struct VersionOffer {
    version: String,
    download: String,
    response: String,
}

fn resolve_wordpress_release(version_query: &str) -> Result<WordPressRelease> {
    if is_http_url(version_query) {
        return Ok(WordPressRelease {
            release_url: version_query.to_string(),
            version: url_cache_key("custom", version_query, ""),
        });
    }
    if matches!(version_query, "trunk" | "nightly") {
        return Ok(WordPressRelease {
            release_url: format!("{WORDPRESS_TRUNK_ZIP_URL}?ts={}", current_utc_date_string()),
            version: "trunk".to_string(),
        });
    }

    let offers = fetch_wordpress_version_offers()?;
    Ok(
        resolve_wordpress_release_from_offers(version_query, &offers).unwrap_or_else(|| {
            let normalized = normalize_inferred_release_version(version_query);
            WordPressRelease {
                release_url: format!("https://wordpress.org/wordpress-{normalized}.zip"),
                version: normalized,
            }
        }),
    )
}

fn fetch_wordpress_version_offers() -> Result<Vec<VersionOffer>> {
    let bytes = crate::download::download_bytes(WORDPRESS_VERSION_CHECK_URL)?;
    let response: VersionCheckResponse = serde_json::from_slice(&bytes).map_err(|error| {
        CliError::new(format!(
            "Failed to parse WordPress version-check response: {error}"
        ))
    })?;
    Ok(response
        .offers
        .into_iter()
        .filter(|offer| offer.response == "autoupdate")
        .collect())
}

fn resolve_wordpress_release_from_offers(
    version_query: &str,
    offers: &[VersionOffer],
) -> Option<WordPressRelease> {
    for offer in offers {
        if version_query == "beta"
            && (offer.version.contains("beta") || offer.version.contains("RC"))
        {
            return Some(WordPressRelease {
                release_url: offer.download.clone(),
                version: offer.version.clone(),
            });
        }
        if version_query == "latest"
            && !offer.version.contains("beta")
            && !offer.version.contains("RC")
        {
            return Some(WordPressRelease {
                release_url: offer.download.clone(),
                version: offer.version.clone(),
            });
        }
        if offer.version.starts_with(version_query) {
            return Some(WordPressRelease {
                release_url: offer.download.clone(),
                version: offer.version.clone(),
            });
        }
    }
    None
}

fn normalize_inferred_release_version(version: &str) -> String {
    if version_matches_patch_zero(version) {
        version.split('.').take(2).collect::<Vec<_>>().join(".")
    } else {
        version.to_string()
    }
}

fn version_matches_patch_zero(version: &str) -> bool {
    let parts = version.split('.').collect::<Vec<_>>();
    parts.len() == 3
        && parts[0].chars().all(|character| character.is_ascii_digit())
        && parts[1].chars().all(|character| character.is_ascii_digit())
        && parts[2] == "0"
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

fn current_utc_date_string() -> String {
    let days = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        / 86_400;
    let (year, month, day) = civil_from_unix_days(days as i64);
    format!("{year:04}-{month:02}-{day:02}")
}

fn civil_from_unix_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = year + if month <= 2 { 1 } else { 0 };
    (year as i32, month as u32, day as u32)
}

fn latest_bundled_wordpress_version(repo_root: &Path) -> Result<String> {
    let dir = repo_root.join(WORDPRESS_BUILDS_DIR);
    let mut versions = fs::read_dir(&dir)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter_map(|path| {
            let name = path.file_name()?.to_str()?;
            let version = name.strip_prefix("wp-")?.strip_suffix(".zip")?;
            (version != "beta").then(|| version.to_string())
        })
        .collect::<Vec<_>>();
    versions.sort_by_key(|version| version_sort_key(version));
    versions.pop().ok_or_else(|| {
        CliError::new(format!(
            "No bundled WordPress ZIPs found in {}",
            dir.display()
        ))
    })
}

fn bundled_version_prefix(value: &str) -> String {
    let parts = value.split('.').take(2).collect::<Vec<_>>();
    if parts.len() == 2 {
        parts.join(".")
    } else {
        value.to_string()
    }
}

fn version_sort_key(version: &str) -> Vec<u16> {
    version
        .split('.')
        .map(|part| part.parse::<u16>().unwrap_or(0))
        .collect()
}

fn extract_wordpress_zip_without_overwriting(zip_path: &Path, document_root: &Path) -> Result<()> {
    validate_wordpress_zip(zip_path)?;
    let file = fs::File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| CliError::new(format!("Failed to read WordPress ZIP: {error}")))?;
    let prefix = detect_wordpress_zip_prefix(&mut archive)?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read ZIP entry {index}: {error}")))?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let Some(relative) = strip_zip_prefix(&enclosed_name, prefix.as_deref()) else {
            continue;
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let target = document_root.join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&target)?;
            continue;
        }
        if target.exists() {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = fs::File::create(&target)?;
        io::copy(&mut entry, &mut output)?;
    }

    Ok(())
}

pub(crate) fn validate_wordpress_zip(zip_path: &Path) -> Result<()> {
    let file = fs::File::open(zip_path).map_err(|error| {
        CliError::new(format!(
            "Failed to open WordPress ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    let mut archive = ZipArchive::new(file).map_err(|error| {
        CliError::new(format!(
            "Failed to read WordPress ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    let prefix = detect_wordpress_zip_prefix(&mut archive)?;
    for required in [
        "wp-config-sample.php",
        "wp-load.php",
        "wp-admin/install.php",
        "wp-includes/version.php",
        "wp-content/",
    ] {
        if !zip_contains_entry(&mut archive, prefix.as_deref(), required)? {
            return Err(CliError::new(format!(
                "WordPress ZIP {} is missing required entry {required}",
                zip_path.display()
            )));
        }
    }
    validate_zip_entries_readable(
        &mut archive,
        &format!("WordPress ZIP {}", zip_path.display()),
    )?;
    Ok(())
}

fn extract_zip_prefix_without_overwriting(
    zip_path: &Path,
    destination: &Path,
    prefix: Option<&Path>,
) -> Result<()> {
    let file = fs::File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| CliError::new(format!("Failed to read ZIP: {error}")))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read ZIP entry {index}: {error}")))?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let Some(relative) = strip_zip_prefix(&enclosed_name, prefix) else {
            continue;
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let target = destination.join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&target)?;
            continue;
        }
        if target.exists() {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = fs::File::create(&target)?;
        io::copy(&mut entry, &mut output)?;
    }
    Ok(())
}

fn detect_wordpress_zip_prefix(archive: &mut ZipArchive<fs::File>) -> Result<Option<PathBuf>> {
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read ZIP entry {index}: {error}")))?;
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        if name.file_name().and_then(|name| name.to_str()) == Some("wp-config-sample.php") {
            return Ok(name
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
                .map(Path::to_path_buf));
        }
    }
    Ok(None)
}

fn strip_zip_prefix(path: &Path, prefix: Option<&Path>) -> Option<PathBuf> {
    if let Some(prefix) = prefix {
        path.strip_prefix(prefix).ok().map(Path::to_path_buf)
    } else {
        Some(path.to_path_buf())
    }
}

pub(crate) fn ensure_wp_config(document_root: &Path) -> Result<()> {
    let wp_config = document_root.join("wp-config.php");
    if !wp_config.exists() || wp_config_is_stock_sample(&wp_config)? {
        fs::write(wp_config, playground_wp_config())?;
    }
    Ok(())
}

fn wp_config_is_stock_sample(path: &Path) -> Result<bool> {
    let contents = fs::read_to_string(path)?;
    Ok(contents.contains("database_name_here")
        && contents.contains("username_here")
        && contents.contains("put your unique phrase here"))
}

fn playground_wp_config() -> &'static str {
    r#"<?php
if ( ! defined( 'CONCATENATE_SCRIPTS' ) ) { define( 'CONCATENATE_SCRIPTS', false ); }
if ( ! defined( 'DB_NAME' ) ) { define( 'DB_NAME', 'wordpress' ); }
if ( ! defined( 'DB_USER' ) ) { define( 'DB_USER', 'root' ); }
if ( ! defined( 'DB_PASSWORD' ) ) { define( 'DB_PASSWORD', '' ); }
if ( ! defined( 'DB_HOST' ) ) { define( 'DB_HOST', 'localhost' ); }
if ( ! defined( 'DB_CHARSET' ) ) { define( 'DB_CHARSET', 'utf8mb4' ); }
if ( ! defined( 'DB_COLLATE' ) ) { define( 'DB_COLLATE', '' ); }

$table_prefix = 'wp_';

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
"#
}

fn ensure_sqlite_database_scaffold(document_root: &Path) -> Result<()> {
    let database = document_root.join("wp-content").join("database");
    fs::create_dir_all(&database)?;
    let htaccess = database.join(".htaccess");
    if !htaccess.exists() {
        fs::write(&htaccess, "Deny from all\n")?;
    }
    let index = database.join("index.php");
    if !index.exists() {
        fs::write(&index, "<?php\n// Silence is golden.\n")?;
    }
    Ok(())
}

fn ensure_sqlite_integration(
    repo_root: &Path,
    document_root: &Path,
    php_version: &str,
) -> Result<()> {
    ensure_sqlite_database_scaffold(document_root)?;
    let sqlite_zip = bundled_sqlite_zip(repo_root, php_version)?;
    let plugin_dir = document_root
        .join("wp-content")
        .join("plugins")
        .join("sqlite-database-integration");
    fs::create_dir_all(&plugin_dir)?;
    extract_zip_prefix_without_overwriting(
        &sqlite_zip,
        &plugin_dir,
        Some(sqlite_zip_prefix(&sqlite_zip)?),
    )?;
    patch_sqlite_driver_compatibility(&plugin_dir)?;
    write_sqlite_dropin(document_root, &plugin_dir)
}

fn bundled_sqlite_zip(repo_root: &Path, php_version: &str) -> Result<PathBuf> {
    let filename = if php_version == "5.2" {
        "sqlite-database-integration-v3.0.0-rc.3-php52.zip"
    } else {
        "sqlite-database-integration-trunk.zip"
    };
    let path = repo_root.join(SQLITE_BUILDS_DIR).join(filename);
    if !path.is_file() {
        return Err(CliError::new(format!(
            "SQLite integration ZIP is missing: {}",
            path.display()
        )));
    }
    validate_sqlite_zip(&path)?;
    Ok(path)
}

pub(crate) fn validate_sqlite_zip(zip_path: &Path) -> Result<()> {
    let prefix = sqlite_zip_prefix(zip_path)?;
    let file = fs::File::open(zip_path).map_err(|error| {
        CliError::new(format!(
            "Failed to open SQLite integration ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    let mut archive = ZipArchive::new(file).map_err(|error| {
        CliError::new(format!(
            "Failed to read SQLite integration ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    for required in [
        "db.copy",
        "load.php",
        "wp-includes/sqlite/class-wp-sqlite-db.php",
    ] {
        if !zip_contains_entry(&mut archive, Some(prefix), required)? {
            return Err(CliError::new(format!(
                "SQLite integration ZIP {} is missing required entry {}/{}",
                zip_path.display(),
                path_to_zip_slashes(prefix),
                required
            )));
        }
    }
    validate_zip_entries_readable(
        &mut archive,
        &format!("SQLite integration ZIP {}", zip_path.display()),
    )?;
    Ok(())
}

fn sqlite_zip_prefix(zip_path: &Path) -> Result<&'static Path> {
    match zip_path.file_name().and_then(|name| name.to_str()) {
        Some("sqlite-database-integration-v2.1.16.zip") => {
            Ok(Path::new("sqlite-database-integration-2.1.16"))
        }
        Some("sqlite-database-integration-v3.0.0-rc.3-php52.zip")
        | Some("sqlite-database-integration-v3.0.0-rc.3.zip")
        | Some("sqlite-database-integration-trunk.zip") => {
            Ok(Path::new("plugin-sqlite-database-integration"))
        }
        Some(filename) => Err(CliError::new(format!(
            "Unsupported SQLite integration ZIP layout: {filename}"
        ))),
        None => Err(CliError::new("SQLite integration ZIP path has no filename")),
    }
}

fn zip_contains_entry<R: io::Read + io::Seek>(
    archive: &mut ZipArchive<R>,
    prefix: Option<&Path>,
    relative: &str,
) -> Result<bool> {
    let mut path = match prefix {
        Some(prefix) => path_to_zip_slashes(&prefix.join(relative)),
        None => relative.to_string(),
    };
    if relative.ends_with('/') && !path.ends_with('/') {
        path.push('/');
    }
    match archive.by_name(&path) {
        Ok(_) => Ok(true),
        Err(zip::result::ZipError::FileNotFound) => Ok(false),
        Err(error) => Err(CliError::new(format!(
            "Failed to inspect ZIP entry {path}: {error}"
        ))),
    }
}

fn validate_zip_entries_readable<R: io::Read + io::Seek>(
    archive: &mut ZipArchive<R>,
    label: &str,
) -> Result<()> {
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            CliError::new(format!("{label} has unreadable ZIP entry {index}: {error}"))
        })?;
        if entry.is_dir() {
            continue;
        }
        io::copy(&mut entry, &mut io::sink()).map_err(|error| {
            CliError::new(format!(
                "{label} has unreadable contents in entry {}: {error}",
                entry.name()
            ))
        })?;
    }
    Ok(())
}

fn path_to_zip_slashes(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn patch_sqlite_driver_compatibility(plugin_dir: &Path) -> Result<()> {
    let sqlite_db = plugin_dir
        .join("wp-includes")
        .join("sqlite")
        .join("class-wp-sqlite-db.php");
    if !sqlite_db.is_file() {
        return Ok(());
    }
    let source = fs::read_to_string(&sqlite_db)?;
    let patched = source.replace(
        "private $allow_unsafe_unquoted_parameters",
        "protected $allow_unsafe_unquoted_parameters",
    );
    if patched != source {
        fs::write(sqlite_db, patched)?;
    }

    let install_functions = plugin_dir
        .join("wp-includes")
        .join("sqlite")
        .join("install-functions.php");
    if !install_functions.is_file() {
        return Ok(());
    }
    let source = fs::read_to_string(&install_functions)?;
    let patched = source
        .replace(
            "\t\t$translator->begin_transaction();",
            "\t\t// The translator wraps individual DDL statements; an outer install transaction trips SQLite under Wasmtime.",
        )
        .replace("\t\t$translator->commit();", "\t\t// Outer install commit disabled.")
        .replace(
            "\t\t$translator->rollback();",
            "\t\t// Outer install rollback disabled.",
        );
    if patched != source {
        fs::write(install_functions, patched)?;
    }
    Ok(())
}

fn write_sqlite_dropin(document_root: &Path, plugin_dir: &Path) -> Result<()> {
    let db_copy = plugin_dir.join("db.copy");
    if !db_copy.is_file() {
        return Err(CliError::new(format!(
            "SQLite integration db.copy is missing: {}",
            db_copy.display()
        )));
    }
    let mut db_php = fs::read_to_string(db_copy)?
        .replace(
            "'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
            &php_string_literal(SQLITE_PLUGIN_VFS_PATH),
        )
        .replace(
            "'{SQLITE_PLUGIN}'",
            &php_string_literal("sqlite-database-integration/load.php"),
        );
    db_php = db_php.replacen(
        "<?php",
        "<?php\nif ( ! defined( 'SQLITE_MAIN_FILE' ) ) { define( 'SQLITE_MAIN_FILE', '1' ); }",
        1,
    );
    fs::write(document_root.join("wp-content").join("db.php"), db_php)?;
    Ok(())
}

fn php_string_literal(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "\\'"))
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        io::Write,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{
        bundled_version_prefix, civil_from_unix_days, contains_wordpress_files,
        defined_constants_for_host, ensure_sqlite_database_scaffold, ensure_sqlite_integration,
        ensure_wp_config, extract_wordpress_zip_without_overwriting,
        latest_bundled_wordpress_version, normalize_inferred_release_version,
        resolve_wordpress_release_from_offers, validate_sqlite_zip, validate_wordpress_zip,
        version_matches_patch_zero, wordpress_zip, VersionOffer,
    };
    use crate::{
        args::{DefinedConstant, DefinedConstantKind},
        host::PhpConstantValue,
    };
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("wp-playground-native-wordpress-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_zip(path: &std::path::Path, entries: &[(&str, &[u8])]) {
        let file = fs::File::create(path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        for (name, contents) in entries {
            if name.ends_with('/') {
                zip.add_directory(*name, options).unwrap();
            } else {
                zip.start_file(*name, options).unwrap();
                zip.write_all(contents).unwrap();
            }
        }
        zip.finish().unwrap();
    }

    #[test]
    fn detects_full_wordpress_tree() {
        let dir = temp_dir("tree");
        fs::create_dir_all(dir.join("wp-admin")).unwrap();
        fs::create_dir_all(dir.join("wp-includes")).unwrap();
        fs::create_dir_all(dir.join("wp-content")).unwrap();

        assert!(contains_wordpress_files(&dir));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn writes_playground_wp_config_when_missing() {
        let dir = temp_dir("config");

        ensure_wp_config(&dir).unwrap();

        let config = fs::read_to_string(dir.join("wp-config.php")).unwrap();
        assert!(config.contains("define( 'DB_NAME', 'wordpress' );"));
        assert!(config.contains("require_once ABSPATH . 'wp-settings.php';"));
        assert!(!config.contains("database_name_here"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn replaces_stock_sample_wp_config_from_release_zip() {
        let dir = temp_dir("stock-config");
        fs::write(
            dir.join("wp-config.php"),
            "<?php\ndefine( 'DB_NAME', 'database_name_here' );\ndefine( 'DB_USER', 'username_here' );\ndefine( 'AUTH_KEY', 'put your unique phrase here' );\n",
        )
        .unwrap();

        ensure_wp_config(&dir).unwrap();

        let config = fs::read_to_string(dir.join("wp-config.php")).unwrap();
        assert!(config.contains("define( 'DB_NAME', 'wordpress' );"));
        assert!(!config.contains("database_name_here"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn preserves_custom_wp_config() {
        let dir = temp_dir("custom-config");
        fs::write(
            dir.join("wp-config.php"),
            "<?php define( 'DB_NAME', 'custom' );\n",
        )
        .unwrap();

        ensure_wp_config(&dir).unwrap();

        assert_eq!(
            fs::read_to_string(dir.join("wp-config.php")).unwrap(),
            "<?php define( 'DB_NAME', 'custom' );\n"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn default_debug_constants_do_not_override_wp_config_definitions() {
        let dir = temp_dir("debug-constants");
        fs::write(
            dir.join("wp-config.php"),
            "<?php\ndefine( 'WP_DEBUG', false );\ndefine(\"WP_DEBUG_DISPLAY\", true);\n",
        )
        .unwrap();
        let constants = vec![
            DefinedConstant {
                name: "WP_DEBUG".to_string(),
                value: PhpConstantValue::bool(true),
                kind: DefinedConstantKind::Bool,
                is_default: true,
            },
            DefinedConstant {
                name: "WP_DEBUG_LOG".to_string(),
                value: PhpConstantValue::bool(true),
                kind: DefinedConstantKind::Bool,
                is_default: true,
            },
            DefinedConstant {
                name: "WP_DEBUG_DISPLAY".to_string(),
                value: PhpConstantValue::bool(false),
                kind: DefinedConstantKind::Bool,
                is_default: true,
            },
            DefinedConstant {
                name: "USER_DEFINED".to_string(),
                value: PhpConstantValue::bool(true),
                kind: DefinedConstantKind::Bool,
                is_default: false,
            },
        ];

        let filtered = defined_constants_for_host(&constants, Some(&dir));

        assert!(!filtered.iter().any(|(name, _)| name == "WP_DEBUG"));
        assert!(!filtered.iter().any(|(name, _)| name == "WP_DEBUG_DISPLAY"));
        assert!(filtered.iter().any(|(name, _)| name == "WP_DEBUG_LOG"));
        assert!(filtered.iter().any(|(name, _)| name == "USER_DEFINED"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn creates_sqlite_database_guard_files() {
        let dir = temp_dir("sqlite");

        ensure_sqlite_database_scaffold(&dir).unwrap();

        assert!(dir.join("wp-content/database/.htaccess").is_file());
        assert!(dir.join("wp-content/database/index.php").is_file());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn maps_patch_versions_to_bundled_minor_zip() {
        assert_eq!(bundled_version_prefix("6.8.3"), "6.8");
        assert_eq!(bundled_version_prefix("6.8"), "6.8");
    }

    #[test]
    fn normalizes_inferred_patch_zero_versions() {
        assert!(version_matches_patch_zero("6.8.0"));
        assert_eq!(normalize_inferred_release_version("6.8.0"), "6.8");
        assert_eq!(normalize_inferred_release_version("6.8.1"), "6.8.1");
        assert_eq!(normalize_inferred_release_version("6.8-RC1"), "6.8-RC1");
    }

    #[test]
    fn resolves_wordpress_releases_from_api_offers() {
        let offers = vec![
            VersionOffer {
                version: "6.9-RC1".to_string(),
                download: "https://wordpress.org/wordpress-6.9-RC1.zip".to_string(),
                response: "autoupdate".to_string(),
            },
            VersionOffer {
                version: "6.8.3".to_string(),
                download: "https://wordpress.org/wordpress-6.8.3.zip".to_string(),
                response: "autoupdate".to_string(),
            },
            VersionOffer {
                version: "6.7.1".to_string(),
                download: "https://wordpress.org/wordpress-6.7.1.zip".to_string(),
                response: "autoupdate".to_string(),
            },
        ];

        let latest = resolve_wordpress_release_from_offers("latest", &offers).unwrap();
        assert_eq!(latest.version, "6.8.3");
        assert_eq!(
            latest.release_url,
            "https://wordpress.org/wordpress-6.8.3.zip"
        );

        let beta = resolve_wordpress_release_from_offers("beta", &offers).unwrap();
        assert_eq!(beta.version, "6.9-RC1");

        let minor = resolve_wordpress_release_from_offers("6.7", &offers).unwrap();
        assert_eq!(
            minor.release_url,
            "https://wordpress.org/wordpress-6.7.1.zip"
        );
    }

    #[test]
    fn formats_dates_from_unix_days() {
        assert_eq!(civil_from_unix_days(0), (1970, 1, 1));
        assert_eq!(civil_from_unix_days(20_000), (2024, 10, 4));
    }

    #[test]
    fn finds_latest_bundled_wordpress_asset() {
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .unwrap()
            .to_path_buf();
        let latest = latest_bundled_wordpress_version(&repo_root).unwrap();

        assert!(!latest.is_empty());
    }

    #[test]
    fn extracts_bundled_wordpress_without_overwriting_existing_files() {
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .unwrap()
            .to_path_buf();
        let dir = temp_dir("extract");
        fs::write(dir.join("index.php"), "existing").unwrap();
        let zip = wordpress_zip(&repo_root, "6.3").unwrap();

        extract_wordpress_zip_without_overwriting(&zip, &dir).unwrap();

        assert!(contains_wordpress_files(&dir));
        assert!(dir.join("wp-load.php").is_file());
        assert_eq!(
            fs::read_to_string(dir.join("index.php")).unwrap(),
            "existing"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validates_wordpress_zip_structure() {
        let dir = temp_dir("validate-wp");
        let valid = dir.join("wordpress.zip");
        write_zip(
            &valid,
            &[
                ("wordpress/wp-config-sample.php", b"<?php"),
                ("wordpress/wp-load.php", b"<?php"),
                ("wordpress/wp-admin/install.php", b"<?php"),
                ("wordpress/wp-includes/version.php", b"<?php"),
                ("wordpress/wp-content/", b""),
            ],
        );
        let missing = dir.join("missing.zip");
        write_zip(&missing, &[("wordpress/wp-load.php", b"<?php")]);
        let corrupt = dir.join("corrupt.zip");
        fs::write(&corrupt, b"not a zip").unwrap();

        validate_wordpress_zip(&valid).unwrap();
        assert!(validate_wordpress_zip(&missing)
            .unwrap_err()
            .to_string()
            .contains("missing required entry"));
        assert!(validate_wordpress_zip(&corrupt)
            .unwrap_err()
            .to_string()
            .contains("Failed to read WordPress ZIP"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validates_sqlite_zip_structure() {
        let dir = temp_dir("validate-sqlite");
        let valid = dir.join("sqlite-database-integration-trunk.zip");
        write_zip(
            &valid,
            &[
                ("plugin-sqlite-database-integration/db.copy", b"<?php"),
                ("plugin-sqlite-database-integration/load.php", b"<?php"),
                (
                    "plugin-sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-db.php",
                    b"<?php",
                ),
            ],
        );
        let missing = dir.join("sqlite-database-integration-v3.0.0-rc.3.zip");
        write_zip(
            &missing,
            &[("plugin-sqlite-database-integration/load.php", b"<?php")],
        );
        let corrupt = dir.join("sqlite-database-integration-v3.0.0-rc.3-php52.zip");
        fs::write(&corrupt, b"not a zip").unwrap();

        validate_sqlite_zip(&valid).unwrap();
        assert!(validate_sqlite_zip(&missing)
            .unwrap_err()
            .to_string()
            .contains("missing required entry"));
        assert!(validate_sqlite_zip(&corrupt)
            .unwrap_err()
            .to_string()
            .contains("Failed to read SQLite integration ZIP"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn prepares_sqlite_integration_dropin_from_bundled_zip() {
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .unwrap()
            .to_path_buf();
        let dir = temp_dir("sqlite-integration");

        ensure_sqlite_integration(&repo_root, &dir, "8.5").unwrap();

        let db_php = fs::read_to_string(dir.join("wp-content/db.php")).unwrap();
        assert!(db_php.contains("SQLITE_MAIN_FILE"));
        assert!(db_php.contains("/wordpress/wp-content/plugins/sqlite-database-integration"));
        assert!(dir
            .join("wp-content/plugins/sqlite-database-integration/load.php")
            .is_file());
        let sqlite_db = fs::read_to_string(
            dir.join(
                "wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-db.php",
            ),
        )
        .unwrap();
        assert!(sqlite_db.contains("protected $allow_unsafe_unquoted_parameters"));
        let install_functions = fs::read_to_string(
            dir.join(
                "wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/install-functions.php",
            ),
        )
        .unwrap();
        assert!(install_functions.contains("Outer install commit disabled."));
        assert!(dir.join("wp-content/database/.htaccess").is_file());
        let _ = fs::remove_dir_all(dir);
    }
}
