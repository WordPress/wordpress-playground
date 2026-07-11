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
pub const PHP_ASSET_MANIFEST_RUNTIME_WASIP2_COMPONENT: &str = "wasip2-component";
pub const NATIVE_COMPONENT_PHP_VERSIONS: &[&str] = &["8.2"];

const PHP_ASSET_MANIFEST_SCHEMA_VERSION: u8 = 2;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct FileAsset {
    pub path: PathBuf,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpAsset {
    pub version: String,
    pub wasm: FileAsset,
    pub wasmtime: Option<FileAsset>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetManifest {
    pub schema_version: u8,
    pub php: Vec<PhpAsset>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawAssetManifest {
    #[serde(rename = "schemaVersion")]
    schema_version: u8,
    runtime: String,
    php: BTreeMap<String, RawPhpAsset>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawPhpAsset {
    wasm: FileAsset,
    #[serde(default)]
    wasmtime: Option<FileAsset>,
}

impl AssetManifest {
    pub fn to_json(&self) -> String {
        let mut json = String::new();
        json.push_str("{\n");
        json.push_str(&format!("\t\"schemaVersion\": {},\n", self.schema_version));
        json.push_str(&format!(
            "\t\"runtime\": \"{}\",\n",
            PHP_ASSET_MANIFEST_RUNTIME_WASIP2_COMPONENT
        ));
        json.push_str("\t\"php\": {\n");
        push_php_assets(&mut json, &self.php, 2);
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
    Ok(AssetManifest {
        schema_version: raw.schema_version,
        php: convert_raw_php_assets(raw.php),
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

pub fn sha256_file(path: &Path) -> Result<String> {
    let file = fs::File::open(path)?;
    Ok(sha256_reader_hex(file)?)
}

pub fn verify_file_asset(asset_root: &Path, asset: &FileAsset) -> Result<()> {
    validate_file_asset(asset, "asset")?;
    let path = asset_root.join(&asset.path);
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

pub fn select_php_asset<'a>(manifest: &'a AssetManifest, version: &str) -> Result<&'a PhpAsset> {
    let available_versions = manifest
        .php
        .iter()
        .map(|asset| asset.version.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    manifest
        .php
        .iter()
        .find(|asset| asset.version == version)
        .ok_or_else(|| {
            CliError::new(format!(
                "No PHP WASIp2 component is available for PHP {version}; available versions: {available_versions}"
            ))
        })
}

fn push_php_assets(json: &mut String, assets: &[PhpAsset], indent: usize) {
    let asset_indent = "\t".repeat(indent);
    for (index, asset) in assets.iter().enumerate() {
        json.push_str(&format!(
            "{asset_indent}\"{}\": {{\n",
            escape_json(&asset.version)
        ));
        push_file_asset(
            json,
            indent + 1,
            "wasm",
            &asset.wasm,
            if asset.wasmtime.is_some() { "," } else { "" },
        );
        if let Some(wasmtime) = &asset.wasmtime {
            push_file_asset(json, indent + 1, "wasmtime", wasmtime, "");
        }
        json.push_str(&format!("{asset_indent}}}"));
        if index + 1 != assets.len() {
            json.push(',');
        }
        json.push('\n');
    }
}

fn push_file_asset(json: &mut String, indent: usize, key: &str, asset: &FileAsset, suffix: &str) {
    let field_indent = "\t".repeat(indent);
    let value_indent = "\t".repeat(indent + 1);
    json.push_str(&format!(
        "{field_indent}\"{key}\": {{\n{value_indent}\"path\": \"{}\",\n{value_indent}\"sha256\": \"{}\"\n{field_indent}}}{suffix}\n",
        escape_json(&asset.path.to_string_lossy()),
        escape_json(&asset.sha256)
    ));
}

fn validate_raw_manifest(raw: &RawAssetManifest) -> Result<()> {
    if raw.schema_version != PHP_ASSET_MANIFEST_SCHEMA_VERSION {
        return Err(CliError::new(format!(
            "Unsupported PHP asset manifest schemaVersion {}; expected {}",
            raw.schema_version, PHP_ASSET_MANIFEST_SCHEMA_VERSION
        )));
    }
    validate_manifest_runtime(&raw.runtime)?;
    validate_raw_php_assets(&raw.php)?;
    Ok(())
}

fn validate_raw_php_assets(php: &BTreeMap<String, RawPhpAsset>) -> Result<()> {
    if php.is_empty() {
        return Err(CliError::new(
            "PHP asset manifest must list at least one PHP version",
        ));
    }
    for (version, asset) in php {
        validate_php_version(version)?;
        validate_file_asset(
            &asset.wasm,
            &format!("PHP asset manifest PHP {version} component"),
        )?;
        if let Some(wasmtime) = &asset.wasmtime {
            validate_file_asset(
                wasmtime,
                &format!("PHP asset manifest PHP {version} precompiled component"),
            )?;
        }
    }
    Ok(())
}

fn validate_manifest_runtime(runtime: &str) -> Result<()> {
    if runtime == PHP_ASSET_MANIFEST_RUNTIME_WASIP2_COMPONENT {
        return Ok(());
    }
    Err(CliError::new(format!(
        "Unsupported PHP asset manifest runtime `{runtime}`; expected `{PHP_ASSET_MANIFEST_RUNTIME_WASIP2_COMPONENT}`"
    )))
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
    if !NATIVE_COMPONENT_PHP_VERSIONS.contains(&version) {
        return Err(CliError::new(format!(
            "Unsupported PHP version `{version}` in native component asset manifest; expected {}",
            NATIVE_COMPONENT_PHP_VERSIONS.join(", ")
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
    if path.to_string_lossy().contains('\\') {
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

fn convert_raw_php_assets(php: BTreeMap<String, RawPhpAsset>) -> Vec<PhpAsset> {
    let mut php = php
        .into_iter()
        .map(|(version, asset)| PhpAsset {
            version,
            wasm: asset.wasm,
            wasmtime: asset.wasmtime,
        })
        .collect::<Vec<_>>();
    php.sort_by(|left, right| {
        version_sort_key(&left.version).cmp(&version_sort_key(&right.version))
    });
    php
}

fn version_sort_key(version: &str) -> Vec<u16> {
    version
        .split('.')
        .map(|part| part.parse::<u16>().unwrap_or(0))
        .collect()
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
    use std::{
        fs,
        path::{Path, PathBuf},
        sync::atomic::{AtomicU64, Ordering},
    };

    use super::{
        find_php_assets_manifest, load_php_assets_manifest, select_php_asset, verify_file_asset,
        FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH, NATIVE_COMPONENT_PHP_VERSIONS,
        PACKAGED_PHP_ASSET_MANIFEST_RELATIVE_PATH, SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH,
    };
    use crate::runtime::repo_root_from_manifest_dir;

    static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(1);
    const SHA: &str = "0000000000000000000000000000000000000000000000000000000000000000";

    #[test]
    fn checked_in_manifest_is_component_only_and_verified() {
        let root = repo_root_from_manifest_dir();
        let manifest =
            load_php_assets_manifest(&root.join(SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH)).unwrap();

        assert_eq!(
            manifest
                .php
                .iter()
                .map(|asset| asset.version.as_str())
                .collect::<Vec<_>>(),
            NATIVE_COMPONENT_PHP_VERSIONS
        );
        let asset = select_php_asset(&manifest, "8.2").unwrap();
        assert!(asset.wasmtime.is_none());
        verify_file_asset(&root, &asset.wasm).unwrap();
    }

    #[test]
    fn component_manifest_round_trips_without_js_glue() {
        let root = temp_dir("round-trip");
        let manifest_path = write_manifest(
            &root,
            "component.json",
            &format!(
                r#"{{
  "schemaVersion": 2,
  "runtime": "wasip2-component",
  "php": {{
    "8.2": {{
      "wasm": {{ "path": "php/php.component.wasm", "sha256": "{SHA}" }},
      "wasmtime": {{ "path": "php/php.component.cwasm", "sha256": "{SHA}" }}
    }}
  }}
}}"#
            ),
        );
        let manifest = load_php_assets_manifest(&manifest_path).unwrap();
        assert_eq!(manifest.php.len(), 1);
        assert!(manifest.to_json().contains("wasip2-component"));
        assert!(!manifest.to_json().contains("\"js\""));

        let serialized = write_manifest(&root, "serialized.json", &manifest.to_json());
        assert_eq!(load_php_assets_manifest(&serialized).unwrap(), manifest);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_legacy_runtime_js_glue_and_named_profiles() {
        let root = temp_dir("reject-legacy");
        let legacy = write_manifest(
            &root,
            "legacy.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"node-builds/wasmtime-async","php":{{"8.2":{{"wasm":{{"path":"php.wasm","sha256":"{SHA}"}}}}}}}}"#
            ),
        );
        assert!(load_php_assets_manifest(&legacy)
            .unwrap_err()
            .to_string()
            .contains("expected `wasip2-component`"));

        let js = write_manifest(
            &root,
            "js.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"wasip2-component","php":{{"8.2":{{"js":{{"path":"php.js","sha256":"{SHA}"}},"wasm":{{"path":"php.wasm","sha256":"{SHA}"}}}}}}}}"#
            ),
        );
        assert!(load_php_assets_manifest(&js)
            .unwrap_err()
            .to_string()
            .contains("unknown field `js`"));

        let other_version = write_manifest(
            &root,
            "php-8.3.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"wasip2-component","php":{{"8.3":{{"wasm":{{"path":"php.wasm","sha256":"{SHA}"}}}}}}}}"#
            ),
        );
        assert!(load_php_assets_manifest(&other_version)
            .unwrap_err()
            .to_string()
            .contains("expected 8.2"));

        let profile = write_manifest(
            &root,
            "profile.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"wasip2-component","php":{{"8.2":{{"wasm":{{"path":"php.wasm","sha256":"{SHA}"}}}}}},"profiles":{{}}}}"#
            ),
        );
        assert!(load_php_assets_manifest(&profile)
            .unwrap_err()
            .to_string()
            .contains("unknown field `profiles`"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_the_only_available_component_version() {
        let root = temp_dir("available-version");
        let manifest = write_manifest(
            &root,
            "manifest.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"wasip2-component","php":{{"8.2":{{"wasm":{{"path":"php.wasm","sha256":"{SHA}"}}}}}}}}"#
            ),
        );
        let manifest = load_php_assets_manifest(&manifest).unwrap();
        assert!(select_php_asset(&manifest, "8.3")
            .unwrap_err()
            .to_string()
            .contains("available versions: 8.2"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn finds_source_packaged_and_flat_manifests() {
        for (label, relative) in [
            ("source", SOURCE_PHP_ASSET_MANIFEST_RELATIVE_PATH),
            ("packaged", PACKAGED_PHP_ASSET_MANIFEST_RELATIVE_PATH),
            ("flat", FLAT_PHP_ASSET_MANIFEST_RELATIVE_PATH),
        ] {
            let root = temp_dir(label);
            let path = root.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, "{}").unwrap();
            assert_eq!(find_php_assets_manifest(&root).unwrap(), path);
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn verifies_component_checksum_and_rejects_escaping_paths() {
        let root = temp_dir("verify");
        fs::write(root.join("component.wasm"), b"component").unwrap();
        let manifest = write_manifest(
            &root,
            "valid.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"wasip2-component","php":{{"8.2":{{"wasm":{{"path":"component.wasm","sha256":"{}"}}}}}}}}"#,
                super::sha256_file(&root.join("component.wasm")).unwrap()
            ),
        );
        let manifest = load_php_assets_manifest(&manifest).unwrap();
        verify_file_asset(&root, &manifest.php[0].wasm).unwrap();

        let escaping = write_manifest(
            &root,
            "escaping.json",
            &format!(
                r#"{{"schemaVersion":2,"runtime":"wasip2-component","php":{{"8.2":{{"wasm":{{"path":"../component.wasm","sha256":"{SHA}"}}}}}}}}"#
            ),
        );
        assert!(load_php_assets_manifest(&escaping)
            .unwrap_err()
            .to_string()
            .contains("relative path inside the asset root"));
        fs::remove_dir_all(root).unwrap();
    }

    fn write_manifest(root: &Path, name: &str, contents: &str) -> PathBuf {
        let path = root.join(name);
        fs::write(&path, contents).unwrap();
        path
    }

    fn temp_dir(label: &str) -> PathBuf {
        let id = NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "wp-playground-native-assets-{label}-{}-{id}",
            std::process::id()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
