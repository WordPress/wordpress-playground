use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
};

use serde::Deserialize;

use crate::{sha256::sha256_reader_hex, CliError, Result};

pub const SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH: &str =
    "packages/playground/cli-native/assets/php-assets.json";
pub const PACKAGED_PHP_ASSET_MANIFEST_RELATIVE_PATH: &str = "assets/php-assets.json";
pub const FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH: &str = "php-assets.json";
const PHP_ASSET_MANIFEST_SCHEMA_VERSION: u8 = 1;
pub const PHP_ASSET_MANIFEST_RUNTIME_WASMTIME_ASYNC: &str = "node-builds/wasmtime-async";
pub const PHP_ASSET_MANIFEST_RUNTIME_ASYNCIFY: &str = "node-builds/asyncify";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhpAssetRuntime {
    Asyncify,
    WasmtimeAsync,
}

impl PhpAssetRuntime {
    pub fn from_manifest_runtime(runtime: &str) -> Option<Self> {
        match runtime {
            PHP_ASSET_MANIFEST_RUNTIME_ASYNCIFY => Some(Self::Asyncify),
            PHP_ASSET_MANIFEST_RUNTIME_WASMTIME_ASYNC => Some(Self::WasmtimeAsync),
            _ => None,
        }
    }

    pub fn manifest_runtime(self) -> &'static str {
        match self {
            Self::Asyncify => PHP_ASSET_MANIFEST_RUNTIME_ASYNCIFY,
            Self::WasmtimeAsync => PHP_ASSET_MANIFEST_RUNTIME_WASMTIME_ASYNC,
        }
    }

    fn build_dir_name(self) -> &'static str {
        match self {
            Self::Asyncify => "asyncify",
            Self::WasmtimeAsync => "wasmtime-async",
        }
    }

    pub fn uses_wasmtime_async(self) -> bool {
        matches!(self, Self::WasmtimeAsync)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct FileAsset {
    pub path: PathBuf,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpAsset {
    pub version: String,
    pub runtime: Option<PhpAssetRuntime>,
    pub js: FileAsset,
    pub wasm: FileAsset,
    pub wasmtime: Option<FileAsset>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetManifest {
    pub schema_version: u8,
    pub runtime: String,
    pub php: Vec<PhpAsset>,
}

#[derive(Debug, Deserialize)]
struct RawAssetManifest {
    #[serde(rename = "schemaVersion")]
    schema_version: u8,
    runtime: String,
    php: BTreeMap<String, RawPhpAsset>,
}

#[derive(Debug, Deserialize)]
struct RawPhpAsset {
    #[serde(default)]
    runtime: Option<String>,
    js: FileAsset,
    wasm: FileAsset,
    #[serde(default)]
    wasmtime: Option<FileAsset>,
}

impl AssetManifest {
    pub fn php_runtime(&self) -> Result<PhpAssetRuntime> {
        PhpAssetRuntime::from_manifest_runtime(&self.runtime).ok_or_else(|| {
            CliError::new(format!(
                "Unsupported PHP asset manifest runtime `{}`; expected `{}` or `{}`",
                self.runtime,
                PHP_ASSET_MANIFEST_RUNTIME_ASYNCIFY,
                PHP_ASSET_MANIFEST_RUNTIME_WASMTIME_ASYNC
            ))
        })
    }

    pub fn php_runtime_for_asset(&self, asset: &PhpAsset) -> Result<PhpAssetRuntime> {
        asset.runtime.map_or_else(|| self.php_runtime(), Ok)
    }

    pub fn to_json(&self) -> String {
        let mut json = String::new();
        json.push_str("{\n");
        json.push_str(&format!("\t\"schemaVersion\": {},\n", self.schema_version));
        json.push_str(&format!(
            "\t\"runtime\": \"{}\",\n",
            escape_json(&self.runtime)
        ));
        json.push_str("\t\"php\": {\n");
        for (index, asset) in self.php.iter().enumerate() {
            json.push_str(&format!("\t\t\"{}\": {{\n", escape_json(&asset.version)));
            if let Some(runtime) = asset.runtime {
                json.push_str(&format!(
                    "\t\t\t\"runtime\": \"{}\",\n",
                    escape_json(runtime.manifest_runtime())
                ));
            }
            push_file_asset(&mut json, "js", &asset.js, ",");
            push_file_asset(
                &mut json,
                "wasm",
                &asset.wasm,
                if asset.wasmtime.is_some() { "," } else { "" },
            );
            if let Some(wasmtime) = &asset.wasmtime {
                push_file_asset(&mut json, "wasmtime", wasmtime, "");
            }
            json.push_str("\t\t}");
            if index + 1 != self.php.len() {
                json.push(',');
            }
            json.push('\n');
        }
        json.push_str("\t}\n");
        json.push_str("}\n");
        json
    }
}

pub fn load_php_assets_manifest(path: &Path) -> Result<AssetManifest> {
    let content = fs::read_to_string(path)?;
    let raw = serde_json::from_str::<RawAssetManifest>(&content)
        .map_err(|error| CliError::new(format!("Invalid PHP asset manifest: {error}")))?;
    validate_raw_manifest(&raw)?;
    let mut php = raw
        .php
        .into_iter()
        .map(|(version, asset)| PhpAsset {
            version,
            runtime: asset
                .runtime
                .as_deref()
                .and_then(PhpAssetRuntime::from_manifest_runtime),
            js: asset.js,
            wasm: asset.wasm,
            wasmtime: asset.wasmtime,
        })
        .collect::<Vec<_>>();
    php.sort_by(|left, right| {
        version_sort_key(&left.version).cmp(&version_sort_key(&right.version))
    });

    Ok(AssetManifest {
        schema_version: raw.schema_version,
        runtime: raw.runtime,
        php,
    })
}

pub fn find_php_assets_manifest(asset_root: &Path) -> Option<PathBuf> {
    [
        SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH,
        PACKAGED_PHP_ASSET_MANIFEST_RELATIVE_PATH,
        FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH,
    ]
    .into_iter()
    .map(|relative| asset_root.join(relative))
    .find(|path| path.is_file())
}

pub fn discover_php_assets(repo_root: &Path) -> Result<AssetManifest> {
    let builds_root = repo_root.join("packages/php-wasm/node-builds");
    if !builds_root.is_dir() {
        return Err(CliError::new(format!(
            "PHP wasm node-builds directory not found: {}",
            builds_root.display()
        )));
    }

    let runtime = PhpAssetRuntime::Asyncify;
    let mut php = Vec::new();
    for entry in fs::read_dir(&builds_root)? {
        let entry = entry?;
        let build_dir = entry.path();
        if !build_dir.is_dir() {
            continue;
        }
        let Some(version) = version_from_build_dir(&build_dir) else {
            continue;
        };
        let runtime_dir = build_dir.join(runtime.build_dir_name());
        if !runtime_dir.is_dir() {
            continue;
        }
        let js = find_prefixed_file(&runtime_dir, "php_", "js")?;
        let wasm = find_wasm_file(&runtime_dir)?;
        php.push(PhpAsset {
            version,
            runtime: None,
            js: file_asset(repo_root, &js)?,
            wasm: file_asset(repo_root, &wasm)?,
            wasmtime: None,
        });
    }

    php.sort_by(|left, right| {
        version_sort_key(&left.version).cmp(&version_sort_key(&right.version))
    });

    Ok(AssetManifest {
        schema_version: PHP_ASSET_MANIFEST_SCHEMA_VERSION,
        runtime: runtime.manifest_runtime().to_string(),
        php,
    })
}

fn push_file_asset(json: &mut String, key: &str, asset: &FileAsset, suffix: &str) {
    json.push_str(&format!(
		"\t\t\t\"{key}\": {{\n\t\t\t\t\"path\": \"{}\",\n\t\t\t\t\"sha256\": \"{}\"\n\t\t\t}}{suffix}\n",
		escape_json(&asset.path.to_string_lossy()),
		escape_json(&asset.sha256)
	));
}

fn file_asset(repo_root: &Path, path: &Path) -> Result<FileAsset> {
    Ok(FileAsset {
        path: relative_asset_path(repo_root, path),
        sha256: sha256_file(path)?,
    })
}

fn relative_asset_path(repo_root: &Path, path: &Path) -> PathBuf {
    let relative = path.strip_prefix(repo_root).unwrap_or(path);
    let normalized = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    PathBuf::from(normalized)
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let file = fs::File::open(path)?;
    Ok(sha256_reader_hex(file)?)
}

pub fn verify_file_asset(repo_root: &Path, asset: &FileAsset) -> Result<()> {
    validate_file_asset(asset, "asset")?;
    let path = repo_root.join(&asset.path);
    if !path.is_file() {
        return Err(CliError::new(format!(
            "Asset file not found: {}",
            path.display()
        )));
    }
    let actual = sha256_file(&path)?;
    if actual != asset.sha256 {
        return Err(CliError::new(format!(
            "Checksum mismatch for {}: expected {}, got {}",
            path.display(),
            asset.sha256,
            actual
        )));
    }
    Ok(())
}

fn validate_raw_manifest(raw: &RawAssetManifest) -> Result<()> {
    if raw.schema_version != PHP_ASSET_MANIFEST_SCHEMA_VERSION {
        return Err(CliError::new(format!(
            "Unsupported PHP asset manifest schemaVersion {}; expected {}",
            raw.schema_version, PHP_ASSET_MANIFEST_SCHEMA_VERSION
        )));
    }
    if PhpAssetRuntime::from_manifest_runtime(&raw.runtime).is_none() {
        return Err(CliError::new(format!(
            "Unsupported PHP asset manifest runtime `{}`; expected `{}` or `{}`",
            raw.runtime,
            PHP_ASSET_MANIFEST_RUNTIME_ASYNCIFY,
            PHP_ASSET_MANIFEST_RUNTIME_WASMTIME_ASYNC
        )));
    }
    if raw.php.is_empty() {
        return Err(CliError::new(
            "PHP asset manifest must list at least one PHP version",
        ));
    }
    for (version, asset) in &raw.php {
        validate_php_version(version)?;
        if let Some(runtime) = &asset.runtime {
            if PhpAssetRuntime::from_manifest_runtime(runtime).is_none() {
                return Err(CliError::new(format!(
                    "Unsupported PHP {version} asset runtime `{runtime}`; expected `{}` or `{}`",
                    PHP_ASSET_MANIFEST_RUNTIME_ASYNCIFY, PHP_ASSET_MANIFEST_RUNTIME_WASMTIME_ASYNC
                )));
            }
        }
        validate_file_asset(&asset.js, &format!("PHP {version} js"))?;
        validate_file_asset(&asset.wasm, &format!("PHP {version} wasm"))?;
        if let Some(wasmtime) = &asset.wasmtime {
            validate_file_asset(
                wasmtime,
                &format!("PHP {version} Wasmtime precompiled module"),
            )?;
        }
    }
    Ok(())
}

fn validate_php_version(version: &str) -> Result<()> {
    let mut parts = version.split('.');
    let valid = matches!(
        (parts.next(), parts.next(), parts.next()),
        (Some(major), Some(minor), None)
            if !major.is_empty()
                && !minor.is_empty()
                && major.bytes().all(|byte| byte.is_ascii_digit())
                && minor.bytes().all(|byte| byte.is_ascii_digit())
    );
    if !valid {
        return Err(CliError::new(format!(
            "Invalid PHP version key `{version}` in asset manifest"
        )));
    }
    Ok(())
}

fn validate_file_asset(asset: &FileAsset, label: &str) -> Result<()> {
    let path = &asset.path;
    if path.as_os_str().is_empty() {
        return Err(CliError::new(format!(
            "{label} asset path must not be empty"
        )));
    }
    if path
        .to_string_lossy()
        .chars()
        .any(|character| character == '\\')
    {
        return Err(CliError::new(format!(
            "{label} asset path must use forward slashes: {}",
            path.display()
        )));
    }
    for component in path.components() {
        if matches!(
            component,
            Component::Prefix(_) | Component::RootDir | Component::ParentDir
        ) {
            return Err(CliError::new(format!(
                "{label} asset path must be a relative path inside the asset root: {}",
                path.display()
            )));
        }
    }
    if asset.sha256.len() != 64 || !asset.sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(CliError::new(format!(
            "{label} asset checksum must be a SHA-256 hex digest"
        )));
    }
    Ok(())
}

pub fn select_php_asset<'a>(manifest: &'a AssetManifest, version: &str) -> Result<&'a PhpAsset> {
    manifest
        .php
        .iter()
        .find(|asset| asset.version == version)
        .ok_or_else(|| CliError::new(format!("No PHP wasm asset is available for PHP {version}")))
}

