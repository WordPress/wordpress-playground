use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    io::{BufRead, BufReader, Read, Write},
    net::TcpStream,
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use crate::{
    assets::{
        find_php_assets_manifest, load_php_assets_manifest, select_php_asset, sha256_file,
        verify_file_asset, AssetManifest, FileAsset, PhpAsset,
        SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH,
    },
    runtime::{
        asset_root_from_manifest_dir, precompile_wasm_component_for_target, WasmEngineProfile,
        ASSET_ROOT_ENV_VAR, DISABLE_SOURCE_FALLBACK_ENV_VAR,
    },
    sha256::sha256_hex,
    wordpress::{validate_sqlite_zip, validate_wordpress_archive, validate_wordpress_static_zip},
    CliError, Result,
};

pub const PACKAGE_SHARE_DIR: &str = "share/wp-playground-native";
const WORDPRESS_BUILDS_DIR: &str = "packages/playground/wordpress-builds/src/wordpress";
const WORDPRESS_STATIC_BUILDS_DIR: &str = "packages/playground/wordpress-builds/public";
const WORDPRESS_STATIC_ZIP: &str = "wordpress-static.zip";
const SQLITE_BUILDS_DIR: &str =
    "packages/playground/wordpress-builds/src/sqlite-database-integration";
const SQLITE_TRUNK_ZIP: &str = "sqlite-database-integration-trunk.zip";
pub const PACKAGED_PHP_VERSION: &str = "8.2";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageOptions {
    pub binary_path: PathBuf,
    pub asset_root: PathBuf,
    pub out_dir: PathBuf,
    pub package_name: String,
    pub wordpress_versions: Vec<String>,
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
    pub wasmtime_precompile: PackageWasmtimePrecompileManifest,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageWasmtimePrecompileManifest {
    pub requested: bool,
    pub supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped_reason: Option<String>,
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
            wordpress_versions: Vec::new(),
            include_wordpress_assets: false,
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

pub fn validate_package_name(package_name: &str) -> Result<()> {
    if package_name.is_empty() {
        return Err(CliError::new("--name must not be empty"));
    }
    if package_name == "." || package_name == ".." {
        return Err(CliError::new(format!(
            "--name must be a plain package directory name, got `{package_name}`"
        )));
    }
    if package_name
        .chars()
        .any(|character| matches!(character, '/' | '\\') || character.is_control())
    {
        return Err(CliError::new(format!(
            "--name must be a plain package directory name without path separators or control characters, got `{package_name}`"
        )));
    }
    let path = Path::new(package_name);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(CliError::new(format!(
            "--name must be a plain package directory name, got `{package_name}`"
        )));
    }
    Ok(())
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
    validate_package_name(&options.package_name)?;
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
    let mut selected_manifest = packaged_php_manifest(&manifest)?;

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
        let packaged = package_php_asset(
            &options.asset_root,
            &package_asset_root,
            &package_root,
            asset,
            options.precompile_wasmtime,
        )?;
        extend_unique_package_files(&mut files, packaged);
    }
    fs::write(&package_manifest_path, selected_manifest.to_json())?;
    let packaged_php_manifest = load_php_assets_manifest(&package_manifest_path)?;
    verify_packaged_php_manifest_files(&package_asset_root, &packaged_php_manifest)?;
    files.push(package_file_manifest(
        &package_root,
        Path::new(PACKAGE_SHARE_DIR).join(SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH),
        "php-asset-manifest",
    )?);

    files.extend(copy_required_sqlite_assets(
        &options.asset_root,
        &package_asset_root,
        &package_root,
    )?);
    if options.include_wordpress_assets {
        files.extend(copy_wordpress_assets(
            &options.asset_root,
            &package_asset_root,
            &package_root,
            &options.wordpress_versions,
        )?);
    }

    let package_manifest_path = package_root.join("package-manifest.json");
    let wasmtime_precompile = package_wasmtime_precompile_manifest(options.precompile_wasmtime);
    let manifest_without_archive = build_package_manifest(
        &options.package_name,
        wasmtime_precompile,
        binary_manifest,
        files,
        None,
    );
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

pub fn run_packaged_wordpress_server_smoke(
    summary: &PackageSummary,
    wordpress_version: &str,
) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary)?;
    assert_packaged_sqlite_assets_exist(&smoke_summary)?;

    let site_root = unique_temp_dir("wp-playground-native-packaged-server-site")?;
    let mut child = Command::new(&smoke_summary.binary_path)
        .arg("server")
        .arg(format!("--php={PACKAGED_PHP_VERSION}"))
        .arg(format!("--wp={wordpress_version}"))
        .arg("--port=0")
        .arg("--workers=4")
        .arg("--login")
        .arg("--verbosity=debug")
        .arg("--mount-dir-before-install")
        .arg(&site_root)
        .arg("/wordpress")
        .env_remove(ASSET_ROOT_ENV_VAR)
        .env(DISABLE_SOURCE_FALLBACK_ENV_VAR, "1")
        .env("WP_PLAYGROUND_NATIVE_LAZY_WORKERS", "1")
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
    let response = http_get_following_login(&server_url, "/")?;
    let editor_path = "/wp-admin/post-new.php?post_type=page";
    let editor_login_response = http_get(&server_url, editor_path)?;
    let cookies = response_set_cookie_header(&editor_login_response);
    let editor_response = if cookies.is_empty() {
        editor_login_response
    } else {
        http_get_with_cookie_header(&server_url, editor_path, Some(&cookies))?
    };
    if !cookies.is_empty() {
        let mut concurrent = Vec::new();
        for index in 0..12 {
            let server_url = server_url.clone();
            let cookies = cookies.clone();
            concurrent.push(thread::spawn(move || {
                let path = if index % 2 == 0 { "/favicon.ico/" } else { "/" };
                http_get_with_cookie_header(&server_url, path, Some(&cookies))
                    .map(|response| (path, response))
            }));
        }
        for handle in concurrent {
            let (path, response) = handle
                .join()
                .map_err(|_| CliError::new("Packaged WordPress concurrent smoke panicked"))??;
            if response.contains("wasm_sapi_handle_request failed")
                || response.contains("Internal Server Error")
            {
                return Err(CliError::new(format!(
                    "Packaged WordPress concurrent smoke failed for {path}:\n{}",
                    response_excerpt_text(&response)
                )));
            }
            if !(response.starts_with("HTTP/1.1 200 ")
                || response.starts_with("HTTP/1.1 301 ")
                || response.starts_with("HTTP/1.1 302 ")
                || response.starts_with("HTTP/1.1 404 "))
            {
                return Err(CliError::new(format!(
                    "Packaged WordPress concurrent smoke returned unexpected response for {path}:\n{}",
                    response_excerpt_text(&response)
                )));
            }
        }
        let editor_after_lazy_workers =
            http_get_with_cookie_header(&server_url, editor_path, Some(&cookies))?;
        if !editor_after_lazy_workers.starts_with("HTTP/1.1 200 OK\r\n")
            || !editor_after_lazy_workers.contains("Add Page")
            || !editor_after_lazy_workers.contains("wp-admin-bar")
            || editor_after_lazy_workers.contains("wasm_sapi_handle_request failed")
            || editor_after_lazy_workers.contains("Internal Server Error")
        {
            return Err(CliError::new(format!(
                "Packaged WordPress post-lazy-worker editor smoke returned unexpected response:\n{}",
                response_excerpt_text(&editor_after_lazy_workers)
            )));
        }
    }
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
    if !editor_response.starts_with("HTTP/1.1 200 OK\r\n") {
        return Err(CliError::new(format!(
            "Packaged WordPress editor smoke returned unexpected response:\n{}",
            response_excerpt_text(&editor_response)
        )));
    }
    if !editor_response.contains("Add Page") || !editor_response.contains("wp-admin-bar") {
        return Err(CliError::new(format!(
            "Packaged WordPress editor smoke did not return the Add Page admin editor:\n{}",
            response_excerpt_text(&editor_response)
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
    wordpress_version: &str,
) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary)?;
    assert_packaged_sqlite_assets_exist(&smoke_summary)?;

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
                    "code": "<?php require_once '/wordpress/wp-load.php'; $user_id = wp_create_user('packaged-smoke-user', 'packaged-smoke-password', 'packaged-smoke@example.com'); if (is_wp_error($user_id)) { throw new RuntimeException($user_id->get_error_message()); } $user = get_userdata($user_id); if (!$user || !wp_check_password('packaged-smoke-password', $user->user_pass, $user_id)) { throw new RuntimeException('WordPress password hash verification failed'); } update_option('packaged_run_blueprint', 'ok'); file_put_contents('/tmp/run-blueprint-smoke.txt', get_option('packaged_run_blueprint'));"
                }
            ]
        }"#,
    )?;

    let output = Command::new(&smoke_summary.binary_path)
        .arg("run-blueprint")
        .arg(format!("--php={PACKAGED_PHP_VERSION}"))
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
    wordpress_version: &str,
) -> Result<()> {
    let smoke_summary = if let Some(archive_path) = &summary.archive_path {
        extract_package_archive(archive_path)?
    } else {
        summary.clone()
    };
    assert_packaged_php_asset_files_exist(&smoke_summary)?;
    assert_packaged_sqlite_assets_exist(&smoke_summary)?;

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
        .arg(format!("--php={PACKAGED_PHP_VERSION}"))
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

fn assert_packaged_php_asset_files_exist(summary: &PackageSummary) -> Result<()> {
    let manifest_path = find_php_assets_manifest(&summary.asset_root).ok_or_else(|| {
        CliError::new(format!(
            "Packaged PHP asset manifest not found under {}",
            summary.asset_root.display()
        ))
    })?;
    let manifest = load_php_assets_manifest(&manifest_path)?;
    let asset = select_php_asset(&manifest, PACKAGED_PHP_VERSION)?;
    let mut relative_paths = vec![&asset.wasm.path];
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

fn assert_packaged_sqlite_assets_exist(summary: &PackageSummary) -> Result<()> {
    let sqlite_dir = summary.asset_root.join(SQLITE_BUILDS_DIR);
    let sqlite_zip = sqlite_dir.join(SQLITE_TRUNK_ZIP);
    if !sqlite_zip.is_file() {
        return Err(CliError::new(format!(
            "Packaged SQLite asset is missing: {}",
            sqlite_zip.display()
        )));
    }
    validate_sqlite_zip(&sqlite_zip)?;
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
    http_get_with_cookie_header(server_url, path, None)
}

fn http_get_following_login(server_url: &str, path: &str) -> Result<String> {
    let response = http_get(server_url, path)?;
    if response.starts_with("HTTP/1.1 200 OK\r\n") {
        return Ok(response);
    }
    if !response.starts_with("HTTP/1.1 302 Found\r\n") {
        return Ok(response);
    }
    let cookies = response_set_cookie_header(&response);
    if cookies.is_empty() {
        return Ok(response);
    }
    http_get_with_cookie_header(server_url, path, Some(&cookies))
}

fn http_get_with_cookie_header(
    server_url: &str,
    path: &str,
    cookie_header: Option<&str>,
) -> Result<String> {
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
    let cookie_line = cookie_header
        .filter(|value| !value.is_empty())
        .map(|value| format!("Cookie: {value}\r\n"))
        .unwrap_or_default();
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: {address}\r\n{cookie_line}Connection: close\r\n\r\n"
    )?;
    let mut response = Vec::new();
    let mut buffer = [0u8; 8192];
    let deadline = Instant::now() + Duration::from_secs(180);
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
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) && Instant::now() < deadline =>
            {
                thread::sleep(Duration::from_millis(10));
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

fn response_set_cookie_header(response: &str) -> String {
    response
        .split_once("\r\n\r\n")
        .map(|(head, _)| head)
        .unwrap_or(response)
        .lines()
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("set-cookie").then(|| {
                value
                    .trim()
                    .split_once(';')
                    .map(|(cookie, _)| cookie)
                    .unwrap_or_else(|| value.trim())
                    .to_string()
            })
        })
        .collect::<Vec<_>>()
        .join("; ")
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

fn packaged_php_manifest(manifest: &AssetManifest) -> Result<AssetManifest> {
    let php = vec![select_php_asset(manifest, PACKAGED_PHP_VERSION)?.clone()];
    Ok(AssetManifest {
        schema_version: manifest.schema_version,
        php,
    })
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

fn package_php_asset(
    asset_root: &Path,
    package_asset_root: &Path,
    package_root: &Path,
    asset: &mut PhpAsset,
    precompile_wasmtime: bool,
) -> Result<Vec<PackageFileManifest>> {
    let mut files = vec![copy_verified_asset(
        asset_root,
        &asset.wasm,
        package_asset_root,
        package_root,
        "php-wasip2-component",
    )?];
    if precompile_wasmtime {
        match precompile_packaged_component(asset_root, asset, package_asset_root)? {
            Some(wasmtime) => {
                files.push(package_file_manifest(
                    package_root,
                    Path::new(PACKAGE_SHARE_DIR).join(&wasmtime.path),
                    "php-wasmtime-component",
                )?);
                asset.wasmtime = Some(wasmtime);
            }
            None => asset.wasmtime = None,
        }
    } else if let Some(wasmtime) = &asset.wasmtime {
        files.push(copy_verified_asset(
            asset_root,
            wasmtime,
            package_asset_root,
            package_root,
            "php-wasmtime-component",
        )?);
    }
    Ok(files)
}

fn extend_unique_package_files(
    files: &mut Vec<PackageFileManifest>,
    additional: impl IntoIterator<Item = PackageFileManifest>,
) {
    for file in additional {
        if !files.iter().any(|existing| existing.path == file.path) {
            files.push(file);
        }
    }
}

fn verify_packaged_php_manifest_files(
    package_asset_root: &Path,
    manifest: &AssetManifest,
) -> Result<()> {
    verify_packaged_php_assets(package_asset_root, &manifest.php)
}

fn verify_packaged_php_assets(package_asset_root: &Path, assets: &[PhpAsset]) -> Result<()> {
    for asset in assets {
        verify_file_asset(package_asset_root, &asset.wasm).map_err(|error| {
            CliError::new(format!(
                "Packaged PHP {} WASIp2 component is invalid: {error}",
                asset.version
            ))
        })?;
        if let Some(wasmtime) = &asset.wasmtime {
            verify_file_asset(package_asset_root, wasmtime).map_err(|error| {
                CliError::new(format!(
                    "Packaged PHP {} precompiled Wasmtime component is invalid: {error}",
                    asset.version
                ))
            })?;
        }
    }
    Ok(())
}

fn precompile_packaged_component(
    asset_root: &Path,
    asset: &mut crate::assets::PhpAsset,
    package_asset_root: &Path,
) -> Result<Option<FileAsset>> {
    let target_triple = configured_target_triple();
    precompile_packaged_component_for_target(
        asset_root,
        asset,
        package_asset_root,
        target_triple.as_deref(),
    )
}

fn precompile_packaged_component_for_target(
    asset_root: &Path,
    asset: &mut crate::assets::PhpAsset,
    package_asset_root: &Path,
    target_triple: Option<&str>,
) -> Result<Option<FileAsset>> {
    let source = asset_root.join(&asset.wasm.path);
    let precompiled_path = precompiled_wasmtime_path(&asset.wasm.path)?;
    let destination = package_asset_root.join(&precompiled_path);
    precompile_wasm_component_for_target(
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

fn copy_required_sqlite_assets(
    asset_root: &Path,
    package_asset_root: &Path,
    package_root: &Path,
) -> Result<Vec<PackageFileManifest>> {
    Ok(vec![copy_validated_asset(
        asset_root,
        package_asset_root,
        package_root,
        Path::new(SQLITE_BUILDS_DIR).join(SQLITE_TRUNK_ZIP),
        validate_sqlite_zip,
        "sqlite",
    )?])
}

fn select_wordpress_archive_directory(
    asset_root: &Path,
    relative_dir: &str,
) -> Result<BTreeMap<String, PathBuf>> {
    let source_dir = asset_root.join(relative_dir);
    if !source_dir.is_dir() {
        return Err(CliError::new(format!(
            "Asset directory not found: {}",
            source_dir.display()
        )));
    }
    let mut selected = BTreeMap::<String, PathBuf>::new();
    for entry in fs::read_dir(&source_dir)? {
        let entry = entry?;
        let source = entry.path();
        if !source.is_file() {
            continue;
        }
        let Some(filename) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        let Some(version) = wordpress_version_from_archive_filename(&filename) else {
            continue;
        };
        let relative_path = Path::new(relative_dir).join(&filename);
        match selected.get(version) {
            Some(existing) if is_tar_zst_path(existing) || !is_tar_zst_filename(&filename) => {}
            _ => {
                selected.insert(version.to_string(), relative_path);
            }
        }
    }
    Ok(selected)
}

fn copy_wordpress_assets(
    asset_root: &Path,
    package_asset_root: &Path,
    package_root: &Path,
    wordpress_versions: &[String],
) -> Result<Vec<PackageFileManifest>> {
    let selected = if wordpress_versions.is_empty() {
        select_wordpress_archive_directory(asset_root, WORDPRESS_BUILDS_DIR)?
    } else {
        let mut selected = BTreeMap::new();
        let mut seen = BTreeSet::new();
        for version in wordpress_versions {
            if !seen.insert(version.as_str()) {
                continue;
            }
            let filename = wordpress_archive_filename(asset_root, version)?;
            let selected_version = wordpress_version_from_archive_filename(&filename)
                .ok_or_else(|| CliError::new(format!("Invalid WordPress archive: {filename}")))?;
            selected.insert(
                selected_version.to_string(),
                Path::new(WORDPRESS_BUILDS_DIR).join(filename),
            );
        }
        selected
    };

    let mut copied = Vec::with_capacity(selected.len() * 2);
    for (version, archive_path) in selected {
        copied.push(copy_validated_asset(
            asset_root,
            package_asset_root,
            package_root,
            archive_path,
            validate_wordpress_archive,
            "wordpress",
        )?);
        copied.push(copy_validated_asset(
            asset_root,
            package_asset_root,
            package_root,
            Path::new(WORDPRESS_STATIC_BUILDS_DIR)
                .join(format!("wp-{version}"))
                .join(WORDPRESS_STATIC_ZIP),
            validate_wordpress_static_zip,
            "wordpress-static",
        )?);
    }
    Ok(copied)
}

fn wordpress_archive_filename(asset_root: &Path, version: &str) -> Result<String> {
    if version == "latest" {
        let dir = asset_root.join(WORDPRESS_BUILDS_DIR);
        let mut candidates = fs::read_dir(&dir)
            .map_err(|error| {
                CliError::new(format!(
                    "Failed to read bundled WordPress assets from {}: {error}",
                    dir.display()
                ))
            })?
            .filter_map(|entry| entry.ok().map(|entry| entry.path()))
            .filter_map(|path| {
                let name = path.file_name()?.to_str()?;
                let version = wordpress_version_from_archive_filename(name)?;
                (version != "beta").then(|| (version.to_string(), name.to_string()))
            })
            .collect::<Vec<_>>();
        candidates.sort_by(|(left_version, left_name), (right_version, right_name)| {
            version_sort_key(left_version)
                .cmp(&version_sort_key(right_version))
                .then_with(|| is_tar_zst_filename(left_name).cmp(&is_tar_zst_filename(right_name)))
        });
        let (_, filename) = candidates.pop().ok_or_else(|| {
            CliError::new(format!(
                "No bundled WordPress release archives found under {}",
                dir.display()
            ))
        })?;
        return Ok(filename);
    }
    let stem = if version == "beta" {
        "wp-beta".to_string()
    } else {
        format!("wp-{version}")
    };
    let dir = asset_root.join(WORDPRESS_BUILDS_DIR);
    for filename in [format!("{stem}.tar.zst"), format!("{stem}.zip")] {
        if dir.join(&filename).is_file() {
            return Ok(filename);
        }
    }
    Ok(format!("{stem}.tar.zst"))
}

fn version_sort_key(version: &str) -> Vec<u16> {
    version
        .split('.')
        .map(|part| part.parse::<u16>().unwrap_or(0))
        .collect()
}

fn wordpress_version_from_archive_filename(filename: &str) -> Option<&str> {
    let name = filename.strip_prefix("wp-")?;
    name.strip_suffix(".tar.zst")
        .or_else(|| name.strip_suffix(".zip"))
}

fn is_tar_zst_filename(filename: &str) -> bool {
    filename.ends_with(".tar.zst")
}

fn is_tar_zst_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(is_tar_zst_filename)
}

fn copy_validated_asset(
    asset_root: &Path,
    package_asset_root: &Path,
    package_root: &Path,
    relative_path: PathBuf,
    validate: fn(&Path) -> Result<()>,
    kind: &str,
) -> Result<PackageFileManifest> {
    validate(&asset_root.join(&relative_path))?;
    copy_relative_asset(asset_root, &relative_path, package_asset_root)?;
    package_file_manifest(
        package_root,
        Path::new(PACKAGE_SHARE_DIR).join(relative_path),
        kind,
    )
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
    wasmtime_precompile: PackageWasmtimePrecompileManifest,
    binary: PackageFileManifest,
    files: Vec<PackageFileManifest>,
    archive: Option<PackageArchiveManifest>,
) -> PackageManifest {
    PackageManifest {
        schema_version: 1,
        package_name: package_name.to_string(),
        version: package_version().to_string(),
        target_triple: target_triple().to_string(),
        wasmtime_precompile,
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
    option_env!("WP_PLAYGROUND_WASMTIME_VERSION")
        .or(option_env!("WP_PLAYGROUND_NATIVE_VERSION"))
        .unwrap_or(env!("CARGO_PKG_VERSION"))
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

fn package_wasmtime_precompile_manifest(requested: bool) -> PackageWasmtimePrecompileManifest {
    let target = target_triple();
    package_wasmtime_precompile_manifest_for_target(requested, Some(&target))
}

fn package_wasmtime_precompile_manifest_for_target(
    requested: bool,
    _target_triple: Option<&str>,
) -> PackageWasmtimePrecompileManifest {
    PackageWasmtimePrecompileManifest {
        requested,
        supported: true,
        skipped_reason: None,
    }
}

fn configured_target_triple() -> Option<String> {
    env::var("WP_PLAYGROUND_WASMTIME_TARGET_TRIPLE")
        .ok()
        .filter(|value| !value.is_empty())
        // Keep existing release automation working while it moves to the
        // Wasmtime-prefixed variable.
        .or_else(|| {
            env::var("WP_PLAYGROUND_NATIVE_TARGET_TRIPLE")
                .ok()
                .filter(|value| !value.is_empty())
        })
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
    env::var("WP_PLAYGROUND_WASMTIME_SOURCE_COMMIT")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            env::var("WP_PLAYGROUND_NATIVE_SOURCE_COMMIT")
                .ok()
                .filter(|value| !value.is_empty())
        })
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
mod component_tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use wasmtime::{component::Linker, Store};

    use crate::{
        assets::{AssetManifest, FileAsset, PhpAsset, FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH},
        runtime::{NativeRuntime, WasmEngineProfile},
    };

    use super::{
        package_php_asset, package_wasmtime_precompile_manifest_for_target, packaged_php_manifest,
        precompiled_wasmtime_path, sha256_file, validate_package_name, PACKAGE_SHARE_DIR,
    };

    #[test]
    fn package_manifest_is_php_82_only() {
        let manifest = component_manifest(vec![fake_asset("8.2")]);
        let selected = packaged_php_manifest(&manifest).unwrap();
        assert_eq!(
            selected
                .php
                .iter()
                .map(|asset| asset.version.as_str())
                .collect::<Vec<_>>(),
            vec!["8.2"]
        );

        let error = packaged_php_manifest(&component_manifest(Vec::new()))
            .unwrap_err()
            .to_string();
        assert!(error.contains("PHP 8.2"), "{error}");
    }

    #[test]
    fn rejects_unsafe_package_names() {
        assert!(validate_package_name("native-component").is_ok());
        assert!(validate_package_name("../escaped").is_err());
        assert!(validate_package_name("nested/package").is_err());
    }

    #[test]
    fn component_precompile_metadata_is_supported_on_every_target() {
        assert_eq!(
            precompiled_wasmtime_path(PathBuf::from("php/8.2/php.wasm").as_path()).unwrap(),
            PathBuf::from("php/8.2/php.wasm.cwasm")
        );
        let metadata =
            package_wasmtime_precompile_manifest_for_target(true, Some("aarch64-pc-windows-msvc"));
        assert!(metadata.requested);
        assert!(metadata.supported);
        assert!(metadata.skipped_reason.is_none());
    }

    #[test]
    fn requested_precompile_packages_a_deserializable_component() {
        let root = temp_dir("package-component");
        let asset_root = root.join("source");
        let package_root = root.join("package");
        let package_asset_root = package_root.join(PACKAGE_SHARE_DIR);
        let relative_wasm = PathBuf::from("php/8.2/php.wasm");
        let source_wasm = asset_root.join(&relative_wasm);
        fs::create_dir_all(source_wasm.parent().unwrap()).unwrap();
        fs::write(&source_wasm, b"(component)").unwrap();

        let mut asset = PhpAsset {
            version: "8.2".to_string(),
            wasm: FileAsset {
                path: relative_wasm,
                sha256: sha256_file(&source_wasm).unwrap(),
            },
            wasmtime: None,
        };
        let files = package_php_asset(
            &asset_root,
            &package_asset_root,
            &package_root,
            &mut asset,
            true,
        )
        .unwrap();
        assert_eq!(
            files
                .iter()
                .map(|file| file.kind.as_str())
                .collect::<Vec<_>>(),
            vec!["php-wasip2-component", "php-wasmtime-component"]
        );
        assert!(asset.wasmtime.is_some());

        fs::create_dir_all(&package_asset_root).unwrap();
        fs::write(
            package_asset_root.join(FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH),
            component_manifest(vec![asset]).to_json(),
        )
        .unwrap();
        let runtime = NativeRuntime::from_asset_root_with_engine_profile(
            &package_asset_root,
            WasmEngineProfile::Optimized,
        )
        .unwrap();
        let component = runtime.php_artifact("8.2").unwrap();
        let linker = Linker::<()>::new(runtime.engine());
        let mut store = Store::new(runtime.engine(), ());
        linker.instantiate(&mut store, &component).unwrap();

        let _ = fs::remove_dir_all(root);
    }

    fn component_manifest(php: Vec<PhpAsset>) -> AssetManifest {
        AssetManifest {
            schema_version: 2,
            php,
        }
    }

    fn fake_asset(version: &str) -> PhpAsset {
        PhpAsset {
            version: version.to_string(),
            wasm: FileAsset {
                path: PathBuf::from(format!("php/{version}/php.wasm")),
                sha256: "00".repeat(32),
            },
            wasmtime: None,
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("wp-playground-native-{name}-{unique}"))
    }
}
