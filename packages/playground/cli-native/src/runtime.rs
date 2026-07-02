use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use wasmtime::{
    Cache, CacheConfig, Config, Engine, ExternType, Module, OptLevel, ProfilingStrategy,
    RegallocAlgorithm,
};

use crate::{
    assets::{
        find_php_assets_manifest, load_php_assets_manifest, select_php_asset, verify_file_asset,
        AssetManifest, PhpAsset, PhpAssetRuntime,
    },
    host::{create_stub_import_linker_with_options, HostOptions},
    CliError, Result,
};

pub const ASSET_ROOT_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_ASSET_ROOT";
pub const DISABLE_SOURCE_FALLBACK_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK";
const MAX_WASM_STACK_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MAX_WASM_STACK_MIB";
const ASYNC_STACK_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_ASYNC_STACK_MIB";
const MEMORY_RESERVATION_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB";
const MEMORY_GUARD_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB";
const MEMORY_RESERVATION_FOR_GROWTH_MIB_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_FOR_GROWTH_MIB";
const MEMORY_MAY_MOVE_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MEMORY_MAY_MOVE";
const WASMTIME_PROFILING_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_WASMTIME_PROFILING";
const DEFAULT_MAX_WASM_STACK_MIB: usize = 2;
const DEFAULT_ASYNC_STACK_MIB: usize = 2;
const WINDOWS_ARM64_DENSE_IMAGE_SIZE: u64 = 32 * 1024 * 1024;
const MAX_WASMTIME_MEMORY_TUNABLE_MIB: u64 = 262_144;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WasmImport {
    pub module: String,
    pub name: String,
    pub ty: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WasmExport {
    pub name: String,
    pub ty: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WasmModuleSummary {
    pub php_version: String,
    pub wasm_path: PathBuf,
    pub imports: Vec<WasmImport>,
    pub exports: Vec<WasmExport>,
    pub stub_linker_can_instantiate: bool,
}

pub struct NativeRuntime {
    pub(crate) repo_root: PathBuf,
    manifest: AssetManifest,
    engine: Engine,
    profile: WasmEngineProfile,
    module_cache: Mutex<HashMap<String, Module>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WasmEngineProfile {
    FastStartup,
    Optimized,
}

impl NativeRuntime {
    pub fn from_repo_root(repo_root: impl Into<PathBuf>) -> Result<Self> {
        Self::from_asset_root(repo_root)
    }

    pub fn from_asset_root(asset_root: impl Into<PathBuf>) -> Result<Self> {
        Self::from_asset_root_with_engine_profile(asset_root, WasmEngineProfile::FastStartup)
    }

    pub fn from_asset_root_with_engine_profile(
        asset_root: impl Into<PathBuf>,
        profile: WasmEngineProfile,
    ) -> Result<Self> {
        let repo_root = asset_root.into();
        let manifest_path = find_php_assets_manifest(&repo_root).ok_or_else(|| {
            CliError::new(format!(
                "PHP asset manifest not found under {}. Expected packages/playground/cli-native/assets/php-assets.json, assets/php-assets.json, or php-assets.json",
                repo_root.display()
            ))
        })?;
        let manifest = load_php_assets_manifest(&manifest_path)?;
        let engine = wasm_engine(profile)?;
        Ok(Self {
            repo_root,
            manifest,
            engine,
            profile,
            module_cache: Mutex::new(HashMap::new()),
        })
    }

    pub fn from_default_asset_root() -> Result<Self> {
        Self::from_asset_root(default_asset_root()?)
    }

    pub fn from_default_asset_root_with_engine_profile(profile: WasmEngineProfile) -> Result<Self> {
        Self::from_asset_root_with_engine_profile(default_asset_root()?, profile)
    }

    pub fn manifest(&self) -> &AssetManifest {
        &self.manifest
    }

    pub fn asset_root(&self) -> &Path {
        &self.repo_root
    }

    pub fn repo_root(&self) -> &Path {
        self.asset_root()
    }

    pub fn engine(&self) -> &Engine {
        &self.engine
    }

    pub fn php_module(&self, php_version: &str) -> Result<Module> {
        if let Some(module) = self
            .module_cache
            .lock()
            .map_err(|_| CliError::new("PHP module cache lock was poisoned"))?
            .get(php_version)
            .cloned()
        {
            return Ok(module);
        }

        self.verify_php_asset(php_version)?;
        let asset = self.php_asset(php_version)?;
        let module = self.load_php_module(php_version, asset)?;
        self.module_cache
            .lock()
            .map_err(|_| CliError::new("PHP module cache lock was poisoned"))?
            .insert(php_version.to_string(), module.clone());
        release_unused_process_memory();
        Ok(module)
    }

    fn load_php_module(&self, php_version: &str, asset: &PhpAsset) -> Result<Module> {
        if self.profile == WasmEngineProfile::Optimized {
            if let Some(wasmtime) = &asset.wasmtime {
                let wasmtime_path = self.repo_root.join(&wasmtime.path);
                match unsafe { Module::deserialize_file(&self.engine, &wasmtime_path) } {
                    Ok(module) => return Ok(module),
                    Err(error) => {
                        eprintln!(
                            "warning: failed to load precompiled PHP {php_version} Wasmtime module {}; falling back to wasm compilation: {error}",
                            wasmtime_path.display()
                        );
                    }
                }
            }
        }

        self.compile_php_wasm_module(php_version, asset)
    }

    fn compile_php_wasm_module(&self, php_version: &str, asset: &PhpAsset) -> Result<Module> {
        let wasm_path = self.repo_root.join(&asset.wasm.path);
        let runtime = self
            .manifest
            .php_runtime()
            .unwrap_or(PhpAssetRuntime::Asyncify);
        let runtime_hint = if runtime.uses_wasmtime_async() {
            "; this manifest selected the Wasmtime async PHP runtime. The current node-builds/jspi PHP artifacts use legacy WebAssembly exceptions, which this Wasmtime compiler does not support. Rebuild PHP wasm without legacy exceptions before switching the manifest runtime."
        } else {
            ""
        };
        Module::from_file(&self.engine, &wasm_path).map_err(|error| {
            CliError::new(format!(
                "Failed to compile PHP {php_version} wasm module {} with Wasmtime: {error}{runtime_hint}",
                wasm_path.display(),
            ))
        })
    }

    pub fn php_asset(&self, php_version: &str) -> Result<&PhpAsset> {
        select_php_asset(&self.manifest, php_version)
    }

    pub fn verify_php_asset(&self, php_version: &str) -> Result<()> {
        let asset = self.php_asset(php_version)?;
        verify_file_asset(&self.repo_root, &asset.js)?;
        verify_file_asset(&self.repo_root, &asset.wasm)?;
        if let Some(wasmtime) = &asset.wasmtime {
            verify_file_asset(&self.repo_root, wasmtime)?;
        }
        Ok(())
    }

    pub fn wasm_module_summary(&self, php_version: &str) -> Result<WasmModuleSummary> {
        let asset = self.php_asset(php_version)?;
        let wasm_path = self.repo_root.join(&asset.wasm.path);
        let module = self.php_module(php_version)?;

        let imports = module
            .imports()
            .map(|import| WasmImport {
                module: import.module().to_string(),
                name: import.name().to_string(),
                ty: describe_extern_type(import.ty()),
            })
            .collect::<Vec<_>>();
        let exports = module
            .exports()
            .map(|export| WasmExport {
                name: export.name().to_string(),
                ty: describe_extern_type(export.ty()),
            })
            .collect::<Vec<_>>();

        Ok(WasmModuleSummary {
            php_version: php_version.to_string(),
            wasm_path,
            imports,
            exports,
            stub_linker_can_instantiate: false,
        })
    }

    pub fn wasm_module_stub_instantiation_summary(
        &self,
        php_version: &str,
    ) -> Result<WasmModuleSummary> {
        let mut summary = self.wasm_module_summary(php_version)?;
        let module = self.php_module(php_version)?;
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                php_runtime: self.manifest.php_runtime()?,
                ..HostOptions::default()
            },
        )?;
        let _instance = linker.instantiate(&module)?;
        summary.stub_linker_can_instantiate = true;
        Ok(summary)
    }
}

fn wasm_engine(profile: WasmEngineProfile) -> Result<Engine> {
    wasm_engine_for_target(profile, None)
}

fn wasm_engine_for_target(
    profile: WasmEngineProfile,
    target_triple: Option<&str>,
) -> Result<Engine> {
    let mut config = Config::new();
    if let Some(target_triple) = target_triple {
        config.target(target_triple).map_err(|error| {
            CliError::new(format!(
                "Failed to configure Wasmtime target {target_triple}: {error}"
            ))
        })?;
    }
    if let Some(profiling) = wasmtime_profiling_from_env()? {
        config.profiler(profiling.strategy());
    }
    let settings = wasm_engine_settings(profile, target_triple);
    config.cranelift_opt_level(settings.opt_level);
    config.cranelift_regalloc_algorithm(settings.regalloc_algorithm);
    config.generate_address_map(false);
    if !uses_windows_unwind_info(target_triple) {
        config.native_unwind_info(false);
    }
    if let Some(size) = memory_guaranteed_dense_image_size(target_triple) {
        // Keep PHP 8.5's sparse-but-small initial memory image out of the
        // generated module-start trampoline that overflows Windows ARM64 unwind metadata.
        config.memory_guaranteed_dense_image_size(size);
    }
    let max_wasm_stack = env_mib_usize(
        MAX_WASM_STACK_MIB_ENV_VAR,
        DEFAULT_MAX_WASM_STACK_MIB,
        1,
        256,
    );
    let async_stack_size =
        env_mib_usize(ASYNC_STACK_MIB_ENV_VAR, DEFAULT_ASYNC_STACK_MIB, 1, 256).max(max_wasm_stack);
    config.max_wasm_stack(max_wasm_stack);
    config.async_stack_size(async_stack_size);
    config.memory_may_move(false);
    if let Some(bytes) = env_mib_u64(
        MEMORY_RESERVATION_MIB_ENV_VAR,
        MAX_WASMTIME_MEMORY_TUNABLE_MIB,
    ) {
        config.memory_reservation(bytes);
    }
    if let Some(bytes) = env_mib_u64(MEMORY_GUARD_MIB_ENV_VAR, MAX_WASMTIME_MEMORY_TUNABLE_MIB) {
        config.memory_guard_size(bytes);
    }
    if let Some(bytes) = env_mib_u64(
        MEMORY_RESERVATION_FOR_GROWTH_MIB_ENV_VAR,
        MAX_WASMTIME_MEMORY_TUNABLE_MIB,
    ) {
        config.memory_reservation_for_growth(bytes);
    }
    if let Some(enabled) = env_bool(MEMORY_MAY_MOVE_ENV_VAR) {
        config.memory_may_move(enabled);
    }
    if let Ok(cache_dir) = crate::download::playground_cache_dir() {
        let mut cache_config = CacheConfig::new();
        cache_config.with_directory(cache_dir.join("wasmtime"));
        if let Ok(cache) = Cache::new(cache_config) {
            config.cache(Some(cache));
        }
    }
    Engine::new(&config)
        .map_err(|error| CliError::new(format!("Failed to initialize Wasmtime engine: {error}")))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WasmtimeProfiling {
    PerfMap,
    JitDump,
    VTune,
}

impl WasmtimeProfiling {
    fn strategy(self) -> ProfilingStrategy {
        match self {
            Self::PerfMap => ProfilingStrategy::PerfMap,
            Self::JitDump => ProfilingStrategy::JitDump,
            Self::VTune => ProfilingStrategy::VTune,
        }
    }
}

fn wasmtime_profiling_from_env() -> Result<Option<WasmtimeProfiling>> {
    match env::var(WASMTIME_PROFILING_ENV_VAR) {
        Ok(value) => parse_wasmtime_profiling(&value),
        Err(_) => Ok(None),
    }
}

fn parse_wasmtime_profiling(value: &str) -> Result<Option<WasmtimeProfiling>> {
    match value.trim().to_ascii_lowercase().as_str() {
        "" | "none" => Ok(None),
        "perfmap" => Ok(Some(WasmtimeProfiling::PerfMap)),
        "jitdump" => Ok(Some(WasmtimeProfiling::JitDump)),
        "vtune" => Ok(Some(WasmtimeProfiling::VTune)),
        _ => Err(CliError::new(format!(
            "Invalid {WASMTIME_PROFILING_ENV_VAR}={value:?}; expected perfmap, jitdump, vtune, or none"
        ))),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WasmEngineSettings {
    opt_level: OptLevel,
    regalloc_algorithm: RegallocAlgorithm,
}

fn wasm_engine_settings(
    profile: WasmEngineProfile,
    target_triple: Option<&str>,
) -> WasmEngineSettings {
    if uses_windows_arm64_unwind_info(target_triple) {
        // Windows ARM64 unwind records encode function length in 18 bits of words.
        // PHP 7.4+ can exceed that with larger codegen, so minimize code size here.
        return WasmEngineSettings {
            opt_level: OptLevel::SpeedAndSize,
            regalloc_algorithm: RegallocAlgorithm::Backtracking,
        };
    }

    match profile {
        WasmEngineProfile::FastStartup => WasmEngineSettings {
            opt_level: OptLevel::None,
            regalloc_algorithm: RegallocAlgorithm::SinglePass,
        },
        WasmEngineProfile::Optimized => WasmEngineSettings {
            opt_level: OptLevel::Speed,
            regalloc_algorithm: RegallocAlgorithm::Backtracking,
        },
    }
}

fn uses_windows_unwind_info(target_triple: Option<&str>) -> bool {
    target_triple
        .map(is_windows_target)
        .unwrap_or(cfg!(target_os = "windows"))
}

fn uses_windows_arm64_unwind_info(target_triple: Option<&str>) -> bool {
    target_triple
        .map(is_windows_arm64_target)
        .unwrap_or(cfg!(all(target_os = "windows", target_arch = "aarch64")))
}

fn memory_guaranteed_dense_image_size(target_triple: Option<&str>) -> Option<u64> {
    uses_windows_arm64_unwind_info(target_triple).then_some(WINDOWS_ARM64_DENSE_IMAGE_SIZE)
}

fn is_windows_target(target_triple: &str) -> bool {
    target_triple.contains("-windows-")
}

fn is_windows_arm64_target(target_triple: &str) -> bool {
    target_triple.starts_with("aarch64-") && target_triple.contains("-windows-")
}

fn env_mib_usize(name: &str, default_mib: usize, min_mib: usize, max_mib: usize) -> usize {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| (*value >= min_mib) && (*value <= max_mib))
        .unwrap_or(default_mib)
        * 1024
        * 1024
}

fn env_mib_u64(name: &str, max_mib: u64) -> Option<u64> {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value <= max_mib)
        .map(|value| value * 1024 * 1024)
}

fn env_bool(name: &str) -> Option<bool> {
    env::var(name)
        .ok()
        .and_then(|value| match value.to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        })
}

pub fn precompile_wasm_module(
    wasm_path: &Path,
    output_path: &Path,
    profile: WasmEngineProfile,
) -> Result<()> {
    precompile_wasm_module_for_target(wasm_path, output_path, profile, None)
}

pub fn precompile_wasm_module_for_target(
    wasm_path: &Path,
    output_path: &Path,
    profile: WasmEngineProfile,
    target_triple: Option<&str>,
) -> Result<()> {
    let wasm = fs::read(wasm_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read wasm module {} for Wasmtime precompilation: {error}",
            wasm_path.display()
        ))
    })?;
    let engine = wasm_engine_for_target(profile, target_triple)?;
    let compiled = engine.precompile_module(&wasm).map_err(|error| {
        CliError::new(format!(
            "Failed to precompile wasm module {} with Wasmtime: {error}",
            wasm_path.display()
        ))
    })?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, compiled).map_err(|error| {
        CliError::new(format!(
            "Failed to write precompiled Wasmtime module {}: {error}",
            output_path.display()
        ))
    })?;
    Ok(())
}

