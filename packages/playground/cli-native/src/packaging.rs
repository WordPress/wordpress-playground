use std::{
    env, fs,
    io::{BufRead, BufReader, Read, Write},
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use crate::{
    args::SUPPORTED_PHP_VERSIONS,
    assets::{
        find_php_assets_manifest, load_php_assets_manifest, select_php_asset, sha256_file,
        verify_file_asset, AssetManifest, FileAsset, SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH,
    },
    runtime::{
        asset_root_from_manifest_dir, precompile_wasm_module_for_target, WasmEngineProfile,
        ASSET_ROOT_ENV_VAR, DISABLE_SOURCE_FALLBACK_ENV_VAR,
    },
    sha256::sha256_hex,
    wordpress::{validate_sqlite_zip, validate_wordpress_zip},
    CliError, Result,
};

pub const PACKAGE_SHARE_DIR: &str = "share/wp-playground-native";
const WORDPRESS_BUILDS_DIR: &str = "packages/playground/wordpress-builds/src/wordpress";
const SQLITE_BUILDS_DIR: &str =
    "packages/playground/wordpress-builds/src/sqlite-database-integration";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageOptions {
    pub binary_path: PathBuf,
    pub asset_root: PathBuf,
    pub out_dir: PathBuf,
    pub package_name: String,
    pub php_versions: Vec<String>,
    pub include_wordpress_assets: bool,
    pub create_archive: bool,
    pub precompile_wasmtime: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageSummary {
    pub package_root: PathBuf,
    pub binary_path: PathBuf,
    pub asset_root: PathBuf,
    pub package_manifest_path: PathBuf,
    pub archive_path: Option<PathBuf>,
    pub archive_checksum_path: Option<PathBuf>,
    pub archive_manifest_path: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageManifest {
    pub schema_version: u32,
    pub package_name: String,
    pub version: String,
    pub target_triple: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_commit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rustc_version: Option<String>,
    pub binary: PackageFileManifest,
    pub files: Vec<PackageFileManifest>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive: Option<PackageArchiveManifest>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageFileManifest {
    pub path: String,
    pub kind: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageArchiveManifest {
    pub file_name: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub checksum_file_name: String,
}

impl Default for PackageOptions {
    fn default() -> Self {
        Self {
            binary_path: default_release_binary_path(),
            asset_root: asset_root_from_manifest_dir(),
            out_dir: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join("package"),
            package_name: default_package_name(),
            php_versions: Vec::new(),
            include_wordpress_assets: true,
            create_archive: true,
            precompile_wasmtime: false,
        }
    }
}

pub fn default_package_name() -> String {
    format!(
        "wp-playground-native-{}-{}-{}",
        package_version(),
        target_os_name(),
        target_arch_name()
    )
}

pub fn default_release_binary_path() -> PathBuf {
    let mut target_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target");
    if let Some(target_triple) = configured_target_triple() {
        target_dir = target_dir.join(target_triple);
    }
    target_dir
        .join("release")
        .join(format!("wp-playground-native{}", env::consts::EXE_SUFFIX))
}

pub fn package_native_cli(options: &PackageOptions) -> Result<PackageSummary> {
    if !options.binary_path.is_file() {
        return Err(CliError::new(format!(
            "Native CLI binary not found: {}",
            options.binary_path.display()
        )));
    }

    let manifest_path = find_php_assets_manifest(&options.asset_root).ok_or_else(|| {
        CliError::new(format!(
            "PHP asset manifest not found under {}",
            options.asset_root.display()
        ))
    })?;
    let manifest = load_php_assets_manifest(&manifest_path)?;
    let mut selected_manifest = selected_php_manifest(&manifest, &options.php_versions)?;

    let package_root = options.out_dir.join(&options.package_name);
    if package_root.exists() {
        fs::remove_dir_all(&package_root).map_err(|error| {
            CliError::new(format!(
                "Failed to remove existing package directory {}: {error}",
                package_root.display()
            ))
        })?;
    }
    fs::create_dir_all(&package_root)?;

    let package_binary_path = package_root
        .join("bin")
        .join(format!("wp-playground-native{}", env::consts::EXE_SUFFIX));
    copy_file(&options.binary_path, &package_binary_path)?;
    let binary_manifest = package_file_manifest(
        &package_root,
        Path::new("bin").join(format!("wp-playground-native{}", env::consts::EXE_SUFFIX)),
        "binary",
    )?;
    let mut files = vec![binary_manifest.clone()];

    let package_asset_root = package_root.join(PACKAGE_SHARE_DIR);
    let package_manifest_path = package_asset_root.join(SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH);
    if let Some(parent) = package_manifest_path.parent() {
        fs::create_dir_all(parent)?;
    }

    for asset in &mut selected_manifest.php {
        files.push(copy_verified_asset(
            &options.asset_root,
            &asset.js,
            &package_asset_root,
            &package_root,
            "php-js",
        )?);
        files.push(copy_verified_asset(
            &options.asset_root,
            &asset.wasm,
            &package_asset_root,
            &package_root,
            "php-wasm",
        )?);
        if options.precompile_wasmtime {
            if let Some(wasmtime) =
                precompile_packaged_wasm(&options.asset_root, asset, &package_asset_root)?
            {
                files.push(package_file_manifest(
                    &package_root,
                    Path::new(PACKAGE_SHARE_DIR).join(&wasmtime.path),
                    "php-wasmtime",
                )?);
                asset.wasmtime = Some(wasmtime);
            }
        } else if let Some(wasmtime) = &asset.wasmtime {
            files.push(copy_verified_asset(
                &options.asset_root,
                wasmtime,
                &package_asset_root,
                &package_root,
                "php-wasmtime",
            )?);
        }
    }
    fs::write(&package_manifest_path, selected_manifest.to_json())?;
    files.push(package_file_manifest(
        &package_root,
        Path::new(PACKAGE_SHARE_DIR).join(SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH),
        "php-asset-manifest",
    )?);

    if options.include_wordpress_assets {
        files.extend(copy_asset_directory(
            &options.asset_root,
            &package_asset_root,
            &package_root,
            WORDPRESS_BUILDS_DIR,
            validate_wordpress_zip,
            "wordpress",
        )?);
        files.extend(copy_asset_directory(
            &options.asset_root,
            &package_asset_root,
            &package_root,
            SQLITE_BUILDS_DIR,
            validate_sqlite_zip,
            "sqlite",
        )?);
    }

    let package_manifest_path = package_root.join("package-manifest.json");
    let manifest_without_archive =
        build_package_manifest(&options.package_name, binary_manifest, files, None);
    write_package_manifest(&package_manifest_path, &manifest_without_archive)?;

    let (archive_path, archive_checksum_path, archive_manifest_path) = if options.create_archive {
        fs::create_dir_all(&options.out_dir)?;
        let archive_path = options
            .out_dir
            .join(format!("{}.zip", options.package_name));
        if archive_path.exists() {
            fs::remove_file(&archive_path)?;
        }
        let checksum_path = archive_checksum_path(&archive_path)?;
        if checksum_path.exists() {
            fs::remove_file(&checksum_path)?;
        }
        create_zip_archive(&package_root, &archive_path)?;
        let checksum_path = write_archive_checksum(&archive_path)?;
        let archive_manifest = archive_manifest(&archive_path, &checksum_path)?;
        let manifest_with_archive = PackageManifest {
            archive: Some(archive_manifest),
            ..manifest_without_archive
        };
        let archive_manifest_path = archive_package_manifest_path(&archive_path)?;
        write_package_manifest(&archive_manifest_path, &manifest_with_archive)?;
        (
            Some(archive_path),
            Some(checksum_path),
            Some(archive_manifest_path),
        )
    } else {
        (None, None, None)
    };

    Ok(PackageSummary {
        package_root,
        binary_path: package_binary_path,
        asset_root: package_asset_root,
        package_manifest_path,
        archive_path,
        archive_checksum_path,
        archive_manifest_path,
    })
}

pub fn run_packaged_php_smoke(summary: &PackageSummary, php_version: &str) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary, php_version)?;

    let output = Command::new(&smoke_summary.binary_path)
        .arg("php")
        .arg(format!("--php={php_version}"))
        .arg("--skip-wordpress-install")
        .arg("--skip-sqlite-setup")
        .arg("--opcache=middle")
        .arg("-v")
        .env_remove(ASSET_ROOT_ENV_VAR)
        .env(DISABLE_SOURCE_FALLBACK_ENV_VAR, "1")
        .output()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to run packaged binary {}: {error}",
                smoke_summary.binary_path.display()
            ))
        })?;
    if !output.status.success() {
        return Err(CliError::new(format!(
            "Packaged php -v smoke for PHP {php_version} failed with status {}.\nstdout:\n{}\nstderr:\n{}",
            output.status,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !stdout.contains(&format!("PHP {php_version}.")) {
        return Err(CliError::new(format!(
            "Packaged php -v smoke did not report PHP {php_version}. stdout:\n{stdout}"
        )));
    }
    Ok(())
}

pub fn run_packaged_wordpress_server_smoke(
    summary: &PackageSummary,
    php_version: &str,
    wordpress_version: &str,
) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary, php_version)?;
    assert_packaged_wordpress_assets_exist(&smoke_summary, wordpress_version)?;

    let site_root = unique_temp_dir("wp-playground-native-packaged-server-site")?;
    let mut child = Command::new(&smoke_summary.binary_path)
        .arg("server")
        .arg(format!("--php={php_version}"))
        .arg(format!("--wp={wordpress_version}"))
        .arg("--port=0")
        .arg("--workers=1")
        .arg("--mount-dir-before-install")
        .arg(&site_root)
        .arg("/wordpress")
        .env_remove(ASSET_ROOT_ENV_VAR)
        .env(DISABLE_SOURCE_FALLBACK_ENV_VAR, "1")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to start packaged server {}: {error}",
                smoke_summary.binary_path.display()
            ))
        })?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| CliError::new("Failed to capture packaged server stderr"))?;
    let mut guard = ChildGuard::new(child);
    let (tx, rx) = mpsc::channel();
    let stderr_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            if tx.send(line.unwrap_or_default()).is_err() {
                break;
            }
        }
    });

    let server_url = wait_for_packaged_server_url(&rx)?;
    let response = http_get(&server_url, "/")?;
    guard.stop();
    let _ = stderr_thread.join();

    if !response.starts_with("HTTP/1.1 200 OK\r\n") {
        return Err(CliError::new(format!(
            "Packaged WordPress server smoke returned unexpected response:\n{}",
            response_excerpt_text(&response)
        )));
    }
    if !response.contains("My WordPress Website") {
        return Err(CliError::new(format!(
            "Packaged WordPress server smoke did not return the installed site homepage:\n{}",
            response_excerpt_text(&response)
        )));
    }
    let database = site_root
        .join("wp-content")
        .join("database")
        .join(".ht.sqlite");
    if !database.is_file() {
        return Err(CliError::new(format!(
            "Packaged WordPress server smoke did not create SQLite database: {}",
            database.display()
        )));
    }

    let _ = fs::remove_dir_all(site_root);
    Ok(())
}

