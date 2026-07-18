use std::{
    fs,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
};

use wasmtime::component::Component;

use crate::{
    atomic_file::atomic_replace_file,
    php_config::{PhpExtensionSelection, PhpWorkerOptions, PHP_EXTENSIONS_ENV_NAME},
    php_protocol::{PhpRequest, PhpResponse},
    php_runtime_files::{
        self, PhpConstantValue, PhpIniOptions, PHP_CONSTANTS_VFS_PATH, PHP_INI_VFS_PATH,
        PHP_SHARED_VFS_DIR,
    },
    runtime::{CompiledPhpArtifact, InterruptiblePhpArtifact, NativeRuntime},
    wasip2::{
        CapabilityPreopen, Wasip2ContextBuilder, Wasip2PhpInstance, Wasip2PhpOutput,
        Wasip2PhpStreamSink,
    },
    CliError, Result,
};

static NEXT_COMPONENT_WORKER_ID: AtomicU64 = AtomicU64::new(1);
const FAILED_STREAMED_EXECUTION_MESSAGE: &str =
    "WASIp2 PHP worker cannot be reused after a failed streamed execution";
/// A server-facing, persistent WASIp2 PHP component worker.
pub struct PhpWorkerInstance {
    component: ComponentPhpInstance,
}

impl PhpWorkerInstance {
    pub fn from_artifact_with_options(
        artifact: CompiledPhpArtifact,
        options: PhpWorkerOptions,
    ) -> Result<Self> {
        ComponentPhpInstance::instantiate(&artifact, options).map(|component| Self { component })
    }

    pub(crate) fn from_interruptible_artifact_with_options(
        artifact: InterruptiblePhpArtifact,
        options: PhpWorkerOptions,
    ) -> Result<Self> {
        ComponentPhpInstance::instantiate_interruptible(&artifact.0, options)
            .map(|component| Self { component })
    }

    pub(crate) fn from_cli_artifact_with_options(
        artifact: InterruptiblePhpArtifact,
        options: PhpWorkerOptions,
    ) -> Result<Self> {
        ComponentPhpInstance::instantiate_cli_interruptible(&artifact.0, options)
            .map(|component| Self { component })
    }

    pub fn run_sapi_request(&mut self, request: &PhpRequest) -> Result<PhpResponse> {
        self.component.run_sapi_request(request)
    }

    pub fn run_sapi_request_streamed(
        &mut self,
        request: &PhpRequest,
        sink: Wasip2PhpStreamSink,
        cancellation: Arc<AtomicBool>,
    ) -> Result<PhpResponse> {
        self.component
            .run_sapi_request_streamed(request, sink, cancellation)
    }

    pub fn run_cli_streamed(
        &mut self,
        argv: &[String],
        env: &[(String, String)],
        cwd: Option<&str>,
        sink: Wasip2PhpStreamSink,
        cancellation: Arc<AtomicBool>,
    ) -> Result<i32> {
        self.component
            .run_cli_streamed(argv, env, cwd, sink, cancellation)
    }

    pub fn define_constants(&mut self, constants: &[(String, PhpConstantValue)]) {
        self.component.define_constants(constants);
    }

    pub fn take_captured_stdout(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.component.failed_stdout)
    }

    pub fn take_captured_stderr(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.component.failed_stderr)
    }
}

impl NativeRuntime {
    pub fn instantiate_php_worker_with_options(
        &self,
        php_version: &str,
        options: PhpWorkerOptions,
    ) -> Result<PhpWorkerInstance> {
        let artifact =
            self.php_artifact_for_variant(php_version, options.extensions.component_variant())?;
        PhpWorkerInstance::from_artifact_with_options(artifact, options)
    }
}

pub struct ComponentPhpInstance {
    php: Option<Wasip2PhpInstance>,
    runtime_root: PathBuf,
    runtime_shared_root: PathBuf,
    constants: Vec<(String, PhpConstantValue)>,
    env_entries: Vec<(String, String)>,
    failed_stdout: Vec<u8>,
    failed_stderr: Vec<u8>,
}

impl ComponentPhpInstance {
    fn instantiate(component: &Component, options: PhpWorkerOptions) -> Result<Self> {
        Self::instantiate_with_interruption(component, options, false)
    }

    fn instantiate_interruptible(component: &Component, options: PhpWorkerOptions) -> Result<Self> {
        Self::instantiate_with_interruption(component, options, true)
    }

    fn instantiate_cli_interruptible(
        component: &Component,
        options: PhpWorkerOptions,
    ) -> Result<Self> {
        Self::instantiate_with_mode(component, options, true, false)
    }

    fn instantiate_with_interruption(
        component: &Component,
        options: PhpWorkerOptions,
        interruptible: bool,
    ) -> Result<Self> {
        Self::instantiate_with_mode(component, options, interruptible, true)
    }

    fn instantiate_with_mode(
        component: &Component,
        options: PhpWorkerOptions,
        interruptible: bool,
        initialize_http_sapi: bool,
    ) -> Result<Self> {
        let runtime_root = create_component_worker_root()?;

        let result = Self::instantiate_in_root(
            component,
            options,
            runtime_root.clone(),
            interruptible,
            initialize_http_sapi,
        );
        if result.is_err() {
            let _ = fs::remove_dir_all(&runtime_root);
        }
        result
    }

    fn instantiate_in_root(
        component: &Component,
        options: PhpWorkerOptions,
        runtime_root: PathBuf,
        interruptible: bool,
        initialize_http_sapi: bool,
    ) -> Result<Self> {
        reject_reserved_environment(&options.env_entries, "WASIp2 PHP worker environment")?;
        let ini_options = PhpIniOptions {
            entries: &options.php_ini_entries,
        };
        let mut constants = Vec::new();
        merge_constants(&mut constants, &options.constants);
        let mut runtime_files =
            php_runtime_files::materialize_php_runtime_files(ini_options, &constants);
        for (path, bytes) in &options.internal_files {
            runtime_files.insert(path.clone(), bytes.clone());
        }
        let shared_mount = options
            .mounts
            .iter()
            .find(|mount| mount.vfs_path == PHP_SHARED_VFS_DIR);
        let runtime_shared_root = shared_mount
            .map(|mount| mount.host_path.clone())
            .unwrap_or_else(|| {
                runtime_root.join(
                    vfs_relative_path(PHP_SHARED_VFS_DIR)
                        .expect("the internal shared VFS path is absolute"),
                )
            });
        for (vfs_path, bytes) in runtime_files {
            let relative = vfs_path
                .strip_prefix(PHP_SHARED_VFS_DIR)
                .and_then(|path| path.strip_prefix('/'))
                .ok_or_else(|| {
                    CliError::new(format!(
                        "WASIp2 PHP runtime file is outside {PHP_SHARED_VFS_DIR}: {vfs_path}"
                    ))
                })?;
            write_staged_path(
                &runtime_shared_root.join(relative),
                bytes.as_ref(),
                shared_mount.is_some(),
            )?;
        }

        let mut context = php_component_context(options.extensions)?;
        if shared_mount.is_none() {
            context = context.preopen(CapabilityPreopen::read_only(
                &runtime_shared_root,
                PHP_SHARED_VFS_DIR,
            ));
        }
        let mut mounted_vfs_paths = Vec::with_capacity(options.mounts.len());
        for mount in &options.mounts {
            let mount_vfs_path = vfs_relative_path(&mount.vfs_path)?;
            if mounted_vfs_paths.contains(&mount_vfs_path) {
                return Err(CliError::new(format!(
                    "Duplicate WASIp2 PHP mount path: {}",
                    mount.vfs_path
                )));
            }
            mounted_vfs_paths.push(mount_vfs_path);
            let preopen = if mount.vfs_path == PHP_SHARED_VFS_DIR {
                CapabilityPreopen::read_only(&mount.host_path, mount.vfs_path.clone())
            } else {
                CapabilityPreopen::read_write(&mount.host_path, mount.vfs_path.clone())
            };
            context = context.preopen(preopen);
        }
        let state = context.build().map_err(|error| {
            CliError::new(format!("Failed to build WASIp2 PHP context: {error}"))
        })?;
        let mut php = if interruptible {
            Wasip2PhpInstance::instantiate_interruptible(component, state)
        } else {
            Wasip2PhpInstance::instantiate(component, state)
        }
        .map_err(|error| {
            CliError::new(format!(
                "Failed to instantiate WASIp2 PHP component: {error}"
            ))
        })?;
        if initialize_http_sapi {
            php.initialize(PHP_INI_VFS_PATH).map_err(|error| {
                CliError::new(format!(
                    "Failed to initialize WASIp2 PHP component: {error}"
                ))
            })?;
        }

        Ok(Self {
            php: Some(php),
            runtime_root,
            runtime_shared_root,
            constants,
            env_entries: canonical_entries(&options.env_entries),
            failed_stdout: Vec::new(),
            failed_stderr: Vec::new(),
        })
    }

