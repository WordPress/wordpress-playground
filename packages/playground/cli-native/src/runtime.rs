use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use wasmtime::{
    component::Component, Cache, CacheConfig, Config, Engine, OptLevel, ProfilingStrategy,
    RegallocAlgorithm,
};

use crate::{
    assets::{
        find_php_assets_manifest, load_php_assets_manifest, select_php_asset, verify_file_asset,
        AssetManifest, PhpAsset,
    },
    CliError, Result,
};

pub const ASSET_ROOT_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_ASSET_ROOT";
pub const DISABLE_SOURCE_FALLBACK_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK";
const MAX_WASM_STACK_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MAX_WASM_STACK_MIB";
const MEMORY_RESERVATION_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_MIB";
const MEMORY_GUARD_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MEMORY_GUARD_MIB";
const MEMORY_RESERVATION_FOR_GROWTH_MIB_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_MEMORY_RESERVATION_FOR_GROWTH_MIB";
const MEMORY_MAY_MOVE_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MEMORY_MAY_MOVE";
const WASMTIME_PROFILING_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_WASMTIME_PROFILING";
const DEFAULT_MAX_WASM_STACK_MIB: usize = 2;
const WINDOWS_ARM64_DENSE_IMAGE_SIZE: u64 = 32 * 1024 * 1024;
const MAX_WASMTIME_MEMORY_TUNABLE_MIB: u64 = 262_144;

pub struct NativeRuntime {
    pub(crate) repo_root: PathBuf,
    manifest: AssetManifest,
    engine: Engine,
    profile: WasmEngineProfile,
    artifact_cache: Mutex<HashMap<String, CompiledPhpArtifact>>,
}