pub fn run_packaged_run_blueprint_smoke(
    summary: &PackageSummary,
    php_version: &str,
    wordpress_version: &str,
) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary, php_version)?;
    assert_packaged_wordpress_assets_exist(&smoke_summary, wordpress_version)?;

    let root = unique_temp_dir("wp-playground-native-packaged-blueprint")?;
    let site_root = root.join("wordpress");
    let tmp_root = root.join("tmp");
    fs::create_dir_all(&site_root)?;
    fs::create_dir_all(&tmp_root)?;
    let blueprint_path = root.join("blueprint.json");
    fs::write(
        &blueprint_path,
        r#"{
            "steps": [
                {
                    "step": "runPHP",
                    "code": "<?php require_once '/wordpress/wp-load.php'; update_option('packaged_run_blueprint', 'ok'); file_put_contents('/tmp/run-blueprint-smoke.txt', get_option('packaged_run_blueprint'));"
                }
            ]
        }"#,
    )?;

    let output = Command::new(&smoke_summary.binary_path)
        .arg("run-blueprint")
        .arg(format!("--php={php_version}"))
        .arg(format!("--wp={wordpress_version}"))
        .arg("--blueprint")
        .arg(&blueprint_path)
        .arg("--mount-dir-before-install")
        .arg(&site_root)
        .arg("/wordpress")
        .arg("--mount-dir-before-install")
        .arg(&tmp_root)
        .arg("/tmp")
        .arg("--quiet")
        .env_remove(ASSET_ROOT_ENV_VAR)
        .env(DISABLE_SOURCE_FALLBACK_ENV_VAR, "1")
        .output()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to run packaged run-blueprint smoke {}: {error}",
                smoke_summary.binary_path.display()
            ))
        })?;
    if !output.status.success() {
        return Err(CliError::new(format!(
            "Packaged run-blueprint smoke failed with status {}.\nstdout:\n{}\nstderr:\n{}",
            output.status,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let result_path = tmp_root.join("run-blueprint-smoke.txt");
    let result = fs::read_to_string(&result_path).map_err(|error| {
        CliError::new(format!(
            "Packaged run-blueprint smoke did not write {}: {error}",
            result_path.display()
        ))
    })?;
    if result != "ok" {
        return Err(CliError::new(format!(
            "Packaged run-blueprint smoke wrote unexpected result `{result}` to {}",
            result_path.display()
        )));
    }

    let _ = fs::remove_dir_all(root);
    Ok(())
}

pub fn run_packaged_build_snapshot_smoke(
    summary: &PackageSummary,
    php_version: &str,
    wordpress_version: &str,
) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary, php_version)?;
    assert_packaged_wordpress_assets_exist(&smoke_summary, wordpress_version)?;

    let root = unique_temp_dir("wp-playground-native-packaged-snapshot")?;
    let site_root = root.join("wordpress");
    fs::create_dir_all(&site_root)?;
    let blueprint_path = root.join("blueprint.json");
    fs::write(
        &blueprint_path,
        r#"{
            "steps": [
                {
                    "step": "runPHP",
                    "code": "<?php require_once '/wordpress/wp-load.php'; update_option('packaged_build_snapshot', 'snapshot-ok'); file_put_contents('/wordpress/snapshot-marker.txt', get_option('packaged_build_snapshot'));"
                }
            ]
        }"#,
    )?;
    let outfile = root.join("snapshot.zip");

    let output = Command::new(&smoke_summary.binary_path)
        .arg("build-snapshot")
        .arg(format!("--php={php_version}"))
        .arg(format!("--wp={wordpress_version}"))
        .arg("--site-url=http://native-snapshot.test")
        .arg("--blueprint")
        .arg(&blueprint_path)
        .arg("--mount-dir-before-install")
        .arg(&site_root)
        .arg("/wordpress")
        .arg("--outfile")
        .arg(&outfile)
        .arg("--quiet")
        .env_remove(ASSET_ROOT_ENV_VAR)
        .env(DISABLE_SOURCE_FALLBACK_ENV_VAR, "1")
        .output()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to run packaged build-snapshot smoke {}: {error}",
                smoke_summary.binary_path.display()
            ))
        })?;
    if !output.status.success() {
        return Err(CliError::new(format!(
            "Packaged build-snapshot smoke failed with status {}.\nstdout:\n{}\nstderr:\n{}",
            output.status,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let file = fs::File::open(&outfile).map_err(|error| {
        CliError::new(format!(
            "Packaged build-snapshot smoke did not write {}: {error}",
            outfile.display()
        ))
    })?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|error| CliError::new(format!("Failed to read snapshot ZIP: {error}")))?;
    let mut marker = String::new();
    zip.by_name("/wordpress/snapshot-marker.txt")
        .map_err(|error| {
            CliError::new(format!(
                "Snapshot ZIP is missing /wordpress/snapshot-marker.txt: {error}"
            ))
        })?
        .read_to_string(&mut marker)?;
    if marker != "snapshot-ok" {
        return Err(CliError::new(format!(
            "Snapshot ZIP marker contained unexpected value `{marker}`"
        )));
    }
    if zip.by_name("playground-export.json").is_ok() {
        return Err(CliError::new(
            "Snapshot ZIP unexpectedly contains playground-export.json",
        ));
    }

    let _ = fs::remove_dir_all(root);
    Ok(())
}

fn assert_packaged_php_asset_files_exist(
    summary: &PackageSummary,
    php_version: &str,
) -> Result<()> {
    let manifest_path = find_php_assets_manifest(&summary.asset_root).ok_or_else(|| {
        CliError::new(format!(
            "Packaged PHP asset manifest not found under {}",
            summary.asset_root.display()
        ))
    })?;
    let manifest = load_php_assets_manifest(&manifest_path)?;
    let asset = select_php_asset(&manifest, php_version)?;
    let mut relative_paths = vec![&asset.js.path, &asset.wasm.path];
    if let Some(wasmtime) = &asset.wasmtime {
        relative_paths.push(&wasmtime.path);
    }
    for relative_path in relative_paths {
        let path = summary.asset_root.join(relative_path);
        if !path.is_file() {
            return Err(CliError::new(format!(
                "Packaged asset referenced by manifest is missing: {}",
                path.display()
            )));
        }
    }
    Ok(())
}

fn assert_packaged_wordpress_assets_exist(
    summary: &PackageSummary,
    wordpress_version: &str,
) -> Result<()> {
    let wordpress_zip = summary
        .asset_root
        .join(WORDPRESS_BUILDS_DIR)
        .join(format!("wp-{wordpress_version}.zip"));
    if !wordpress_zip.is_file() {
        return Err(CliError::new(format!(
            "Packaged WordPress asset is missing: {}",
            wordpress_zip.display()
        )));
    }
    validate_wordpress_zip(&wordpress_zip)?;
    let sqlite_dir = summary.asset_root.join(SQLITE_BUILDS_DIR);
    let sqlite_zips = sqlite_dir
        .read_dir()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to inspect packaged SQLite asset directory {}: {error}",
                sqlite_dir.display()
            ))
        })?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().and_then(|extension| extension.to_str()) == Some("zip"))
        .collect::<Vec<_>>();
    if sqlite_zips.is_empty() {
        return Err(CliError::new(format!(
            "Packaged SQLite asset directory contains no ZIP files: {}",
            sqlite_dir.display()
        )));
    }
    for sqlite_zip in sqlite_zips {
        validate_sqlite_zip(&sqlite_zip)?;
    }
    Ok(())
}