fn version_from_build_dir(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_string_lossy();
    let parts = name.split('-').collect::<Vec<_>>();
    if parts.len() != 2 || parts.iter().any(|part| part.is_empty()) {
        return None;
    }
    Some(format!("{}.{}", parts[0], parts[1]))
}

fn version_sort_key(version: &str) -> Vec<u16> {
    version
        .split('.')
        .map(|part| part.parse::<u16>().unwrap_or(0))
        .collect()
}

fn find_prefixed_file(dir: &Path, prefix: &str, extension: &str) -> Result<PathBuf> {
    let mut candidates = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix))
                && path.extension().and_then(|value| value.to_str()) == Some(extension)
        })
        .collect::<Vec<_>>();
    candidates.sort();
    candidates.into_iter().next().ok_or_else(|| {
        CliError::new(format!(
            "No {prefix}*.{extension} file found in {}",
            dir.display()
        ))
    })
}

fn find_wasm_file(runtime_dir: &Path) -> Result<PathBuf> {
    let mut candidates = Vec::new();
    for entry in fs::read_dir(runtime_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Ok(wasm) = find_prefixed_file(&path, "php_", "wasm") {
            candidates.push(wasm);
        }
    }
    candidates.sort();
    candidates.into_iter().next().ok_or_else(|| {
        CliError::new(format!(
            "No php_*.wasm file found in {}",
            runtime_dir.display()
        ))
    })
}