pub type CompiledPhpArtifact = Component;

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
        let engine = wasm_engine_for_target(profile, None)?;
        Ok(Self {
            repo_root,
            manifest,
            engine,
            profile,
            artifact_cache: Mutex::new(HashMap::new()),
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

    pub fn php_artifact(&self, php_version: &str) -> Result<CompiledPhpArtifact> {
        if let Some(artifact) = self
            .artifact_cache
            .lock()
            .map_err(|_| CliError::new("PHP artifact cache lock was poisoned"))?
            .get(php_version)
            .cloned()
        {
            return Ok(artifact);
        }

        self.verify_php_asset(php_version)?;
        let asset = self.php_asset(php_version)?;
        let artifact = self.load_php_artifact(php_version, asset)?;
        self.artifact_cache
            .lock()
            .map_err(|_| CliError::new("PHP artifact cache lock was poisoned"))?
            .insert(php_version.to_string(), artifact.clone());
        release_unused_process_memory();
        Ok(artifact)
    }

    fn load_php_artifact(
        &self,
        php_version: &str,
        asset: &PhpAsset,
    ) -> Result<CompiledPhpArtifact> {
        if self.profile == WasmEngineProfile::Optimized {
            if let Some(wasmtime) = &asset.wasmtime {
                let wasmtime_path = self.repo_root.join(&wasmtime.path);
                match self.deserialize_php_artifact(&wasmtime_path) {
                    Ok(artifact) => return Ok(artifact),
                    Err(error) => {
                        eprintln!(
                            "warning: failed to load precompiled PHP {php_version} Wasmtime artifact {}; falling back to wasm compilation: {error}",
                            wasmtime_path.display()
                        );
                    }
                }
            }
        }

        self.compile_php_component(php_version, asset)
    }

    fn deserialize_php_artifact(&self, path: &Path) -> Result<CompiledPhpArtifact> {
        unsafe { Component::deserialize_file(&self.engine, path) }
            .map_err(|error| CliError::new(error.to_string()))
    }

    fn compile_php_component(
        &self,
        php_version: &str,
        asset: &PhpAsset,
    ) -> Result<CompiledPhpArtifact> {
        let wasm_path = self.repo_root.join(&asset.wasm.path);
        Component::from_file(&self.engine, &wasm_path).map_err(|error| {
            CliError::new(format!(
                "Failed to compile PHP {php_version} WASIp2 component {}: {error}",
                wasm_path.display(),
            ))
        })
    }

    pub fn php_asset(&self, php_version: &str) -> Result<&PhpAsset> {
        select_php_asset(&self.manifest, php_version)
    }

    pub fn verify_php_asset(&self, php_version: &str) -> Result<()> {
        let asset = self.php_asset(php_version)?;
        verify_file_asset(&self.repo_root, &asset.wasm)?;
        if let Some(wasmtime) = &asset.wasmtime {
            verify_file_asset(&self.repo_root, wasmtime)?;
        }
        Ok(())
    }
}

#[cfg(test)]
fn wasm_engine(profile: WasmEngineProfile) -> Result<Engine> {
    wasm_engine_for_target(profile, None)
}

fn wasm_engine_for_target(
    profile: WasmEngineProfile,
    target_triple: Option<&str>,
) -> Result<Engine> {
    let mut config = Config::new();
    config.wasm_gc(false);
    config.wasm_component_model(true);
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
    config.wasm_exceptions(true);
    config.generate_address_map(false);
    if !uses_windows_unwind_info(target_triple) {
        config.native_unwind_info(false);
    }
    if let Some(size) = memory_guaranteed_dense_image_size(target_triple) {
        // Keep the component's initial memory image out of generated start
        // trampolines that can overflow Windows ARM64 unwind metadata.
        config.memory_guaranteed_dense_image_size(size);
    }
    config.max_wasm_stack(max_wasm_stack());
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

fn max_wasm_stack() -> usize {
    env_mib_usize(
        MAX_WASM_STACK_MIB_ENV_VAR,
        DEFAULT_MAX_WASM_STACK_MIB,
        1,
        256,
    )
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
        // Large PHP component functions can exceed that, so minimize code size here.
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

pub fn precompile_wasm_component(
    wasm_path: &Path,
    output_path: &Path,
    profile: WasmEngineProfile,
) -> Result<()> {
    precompile_wasm_component_for_target(wasm_path, output_path, profile, None)
}

pub fn precompile_wasm_component_for_target(
    wasm_path: &Path,
    output_path: &Path,
    profile: WasmEngineProfile,
    target_triple: Option<&str>,
) -> Result<()> {
    let wasm = fs::read(wasm_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read WASIp2 component {} for Wasmtime precompilation: {error}",
            wasm_path.display()
        ))
    })?;
    let engine = wasm_engine_for_target(profile, target_triple)?;
    let compiled = engine.precompile_component(&wasm).map_err(|error| {
        CliError::new(format!(
            "Failed to precompile WASIp2 component {} with Wasmtime: {error}",
            wasm_path.display()
        ))
    })?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_path, compiled).map_err(|error| {
        CliError::new(format!(
            "Failed to write precompiled Wasmtime component {}: {error}",
            output_path.display()
        ))
    })?;
    Ok(())
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
mod component_tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use wasmtime::{component::Linker, Store};

    use super::{
        asset_root_candidates_from_exe, memory_guaranteed_dense_image_size,
        parse_wasmtime_profiling, precompile_wasm_component, uses_windows_unwind_info, wasm_engine,
        wasm_engine_settings, NativeRuntime, WasmEngineProfile, WasmtimeProfiling,
    };

    #[test]
    fn checked_in_runtime_selects_only_the_php_82_component() {
        let runtime = NativeRuntime::from_repo_root(super::asset_root_from_manifest_dir()).unwrap();
        assert_eq!(runtime.manifest().php.len(), 1);
        assert_eq!(runtime.php_asset("8.2").unwrap().version, "8.2");
        assert!(runtime.php_asset("8.3").is_err());
    }

    #[test]
    fn precompiled_component_deserializes_and_instantiates() {
        let root = temp_dir("precompiled-component");
        fs::create_dir_all(&root).unwrap();
        let wasm_path = root.join("component.wasm");
        let compiled_path = root.join("component.cwasm");
        fs::write(&wasm_path, b"(component)").unwrap();

        precompile_wasm_component(&wasm_path, &compiled_path, WasmEngineProfile::FastStartup)
            .unwrap();

        let engine = wasm_engine(WasmEngineProfile::FastStartup).unwrap();
        let component = unsafe {
            wasmtime::component::Component::deserialize_file(&engine, &compiled_path).unwrap()
        };
        let linker = Linker::<()>::new(&engine);
        let mut store = Store::new(&engine, ());
        linker.instantiate(&mut store, &component).unwrap();

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn packaged_layout_is_an_asset_root_candidate() {
        let candidates = asset_root_candidates_from_exe(PathBuf::from("/opt/wp/bin/cli").as_path());
        assert!(candidates.contains(&PathBuf::from("/opt/wp/bin/share/wp-playground-native")));
    }

    #[test]
    fn engine_configurations_and_windows_arm64_settings_are_stable() {
        let non_windows_target = Some("x86_64-unknown-linux-gnu");
        let fast = wasm_engine_settings(WasmEngineProfile::FastStartup, non_windows_target);
        assert_eq!(fast.opt_level, wasmtime::OptLevel::None);
        assert_eq!(
            fast.regalloc_algorithm,
            wasmtime::RegallocAlgorithm::SinglePass
        );

        let optimized = wasm_engine_settings(WasmEngineProfile::Optimized, non_windows_target);
        assert_eq!(optimized.opt_level, wasmtime::OptLevel::Speed);
        assert_eq!(
            optimized.regalloc_algorithm,
            wasmtime::RegallocAlgorithm::Backtracking
        );

        let target = Some("aarch64-pc-windows-msvc");
        let windows = wasm_engine_settings(WasmEngineProfile::Optimized, target);
        assert_eq!(windows.opt_level, wasmtime::OptLevel::SpeedAndSize);
        assert!(uses_windows_unwind_info(target));
        assert!(memory_guaranteed_dense_image_size(target).is_some());
    }

    #[test]
    fn profiling_parser_accepts_component_runtime_modes() {
        assert_eq!(parse_wasmtime_profiling("").unwrap(), None);
        assert_eq!(
            parse_wasmtime_profiling("perfmap").unwrap(),
            Some(WasmtimeProfiling::PerfMap)
        );
        assert_eq!(
            parse_wasmtime_profiling("jitdump").unwrap(),
            Some(WasmtimeProfiling::JitDump)
        );
        assert_eq!(
            parse_wasmtime_profiling("vtune").unwrap(),
            Some(WasmtimeProfiling::VTune)
        );
        assert!(parse_wasmtime_profiling("unknown").is_err());
    }

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("wp-playground-native-{name}-{unique}"))
    }
}