fn extract_package_archive(archive_path: &Path) -> Result<PackageSummary> {
    verify_archive_checksum(archive_path)?;
    let extract_root = unique_extract_root();
    fs::create_dir_all(&extract_root)?;
    let file = fs::File::open(archive_path).map_err(|error| {
        CliError::new(format!(
            "Failed to open package archive {}: {error}",
            archive_path.display()
        ))
    })?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| CliError::new(format!("Failed to read package archive: {error}")))?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            CliError::new(format!(
                "Failed to read package archive entry {index}: {error}"
            ))
        })?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let target = extract_root.join(enclosed_name);
        if entry.is_dir() {
            fs::create_dir_all(&target)?;
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = fs::File::create(&target).map_err(|error| {
            CliError::new(format!(
                "Failed to create extracted archive file {}: {error}",
                target.display()
            ))
        })?;
        std::io::copy(&mut entry, &mut output)?;
        set_extracted_permissions(&target, entry.unix_mode())?;
    }

    let package_root = single_extracted_root(&extract_root)?;
    let binary_path = package_root
        .join("bin")
        .join(format!("wp-playground-native{}", env::consts::EXE_SUFFIX));
    let asset_root = package_root.join(PACKAGE_SHARE_DIR);
    let package_manifest_path = package_root.join("package-manifest.json");
    Ok(PackageSummary {
        package_root,
        binary_path,
        asset_root,
        package_manifest_path,
        archive_path: Some(archive_path.to_path_buf()),
        archive_checksum_path: archive_checksum_path(archive_path)
            .ok()
            .filter(|path| path.is_file()),
        archive_manifest_path: archive_package_manifest_path(archive_path)
            .ok()
            .filter(|path| path.is_file()),
    })
}

fn unique_extract_root() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    env::temp_dir().join(format!("wp-playground-native-archive-smoke-{unique}"))
}