    fn run_sapi_request(&mut self, request: &PhpRequest) -> Result<PhpResponse> {
        self.run_sapi_request_with_stream(request, None)
    }

    fn run_sapi_request_streamed(
        &mut self,
        request: &PhpRequest,
        sink: Wasip2PhpStreamSink,
        cancellation: Arc<AtomicBool>,
    ) -> Result<PhpResponse> {
        self.run_sapi_request_with_stream(request, Some((sink, cancellation)))
    }

    fn run_cli_streamed(
        &mut self,
        argv: &[String],
        env: &[(String, String)],
        cwd: Option<&str>,
        sink: Wasip2PhpStreamSink,
        cancellation: Arc<AtomicBool>,
    ) -> Result<i32> {
        reject_reserved_environment(env, "WASIp2 PHP CLI environment")?;
        self.failed_stdout.clear();
        self.failed_stderr.clear();
        let mut merged_env = self.env_entries.clone();
        merge_entries(&mut merged_env, env);
        let mut effective_argv = Vec::with_capacity(argv.len() + 2);
        effective_argv.push(argv[0].clone());
        effective_argv.push("-c".to_string());
        effective_argv.push(PHP_INI_VFS_PATH.to_string());
        effective_argv.extend(argv[1..].iter().cloned());
        let poison_on_error = self.active_php_mut()?.is_interruptible();
        let result = self.active_php_mut()?.run_cli_streamed(
            &effective_argv,
            &merged_env,
            cwd,
            sink,
            cancellation,
        );
        match result {
            Ok(response) => Ok(response.exit_status),
            Err(error) => {
                let output = self
                    .php
                    .as_mut()
                    .expect("component PHP was checked before streamed CLI execution")
                    .take_output();
                self.remember_failed_output(output);
                if poison_on_error {
                    drop(self.php.take());
                }
                Err(CliError::new(format!("WASIp2 PHP CLI failed: {error:#}")))
            }
        }
    }

    fn run_sapi_request_with_stream(
        &mut self,
        request: &PhpRequest,
        stream: Option<(Wasip2PhpStreamSink, Arc<AtomicBool>)>,
    ) -> Result<PhpResponse> {
        reject_reserved_environment(&request.env, "WASIp2 PHP request environment")?;
        self.failed_stdout.clear();
        self.failed_stderr.clear();
        let streamed = stream.is_some();
        let poison_on_error = streamed && self.active_php_mut()?.is_interruptible();
        let mut merged_request;
        let request = if self.env_entries.is_empty() {
            request
        } else {
            merged_request = request.clone();
            let mut env = self.env_entries.clone();
            merge_entries(&mut env, &request.env);
            merged_request.env = env;
            &merged_request
        };
        let result = match stream {
            Some((sink, cancellation)) => {
                self.active_php_mut()?
                    .handle_request_streamed(request, sink, cancellation)
            }
            None => self.active_php_mut()?.handle_request(request),
        };
        match result {
            Ok(response) => {
                let (stdout, stderr) = response.output.into_parts();
                Ok(PhpResponse {
                    exit_code: response.exit_status,
                    http_status: response.http_status,
                    stdout,
                    stderr,
                    headers: response.headers,
                })
            }
            Err(error) => {
                let output = self
                    .php
                    .as_mut()
                    .expect("component PHP was checked before request execution")
                    .take_output();
                self.remember_failed_output(output);
                if poison_on_error {
                    drop(self.php.take());
                }
                Err(CliError::new(format!(
                    "WASIp2 PHP request failed: {error:#}"
                )))
            }
        }
    }

    fn define_constants(&mut self, constants: &[(String, PhpConstantValue)]) {
        merge_constants(&mut self.constants, constants);
        let path = self.runtime_shared_root.join(
            PHP_CONSTANTS_VFS_PATH
                .strip_prefix(PHP_SHARED_VFS_DIR)
                .and_then(|path| path.strip_prefix('/'))
                .expect("the constants file is inside the shared runtime directory"),
        );
        if let Err(error) = write_runtime_file(
            &path,
            &php_runtime_files::constants_json(&self.constants),
            false,
        ) {
            eprintln!(
                "warning: failed to update WASIp2 PHP constants file {}: {error}",
                path.display()
            );
        }
    }

    fn remember_failed_output(&mut self, output: Wasip2PhpOutput) {
        let (stdout, stderr) = output.into_parts();
        self.failed_stdout = stdout;
        self.failed_stderr = stderr;
    }

    fn active_php_mut(&mut self) -> Result<&mut Wasip2PhpInstance> {
        self.php
            .as_mut()
            .ok_or_else(|| CliError::new(FAILED_STREAMED_EXECUTION_MESSAGE))
    }
}

impl Drop for ComponentPhpInstance {
    fn drop(&mut self) {
        drop(self.php.take());
        let _ = fs::remove_dir_all(&self.runtime_root);
    }
}

fn create_component_worker_root() -> Result<PathBuf> {
    for _ in 0..128 {
        let id = NEXT_COMPONENT_WORKER_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "wp-playground-native-wasip2-{}-{id}",
            std::process::id()
        ));
        let builder = fs::DirBuilder::new();
        #[cfg(unix)]
        let builder = {
            use std::os::unix::fs::DirBuilderExt;
            let mut builder = builder;
            builder.mode(0o700);
            builder
        };
        match builder.create(&path) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(CliError::new(format!(
                    "Failed to create WASIp2 PHP worker directory {}: {error}",
                    path.display()
                )))
            }
        }
    }
    Err(CliError::new(
        "Failed to allocate a unique WASIp2 PHP worker directory",
    ))
}

fn write_staged_path(path: &Path, bytes: &[u8], preserve_existing: bool) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    if preserve_existing {
        match fs::symlink_metadata(path) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(CliError::new(format!(
                    "Refusing to preserve WASIp2 PHP runtime file through symlink {}",
                    path.display()
                )))
            }
            Ok(metadata) if metadata.is_file() => return Ok(()),
            Ok(_) => {
                return Err(CliError::new(format!(
                    "WASIp2 PHP runtime path is not a file: {}",
                    path.display()
                )))
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    write_runtime_file(path, bytes, true).map_err(|error| {
        CliError::new(format!(
            "Failed to stage WASIp2 PHP runtime file {}: {error}",
            path.display()
        ))
    })
}

fn write_runtime_file(path: &Path, bytes: &[u8], create_new: bool) -> std::io::Result<()> {
    if !create_new {
        return atomic_replace_file(path, bytes);
    }
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW).mode(0o600);
    }
    let mut file = options.open(path)?;
    file.write_all(bytes)
}

fn vfs_relative_path(path: &str) -> Result<PathBuf> {
    if !path.starts_with('/') || path.starts_with("//") {
        return Err(CliError::new(format!(
            "WASIp2 PHP runtime path must be an absolute VFS path: {path}"
        )));
    }
    let mut relative = PathBuf::new();
    for segment in path
        .split('/')
        .skip(1)
        .filter(|segment| !segment.is_empty())
    {
        if segment == "." || segment == ".." || segment.contains(['\\', ':', '\0']) {
            return Err(CliError::new(format!(
                "Unsafe WASIp2 PHP runtime path: {path}"
            )));
        }
        relative.push(segment);
    }
    Ok(relative)
}

fn canonical_entries(entries: &[(String, String)]) -> Vec<(String, String)> {
    let mut canonical = Vec::with_capacity(entries.len());
    merge_entries(&mut canonical, entries);
    canonical
}

fn merge_entries(entries: &mut Vec<(String, String)>, updates: &[(String, String)]) {
    for (name, value) in updates {
        if let Some((_, existing)) = entries.iter_mut().find(|(existing, _)| existing == name) {
            *existing = value.clone();
        } else {
            entries.push((name.clone(), value.clone()));
        }
    }
}