fn describe_extern_type(ty: ExternType) -> String {
    match ty {
        ExternType::Func(func) => format!("func({func:?})"),
        ExternType::Global(global) => format!("global({global:?})"),
        ExternType::Table(table) => format!("table({table:?})"),
        ExternType::Memory(memory) => format!("memory({memory:?})"),
        ExternType::Tag(tag) => format!("tag({tag:?})"),
    }
}

pub fn release_unused_process_memory() {
    platform_release_unused_process_memory();
}

#[cfg(target_os = "macos")]
fn platform_release_unused_process_memory() {
    extern "C" {
        fn malloc_default_zone() -> *mut std::ffi::c_void;
        fn malloc_zone_pressure_relief(zone: *mut std::ffi::c_void, goal: usize) -> usize;
    }

    unsafe {
        let _ = malloc_zone_pressure_relief(malloc_default_zone(), 0);
    }
}

#[cfg(target_os = "linux")]
fn platform_release_unused_process_memory() {
    extern "C" {
        fn malloc_trim(pad: usize) -> i32;
    }

    unsafe {
        let _ = malloc_trim(0);
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
fn platform_release_unused_process_memory() {}

pub fn repo_root_from_manifest_dir() -> PathBuf {
    asset_root_from_manifest_dir()
}

pub fn asset_root_from_manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

pub fn default_asset_root() -> Result<PathBuf> {
    if let Some(value) = env::var_os(ASSET_ROOT_ENV_VAR) {
        let root = PathBuf::from(value);
        if root.as_os_str().is_empty() {
            return Err(CliError::new(format!(
                "{ASSET_ROOT_ENV_VAR} is set but empty"
            )));
        }
        return validate_asset_root(root, Some(ASSET_ROOT_ENV_VAR));
    }

    let mut candidates = Vec::new();
    if let Ok(exe) = env::current_exe() {
        candidates.extend(asset_root_candidates_from_exe(&exe));
    }
    if env::var_os(DISABLE_SOURCE_FALLBACK_ENV_VAR).is_none() {
        candidates.push(asset_root_from_manifest_dir());
    }

    for candidate in dedupe_paths(candidates) {
        if find_php_assets_manifest(&candidate).is_some() {
            return Ok(candidate);
        }
    }

    Err(CliError::new(format!(
        "Could not find wp-playground-native assets. Set {ASSET_ROOT_ENV_VAR} to a directory containing packages/playground/cli-native/assets/php-assets.json, assets/php-assets.json, or php-assets.json."
    )))
}

fn validate_asset_root(root: PathBuf, source: Option<&str>) -> Result<PathBuf> {
    if find_php_assets_manifest(&root).is_some() {
        Ok(root)
    } else if let Some(source) = source {
        Err(CliError::new(format!(
            "{source} points to {}, but no PHP asset manifest was found there",
            root.display()
        )))
    } else {
        Err(CliError::new(format!(
            "No PHP asset manifest was found under {}",
            root.display()
        )))
    }
}

fn asset_root_candidates_from_exe(exe: &Path) -> Vec<PathBuf> {
    let Some(bin_dir) = exe.parent() else {
        return Vec::new();
    };

    let mut candidates = vec![
        bin_dir.to_path_buf(),
        bin_dir.join("assets"),
        bin_dir.join("share").join("wp-playground-native"),
        bin_dir
            .join("..")
            .join("share")
            .join("wp-playground-native"),
    ];
    if let Some(prefix) = bin_dir.parent() {
        candidates.push(prefix.to_path_buf());
        candidates.push(prefix.join("assets"));
        candidates.push(prefix.join("share").join("wp-playground-native"));
    }
    candidates
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut deduped = Vec::new();
    for path in paths {
        if !deduped.iter().any(|existing| existing == &path) {
            deduped.push(path);
        }
    }
    deduped
}

#[cfg(test)]
mod tests {
    use super::{
        asset_root_candidates_from_exe, default_asset_root, env_bool, env_mib_u64, env_mib_usize,
        memory_guaranteed_dense_image_size, parse_wasmtime_profiling,
        precompile_wasm_module_for_target, repo_root_from_manifest_dir, uses_windows_unwind_info,
        wasm_engine, wasm_engine_settings, NativeRuntime, WasmEngineProfile, WasmtimeProfiling,
        ASSET_ROOT_ENV_VAR, DISABLE_SOURCE_FALLBACK_ENV_VAR, MAX_WASM_STACK_MIB_ENV_VAR,
        MEMORY_MAY_MOVE_ENV_VAR, MEMORY_RESERVATION_MIB_ENV_VAR, WASMTIME_PROFILING_ENV_VAR,
    };
    use crate::host::{classify_php_wasm_import, ImportClassification, ImportExternKind};
    use crate::sha256::sha256_hex;
    use std::{
        env, fs,
        path::{Path, PathBuf},
        sync::Mutex,
        time::{SystemTime, UNIX_EPOCH},
    };
    use wasmparser::{Parser, Payload, TypeRef};
    use wasmtime::{OptLevel, RegallocAlgorithm};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = env::temp_dir().join(format!("wp-playground-native-runtime-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_packaged_asset_root(root: &Path) {
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(root.join("php")).unwrap();
        fs::write(root.join("php/php_8_3.js"), b"js").unwrap();
        fs::write(root.join("php/php_8_3.wasm"), b"wasm").unwrap();
        fs::write(
            root.join("assets/php-assets.json"),
            format!(
                r#"{{
                    "schemaVersion": 1,
                    "runtime": "node-builds/asyncify",
                    "php": {{
                        "8.3": {{
                            "js": {{
                                "path": "php/php_8_3.js",
                                "sha256": "{}"
                            }},
                            "wasm": {{
                                "path": "php/php_8_3.wasm",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                sha256_hex(b"js"),
                sha256_hex(b"wasm")
            ),
        )
        .unwrap();
    }

    fn write_packaged_asset_root_with_wasmtime(root: &Path, wasm: &[u8], wasmtime: &[u8]) {
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(root.join("php")).unwrap();
        fs::write(root.join("php/php_8_3.js"), b"js").unwrap();
        fs::write(root.join("php/php_8_3.wasm"), wasm).unwrap();
        fs::write(root.join("php/php_8_3.wasm.cwasm"), wasmtime).unwrap();
        fs::write(
            root.join("assets/php-assets.json"),
            format!(
                r#"{{
                    "schemaVersion": 1,
                    "runtime": "node-builds/asyncify",
                    "php": {{
                        "8.3": {{
                            "js": {{
                                "path": "php/php_8_3.js",
                                "sha256": "{}"
                            }},
                            "wasm": {{
                                "path": "php/php_8_3.wasm",
                                "sha256": "{}"
                            }},
                            "wasmtime": {{
                                "path": "php/php_8_3.wasm.cwasm",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                sha256_hex(b"js"),
                sha256_hex(wasm),
                sha256_hex(wasmtime)
            ),
        )
        .unwrap();
    }

    #[test]
    fn loads_and_verifies_packaged_asset_root() {
        let root = temp_dir("packaged-root");
        write_packaged_asset_root(&root);

        let runtime = NativeRuntime::from_asset_root(&root).unwrap();

        assert_eq!(runtime.asset_root(), root.as_path());
        assert_eq!(
            runtime.php_asset("8.3").unwrap().wasm.path,
            PathBuf::from("php/php_8_3.wasm")
        );
        runtime.verify_php_asset("8.3").unwrap();
    }

    #[test]
    fn optimized_runtime_falls_back_to_wasm_when_precompiled_asset_is_unusable() {
        let root = temp_dir("precompiled-fallback-root");
        write_packaged_asset_root_with_wasmtime(&root, b"\0asm\x01\0\0\0", b"not-cwasm");

        let runtime =
            NativeRuntime::from_asset_root_with_engine_profile(&root, WasmEngineProfile::Optimized)
                .unwrap();
        let module = runtime.php_module("8.3").unwrap();

        assert_eq!(module.imports().count(), 0);
        assert_eq!(module.exports().count(), 0);
    }

    #[test]
    fn discovers_asset_root_from_env_var() {
        let _guard = ENV_LOCK.lock().unwrap();
        let root = temp_dir("env-root");
        write_packaged_asset_root(&root);
        let previous = env::var_os(ASSET_ROOT_ENV_VAR);
        env::set_var(ASSET_ROOT_ENV_VAR, &root);

        let discovered = default_asset_root().unwrap();

        assert_eq!(discovered, root);
        if let Some(previous) = previous {
            env::set_var(ASSET_ROOT_ENV_VAR, previous);
        } else {
            env::remove_var(ASSET_ROOT_ENV_VAR);
        }
    }

    #[test]
    fn rejects_invalid_env_asset_root() {
        let _guard = ENV_LOCK.lock().unwrap();
        let root = temp_dir("invalid-env-root");
        let previous = env::var_os(ASSET_ROOT_ENV_VAR);
        env::set_var(ASSET_ROOT_ENV_VAR, &root);

        let error = default_asset_root().unwrap_err().to_string();

        assert!(error.contains(ASSET_ROOT_ENV_VAR));
        if let Some(previous) = previous {
            env::set_var(ASSET_ROOT_ENV_VAR, previous);
        } else {
            env::remove_var(ASSET_ROOT_ENV_VAR);
        }
    }

    #[test]
    fn can_disable_source_tree_asset_fallback() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous_root = env::var_os(ASSET_ROOT_ENV_VAR);
        let previous_disable = env::var_os(DISABLE_SOURCE_FALLBACK_ENV_VAR);
        env::remove_var(ASSET_ROOT_ENV_VAR);
        env::set_var(DISABLE_SOURCE_FALLBACK_ENV_VAR, "1");

        let result = default_asset_root();

        assert!(result.is_err());
        if let Some(previous_root) = previous_root {
            env::set_var(ASSET_ROOT_ENV_VAR, previous_root);
        } else {
            env::remove_var(ASSET_ROOT_ENV_VAR);
        }
        if let Some(previous_disable) = previous_disable {
            env::set_var(DISABLE_SOURCE_FALLBACK_ENV_VAR, previous_disable);
        } else {
            env::remove_var(DISABLE_SOURCE_FALLBACK_ENV_VAR);
        }
    }

    #[test]
    fn derives_install_prefix_candidates_from_binary_path() {
        let candidates =
            asset_root_candidates_from_exe(Path::new("/opt/wp/bin/wp-playground-native"));

        assert!(candidates.contains(&PathBuf::from("/opt/wp/bin")));
        assert!(candidates.contains(&PathBuf::from("/opt/wp/share/wp-playground-native")));
    }

    #[test]
    fn windows_arm64_target_uses_size_optimized_backtracking_and_native_unwind() {
        let fast_startup = wasm_engine_settings(
            WasmEngineProfile::FastStartup,
            Some("aarch64-pc-windows-msvc"),
        );
        let optimized = wasm_engine_settings(
            WasmEngineProfile::Optimized,
            Some("aarch64-pc-windows-msvc"),
        );
        let linux_fast_startup = wasm_engine_settings(
            WasmEngineProfile::FastStartup,
            Some("aarch64-unknown-linux-gnu"),
        );

        assert_eq!(fast_startup.opt_level, OptLevel::SpeedAndSize);
        assert_eq!(
            fast_startup.regalloc_algorithm,
            RegallocAlgorithm::Backtracking
        );
        assert_eq!(optimized.opt_level, OptLevel::SpeedAndSize);
        assert_eq!(
            optimized.regalloc_algorithm,
            RegallocAlgorithm::Backtracking
        );
        assert_eq!(linux_fast_startup.opt_level, OptLevel::None);
        assert_eq!(
            linux_fast_startup.regalloc_algorithm,
            RegallocAlgorithm::SinglePass
        );
        assert!(uses_windows_unwind_info(Some("aarch64-pc-windows-msvc")));
        assert!(uses_windows_unwind_info(Some("x86_64-pc-windows-msvc")));
        assert!(!uses_windows_unwind_info(Some("aarch64-unknown-linux-gnu")));
        assert_eq!(
            memory_guaranteed_dense_image_size(Some("aarch64-pc-windows-msvc")),
            Some(32 * 1024 * 1024)
        );
        assert_eq!(
            memory_guaranteed_dense_image_size(Some("aarch64-unknown-linux-gnu")),
            None
        );
    }

    #[test]
    fn wasm_stack_mib_env_uses_valid_values_and_ignores_invalid_values() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = env::var_os(MAX_WASM_STACK_MIB_ENV_VAR);

        env::remove_var(MAX_WASM_STACK_MIB_ENV_VAR);
        assert_eq!(
            env_mib_usize(MAX_WASM_STACK_MIB_ENV_VAR, 8, 1, 256),
            8 * 1024 * 1024
        );

        env::set_var(MAX_WASM_STACK_MIB_ENV_VAR, "4");
        assert_eq!(
            env_mib_usize(MAX_WASM_STACK_MIB_ENV_VAR, 8, 1, 256),
            4 * 1024 * 1024
        );

        env::set_var(MAX_WASM_STACK_MIB_ENV_VAR, "0");
        assert_eq!(
            env_mib_usize(MAX_WASM_STACK_MIB_ENV_VAR, 8, 1, 256),
            8 * 1024 * 1024
        );

        env::set_var(MAX_WASM_STACK_MIB_ENV_VAR, "257");
        assert_eq!(
            env_mib_usize(MAX_WASM_STACK_MIB_ENV_VAR, 8, 1, 256),
            8 * 1024 * 1024
        );

        if let Some(previous) = previous {
            env::set_var(MAX_WASM_STACK_MIB_ENV_VAR, previous);
        } else {
            env::remove_var(MAX_WASM_STACK_MIB_ENV_VAR);
        }
    }

    #[test]
    fn wasmtime_memory_mib_env_accepts_zero_and_valid_values_only() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = env::var_os(MEMORY_RESERVATION_MIB_ENV_VAR);

        env::remove_var(MEMORY_RESERVATION_MIB_ENV_VAR);
        assert_eq!(env_mib_u64(MEMORY_RESERVATION_MIB_ENV_VAR, 1024), None);

        env::set_var(MEMORY_RESERVATION_MIB_ENV_VAR, "0");
        assert_eq!(env_mib_u64(MEMORY_RESERVATION_MIB_ENV_VAR, 1024), Some(0));

        env::set_var(MEMORY_RESERVATION_MIB_ENV_VAR, "512");
        assert_eq!(
            env_mib_u64(MEMORY_RESERVATION_MIB_ENV_VAR, 1024),
            Some(512 * 1024 * 1024)
        );

        env::set_var(MEMORY_RESERVATION_MIB_ENV_VAR, "1025");
        assert_eq!(env_mib_u64(MEMORY_RESERVATION_MIB_ENV_VAR, 1024), None);

        env::set_var(MEMORY_RESERVATION_MIB_ENV_VAR, "not-a-number");
        assert_eq!(env_mib_u64(MEMORY_RESERVATION_MIB_ENV_VAR, 1024), None);

        if let Some(previous) = previous {
            env::set_var(MEMORY_RESERVATION_MIB_ENV_VAR, previous);
        } else {
            env::remove_var(MEMORY_RESERVATION_MIB_ENV_VAR);
        }
    }

    #[test]
    fn env_bool_accepts_common_boolean_values() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = env::var_os(MEMORY_MAY_MOVE_ENV_VAR);

        env::remove_var(MEMORY_MAY_MOVE_ENV_VAR);
        assert_eq!(env_bool(MEMORY_MAY_MOVE_ENV_VAR), None);

        env::set_var(MEMORY_MAY_MOVE_ENV_VAR, "false");
        assert_eq!(env_bool(MEMORY_MAY_MOVE_ENV_VAR), Some(false));

        env::set_var(MEMORY_MAY_MOVE_ENV_VAR, "0");
        assert_eq!(env_bool(MEMORY_MAY_MOVE_ENV_VAR), Some(false));

        env::set_var(MEMORY_MAY_MOVE_ENV_VAR, "true");
        assert_eq!(env_bool(MEMORY_MAY_MOVE_ENV_VAR), Some(true));

        env::set_var(MEMORY_MAY_MOVE_ENV_VAR, "yes");
        assert_eq!(env_bool(MEMORY_MAY_MOVE_ENV_VAR), Some(true));

        env::set_var(MEMORY_MAY_MOVE_ENV_VAR, "not-a-bool");
        assert_eq!(env_bool(MEMORY_MAY_MOVE_ENV_VAR), None);

        if let Some(previous) = previous {
            env::set_var(MEMORY_MAY_MOVE_ENV_VAR, previous);
        } else {
            env::remove_var(MEMORY_MAY_MOVE_ENV_VAR);
        }
    }

    #[test]
    fn wasmtime_profiling_env_accepts_supported_values_and_none() {
        assert_eq!(parse_wasmtime_profiling("").unwrap(), None);
        assert_eq!(parse_wasmtime_profiling(" none ").unwrap(), None);
        assert_eq!(
            parse_wasmtime_profiling("perfmap").unwrap(),
            Some(WasmtimeProfiling::PerfMap)
        );
        assert_eq!(
            parse_wasmtime_profiling("JITDUMP").unwrap(),
            Some(WasmtimeProfiling::JitDump)
        );
        assert_eq!(
            parse_wasmtime_profiling("VTune").unwrap(),
            Some(WasmtimeProfiling::VTune)
        );
    }

    #[test]
    fn wasmtime_profiling_env_rejects_invalid_values() {
        let error = parse_wasmtime_profiling("speedscope")
            .unwrap_err()
            .to_string();

        assert!(error.contains(WASMTIME_PROFILING_ENV_VAR));
        assert!(error.contains("perfmap"));
        assert!(error.contains("jitdump"));
        assert!(error.contains("vtune"));
        assert!(error.contains("none"));
    }

    #[test]
    fn wasmtime_profiling_env_rejects_invalid_value_before_engine_init() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = env::var_os(WASMTIME_PROFILING_ENV_VAR);
        env::set_var(WASMTIME_PROFILING_ENV_VAR, "speedscope");

        let error = wasm_engine(WasmEngineProfile::FastStartup)
            .unwrap_err()
            .to_string();

        assert!(error.contains(WASMTIME_PROFILING_ENV_VAR));
        assert!(error.contains("speedscope"));
        if let Some(previous) = previous {
            env::set_var(WASMTIME_PROFILING_ENV_VAR, previous);
        } else {
            env::remove_var(WASMTIME_PROFILING_ENV_VAR);
        }
    }

    #[test]
    #[ignore = "Full PHP wasm compilation is an explicit smoke test, not part of the fast unit suite."]
    fn loads_manifest_and_compiles_php83_module_metadata_with_wasmtime() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let summary = runtime.wasm_module_summary("8.3").unwrap();

        assert_eq!(summary.php_version, "8.3");
        assert!(!summary.imports.is_empty());
        assert!(!summary.exports.is_empty());
        assert!(summary
            .imports
            .iter()
            .any(|import| import.module == "env" || import.module == "wasi_snapshot_preview1"));
        assert!(summary.exports.iter().any(|export| export.name == "memory"));
    }

    #[test]
    #[ignore = "Cross-precompiles full PHP 7.4 wasm for Windows ARM64; run explicitly."]
    fn precompiles_php74_for_windows_arm64_target() {
        precompile_php_for_windows_arm64_target("7.4");
    }

    #[test]
    #[ignore = "Cross-precompiles full PHP 8.5 wasm for Windows ARM64; run explicitly."]
    fn precompiles_php85_for_windows_arm64_target() {
        precompile_php_for_windows_arm64_target("8.5");
    }

    fn precompile_php_for_windows_arm64_target(php_version: &str) {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let asset = runtime.php_asset(php_version).unwrap();
        let output_path = temp_dir(&format!("php{php_version}-windows-arm64-precompile"))
            .join(format!("php_{php_version}.wasm.cwasm"));

        match precompile_wasm_module_for_target(
            &runtime.repo_root().join(&asset.wasm.path),
            &output_path,
            WasmEngineProfile::Optimized,
            Some("aarch64-pc-windows-msvc"),
        ) {
            Ok(()) => {}
            Err(error)
                if error
                    .to_string()
                    .contains("Support for this target is disabled") =>
            {
                eprintln!("skipping Windows ARM64 precompile smoke: {error}");
                return;
            }
            Err(error) => panic!("{error}"),
        }

        assert!(output_path.is_file());
        assert!(fs::metadata(output_path).unwrap().len() > 0);
    }

    #[test]
    #[ignore = "Full PHP wasm compilation is an explicit smoke test, not part of the fast unit suite."]
    fn stub_host_can_instantiate_php83_module() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let summary = runtime
            .wasm_module_stub_instantiation_summary("8.3")
            .unwrap();

        assert!(summary.stub_linker_can_instantiate);
        assert!(summary
            .imports
            .iter()
            .any(|import| import.module == "GOT.func"));
    }

    #[test]
    #[ignore = "Bundled PHP wasm import audit reads every manifest PHP wasm file."]
    fn bundled_php_wasm_imports_are_explicitly_classified() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let mut unknown = Vec::new();

        for asset in &runtime.manifest().php {
            let wasm_path = runtime.repo_root().join(&asset.wasm.path);
            let bytes = fs::read(&wasm_path).unwrap();
            for payload in Parser::new(0).parse_all(&bytes) {
                let Payload::ImportSection(section) = payload.unwrap() else {
                    continue;
                };
                for import in section.into_imports() {
                    let import = import.unwrap();
                    let kind = match import.ty {
                        TypeRef::Func(_) => ImportExternKind::Func,
                        TypeRef::Global(_) => ImportExternKind::Global,
                        _ => ImportExternKind::Other,
                    };
                    let classification = classify_php_wasm_import(import.module, import.name, kind);
                    if classification == ImportClassification::UnknownDefault {
                        unknown.push(format!(
                            "PHP {} {}.{} {:?}",
                            asset.version, import.module, import.name, import.ty
                        ));
                    }
                }
            }
        }

        assert!(
            unknown.is_empty(),
            "Unclassified PHP wasm imports:\n{}",
            unknown.join("\n")
        );
    }
}