fn unique_temp_dir(prefix: &str) -> Result<PathBuf> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = env::temp_dir().join(format!("{prefix}-{unique}"));
    fs::create_dir_all(&path)?;
    Ok(path)
}

fn wait_for_packaged_server_url(rx: &mpsc::Receiver<String>) -> Result<String> {
    let mut stderr_lines = Vec::new();
    loop {
        match rx.recv_timeout(Duration::from_secs(180)) {
            Ok(line) if line.contains("wp-playground-native listening on ") => {
                return line
                    .split("wp-playground-native listening on ")
                    .nth(1)
                    .map(str::trim)
                    .filter(|url| !url.is_empty())
                    .map(str::to_string)
                    .ok_or_else(|| CliError::new(format!("Malformed server URL line: {line}")));
            }
            Ok(line) => stderr_lines.push(line),
            Err(error) => {
                return Err(CliError::new(format!(
                    "Timed out waiting for packaged server URL: {error}. stderr:\n{}",
                    stderr_lines.join("\n")
                )));
            }
        }
    }
}

fn http_get(server_url: &str, path: &str) -> Result<String> {
    let address = server_url
        .strip_prefix("http://")
        .ok_or_else(|| CliError::new(format!("Unsupported packaged server URL: {server_url}")))?;
    let mut stream = TcpStream::connect(address).map_err(|error| {
        CliError::new(format!(
            "Failed to connect to packaged server at {server_url}: {error}"
        ))
    })?;
    stream.set_read_timeout(Some(Duration::from_secs(180)))?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n"
    )?;
    let mut response = Vec::new();
    let mut buffer = [0u8; 8192];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => response.extend_from_slice(&buffer[..count]),
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) && !response.is_empty() =>
            {
                break;
            }
            Err(error) => {
                return Err(CliError::new(format!(
                    "Failed reading packaged server response from {server_url}: {error}"
                )));
            }
        }
    }
    if response.is_empty() {
        return Err(CliError::new(format!(
            "Packaged server at {server_url} returned no response"
        )));
    }
    Ok(String::from_utf8_lossy(&response).to_string())
}

fn response_excerpt_text(response: &str) -> String {
    const MAX_EXCERPT: usize = 2000;
    response.chars().take(MAX_EXCERPT).collect()
}

struct ChildGuard {
    child: Option<Child>,
}

impl ChildGuard {
    fn new(child: Child) -> Self {
        Self { child: Some(child) }
    }

    fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        self.stop();
    }
}

fn single_extracted_root(extract_root: &Path) -> Result<PathBuf> {
    let entries = fs::read_dir(extract_root)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();
    if entries.len() != 1 {
        return Err(CliError::new(format!(
            "Expected package archive to contain one top-level directory, found {}",
            entries.len()
        )));
    }
    Ok(entries[0].clone())
}

#[cfg(unix)]
fn set_extracted_permissions(path: &Path, mode: Option<u32>) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    if let Some(mode) = mode {
        fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    }
    Ok(())
}

#[cfg(not(unix))]
fn set_extracted_permissions(_path: &Path, _mode: Option<u32>) -> Result<()> {
    Ok(())
}

fn selected_php_manifest(
    manifest: &AssetManifest,
    php_versions: &[String],
) -> Result<AssetManifest> {
    let php = if php_versions.is_empty() {
        manifest
            .php
            .iter()
            .filter(|asset| SUPPORTED_PHP_VERSIONS.contains(&asset.version.as_str()))
            .cloned()
            .collect::<Vec<_>>()
    } else {
        let mut selected = Vec::new();
        for version in php_versions {
            validate_packaged_php_version(version)?;
            let asset = manifest
                .php
                .iter()
                .find(|asset| &asset.version == version)
                .ok_or_else(|| {
                    CliError::new(format!("No PHP wasm asset is available for PHP {version}"))
                })?;
            selected.push(asset.clone());
        }
        selected
    };
    if php.is_empty() {
        return Err(CliError::new(format!(
            "No supported PHP wasm assets are available. Supported versions: {}",
            SUPPORTED_PHP_VERSIONS.join(", ")
        )));
    }
    Ok(AssetManifest {
        schema_version: manifest.schema_version,
        runtime: manifest.runtime.clone(),
        php,
    })
}

fn validate_packaged_php_version(version: &str) -> Result<()> {
    if SUPPORTED_PHP_VERSIONS.contains(&version) {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "Unsupported PHP {version}. Supported versions: {}",
            SUPPORTED_PHP_VERSIONS.join(", ")
        )))
    }
}

fn copy_verified_asset(
    asset_root: &Path,
    asset: &FileAsset,
    package_asset_root: &Path,
    package_root: &Path,
    kind: &str,
) -> Result<PackageFileManifest> {
    verify_file_asset(asset_root, asset)?;
    copy_relative_asset(asset_root, &asset.path, package_asset_root)?;
    package_file_manifest(
        package_root,
        Path::new(PACKAGE_SHARE_DIR).join(&asset.path),
        kind,
    )
}

fn precompile_packaged_wasm(
    asset_root: &Path,
    asset: &mut crate::assets::PhpAsset,
    package_asset_root: &Path,
) -> Result<Option<FileAsset>> {
    let target_triple = configured_target_triple();
    precompile_packaged_wasm_for_target(
        asset_root,
        asset,
        package_asset_root,
        target_triple.as_deref(),
    )
}

fn precompile_packaged_wasm_for_target(
    asset_root: &Path,
    asset: &mut crate::assets::PhpAsset,
    package_asset_root: &Path,
    target_triple: Option<&str>,
) -> Result<Option<FileAsset>> {
    if skips_wasmtime_precompile_for_target(target_triple) {
        let target = target_triple.unwrap_or("current target");
        eprintln!(
            "warning: skipping PHP {} Wasmtime precompile for {target}; packaging wasm for runtime compilation",
            asset.version
        );
        return Ok(None);
    }

    let source = asset_root.join(&asset.wasm.path);
    let precompiled_path = precompiled_wasmtime_path(&asset.wasm.path)?;
    let destination = package_asset_root.join(&precompiled_path);
    precompile_wasm_module_for_target(
        &source,
        &destination,
        WasmEngineProfile::Optimized,
        target_triple,
    )?;
    Ok(Some(FileAsset {
        path: precompiled_path,
        sha256: sha256_file(&destination)?,
    }))
}

fn skips_wasmtime_precompile_for_target(target_triple: Option<&str>) -> bool {
    target_triple
        .map(is_windows_arm64_target)
        .unwrap_or(cfg!(all(target_os = "windows", target_arch = "aarch64")))
}

fn is_windows_arm64_target(target_triple: &str) -> bool {
    target_triple.starts_with("aarch64-") && target_triple.contains("-windows-")
}