fn reject_reserved_environment(entries: &[(String, String)], source: &str) -> Result<()> {
    if entries
        .iter()
        .any(|(name, _)| name == PHP_EXTENSIONS_ENV_NAME)
    {
        return Err(CliError::new(format!(
            "{source} may not set reserved host variable {PHP_EXTENSIONS_ENV_NAME}"
        )));
    }
    Ok(())
}

fn php_component_context(extensions: PhpExtensionSelection) -> Result<Wasip2ContextBuilder> {
    Wasip2ContextBuilder::new()
        .host_environment(
            PHP_EXTENSIONS_ENV_NAME,
            extensions.as_host_environment_value(),
        )
        .map_err(|error| {
            CliError::new(format!(
                "Failed to configure WASIp2 PHP host environment: {error}"
            ))
        })
}

fn merge_constants(
    constants: &mut Vec<(String, PhpConstantValue)>,
    updates: &[(String, PhpConstantValue)],
) {
    for (name, value) in updates {
        if let Some((_, existing)) = constants
            .iter_mut()
            .find(|(existing_name, _)| existing_name == name)
        {
            *existing = value.clone();
        } else {
            constants.push((name.clone(), value.clone()));
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        path::{Path, PathBuf},
        process::{Child, Command, Stdio},
        sync::{atomic::AtomicBool, atomic::AtomicU64, atomic::Ordering, Arc, Barrier, Mutex},
        thread,
        time::{Duration, Instant},
    };

    use serde_json::Value;
    use wasmtime_wasi::cli::WasiCliView;
    use wasmtime_wasi::p2::bindings::cli::environment::Host as WasiEnvironmentHost;

    use super::{
        create_component_worker_root, php_component_context, reject_reserved_environment,
        vfs_relative_path, PhpWorkerInstance, FAILED_STREAMED_EXECUTION_MESSAGE,
    };
    use crate::{
        assets::PhpComponentVariant,
        mount::Mount,
        php_config::{PhpExtensionSelection, PhpWorkerOptions, PHP_EXTENSIONS_ENV_NAME},
        php_protocol::{PhpRequest, PhpResponse},
        php_runtime_files::{PhpConstantValue, PHP_CONSTANTS_VFS_PATH, PHP_INI_VFS_PATH},
        runtime::{InterruptiblePhpArtifact, NativeRuntime},
        sha256::sha256_hex,
        wasip2::{Wasip2PhpOutputChannel, Wasip2PhpStreamEvent, Wasip2PhpStreamSink},
    };

    static NEXT_TEST_DIR_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn component_context_injects_default_and_selected_extensions_once() {
        for (selection, expected) in [
            (PhpExtensionSelection::default(), ""),
            (
                PhpExtensionSelection {
                    redis: true,
                    memcached: true,
                    xdebug: true,
                },
                "redis,memcached,xdebug",
            ),
        ] {
            let mut state = php_component_context(selection).unwrap().build().unwrap();
            let mut cli = WasiCliView::cli(&mut state);
            let environment = WasiEnvironmentHost::get_environment(&mut cli).unwrap();
            let selector = environment
                .iter()
                .filter(|(name, _)| name == PHP_EXTENSIONS_ENV_NAME)
                .collect::<Vec<_>>();

            assert_eq!(selector.len(), 1);
            assert_eq!(selector[0].1, expected);
        }
    }

    #[test]
    fn worker_request_and_cli_environments_cannot_override_extension_selector() {
        let reserved = vec![(PHP_EXTENSIONS_ENV_NAME.to_string(), "xdebug".to_string())];
        for source in [
            "WASIp2 PHP worker environment",
            "WASIp2 PHP request environment",
            "WASIp2 PHP CLI environment",
        ] {
            let error = reject_reserved_environment(&reserved, source).unwrap_err();
            assert!(error.message().contains(source));
            assert!(error.message().contains(PHP_EXTENSIONS_ENV_NAME));
        }
        assert!(reject_reserved_environment(
            &[(
                format!("{PHP_EXTENSIONS_ENV_NAME}_USER"),
                "allowed".to_string()
            )],
            "caller environment"
        )
        .is_ok());
    }

    #[test]
    fn extension_enabled_worker_rejects_a_base_only_manifest() {
        let asset_root = TestDir::new("base-only-component");
        let component = b"(component)";
        fs::create_dir_all(asset_root.path().join("assets")).unwrap();
        fs::write(asset_root.path().join("base.wasm"), component).unwrap();
        fs::write(
            asset_root.path().join("assets/php-assets.json"),
            format!(
                r#"{{
                    "schemaVersion": 2,
                    "runtime": "wasip2-component",
                    "php": {{
                        "8.2": {{
                            "wasm": {{
                                "path": "base.wasm",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                sha256_hex(component)
            ),
        )
        .unwrap();
        let runtime = NativeRuntime::from_asset_root(asset_root.path()).unwrap();
        let result = runtime.instantiate_php_worker_with_options(
            "8.2",
            PhpWorkerOptions {
                extensions: PhpExtensionSelection {
                    redis: true,
                    ..Default::default()
                },
                ..Default::default()
            },
        );
        let error = match result {
            Ok(_) => panic!("base-only manifest unexpectedly accepted an extension-enabled worker"),
            Err(error) => error,
        };
        assert!(error.message().contains("variants.extended"), "{error}");
    }

    #[test]
    #[ignore = "requires a locally built extended PHP WASIp2 component"]
    fn xdebug_extended_component_completes_a_real_dbgp_handshake() {
        let extended = std::env::var_os("WP_PLAYGROUND_NATIVE_TEST_PHP_EXTENDED_COMPONENT")
            .map(PathBuf::from)
            .expect(
                "set WP_PLAYGROUND_NATIVE_TEST_PHP_EXTENDED_COMPONENT to the extended component",
            );
        assert!(
            extended.is_file(),
            "extended PHP WASIp2 component is missing: {}",
            extended.display()
        );
        let base = std::env::var_os("WP_PLAYGROUND_NATIVE_TEST_PHP_COMPONENT")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                crate::runtime::repo_root_from_manifest_dir()
                    .join("packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm")
            });
        assert!(
            base.is_file(),
            "base PHP WASIp2 component is missing: {}",
            base.display()
        );
        let php_version = native_test_php_version();
        let xdebug_version = expected_xdebug_version(&php_version);

        let asset_root = TestDir::new("xdebug-variant-assets");
        write_component_variant_asset_root(asset_root.path(), &php_version, &base, &extended);
        let site = TestDir::new("xdebug-variant-site");
        fs::write(
            site.path().join("xdebug.php"),
            br#"<?php
$zlib_path = __DIR__ . '/zlib-' . bin2hex(random_bytes(8)) . '.gz';
$zlib_writer = gzopen($zlib_path, 'wb');
gzwrite($zlib_writer, 'zlib-file-round-trip');
gzclose($zlib_writer);
$zlib_reader = gzopen($zlib_path, 'rb');
$zlib_file_round_trip = gzread($zlib_reader, 1024);
gzclose($zlib_reader);
unlink($zlib_path);
echo json_encode([
    'php_version' => PHP_VERSION,
    'xdebug_loaded' => extension_loaded('xdebug'),
    'xdebug_version' => phpversion('xdebug'),
    'xdebug_info' => function_exists('xdebug_info'),
    'opcache_loaded' => extension_loaded('Zend OPcache'),
	'zlib_loaded' => extension_loaded('zlib'),
	'gzinflate' => function_exists('gzinflate'),
	'zlib_round_trip' => gzinflate(gzdeflate('zlib-round-trip')),
	'zlib_file_round_trip' => $zlib_file_round_trip,
    'mode' => ini_get('xdebug.mode'),
]);
"#,
        )
        .unwrap();
        let runtime = NativeRuntime::from_asset_root(asset_root.path()).unwrap();

        let mut base_worker = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                PhpWorkerOptions {
                    mounts: vec![Mount::new(site.path(), "/site").unwrap()],
                    ..Default::default()
                },
            )
            .unwrap();
        let base_response = base_worker
            .run_sapi_request(&PhpRequest::for_script("/site/xdebug.php"))
            .unwrap();
        assert_eq!(
            base_response.exit_code,
            0,
            "{}",
            utf8(&base_response.stderr)
        );
        assert!(
            base_response.stderr.is_empty(),
            "{}",
            utf8(&base_response.stderr)
        );
        let base_status: Value = serde_json::from_slice(&base_response.stdout).unwrap();
        assert_eq!(
            base_status["php_version"],
            expected_php_release(&php_version)
        );
        assert_eq!(base_status["xdebug_loaded"], false);
        assert_eq!(base_status["opcache_loaded"], true);
        assert_eq!(base_status["zlib_loaded"], true);
        assert_eq!(base_status["gzinflate"], true);
        assert_eq!(base_status["zlib_round_trip"], "zlib-round-trip");
        assert_eq!(base_status["zlib_file_round_trip"], "zlib-file-round-trip");
        drop(base_worker);

        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let debugger_port = listener.local_addr().unwrap().port();

        let mut worker = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                PhpWorkerOptions {
                    mounts: vec![Mount::new(site.path(), "/site").unwrap()],
                    php_ini_entries: vec![
                        "xdebug.mode=debug".to_string(),
                        "xdebug.start_with_request=yes".to_string(),
                        "xdebug.client_host=127.0.0.1".to_string(),
                        format!("xdebug.client_port={debugger_port}"),
                        "xdebug.idekey=PHPWASMCLI".to_string(),
                        "xdebug.connect_timeout_ms=10000".to_string(),
                        "xdebug.log_level=0".to_string(),
                    ],
                    extensions: PhpExtensionSelection {
                        xdebug: true,
                        ..Default::default()
                    },
                    ..Default::default()
                },
            )
            .unwrap();
        let debugger = thread::spawn(move || receive_dbgp_init_and_detach(listener));
        let response = worker
            .run_sapi_request(&PhpRequest::for_script("/site/xdebug.php"))
            .unwrap();

        assert_eq!(response.exit_code, 0, "{}", utf8(&response.stderr));
        assert!(response.stderr.is_empty(), "{}", utf8(&response.stderr));
        let status: Value = serde_json::from_slice(&response.stdout).unwrap();
        assert_eq!(status["php_version"], expected_php_release(&php_version));
        assert_eq!(status["xdebug_loaded"], true);
        assert_eq!(status["xdebug_version"], xdebug_version);
        assert_eq!(status["xdebug_info"], true);
        assert_eq!(status["opcache_loaded"], true);
        assert_eq!(status["zlib_loaded"], true);
        assert_eq!(status["gzinflate"], true);
        assert_eq!(status["zlib_round_trip"], "zlib-round-trip");
        assert_eq!(status["zlib_file_round_trip"], "zlib-file-round-trip");
        assert_eq!(status["mode"], "debug");

        let init = debugger.join().unwrap();
        let init = String::from_utf8(init).unwrap();
        assert!(init.contains("<init"));
        assert!(init.contains(&format!("<engine version=\"{xdebug_version}\"")));
        assert!(init.contains("idekey=\"PHPWASMCLI\""));

        let cli_listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        cli_listener.set_nonblocking(true).unwrap();
        let cli_debugger_port = cli_listener.local_addr().unwrap().port();
        let cli_artifact = runtime
            .lazy_interruptible_php_artifact(&php_version, PhpComponentVariant::Extended)
            .unwrap()
            .get()
            .unwrap();
        let cli_debugger = thread::spawn(move || receive_dbgp_init_and_detach(cli_listener));
        let cli_response = run_php_cli(
            &cli_artifact,
            PhpWorkerOptions {
                mounts: vec![Mount::new(site.path(), "/site").unwrap()],
                php_ini_entries: vec![
                    "xdebug.mode=debug".to_string(),
                    "xdebug.start_with_request=yes".to_string(),
                    "xdebug.client_host=127.0.0.1".to_string(),
                    format!("xdebug.client_port={cli_debugger_port}"),
                    "xdebug.idekey=PHPWASMCLI".to_string(),
                    "xdebug.connect_timeout_ms=10000".to_string(),
                    "xdebug.log_level=0".to_string(),
                ],
                extensions: PhpExtensionSelection {
                    xdebug: true,
                    ..Default::default()
                },
                ..Default::default()
            },
            "/site/xdebug.php",
        );
        assert_eq!(cli_response.exit_code, 0, "{}", utf8(&cli_response.stderr));
        assert!(
            cli_response.stderr.is_empty(),
            "{}",
            utf8(&cli_response.stderr)
        );
        let cli_status: Value = serde_json::from_slice(&cli_response.stdout).unwrap();
        assert_eq!(
            cli_status["php_version"],
            expected_php_release(&php_version)
        );
        assert_eq!(cli_status["xdebug_loaded"], true);
        assert_eq!(cli_status["xdebug_version"], xdebug_version);
        assert_eq!(cli_status["xdebug_info"], true);
        assert_eq!(cli_status["opcache_loaded"], true);
        assert_eq!(cli_status["zlib_loaded"], true);
        assert_eq!(cli_status["gzinflate"], true);
        assert_eq!(cli_status["zlib_round_trip"], "zlib-round-trip");
        assert_eq!(cli_status["zlib_file_round_trip"], "zlib-file-round-trip");
        assert_eq!(cli_status["mode"], "debug");
        let cli_init = String::from_utf8(cli_debugger.join().unwrap()).unwrap();
        assert!(cli_init.contains("<init"));
        assert!(cli_init.contains(&format!("<engine version=\"{xdebug_version}\"")));
        assert!(cli_init.contains("idekey=\"PHPWASMCLI\""));
    }

    #[test]
    #[ignore = "requires a locally built extended PHP WASIp2 component plus redis-server and memcached"]
    fn redis_and_memcached_extensions_complete_real_tcp_round_trips() {
        let extended = std::env::var_os("WP_PLAYGROUND_NATIVE_TEST_PHP_EXTENDED_COMPONENT")
            .map(PathBuf::from)
            .expect(
                "set WP_PLAYGROUND_NATIVE_TEST_PHP_EXTENDED_COMPONENT to the extended component",
            );
        assert!(
            extended.is_file(),
            "extended PHP WASIp2 component is missing: {}",
            extended.display()
        );
        let base = std::env::var_os("WP_PLAYGROUND_NATIVE_TEST_PHP_COMPONENT")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                crate::runtime::repo_root_from_manifest_dir()
                    .join("packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm")
            });
        assert!(
            base.is_file(),
            "base PHP WASIp2 component is missing: {}",
            base.display()
        );
        let php_version = native_test_php_version();

        let asset_root = TestDir::new("extension-protocol-assets");
        write_component_variant_asset_root(asset_root.path(), &php_version, &base, &extended);
        let site = TestDir::new("extension-protocol-site");
        fs::write(site.path().join("redis.php"), redis_protocol_script()).unwrap();
        fs::write(
            site.path().join("memcached.php"),
            memcached_protocol_script(),
        )
        .unwrap();
        let runtime = NativeRuntime::from_asset_root(asset_root.path()).unwrap();
        let cli_artifact = runtime
            .lazy_interruptible_php_artifact(&php_version, PhpComponentVariant::Extended)
            .unwrap()
            .get()
            .unwrap();

        let (redis_server, redis_port) = start_redis_server();
        let redis_response = run_extension_protocol_request(
            &runtime,
            &php_version,
            site.path(),
            "/site/redis.php",
            "TEST_REDIS_PORT",
            redis_port,
            PhpExtensionSelection {
                redis: true,
                ..Default::default()
            },
        );
        assert_extension_protocol_response(
            &redis_response,
            &php_version,
            "redis",
            &["memcached", "xdebug"],
            "redis-round-trip",
        );
        let redis_cli_response = run_extension_protocol_cli(
            &cli_artifact,
            site.path(),
            "/site/redis.php",
            "TEST_REDIS_PORT",
            redis_port,
            PhpExtensionSelection {
                redis: true,
                ..Default::default()
            },
        );
        assert_extension_protocol_response(
            &redis_cli_response,
            &php_version,
            "redis",
            &["memcached", "xdebug"],
            "redis-round-trip",
        );
        drop(redis_server);

        let (memcached_server, memcached_port) = start_memcached_server();
        let memcached_response = run_extension_protocol_request(
            &runtime,
            &php_version,
            site.path(),
            "/site/memcached.php",
            "TEST_MEMCACHED_PORT",
            memcached_port,
            PhpExtensionSelection {
                memcached: true,
                ..Default::default()
            },
        );
        assert_extension_protocol_response(
            &memcached_response,
            &php_version,
            "memcached",
            &["redis", "xdebug"],
            "memcached-round-trip",
        );
        let memcached_cli_response = run_extension_protocol_cli(
            &cli_artifact,
            site.path(),
            "/site/memcached.php",
            "TEST_MEMCACHED_PORT",
            memcached_port,
            PhpExtensionSelection {
                memcached: true,
                ..Default::default()
            },
        );
        assert_extension_protocol_response(
            &memcached_cli_response,
            &php_version,
            "memcached",
            &["redis", "xdebug"],
            "memcached-round-trip",
        );
        drop(memcached_server);
    }

    fn start_redis_server() -> (ServiceProcess, u16) {
        let port = reserve_loopback_port();
        let port_arg = port.to_string();
        let mut command = Command::new("redis-server");
        command.args([
            "--bind",
            "127.0.0.1",
            "--port",
            &port_arg,
            "--protected-mode",
            "yes",
            "--save",
            "",
            "--appendonly",
            "no",
            "--loglevel",
            "warning",
        ]);
        let mut server = ServiceProcess::spawn("redis-server", command);
        wait_for_tcp_service(&mut server.child, "redis-server", port);
        (server, port)
    }

    fn start_memcached_server() -> (ServiceProcess, u16) {
        let port = reserve_loopback_port();
        let port_arg = port.to_string();
        let mut command = Command::new("memcached");
        command.args([
            "-l",
            "127.0.0.1",
            "-p",
            &port_arg,
            "-U",
            "0",
            "-m",
            "16",
            "-c",
            "16",
            "-t",
            "1",
        ]);
        let mut server = ServiceProcess::spawn("memcached", command);
        wait_for_tcp_service(&mut server.child, "memcached", port);
        (server, port)
    }

    fn reserve_loopback_port() -> u16 {
        TcpListener::bind(("127.0.0.1", 0))
            .expect("failed to reserve a loopback TCP port")
            .local_addr()
            .unwrap()
            .port()
    }

    fn wait_for_tcp_service(child: &mut Child, label: &str, port: u16) {
        let address = ([127, 0, 0, 1], port).into();
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if let Ok(stream) = TcpStream::connect_timeout(&address, Duration::from_millis(100)) {
                drop(stream);
                return;
            }
            if let Some(status) = child.try_wait().unwrap() {
                panic!("{label} exited before accepting TCP connections: {status}");
            }
            assert!(
                Instant::now() < deadline,
                "timed out waiting for {label} on 127.0.0.1:{port}"
            );
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn run_extension_protocol_request(
        runtime: &NativeRuntime,
        php_version: &str,
        site: &Path,
        script: &str,
        port_environment_name: &str,
        port: u16,
        extensions: PhpExtensionSelection,
    ) -> PhpResponse {
        let mut worker = runtime
            .instantiate_php_worker_with_options(
                php_version,
                PhpWorkerOptions {
                    mounts: vec![Mount::new(site, "/site").unwrap()],
                    env_entries: vec![(port_environment_name.to_string(), port.to_string())],
                    extensions,
                    ..Default::default()
                },
            )
            .unwrap();
        worker
            .run_sapi_request(&PhpRequest::for_script(script))
            .unwrap()
    }

    fn run_extension_protocol_cli(
        artifact: &InterruptiblePhpArtifact,
        site: &Path,
        script: &str,
        port_environment_name: &str,
        port: u16,
        extensions: PhpExtensionSelection,
    ) -> PhpResponse {
        run_php_cli(
            artifact,
            PhpWorkerOptions {
                mounts: vec![Mount::new(site, "/site").unwrap()],
                env_entries: vec![(port_environment_name.to_string(), port.to_string())],
                extensions,
                ..Default::default()
            },
            script,
        )
    }

    fn run_php_cli(
        artifact: &InterruptiblePhpArtifact,
        options: PhpWorkerOptions,
        script: &str,
    ) -> PhpResponse {
        let mut php =
            PhpWorkerInstance::from_cli_artifact_with_options(artifact.clone(), options).unwrap();
        let output = Arc::new(Mutex::new((Vec::new(), Vec::new())));
        let sink_output = Arc::clone(&output);
        let sink: Wasip2PhpStreamSink = Arc::new(move |event| {
            if let Wasip2PhpStreamEvent::Output { channel, bytes } = event {
                let mut output = sink_output.lock().unwrap();
                match channel {
                    Wasip2PhpOutputChannel::Stdout => output.0.extend(bytes),
                    Wasip2PhpOutputChannel::Stderr => output.1.extend(bytes),
                }
            }
            Ok(())
        });
        let argv = vec!["php".to_string(), script.to_string()];
        let exit_code = php
            .run_cli_streamed(
                &argv,
                &[],
                Some("/site"),
                sink,
                Arc::new(AtomicBool::new(false)),
            )
            .unwrap();
        let (stdout, stderr) = output.lock().unwrap().clone();
        PhpResponse {
            exit_code,
            http_status: 0,
            stdout,
            stderr,
            headers: Vec::new(),
        }
    }

    fn assert_extension_protocol_response(
        response: &PhpResponse,
        php_version: &str,
        selected_extension: &str,
        absent_extensions: &[&str],
        expected_value: &str,
    ) {
        assert_eq!(response.exit_code, 0, "{}", utf8(&response.stderr));
        assert!(response.stderr.is_empty(), "{}", utf8(&response.stderr));
        let status: Value = serde_json::from_slice(&response.stdout).unwrap_or_else(|error| {
            panic!(
                "invalid {selected_extension} protocol JSON ({error}): {}",
                utf8(&response.stdout)
            )
        });
        assert_eq!(status["php_version"], expected_php_release(php_version));
        assert_eq!(status["selected"], selected_extension);
        assert_eq!(status["selected_loaded"], true);
        let expected_extension_version = match selected_extension {
            "redis" => "6.3.0",
            "memcached" => "3.4.0",
            other => panic!("no expected extension version for {other}"),
        };
        assert_eq!(status["selected_version"], expected_extension_version);
        assert_eq!(status["value"], expected_value);
        for absent in absent_extensions {
            assert_eq!(
                status["extension_loaded"][*absent], false,
                "{absent} unexpectedly loaded while only {selected_extension} was selected"
            );
        }
    }

    fn redis_protocol_script() -> &'static [u8] {
        br#"<?php
try {
    $stage = 'load';
    if (!extension_loaded('redis')) {
        throw new RuntimeException('redis extension is not loaded');
    }
    $stage = 'connect';
    $client = new Redis();
    $port = filter_var(getenv('TEST_REDIS_PORT'), FILTER_VALIDATE_INT);
    if (!$port || !$client->connect('127.0.0.1', $port, 10.0)) {
        throw new RuntimeException('failed to connect to redis-server');
    }
    $client->setOption(Redis::OPT_READ_TIMEOUT, 10.0);
    $expected = 'redis-round-trip';
    for ($iteration = 0; $iteration < 128; $iteration++) {
        $key = 'wp-playground-wasip2-protocol-proof-' . $iteration;
        $stage = 'set[' . $iteration . ']';
        if (!$client->set($key, $expected)) {
            throw new RuntimeException('Redis::set failed');
        }
        $stage = 'get[' . $iteration . ']';
        $value = $client->get($key);
        if ($value !== $expected) {
            throw new RuntimeException('Redis::get returned an unexpected value');
        }
        $stage = 'cleanup[' . $iteration . ']';
        if ($client->del($key) !== 1) {
            throw new RuntimeException('Redis::del returned an unexpected value');
        }
    }
    $client->close();
    echo json_encode([
        'php_version' => PHP_VERSION,
        'selected' => 'redis',
        'selected_loaded' => true,
        'selected_version' => phpversion('redis'),
        'extension_loaded' => [
            'memcached' => extension_loaded('memcached'),
            'xdebug' => extension_loaded('xdebug'),
        ],
        'value' => $value,
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log($stage . ': ' . $error->getMessage());
    exit(10);
}
"#
    }

    fn memcached_protocol_script() -> &'static [u8] {
        br#"<?php
try {
    $stage = 'load';
    if (!extension_loaded('memcached')) {
        throw new RuntimeException('memcached extension is not loaded');
    }
    $stage = 'connect';
    $client = new Memcached();
    $client->setOption(Memcached::OPT_CONNECT_TIMEOUT, 10000);
    $port = filter_var(getenv('TEST_MEMCACHED_PORT'), FILTER_VALIDATE_INT);
    if (!$port || !$client->addServer('127.0.0.1', $port)) {
        throw new RuntimeException('failed to configure the memcached server');
    }
    $key = 'wp-playground-wasip2-protocol-proof';
    $expected = 'memcached-round-trip';
    $stage = 'set';
    if (!$client->set($key, $expected, 60)) {
        throw new RuntimeException(sprintf(
            'Memcached::set failed: result=%d %s; last=%d errno=%d %s',
            $client->getResultCode(),
            $client->getResultMessage(),
            $client->getLastErrorCode(),
            $client->getLastErrorErrno(),
            $client->getLastErrorMessage()
        ));
    }
    $stage = 'get';
    $value = $client->get($key);
    if ($client->getResultCode() !== Memcached::RES_SUCCESS || $value !== $expected) {
        throw new RuntimeException('Memcached::get failed: ' . $client->getResultMessage());
    }
    $stage = 'cleanup';
    $client->delete($key);
    $client->quit();
    echo json_encode([
        'php_version' => PHP_VERSION,
        'selected' => 'memcached',
        'selected_loaded' => true,
        'selected_version' => phpversion('memcached'),
        'extension_loaded' => [
            'redis' => extension_loaded('redis'),
            'xdebug' => extension_loaded('xdebug'),
        ],
        'value' => $value,
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log($stage . ': ' . $error->getMessage());
    exit(11);
}
"#
    }

    #[test]
    fn staging_paths_are_absolute_and_cannot_escape() {
        assert_eq!(
            vfs_relative_path("/internal/shared/php.ini").unwrap(),
            std::path::Path::new("internal/shared/php.ini")
        );
        assert!(vfs_relative_path("relative.php").is_err());
        assert!(vfs_relative_path("/internal/../escape.php").is_err());
        assert!(vfs_relative_path("//server/share.php").is_err());
        assert!(vfs_relative_path("/internal\\..\\escape.php").is_err());
        assert!(vfs_relative_path("/C:/escape.php").is_err());
    }

    #[test]
    fn worker_roots_are_created_exclusively() {
        let first = create_component_worker_root().unwrap();
        let second = create_component_worker_root().unwrap();
        assert_ne!(first, second);
        assert!(first.is_dir());
        assert!(second.is_dir());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&first).unwrap().permissions().mode() & 0o777,
                0o700
            );
            assert_eq!(
                fs::metadata(&second).unwrap().permissions().mode() & 0o777,
                0o700
            );
        }
        fs::remove_dir(first).unwrap();
        fs::remove_dir(second).unwrap();
    }

    #[test]
    fn cancelled_streamed_workers_drop_the_component_and_reject_reentry() {
        let php_version = native_test_php_version();
        let component_name = if php_version == "8.2" {
            "php-wasi-component.wasm".to_string()
        } else {
            format!("php-{php_version}-wasi-component.wasm")
        };
        let proof = std::env::var_os("WP_PLAYGROUND_NATIVE_TEST_PHP_COMPONENT")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                crate::runtime::repo_root_from_manifest_dir()
                    .join("packages/php-wasm/compile/php-wasi/dist")
                    .join(component_name)
            });
        assert!(
            proof.is_file(),
            "checked-in PHP WASIp2 component is missing: {}",
            proof.display()
        );

        let asset_root = TestDir::new("cancelled-worker-assets");
        write_component_asset_root(asset_root.path(), &php_version, &proof);
        let site = TestDir::new("cancelled-worker-site");
        fs::write(site.path().join("request.php"), b"<?php echo 'done';").unwrap();
        let runtime = NativeRuntime::from_asset_root(asset_root.path()).unwrap();
        let artifact = runtime
            .lazy_interruptible_php_artifact(&php_version, PhpComponentVariant::Base)
            .unwrap()
            .get()
            .unwrap();
        let options = || PhpWorkerOptions {
            mounts: vec![Mount::new(site.path(), "/site").unwrap()],
            ..Default::default()
        };

        let mut http_worker = PhpWorkerInstance::from_interruptible_artifact_with_options(
            artifact.clone(),
            options(),
        )
        .unwrap();
        let error = http_worker
            .run_sapi_request_streamed(
                &PhpRequest::for_script("/site/request.php"),
                Arc::new(|_| Ok(())),
                Arc::new(AtomicBool::new(true)),
            )
            .unwrap_err();
        assert!(
            error.to_string().contains("wasm trap: interrupt")
                || error.to_string().contains("cancelled"),
            "{error}"
        );
        assert!(http_worker.component.php.is_none());
        let reentry = http_worker
            .run_sapi_request(&PhpRequest::for_script("/site/request.php"))
            .unwrap_err();
        assert_eq!(reentry.message(), FAILED_STREAMED_EXECUTION_MESSAGE);

        let mut cli_worker =
            PhpWorkerInstance::from_cli_artifact_with_options(artifact, options()).unwrap();
        let argv = vec!["php".to_string(), "/site/request.php".to_string()];
        let error = cli_worker
            .run_cli_streamed(
                &argv,
                &[],
                Some("/site"),
                Arc::new(|_| Ok(())),
                Arc::new(AtomicBool::new(true)),
            )
            .unwrap_err();
        assert!(
            error.to_string().contains("wasm trap: interrupt")
                || error.to_string().contains("cancelled"),
            "{error}"
        );
        assert!(cli_worker.component.php.is_none());
        let reentry = cli_worker
            .run_cli_streamed(
                &argv,
                &[],
                Some("/site"),
                Arc::new(|_| Ok(())),
                Arc::new(AtomicBool::new(false)),
            )
            .unwrap_err();
        assert_eq!(reentry.message(), FAILED_STREAMED_EXECUTION_MESSAGE);
    }

    #[test]
    fn component_artifact_stages_runtime_and_runs_parallel_workers() {
        let php_version = native_test_php_version();
        let proof = std::env::var_os("WP_PLAYGROUND_NATIVE_TEST_PHP_COMPONENT")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                let component_name = if php_version == "8.2" {
                    "php-wasi-component.wasm".to_string()
                } else {
                    format!("php-{php_version}-wasi-component.wasm")
                };
                crate::runtime::repo_root_from_manifest_dir()
                    .join("packages/php-wasm/compile/php-wasi/dist")
                    .join(component_name)
            });
        assert!(
            proof.is_file(),
            "checked-in PHP WASIp2 component is missing: {}",
            proof.display()
        );

        let asset_root = TestDir::new("component-adapter-assets");
        write_component_asset_root(asset_root.path(), &php_version, &proof);
        let site = TestDir::new("component-adapter-site");
        fs::write(site.path().join("adapter.php"), adapter_script()).unwrap();
        let runtime = NativeRuntime::from_asset_root(asset_root.path()).unwrap();

        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let network_port = listener.local_addr().unwrap().port();
        fs::write(
            site.path().join("network.php"),
            format!(
                "<?php if (@stream_socket_server('tcp://127.0.0.1:0') !== false) {{ error_log('tcp bind unexpectedly allowed'); exit(2); }} if (@stream_socket_client('udp://127.0.0.1:9') !== false) {{ error_log('udp unexpectedly allowed'); exit(3); }} $socket = fsockopen('localhost', {network_port}, $errno, $error, 2); if (!$socket) {{ error_log(\"$errno:$error\"); exit(1); }} fwrite($socket, 'ping'); echo fread($socket, 4); fclose($socket);"
            ),
        )
        .unwrap();
        let network_peer = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 4];
            stream.read_exact(&mut request).unwrap();
            assert_eq!(&request, b"ping");
            stream.write_all(b"pong").unwrap();
        });
        let mut network_worker = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "network", "network"),
            )
            .unwrap();
        let network_response = network_worker
            .run_sapi_request(&PhpRequest::for_script("/site/network.php"))
            .unwrap();
        assert_eq!(
            network_response.exit_code,
            0,
            "{}",
            utf8(&network_response.stderr)
        );
        assert_eq!(network_response.stdout, b"pong");
        network_peer.join().unwrap();

        // PHP 7.4 used an int-returning zend_list_free() in a void-returning
        // destructor table. Explicit teardown exercises the typed call_indirect.
        fs::write(
            site.path().join("implicit-resource.php"),
            "<?php $resource = fopen('/site/implicit-resource.php', 'rb'); if (!is_resource($resource)) { exit(1); } unset($resource); echo 'resource-released';",
        )
        .unwrap();
        let mut resource_worker = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "resource", "resource"),
            )
            .unwrap();
        let resource_response = resource_worker
            .run_sapi_request(&PhpRequest::for_script("/site/implicit-resource.php"))
            .unwrap();
        assert_eq!(
            resource_response.exit_code,
            0,
            "{}",
            utf8(&resource_response.stderr)
        );
        assert_eq!(resource_response.stdout, b"resource-released");
        assert!(
            resource_response.stderr.is_empty(),
            "{}",
            utf8(&resource_response.stderr)
        );

        let mut worker = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "initial", "host-base"),
            )
            .unwrap();
        let worker_root = component_root(&worker);
        assert_runtime_files(&worker_root, "initial");

        let error = worker
            .run_sapi_request_streamed(
                &packed_request("buffered-worker-stream"),
                Arc::new(|_| Ok(())),
                Arc::new(AtomicBool::new(false)),
            )
            .unwrap_err();
        assert!(error
            .to_string()
            .contains("streamed PHP execution requires an interruptible component instance"));

        let response = worker
            .run_sapi_request(&packed_request("request-override"))
            .unwrap();
        assert_adapter_response(
            &response,
            &php_version,
            "initial",
            "request-override",
            "request-only",
        );

        worker.define_constants(&[(
            "ADAPTER_CONSTANT".to_string(),
            PhpConstantValue::string("updated"),
        )]);
        assert_runtime_files(&worker_root, "updated");
        let response = worker
            .run_sapi_request(&packed_request("request-updated"))
            .unwrap();
        assert_adapter_response(
            &response,
            &php_version,
            "updated",
            "request-updated",
            "request-only",
        );

        drop(worker);
        assert!(!worker_root.exists());

        let first = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "worker-one", "env-one"),
            )
            .unwrap();
        let second = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "worker-two", "env-two"),
            )
            .unwrap();
        let first_root = component_root(&first);
        let second_root = component_root(&second);
        assert_ne!(first_root, second_root);

        let barrier = Arc::new(Barrier::new(2));
        let first_handle = spawn_component_request(first, barrier.clone());
        let second_handle = spawn_component_request(second, barrier);
        let first_response = first_handle.join().unwrap();
        let second_response = second_handle.join().unwrap();
        assert_adapter_response(
            &first_response,
            &php_version,
            "worker-one",
            "env-one",
            "parallel",
        );
        assert_adapter_response(
            &second_response,
            &php_version,
            "worker-two",
            "env-two",
            "parallel",
        );
        assert!(!first_root.exists());
        assert!(!second_root.exists());

        fs::write(site.path().join("sqlite-init.php"), sqlite_init_script()).unwrap();
        fs::write(site.path().join("sqlite-lock.php"), sqlite_lock_script()).unwrap();
        let mut initializer = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "sqlite-init", "sqlite-init"),
            )
            .unwrap();
        let initialized = initializer
            .run_sapi_request(&PhpRequest::for_script("/site/sqlite-init.php"))
            .unwrap();
        assert_eq!(initialized.exit_code, 0, "{}", utf8(&initialized.stderr));
        assert_eq!(initialized.stdout, b"ready");
        drop(initializer);

        let first = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "sqlite-one", "sqlite-one"),
            )
            .unwrap();
        let second = runtime
            .instantiate_php_worker_with_options(
                &php_version,
                component_worker_options(site.path(), "sqlite-two", "sqlite-two"),
            )
            .unwrap();
        let barrier = Arc::new(Barrier::new(2));
        let started = Instant::now();
        let first_handle = spawn_component_script(
            first,
            barrier.clone(),
            PhpRequest::for_script("/site/sqlite-lock.php"),
        );
        let second_handle = spawn_component_script(
            second,
            barrier,
            PhpRequest::for_script("/site/sqlite-lock.php"),
        );
        let first_response = first_handle.join().unwrap();
        let second_response = second_handle.join().unwrap();
        let elapsed = started.elapsed();
        for response in [&first_response, &second_response] {
            assert_eq!(response.exit_code, 0, "{}", utf8(&response.stderr));
            assert!(response.stderr.is_empty(), "{}", utf8(&response.stderr));
        }
        let mut counts = vec![first_response.stdout, second_response.stdout];
        counts.sort();
        assert_eq!(counts, vec![b"1".to_vec(), b"2".to_vec()]);
        assert!(
            elapsed >= Duration::from_millis(1_050),
            "BEGIN IMMEDIATE transactions did not serialize: {elapsed:?}"
        );
    }

    fn component_worker_options(site: &Path, constant: &str, host_env: &str) -> PhpWorkerOptions {
        PhpWorkerOptions {
            mounts: vec![Mount::new(site, "/site").unwrap()],
            constants: vec![
                (
                    "ADAPTER_CONSTANT".to_string(),
                    PhpConstantValue::string("superseded"),
                ),
                (
                    "ADAPTER_CONSTANT".to_string(),
                    PhpConstantValue::string(constant),
                ),
            ],
            env_entries: vec![
                ("HOST_LEVEL".to_string(), "superseded".to_string()),
                ("HOST_LEVEL".to_string(), host_env.to_string()),
            ],
            php_ini_entries: vec!["precision=13".to_string()],
            internal_files: vec![(
                "/internal/shared/adapter.txt".to_string(),
                Arc::<[u8]>::from(&b"staged-runtime-file"[..]),
            )],
            extensions: Default::default(),
        }
    }

    fn packed_request(host_env: &str) -> PhpRequest {
        let mut request = PhpRequest::for_script("/site/adapter.php");
        request.request_uri = "/adapter.php?hello=world".to_string();
        request.method = "POST".to_string();
        request.host = "adapter.test:8080".to_string();
        request.port = 8080;
        request.body = vec![b'A', 0, b'B'];
        request.content_type = Some("application/octet-stream".to_string());
        request.cookies = Some("adapter_cookie=yes".to_string());
        request.server_entries = vec![("X_PACKED".to_string(), "server-value".to_string())];
        request.env = vec![
            ("HOST_LEVEL".to_string(), host_env.to_string()),
            ("REQUEST_ONLY".to_string(), "request-only".to_string()),
        ];
        request
    }

    fn spawn_component_request(
        mut worker: PhpWorkerInstance,
        barrier: Arc<Barrier>,
    ) -> thread::JoinHandle<PhpResponse> {
        thread::spawn(move || {
            let mut request = packed_request("unused");
            request.env = vec![("REQUEST_ONLY".to_string(), "parallel".to_string())];
            barrier.wait();
            worker.run_sapi_request(&request).unwrap()
        })
    }

    fn spawn_component_script(
        mut worker: PhpWorkerInstance,
        barrier: Arc<Barrier>,
        request: PhpRequest,
    ) -> thread::JoinHandle<PhpResponse> {
        thread::spawn(move || {
            barrier.wait();
            worker.run_sapi_request(&request).unwrap()
        })
    }

    fn assert_adapter_response(
        response: &PhpResponse,
        php_version: &str,
        constant: &str,
        host_env: &str,
        request_env: &str,
    ) {
        assert_eq!(response.exit_code, 0, "{}", utf8(&response.stderr));
        let decoded: Value = serde_json::from_slice(&response.stdout).unwrap_or_else(|error| {
            panic!("invalid adapter JSON ({error}): {}", utf8(&response.stdout))
        });
        assert_eq!(decoded["php_version"], expected_php_release(php_version));
        assert_eq!(decoded["method"], "POST");
        assert_eq!(decoded["query"], "hello=world");
        assert_eq!(decoded["body"], "410042");
        assert_eq!(decoded["server"], "server-value");
        assert_eq!(decoded["host_env"], host_env);
        assert_eq!(decoded["request_env"], request_env);
        assert_eq!(decoded["constant"], constant);
        assert_eq!(decoded["staged"], "staged-runtime-file");
        for extension in [
            "ctype",
            "filter",
            "session",
            "Phar",
            "Zend OPcache",
            "PDO",
            "pdo_sqlite",
            "sqlite3",
            "zlib",
        ] {
            assert_eq!(
                decoded["extensions"][extension], true,
                "{extension} is not loaded for PHP {php_version}"
            );
        }
        assert_eq!(decoded["gzinflate"], true);
        assert_eq!(decoded["zlib_round_trip"], "zlib-round-trip");
        assert_eq!(decoded["zlib_file_round_trip"], "zlib-file-round-trip");
        assert_eq!(response.http_status, 200);
        assert!(response
            .headers
            .iter()
            .any(|header| header == "X-Adapter: yes"));
    }

    fn assert_runtime_files(root: &Path, constant: &str) {
        let ini = fs::read_to_string(root.join(relative(PHP_INI_VFS_PATH))).unwrap();
        assert!(ini.contains("precision=13"));
        assert_eq!(
            fs::read(root.join("internal/shared/adapter.txt")).unwrap(),
            b"staged-runtime-file"
        );
        let constants: Value =
            serde_json::from_slice(&fs::read(root.join(relative(PHP_CONSTANTS_VFS_PATH))).unwrap())
                .unwrap();
        assert_eq!(constants["ADAPTER_CONSTANT"], constant);
    }

    fn component_root(worker: &PhpWorkerInstance) -> PathBuf {
        worker.component.runtime_root.clone()
    }

    fn relative(vfs_path: &str) -> PathBuf {
        vfs_relative_path(vfs_path).unwrap()
    }

    fn adapter_script() -> &'static [u8] {
        br#"<?php
