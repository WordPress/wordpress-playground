use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use wasmtime::component::Component;

use crate::{
    php_config::PhpWorkerOptions,
    php_protocol::{PhpRequest, PhpResponse},
    php_runtime_files::{
        self, PhpConstantValue, PhpIniOptions, PHP_CONSTANTS_VFS_PATH, PHP_INI_VFS_PATH,
        PHP_SHARED_VFS_DIR,
    },
    runtime::{CompiledPhpArtifact, NativeRuntime},
    wasip2::{CapabilityPreopen, Wasip2ContextBuilder, Wasip2PhpInstance, Wasip2PhpOutput},
    CliError, Result,
};

static NEXT_COMPONENT_WORKER_ID: AtomicU64 = AtomicU64::new(1);
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

    pub fn run_sapi_request(&mut self, request: &PhpRequest) -> Result<PhpResponse> {
        self.component.run_sapi_request(request)
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
        let artifact = self.php_artifact(php_version)?;
        PhpWorkerInstance::from_artifact_with_options(artifact, options)
    }
}

pub struct ComponentPhpInstance {
    php: Option<Wasip2PhpInstance>,
    runtime_root: PathBuf,
    constants: Vec<(String, PhpConstantValue)>,
    env_entries: Vec<(String, String)>,
    failed_stdout: Vec<u8>,
    failed_stderr: Vec<u8>,
}

impl ComponentPhpInstance {
    fn instantiate(component: &Component, options: PhpWorkerOptions) -> Result<Self> {
        let runtime_root = create_component_worker_root()?;

        let result = Self::instantiate_in_root(component, options, runtime_root.clone());
        if result.is_err() {
            let _ = fs::remove_dir_all(&runtime_root);
        }
        result
    }

    fn instantiate_in_root(
        component: &Component,
        options: PhpWorkerOptions,
        runtime_root: PathBuf,
    ) -> Result<Self> {
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
        for (vfs_path, bytes) in runtime_files {
            write_staged_file(&runtime_root, &vfs_path, bytes.as_ref())?;
        }

        let mut context = Wasip2ContextBuilder::new().preopen(CapabilityPreopen::read_write(
            runtime_root.join(vfs_relative_path(PHP_SHARED_VFS_DIR)?),
            PHP_SHARED_VFS_DIR,
        ));
        let shared_vfs_path = vfs_relative_path(PHP_SHARED_VFS_DIR)?;
        let mut mounted_vfs_paths = Vec::with_capacity(options.mounts.len());
        for mount in &options.mounts {
            let mount_vfs_path = vfs_relative_path(&mount.vfs_path)?;
            if mount_vfs_path == shared_vfs_path {
                return Err(CliError::new(format!(
                    "WASIp2 PHP mount {} conflicts with the managed runtime directory {PHP_SHARED_VFS_DIR}",
                    mount.vfs_path
                )));
            }
            if mounted_vfs_paths.contains(&mount_vfs_path) {
                return Err(CliError::new(format!(
                    "Duplicate WASIp2 PHP mount path: {}",
                    mount.vfs_path
                )));
            }
            mounted_vfs_paths.push(mount_vfs_path);
            context = context.preopen(CapabilityPreopen::read_write(
                &mount.host_path,
                mount.vfs_path.clone(),
            ));
        }
        let state = context.build().map_err(|error| {
            CliError::new(format!("Failed to build WASIp2 PHP context: {error}"))
        })?;
        let mut php = Wasip2PhpInstance::instantiate(component, state).map_err(|error| {
            CliError::new(format!(
                "Failed to instantiate WASIp2 PHP component: {error}"
            ))
        })?;
        php.initialize(PHP_INI_VFS_PATH).map_err(|error| {
            CliError::new(format!(
                "Failed to initialize WASIp2 PHP component: {error}"
            ))
        })?;

        Ok(Self {
            php: Some(php),
            runtime_root,
            constants,
            env_entries: canonical_entries(&options.env_entries),
            failed_stdout: Vec::new(),
            failed_stderr: Vec::new(),
        })
    }