fn precompiled_wasmtime_path(wasm_path: &Path) -> Result<PathBuf> {
    let wasm_path = wasm_path.to_string_lossy();
    let file_name = wasm_path
        .rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .ok_or_else(|| {
            CliError::new(format!(
                "Cannot derive precompiled Wasmtime path from wasm asset path {}",
                wasm_path
            ))
        })?;
    let prefix = wasm_path.strip_suffix(file_name).unwrap_or_default();
    Ok(PathBuf::from(format!("{prefix}{file_name}.cwasm")))
}

fn copy_asset_directory(
    asset_root: &Path,
    package_asset_root: &Path,
    package_root: &Path,
    relative_dir: &str,
    validate: fn(&Path) -> Result<()>,
    kind: &str,
) -> Result<Vec<PackageFileManifest>> {
    let source_dir = asset_root.join(relative_dir);
    if !source_dir.is_dir() {
        return Err(CliError::new(format!(
            "Asset directory not found: {}",
            source_dir.display()
        )));
    }
    let mut copied = Vec::new();
    for entry in fs::read_dir(&source_dir)? {
        let entry = entry?;
        let source = entry.path();
        if source.is_file() {
            if is_zip_file(&source) {
                validate(&source)?;
            }
            let relative = Path::new(relative_dir).join(entry.file_name());
            copy_relative_asset(asset_root, &relative, package_asset_root)?;
            copied.push(package_file_manifest(
                package_root,
                Path::new(PACKAGE_SHARE_DIR).join(relative),
                kind,
            )?);
        }
    }
    Ok(copied)
}

fn is_zip_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("zip"))
}

fn copy_relative_asset(
    asset_root: &Path,
    relative_path: &Path,
    package_asset_root: &Path,
) -> Result<()> {
    if relative_path.is_absolute() {
        return Err(CliError::new(format!(
            "Package asset paths must be relative, got {}",
            relative_path.display()
        )));
    }
    let source = asset_root.join(relative_path);
    let destination = package_asset_root.join(relative_path);
    copy_file(&source, &destination)
}

fn copy_file(source: &Path, destination: &Path) -> Result<()> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, destination).map_err(|error| {
        CliError::new(format!(
            "Failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        ))
    })?;
    Ok(())
}

fn build_package_manifest(
    package_name: &str,
    binary: PackageFileManifest,
    files: Vec<PackageFileManifest>,
    archive: Option<PackageArchiveManifest>,
) -> PackageManifest {
    PackageManifest {
        schema_version: 1,
        package_name: package_name.to_string(),
        version: package_version().to_string(),
        target_triple: target_triple().to_string(),
        source_commit: source_commit(),
        rustc_version: rustc_version(),
        binary,
        files,
        archive,
    }
}

fn write_package_manifest(path: &Path, manifest: &PackageManifest) -> Result<()> {
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|error| CliError::new(format!("Failed to serialize package manifest: {error}")))?;
    fs::write(path, format!("{json}\n")).map_err(|error| {
        CliError::new(format!(
            "Failed to write package manifest {}: {error}",
            path.display()
        ))
    })
}

fn package_file_manifest(
    package_root: &Path,
    relative_path: PathBuf,
    kind: &str,
) -> Result<PackageFileManifest> {
    if relative_path.is_absolute() {
        return Err(CliError::new(format!(
            "Package manifest paths must be relative, got {}",
            relative_path.display()
        )));
    }
    let path = package_root.join(&relative_path);
    let bytes = fs::read(&path).map_err(|error| {
        CliError::new(format!(
            "Failed to read packaged file {} for manifest: {error}",
            path.display()
        ))
    })?;
    Ok(PackageFileManifest {
        path: manifest_path(&relative_path),
        kind: kind.to_string(),
        size_bytes: bytes.len() as u64,
        sha256: sha256_hex(bytes),
    })
}

fn write_archive_checksum(archive_path: &Path) -> Result<PathBuf> {
    let checksum_path = archive_checksum_path(archive_path)?;
    let bytes = fs::read(archive_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read package archive {} for checksum: {error}",
            archive_path.display()
        ))
    })?;
    let digest = sha256_hex(bytes);
    let archive_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package archive has no valid file name"))?;
    fs::write(&checksum_path, format!("{digest}  {archive_name}\n")).map_err(|error| {
        CliError::new(format!(
            "Failed to write package checksum {}: {error}",
            checksum_path.display()
        ))
    })?;
    Ok(checksum_path)
}

fn archive_manifest(archive_path: &Path, checksum_path: &Path) -> Result<PackageArchiveManifest> {
    let bytes = fs::read(archive_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read package archive {} for manifest: {error}",
            archive_path.display()
        ))
    })?;
    let file_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package archive has no valid file name"))?
        .to_string();
    let checksum_file_name = checksum_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package checksum has no valid file name"))?
        .to_string();
    Ok(PackageArchiveManifest {
        file_name,
        size_bytes: bytes.len() as u64,
        sha256: sha256_hex(bytes),
        checksum_file_name,
    })
}

fn verify_archive_checksum(archive_path: &Path) -> Result<()> {
    let checksum_path = archive_checksum_path(archive_path)?;
    if !checksum_path.exists() {
        return Err(CliError::new(format!(
            "Package checksum sidecar is missing: {}",
            checksum_path.display()
        )));
    }
    let expected = fs::read_to_string(&checksum_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read package checksum {}: {error}",
            checksum_path.display()
        ))
    })?;
    let expected = expected.trim_end_matches('\n');
    let Some((expected, filename)) = expected.split_once("  ") else {
        return Err(CliError::new(format!(
            "Package checksum file {} must contain `<sha256>  <filename>`",
            checksum_path.display()
        )));
    };
    if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(CliError::new(format!(
            "Package checksum file {} does not start with a SHA-256 hex digest",
            checksum_path.display()
        )));
    }
    let archive_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package archive has no valid file name"))?;
    if filename != archive_name {
        return Err(CliError::new(format!(
            "Package checksum file {} names `{filename}`, expected `{archive_name}`",
            checksum_path.display()
        )));
    }
    let actual = sha256_hex(fs::read(archive_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read package archive {} for checksum verification: {error}",
            archive_path.display()
        ))
    })?);
    if !expected.eq_ignore_ascii_case(&actual) {
        return Err(CliError::new(format!(
            "Package archive checksum mismatch for {}: expected {expected}, got {actual}",
            archive_path.display()
        )));
    }
    Ok(())
}

fn archive_checksum_path(archive_path: &Path) -> Result<PathBuf> {
    let archive_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package archive has no valid file name"))?;
    Ok(archive_path.with_file_name(format!("{archive_name}.sha256")))
}

fn archive_package_manifest_path(archive_path: &Path) -> Result<PathBuf> {
    let archive_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package archive has no valid file name"))?;
    Ok(archive_path.with_file_name(format!("{archive_name}.manifest.json")))
}