$zlib_path = __DIR__ . '/zlib-' . bin2hex(random_bytes(8)) . '.gz';
$zlib_writer = gzopen($zlib_path, 'wb');
gzwrite($zlib_writer, 'zlib-file-round-trip');
gzclose($zlib_writer);
$zlib_reader = gzopen($zlib_path, 'rb');
$zlib_file_round_trip = gzread($zlib_reader, 1024);
gzclose($zlib_reader);
unlink($zlib_path);
header('X-Adapter: yes');
echo json_encode([
    'php_version' => PHP_VERSION,
    'method' => $_SERVER['REQUEST_METHOD'] ?? null,
    'query' => $_SERVER['QUERY_STRING'] ?? null,
    'body' => bin2hex(file_get_contents('php://input')),
    'server' => $_SERVER['X_PACKED'] ?? null,
    'host_env' => getenv('HOST_LEVEL'),
    'request_env' => getenv('REQUEST_ONLY'),
    'constant' => ADAPTER_CONSTANT,
    'staged' => file_get_contents('/internal/shared/adapter.txt'),
    'extensions' => [
        'ctype' => extension_loaded('ctype'),
        'filter' => extension_loaded('filter'),
        'session' => extension_loaded('session'),
        'Phar' => extension_loaded('Phar'),
        'Zend OPcache' => extension_loaded('Zend OPcache'),
        'PDO' => extension_loaded('PDO'),
        'pdo_sqlite' => extension_loaded('pdo_sqlite'),
        'sqlite3' => extension_loaded('sqlite3'),
		'zlib' => extension_loaded('zlib'),
    ],
	'gzinflate' => function_exists('gzinflate'),
	'zlib_round_trip' => gzinflate(gzdeflate('zlib-round-trip')),
	'zlib_file_round_trip' => $zlib_file_round_trip,
]);"#
    }

    fn sqlite_init_script() -> &'static [u8] {
        br#"<?php