    fn run_sapi_request(&mut self, request: &PhpRequest) -> Result<PhpResponse> {
        self.failed_stdout.clear();
        self.failed_stderr.clear();
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
        let result = self
            .php
            .as_mut()
            .expect("component PHP is present until drop")
            .handle_request(request);
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
                    .expect("component PHP is present until drop")
                    .take_output();
                self.remember_failed_output(output);
                Err(CliError::new(format!("WASIp2 PHP request failed: {error}")))
            }
        }
    }

    fn define_constants(&mut self, constants: &[(String, PhpConstantValue)]) {
        merge_constants(&mut self.constants, constants);
        let path = self
            .runtime_root
            .join(vfs_relative_path(PHP_CONSTANTS_VFS_PATH).expect("constant path is absolute"));
        if let Err(error) = fs::write(&path, php_runtime_files::constants_json(&self.constants)) {
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

fn write_staged_file(root: &Path, vfs_path: &str, bytes: &[u8]) -> Result<()> {
    let path = root.join(vfs_relative_path(vfs_path)?);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, bytes).map_err(|error| {
        CliError::new(format!(
            "Failed to stage WASIp2 PHP runtime file {}: {error}",
            path.display()
        ))
    })
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
        path::{Path, PathBuf},
        sync::{atomic::AtomicU64, atomic::Ordering, Arc, Barrier},
        thread,
        time::{Duration, Instant},
    };

    use serde_json::Value;

    use super::{create_component_worker_root, vfs_relative_path, PhpWorkerInstance};
    use crate::{
        mount::Mount,
        php_config::PhpWorkerOptions,
        php_protocol::{PhpRequest, PhpResponse},
        php_runtime_files::{PhpConstantValue, PHP_CONSTANTS_VFS_PATH, PHP_INI_VFS_PATH},
        runtime::NativeRuntime,
        sha256::sha256_hex,
    };

    static NEXT_TEST_DIR_ID: AtomicU64 = AtomicU64::new(1);

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
    fn component_artifact_stages_runtime_and_runs_parallel_workers() {
        let proof = crate::runtime::repo_root_from_manifest_dir()
            .join("packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm");
        assert!(
            proof.is_file(),
            "checked-in PHP WASIp2 component is missing: {}",
            proof.display()
        );

        let asset_root = TestDir::new("component-adapter-assets");
        write_component_asset_root(asset_root.path(), &proof);
        let site = TestDir::new("component-adapter-site");
        fs::write(site.path().join("adapter.php"), adapter_script()).unwrap();
        let runtime = NativeRuntime::from_asset_root(asset_root.path()).unwrap();

        let mut worker = runtime
            .instantiate_php_worker_with_options(
                "8.2",
                component_worker_options(site.path(), "initial", "host-base"),
            )
            .unwrap();
        let worker_root = component_root(&worker);
        assert_runtime_files(&worker_root, "initial");

        let response = worker
            .run_sapi_request(&packed_request("request-override"))
            .unwrap();
        assert_adapter_response(&response, "initial", "request-override", "request-only");

        worker.define_constants(&[(
            "ADAPTER_CONSTANT".to_string(),
            PhpConstantValue::string("updated"),
        )]);
        assert_runtime_files(&worker_root, "updated");
        let response = worker
            .run_sapi_request(&packed_request("request-updated"))
            .unwrap();
        assert_adapter_response(&response, "updated", "request-updated", "request-only");

        drop(worker);
        assert!(!worker_root.exists());

        let first = runtime
            .instantiate_php_worker_with_options(
                "8.2",
                component_worker_options(site.path(), "worker-one", "env-one"),
            )
            .unwrap();
        let second = runtime
            .instantiate_php_worker_with_options(
                "8.2",
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
        assert_adapter_response(&first_response, "worker-one", "env-one", "parallel");
        assert_adapter_response(&second_response, "worker-two", "env-two", "parallel");
        assert!(!first_root.exists());
        assert!(!second_root.exists());

        fs::write(site.path().join("sqlite-init.php"), sqlite_init_script()).unwrap();
        fs::write(site.path().join("sqlite-lock.php"), sqlite_lock_script()).unwrap();
        let mut initializer = runtime
            .instantiate_php_worker_with_options(
                "8.2",
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
                "8.2",
                component_worker_options(site.path(), "sqlite-one", "sqlite-one"),
            )
            .unwrap();
        let second = runtime
            .instantiate_php_worker_with_options(
                "8.2",
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
        constant: &str,
        host_env: &str,
        request_env: &str,
    ) {
        assert_eq!(response.exit_code, 0, "{}", utf8(&response.stderr));
        let decoded: Value = serde_json::from_slice(&response.stdout).unwrap_or_else(|error| {
            panic!("invalid adapter JSON ({error}): {}", utf8(&response.stdout))
        });
        assert_eq!(decoded["method"], "POST");
        assert_eq!(decoded["query"], "hello=world");
        assert_eq!(decoded["body"], "410042");
        assert_eq!(decoded["server"], "server-value");
        assert_eq!(decoded["host_env"], host_env);
        assert_eq!(decoded["request_env"], request_env);
        assert_eq!(decoded["constant"], constant);
        assert_eq!(decoded["staged"], "staged-runtime-file");
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
header('X-Adapter: yes');
echo json_encode([
    'method' => $_SERVER['REQUEST_METHOD'] ?? null,
    'query' => $_SERVER['QUERY_STRING'] ?? null,
    'body' => bin2hex(file_get_contents('php://input')),
    'server' => $_SERVER['X_PACKED'] ?? null,
    'host_env' => getenv('HOST_LEVEL'),
    'request_env' => getenv('REQUEST_ONLY'),
    'constant' => ADAPTER_CONSTANT,
    'staged' => file_get_contents('/internal/shared/adapter.txt'),
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

    fn write_component_asset_root(root: &Path, proof: &Path) {
        let component = fs::read(proof).unwrap();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(root.join("php")).unwrap();
        fs::write(root.join("php/php_8_2.component.wasm"), &component).unwrap();
        fs::write(
            root.join("assets/php-assets.json"),
            format!(
                r#"{{
                    "schemaVersion": 2,
                    "runtime": "wasip2-component",
                    "php": {{
                        "8.2": {{
                            "wasm": {{
                                "path": "php/php_8_2.component.wasm",
                                "sha256": "{}"
                            }}
                        }}
                    }}
                }}"#,
                sha256_hex(&component)
            ),
        )
        .unwrap();
    }

    fn utf8(bytes: &[u8]) -> String {
        String::from_utf8_lossy(bytes).into_owned()
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