fn escape_json(value: &str) -> String {
    let mut escaped = String::new();
    for char in value.chars() {
        match char {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            _ => escaped.push(char),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::{
        discover_php_assets, find_php_assets_manifest, load_php_assets_manifest, select_php_asset,
        verify_file_asset, PhpAssetRuntime, FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH,
        PACKAGED_PHP_ASSET_MANIFEST_RELATIVE_PATH, SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH,
    };
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    fn repo_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .to_path_buf()
    }

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("wp-playground-native-assets-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_manifest(root: &Path, relative_path: &str) -> PathBuf {
        let path = root.join(relative_path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(
            &path,
            r#"{
                "schemaVersion": 1,
                "runtime": "test",
                "php": {
                    "8.3": {
                        "js": { "path": "php/php.js", "sha256": "00" },
                        "wasm": { "path": "php/php.wasm", "sha256": "00" }
                    }
                }
            }"#,
        )
        .unwrap();
        path
    }

    fn write_manifest_json(root: &Path, name: &str, json: &str) -> PathBuf {
        let path = root.join(name);
        fs::write(&path, json).unwrap();
        path
    }

    #[test]
    fn discovers_repo_php_assets_when_available() {
        let repo_root = repo_root();
        let manifest = discover_php_assets(&repo_root).unwrap();
        assert!(manifest.php.iter().any(|asset| asset.version == "8.3"));
        assert!(manifest.php.iter().any(|asset| asset.version == "8.4"));
        let php83 = manifest
            .php
            .iter()
            .find(|asset| asset.version == "8.3")
            .unwrap();
        assert!(php83
            .js
            .path
            .to_string_lossy()
            .ends_with("asyncify/php_8_3.js"));
        assert!(php83.wasm.path.to_string_lossy().contains("asyncify/8_3_"));
    }

    #[test]
    fn loads_checked_in_manifest_and_verifies_selected_assets() {
        let repo_root = repo_root();
        let manifest = load_php_assets_manifest(
            &repo_root.join("packages/playground/cli-native/assets/php-assets.json"),
        )
        .unwrap();
        let php83 = select_php_asset(&manifest, "8.3").unwrap();
        verify_file_asset(&repo_root, &php83.js).unwrap();
        verify_file_asset(&repo_root, &php83.wasm).unwrap();
        let php85 = select_php_asset(&manifest, "8.5").unwrap();
        assert_eq!(
            manifest.php_runtime_for_asset(php85).unwrap(),
            PhpAssetRuntime::WasmtimeAsync
        );
        verify_file_asset(&repo_root, &php85.js).unwrap();
        verify_file_asset(&repo_root, &php85.wasm).unwrap();
    }

    #[test]
    fn loads_wasmtime_async_manifest_runtime() {
        let root = temp_dir("wasmtime-async-runtime");
        let manifest = write_manifest_json(
            &root,
            "runtime.json",
            r#"{
                "schemaVersion": 1,
                "runtime": "node-builds/wasmtime-async",
                "php": {
                    "8.3": {
                        "js": { "path": "php/php.js", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" },
                        "wasm": { "path": "php/php.wasm", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" }
                    }
                }
            }"#,
        );
        let manifest = load_php_assets_manifest(&manifest).unwrap();
        assert_eq!(
            manifest.php_runtime().unwrap(),
            PhpAssetRuntime::WasmtimeAsync
        );
    }

    #[test]
    fn loads_per_asset_wasmtime_async_runtime_override() {
        let root = temp_dir("per-asset-wasmtime-async-runtime");
        let manifest = write_manifest_json(
            &root,
            "runtime.json",
            r#"{
                "schemaVersion": 1,
                "runtime": "node-builds/asyncify",
                "php": {
                    "8.5": {
                        "runtime": "node-builds/wasmtime-async",
                        "js": { "path": "php/php.js", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" },
                        "wasm": { "path": "php/php.wasm", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" }
                    }
                }
            }"#,
        );
        let manifest = load_php_assets_manifest(&manifest).unwrap();
        let php85 = select_php_asset(&manifest, "8.5").unwrap();
        assert_eq!(manifest.php_runtime().unwrap(), PhpAssetRuntime::Asyncify);
        assert_eq!(
            manifest.php_runtime_for_asset(php85).unwrap(),
            PhpAssetRuntime::WasmtimeAsync
        );
    }

    #[test]
    fn finds_manifest_in_source_or_packaged_asset_layouts() {
        let source_root = temp_dir("source-layout");
        let source_manifest = write_manifest(&source_root, SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH);
        assert_eq!(
            find_php_assets_manifest(&source_root).unwrap(),
            source_manifest
        );

        let packaged_root = temp_dir("packaged-layout");
        let packaged_manifest =
            write_manifest(&packaged_root, PACKAGED_PHP_ASSET_MANIFEST_RELATIVE_PATH);
        assert_eq!(
            find_php_assets_manifest(&packaged_root).unwrap(),
            packaged_manifest
        );

        let flat_root = temp_dir("flat-layout");
        let flat_manifest = write_manifest(&flat_root, FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH);
        assert_eq!(find_php_assets_manifest(&flat_root).unwrap(), flat_manifest);
    }

    #[test]
    fn rejects_manifest_with_unsupported_schema_or_runtime() {
        let root = temp_dir("invalid-schema-runtime");
        let schema = write_manifest_json(
            &root,
            "schema.json",
            r#"{
                "schemaVersion": 2,
                "runtime": "node-builds/asyncify",
                "php": {
                    "8.3": {
                        "js": { "path": "php/php.js", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" },
                        "wasm": { "path": "php/php.wasm", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" }
                    }
                }
            }"#,
        );
        let error = load_php_assets_manifest(&schema).unwrap_err().to_string();
        assert!(error.contains("schemaVersion"), "{error}");

        let runtime = write_manifest_json(
            &root,
            "runtime.json",
            r#"{
                "schemaVersion": 1,
                "runtime": "node-builds/unknown",
                "php": {
                    "8.3": {
                        "js": { "path": "php/php.js", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" },
                        "wasm": { "path": "php/php.wasm", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" }
                    }
                }
            }"#,
        );
        let error = load_php_assets_manifest(&runtime).unwrap_err().to_string();
        assert!(error.contains("runtime"), "{error}");
    }

    #[test]
    fn rejects_manifest_with_unsafe_paths_or_invalid_checksums() {
        let root = temp_dir("invalid-path-checksum");
        let path = write_manifest_json(
            &root,
            "path.json",
            r#"{
                "schemaVersion": 1,
                "runtime": "node-builds/asyncify",
                "php": {
                    "8.3": {
                        "js": { "path": "../php.php", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" },
                        "wasm": { "path": "php/php.wasm", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" }
                    }
                }
            }"#,
        );
        let error = load_php_assets_manifest(&path).unwrap_err().to_string();
        assert!(
            error.contains("relative path inside the asset root"),
            "{error}"
        );

        let checksum = write_manifest_json(
            &root,
            "checksum.json",
            r#"{
                "schemaVersion": 1,
                "runtime": "node-builds/asyncify",
                "php": {
                    "8.3": {
                        "js": { "path": "php/php.js", "sha256": "not-a-sha" },
                        "wasm": { "path": "php/php.wasm", "sha256": "0000000000000000000000000000000000000000000000000000000000000000" }
                    }
                }
            }"#,
        );
        let error = load_php_assets_manifest(&checksum).unwrap_err().to_string();
        assert!(error.contains("SHA-256"), "{error}");
    }
}