fn manifest_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn package_version() -> &'static str {
    option_env!("WP_PLAYGROUND_NATIVE_VERSION").unwrap_or(env!("CARGO_PKG_VERSION"))
}

fn target_triple() -> String {
    configured_target_triple().unwrap_or_else(|| {
        format!(
            "{}-{}",
            target_arch_name_for_triple(),
            match env::consts::OS {
                "macos" => "apple-darwin",
                "linux" => "unknown-linux-gnu",
                "windows" => "pc-windows-msvc",
                other => other,
            }
        )
    })
}

fn configured_target_triple() -> Option<String> {
    env::var("WP_PLAYGROUND_NATIVE_TARGET_TRIPLE")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            env::var("CARGO_BUILD_TARGET")
                .ok()
                .filter(|value| !value.is_empty())
        })
}

fn target_os_name() -> &'static str {
    match env::consts::OS {
        "macos" => "macos",
        "linux" => "linux",
        "windows" => "windows",
        other => other,
    }
}

fn target_arch_name() -> &'static str {
    match env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    }
}

fn target_arch_name_for_triple() -> &'static str {
    match env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        other => other,
    }
}

fn source_commit() -> Option<String> {
    env::var("WP_PLAYGROUND_NATIVE_SOURCE_COMMIT")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            env::var("GITHUB_SHA")
                .ok()
                .filter(|value| !value.is_empty())
        })
}

fn rustc_version() -> Option<String> {
    Command::new("rustc")
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
}

fn create_zip_archive(package_root: &Path, archive_path: &Path) -> Result<()> {
    let archive_file = fs::File::create(archive_path)?;
    let mut zip = ZipWriter::new(archive_file);
    let package_name = package_root
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CliError::new("Package root has no valid directory name"))?;
    add_zip_directory(&mut zip, package_root, package_root, package_name)?;
    zip.finish()
        .map_err(|error| CliError::new(format!("Failed to finish package archive: {error}")))?;
    Ok(())
}

fn add_zip_directory(
    zip: &mut ZipWriter<fs::File>,
    root: &Path,
    directory: &Path,
    package_name: &str,
) -> Result<()> {
    let mut entries = fs::read_dir(directory)?.collect::<std::result::Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        let path = entry.path();
        let relative = path.strip_prefix(root).map_err(|error| {
            CliError::new(format!(
                "Failed to build archive path for {}: {error}",
                path.display()
            ))
        })?;
        let archive_name = zip_path(package_name, relative);
        if path.is_dir() {
            zip.add_directory(
                format!("{archive_name}/"),
                SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
            )
            .map_err(|error| CliError::new(format!("Failed to add archive directory: {error}")))?;
            add_zip_directory(zip, root, &path, package_name)?;
        } else {
            let mut options =
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
            if archive_name.contains("/bin/wp-playground-native") {
                options = options.unix_permissions(0o755);
            }
            zip.start_file(archive_name, options)
                .map_err(|error| CliError::new(format!("Failed to add archive file: {error}")))?;
            let mut file = fs::File::open(&path)?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)?;
            zip.write_all(&buffer)?;
        }
    }
    Ok(())
}