$database = new PDO('sqlite:/site/component-lock.sqlite');
$database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$database->exec('CREATE TABLE requests (value TEXT NOT NULL)');
echo 'ready';
"#
    }

    fn sqlite_lock_script() -> &'static [u8] {
        br#"<?php
$database = new PDO('sqlite:/site/component-lock.sqlite');
$database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$database->exec('PRAGMA busy_timeout=5000');
$database->exec('BEGIN IMMEDIATE');
usleep(600000);
$database->exec("INSERT INTO requests(value) VALUES ('component')");
$database->exec('COMMIT');
echo $database->query('SELECT COUNT(*) FROM requests')->fetchColumn();
"#
    }

    fn write_component_asset_root(root: &Path, php_version: &str, proof: &Path) {
        let component = fs::read(proof).unwrap();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(root.join("php")).unwrap();
        let component_path = format!("php/php_{}.component.wasm", php_version.replace('.', "_"));
        fs::write(root.join(&component_path), &component).unwrap();
        fs::write(
            root.join("assets/php-assets.json"),
            format!(
                r#"{{
                    "schemaVersion": 2,
                    "runtime": "wasip2-component",
                    "php": {{
                        "{}": {{
                            "wasm": {{
                                "path": "{}",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                php_version,
                component_path,
                sha256_hex(&component),
            ),
        )
        .unwrap();
    }

    fn native_test_php_version() -> String {
        std::env::var("WP_PLAYGROUND_NATIVE_TEST_PHP_VERSION").unwrap_or_else(|_| "8.2".to_string())
    }

    fn expected_xdebug_version(php_version: &str) -> &'static str {
        match php_version {
            "7.4" => "3.1.6",
            "8.5" => "3.5.3",
            _ => "3.4.7",
        }
    }

    fn expected_php_release(php_version: &str) -> &'static str {
        match php_version {
            "7.4" => "7.4.33",
            "8.0" => "8.0.30",
            "8.1" => "8.1.34",
            "8.2" => "8.2.32",
            "8.3" => "8.3.32",
            "8.4" => "8.4.23",
            "8.5" => "8.5.8",
            version => panic!("unsupported native PHP test version: {version}"),
        }
    }

    fn write_component_variant_asset_root(
        root: &Path,
        php_version: &str,
        base: &Path,
        extended: &Path,
    ) {
        let base_component = fs::read(base).unwrap();
        let extended_component = fs::read(extended).unwrap();
        let file_version = php_version.replace('.', "_");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(root.join("php")).unwrap();
        let base_path = format!("php/php_{file_version}.component.wasm");
        let extended_path = format!("php/php_{file_version}.extended.component.wasm");
        fs::write(root.join(&base_path), &base_component).unwrap();
        fs::write(root.join(&extended_path), &extended_component).unwrap();
        fs::write(
            root.join("assets/php-assets.json"),
            format!(
                r#"{{
                    "schemaVersion": 2,
                    "runtime": "wasip2-component",
                    "php": {{
                        "{}": {{
                            "wasm": {{
                                "path": "{}",
                                "sha256": "{}"
                            }},
                            "variants": {{
                                "extended": {{
                                    "wasm": {{
                                        "path": "{}",
                                        "sha256": "{}"
                                    }}
                                }}
                            }}
                        }}
                    }}
                }}"#,
                php_version,
                base_path,
                sha256_hex(&base_component),
                extended_path,
                sha256_hex(&extended_component),
            ),
        )
        .unwrap();
    }

    fn receive_dbgp_init_and_detach(listener: TcpListener) -> Vec<u8> {
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut stream = loop {
            match listener.accept() {
                Ok((stream, _)) => break stream,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    assert!(
                        Instant::now() < deadline,
                        "timed out waiting for Xdebug DBGp connection"
                    );
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("failed to accept Xdebug DBGp connection: {error}"),
            }
        };
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        let mut init = Vec::new();
        let mut chunk = [0u8; 4096];
        while init.iter().filter(|byte| **byte == 0).count() < 2 {
            let read = stream.read(&mut chunk).unwrap();
            assert_ne!(
                read, 0,
                "Xdebug closed before completing its DBGp init packet"
            );
            init.extend_from_slice(&chunk[..read]);
            assert!(
                init.len() <= 128 * 1024,
                "Xdebug DBGp init packet exceeded 128 KiB"
            );
        }
        stream.write_all(b"detach -i 1\0").unwrap();
        init
    }

    fn utf8(bytes: &[u8]) -> String {
        String::from_utf8_lossy(bytes).into_owned()
    }

    struct ServiceProcess {
        child: Child,
    }

    impl ServiceProcess {
        fn spawn(label: &str, mut command: Command) -> Self {
            command.stdout(Stdio::null()).stderr(Stdio::null());
            let child = command.spawn().unwrap_or_else(|error| {
                panic!(
                    "failed to start {label}: {error}; install it or run the test in a Nix shell containing redis and memcached"
                )
            });
            Self { child }
        }
    }

    impl Drop for ServiceProcess {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(label: &str) -> Self {
            let id = NEXT_TEST_DIR_ID.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "wp-playground-php-backend-{label}-{}-{id}",
                std::process::id()
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