fn zip_path(package_name: &str, relative: &Path) -> String {
    let mut parts = vec![package_name.to_string()];
    parts.extend(
        relative
            .components()
            .map(|component| component.as_os_str().to_string_lossy().to_string()),
    );
    parts.join("/")
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        io::Write,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{
        extract_package_archive, package_native_cli, precompile_packaged_wasm_for_target,
        selected_php_manifest, PackageOptions, PACKAGE_SHARE_DIR,
    };
    use crate::{
        args::SUPPORTED_PHP_VERSIONS,
        assets::{load_php_assets_manifest, select_php_asset, AssetManifest, FileAsset, PhpAsset},
        sha256::sha256_hex,
    };
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("wp-playground-native-package-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_file(root: &Path, relative: &str, contents: &[u8]) {
        let path = root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn write_zip(root: &Path, relative: &str, entries: &[(&str, &[u8])]) {
        let path = root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
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

    fn write_fake_asset_root(root: &Path) {
        write_file(
            root,
            "packages/php-wasm/node-builds/5-2/asyncify/php_5_2.js",
            b"js52",
        );
        write_file(
            root,
            "packages/php-wasm/node-builds/5-2/asyncify/5_2_17/php_5_2.wasm",
            b"wasm52",
        );
        write_file(
            root,
            "packages/php-wasm/node-builds/8-3/asyncify/php_8_3.js",
            b"js83",
        );
        write_file(
            root,
            "packages/php-wasm/node-builds/8-3/asyncify/8_3_30/php_8_3.wasm",
            b"wasm83",
        );
        write_file(
            root,
            "packages/php-wasm/node-builds/8-4/asyncify/php_8_4.js",
            b"js84",
        );
        write_file(
            root,
            "packages/php-wasm/node-builds/8-4/asyncify/8_4_20/php_8_4.wasm",
            b"wasm84",
        );
        write_zip(
            root,
            "packages/playground/wordpress-builds/src/wordpress/wp-6.9.zip",
            &[
                ("wp-config-sample.php", b"<?php"),
                ("wp-load.php", b"<?php"),
                ("wp-admin/install.php", b"<?php"),
                ("wp-includes/version.php", b"<?php"),
                ("wp-content/", b""),
            ],
        );
        write_file(
            root,
            "packages/playground/wordpress-builds/src/wordpress/get-wordpress-module-details.ts",
            b"export {};",
        );
        write_zip(
            root,
            "packages/playground/wordpress-builds/src/sqlite-database-integration/sqlite-database-integration-trunk.zip",
            &[
                ("plugin-sqlite-database-integration/db.copy", b"<?php"),
                ("plugin-sqlite-database-integration/load.php", b"<?php"),
                (
                    "plugin-sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-db.php",
                    b"<?php",
                ),
            ],
        );
        write_file(
            root,
            "packages/playground/cli-native/assets/php-assets.json",
            format!(
                r#"{{
                    "schemaVersion": 1,
                    "runtime": "node-builds/asyncify",
                    "php": {{
                        "5.2": {{
                            "js": {{
                                "path": "packages/php-wasm/node-builds/5-2/asyncify/php_5_2.js",
                                "sha256": "{}"
                            }},
                            "wasm": {{
                                "path": "packages/php-wasm/node-builds/5-2/asyncify/5_2_17/php_5_2.wasm",
                                "sha256": "{}"
                            }}
                        }},
                        "8.3": {{
                            "js": {{
                                "path": "packages/php-wasm/node-builds/8-3/asyncify/php_8_3.js",
                                "sha256": "{}"
                            }},
                            "wasm": {{
                                "path": "packages/php-wasm/node-builds/8-3/asyncify/8_3_30/php_8_3.wasm",
                                "sha256": "{}"
                            }}
                        }},
                        "8.4": {{
                            "js": {{
                                "path": "packages/php-wasm/node-builds/8-4/asyncify/php_8_4.js",
                                "sha256": "{}"
                            }},
                            "wasm": {{
                                "path": "packages/php-wasm/node-builds/8-4/asyncify/8_4_20/php_8_4.wasm",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                sha256_hex(b"js52"),
                sha256_hex(b"wasm52"),
                sha256_hex(b"js83"),
                sha256_hex(b"wasm83"),
                sha256_hex(b"js84"),
                sha256_hex(b"wasm84")
            )
            .as_bytes(),
        );
    }

    fn write_precompilable_asset_root(root: &Path) {
        let wasm = b"\0asm\x01\0\0\0";
        write_file(
            root,
            "packages/php-wasm/node-builds/8-3/asyncify/php_8_3.js",
            b"js83",
        );
        write_file(
            root,
            "packages/php-wasm/node-builds/8-3/asyncify/8_3_30/php_8_3.wasm",
            wasm,
        );
        write_file(
            root,
            "packages/playground/cli-native/assets/php-assets.json",
            format!(
                r#"{{
                    "schemaVersion": 1,
                    "runtime": "node-builds/asyncify",
                    "php": {{
                        "8.3": {{
                            "js": {{
                                "path": "packages/php-wasm/node-builds/8-3/asyncify/php_8_3.js",
                                "sha256": "{}"
                            }},
                            "wasm": {{
                                "path": "packages/php-wasm/node-builds/8-3/asyncify/8_3_30/php_8_3.wasm",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                sha256_hex(b"js83"),
                sha256_hex(wasm)
            )
            .as_bytes(),
        );
    }

    fn fake_php_asset(version: &str) -> PhpAsset {
        let normalized = version.replace('.', "_");
        PhpAsset {
            version: version.to_string(),
            runtime: None,
            js: FileAsset {
                path: PathBuf::from(format!("php_{normalized}.js")),
                sha256: "0".repeat(64),
            },
            wasm: FileAsset {
                path: PathBuf::from(format!("php_{normalized}.wasm")),
                sha256: "0".repeat(64),
            },
            wasmtime: None,
        }
    }

    #[test]
    fn default_selection_includes_every_supported_php_version() {
        let mut php = vec![fake_php_asset("5.2")];
        php.extend(
            SUPPORTED_PHP_VERSIONS
                .iter()
                .map(|version| fake_php_asset(version)),
        );
        php.push(fake_php_asset("9.9"));
        let manifest = AssetManifest {
            schema_version: 1,
            runtime: "node-builds/asyncify".to_string(),
            php,
        };

        let selected = selected_php_manifest(&manifest, &[]).unwrap();
        let versions = selected
            .php
            .iter()
            .map(|asset| asset.version.as_str())
            .collect::<Vec<_>>();

        assert_eq!(versions, SUPPORTED_PHP_VERSIONS.to_vec());
    }

    #[test]
    fn packages_supported_assets_by_default() {
        let root = temp_dir("supported-asset-root");
        let out_dir = temp_dir("supported-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let summary = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-supported-test".to_string(),
            php_versions: Vec::new(),
            include_wordpress_assets: false,
            create_archive: false,
            precompile_wasmtime: false,
        })
        .unwrap();

        let manifest_path = summary
            .asset_root
            .join("packages/playground/cli-native/assets/php-assets.json");
        let manifest = load_php_assets_manifest(&manifest_path).unwrap();
        assert!(select_php_asset(&manifest, "5.2").is_err());
        assert!(select_php_asset(&manifest, "8.3").is_ok());
        assert!(select_php_asset(&manifest, "8.4").is_ok());
    }

    #[test]
    fn packages_selected_assets_in_runtime_discoverable_layout() {
        let root = temp_dir("asset-root");
        let out_dir = temp_dir("out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let summary = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: true,
            create_archive: true,
            precompile_wasmtime: false,
        })
        .unwrap();

        assert!(summary.binary_path.is_file());
        let archive_path = summary.archive_path.as_ref().unwrap();
        let checksum_path = summary.archive_checksum_path.as_ref().unwrap();
        assert!(archive_path.is_file());
        assert!(checksum_path.is_file());
        assert!(summary.package_manifest_path.is_file());
        assert!(summary.archive_manifest_path.as_ref().unwrap().is_file());
        let checksum = fs::read_to_string(checksum_path).unwrap();
        assert!(checksum.ends_with("  native-test.zip\n"));
        assert!(checksum.starts_with(&sha256_hex(fs::read(archive_path).unwrap())));
        let package_manifest = fs::read_to_string(&summary.package_manifest_path).unwrap();
        let package_manifest: serde_json::Value = serde_json::from_str(&package_manifest).unwrap();
        assert_eq!(package_manifest["schemaVersion"], 1);
        assert_eq!(package_manifest["packageName"], "native-test");
        assert_eq!(package_manifest["version"], super::package_version());
        assert_eq!(package_manifest["binary"]["kind"], "binary");
        assert!(package_manifest["archive"].is_null());
        let files = package_manifest["files"].as_array().unwrap();
        assert!(files.iter().any(|file| {
            file["kind"] == "wordpress"
                && file["path"].as_str().unwrap().ends_with("/wp-6.9.zip")
                && file["sha256"].as_str().unwrap().len() == 64
        }));
        let archive_manifest =
            fs::read_to_string(summary.archive_manifest_path.as_ref().unwrap()).unwrap();
        let archive_manifest: serde_json::Value = serde_json::from_str(&archive_manifest).unwrap();
        assert_eq!(archive_manifest["archive"]["fileName"], "native-test.zip");
        assert_eq!(
            archive_manifest["archive"]["sha256"],
            sha256_hex(fs::read(archive_path).unwrap())
        );
        let manifest_path = summary
            .asset_root
            .join("packages/playground/cli-native/assets/php-assets.json");
        let manifest = load_php_assets_manifest(&manifest_path).unwrap();
        assert!(select_php_asset(&manifest, "8.3").is_ok());
        assert!(select_php_asset(&manifest, "8.4").is_err());
        assert!(summary
            .asset_root
            .join("packages/php-wasm/node-builds/8-3/asyncify/8_3_30/php_8_3.wasm")
            .is_file());
        assert!(summary
            .package_root
            .join(PACKAGE_SHARE_DIR)
            .join("packages/playground/wordpress-builds/src/wordpress/wp-6.9.zip")
            .is_file());
        assert!(summary
            .package_root
            .join(PACKAGE_SHARE_DIR)
            .join(
                "packages/playground/wordpress-builds/src/wordpress/get-wordpress-module-details.ts"
            )
            .is_file());

        let extracted = extract_package_archive(summary.archive_path.as_deref().unwrap()).unwrap();
        assert!(extracted.binary_path.is_file());
        assert!(extracted.package_manifest_path.is_file());
        assert!(extracted.archive_checksum_path.as_ref().unwrap().is_file());
        assert!(extracted.archive_manifest_path.as_ref().unwrap().is_file());
        assert!(extracted
            .asset_root
            .join("packages/playground/cli-native/assets/php-assets.json")
            .is_file());
    }

    #[test]
    fn precompiles_selected_wasm_assets_into_package_manifest() {
        let root = temp_dir("precompile-root");
        let out_dir = temp_dir("precompile-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_precompilable_asset_root(&root);

        let summary = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-precompile-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: false,
            create_archive: false,
            precompile_wasmtime: true,
        })
        .unwrap();

        let manifest_path = summary
            .asset_root
            .join("packages/playground/cli-native/assets/php-assets.json");
        let manifest = load_php_assets_manifest(&manifest_path).unwrap();
        let php83 = select_php_asset(&manifest, "8.3").unwrap();
        if super::skips_wasmtime_precompile_for_target(None) {
            assert!(php83.wasmtime.is_none());
            assert!(summary.asset_root.join(&php83.wasm.path).is_file());
            return;
        }

        let wasmtime = php83.wasmtime.as_ref().unwrap();
        assert!(wasmtime.path.to_string_lossy().ends_with(".wasm.cwasm"));
        assert!(summary.asset_root.join(&wasmtime.path).is_file());
        assert_eq!(
            wasmtime.sha256,
            sha256_hex(fs::read(summary.asset_root.join(&wasmtime.path)).unwrap())
        );
    }

    #[test]
    fn skips_windows_arm64_wasmtime_precompile_for_packaged_assets() {
        let root = temp_dir("windows-arm64-precompile-root");
        let package_asset_root = temp_dir("windows-arm64-precompile-out").join(PACKAGE_SHARE_DIR);
        write_precompilable_asset_root(&root);
        let manifest_path = root.join("packages/playground/cli-native/assets/php-assets.json");
        let mut manifest = load_php_assets_manifest(&manifest_path).unwrap();
        let asset = manifest
            .php
            .iter_mut()
            .find(|asset| asset.version == "8.3")
            .unwrap();

        let wasmtime = precompile_packaged_wasm_for_target(
            &root,
            asset,
            &package_asset_root,
            Some("aarch64-pc-windows-msvc"),
        )
        .unwrap();

        assert!(wasmtime.is_none());
        assert!(asset.wasmtime.is_none());
        assert!(!package_asset_root
            .join("packages/php-wasm/node-builds/8-3/asyncify/8_3_30/php_8_3.wasm.cwasm")
            .exists());
    }

    #[test]
    fn rejects_archive_with_mismatched_checksum_sidecar() {
        let root = temp_dir("checksum-root");
        let out_dir = temp_dir("checksum-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let summary = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: false,
            create_archive: true,
            precompile_wasmtime: false,
        })
        .unwrap();
        fs::write(
            summary.archive_checksum_path.as_ref().unwrap(),
            "0000000000000000000000000000000000000000000000000000000000000000  native-test.zip\n",
        )
        .unwrap();

        let error = extract_package_archive(summary.archive_path.as_deref().unwrap())
            .unwrap_err()
            .to_string();

        assert!(error.contains("checksum mismatch"), "{error}");
    }

    #[test]
    fn rejects_archive_without_checksum_sidecar() {
        let root = temp_dir("missing-checksum-root");
        let out_dir = temp_dir("missing-checksum-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let summary = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: false,
            create_archive: true,
            precompile_wasmtime: false,
        })
        .unwrap();
        fs::remove_file(summary.archive_checksum_path.as_ref().unwrap()).unwrap();

        let error = extract_package_archive(summary.archive_path.as_deref().unwrap())
            .unwrap_err()
            .to_string();

        assert!(error.contains("checksum sidecar is missing"), "{error}");
    }

    #[test]
    fn rejects_archive_checksum_with_mismatched_filename() {
        let root = temp_dir("checksum-name-root");
        let out_dir = temp_dir("checksum-name-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let summary = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: false,
            create_archive: true,
            precompile_wasmtime: false,
        })
        .unwrap();
        let archive_path = summary.archive_path.as_ref().unwrap();
        let digest = sha256_hex(fs::read(archive_path).unwrap());
        fs::write(
            summary.archive_checksum_path.as_ref().unwrap(),
            format!("{digest}  other.zip\n"),
        )
        .unwrap();

        let error = extract_package_archive(summary.archive_path.as_deref().unwrap())
            .unwrap_err()
            .to_string();

        assert!(error.contains("expected `native-test.zip`"), "{error}");
    }

    #[test]
    fn rejects_unknown_filtered_php_version() {
        let root = temp_dir("unknown-php-root");
        let out_dir = temp_dir("unknown-php-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let error = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["9.9".to_string()],
            include_wordpress_assets: false,
            create_archive: false,
            precompile_wasmtime: false,
        })
        .unwrap_err()
        .to_string();

        assert!(error.contains("PHP 9.9"));
    }

    #[test]
    fn rejects_unsupported_filtered_php_version_even_when_asset_exists() {
        let root = temp_dir("unsupported-php-root");
        let out_dir = temp_dir("unsupported-php-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);

        let error = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["5.2".to_string()],
            include_wordpress_assets: false,
            create_archive: false,
            precompile_wasmtime: false,
        })
        .unwrap_err()
        .to_string();

        assert!(error.contains("Unsupported PHP 5.2"), "{error}");
    }

    #[test]
    fn rejects_corrupt_wordpress_package_asset() {
        let root = temp_dir("corrupt-wp-root");
        let out_dir = temp_dir("corrupt-wp-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);
        write_file(
            &root,
            "packages/playground/wordpress-builds/src/wordpress/wp-6.9.zip",
            b"not a zip",
        );

        let error = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: true,
            create_archive: false,
            precompile_wasmtime: false,
        })
        .unwrap_err()
        .to_string();

        assert!(error.contains("WordPress ZIP"), "{error}");
    }

    #[test]
    fn rejects_corrupt_sqlite_package_asset() {
        let root = temp_dir("corrupt-sqlite-root");
        let out_dir = temp_dir("corrupt-sqlite-out");
        let binary = root.join(format!(
            "wp-playground-native{}",
            std::env::consts::EXE_SUFFIX
        ));
        fs::write(&binary, b"binary").unwrap();
        write_fake_asset_root(&root);
        write_file(
            &root,
            "packages/playground/wordpress-builds/src/sqlite-database-integration/sqlite-database-integration-trunk.zip",
            b"not a zip",
        );

        let error = package_native_cli(&PackageOptions {
            binary_path: binary,
            asset_root: root,
            out_dir,
            package_name: "native-test".to_string(),
            php_versions: vec!["8.3".to_string()],
            include_wordpress_assets: true,
            create_archive: false,
            precompile_wasmtime: false,
        })
        .unwrap_err()
        .to_string();

        assert!(error.contains("SQLite integration ZIP"), "{error}");
    }
}
