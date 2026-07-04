use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    fs, io,
    io::{Cursor, Read, Seek, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::Command as ProcessCommand,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{sync_channel, Receiver, SyncSender, TryRecvError},
        Arc, Mutex, TryLockError,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Deserialize;
use wasmtime::Module;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

use crate::{
    args::{CliOptions, CommandName, RuntimeConfig, Verbosity, WorkerCount, DEFAULT_PORT},
    automount::BlueprintStep,
    download::{cached_download_with_validator, download_bytes, url_cache_key},
    host::{HostMount, HostOptions, PhpConstantValue},
    mount::Mount,
    paths::{SiteStorage, WordPressInstallMode},
    php::{PhpInstance, PhpRequest, PhpResponse},
    route_counters::{self, Field, RequestId},
    runtime::{release_unused_process_memory, NativeRuntime},
    vfs::normalize_vfs_path,
    wordpress::{
        defined_constants_for_host, ensure_wordpress_mount, ensure_wp_config, prepare_wordpress,
        wordpress_mount_path,
    },
    CliError, Result,
};

const MAX_REQUEST_BYTES: usize = 64 * 1024 * 1024;
const HTTP_READ_TIMEOUT: Duration = Duration::from_secs(30);
const HTTP_WRITE_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_NATIVE_ASYNCIFY_REQUESTS_PER_WORKER: usize = 16;
const MAX_REQUESTS_PER_WORKER_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MAX_REQUESTS_PER_WORKER";
const RECYCLE_WASM_MEMORY_MIB_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_RECYCLE_WASM_MEMORY_MIB";
const DEFAULT_RECYCLE_WASM_MEMORY_MIB: u64 = 90;
const WORKER_RECYCLE_IDLE_DELAY: Duration = Duration::from_millis(50);
const WORKER_RECYCLE_IDLE_DELAY_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_WORKER_RECYCLE_IDLE_MS";
const AUTO_LOGIN_COOKIE_NAME: &str = "playground_auto_login_already_happened";
const CLEAR_AUTO_LOGIN_COOKIE: &str = "playground_auto_login_already_happened=1; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/";
const DEFAULT_WP_CLI_PATH: &str = "/tmp/wp-cli.phar";
const DEFAULT_WP_CLI_URL: &str = "https://playground.wordpress.net/wp-cli.phar";
const WP_CLI_RELATIVE_PATH_WARNING: &str = "The wp-cli step in your Blueprint refers to a relative `wordpress/...` path. wp-playground-native rewrote it to `/wordpress/...` for compatibility; update the Blueprint to use an absolute path.";
const IMPORT_FILE_DEPRECATION_WARNING: &str =
    "The `importFile` Blueprint step is deprecated. Use `importWxr` instead.";
const WP_CONTENT_FILES_EXCLUDED_FROM_EXPORT: &[&str] = &[
    "db.php",
    "plugins/akismet",
    "plugins/hello.php",
    "plugins/wordpress-importer",
    "mu-plugins/sqlite-database-integration",
    "mu-plugins/playground-includes",
    "mu-plugins/0-playground.php",
    "mu-plugins/0-sqlite.php",
    "themes/twentytwenty",
    "themes/twentytwentyone",
    "themes/twentytwentytwo",
    "themes/twentytwentythree",
    "themes/twentytwentyfour",
    "themes/twentytwentyfive",
    "themes/twentytwentysix",
];
const WP_MYSQL_NAIVE_QUERY_STREAM: &str =
    include_str!("../../blueprints/src/lib/steps/WP_MySQL_Naive_Query_Stream.php");
const WP_CONFIG_TRANSFORMER: &str = include_str!("../../wordpress/src/wp-config-transformer.php");

#[derive(Debug, Clone, PartialEq, Eq)]
struct HttpRequest {
    method: String,
    target: String,
    version: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl From<&HttpRequest> for HttpRequest {
    fn from(request: &HttpRequest) -> Self {
        request.clone()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HttpResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

enum ServerHttpResponse {
    Buffered(HttpResponse),
    StaticFile(PathBuf),
}

struct HandledHttpResponse {
    response: ServerHttpResponse,
    route_target: &'static str,
    worker_action: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HttpProtocolError {
    status: u16,
    message: String,
}

type HttpParseResult<T> = std::result::Result<T, HttpProtocolError>;

impl HttpProtocolError {
    fn new(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    fn response(&self) -> HttpResponse {
        http_error_response(self.status, &self.message)
    }
}

struct WorkerPool {
    available_workers: Mutex<Receiver<Arc<Mutex<PhpWorker>>>>,
    release_worker: SyncSender<Arc<Mutex<PhpWorker>>>,
    php_module: Module,
    host_options: HostOptions,
    max_requests_per_worker: usize,
    recycle_wasm_memory_threshold: Option<u64>,
    recycle_idle_delay: Duration,
    len: usize,
    created_workers: Mutex<usize>,
    lazy: bool,
    log_stats: bool,
}

enum WorkerAfterRequest {
    Keep,
    Recycle { delay: Duration, force: bool },
    Retire,
}

impl WorkerPool {
    fn new(
        workers: Vec<PhpInstance>,
        php_module: Module,
        host_options: HostOptions,
        max_workers: usize,
        lazy: bool,
    ) -> Self {
        let created_workers = workers.len();
        let len = max_workers.max(created_workers).max(1);
        let (release_worker, available_workers) = sync_channel(len);
        for worker in workers
            .into_iter()
            .map(|php| Arc::new(Mutex::new(PhpWorker::new(php))))
        {
            release_worker
                .send(worker)
                .expect("worker pool receiver exists during initialization");
        }
        let max_requests_per_worker = max_requests_per_worker_from_env();
        let recycle_wasm_memory_threshold = recycle_wasm_memory_threshold_from_env();
        let recycle_idle_delay = worker_recycle_idle_delay_from_env();
        Self {
            available_workers: Mutex::new(available_workers),
            release_worker,
            php_module,
            host_options,
            max_requests_per_worker,
            recycle_wasm_memory_threshold,
            recycle_idle_delay,
            len,
            created_workers: Mutex::new(created_workers),
            lazy,
            log_stats: env_flag("WP_PLAYGROUND_NATIVE_WORKER_STATS"),
        }
    }

    fn len(&self) -> usize {
        self.len
    }

    fn acquire(&self) -> Result<WorkerLease> {
        if self.lazy {
            match self
                .available_workers
                .lock()
                .map_err(|_| CliError::new("PHP worker queue lock was poisoned"))?
                .try_recv()
            {
                Ok(worker) => {
                    return Ok(WorkerLease {
                        worker: Some(worker),
                        release_worker: self.release_worker.clone(),
                        retire_on_drop: false,
                    });
                }
                Err(TryRecvError::Empty) => {
                    if self.reserve_lazy_worker()? {
                        let start = Instant::now();
                        let php = match PhpInstance::from_module_with_host_options(
                            self.php_module.clone(),
                            self.host_options.clone(),
                        ) {
                            Ok(php) => php,
                            Err(error) => {
                                self.release_lazy_reservation();
                                return Err(error);
                            }
                        };
                        if self.log_stats {
                            eprintln!(
                                "debug: worker-pool spawned lazy worker in {}ms",
                                start.elapsed().as_millis()
                            );
                        }
                        return Ok(WorkerLease {
                            worker: Some(Arc::new(Mutex::new(PhpWorker::new(php)))),
                            release_worker: self.release_worker.clone(),
                            retire_on_drop: false,
                        });
                    }
                }
                Err(TryRecvError::Disconnected) => {
                    return Err(CliError::new("PHP worker pool closed unexpectedly"));
                }
            }
        }

        let worker = self
            .available_workers
            .lock()
            .map_err(|_| CliError::new("PHP worker queue lock was poisoned"))?
            .recv()
            .map_err(|_| CliError::new("PHP worker pool closed unexpectedly"))?;
        Ok(WorkerLease {
            worker: Some(worker),
            release_worker: self.release_worker.clone(),
            retire_on_drop: false,
        })
    }

    fn reserve_lazy_worker(&self) -> Result<bool> {
        let mut created = self
            .created_workers
            .lock()
            .map_err(|_| CliError::new("PHP worker counter lock was poisoned"))?;
        if *created >= self.len {
            return Ok(false);
        }
        *created += 1;
        Ok(true)
    }

    fn release_lazy_reservation(&self) {
        if let Ok(mut created) = self.created_workers.lock() {
            *created = created.saturating_sub(1);
        }
    }

    fn recycle_wasm_memory_threshold(&self) -> Option<u64> {
        self.recycle_wasm_memory_threshold
    }

    fn mark_request_finished(
        &self,
        worker: &mut PhpWorker,
        wasm_memory_size_bytes: Option<u64>,
    ) -> Result<WorkerAfterRequest> {
        mark_worker_request_finished(
            worker,
            &self.created_workers,
            self.lazy,
            self.max_requests_per_worker,
            self.recycle_wasm_memory_threshold,
            self.recycle_idle_delay,
            wasm_memory_size_bytes,
        )
    }

    fn schedule_worker_recycle(
        &self,
        worker: Arc<Mutex<PhpWorker>>,
        recycle_idle_delay: Duration,
        force: bool,
    ) {
        let php_module = self.php_module.clone();
        let host_options = self.host_options.clone();
        let max_requests_per_worker = self.max_requests_per_worker;
        let log_stats = self.log_stats;
        thread::spawn(move || loop {
            thread::sleep(recycle_idle_delay);
            match worker.try_lock() {
                Ok(mut worker) => {
                    let idle_for = worker.last_request_finished_at.elapsed();
                    if idle_for < recycle_idle_delay {
                        let remaining_idle_delay = recycle_idle_delay - idle_for;
                        drop(worker);
                        thread::sleep(remaining_idle_delay);
                        continue;
                    }
                    if !force && worker.requests_handled < max_requests_per_worker {
                        worker.recycle_scheduled = false;
                        return;
                    }
                    let start = Instant::now();
                    drop(worker.php.take());
                    release_unused_process_memory();
                    match PhpInstance::from_module_with_host_options(
                        php_module.clone(),
                        host_options.clone(),
                    ) {
                        Ok(php) => {
                            worker.php = Some(php);
                            worker.requests_handled = 0;
                            worker.recycle_scheduled = false;
                            drop(worker);
                            release_unused_process_memory();
                            if log_stats {
                                eprintln!(
                                    "debug: worker-pool recycled idle worker in {}ms",
                                    start.elapsed().as_millis()
                                );
                            }
                        }
                        Err(error) => {
                            worker.recycle_scheduled = false;
                            eprintln!("warning: failed to recycle PHP worker: {error}");
                        }
                    }
                    return;
                }
                Err(TryLockError::WouldBlock) => {
                    continue;
                }
                Err(TryLockError::Poisoned(_)) => {
                    eprintln!("warning: failed to recycle PHP worker: worker lock was poisoned");
                    return;
                }
            }
        });
    }
}

fn mark_worker_request_finished(
    worker: &mut PhpWorker,
    created_workers: &Mutex<usize>,
    lazy: bool,
    max_requests_per_worker: usize,
    recycle_wasm_memory_threshold: Option<u64>,
    recycle_idle_delay: Duration,
    wasm_memory_size_bytes: Option<u64>,
) -> Result<WorkerAfterRequest> {
    worker.requests_handled = worker.requests_handled.saturating_add(1);
    worker.last_request_finished_at = Instant::now();
    if worker.recycle_scheduled {
        return Ok(WorkerAfterRequest::Keep);
    }
    if reserve_lazy_worker_retirement(lazy, created_workers)? {
        return Ok(WorkerAfterRequest::Retire);
    }
    if recycle_wasm_memory_threshold
        .zip(wasm_memory_size_bytes)
        .is_some_and(|(threshold, memory_size)| memory_size >= threshold)
    {
        worker.recycle_scheduled = true;
        return Ok(WorkerAfterRequest::Recycle {
            delay: recycle_idle_delay,
            force: true,
        });
    }
    if worker.requests_handled < max_requests_per_worker {
        return Ok(WorkerAfterRequest::Keep);
    }
    worker.recycle_scheduled = true;
    Ok(WorkerAfterRequest::Recycle {
        delay: recycle_idle_delay,
        force: false,
    })
}

fn reserve_lazy_worker_retirement(lazy: bool, created_workers: &Mutex<usize>) -> Result<bool> {
    if !lazy {
        return Ok(false);
    }
    let mut created = created_workers
        .lock()
        .map_err(|_| CliError::new("PHP worker counter lock was poisoned"))?;
    if *created <= 1 {
        return Ok(false);
    }
    *created -= 1;
    Ok(true)
}

fn max_requests_per_worker_from_env() -> usize {
    std::env::var(MAX_REQUESTS_PER_WORKER_ENV_VAR)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(MAX_NATIVE_ASYNCIFY_REQUESTS_PER_WORKER)
}

fn recycle_wasm_memory_threshold_from_env() -> Option<u64> {
    let value = std::env::var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(DEFAULT_RECYCLE_WASM_MEMORY_MIB);
    if value == 0 {
        return None;
    }
    if value > 4096 {
        return Some(DEFAULT_RECYCLE_WASM_MEMORY_MIB * 1024 * 1024);
    }
    Some(value * 1024 * 1024)
}

fn worker_recycle_idle_delay_from_env() -> Duration {
    std::env::var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value <= 60_000)
        .map(Duration::from_millis)
        .unwrap_or(WORKER_RECYCLE_IDLE_DELAY)
}

struct PhpWorker {
    php: Option<PhpInstance>,
    requests_handled: usize,
    last_request_finished_at: Instant,
    recycle_scheduled: bool,
}

impl PhpWorker {
    fn new(php: PhpInstance) -> Self {
        Self {
            php: Some(php),
            requests_handled: 0,
            last_request_finished_at: Instant::now(),
            recycle_scheduled: false,
        }
    }

    fn php(&self) -> Result<&PhpInstance> {
        self.php
            .as_ref()
            .ok_or_else(|| CliError::new("PHP worker is unavailable during recycle"))
    }

    fn php_mut(&mut self) -> Result<&mut PhpInstance> {
        self.php
            .as_mut()
            .ok_or_else(|| CliError::new("PHP worker is unavailable during recycle"))
    }
}

struct WorkerLease {
    worker: Option<Arc<Mutex<PhpWorker>>>,
    release_worker: SyncSender<Arc<Mutex<PhpWorker>>>,
    retire_on_drop: bool,
}

impl WorkerLease {
    fn worker(&self) -> &Arc<Mutex<PhpWorker>> {
        self.worker
            .as_ref()
            .expect("worker lease always holds a worker until drop")
    }

    fn retire_on_drop(&mut self) {
        self.retire_on_drop = true;
    }
}

impl Drop for WorkerLease {
    fn drop(&mut self) {
        if let Some(worker) = self.worker.take() {
            if self.retire_on_drop {
                drop(worker);
                release_unused_process_memory();
            } else {
                let _ = self.release_worker.send(worker);
            }
        }
    }
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum StartupStep {
    Login {
        username: String,
    },
    DisableLogin,
    ActivatePlugin {
        plugin_path: String,
    },
    ActivateTheme {
        theme_folder_name: String,
    },
    ActivateFirstTheme,
    InstallPlugin {
        asset: InstallAssetStep,
    },
    InstallTheme {
        asset: InstallAssetStep,
        import_starter_content: bool,
    },
    Unzip {
        zip: FileContentSource,
        extract_to_path: String,
    },
    SetSiteOptions {
        options_json: String,
    },
    SetSiteLanguage {
        language: String,
    },
    UpdateUserMeta {
        user_id: u64,
        meta_json: String,
    },
    ResetData,
    Request {
        request: StartupHttpRequest,
    },
    ImportWxr {
        file: FileContentSource,
    },
    ImportWordPressFiles {
        zip: FileContentSource,
        path_in_zip: String,
    },
    RunWpInstallationWizard {
        admin_password: Option<String>,
    },
    EnsureWpCli {
        wp_cli_path: String,
    },
    EnableMultisite {
        wp_cli_path: String,
    },
    WpCli {
        wp_cli_path: String,
        args: Vec<String>,
    },
    RunPhp {
        code: String,
    },
    RunPhpWithOptions {
        options: PhpRunOptions,
    },
    RunSql {
        sql: FileContentSource,
    },
    DefineWpConfigConsts {
        constants: Vec<(String, PhpConstantValue)>,
        method: DefineWpConfigMethod,
    },
    WriteFile {
        path: String,
        data: FileContentSource,
    },
    WriteFiles {
        write_to_path: String,
        files: FileTreeSource,
    },
    Mkdir {
        path: String,
    },
    Rm {
        path: String,
    },
    Rmdir {
        path: String,
    },
    Cp {
        from_path: String,
        to_path: String,
    },
    Mv {
        from_path: String,
        to_path: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DefineWpConfigMethod {
    DefineBeforeRun,
    RewriteWpConfig,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PhpRunOptions {
    script: PhpRunScript,
    relative_uri: String,
    protocol: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
    env: Vec<(String, String)>,
    server_entries: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PhpRunScript {
    Code(String),
    ScriptPath(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct StartupHttpRequest {
    method: String,
    target: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct InstallAssetStep {
    source: InstallAssetSource,
    target_folder_name: Option<String>,
    if_already_installed: IfAlreadyInstalled,
    activate: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum InstallAssetSource {
    Download(DownloadableAsset),
    LocalFile {
        path: PathBuf,
        filename: String,
    },
    BundledFile {
        bytes: Vec<u8>,
        filename: String,
    },
    Content {
        source: FileContentSource,
        filename: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DownloadableAsset {
    url: String,
    filename: String,
    cache_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum FileContentSource {
    Bytes(Vec<u8>),
    Url(String),
    LocalFile(PathBuf),
    BundledFile(Vec<u8>),
    VfsPath(String),
    ZipWrappedFile {
        inner: Box<FileContentSource>,
        filename: String,
    },
    ZipWrappedDirectory {
        name: String,
        files: BTreeMap<String, FileTreeEntry>,
    },
    ZipWrappedGitDirectory(GitDirectoryResource),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum FileTreeEntry {
    File(Vec<u8>),
    Directory(BTreeMap<String, FileTreeEntry>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum FileTreeSource {
    Literal(BTreeMap<String, FileTreeEntry>),
    Git(GitDirectoryResource),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GitDirectoryResource {
    url: String,
    ref_name: String,
    ref_type: Option<String>,
    path: String,
    include_git: bool,
}

impl GitDirectoryResource {
    fn filename(&self) -> String {
        sanitize_git_directory_name(&self.display_name())
    }

    fn display_name(&self) -> String {
        let mut parts = vec![self.url.clone()];
        if !self.ref_name.is_empty() {
            parts.push(format!("({})", self.ref_name));
        }
        if !self.path.is_empty() {
            parts.push(format!("at {}", self.path));
        }
        parts.join(" ")
    }
}

impl InstallAssetSource {
    fn filename(&self) -> &str {
        match self {
            InstallAssetSource::Download(asset) => &asset.filename,
            InstallAssetSource::LocalFile { filename, .. }
            | InstallAssetSource::BundledFile { filename, .. }
            | InstallAssetSource::Content { filename, .. } => filename,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IfAlreadyInstalled {
    Overwrite,
    Skip,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum RouteTarget {
    Php {
        vfs_path: String,
        path_info: Option<String>,
    },
    Static {
        host_path: PathBuf,
    },
    NotFound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SymlinkPolicy {
    BlockEscapes,
    Follow,
}

fn symlink_policy_from_follow(follow_symlinks: bool) -> SymlinkPolicy {
    if follow_symlinks {
        SymlinkPolicy::Follow
    } else {
        SymlinkPolicy::BlockEscapes
    }
}

#[derive(Debug, Clone, Copy)]
struct RouteCounterContext<'a> {
    request_id: RequestId,
    method: &'a str,
    target: &'a str,
    symlink_policy: SymlinkPolicy,
}

impl RouteCounterContext<'_> {
    fn fields(self) -> Vec<Field> {
        let mut fields = route_counters::request_fields(self.request_id, self.method, self.target);
        fields.push(Field::new(
            "symlink_policy",
            symlink_policy_label(self.symlink_policy),
        ));
        fields
    }
}

pub fn run_native_server(runtime: &NativeRuntime, config: &RuntimeConfig) -> Result<u8> {
    progress(&config.options, "Preparing mounts");
    let mut mounts = server_mounts(config)?;
    let _document_root = ensure_wordpress_mount(&mut mounts)?;
    ensure_tmp_mount(&mut mounts)?;
    progress(&config.options, "Preparing WordPress files");
    let prepared = prepare_wordpress(runtime.repo_root(), &config.options, &mounts)?;
    if !prepared.installed_files_available
        && !matches!(
            config.options.wordpress_install_mode,
            crate::paths::WordPressInstallMode::DoNotAttemptInstalling
        )
    {
        return Err(CliError::new(format!(
            "WordPress files are not available in {}",
            prepared.document_root.display()
        )));
    }
    if prepared.installed_files_available {
        progress(
            &config.options,
            format!(
                "WordPress files ready at {}",
                prepared.document_root.display()
            ),
        );
    }

    let host_options = HostOptions {
        echo_output: false,
        capture_import_trace: config.options.debug,
        max_import_calls: config.options.debug.then_some(100_000),
        follow_symlinks: config.options.follow_symlinks,
        opcache_mode: config.options.opcache,
        host_cache: config.options.opcache.enables_host_cache(),
        mounts: mounts
            .iter()
            .map(|mount| HostMount {
                host_path: mount.host_path.clone(),
                vfs_path: mount.vfs_path.clone(),
            })
            .collect(),
        ..HostOptions::default()
    };
    run_listener(config, &mounts, runtime, host_options)
}

fn progress(options: &CliOptions, message: impl AsRef<str>) {
    if !matches!(options.verbosity, Verbosity::Quiet) {
        eprintln!("{}", message.as_ref());
    }
}

fn server_mounts(config: &RuntimeConfig) -> Result<Vec<Mount>> {
    let mut mounts = Vec::new();
    mounts.extend(config.options.mounts_before_install.clone());
    mounts.extend(config.options.mounts.clone());

    if config.options.reset {
        if let Some(SiteStorage::Managed(path)) = &config.site_storage {
            if path.exists() {
                fs::remove_dir_all(path).map_err(|error| {
                    CliError::new(format!(
                        "Failed to reset managed WordPress site {}: {error}",
                        path.display()
                    ))
                })?;
            }
        }
    }

    for mount in &mut mounts {
        if mount.vfs_path == "/wordpress" {
            fs::create_dir_all(&mount.host_path).map_err(|error| {
                CliError::new(format!(
                    "Failed to create WordPress mount directory {}: {error}",
                    mount.host_path.display()
                ))
            })?;
            mount.refresh_canonical_host_path()?;
        }
    }

    Ok(mounts)
}

pub(crate) fn ensure_tmp_mount(mounts: &mut Vec<Mount>) -> Result<()> {
    if let Some(mount) = mounts.iter().find(|mount| mount.vfs_path == "/tmp") {
        fs::create_dir_all(mount.host_path.join("opcache")).map_err(|error| {
            CliError::new(format!(
                "Failed to create OPcache directory under {}: {error}",
                mount.host_path.display()
            ))
        })?;
        return Ok(());
    }

    let path = std::env::temp_dir().join(format!(
        "wp-playground-native-tmp-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    fs::create_dir_all(path.join("opcache"))?;
    mounts.push(Mount::new(path, "/tmp")?);
    Ok(())
}

fn requested_worker_count(options: &CliOptions) -> usize {
    match &options.workers {
        Some(WorkerCount::Fixed(workers)) => *workers,
        Some(WorkerCount::Auto) => cpu_workers_minus_one(),
        None => cpu_workers_minus_one().min(6),
    }
}

fn lazy_worker_pool_enabled(options: &CliOptions) -> bool {
    options.workers.is_none() || env_flag("WP_PLAYGROUND_NATIVE_LAZY_WORKERS")
}

fn cpu_workers_minus_one() -> usize {
    thread::available_parallelism()
        .map(|parallelism| parallelism.get().saturating_sub(1).max(1))
        .unwrap_or(1)
}

fn create_worker_pool(
    runtime: &NativeRuntime,
    php_version: &str,
    host_options: HostOptions,
    primary: PhpInstance,
    worker_count: usize,
    lazy_workers: bool,
) -> Result<WorkerPool> {
    let worker_count = worker_count.max(1);
    let php_module = runtime.php_module(php_version)?;
    let initial_worker_count = if lazy_workers { 1 } else { worker_count };
    let mut workers = Vec::with_capacity(initial_worker_count);
    workers.push(primary);
    for _ in 1..initial_worker_count {
        workers.push(runtime.instantiate_php_with_host_options(php_version, host_options.clone())?);
    }
    Ok(WorkerPool::new(
        workers,
        php_module,
        host_options,
        worker_count,
        lazy_workers,
    ))
}

fn run_listener(
    config: &RuntimeConfig,
    mounts: &[Mount],
    runtime: &NativeRuntime,
    mut host_options: HostOptions,
) -> Result<u8> {
    progress(&config.options, "Binding HTTP server");
    let listener = bind_server_listener(config.options.port)?;
    let actual_port = listener
        .local_addr()
        .map_err(|error| CliError::new(format!("Failed to inspect server address: {error}")))?
        .port();
    let server_url = config
        .options
        .site_url
        .clone()
        .unwrap_or_else(|| format!("http://127.0.0.1:{actual_port}"));
    host_options.string_constants.push((
        "WP_HOME".to_string(),
        PhpConstantValue::string(server_url.clone()),
    ));
    host_options.string_constants.push((
        "WP_SITEURL".to_string(),
        PhpConstantValue::string(server_url.clone()),
    ));
    let wordpress_root = wordpress_mount_path(mounts);
    host_options
        .string_constants
        .extend(defined_constants_for_host(
            &config.options.defined_constants,
            wordpress_root.as_deref(),
        ));
    let startup_steps = startup_steps_from_options(&config.options)?;
    if let Some(username) = auto_login_username(&config.options, &startup_steps) {
        host_options.string_constants.push((
            "PLAYGROUND_AUTO_LOGIN_AS_USER".to_string(),
            PhpConstantValue::string(username),
        ));
    }

    progress(
        &config.options,
        format!("Loading PHP {} runtime", config.options.php),
    );
    let mut php =
        runtime.instantiate_php_with_host_options(&config.options.php, host_options.clone())?;

    progress(&config.options, "Preparing WordPress database");
    maybe_boot_wordpress_site(mounts, &mut php, actual_port, &config.options)?;
    progress(&config.options, "WordPress database ready");
    if !startup_steps.is_empty() {
        progress(
            &config.options,
            format!("Running {} Blueprint startup step(s)", startup_steps.len()),
        );
    }
    run_startup_steps(
        &startup_steps,
        mounts,
        &mut php,
        actual_port,
        &mut host_options,
    )?;
    let worker_count = requested_worker_count(&config.options);
    let lazy_workers = lazy_worker_pool_enabled(&config.options);
    let initial_worker_count = if lazy_workers { 1 } else { worker_count };
    progress(
        &config.options,
        format!(
            "Starting PHP worker pool ({initial_worker_count}/{worker_count} worker(s) ready now)"
        ),
    );
    let worker_pool = Arc::new(create_worker_pool(
        runtime,
        &config.options.php,
        host_options,
        php,
        worker_count,
        lazy_workers,
    )?);
    release_unused_process_memory();

    if !matches!(config.options.verbosity, Verbosity::Quiet) {
        eprintln!("wp-playground-native listening on {server_url}");
    }

    if matches!(config.original_command, CommandName::Start) && !config.options.skip_browser {
        progress(&config.options, "Opening browser");
        let _ = open_browser(&server_url);
    }

    let mounts = Arc::new(mounts.to_vec());
    let first_request = Arc::new(AtomicBool::new(true));
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let worker_pool = Arc::clone(&worker_pool);
                let mounts = Arc::clone(&mounts);
                let first_request = Arc::clone(&first_request);
                let debug = config.options.debug;
                let follow_symlinks = config.options.follow_symlinks;
                thread::spawn(move || {
                    let mut stream = stream;
                    let _ = stream.set_read_timeout(Some(HTTP_READ_TIMEOUT));
                    let _ = stream.set_write_timeout(Some(HTTP_WRITE_TIMEOUT));
                    if let Err(error) = handle_stream(
                        &mut stream,
                        &mounts,
                        &worker_pool,
                        actual_port,
                        debug,
                        follow_symlinks,
                        &first_request,
                    ) {
                        let _ = write_http_response(
                            &mut stream,
                            &HttpResponse {
                                status: 500,
                                headers: vec![(
                                    "Content-Type".to_string(),
                                    "text/plain".to_string(),
                                )],
                                body: b"Internal Server Error\n".to_vec(),
                            },
                            false,
                        );
                        if debug {
                            eprintln!("server request error: {error}");
                        }
                    }
                });
            }
            Err(error) => {
                if !matches!(config.options.verbosity, Verbosity::Quiet) {
                    eprintln!("server connection error: {error}");
                }
            }
        }
    }

    Ok(0)
}

fn bind_server_listener(port: Option<u16>) -> Result<TcpListener> {
    bind_server_listener_with_default(port, DEFAULT_PORT)
}

fn bind_server_listener_with_default(port: Option<u16>, default_port: u16) -> Result<TcpListener> {
    let requested_port = port.unwrap_or(default_port);
    match TcpListener::bind(("127.0.0.1", requested_port)) {
        Ok(listener) => Ok(listener),
        Err(error) if port.is_none() && error.kind() == io::ErrorKind::AddrInUse => {
            TcpListener::bind(("127.0.0.1", 0)).map_err(|fallback_error| {
                CliError::new(format!(
                    "Failed to bind 127.0.0.1:{requested_port} and fallback port 0: {fallback_error}"
                ))
            })
        }
        Err(error) => Err(CliError::new(format!(
            "Failed to bind 127.0.0.1:{requested_port}: {error}"
        ))),
    }
}

fn handle_stream(
    stream: &mut TcpStream,
    mounts: &[Mount],
    worker_pool: &WorkerPool,
    port: u16,
    debug: bool,
    follow_symlinks: bool,
    first_request: &AtomicBool,
) -> Result<()> {
    let request_id = route_counters::next_request_id();
    let request_started_at = request_id.map(|_| Instant::now());
    let request = match read_http_request_with_counter(stream, request_id) {
        Ok(request) => request,
        Err(error) => {
            let response = error.response();
            let write_result =
                write_http_response_with_counter(stream, &response, false, request_id);
            emit_request_total(RequestTotalCounter {
                request_id,
                started_at: request_started_at,
                method: "",
                target: "",
                route_target: "http_error",
                status: response.status,
                request_body_bytes: 0,
                response_body_bytes: request_id.map(|_| response.body.len() as u64),
                response_header_bytes: request_id
                    .map(|_| http_response_head_bytes(&response).len()),
                worker_action: "none",
                error: write_result.as_ref().err().map(RequestTotalError::Write),
            });
            return write_result;
        }
    };
    let request_counter = request_id.map(|_| RequestTotalRequest {
        method: request.method.clone(),
        target: request.target.clone(),
        body_bytes: request.body.len(),
    });
    let suppress_body = request.method.eq_ignore_ascii_case("HEAD");
    if should_clear_auto_login_cookie(first_request, &request) {
        let response = clear_auto_login_cookie_response(&request);
        let write_result =
            write_http_response_with_counter(stream, &response, suppress_body, request_id);
        emit_request_total(RequestTotalCounter {
            request_id,
            started_at: request_started_at,
            method: request_counter
                .as_ref()
                .map_or("", |request| request.method.as_str()),
            target: request_counter
                .as_ref()
                .map_or("", |request| request.target.as_str()),
            route_target: "clear_auto_login",
            status: response.status,
            request_body_bytes: request_counter
                .as_ref()
                .map_or(0, |request| request.body_bytes),
            response_body_bytes: request_id.map(|_| response.body.len() as u64),
            response_header_bytes: request_id.map(|_| http_response_head_bytes(&response).len()),
            worker_action: "none",
            error: write_result.as_ref().err().map(RequestTotalError::Write),
        });
        write_result
    } else {
        let handled = match handle_http_request(
            request,
            mounts,
            worker_pool,
            port,
            debug,
            symlink_policy_from_follow(follow_symlinks),
            request_id,
        ) {
            Ok(handled) => handled,
            Err(error) => {
                // Count the boundary without changing the existing no-response failure path.
                emit_request_total(request_error_total_counter(
                    request_id,
                    request_started_at,
                    request_counter.as_ref(),
                    &error,
                ));
                return Err(error);
            }
        };
        let (response_status, response_body_bytes, response_header_bytes) = request_id
            .map(|_| server_response_counter_stats(&handled.response))
            .unwrap_or((0, None, None));
        let write_result = write_server_http_response_with_counter(
            stream,
            &handled.response,
            suppress_body,
            request_id,
        );
        emit_request_total(RequestTotalCounter {
            request_id,
            started_at: request_started_at,
            method: request_counter
                .as_ref()
                .map_or("", |request| request.method.as_str()),
            target: request_counter
                .as_ref()
                .map_or("", |request| request.target.as_str()),
            route_target: handled.route_target,
            status: response_status,
            request_body_bytes: request_counter
                .as_ref()
                .map_or(0, |request| request.body_bytes),
            response_body_bytes,
            response_header_bytes,
            worker_action: handled.worker_action,
            error: write_result.as_ref().err().map(RequestTotalError::Write),
        });
        write_result
    }
}

fn should_clear_auto_login_cookie(first_request: &AtomicBool, request: &HttpRequest) -> bool {
    first_request.swap(false, Ordering::SeqCst) && request_has_auto_login_cookie(request)
}

fn request_has_auto_login_cookie(request: &HttpRequest) -> bool {
    header_value(&request.headers, "cookie").is_some_and(|cookies| {
        cookies
            .split(';')
            .any(|cookie| cookie.trim_start().starts_with(AUTO_LOGIN_COOKIE_NAME))
    })
}

fn clear_auto_login_cookie_response(request: &HttpRequest) -> HttpResponse {
    HttpResponse {
        status: 302,
        headers: vec![
            ("Content-Type".to_string(), "text/plain".to_string()),
            ("Location".to_string(), request.target.clone()),
            (
                "Set-Cookie".to_string(),
                CLEAR_AUTO_LOGIN_COOKIE.to_string(),
            ),
        ],
        body: Vec::new(),
    }
}

fn http_error_response(status: u16, message: &str) -> HttpResponse {
    HttpResponse {
        status,
        headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
        body: format!("{message}\n").into_bytes(),
    }
}

struct RequestTotalRequest {
    method: String,
    target: String,
    body_bytes: usize,
}

struct RequestTotalCounter<'a> {
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    method: &'a str,
    target: &'a str,
    route_target: &'static str,
    status: u16,
    request_body_bytes: usize,
    response_body_bytes: Option<u64>,
    response_header_bytes: Option<usize>,
    worker_action: &'static str,
    error: Option<RequestTotalError<'a>>,
}

#[derive(Clone, Copy)]
enum RequestTotalError<'a> {
    Handle(&'a CliError),
    Write(&'a CliError),
}

impl<'a> RequestTotalError<'a> {
    fn field_name(self) -> &'static str {
        match self {
            RequestTotalError::Handle(_) => "request_error",
            RequestTotalError::Write(_) => "write_error",
        }
    }

    fn error(self) -> &'a CliError {
        match self {
            RequestTotalError::Handle(error) | RequestTotalError::Write(error) => error,
        }
    }
}

fn request_error_total_counter<'a>(
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    request: Option<&'a RequestTotalRequest>,
    error: &'a CliError,
) -> RequestTotalCounter<'a> {
    RequestTotalCounter {
        request_id,
        started_at,
        method: request.map_or("", |request| request.method.as_str()),
        target: request.map_or("", |request| request.target.as_str()),
        route_target: "handle_error",
        status: 0,
        request_body_bytes: request.map_or(0, |request| request.body_bytes),
        response_body_bytes: None,
        response_header_bytes: None,
        worker_action: "none",
        error: Some(RequestTotalError::Handle(error)),
    }
}

fn emit_request_total(counter: RequestTotalCounter<'_>) {
    let Some(started_at) = counter.started_at else {
        return;
    };
    let Some(fields) =
        request_total_fields(counter, route_counters::elapsed_us(started_at.elapsed()))
    else {
        return;
    };
    route_counters::emit("request.total.boundary", &fields);
}

fn request_total_fields(
    counter: RequestTotalCounter<'_>,
    total_elapsed_us: u128,
) -> Option<Vec<Field>> {
    let RequestTotalCounter {
        request_id,
        started_at: _,
        method,
        target,
        route_target,
        status,
        request_body_bytes,
        response_body_bytes,
        response_header_bytes,
        worker_action,
        error,
    } = counter;
    let request_id = request_id?;
    let mut fields = route_counters::request_fields(request_id, method, target);
    fields.extend([
        Field::new("status", status),
        Field::new("route_target", route_target),
        Field::new("total_elapsed_us", total_elapsed_us),
        Field::new("body_bytes", request_body_bytes),
        Field::new(
            "response_body_bytes",
            response_body_bytes
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
        ),
        Field::new(
            "header_bytes",
            response_header_bytes
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
        ),
        Field::new("worker_action", worker_action),
        Field::new("result", if error.is_some() { "error" } else { "ok" }),
    ]);
    if let Some(error) = error {
        fields.push(Field::new(error.field_name(), error.error()));
    }
    Some(fields)
}

fn server_response_counter_stats(
    response: &ServerHttpResponse,
) -> (u16, Option<u64>, Option<usize>) {
    match response {
        ServerHttpResponse::Buffered(response) => (
            response.status,
            Some(response.body.len() as u64),
            Some(http_response_head_bytes(response).len()),
        ),
        ServerHttpResponse::StaticFile(host_path) => {
            let body_len = host_path.metadata().ok().map(|metadata| metadata.len());
            let head_bytes = body_len.map(|body_len| {
                let response = HttpResponse {
                    status: 200,
                    headers: vec![(
                        "Content-Type".to_string(),
                        content_type_for_path(host_path).to_string(),
                    )],
                    body: Vec::new(),
                };
                http_response_head_bytes_with_body_len(&response, body_len).len()
            });
            (200, body_len, head_bytes)
        }
    }
}

fn worker_after_request_label(worker_after_request: &WorkerAfterRequest) -> &'static str {
    match worker_after_request {
        WorkerAfterRequest::Keep => "keep",
        WorkerAfterRequest::Recycle { force, .. } if *force => "recycle_force",
        WorkerAfterRequest::Recycle { .. } => "recycle",
        WorkerAfterRequest::Retire => "retire",
    }
}

fn emit_php_request_build_counter(
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    php_request: &PhpRequest,
    request_header_count: usize,
    request_header_bytes: usize,
) {
    let (Some(request_id), Some(started_at)) = (request_id, started_at) else {
        return;
    };
    let server_bytes = php_request
        .server_entries
        .iter()
        .map(|(key, value)| key.len() + value.len())
        .sum::<usize>();
    let env_bytes = php_request
        .env
        .iter()
        .map(|(key, value)| key.len() + value.len())
        .sum::<usize>();
    let mut fields =
        route_counters::request_fields(request_id, &php_request.method, &php_request.request_uri);
    fields.extend([
        Field::new(
            "elapsed_us",
            route_counters::elapsed_us(started_at.elapsed()),
        ),
        Field::new("script_path", &php_request.script_path),
        Field::new("server_entries", php_request.server_entries.len()),
        Field::new("env_entries", php_request.env.len()),
        Field::new("header_entries", request_header_count),
        Field::new("header_bytes", request_header_bytes),
        Field::new("env_bytes", env_bytes),
        Field::new("server_bytes", server_bytes),
        Field::new(
            "cookie_bytes",
            php_request.cookies.as_ref().map_or(0, |value| value.len()),
        ),
        Field::new(
            "content_type_bytes",
            php_request
                .content_type
                .as_ref()
                .map_or(0, |value| value.len()),
        ),
        Field::new("body_bytes", php_request.body.len()),
    ]);
    route_counters::emit("php_request.build", &fields);
}

struct ResponseConvertCounter<'a> {
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    method: &'a str,
    target: &'a str,
    raw_header_bytes: usize,
    parsed_header_count: usize,
    status: u16,
    stdout_body_bytes: usize,
    stderr_bytes: usize,
}

fn emit_response_convert_counter(counter: ResponseConvertCounter<'_>) {
    let ResponseConvertCounter {
        request_id,
        started_at,
        method,
        target,
        raw_header_bytes,
        parsed_header_count,
        status,
        stdout_body_bytes,
        stderr_bytes,
    } = counter;
    let (Some(request_id), Some(started_at)) = (request_id, started_at) else {
        return;
    };
    let mut fields = route_counters::request_fields(request_id, method, target);
    fields.extend([
        Field::new(
            "convert_elapsed_us",
            route_counters::elapsed_us(started_at.elapsed()),
        ),
        Field::new("raw_header_bytes", raw_header_bytes),
        Field::new("parsed_header_count", parsed_header_count),
        Field::new("status", status),
        Field::new("stdout_body_bytes", stdout_body_bytes),
        Field::new("stderr_bytes", stderr_bytes),
    ]);
    route_counters::emit("response.convert", &fields);
}

fn handle_http_request(
    request: HttpRequest,
    mounts: &[Mount],
    worker_pool: &WorkerPool,
    port: u16,
    debug: bool,
    symlink_policy: SymlinkPolicy,
    request_id: Option<RequestId>,
) -> Result<HandledHttpResponse> {
    let route_context = request_id.map(|request_id| RouteCounterContext {
        request_id,
        method: &request.method,
        target: &request.target,
        symlink_policy,
    });
    let route_started_at = route_context.map(|_| Instant::now());
    let route_result = resolve_route_with_symlink_policy_with_counters(
        mounts,
        &request.target,
        symlink_policy,
        route_context,
    );
    emit_route_resolve_total(route_context, route_started_at, route_result.as_ref());
    let route = match route_result {
        Ok(route) => route,
        Err(_) => {
            return Ok(HandledHttpResponse {
                response: ServerHttpResponse::Buffered(http_error_response(400, "Bad Request")),
                route_target: "bad_request",
                worker_action: "none",
            })
        }
    };
    let route_target = route_target_label(&route);
    match route {
        RouteTarget::Php {
            vfs_path,
            path_info,
        } => {
            let request_target = request.target.clone();
            let mut worker = worker_pool.acquire()?;
            let mut php_worker = worker
                .worker()
                .lock()
                .map_err(|_| CliError::new("PHP worker lock was poisoned"))?;
            let response = handle_php_route_request(
                request,
                php_worker.php_mut()?,
                port,
                &vfs_path,
                path_info.as_deref(),
                debug,
                request_id,
            )?;
            let log_memory_stats = env_flag("WP_PLAYGROUND_NATIVE_MEMORY_STATS");
            let memory_stats = if log_memory_stats {
                Some(php_worker.php_mut()?.memory_stats())
            } else {
                None
            };
            let wasm_memory_size_bytes = memory_stats
                .as_ref()
                .and_then(|stats| stats.as_ref().ok())
                .map(|stats| stats.memory_size_bytes)
                .or_else(|| {
                    worker_pool
                        .recycle_wasm_memory_threshold()
                        .and_then(|_| php_worker.php_mut().ok()?.memory_size_bytes().ok())
                });
            let worker_after_request =
                worker_pool.mark_request_finished(&mut php_worker, wasm_memory_size_bytes)?;
            let worker_action = if request_id.is_some() {
                worker_after_request_label(&worker_after_request)
            } else {
                "none"
            };
            if debug {
                eprintln!(
                    "debug: PHP request {} exited {} after {} host imports across {} workers; recent imports: {}",
                    request_target,
                    response.0,
                    php_worker.php()?.host_import_count(),
                    worker_pool.len(),
                    php_worker.php()?.recent_host_imports(400)
                );
            }
            if log_memory_stats {
                match memory_stats
                    .expect("memory stats are collected when memory stats logging is enabled")
                {
                    Ok(stats) => eprintln!(
                        "memory: target={} wasm={} sbrk_end={} zend={} zend_real={}",
                        request_target,
                        stats.memory_size_bytes,
                        stats
                            .sbrk_end
                            .map(|value| value.to_string())
                            .unwrap_or_else(|| "-".to_string()),
                        stats
                            .zend_memory_usage
                            .map(|value| value.to_string())
                            .unwrap_or_else(|| "-".to_string()),
                        stats
                            .zend_memory_real_usage
                            .map(|value| value.to_string())
                            .unwrap_or_else(|| "-".to_string())
                    ),
                    Err(error) => eprintln!("memory: target={} error={error}", request_target),
                }
            }
            drop(php_worker);
            match worker_after_request {
                WorkerAfterRequest::Keep => {}
                WorkerAfterRequest::Recycle { delay, force } => {
                    worker_pool.schedule_worker_recycle(worker.worker().clone(), delay, force);
                }
                WorkerAfterRequest::Retire => {
                    worker.retire_on_drop();
                }
            }
            Ok(HandledHttpResponse {
                response: ServerHttpResponse::Buffered(response.1),
                route_target,
                worker_action,
            })
        }
        RouteTarget::Static { host_path } => Ok(HandledHttpResponse {
            response: ServerHttpResponse::StaticFile(host_path),
            route_target,
            worker_action: "none",
        }),
        RouteTarget::NotFound => Ok(HandledHttpResponse {
            response: ServerHttpResponse::Buffered(HttpResponse {
                status: 404,
                headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
                body: b"Not Found\n".to_vec(),
            }),
            route_target,
            worker_action: "none",
        }),
    }
}

fn handle_php_route_request(
    request: impl Into<HttpRequest>,
    php: &mut PhpInstance,
    port: u16,
    vfs_path: &str,
    path_info: Option<&str>,
    debug: bool,
    request_id: Option<RequestId>,
) -> Result<(i32, HttpResponse)> {
    let request = request.into();
    let response_counter_request =
        request_id.map(|_| (request.method.clone(), request.target.clone()));
    let php_request =
        php_request_from_http_with_counter(request, vfs_path, path_info, port, request_id);
    let response = php
        .run_sapi_request_with_counter(&php_request, request_id)
        .map_err(|error| {
            if debug {
                CliError::new(format!(
                    "{error}\nrecent host imports: {}",
                    recent_host_imports(php.called_host_imports())
                ))
            } else {
                error
            }
        })?;
    let exit_code = response.exit_code;
    let (method, target) = response_counter_request
        .as_ref()
        .map_or(("", ""), |(method, target)| {
            (method.as_str(), target.as_str())
        });
    Ok((
        exit_code,
        http_response_from_php_with_counter(response, request_id, method, target),
    ))
}

fn php_request_from_http(
    request: impl Into<HttpRequest>,
    script_path: &str,
    path_info: Option<&str>,
    port: u16,
) -> PhpRequest {
    php_request_from_http_with_counter(request, script_path, path_info, port, None)
}

fn php_request_from_http_with_counter(
    request: impl Into<HttpRequest>,
    script_path: &str,
    path_info: Option<&str>,
    port: u16,
    request_id: Option<RequestId>,
) -> PhpRequest {
    let started_at = request_id.map(|_| Instant::now());
    let request = request.into();
    let (request_header_count, request_header_bytes) = if request_id.is_some() {
        (
            request.headers.len(),
            request
                .headers
                .iter()
                .map(|(name, value)| name.len() + value.len())
                .sum::<usize>(),
        )
    } else {
        (0, 0)
    };
    let HttpRequest {
        method,
        target,
        version,
        headers,
        body,
    } = request;
    let host = header_value(&headers, "host")
        .map(str::to_string)
        .unwrap_or_else(|| format!("127.0.0.1:{port}"));
    let mut php_request = PhpRequest::for_script(script_path);
    php_request.request_uri = target.clone();
    php_request.method = method.clone();
    php_request.host = host.clone();
    php_request.port = port as u32;
    php_request.body = body;
    php_request.content_type = header_value(&headers, "content-type").map(str::to_string);
    php_request.cookies = header_value(&headers, "cookie").map(str::to_string);

    let query_string = target.split_once('?').map(|(_, query)| query).unwrap_or("");
    let script_name = script_path
        .strip_prefix("/wordpress")
        .filter(|path| !path.is_empty())
        .unwrap_or(script_path);

    php_request.server_entries.extend([
        ("DOCUMENT_ROOT".to_string(), "/wordpress".to_string()),
        ("SCRIPT_FILENAME".to_string(), script_path.to_string()),
        ("SCRIPT_NAME".to_string(), script_name.to_string()),
        ("REQUEST_METHOD".to_string(), method.clone()),
        ("REQUEST_URI".to_string(), target.clone()),
        ("QUERY_STRING".to_string(), query_string.to_string()),
        ("SERVER_PROTOCOL".to_string(), version.clone()),
        ("SERVER_NAME".to_string(), host_name(&host).to_string()),
        ("SERVER_PORT".to_string(), port.to_string()),
        ("HTTP_HOST".to_string(), host.clone()),
        (
            "HTTPS".to_string(),
            https_server_value("http", port as u32).to_string(),
        ),
    ]);

    php_request.env.extend([
        ("DOCUMENT_ROOT".to_string(), "/wordpress".to_string()),
        ("SCRIPT_FILENAME".to_string(), script_path.to_string()),
        ("SCRIPT_NAME".to_string(), script_name.to_string()),
        ("REQUEST_METHOD".to_string(), method.clone()),
        ("REQUEST_URI".to_string(), target.clone()),
        ("QUERY_STRING".to_string(), query_string.to_string()),
        ("SERVER_PROTOCOL".to_string(), version.clone()),
        ("SERVER_NAME".to_string(), host_name(&host).to_string()),
        ("SERVER_PORT".to_string(), port.to_string()),
        ("HTTP_HOST".to_string(), host.clone()),
        (
            "HTTPS".to_string(),
            https_server_value("http", port as u32).to_string(),
        ),
    ]);

    if let Some(path_info) = path_info {
        php_request
            .server_entries
            .push(("PATH_INFO".to_string(), path_info.to_string()));
        php_request
            .env
            .push(("PATH_INFO".to_string(), path_info.to_string()));
    }

    for (name, value) in &headers {
        let server_name = match name.as_str() {
            "host" => continue,
            "content-type" => "CONTENT_TYPE".to_string(),
            "content-length" => "CONTENT_LENGTH".to_string(),
            _ => format!("HTTP_{}", name.replace('-', "_").to_ascii_uppercase()),
        };
        php_request
            .server_entries
            .push((server_name, value.clone()));
    }

    emit_php_request_build_counter(
        request_id,
        started_at,
        &php_request,
        request_header_count,
        request_header_bytes,
    );
    php_request
}

fn php_request_from_run_options(options: &PhpRunOptions, script_path: &str) -> Result<PhpRequest> {
    let mut headers = options.headers.clone();
    let explicit_host = header_value(&headers, "host").map(str::to_string);
    let host = explicit_host
        .clone()
        .unwrap_or_else(|| "example.com:443".to_string());
    if explicit_host.is_none() {
        headers.push(("host".to_string(), host.clone()));
    }
    let port = if explicit_host.is_some() {
        infer_port_from_host_and_protocol(&host, &options.protocol)?
    } else {
        default_port_for_protocol(&options.protocol)
    };
    let request = HttpRequest {
        method: options.method.clone(),
        target: options.relative_uri.clone(),
        version: "HTTP/1.1".to_string(),
        headers,
        body: options.body.clone(),
    };
    let mut php_request = php_request_from_http(&request, script_path, None, port);

    for (key, value) in &options.server_entries {
        upsert_php_entry(&mut php_request.server_entries, key, value);
    }
    if !php_entry_exists(&options.server_entries, "HTTPS") {
        upsert_php_entry(
            &mut php_request.server_entries,
            "HTTPS",
            https_server_value(&options.protocol, u32::from(port)),
        );
    }
    for (name, value) in &request.headers {
        let server_name = match name.as_str() {
            "host" => "HTTP_HOST".to_string(),
            "content-type" => "CONTENT_TYPE".to_string(),
            "content-length" => "CONTENT_LENGTH".to_string(),
            _ => format!("HTTP_{}", name.replace('-', "_").to_ascii_uppercase()),
        };
        upsert_php_entry(&mut php_request.server_entries, &server_name, value);
    }

    for (key, value) in &options.env {
        upsert_php_entry(&mut php_request.env, key, value);
    }

    Ok(php_request)
}

fn infer_port_from_host_and_protocol(host: &str, protocol: &str) -> Result<u16> {
    if let Some(port) = port_from_host(host) {
        return Ok(port);
    }
    Ok(default_port_for_protocol(protocol))
}

fn default_port_for_protocol(protocol: &str) -> u16 {
    if protocol.eq_ignore_ascii_case("https") {
        443
    } else {
        80
    }
}

fn port_from_host(host: &str) -> Option<u16> {
    let authority = host
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(host)
        .split('/')
        .next()
        .unwrap_or(host)
        .rsplit_once('@')
        .map(|(_, rest)| rest)
        .unwrap_or_else(|| {
            host.split_once("://")
                .map(|(_, rest)| rest)
                .unwrap_or(host)
                .split('/')
                .next()
                .unwrap_or(host)
        });
    if let Some(rest) = authority.strip_prefix('[') {
        let end = rest.find(']')?;
        let after_bracket = &rest[end + 1..];
        return after_bracket
            .strip_prefix(':')
            .and_then(|port| port.parse::<u16>().ok())
            .filter(|port| *port > 0);
    }
    authority
        .rsplit_once(':')
        .and_then(|(_, port)| port.parse::<u16>().ok())
        .filter(|port| *port > 0)
}

fn https_server_value(protocol: &str, port: u32) -> &'static str {
    if protocol.eq_ignore_ascii_case("https") || port == 443 {
        "on"
    } else {
        "off"
    }
}

fn upsert_php_entry(entries: &mut Vec<(String, String)>, key: &str, value: &str) {
    if let Some((_, existing_value)) = entries.iter_mut().find(|(name, _)| name == key) {
        *existing_value = value.to_string();
    } else {
        entries.push((key.to_string(), value.to_string()));
    }
}

fn php_entry_exists(entries: &[(String, String)], key: &str) -> bool {
    entries.iter().any(|(name, _)| name == key)
}

fn http_response_from_php_with_counter(
    response: PhpResponse,
    request_id: Option<RequestId>,
    method: &str,
    target: &str,
) -> HttpResponse {
    let started_at = request_id.map(|_| Instant::now());
    let collect_counter_stats = request_id.is_some();
    let exit_code = response.exit_code;
    let raw_header_bytes = if collect_counter_stats {
        response.headers.len()
    } else {
        0
    };
    let stdout_body_bytes = if collect_counter_stats {
        response.stdout.len()
    } else {
        0
    };
    let stderr_bytes = if collect_counter_stats {
        response.stderr.len()
    } else {
        0
    };
    let mut parsed = parse_php_headers(&response.headers);
    if (200..400).contains(&parsed.status) && exit_code != 0 {
        parsed.status = 500;
    }
    if !parsed
        .headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("content-type"))
    {
        parsed
            .headers
            .push(("Content-Type".to_string(), "text/html".to_string()));
    }
    if !response.stderr.is_empty() {
        parsed.headers.push((
            "X-Php-Stderr".to_string(),
            String::from_utf8_lossy(&response.stderr).replace(['\r', '\n'], " "),
        ));
    }
    parsed.body = response.stdout;
    emit_response_convert_counter(ResponseConvertCounter {
        request_id,
        started_at,
        method,
        target,
        raw_header_bytes,
        parsed_header_count: if collect_counter_stats {
            parsed.headers.len()
        } else {
            0
        },
        status: parsed.status,
        stdout_body_bytes,
        stderr_bytes,
    });
    parsed
}

fn recent_host_imports(imports: &[String]) -> String {
    let recent_start = imports.len().saturating_sub(20);
    imports[recent_start..].join(", ")
}

fn should_boot_wordpress_for_options(options: &CliOptions) -> bool {
    !matches!(
        options.wordpress_install_mode,
        WordPressInstallMode::DoNotAttemptInstalling
    ) && !options.skip_sqlite_setup
}

pub(crate) fn maybe_boot_wordpress_site(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    options: &CliOptions,
) -> Result<()> {
    if !should_boot_wordpress_for_options(options) {
        return Ok(());
    }

    if matches!(
        options.wordpress_install_mode,
        WordPressInstallMode::InstallFromExistingFilesIfNeeded
    ) && wordpress_is_installed(mounts, php, port)?
    {
        return Ok(());
    }

    boot_wordpress_site(mounts, php, port)
}

fn wordpress_is_installed(mounts: &[Mount], php: &mut PhpInstance, port: u16) -> Result<bool> {
    let response = run_staged_startup_script(
        mounts,
        php,
        port,
        0,
        "is-installed",
        r#"<?php
ob_start();
$wp_load = getenv('DOCUMENT_ROOT') . '/wp-load.php';
if (!file_exists($wp_load)) {
    echo '-1';
    exit;
}
require $wp_load;
ob_clean();
echo is_blog_installed() ? '1' : '0';
ob_end_flush();
"#,
    )?;
    if response.exit_code != 0 {
        return Err(CliError::new(format!(
            "Failed to check whether WordPress is installed. Output: {}",
            response_excerpt(&response)
        )));
    }
    Ok(String::from_utf8_lossy(&response.stdout).trim() == "1")
}

pub(crate) fn boot_wordpress_site(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
) -> Result<()> {
    install_wordpress_with_api(mounts, php, port, "password")
}

fn install_wordpress_with_api(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    admin_password: &str,
) -> Result<()> {
    let install_script = format!(
        r#"<?php
ob_start();
define('WP_INSTALLING', true);
$_COOKIE['playground_auto_login_already_happened'] = '1';
require getenv('DOCUMENT_ROOT') . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';

if (!is_blog_installed()) {{
    wp_install(
        'My WordPress Website',
        'admin',
        'admin@localhost.com',
        true,
        '',
        {admin_password},
        'en'
    );
}}

ob_clean();
echo is_blog_installed() ? 'installed' : 'not-installed';
ob_end_flush();
"#,
        admin_password = php_single_quoted_string(admin_password)
    );
    let install_response =
        run_staged_startup_script(mounts, php, port, 0, "install-wordpress", &install_script)?;

    if install_response.exit_code != 0 {
        return Err(CliError::new(format!(
            "Failed to install WordPress before serving requests. Installer output: {}",
            response_excerpt(&install_response)
        )));
    }

    let output = String::from_utf8_lossy(&install_response.stdout);
    if output.trim() != "installed" {
        return Err(CliError::new(format!(
            "WordPress installer did not report a completed install. Installer output: {}",
            response_excerpt(&install_response)
        )));
    }

    let database = host_path_for_vfs_path(mounts, "/wordpress/wp-content/database/.ht.sqlite");
    if database.as_ref().is_some_and(|path| path.is_file()) {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "WordPress installer did not create the SQLite database. Installer output: {}",
            response_excerpt(&install_response)
        )))
    }
}

pub(crate) fn run_startup_steps(
    steps: &[StartupStep],
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    host_options: &mut HostOptions,
) -> Result<()> {
    for (index, step) in steps.iter().enumerate() {
        if let StartupStep::DefineWpConfigConsts {
            constants,
            method: DefineWpConfigMethod::DefineBeforeRun,
        } = step
        {
            merge_defined_constants(&mut host_options.string_constants, constants);
            php.define_constants(constants);
            continue;
        }
        if let StartupStep::EnableMultisite { wp_cli_path } = step {
            run_enable_multisite_startup_step(mounts, php, port, index, wp_cli_path, host_options)?;
            continue;
        }
        if let StartupStep::SetSiteLanguage { language } = step {
            run_set_site_language_startup_step(mounts, php, port, index, language, host_options)?;
            continue;
        }
        if let StartupStep::ImportWxr { file } = step {
            run_import_wxr_startup_step(mounts, php, port, index, file, host_options)?;
            continue;
        }
        if let StartupStep::ImportWordPressFiles { zip, path_in_zip } = step {
            run_import_wordpress_files_startup_step(
                mounts,
                php,
                port,
                index,
                zip,
                path_in_zip,
                host_options,
            )?;
            continue;
        }
        run_startup_step_with_symlink_policy(
            mounts,
            php,
            port,
            index,
            step,
            symlink_policy_from_follow(host_options.follow_symlinks),
        )?;
    }
    Ok(())
}

fn merge_defined_constants(
    target: &mut Vec<(String, PhpConstantValue)>,
    constants: &[(String, PhpConstantValue)],
) {
    for (name, value) in constants {
        if let Some((_, existing)) = target.iter_mut().find(|(existing, _)| existing == name) {
            *existing = value.clone();
        } else {
            target.push((name.clone(), value.clone()));
        }
    }
}

fn auto_login_username(options: &CliOptions, steps: &[StartupStep]) -> Option<String> {
    for step in steps.iter().rev() {
        match step {
            StartupStep::Login { username } => return Some(username.clone()),
            StartupStep::DisableLogin => return None,
            _ => {}
        }
    }
    options.login.then(|| "admin".to_string())
}

pub(crate) fn startup_steps_from_options(options: &CliOptions) -> Result<Vec<StartupStep>> {
    let mut steps = Vec::new();
    if let Some(blueprint) = &options.blueprint {
        steps.extend(startup_steps_from_blueprint_source(
            blueprint,
            options.blueprint_may_read_adjacent_files,
        )?);
    }
    steps.extend(
        options
            .additional_blueprint_steps
            .iter()
            .map(startup_step_from_automount_step)
            .collect::<Result<Vec<_>>>()?,
    );
    Ok(steps)
}

fn startup_steps_from_blueprint_source(
    source: &str,
    may_read_adjacent_files: bool,
) -> Result<Vec<StartupStep>> {
    if source.starts_with("http://") || source.starts_with("https://") {
        let bytes = download_bytes(source)?;
        return startup_steps_from_remote_blueprint_bytes(source, &bytes);
    }

    let source_path = PathBuf::from(source);
    let blueprint_path = if source_path.is_dir() {
        source_path.join("blueprint.json")
    } else {
        source_path
    };
    if !blueprint_path.exists() {
        return Err(CliError::new(format!(
            "Blueprint file does not exist: {}",
            blueprint_path.display()
        )));
    }
    if blueprint_path
        .extension()
        .and_then(|extension| extension.to_str())
        != Some("json")
    {
        if blueprint_path
            .extension()
            .and_then(|extension| extension.to_str())
            == Some("zip")
        {
            let bytes = fs::read(&blueprint_path)?;
            return startup_steps_from_blueprint_zip(&bytes, false);
        }
        return Err(CliError::new(format!(
            "Unsupported Blueprint file extension: {}. Only .zip and .json files are supported by wp-playground-native v1.",
            blueprint_path.display()
        )));
    }

    let text = fs::read_to_string(&blueprint_path)?;
    if may_read_adjacent_files {
        let root = blueprint_path
            .parent()
            .ok_or_else(|| CliError::new("Blueprint file has no parent directory"))?;
        startup_steps_from_blueprint_json_with_context(
            &text,
            BlueprintResourceContext::LocalDirectory { root },
        )
    } else {
        startup_steps_from_blueprint_json_with_context(
            &text,
            BlueprintResourceContext::Standalone {
                may_read_adjacent_files: false,
            },
        )
    }
}

fn startup_steps_from_remote_blueprint_bytes(
    source: &str,
    bytes: &[u8],
) -> Result<Vec<StartupStep>> {
    if let Ok(text) = std::str::from_utf8(bytes) {
        if serde_json::from_str::<serde_json::Value>(text).is_ok() {
            return startup_steps_from_blueprint_json(text, true);
        }
    }
    if looks_like_zip_file(bytes) {
        return startup_steps_from_blueprint_zip(bytes, true);
    }
    Err(CliError::new(format!(
        "Blueprint file at {source} is neither a valid JSON nor a ZIP file."
    )))
}

fn startup_steps_from_blueprint_zip(
    bytes: &[u8],
    allow_single_top_level_dir: bool,
) -> Result<Vec<StartupStep>> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| CliError::new(format!("Failed to read Blueprint ZIP: {error}")))?;
    let blueprint_entry = find_blueprint_json_entry(&mut archive, allow_single_top_level_dir)?;
    let mut entry = archive
        .by_index(blueprint_entry.index)
        .map_err(|error| CliError::new(format!("Failed to read Blueprint ZIP entry: {error}")))?;
    let mut text = String::new();
    entry.read_to_string(&mut text).map_err(|error| {
        CliError::new(format!("Failed to read blueprint.json from ZIP: {error}"))
    })?;
    drop(entry);
    let files = bundled_files_from_blueprint_zip(&mut archive, &blueprint_entry.root_prefix)?;
    startup_steps_from_blueprint_json_with_context(
        &text,
        BlueprintResourceContext::Zip { files: &files },
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BlueprintZipEntry {
    index: usize,
    root_prefix: String,
}

fn find_blueprint_json_entry<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    allow_single_top_level_dir: bool,
) -> Result<BlueprintZipEntry> {
    let mut normalized_paths = Vec::new();
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|error| {
            CliError::new(format!("Failed to read Blueprint ZIP entry: {error}"))
        })?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let normalized = zip_path_to_string(&enclosed_name);
        normalized_paths.push((normalized, index));
    }

    if let Some((_, index)) = normalized_paths
        .iter()
        .find(|(path, _)| path == "blueprint.json")
    {
        return Ok(BlueprintZipEntry {
            index: *index,
            root_prefix: String::new(),
        });
    }

    if !allow_single_top_level_dir {
        return Err(CliError::new(
            "ZIP does not contain a blueprint.json at the root.",
        ));
    }

    let mut top_level_dirs = BTreeSet::new();
    for (path, _) in &normalized_paths {
        let Some((top_level, _rest)) = path.split_once('/') else {
            continue;
        };
        if !top_level.is_empty() && top_level != "__MACOSX" {
            top_level_dirs.insert(top_level.to_string());
        }
    }

    if top_level_dirs.len() > 1 {
        return Err(CliError::new(
            "ZIP contains multiple top-level directories. Bundle ZIPs must contain blueprint.json at the root or inside a single top-level directory.",
        ));
    }
    if let Some(dir) = top_level_dirs.iter().next() {
        let candidate = format!("{dir}/blueprint.json");
        if let Some((_, index)) = normalized_paths.iter().find(|(path, _)| path == &candidate) {
            return Ok(BlueprintZipEntry {
                index: *index,
                root_prefix: format!("{dir}/"),
            });
        }
    }

    Err(CliError::new(
        "ZIP does not contain a blueprint.json. Place blueprint.json at the ZIP root or inside a single top-level directory.",
    ))
}

fn bundled_files_from_blueprint_zip<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    root_prefix: &str,
) -> Result<HashMap<String, Vec<u8>>> {
    let mut files = HashMap::new();
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            CliError::new(format!("Failed to read Blueprint ZIP entry: {error}"))
        })?;
        if entry.is_dir() {
            continue;
        }
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let normalized = zip_path_to_string(&enclosed_name);
        let Some(relative) = normalized.strip_prefix(root_prefix) else {
            continue;
        };
        let Ok(relative) = normalize_bundled_resource_path(relative) else {
            continue;
        };
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).map_err(|error| {
            CliError::new(format!(
                "Failed to read Blueprint ZIP entry {normalized}: {error}"
            ))
        })?;
        files.insert(relative, bytes);
    }
    Ok(files)
}

fn zip_path_to_string(path: &Path) -> String {
    path.iter()
        .map(|component| component.to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn looks_like_zip_file(bytes: &[u8]) -> bool {
    bytes.len() >= 4 && bytes[0] == 0x50 && bytes[1] == 0x4b && bytes[2] == 0x03 && bytes[3] == 0x04
}

fn startup_steps_from_blueprint_json(
    text: &str,
    may_read_adjacent_files: bool,
) -> Result<Vec<StartupStep>> {
    startup_steps_from_blueprint_json_with_context(
        text,
        BlueprintResourceContext::Standalone {
            may_read_adjacent_files,
        },
    )
}

#[derive(Debug, Clone, Copy)]
enum BlueprintResourceContext<'a> {
    Standalone { may_read_adjacent_files: bool },
    LocalDirectory { root: &'a Path },
    Zip { files: &'a HashMap<String, Vec<u8>> },
}

impl BlueprintResourceContext<'_> {
    fn can_read_bundled_files(self) -> bool {
        match self {
            BlueprintResourceContext::Standalone {
                may_read_adjacent_files,
            } => may_read_adjacent_files,
            BlueprintResourceContext::LocalDirectory { .. }
            | BlueprintResourceContext::Zip { .. } => true,
        }
    }
}

fn startup_steps_from_blueprint_json_with_context(
    text: &str,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<Vec<StartupStep>> {
    let blueprint: serde_json::Value = serde_json::from_str(text)
        .map_err(|error| CliError::new(format!("Blueprint JSON is invalid: {error}")))?;
    let object = blueprint
        .as_object()
        .ok_or_else(|| CliError::new("Blueprint JSON must be an object"))?;

    if object.contains_key("resources") && !resource_context.can_read_bundled_files() {
        return Err(CliError::new(
            "Blueprint resources are not supported by wp-playground-native v1 without --blueprint-may-read-adjacent-files.",
        ));
    }

    let mut steps = Vec::new();
    if let Some(site_options) = object.get("siteOptions") {
        let site_options = site_options.as_object().ok_or_else(|| {
            CliError::new("Blueprint siteOptions must be an object in wp-playground-native v1")
        })?;
        steps.push(StartupStep::SetSiteOptions {
            options_json: json_to_string(site_options)?,
        });
    }
    if let Some(login) = object.get("login") {
        steps.insert(0, login_startup_step_from_value(login)?);
    }
    let wp_cli_library_requested = wp_cli_library_requested_from_blueprint(object)?;
    let mut wp_cli_dependency_index = None;
    let mut wordpress_importer_injected = false;
    if let Some(raw_steps) = object.get("steps") {
        let raw_steps = raw_steps.as_array().ok_or_else(|| {
            CliError::new("Blueprint steps must be an array in wp-playground-native v1")
        })?;
        for step in raw_steps {
            if wp_cli_dependency_index.is_none() && step_depends_on_wp_cli(step) {
                wp_cli_dependency_index = Some(steps.len());
                steps.push(default_wp_cli_library_step());
            }
            if !wordpress_importer_injected && step_imports_wxr(step) {
                wordpress_importer_injected = true;
                steps.push(wordpress_importer_install_step());
            }
            steps.push(startup_step_from_blueprint_value(step, resource_context)?);
        }
    }
    if wp_cli_library_requested && wp_cli_dependency_index.is_none() {
        steps.push(default_wp_cli_library_step());
    }
    Ok(steps)
}

fn wp_cli_library_requested_from_blueprint(
    object: &serde_json::Map<String, serde_json::Value>,
) -> Result<bool> {
    let Some(extra_libraries) = object.get("extraLibraries") else {
        return Ok(false);
    };
    let libraries = extra_libraries
        .as_array()
        .ok_or_else(|| CliError::new("Blueprint extraLibraries must be an array"))?;
    let mut requested = false;
    for library in libraries {
        let library = library
            .as_str()
            .ok_or_else(|| CliError::new("Blueprint extraLibraries entries must be strings"))?;
        if library == "wp-cli" {
            requested = true;
        } else {
            return Err(CliError::new(format!(
                "Blueprint extraLibraries entry `{library}` is not supported by wp-playground-native v1 yet."
            )));
        }
    }
    Ok(requested)
}

fn step_depends_on_wp_cli(step: &serde_json::Value) -> bool {
    step.as_object()
        .and_then(|object| object.get("step"))
        .and_then(|step| step.as_str())
        .map(|step| step == "wp-cli" || step == "enableMultisite")
        .unwrap_or(false)
}

fn step_imports_wxr(step: &serde_json::Value) -> bool {
    step.as_object()
        .and_then(|object| object.get("step"))
        .and_then(|step| step.as_str())
        .map(|step| step == "importWxr" || step == "importFile")
        .unwrap_or(false)
}

fn default_wp_cli_library_step() -> StartupStep {
    StartupStep::EnsureWpCli {
        wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
    }
}

fn wordpress_importer_install_step() -> StartupStep {
    let zip_name = directory_zip_name("wordpress-importer");
    StartupStep::InstallPlugin {
        asset: InstallAssetStep {
            source: InstallAssetSource::Download(DownloadableAsset {
                url: format!(
                    "{}/{}",
                    InstallAssetKind::Plugin.wordpress_org_download_base(),
                    zip_name
                ),
                filename: zip_name.clone(),
                cache_key: format!("{}-{zip_name}", InstallAssetKind::Plugin.url_cache_prefix()),
            }),
            target_folder_name: None,
            if_already_installed: IfAlreadyInstalled::Overwrite,
            activate: true,
        },
    }
}

fn startup_step_from_blueprint_value(
    step: &serde_json::Value,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<StartupStep> {
    let object = step
        .as_object()
        .ok_or_else(|| CliError::new("Blueprint step must be an object"))?;
    let step_name = object
        .get("step")
        .and_then(|step| step.as_str())
        .ok_or_else(|| CliError::new("Blueprint step is missing a string `step` field"))?;
    match step_name {
        "activatePlugin" => {
            let plugin_path = object
                .get("pluginPath")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("activatePlugin requires pluginPath"))?;
            Ok(StartupStep::ActivatePlugin {
                plugin_path: plugin_path.to_string(),
            })
        }
        "activateTheme" => {
            let theme_folder_name = object
                .get("themeFolderName")
                .or_else(|| object.get("themeDirectoryName"))
                .and_then(|value| value.as_str())
                .ok_or_else(|| {
                    CliError::new("activateTheme requires themeFolderName or themeDirectoryName")
                })?;
            Ok(StartupStep::ActivateTheme {
                theme_folder_name: theme_folder_name.to_string(),
            })
        }
        "setSiteOptions" => {
            let options = object
                .get("options")
                .and_then(|value| value.as_object())
                .ok_or_else(|| CliError::new("setSiteOptions requires an options object"))?;
            Ok(StartupStep::SetSiteOptions {
                options_json: json_to_string(options)?,
            })
        }
        "updateUserMeta" => {
            let meta = object
                .get("meta")
                .and_then(|value| value.as_object())
                .ok_or_else(|| CliError::new("updateUserMeta requires a meta object"))?;
            let user_id = object
                .get("userId")
                .and_then(|value| value.as_u64())
                .ok_or_else(|| CliError::new("updateUserMeta requires a numeric userId"))?;
            Ok(StartupStep::UpdateUserMeta {
                user_id,
                meta_json: json_to_string(meta)?,
            })
        }
        "resetData" => Ok(StartupStep::ResetData),
        "setSiteLanguage" => {
            let language = object
                .get("language")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("setSiteLanguage requires a string language"))?;
            if language.is_empty() {
                return Err(CliError::new("setSiteLanguage language cannot be empty"));
            }
            Ok(StartupStep::SetSiteLanguage {
                language: language.to_string(),
            })
        }
        "request" => Ok(StartupStep::Request {
            request: startup_http_request_from_blueprint_value(
                object
                    .get("request")
                    .ok_or_else(|| CliError::new("request step requires request"))?,
            )?,
        }),
        "importWxr" => import_wxr_step_from_blueprint_object(object, resource_context),
        "importFile" => {
            eprintln!("{IMPORT_FILE_DEPRECATION_WARNING}");
            import_wxr_step_from_blueprint_object(object, resource_context)
        }
        "importWordPressFiles" => Ok(StartupStep::ImportWordPressFiles {
            zip: file_content_source_from_blueprint_value(
                object.get("wordPressFilesZip").ok_or_else(|| {
                    CliError::new("importWordPressFiles requires wordPressFilesZip")
                })?,
                "importWordPressFiles",
                resource_context,
            )?,
            path_in_zip: import_wordpress_files_path_in_zip_from_value(object.get("pathInZip"))?,
        }),
        "runWpInstallationWizard" => Ok(StartupStep::RunWpInstallationWizard {
            admin_password: wp_installation_options_from_blueprint_value(
                object.get("options").ok_or_else(|| {
                    CliError::new("runWpInstallationWizard requires an options object")
                })?,
            )?,
        }),
        "enableMultisite" => Ok(StartupStep::EnableMultisite {
            wp_cli_path: wp_cli_path_from_blueprint_object(object)?,
        }),
        "wp-cli" => wp_cli_step_from_blueprint_object(object),
        "runPHP" => {
            let code = object
                .get("code")
                .and_then(run_php_code_from_value)
                .ok_or_else(|| CliError::new("runPHP requires code.content or string code"))?;
            Ok(StartupStep::RunPhp { code })
        }
        "runPHPWithOptions" => Ok(StartupStep::RunPhpWithOptions {
            options: php_run_options_from_blueprint_value(
                object
                    .get("options")
                    .ok_or_else(|| CliError::new("runPHPWithOptions requires options"))?,
            )?,
        }),
        "runSql" => Ok(StartupStep::RunSql {
            sql: run_sql_source_from_blueprint_value(
                object
                    .get("sql")
                    .ok_or_else(|| CliError::new("runSql requires sql"))?,
                resource_context,
            )?,
        }),
        "defineWpConfigConsts" => Ok(StartupStep::DefineWpConfigConsts {
            constants: wp_config_constants_from_blueprint_object(object)?,
            method: define_wp_config_method_from_value(object.get("method"))?,
        }),
        "defineSiteUrl" => {
            let site_url = object
                .get("siteUrl")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("defineSiteUrl requires siteUrl"))?;
            if site_url.is_empty() {
                return Err(CliError::new("defineSiteUrl siteUrl cannot be empty"));
            }
            Ok(StartupStep::DefineWpConfigConsts {
                constants: vec![
                    ("WP_HOME".to_string(), PhpConstantValue::string(site_url)),
                    ("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)),
                ],
                method: DefineWpConfigMethod::DefineBeforeRun,
            })
        }
        "writeFile" => Ok(StartupStep::WriteFile {
            path: blueprint_path_field(object, "writeFile", "path")?,
            data: file_content_source_from_blueprint_value(
                object
                    .get("data")
                    .ok_or_else(|| CliError::new("writeFile requires data"))?,
                "writeFile",
                resource_context,
            )?,
        }),
        "writeFiles" => {
            let files_tree = object
                .get("filesTree")
                .ok_or_else(|| CliError::new("writeFiles requires filesTree"))?;
            Ok(StartupStep::WriteFiles {
                write_to_path: blueprint_path_field(object, "writeFiles", "writeToPath")?,
                files: file_tree_from_blueprint_value(files_tree, "writeFiles")?,
            })
        }
        "mkdir" => Ok(StartupStep::Mkdir {
            path: blueprint_path_field(object, "mkdir", "path")?,
        }),
        "rm" => Ok(StartupStep::Rm {
            path: blueprint_path_field(object, "rm", "path")?,
        }),
        "rmdir" => Ok(StartupStep::Rmdir {
            path: blueprint_path_field(object, "rmdir", "path")?,
        }),
        "cp" => Ok(StartupStep::Cp {
            from_path: blueprint_path_field(object, "cp", "fromPath")?,
            to_path: blueprint_path_field(object, "cp", "toPath")?,
        }),
        "mv" => Ok(StartupStep::Mv {
            from_path: blueprint_path_field(object, "mv", "fromPath")?,
            to_path: blueprint_path_field(object, "mv", "toPath")?,
        }),
        "login" => {
            let username = object
                .get("username")
                .map(login_username_string)
                .transpose()?
                .unwrap_or_else(|| "admin".to_string());
            Ok(StartupStep::Login { username })
        }
        "installPlugin" => Ok(StartupStep::InstallPlugin {
            asset: install_asset_step_from_blueprint(
                object,
                InstallAssetKind::Plugin,
                "pluginData",
                "pluginZipFile",
                resource_context,
            )?,
        }),
        "installTheme" => {
            let options = install_options_object(object, InstallAssetKind::Theme.step_name())?;
            Ok(StartupStep::InstallTheme {
                asset: install_asset_step_from_blueprint(
                    object,
                    InstallAssetKind::Theme,
                    "themeData",
                    "themeZipFile",
                    resource_context,
                )?,
                import_starter_content: parse_import_starter_content_option(options)?,
            })
        }
        "unzip" => Ok(StartupStep::Unzip {
            zip: unzip_source_from_blueprint(object, resource_context)?,
            extract_to_path: blueprint_path_field(object, "unzip", "extractToPath")?,
        }),
        unsupported => Err(CliError::new(format!(
            "Blueprint step `{unsupported}` is not supported by wp-playground-native v1 yet."
        ))),
    }
}

fn login_startup_step_from_value(value: &serde_json::Value) -> Result<StartupStep> {
    if let Some(enabled) = value.as_bool() {
        return Ok(if enabled {
            StartupStep::Login {
                username: "admin".to_string(),
            }
        } else {
            StartupStep::DisableLogin
        });
    }
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new("Blueprint login must be a boolean or object"))?;
    let username = object
        .get("username")
        .map(login_username_string)
        .transpose()
        .map(|username| username.unwrap_or_else(|| "admin".to_string()))?;
    Ok(StartupStep::Login { username })
}

fn login_username_string(value: &serde_json::Value) -> Result<String> {
    let username = value
        .as_str()
        .ok_or_else(|| CliError::new("Blueprint login username must be a string"))?;
    if username.is_empty() {
        return Err(CliError::new("Blueprint login username cannot be empty"));
    }
    Ok(username.to_string())
}

fn import_wxr_step_from_blueprint_object(
    object: &serde_json::Map<String, serde_json::Value>,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<StartupStep> {
    if let Some(importer) = object.get("importer") {
        match importer.as_str() {
            Some("default") | Some("data-liberation") => {}
            Some(other) => {
                return Err(CliError::new(format!(
                    "importWxr importer `{other}` is not supported"
                )));
            }
            None => return Err(CliError::new("importWxr importer must be a string")),
        }
    }
    Ok(StartupStep::ImportWxr {
        file: file_content_source_from_blueprint_value(
            object
                .get("file")
                .ok_or_else(|| CliError::new("importWxr requires file"))?,
            "importWxr",
            resource_context,
        )?,
    })
}

fn import_wordpress_files_path_in_zip_from_value(
    value: Option<&serde_json::Value>,
) -> Result<String> {
    let Some(value) = value else {
        return Ok(String::new());
    };
    let path = value
        .as_str()
        .ok_or_else(|| CliError::new("importWordPressFiles pathInZip must be a string"))?;
    let path = path.trim_matches('/');
    if path.is_empty() {
        return Ok(String::new());
    }
    if path.contains(['\0', '\\', ':']) || path.split('/').any(|part| part == "..") {
        return Err(CliError::new(
            "importWordPressFiles pathInZip must be a relative path inside the ZIP",
        ));
    }
    let normalized = normalize_vfs_path(&format!("/{path}")).map_err(|_| {
        CliError::new("importWordPressFiles pathInZip must be a relative path inside the ZIP")
    })?;
    Ok(normalized.trim_start_matches('/').to_string())
}

fn wp_config_constants_from_blueprint_object(
    object: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<(String, PhpConstantValue)>> {
    let consts = object
        .get("consts")
        .and_then(|value| value.as_object())
        .ok_or_else(|| CliError::new("defineWpConfigConsts requires a consts object"))?;
    let mut constants = Vec::new();
    for (name, value) in consts {
        if name.is_empty() || name.contains('\0') {
            return Err(CliError::new(
                "defineWpConfigConsts constant names cannot be empty or contain NUL bytes",
            ));
        }
        constants.push((
            name.clone(),
            wp_config_constant_value_from_json(name, value)?,
        ));
    }
    Ok(constants)
}

fn wp_config_constant_value_from_json(
    name: &str,
    value: &serde_json::Value,
) -> Result<PhpConstantValue> {
    if let Some(value) = value.as_str() {
        return Ok(PhpConstantValue::string(value));
    }
    if let Some(value) = value.as_bool() {
        return Ok(PhpConstantValue::bool(value));
    }
    if value.is_number() {
        return Ok(PhpConstantValue::number(value.to_string()));
    }
    Err(CliError::new(format!(
        "defineWpConfigConsts constant `{name}` must be a string, boolean, or number"
    )))
}

fn define_wp_config_method_from_value(
    value: Option<&serde_json::Value>,
) -> Result<DefineWpConfigMethod> {
    match value.and_then(|value| value.as_str()) {
        None | Some("define-before-run") => Ok(DefineWpConfigMethod::DefineBeforeRun),
        Some("rewrite-wp-config") => Ok(DefineWpConfigMethod::RewriteWpConfig),
        Some(method) => Err(CliError::new(format!(
            "defineWpConfigConsts method `{method}` is not supported"
        ))),
    }
}

fn wp_installation_options_from_blueprint_value(
    value: &serde_json::Value,
) -> Result<Option<String>> {
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new("runWpInstallationWizard options must be an object"))?;
    if let Some(username) = object.get("adminUsername") {
        let username = username.as_str().ok_or_else(|| {
            CliError::new("runWpInstallationWizard options.adminUsername must be a string")
        })?;
        if username.contains('\0') {
            return Err(CliError::new(
                "runWpInstallationWizard options.adminUsername cannot contain NUL bytes",
            ));
        }
    }
    object
        .get("adminPassword")
        .map(|password| {
            let password = password.as_str().ok_or_else(|| {
                CliError::new("runWpInstallationWizard options.adminPassword must be a string")
            })?;
            if password.contains('\0') {
                return Err(CliError::new(
                    "runWpInstallationWizard options.adminPassword cannot contain NUL bytes",
                ));
            }
            Ok((!password.is_empty()).then(|| password.to_string()))
        })
        .transpose()
        .map(Option::flatten)
}

fn wp_cli_step_from_blueprint_object(
    object: &serde_json::Map<String, serde_json::Value>,
) -> Result<StartupStep> {
    let command = object
        .get("command")
        .ok_or_else(|| CliError::new("wp-cli requires command"))?;
    let mut args = wp_cli_command_args_from_value(command)?;
    let command_name = args
        .first()
        .ok_or_else(|| CliError::new("wp-cli command cannot be empty"))?;
    if command_name != "wp" {
        return Err(CliError::new(
            "The first wp-cli command argument must be `wp`.",
        ));
    }
    args.remove(0);
    let mut rewrote_legacy_relative_paths = false;
    for arg in &mut args {
        if arg.starts_with("wordpress/") {
            *arg = format!("/{arg}");
            rewrote_legacy_relative_paths = true;
        }
    }
    if rewrote_legacy_relative_paths {
        eprintln!("{WP_CLI_RELATIVE_PATH_WARNING}");
    }
    let wp_cli_path = wp_cli_path_from_blueprint_object(object)?;
    Ok(StartupStep::WpCli { wp_cli_path, args })
}

fn wp_cli_path_from_blueprint_object(
    object: &serde_json::Map<String, serde_json::Value>,
) -> Result<String> {
    object
        .get("wpCliPath")
        .map(|value| {
            let path = value
                .as_str()
                .ok_or_else(|| CliError::new("wp-cli wpCliPath must be a string"))?;
            if path.is_empty() {
                return Err(CliError::new("wp-cli wpCliPath cannot be empty"));
            }
            normalize_vfs_path(path)
        })
        .transpose()
        .map(|path| path.unwrap_or_else(|| DEFAULT_WP_CLI_PATH.to_string()))
}

fn wp_cli_command_args_from_value(value: &serde_json::Value) -> Result<Vec<String>> {
    if let Some(command) = value.as_str() {
        return Ok(split_shell_command(command.trim()));
    }
    let values = value
        .as_array()
        .ok_or_else(|| CliError::new("wp-cli command must be a string or array of strings"))?;
    values
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_string)
                .ok_or_else(|| CliError::new("wp-cli command array values must be strings"))
        })
        .collect()
}

fn split_shell_command(command: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quote = None;
    let mut chars = command.chars().peekable();
    while let Some(character) = chars.next() {
        if let Some(active_quote) = quote {
            if character == '\\' {
                if let Some(next) = chars.next() {
                    current.push(next);
                }
            } else if character == active_quote {
                quote = None;
            } else {
                current.push(character);
            }
        } else if character == '"' || character == '\'' {
            quote = Some(character);
        } else if character.is_whitespace() {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
        } else {
            current.push(character);
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    parts
}

fn startup_http_request_from_blueprint_value(
    value: &serde_json::Value,
) -> Result<StartupHttpRequest> {
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new("request step request must be an object"))?;
    let url = object
        .get("url")
        .and_then(|value| value.as_str())
        .ok_or_else(|| CliError::new("request step requires request.url"))?;
    if url.contains('\0') {
        return Err(CliError::new("request step url cannot contain NUL bytes"));
    }
    let body_value = object.get("body");
    let form_data_value = object.get("formData");
    if body_value.is_some() && form_data_value.is_some() {
        return Err(CliError::new(
            "request step cannot include both request.body and request.formData",
        ));
    }
    let (body, generated_content_type, prefer_post) =
        startup_request_body_from_value(body_value.or(form_data_value))?;
    let method = startup_request_method_from_value(object.get("method"), prefer_post)?;
    let mut headers = startup_request_headers_from_value(object.get("headers"))?;
    if let Some(content_type) = generated_content_type {
        upsert_php_entry(&mut headers, "content-type", &content_type);
    }
    Ok(StartupHttpRequest {
        method,
        target: startup_request_target_from_url(url)?,
        headers,
        body,
    })
}

fn startup_request_method_from_value(
    value: Option<&serde_json::Value>,
    prefer_post: bool,
) -> Result<String> {
    let method = value
        .map(|value| {
            value
                .as_str()
                .ok_or_else(|| CliError::new("request step method must be a string"))
        })
        .transpose()?
        .map(str::to_ascii_uppercase)
        .unwrap_or_else(|| {
            if prefer_post {
                "POST".to_string()
            } else {
                "GET".to_string()
            }
        });
    if !matches!(
        method.as_str(),
        "GET" | "POST" | "HEAD" | "OPTIONS" | "PATCH" | "PUT" | "DELETE"
    ) {
        return Err(CliError::new(format!(
            "request step method `{method}` is not supported"
        )));
    }
    Ok(method)
}

fn startup_request_target_from_url(url: &str) -> Result<String> {
    if url.trim().is_empty() {
        return Err(CliError::new("request step url cannot be empty"));
    }
    let without_fragment = url.split('#').next().unwrap_or(url);
    let base = reqwest::Url::parse("http://playground.internal/")
        .expect("static Playground base URL is valid");
    let parsed = base.join(without_fragment).map_err(|error| {
        CliError::new(format!("request step url `{url}` is not valid: {error}"))
    })?;
    let mut target = parsed.path().to_string();
    if target.is_empty() {
        target.push('/');
    }
    if let Some(query) = parsed.query() {
        target.push('?');
        target.push_str(query);
    }
    request_path_from_target(&target)?;
    Ok(target)
}

fn startup_request_headers_from_value(
    value: Option<&serde_json::Value>,
) -> Result<Vec<(String, String)>> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new("request step headers must be an object"))?;
    let mut headers = Vec::new();
    for (name, value) in object {
        if name.trim().is_empty() || name.contains(['\0', ':']) {
            return Err(CliError::new(
                "request step header names cannot be empty or contain NUL bytes or colons",
            ));
        }
        let value = value.as_str().ok_or_else(|| {
            CliError::new(format!(
                "request step header `{name}` value must be a string"
            ))
        })?;
        if value.contains('\0') {
            return Err(CliError::new(format!(
                "request step header `{name}` value cannot contain NUL bytes"
            )));
        }
        if name.eq_ignore_ascii_case("host") && value.is_empty() {
            return Err(CliError::new("request step host header cannot be empty"));
        }
        headers.push((name.to_ascii_lowercase(), value.to_string()));
    }
    Ok(headers)
}

fn startup_request_body_from_value(
    value: Option<&serde_json::Value>,
) -> Result<(Vec<u8>, Option<String>, bool)> {
    let Some(value) = value else {
        return Ok((Vec::new(), None, false));
    };
    if let Some(text) = value.as_str() {
        return Ok((text.as_bytes().to_vec(), None, false));
    }
    if json_value_is_uint8array_shape(value) {
        return Ok((
            json_byte_object_to_bytes(value, "request step body")?,
            None,
            false,
        ));
    }
    let object = value.as_object().ok_or_else(|| {
        CliError::new(
            "request step body must be a string, Uint8Array-shaped object, or form object",
        )
    })?;
    let boundary = "----wp-playground-native-form-boundary";
    let mut body = Vec::new();
    for (name, value) in object {
        if name.contains(['\0', '\r', '\n']) {
            return Err(CliError::new(
                "request step form field names cannot contain NUL bytes or newlines",
            ));
        }
        let bytes = if let Some(text) = value.as_str() {
            text.as_bytes().to_vec()
        } else if json_value_is_uint8array_shape(value) {
            json_byte_object_to_bytes(value, "request step form field")?
        } else if value.as_object().is_some_and(|object| {
            object.contains_key("lastModified")
                && object.contains_key("name")
                && object.contains_key("size")
        }) {
            return Err(CliError::new(
                "request step File-valued form fields are not supported by wp-playground-native yet",
            ));
        } else {
            return Err(CliError::new(format!(
                "request step form field `{name}` must be a string or Uint8Array-shaped object"
            )));
        };
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(
            format!(
                "Content-Disposition: form-data; name=\"{}\"\r\n\r\n",
                multipart_quoted(name)
            )
            .as_bytes(),
        );
        body.extend_from_slice(&bytes);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    Ok((
        body,
        Some(format!("multipart/form-data; boundary={boundary}")),
        true,
    ))
}

fn json_value_is_uint8array_shape(value: &serde_json::Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    object
        .get("BYTES_PER_ELEMENT")
        .is_some_and(|value| value.is_number())
        && object.get("buffer").is_some_and(|value| value.is_object())
        && object
            .get("byteLength")
            .or_else(|| object.get("length"))
            .is_some_and(|value| value.is_number())
}

fn multipart_quoted(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "%0D")
        .replace('\n', "%0A")
}

fn php_run_options_from_blueprint_value(value: &serde_json::Value) -> Result<PhpRunOptions> {
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new("runPHPWithOptions options must be an object"))?;
    let code = object
        .get("code")
        .map(|value| {
            value
                .as_str()
                .map(str::to_string)
                .ok_or_else(|| CliError::new("runPHPWithOptions options.code must be a string"))
        })
        .transpose()?;
    let script_path = object
        .get("scriptPath")
        .map(|value| {
            let script_path = value.as_str().ok_or_else(|| {
                CliError::new("runPHPWithOptions options.scriptPath must be a string")
            })?;
            if script_path.is_empty() {
                return Err(CliError::new(
                    "runPHPWithOptions options.scriptPath cannot be empty",
                ));
            }
            normalize_vfs_path(script_path)
        })
        .transpose()?;
    let script = if let Some(code) = code {
        PhpRunScript::Code(code)
    } else if let Some(script_path) = script_path {
        PhpRunScript::ScriptPath(script_path)
    } else {
        return Err(CliError::new(
            "runPHPWithOptions options must include code or scriptPath",
        ));
    };

    Ok(PhpRunOptions {
        script,
        relative_uri: php_run_optional_string(object, "relativeUri")?.unwrap_or_default(),
        protocol: php_run_optional_string(object, "protocol")?
            .unwrap_or_else(|| "http".to_string()),
        method: php_run_method_from_value(object.get("method"))?,
        headers: php_run_headers_from_value(object.get("headers"))?,
        body: object
            .get("body")
            .map(|body| json_literal_contents_to_bytes(body, "runPHPWithOptions body"))
            .transpose()?
            .unwrap_or_default(),
        env: php_run_string_record_from_value(object.get("env"), "env")?,
        server_entries: php_run_string_record_from_value(object.get("$_SERVER"), "$_SERVER")?,
    })
}

fn php_run_optional_string(
    object: &serde_json::Map<String, serde_json::Value>,
    field: &str,
) -> Result<Option<String>> {
    object
        .get(field)
        .map(|value| {
            let value = value.as_str().ok_or_else(|| {
                CliError::new(format!(
                    "runPHPWithOptions options.{field} must be a string"
                ))
            })?;
            if value.contains('\0') {
                return Err(CliError::new(format!(
                    "runPHPWithOptions options.{field} cannot contain NUL bytes"
                )));
            }
            Ok(value.to_string())
        })
        .transpose()
}

fn php_run_method_from_value(value: Option<&serde_json::Value>) -> Result<String> {
    let method = value
        .map(|value| {
            value
                .as_str()
                .ok_or_else(|| CliError::new("runPHPWithOptions options.method must be a string"))
        })
        .transpose()?
        .unwrap_or("GET")
        .to_ascii_uppercase();
    if !matches!(
        method.as_str(),
        "GET" | "POST" | "HEAD" | "OPTIONS" | "PATCH" | "PUT" | "DELETE"
    ) {
        return Err(CliError::new(format!(
            "runPHPWithOptions options.method `{method}` is not supported"
        )));
    }
    Ok(method)
}

fn php_run_headers_from_value(value: Option<&serde_json::Value>) -> Result<Vec<(String, String)>> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new("runPHPWithOptions options.headers must be an object"))?;
    let mut headers = Vec::new();
    for (name, value) in object {
        if name.trim().is_empty() || name.contains(['\0', ':']) {
            return Err(CliError::new(
                "runPHPWithOptions header names cannot be empty or contain NUL bytes or colons",
            ));
        }
        let value = value.as_str().ok_or_else(|| {
            CliError::new(format!(
                "runPHPWithOptions header `{name}` value must be a string"
            ))
        })?;
        if value.contains('\0') {
            return Err(CliError::new(format!(
                "runPHPWithOptions header `{name}` value cannot contain NUL bytes"
            )));
        }
        if name.eq_ignore_ascii_case("host") && value.is_empty() {
            return Err(CliError::new(
                "runPHPWithOptions host header cannot be empty",
            ));
        }
        headers.push((name.to_ascii_lowercase(), value.to_string()));
    }
    Ok(headers)
}

fn php_run_string_record_from_value(
    value: Option<&serde_json::Value>,
    field: &str,
) -> Result<Vec<(String, String)>> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "runPHPWithOptions options.{field} must be an object"
        ))
    })?;
    let mut entries = Vec::new();
    for (name, value) in object {
        if name.is_empty() || name.contains('\0') {
            return Err(CliError::new(format!(
                "runPHPWithOptions options.{field} names cannot be empty or contain NUL bytes"
            )));
        }
        let value = value.as_str().ok_or_else(|| {
            CliError::new(format!(
                "runPHPWithOptions options.{field}.{name} must be a string"
            ))
        })?;
        if value.contains('\0') {
            return Err(CliError::new(format!(
                "runPHPWithOptions options.{field}.{name} cannot contain NUL bytes"
            )));
        }
        entries.push((name.clone(), value.to_string()));
    }
    Ok(entries)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InstallAssetKind {
    Plugin,
    Theme,
}

fn install_asset_step_from_blueprint(
    object: &serde_json::Map<String, serde_json::Value>,
    kind: InstallAssetKind,
    data_field: &str,
    legacy_field: &str,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<InstallAssetStep> {
    let source_value = object
        .get(legacy_field)
        .filter(|value| !value.is_null())
        .or_else(|| object.get(data_field))
        .ok_or_else(|| {
            CliError::new(format!(
                "{} requires {data_field} or {legacy_field}",
                kind.step_name()
            ))
        })?;
    let options = install_options_object(object, kind.step_name())?;

    Ok(InstallAssetStep {
        source: install_asset_source_from_blueprint_resource(source_value, kind, resource_context)?,
        target_folder_name: parse_target_folder_name(options, kind.step_name())?,
        if_already_installed: parse_if_already_installed(object.get("ifAlreadyInstalled"))?,
        activate: parse_activate_option(options, kind.step_name())?,
    })
}

impl InstallAssetKind {
    fn step_name(self) -> &'static str {
        match self {
            InstallAssetKind::Plugin => "installPlugin",
            InstallAssetKind::Theme => "installTheme",
        }
    }

    fn url_cache_prefix(self) -> &'static str {
        match self {
            InstallAssetKind::Plugin => "blueprint-plugin",
            InstallAssetKind::Theme => "blueprint-theme",
        }
    }

    fn wordpress_org_resource(self) -> &'static str {
        match self {
            InstallAssetKind::Plugin => "wordpress.org/plugins",
            InstallAssetKind::Theme => "wordpress.org/themes",
        }
    }

    fn wordpress_org_download_base(self) -> &'static str {
        match self {
            InstallAssetKind::Plugin => "https://downloads.wordpress.org/plugin",
            InstallAssetKind::Theme => "https://downloads.wordpress.org/theme",
        }
    }
}

fn install_options_object<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    step_name: &str,
) -> Result<Option<&'a serde_json::Map<String, serde_json::Value>>> {
    object
        .get("options")
        .map(|options| {
            options.as_object().ok_or_else(|| {
                CliError::new(format!(
                    "{step_name} options must be an object when provided"
                ))
            })
        })
        .transpose()
}

fn parse_activate_option(
    options: Option<&serde_json::Map<String, serde_json::Value>>,
    step_name: &str,
) -> Result<bool> {
    let Some(value) = options.and_then(|options| options.get("activate")) else {
        return Ok(true);
    };
    value
        .as_bool()
        .ok_or_else(|| CliError::new(format!("{step_name} options.activate must be a boolean")))
}

fn parse_import_starter_content_option(
    options: Option<&serde_json::Map<String, serde_json::Value>>,
) -> Result<bool> {
    let Some(value) = options.and_then(|options| options.get("importStarterContent")) else {
        return Ok(false);
    };
    value
        .as_bool()
        .ok_or_else(|| CliError::new("installTheme options.importStarterContent must be a boolean"))
}

fn parse_target_folder_name(
    options: Option<&serde_json::Map<String, serde_json::Value>>,
    step_name: &str,
) -> Result<Option<String>> {
    let Some(value) = options.and_then(|options| options.get("targetFolderName")) else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let folder_name = value.as_str().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} options.targetFolderName must be a string"
        ))
    })?;
    if folder_name.is_empty() {
        return Ok(None);
    }
    validate_asset_folder_name(folder_name)?;
    Ok(Some(folder_name.to_string()))
}

fn parse_if_already_installed(value: Option<&serde_json::Value>) -> Result<IfAlreadyInstalled> {
    let Some(value) = value else {
        return Ok(IfAlreadyInstalled::Overwrite);
    };
    match value.as_str() {
        Some("overwrite") => Ok(IfAlreadyInstalled::Overwrite),
        Some("skip") => Ok(IfAlreadyInstalled::Skip),
        Some("error") => Ok(IfAlreadyInstalled::Error),
        Some(other) => Err(CliError::new(format!(
            "Unsupported ifAlreadyInstalled value `{other}`. Expected overwrite, skip, or error."
        ))),
        None => Err(CliError::new(
            "ifAlreadyInstalled must be one of overwrite, skip, or error",
        )),
    }
}

fn install_asset_source_from_blueprint_resource(
    value: &serde_json::Value,
    kind: InstallAssetKind,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<InstallAssetSource> {
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{} only supports downloadable resource objects in wp-playground-native v1",
            kind.step_name()
        ))
    })?;
    let resource = object
        .get("resource")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            CliError::new(format!(
                "{} resource must include a string resource field",
                kind.step_name()
            ))
        })?;

    match resource {
        "url" => {
            let url = object
                .get("url")
                .and_then(|value| value.as_str())
                .ok_or_else(|| {
                    CliError::new(format!("{} url resource requires url", kind.step_name()))
                })?;
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err(CliError::new(format!(
                    "{} url resource must use http:// or https://",
                    kind.step_name()
                )));
            }
            let filename = filename_from_url(url);
            if kind == InstallAssetKind::Plugin && is_php_plugin_file_name(&filename) {
                return Ok(InstallAssetSource::Content {
                    source: FileContentSource::Url(url.to_string()),
                    filename,
                });
            }
            Ok(InstallAssetSource::Download(DownloadableAsset {
                url: url.to_string(),
                filename,
                cache_key: url_cache_key(kind.url_cache_prefix(), url, ".zip"),
            }))
        }
        "literal" if kind == InstallAssetKind::Plugin => {
            let filename = object
                .get("name")
                .and_then(|value| value.as_str())
                .filter(|name| !name.is_empty())
                .ok_or_else(|| CliError::new("installPlugin literal resource requires name"))?;
            if !is_php_plugin_file_name(filename) {
                return Err(CliError::new(
                    "installPlugin literal file resources must use a .php filename",
                ));
            }
            let contents = object
                .get("contents")
                .ok_or_else(|| CliError::new("installPlugin literal resource requires contents"))?;
            Ok(InstallAssetSource::Content {
                source: FileContentSource::Bytes(json_literal_contents_to_bytes(
                    contents,
                    kind.step_name(),
                )?),
                filename: filename.to_string(),
            })
        }
        "vfs" if kind == InstallAssetKind::Plugin => {
            let path = object
                .get("path")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("installPlugin vfs resource requires path"))?;
            let filename = bundled_resource_filename(path);
            if !is_php_plugin_file_name(&filename) {
                return Err(CliError::new(
                    "installPlugin vfs file resources must use a .php filename",
                ));
            }
            Ok(InstallAssetSource::Content {
                source: FileContentSource::VfsPath(normalize_blueprint_step_path(path)?),
                filename,
            })
        }
        resource if resource == kind.wordpress_org_resource() => {
            let slug = object
                .get("slug")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new(format!("{resource} resource requires slug")))?;
            if slug.is_empty() {
                return Err(CliError::new(format!("{resource} resource requires slug")));
            }
            let zip_name = directory_zip_name(slug);
            Ok(InstallAssetSource::Download(DownloadableAsset {
                url: format!("{}/{}", kind.wordpress_org_download_base(), zip_name),
                filename: zip_name.clone(),
                cache_key: format!("{}-{zip_name}", kind.url_cache_prefix()),
            }))
        }
        "bundled" => {
            let resource_path = object
                .get("path")
                .and_then(|value| value.as_str())
                .ok_or_else(|| {
                    CliError::new(format!(
                        "{} bundled resource requires path",
                        kind.step_name()
                    ))
                })?;
            bundled_install_asset_source(resource_path, kind, resource_context)
        }
        "git:directory" => {
            let resource = git_directory_from_blueprint_object(object, kind.step_name())?;
            Ok(InstallAssetSource::Content {
                filename: format!("{}.zip", resource.filename()),
                source: FileContentSource::ZipWrappedGitDirectory(resource),
            })
        }
        "zip" => Ok(InstallAssetSource::Content {
            source: zip_file_content_source_from_blueprint_object(
                object,
                kind.step_name(),
                resource_context,
            )?,
            filename: zip_wrapper_filename(object, kind.step_name())?,
        }),
        unsupported => Err(CliError::new(format!(
            "{} resource `{unsupported}` is not supported by wp-playground-native v1 yet.",
            kind.step_name()
        ))),
    }
}

fn unzip_source_from_blueprint(
    object: &serde_json::Map<String, serde_json::Value>,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<FileContentSource> {
    if let Some(zip_path) = object.get("zipPath") {
        let zip_path = zip_path
            .as_str()
            .ok_or_else(|| CliError::new("unzip zipPath must be a string"))?;
        return Ok(FileContentSource::VfsPath(normalize_blueprint_step_path(
            zip_path,
        )?));
    }
    let zip_file = object
        .get("zipFile")
        .ok_or_else(|| CliError::new("unzip requires zipFile or zipPath"))?;
    if zip_file.as_str().is_some() {
        return Ok(FileContentSource::VfsPath(normalize_blueprint_step_path(
            zip_file.as_str().unwrap(),
        )?));
    }
    file_content_source_from_blueprint_value(zip_file, "unzip", resource_context)
}

fn bundled_install_asset_source(
    resource_path: &str,
    kind: InstallAssetKind,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<InstallAssetSource> {
    let normalized_path = normalize_bundled_resource_path(resource_path)?;
    let filename = bundled_resource_filename(&normalized_path);
    match resource_context {
        BlueprintResourceContext::LocalDirectory { root } => {
            let path = resolve_adjacent_bundled_file(root, &normalized_path, kind.step_name())?;
            Ok(InstallAssetSource::LocalFile { path, filename })
        }
        BlueprintResourceContext::Zip { files } => {
            let bytes = files.get(&normalized_path).ok_or_else(|| {
                CliError::new(format!(
                    "{} bundled resource path `{resource_path}` was not found in the Blueprint ZIP.",
                    kind.step_name()
                ))
            })?;
            Ok(InstallAssetSource::BundledFile {
                bytes: bytes.clone(),
                filename,
            })
        }
        BlueprintResourceContext::Standalone {
            may_read_adjacent_files,
        } => {
            if may_read_adjacent_files {
                Err(CliError::new(format!(
                    "{} bundled resource path `{resource_path}` requires a Blueprint directory or ZIP bundle.",
                    kind.step_name()
                )))
            } else {
                Err(CliError::new(format!(
                    "{} bundled resource path `{resource_path}` requires --blueprint-may-read-adjacent-files for local JSON Blueprints or a Blueprint ZIP bundle.",
                    kind.step_name()
                )))
            }
        }
    }
}

fn directory_zip_name(slug: &str) -> String {
    if slug.ends_with(".zip") {
        slug.to_string()
    } else {
        format!("{slug}.latest-stable.zip")
    }
}

fn filename_from_url(url: &str) -> String {
    let without_fragment = url.split_once('#').map(|(url, _)| url).unwrap_or(url);
    let without_query = without_fragment
        .split_once('?')
        .map(|(url, _)| url)
        .unwrap_or(without_fragment);
    without_query
        .rsplit('/')
        .find(|part| !part.is_empty())
        .unwrap_or("asset.zip")
        .to_string()
}

fn is_php_plugin_file_name(filename: &str) -> bool {
    filename
        .rsplit(['/', '\\'])
        .next()
        .is_some_and(|name| name.to_ascii_lowercase().ends_with(".php"))
}

fn normalize_bundled_resource_path(path: &str) -> Result<String> {
    if path.is_empty() || path.contains('\0') {
        return Err(CliError::new("Bundled resource path cannot be empty"));
    }
    let normalized = path.replace('\\', "/");
    let mut parts = Vec::new();
    for part in normalized.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                return Err(CliError::new(format!(
                    "Bundled resource path `{path}` cannot escape the Blueprint bundle."
                )));
            }
            part => parts.push(part),
        }
    }
    if parts.is_empty() {
        return Err(CliError::new("Bundled resource path cannot be empty"));
    }
    Ok(parts.join("/"))
}

fn bundled_resource_filename(path: &str) -> String {
    path.rsplit('/')
        .find(|part| !part.is_empty())
        .unwrap_or("asset.zip")
        .to_string()
}

fn resolve_adjacent_bundled_file(root: &Path, path: &str, step_name: &str) -> Result<PathBuf> {
    let canonical_root = fs::canonicalize(root).map_err(|error| {
        CliError::new(format!(
            "Failed to inspect Blueprint directory {}: {error}",
            root.display()
        ))
    })?;
    let candidate = path.split('/').filter(|part| !part.is_empty()).fold(
        canonical_root.clone(),
        |mut current, part| {
            current.push(part);
            current
        },
    );
    let canonical_candidate = fs::canonicalize(&candidate).map_err(|error| {
        CliError::new(format!(
            "{step_name} bundled resource path `{path}` could not be read: {error}"
        ))
    })?;
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(CliError::new(format!(
            "{step_name} bundled resource path `{path}` escapes the Blueprint directory."
        )));
    }
    if !canonical_candidate.is_file() {
        return Err(CliError::new(format!(
            "{step_name} bundled resource path `{path}` is not a file."
        )));
    }
    Ok(canonical_candidate)
}

fn blueprint_path_field(
    object: &serde_json::Map<String, serde_json::Value>,
    step_name: &str,
    field: &str,
) -> Result<String> {
    let path = object
        .get(field)
        .and_then(|value| value.as_str())
        .ok_or_else(|| CliError::new(format!("{step_name} requires {field}")))?;
    normalize_blueprint_step_path(path)
}

fn normalize_blueprint_step_path(path: &str) -> Result<String> {
    let absolute_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };
    normalize_vfs_path(&absolute_path)
}

fn file_content_source_from_blueprint_value(
    value: &serde_json::Value,
    step_name: &str,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<FileContentSource> {
    if let Some(text) = value.as_str() {
        return Ok(FileContentSource::Bytes(text.as_bytes().to_vec()));
    }

    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} data must be a string, Uint8Array-shaped object, or file resource object"
        ))
    })?;

    if object.contains_key("BYTES_PER_ELEMENT") || object.contains_key("byteLength") {
        return Ok(FileContentSource::Bytes(json_byte_object_to_bytes(
            value, step_name,
        )?));
    }

    let resource = object
        .get("resource")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            CliError::new(format!(
                "{step_name} resource must include a string resource field"
            ))
        })?;

    match resource {
        "literal" => {
            let contents = object.get("contents").ok_or_else(|| {
                CliError::new(format!("{step_name} literal resource requires contents"))
            })?;
            Ok(FileContentSource::Bytes(json_literal_contents_to_bytes(
                contents, step_name,
            )?))
        }
        "url" => {
            let url = object
                .get("url")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new(format!("{step_name} url resource requires url")))?;
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err(CliError::new(format!(
                    "{step_name} url resource must use http:// or https://"
                )));
            }
            Ok(FileContentSource::Url(url.to_string()))
        }
        "vfs" => {
            let path = object
                .get("path")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new(format!("{step_name} vfs resource requires path")))?;
            Ok(FileContentSource::VfsPath(normalize_blueprint_step_path(
                path,
            )?))
        }
        "bundled" => {
            let path = object
                .get("path")
                .and_then(|value| value.as_str())
                .ok_or_else(|| {
                    CliError::new(format!("{step_name} bundled resource requires path"))
                })?;
            bundled_file_content_source(path, step_name, resource_context)
        }
        "zip" => zip_file_content_source_from_blueprint_object(object, step_name, resource_context),
        "wordpress.org/plugins" => {
            let slug = object
                .get("slug")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("wordpress.org/plugins resource requires slug"))?;
            if slug.is_empty() {
                return Err(CliError::new(
                    "wordpress.org/plugins resource requires slug",
                ));
            }
            Ok(FileContentSource::Url(format!(
                "{}/{}",
                InstallAssetKind::Plugin.wordpress_org_download_base(),
                directory_zip_name(slug)
            )))
        }
        "wordpress.org/themes" => {
            let slug = object
                .get("slug")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("wordpress.org/themes resource requires slug"))?;
            if slug.is_empty() {
                return Err(CliError::new("wordpress.org/themes resource requires slug"));
            }
            Ok(FileContentSource::Url(format!(
                "{}/{}",
                InstallAssetKind::Theme.wordpress_org_download_base(),
                directory_zip_name(slug)
            )))
        }
        unsupported => Err(CliError::new(format!(
            "{step_name} resource `{unsupported}` is not supported by wp-playground-native v1 yet."
        ))),
    }
}

fn zip_file_content_source_from_blueprint_object(
    object: &serde_json::Map<String, serde_json::Value>,
    step_name: &str,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<FileContentSource> {
    let inner = object
        .get("inner")
        .ok_or_else(|| CliError::new(format!("{step_name} zip resource requires inner")))?;
    let inner_object = inner.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} zip resource inner must be a resource object"
        ))
    })?;
    match inner_object
        .get("resource")
        .and_then(|value| value.as_str())
    {
        Some("literal:directory") => {
            let (name, files) = literal_directory_from_blueprint_value(inner, step_name)?;
            Ok(FileContentSource::ZipWrappedDirectory { name, files })
        }
        Some("git:directory") => Ok(FileContentSource::ZipWrappedGitDirectory(
            git_directory_from_blueprint_object(inner_object, step_name)?,
        )),
        Some(_) => Ok(FileContentSource::ZipWrappedFile {
            inner: Box::new(file_content_source_from_blueprint_value(
                inner,
                step_name,
                resource_context,
            )?),
            filename: zip_inner_file_name(inner, step_name)?,
        }),
        None => Err(CliError::new(format!(
            "{step_name} zip resource inner must include a string resource field"
        ))),
    }
}

fn zip_wrapper_filename(
    object: &serde_json::Map<String, serde_json::Value>,
    step_name: &str,
) -> Result<String> {
    if let Some(name) = object.get("name") {
        let name = name
            .as_str()
            .ok_or_else(|| CliError::new(format!("{step_name} zip name must be a string")))?;
        if name.is_empty() {
            return Err(CliError::new(format!(
                "{step_name} zip name cannot be empty"
            )));
        }
        return Ok(name.to_string());
    }
    let inner = object
        .get("inner")
        .ok_or_else(|| CliError::new(format!("{step_name} zip resource requires inner")))?;
    let inner_name = resource_reference_name(inner, step_name)?;
    if inner_name.ends_with(".zip") {
        Ok(inner_name)
    } else {
        Ok(format!("{inner_name}.zip"))
    }
}

fn zip_inner_file_name(value: &serde_json::Value, step_name: &str) -> Result<String> {
    let name = resource_reference_name(value, step_name)?;
    normalize_file_tree_relative_path(&name, step_name)
}

fn resource_reference_name(value: &serde_json::Value, step_name: &str) -> Result<String> {
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} resource name source must be a resource object"
        ))
    })?;
    let resource = object
        .get("resource")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            CliError::new(format!(
                "{step_name} resource name source must include a string resource field"
            ))
        })?;
    match resource {
        "literal" => object
            .get("name")
            .and_then(|value| value.as_str())
            .filter(|name| !name.is_empty())
            .map(str::to_string)
            .ok_or_else(|| CliError::new(format!("{step_name} literal resource requires name"))),
        "url" => {
            let url = object
                .get("url")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new(format!("{step_name} url resource requires url")))?;
            Ok(filename_from_url(url))
        }
        "vfs" => {
            let path = object
                .get("path")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new(format!("{step_name} vfs resource requires path")))?;
            Ok(bundled_resource_filename(path))
        }
        "bundled" => {
            let path = object
                .get("path")
                .and_then(|value| value.as_str())
                .ok_or_else(|| {
                    CliError::new(format!("{step_name} bundled resource requires path"))
                })?;
            Ok(bundled_resource_filename(path))
        }
        "wordpress.org/plugins" => {
            let slug = object
                .get("slug")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("wordpress.org/plugins resource requires slug"))?;
            if slug.is_empty() {
                return Err(CliError::new(
                    "wordpress.org/plugins resource requires slug",
                ));
            }
            Ok(directory_zip_name(slug))
        }
        "wordpress.org/themes" => {
            let slug = object
                .get("slug")
                .and_then(|value| value.as_str())
                .ok_or_else(|| CliError::new("wordpress.org/themes resource requires slug"))?;
            if slug.is_empty() {
                return Err(CliError::new("wordpress.org/themes resource requires slug"));
            }
            Ok(directory_zip_name(slug))
        }
        "literal:directory" => object
            .get("name")
            .and_then(|value| value.as_str())
            .filter(|name| !name.is_empty())
            .map(str::to_string)
            .ok_or_else(|| {
                CliError::new(format!(
                    "{step_name} literal:directory resource requires name"
                ))
            }),
        "zip" => zip_wrapper_filename(object, step_name),
        "git:directory" => git_directory_from_blueprint_object(object, step_name)
            .map(|resource| resource.filename()),
        unsupported => Err(CliError::new(format!(
            "{step_name} resource `{unsupported}` is not supported by wp-playground-native v1 yet."
        ))),
    }
}

fn run_sql_source_from_blueprint_value(
    value: &serde_json::Value,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<FileContentSource> {
    if value.as_str().is_some()
        || value
            .as_object()
            .is_some_and(|object| object.contains_key("BYTES_PER_ELEMENT"))
    {
        return Err(CliError::new(
            "runSql sql must be a file resource object, such as a literal, bundled, url, or vfs resource",
        ));
    }
    file_content_source_from_blueprint_value(value, "runSql", resource_context)
}

fn file_tree_from_blueprint_value(
    value: &serde_json::Value,
    step_name: &str,
) -> Result<FileTreeSource> {
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} filesTree must be a literal:directory resource object"
        ))
    })?;
    match object.get("resource").and_then(|value| value.as_str()) {
        Some("literal:directory") => literal_directory_from_blueprint_value(value, step_name)
            .map(|(_, files)| FileTreeSource::Literal(files)),
        Some("git:directory") => {
            git_directory_from_blueprint_object(object, step_name).map(FileTreeSource::Git)
        }
        Some(resource) => Err(CliError::new(format!(
            "{step_name} filesTree resource `{resource}` is not supported by wp-playground-native v1 yet."
        ))),
        None if object.contains_key("files") => {
            let files = object
                .get("files")
                .ok_or_else(|| CliError::new(format!("{step_name} filesTree requires files")))?;
            file_tree_entries_from_value(files, step_name).map(FileTreeSource::Literal)
        }
        None => Err(CliError::new(format!(
            "{step_name} filesTree must include a resource field"
        ))),
    }
}

fn literal_directory_from_blueprint_value(
    value: &serde_json::Value,
    step_name: &str,
) -> Result<(String, BTreeMap<String, FileTreeEntry>)> {
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} filesTree must be a literal:directory resource object"
        ))
    })?;
    if object.get("resource").and_then(|value| value.as_str()) != Some("literal:directory") {
        return Err(CliError::new(format!(
            "{step_name} filesTree must be a literal:directory resource object"
        )));
    }
    let name = object
        .get("name")
        .and_then(|value| value.as_str())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| CliError::new(format!("{step_name} filesTree requires name")))?;
    let files = object
        .get("files")
        .ok_or_else(|| CliError::new(format!("{step_name} filesTree requires files")))?;
    Ok((
        normalize_file_tree_relative_path(name, step_name)?,
        file_tree_entries_from_value(files, step_name)?,
    ))
}

fn git_directory_from_blueprint_object(
    object: &serde_json::Map<String, serde_json::Value>,
    step_name: &str,
) -> Result<GitDirectoryResource> {
    let url = object
        .get("url")
        .and_then(|value| value.as_str())
        .ok_or_else(|| CliError::new(format!("{step_name} git:directory resource requires url")))?;
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(CliError::new(format!(
            "{step_name} git:directory url must use http:// or https://"
        )));
    }
    let ref_name = object
        .get("ref")
        .and_then(|value| value.as_str())
        .unwrap_or("HEAD");
    if ref_name.is_empty() || ref_name.contains('\0') {
        return Err(CliError::new(format!(
            "{step_name} git:directory ref cannot be empty"
        )));
    }
    if ref_name.starts_with('-') {
        return Err(CliError::new(format!(
            "{step_name} git:directory ref cannot start with '-'"
        )));
    }
    let ref_type = object
        .get("refType")
        .map(|value| {
            let value = value.as_str().ok_or_else(|| {
                CliError::new(format!(
                    "{step_name} git:directory refType must be a string"
                ))
            })?;
            match value {
                "branch" | "tag" | "commit" | "refname" => Ok(value.to_string()),
                other => Err(CliError::new(format!(
                    "{step_name} git:directory refType `{other}` is not supported"
                ))),
            }
        })
        .transpose()?;
    let path = object
        .get("path")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let path = normalize_git_directory_path(path, step_name)?;
    let include_git = object
        .get(".git")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    Ok(GitDirectoryResource {
        url: normalize_git_repository_url(url),
        ref_name: ref_name.to_string(),
        ref_type,
        path,
        include_git,
    })
}

fn file_tree_entries_from_value(
    value: &serde_json::Value,
    step_name: &str,
) -> Result<BTreeMap<String, FileTreeEntry>> {
    let object = value
        .as_object()
        .ok_or_else(|| CliError::new(format!("{step_name} files must be an object")))?;
    let mut entries = BTreeMap::new();
    for (path, value) in object {
        let normalized_path = normalize_file_tree_relative_path(path, step_name)?;
        entries.insert(
            normalized_path,
            file_tree_entry_from_value(value, step_name)?,
        );
    }
    Ok(entries)
}

fn file_tree_entry_from_value(value: &serde_json::Value, step_name: &str) -> Result<FileTreeEntry> {
    if let Some(text) = value.as_str() {
        return Ok(FileTreeEntry::File(text.as_bytes().to_vec()));
    }
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} file tree entries must be strings, Uint8Array-shaped objects, or directory objects"
        ))
    })?;
    if object.contains_key("BYTES_PER_ELEMENT") || object.contains_key("byteLength") {
        Ok(FileTreeEntry::File(json_byte_object_to_bytes(
            value, step_name,
        )?))
    } else {
        Ok(FileTreeEntry::Directory(file_tree_entries_from_value(
            value, step_name,
        )?))
    }
}

fn normalize_file_tree_relative_path(path: &str, step_name: &str) -> Result<String> {
    if path.is_empty() || path.contains('\0') || path.starts_with('/') || path.starts_with('\\') {
        return Err(CliError::new(format!(
            "{step_name} file tree path `{path}` must be relative"
        )));
    }
    let normalized = path.replace('\\', "/");
    let mut parts = Vec::new();
    for part in normalized.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                return Err(CliError::new(format!(
                    "{step_name} file tree path `{path}` cannot escape writeToPath"
                )));
            }
            part => parts.push(part),
        }
    }
    if parts.is_empty() {
        return Err(CliError::new(format!(
            "{step_name} file tree path `{path}` must not be empty"
        )));
    }
    Ok(parts.join("/"))
}

fn normalize_git_directory_path(path: &str, step_name: &str) -> Result<String> {
    if path.contains('\0') {
        return Err(CliError::new(format!(
            "{step_name} git:directory path cannot contain NUL bytes"
        )));
    }
    let trimmed = path.trim_matches('/');
    if trimmed.is_empty() || trimmed == "." {
        return Ok(String::new());
    }
    normalize_file_tree_relative_path(trimmed, step_name)
}

fn normalize_git_repository_url(url: &str) -> String {
    url.trim_end_matches('/').to_string()
}

fn json_literal_contents_to_bytes(value: &serde_json::Value, step_name: &str) -> Result<Vec<u8>> {
    if let Some(text) = value.as_str() {
        return Ok(text.as_bytes().to_vec());
    }
    json_byte_object_to_bytes(value, step_name)
}

fn json_byte_object_to_bytes(value: &serde_json::Value, step_name: &str) -> Result<Vec<u8>> {
    let object = value.as_object().ok_or_else(|| {
        CliError::new(format!(
            "{step_name} byte data must be a string or Uint8Array-shaped object"
        ))
    })?;
    let length = object
        .get("length")
        .or_else(|| object.get("byteLength"))
        .and_then(|value| value.as_u64())
        .ok_or_else(|| {
            CliError::new(format!(
                "{step_name} Uint8Array-shaped object requires a numeric length"
            ))
        })?;
    if length > MAX_REQUEST_BYTES as u64 {
        return Err(CliError::new(format!(
            "{step_name} Uint8Array-shaped object is too large"
        )));
    }
    let mut bytes = Vec::with_capacity(length as usize);
    for index in 0..length {
        let byte = object
            .get(&index.to_string())
            .map(|value| {
                value.as_u64().ok_or_else(|| {
                    CliError::new(format!(
                        "{step_name} Uint8Array byte {index} must be a number"
                    ))
                })
            })
            .transpose()?
            .unwrap_or(0);
        if byte > u8::MAX as u64 {
            return Err(CliError::new(format!(
                "{step_name} Uint8Array byte {index} must be between 0 and 255"
            )));
        }
        bytes.push(byte as u8);
    }
    Ok(bytes)
}

fn bundled_file_content_source(
    resource_path: &str,
    step_name: &str,
    resource_context: BlueprintResourceContext<'_>,
) -> Result<FileContentSource> {
    let normalized_path = normalize_bundled_resource_path(resource_path)?;
    match resource_context {
        BlueprintResourceContext::LocalDirectory { root } => {
            let path = resolve_adjacent_bundled_file(root, &normalized_path, step_name)?;
            Ok(FileContentSource::LocalFile(path))
        }
        BlueprintResourceContext::Zip { files } => {
            let bytes = files.get(&normalized_path).ok_or_else(|| {
                CliError::new(format!(
                    "{step_name} bundled resource path `{resource_path}` was not found in the Blueprint ZIP."
                ))
            })?;
            Ok(FileContentSource::BundledFile(bytes.clone()))
        }
        BlueprintResourceContext::Standalone {
            may_read_adjacent_files,
        } => {
            if may_read_adjacent_files {
                Err(CliError::new(format!(
                    "{step_name} bundled resource path `{resource_path}` requires a Blueprint directory or ZIP bundle."
                )))
            } else {
                Err(CliError::new(format!(
                    "{step_name} bundled resource path `{resource_path}` requires --blueprint-may-read-adjacent-files for local JSON Blueprints or a Blueprint ZIP bundle."
                )))
            }
        }
    }
}

fn run_php_code_from_value(value: &serde_json::Value) -> Option<String> {
    if let Some(code) = value.as_str() {
        return Some(code.to_string());
    }
    value
        .as_object()
        .and_then(|object| object.get("content"))
        .and_then(|content| content.as_str())
        .map(str::to_string)
}

fn startup_step_from_automount_step(step: &BlueprintStep) -> Result<StartupStep> {
    match step {
        BlueprintStep::ActivatePlugin { plugin_path } => Ok(StartupStep::ActivatePlugin {
            plugin_path: plugin_path.clone(),
        }),
        BlueprintStep::ActivateTheme { theme_folder_name } => Ok(StartupStep::ActivateTheme {
            theme_folder_name: theme_folder_name.clone(),
        }),
        BlueprintStep::ActivateThemeV2 {
            theme_directory_name,
        } => Ok(StartupStep::ActivateTheme {
            theme_folder_name: theme_directory_name.clone(),
        }),
        BlueprintStep::ActivateFirstTheme => Ok(StartupStep::ActivateFirstTheme),
    }
}

#[cfg(test)]
fn run_native_startup_step(mounts: &[Mount], step: &StartupStep) -> Result<bool> {
    run_native_startup_step_with_symlink_policy(mounts, step, SymlinkPolicy::BlockEscapes)
}

fn run_native_startup_step_with_symlink_policy(
    mounts: &[Mount],
    step: &StartupStep,
    symlink_policy: SymlinkPolicy,
) -> Result<bool> {
    match step {
        StartupStep::EnsureWpCli { wp_cli_path } => {
            ensure_wp_cli_phar(mounts, wp_cli_path)?;
            Ok(true)
        }
        StartupStep::WriteFile { path, data } => {
            let target =
                startup_host_path_with_symlink_policy(mounts, path, "writeFile", symlink_policy)?;
            ensure_write_file_compat_directory(mounts, path, symlink_policy)?;
            let bytes = read_file_content_source_with_symlink_policy(mounts, data, symlink_policy)?;
            fs::write(&target, bytes).map_err(|error| {
                CliError::new(format!(
                    "writeFile failed for {} mapped from {path}: {error}",
                    target.display()
                ))
            })?;
            Ok(true)
        }
        StartupStep::WriteFiles {
            write_to_path,
            files,
        } => {
            let files = resolve_file_tree_source(files)?;
            write_files_tree(mounts, write_to_path, &files, symlink_policy)?;
            Ok(true)
        }
        StartupStep::Unzip {
            zip,
            extract_to_path,
        } => {
            let bytes = read_file_content_source_with_symlink_policy(mounts, zip, symlink_policy)?;
            let target_dir = startup_host_path_with_symlink_policy(
                mounts,
                extract_to_path,
                "unzip",
                symlink_policy,
            )?;
            unzip_bytes_to_dir(&bytes, &target_dir)?;
            Ok(true)
        }
        StartupStep::Mkdir { path } => {
            let target =
                startup_host_path_with_symlink_policy(mounts, path, "mkdir", symlink_policy)?;
            fs::create_dir_all(&target).map_err(|error| {
                CliError::new(format!(
                    "mkdir failed for {} mapped from {path}: {error}",
                    target.display()
                ))
            })?;
            Ok(true)
        }
        StartupStep::Rm { path } => {
            let target = startup_host_path_with_symlink_policy(mounts, path, "rm", symlink_policy)?;
            if target.is_dir() {
                return Err(CliError::new(format!(
                    "rm failed for {path}: there is a directory under that path"
                )));
            }
            fs::remove_file(&target).map_err(|error| {
                CliError::new(format!(
                    "rm failed for {} mapped from {path}: {error}",
                    target.display()
                ))
            })?;
            Ok(true)
        }
        StartupStep::Rmdir { path } => {
            let target =
                startup_host_path_with_symlink_policy(mounts, path, "rmdir", symlink_policy)?;
            fs::remove_dir_all(&target).map_err(|error| {
                CliError::new(format!(
                    "rmdir failed for {} mapped from {path}: {error}",
                    target.display()
                ))
            })?;
            Ok(true)
        }
        StartupStep::Cp { from_path, to_path } => {
            let source =
                startup_host_path_with_symlink_policy(mounts, from_path, "cp", symlink_policy)?;
            let target =
                startup_host_path_with_symlink_policy(mounts, to_path, "cp", symlink_policy)?;
            if source.is_dir() {
                return Err(CliError::new(format!(
                    "cp failed for {from_path}: there is a directory under that path"
                )));
            }
            fs::copy(&source, &target).map_err(|error| {
                CliError::new(format!(
                    "cp failed from {} to {} mapped from {from_path} -> {to_path}: {error}",
                    source.display(),
                    target.display()
                ))
            })?;
            Ok(true)
        }
        StartupStep::Mv { from_path, to_path } => {
            let source =
                startup_host_path_with_symlink_policy(mounts, from_path, "mv", symlink_policy)?;
            let target =
                startup_host_path_with_symlink_policy(mounts, to_path, "mv", symlink_policy)?;
            move_startup_path(&source, &target).map_err(|error| {
                CliError::new(format!(
                    "mv failed from {} to {} mapped from {from_path} -> {to_path}: {error}",
                    source.display(),
                    target.display()
                ))
            })?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

fn write_files_tree(
    mounts: &[Mount],
    root_vfs_path: &str,
    files: &BTreeMap<String, FileTreeEntry>,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    for (path, entry) in files {
        write_file_tree_entry(mounts, root_vfs_path, path, entry, symlink_policy)?;
    }
    Ok(())
}

fn write_file_tree_entry(
    mounts: &[Mount],
    root_vfs_path: &str,
    relative_path: &str,
    entry: &FileTreeEntry,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    let child_vfs_path = child_vfs_path(root_vfs_path, relative_path)?;
    let child_host_path = startup_host_path_with_symlink_policy(
        mounts,
        &child_vfs_path,
        "writeFiles",
        symlink_policy,
    )?;
    match entry {
        FileTreeEntry::File(bytes) => {
            if let Some(parent) = child_host_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    CliError::new(format!(
                        "writeFiles failed to create {}: {error}",
                        parent.display()
                    ))
                })?;
            }
            fs::write(&child_host_path, bytes).map_err(|error| {
                CliError::new(format!(
                    "writeFiles failed for {} mapped from {child_vfs_path}: {error}",
                    child_host_path.display()
                ))
            })?;
        }
        FileTreeEntry::Directory(children) => {
            fs::create_dir_all(&child_host_path).map_err(|error| {
                CliError::new(format!(
                    "writeFiles failed to create {} mapped from {child_vfs_path}: {error}",
                    child_host_path.display()
                ))
            })?;
            for (child_relative_path, child_entry) in children {
                let nested_relative_path =
                    normalize_file_tree_relative_path(child_relative_path, "writeFiles")?;
                let nested_path = format!("{relative_path}/{nested_relative_path}");
                write_file_tree_entry(
                    mounts,
                    root_vfs_path,
                    &nested_path,
                    child_entry,
                    symlink_policy,
                )?;
            }
        }
    }
    Ok(())
}

fn child_vfs_path(root_vfs_path: &str, relative_path: &str) -> Result<String> {
    normalize_vfs_path(&format!(
        "{}/{}",
        root_vfs_path.trim_end_matches('/'),
        relative_path.trim_start_matches('/')
    ))
}

fn startup_host_path(mounts: &[Mount], vfs_path: &str, label: &str) -> Result<PathBuf> {
    startup_host_path_with_symlink_policy(mounts, vfs_path, label, SymlinkPolicy::BlockEscapes)
}

fn startup_host_path_with_symlink_policy(
    mounts: &[Mount],
    vfs_path: &str,
    label: &str,
    symlink_policy: SymlinkPolicy,
) -> Result<PathBuf> {
    let normalized = normalize_vfs_path(vfs_path)?;
    host_path_for_vfs_path_with_symlink_policy(mounts, &normalized, symlink_policy).ok_or_else(
        || {
            CliError::new(format!(
                "{label} path `{vfs_path}` is not covered by a host mount"
            ))
        },
    )
}

fn ensure_write_file_compat_directory(
    mounts: &[Mount],
    path: &str,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    if path == "/wordpress/wp-content/mu-plugins"
        || path.starts_with("/wordpress/wp-content/mu-plugins/")
    {
        let Some(mu_plugins_path) = host_path_for_vfs_path_with_symlink_policy(
            mounts,
            "/wordpress/wp-content/mu-plugins",
            symlink_policy,
        ) else {
            return Ok(());
        };
        if !mu_plugins_path.exists() {
            fs::create_dir_all(&mu_plugins_path).map_err(|error| {
                CliError::new(format!(
                    "writeFile failed to create {}: {error}",
                    mu_plugins_path.display()
                ))
            })?;
        }
    }
    Ok(())
}

fn read_file_content_source(mounts: &[Mount], source: &FileContentSource) -> Result<Vec<u8>> {
    read_file_content_source_with_symlink_policy(mounts, source, SymlinkPolicy::BlockEscapes)
}

fn read_file_content_source_with_symlink_policy(
    mounts: &[Mount],
    source: &FileContentSource,
    symlink_policy: SymlinkPolicy,
) -> Result<Vec<u8>> {
    match source {
        FileContentSource::Bytes(bytes) | FileContentSource::BundledFile(bytes) => {
            Ok(bytes.clone())
        }
        FileContentSource::Url(url) => download_bytes(url),
        FileContentSource::LocalFile(path) => fs::read(path).map_err(|error| {
            CliError::new(format!(
                "Failed to read bundled file {}: {error}",
                path.display()
            ))
        }),
        FileContentSource::VfsPath(path) => {
            let host_path = startup_host_path_with_symlink_policy(
                mounts,
                path,
                "writeFile vfs resource",
                symlink_policy,
            )?;
            fs::read(&host_path).map_err(|error| {
                CliError::new(format!(
                    "Failed to read VFS file {} mapped from {path}: {error}",
                    host_path.display()
                ))
            })
        }
        FileContentSource::ZipWrappedFile { inner, filename } => {
            let bytes =
                read_file_content_source_with_symlink_policy(mounts, inner, symlink_policy)?;
            zip_wrapped_file_bytes(filename, &bytes)
        }
        FileContentSource::ZipWrappedDirectory { name, files } => {
            zip_wrapped_directory_bytes(name, files)
        }
        FileContentSource::ZipWrappedGitDirectory(resource) => {
            let (name, files) = resolve_git_directory_resource(resource)?;
            zip_wrapped_directory_bytes(&name, &files)
        }
    }
}

fn resolve_file_tree_source(source: &FileTreeSource) -> Result<BTreeMap<String, FileTreeEntry>> {
    match source {
        FileTreeSource::Literal(files) => Ok(files.clone()),
        FileTreeSource::Git(resource) => {
            let (_name, files) = resolve_git_directory_resource(resource)?;
            Ok(files)
        }
    }
}

#[cfg(test)]
pub(crate) fn write_wordpress_snapshot_zip(mounts: &[Mount], outfile: &Path) -> Result<()> {
    write_wordpress_snapshot_zip_with_symlink_policy(mounts, outfile, SymlinkPolicy::BlockEscapes)
}

pub(crate) fn write_wordpress_snapshot_zip_with_symlink_policy(
    mounts: &[Mount],
    outfile: &Path,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    let file = fs::File::create(outfile).map_err(|error| {
        CliError::new(format!(
            "Failed to create snapshot ZIP {}: {error}",
            outfile.display()
        ))
    })?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    add_vfs_directory_to_snapshot_zip(&mut writer, mounts, "/wordpress", options, symlink_policy)?;
    writer.finish().map_err(|error| {
        CliError::new(format!(
            "Failed to finish snapshot ZIP {}: {error}",
            outfile.display()
        ))
    })?;
    Ok(())
}

fn add_vfs_directory_to_snapshot_zip<W: Write + Seek>(
    writer: &mut ZipWriter<W>,
    mounts: &[Mount],
    vfs_dir: &str,
    options: SimpleFileOptions,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    for child_name in snapshot_vfs_child_names(mounts, vfs_dir)? {
        let child_vfs_path = join_vfs_child_path(vfs_dir, &child_name);
        let Some(host_path) =
            host_path_for_vfs_path_with_symlink_policy(mounts, &child_vfs_path, symlink_policy)
        else {
            continue;
        };
        match fs::metadata(&host_path) {
            Ok(metadata) if metadata.is_dir() => {
                add_vfs_directory_to_snapshot_zip(
                    writer,
                    mounts,
                    &child_vfs_path,
                    options,
                    symlink_policy,
                )?;
            }
            Ok(metadata) if metadata.is_file() => {
                writer
                    .start_file(&child_vfs_path, options)
                    .map_err(|error| {
                        CliError::new(format!(
                            "Failed to add snapshot ZIP entry {child_vfs_path}: {error}"
                        ))
                    })?;
                let mut file = fs::File::open(&host_path).map_err(|error| {
                    CliError::new(format!(
                        "Failed to read snapshot source file {}: {error}",
                        host_path.display()
                    ))
                })?;
                io::copy(&mut file, writer).map_err(|error| {
                    CliError::new(format!(
                        "Failed to write snapshot ZIP entry {child_vfs_path}: {error}"
                    ))
                })?;
            }
            _ if has_snapshot_descendant_mount(mounts, &child_vfs_path) => {
                add_vfs_directory_to_snapshot_zip(
                    writer,
                    mounts,
                    &child_vfs_path,
                    options,
                    symlink_policy,
                )?;
            }
            _ => {}
        }
    }
    Ok(())
}

fn snapshot_vfs_child_names(mounts: &[Mount], vfs_dir: &str) -> Result<BTreeSet<String>> {
    let mut names = BTreeSet::new();
    if let Some(host_path) = host_path_for_vfs_path(mounts, vfs_dir) {
        if fs::metadata(&host_path)
            .map(|metadata| metadata.is_dir())
            .unwrap_or(false)
        {
            for entry in fs::read_dir(&host_path).map_err(|error| {
                CliError::new(format!(
                    "Failed to read snapshot source directory {}: {error}",
                    host_path.display()
                ))
            })? {
                let entry = entry.map_err(|error| {
                    CliError::new(format!(
                        "Failed to read snapshot source entry in {}: {error}",
                        host_path.display()
                    ))
                })?;
                names.insert(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    for mount in mounts {
        if let Some((name, _)) = direct_child_mount_name(vfs_dir, &mount.vfs_path) {
            names.insert(name.to_string());
        }
    }
    Ok(names)
}

fn has_snapshot_descendant_mount(mounts: &[Mount], vfs_dir: &str) -> bool {
    mounts
        .iter()
        .any(|mount| direct_child_mount_name(vfs_dir, &mount.vfs_path).is_some())
}

fn join_vfs_child_path(parent: &str, child: &str) -> String {
    if parent == "/" {
        format!("/{child}")
    } else {
        format!("{parent}/{child}")
    }
}

fn zip_wrapped_file_bytes(filename: &str, bytes: &[u8]) -> Result<Vec<u8>> {
    let filename = normalize_file_tree_relative_path(filename, "zip")?;
    let cursor = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    writer.start_file(&filename, options).map_err(|error| {
        CliError::new(format!("Failed to create ZIP entry {filename}: {error}"))
    })?;
    writer
        .write_all(bytes)
        .map_err(|error| CliError::new(format!("Failed to write ZIP entry {filename}: {error}")))?;
    let cursor = writer
        .finish()
        .map_err(|error| CliError::new(format!("Failed to finish ZIP resource: {error}")))?;
    Ok(cursor.into_inner())
}

fn zip_wrapped_directory_bytes(
    name: &str,
    files: &BTreeMap<String, FileTreeEntry>,
) -> Result<Vec<u8>> {
    let name = normalize_file_tree_relative_path(name, "zip")?;
    let cursor = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    add_file_tree_to_zip(&mut writer, &name, files, options)?;
    let cursor = writer
        .finish()
        .map_err(|error| CliError::new(format!("Failed to finish ZIP resource: {error}")))?;
    Ok(cursor.into_inner())
}

fn add_file_tree_to_zip(
    writer: &mut ZipWriter<Cursor<Vec<u8>>>,
    base_path: &str,
    files: &BTreeMap<String, FileTreeEntry>,
    options: SimpleFileOptions,
) -> Result<()> {
    for (path, entry) in files {
        let relative_path = normalize_file_tree_relative_path(path, "zip")?;
        let zip_path = format!(
            "{}/{}",
            base_path.trim_end_matches('/'),
            relative_path.trim_start_matches('/')
        );
        match entry {
            FileTreeEntry::File(bytes) => {
                writer.start_file(&zip_path, options).map_err(|error| {
                    CliError::new(format!("Failed to create ZIP entry {zip_path}: {error}"))
                })?;
                writer.write_all(bytes).map_err(|error| {
                    CliError::new(format!("Failed to write ZIP entry {zip_path}: {error}"))
                })?;
            }
            FileTreeEntry::Directory(children) => {
                let directory_path = format!("{}/", zip_path.trim_end_matches('/'));
                writer
                    .add_directory(&directory_path, options)
                    .map_err(|error| {
                        CliError::new(format!(
                            "Failed to create ZIP directory {directory_path}: {error}"
                        ))
                    })?;
                add_file_tree_to_zip(writer, &zip_path, children, options)?;
            }
        }
    }
    Ok(())
}

fn resolve_git_directory_resource(
    resource: &GitDirectoryResource,
) -> Result<(String, BTreeMap<String, FileTreeEntry>)> {
    if resource.include_git || !git_archive_supported_host(resource)? {
        let files = resolve_git_directory_resource_with_git_cli(resource)?;
        return Ok((resource.filename(), files));
    }
    let archive_url = git_archive_download_url(resource)?;
    let archive_path = cached_download_with_validator(
        &archive_url,
        &url_cache_key("blueprint-git-directory", &archive_url, ".zip"),
        |path| validate_git_archive_zip(path, &resource.path),
    )
    .map_err(|error| {
        CliError::new(format!(
            "Failed to download git:directory archive {}: {error}",
            archive_url
        ))
    })?;
    let bytes = fs::read(&archive_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read cached git:directory archive {}: {error}",
            archive_path.display()
        ))
    })?;
    let files = git_archive_bytes_to_file_tree(&bytes, &resource.path)?;
    Ok((resource.filename(), files))
}

fn resolve_git_directory_resource_with_git_cli(
    resource: &GitDirectoryResource,
) -> Result<BTreeMap<String, FileTreeEntry>> {
    let temp_root = unique_native_temp_dir("git-directory")?;
    let _cleanup = CleanupDir(temp_root.clone());
    run_git(
        Some(&temp_root),
        &["init", "checkout"],
        "initialize git:directory checkout",
    )?;
    let checkout_dir = temp_root.join("checkout");
    run_git(
        Some(&checkout_dir),
        &["config", "core.autocrlf", "false"],
        "disable git:directory checkout CRLF conversion",
    )?;
    run_git(
        Some(&checkout_dir),
        &["config", "core.eol", "lf"],
        "configure git:directory checkout line endings",
    )?;
    run_git(
        Some(&checkout_dir),
        &["remote", "add", "origin", resource.url.as_str()],
        "configure git:directory remote",
    )?;
    let fetch_ref = git_fetch_ref(resource);
    run_git(
        Some(&checkout_dir),
        &["fetch", "--depth", "1", "origin", fetch_ref.as_str()],
        "fetch git:directory repository",
    )?;
    let commit = run_git(
        Some(&checkout_dir),
        &["rev-parse", "--verify", "FETCH_HEAD^{commit}"],
        "resolve git:directory commit",
    )?
    .trim()
    .to_string();
    configure_git_directory_head(&checkout_dir, resource, &commit)?;
    checkout_git_directory_tree(&checkout_dir, &commit, &resource.path)?;
    ensure_git_shallow_file(&checkout_dir, &commit)?;
    let files = file_tree_from_host_directory(&checkout_dir, resource.include_git)?;
    if files.is_empty() {
        return Err(CliError::new("git:directory repository contains no files"));
    }
    Ok(files)
}

fn unique_native_temp_dir(prefix: &str) -> Result<PathBuf> {
    let path = std::env::temp_dir().join(format!(
        "wp-playground-native-{prefix}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    fs::create_dir_all(&path).map_err(|error| {
        CliError::new(format!(
            "Failed to create temporary directory {}: {error}",
            path.display()
        ))
    })?;
    Ok(path)
}

struct CleanupDir(PathBuf);

impl Drop for CleanupDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn run_git(cwd: Option<&Path>, args: &[&str], description: &str) -> Result<String> {
    let mut command = ProcessCommand::new("git");
    command
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never");
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let output = command.output().map_err(|error| {
        CliError::new(format!(
            "{description} failed: the `git` executable is required for this git:directory resource ({error})"
        ))
    })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("git exited with status {}", output.status)
        };
        return Err(CliError::new(format!("{description} failed: {details}")));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn git_fetch_ref(resource: &GitDirectoryResource) -> String {
    match resource.ref_type.as_deref() {
        Some("branch") => format!("refs/heads/{}", resource.ref_name),
        Some("tag") => {
            if resource.ref_name.starts_with("refs/") {
                resource.ref_name.clone()
            } else {
                format!("refs/tags/{}", resource.ref_name)
            }
        }
        Some("commit") | Some("refname") | None => resource.ref_name.clone(),
        Some(_) => resource.ref_name.clone(),
    }
}

fn git_head_ref(resource: &GitDirectoryResource) -> Option<String> {
    let trimmed = resource.ref_name.trim();
    match resource.ref_type.as_deref() {
        Some("branch") if !trimmed.is_empty() => Some(format!("refs/heads/{trimmed}")),
        Some("tag") if trimmed.starts_with("refs/") => Some(trimmed.to_string()),
        Some("tag") if !trimmed.is_empty() => Some(format!("refs/tags/{trimmed}")),
        Some("refname") if !trimmed.is_empty() => Some(trimmed.to_string()),
        Some("commit") => None,
        None if trimmed.starts_with("refs/") => Some(trimmed.to_string()),
        None if trimmed == "HEAD" || is_full_git_sha(trimmed) => None,
        None if !trimmed.is_empty() => Some(format!("refs/heads/{trimmed}")),
        _ => None,
    }
}

fn is_full_git_sha(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn configure_git_directory_head(
    checkout_dir: &Path,
    resource: &GitDirectoryResource,
    commit: &str,
) -> Result<()> {
    let git_dir = checkout_dir.join(".git");
    if let Some(head_ref) = git_head_ref(resource) {
        run_git(
            Some(checkout_dir),
            &["update-ref", head_ref.as_str(), commit],
            "configure git:directory HEAD ref",
        )?;
        fs::write(git_dir.join("HEAD"), format!("ref: {head_ref}\n")).map_err(|error| {
            CliError::new(format!(
                "Failed to write git:directory HEAD in {}: {error}",
                git_dir.display()
            ))
        })?;
        if let Some(branch) = head_ref.strip_prefix("refs/heads/") {
            let remote_ref = format!("refs/remotes/origin/{branch}");
            run_git(
                Some(checkout_dir),
                &["update-ref", remote_ref.as_str(), commit],
                "configure git:directory remote branch ref",
            )?;
            let config_remote = format!("branch.{branch}.remote");
            let config_merge = format!("branch.{branch}.merge");
            run_git(
                Some(checkout_dir),
                &["config", config_remote.as_str(), "origin"],
                "configure git:directory branch remote",
            )?;
            run_git(
                Some(checkout_dir),
                &["config", config_merge.as_str(), head_ref.as_str()],
                "configure git:directory branch merge ref",
            )?;
        }
    } else {
        fs::write(git_dir.join("HEAD"), format!("{commit}\n")).map_err(|error| {
            CliError::new(format!(
                "Failed to write detached git:directory HEAD in {}: {error}",
                git_dir.display()
            ))
        })?;
    }
    Ok(())
}

fn checkout_git_directory_tree(
    checkout_dir: &Path,
    commit: &str,
    requested_path: &str,
) -> Result<()> {
    let treeish = if requested_path.is_empty() {
        commit.to_string()
    } else {
        let treeish = format!("{commit}:{requested_path}");
        let object_type = run_git(
            Some(checkout_dir),
            &["cat-file", "-t", treeish.as_str()],
            "inspect git:directory path",
        )
        .map_err(|_| {
            CliError::new(format!(
                "git:directory path `{requested_path}` was not found in the repository"
            ))
        })?;
        if object_type.trim() != "tree" {
            return Err(CliError::new(format!(
                "git:directory path `{requested_path}` is not a directory"
            )));
        }
        treeish
    };
    run_git(
        Some(checkout_dir),
        &["read-tree", "--empty"],
        "clear git:directory index",
    )?;
    run_git(
        Some(checkout_dir),
        &["read-tree", treeish.as_str()],
        "read git:directory tree",
    )?;
    run_git(
        Some(checkout_dir),
        &["checkout-index", "-a", "-f"],
        "write git:directory checkout files",
    )?;
    Ok(())
}

fn ensure_git_shallow_file(checkout_dir: &Path, commit: &str) -> Result<()> {
    let shallow_path = checkout_dir.join(".git/shallow");
    if shallow_path.exists() {
        return Ok(());
    }
    fs::write(&shallow_path, format!("{commit}\n")).map_err(|error| {
        CliError::new(format!(
            "Failed to write git:directory shallow marker {}: {error}",
            shallow_path.display()
        ))
    })
}

fn file_tree_from_host_directory(
    directory: &Path,
    include_dot_git: bool,
) -> Result<BTreeMap<String, FileTreeEntry>> {
    let mut files = BTreeMap::new();
    for entry in fs::read_dir(directory).map_err(|error| {
        CliError::new(format!(
            "Failed to read git:directory checkout {}: {error}",
            directory.display()
        ))
    })? {
        let entry = entry.map_err(|error| {
            CliError::new(format!(
                "Failed to read git:directory checkout entry in {}: {error}",
                directory.display()
            ))
        })?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !include_dot_git && name == ".git" {
            continue;
        }
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|error| {
            CliError::new(format!(
                "Failed to inspect git:directory checkout entry {}: {error}",
                path.display()
            ))
        })?;
        let file_type = metadata.file_type();
        if file_type.is_dir() {
            files.insert(
                name,
                FileTreeEntry::Directory(file_tree_from_host_directory(&path, include_dot_git)?),
            );
        } else if file_type.is_symlink() {
            let target = fs::read_link(&path).map_err(|error| {
                CliError::new(format!(
                    "Failed to read git:directory symlink {}: {error}",
                    path.display()
                ))
            })?;
            files.insert(
                name,
                FileTreeEntry::File(target.to_string_lossy().as_bytes().to_vec()),
            );
        } else if file_type.is_file() {
            let contents = fs::read(&path).map_err(|error| {
                CliError::new(format!(
                    "Failed to read git:directory checkout file {}: {error}",
                    path.display()
                ))
            })?;
            files.insert(name, FileTreeEntry::File(contents));
        }
    }
    Ok(files)
}

fn validate_git_archive_zip(path: &Path, requested_path: &str) -> Result<()> {
    let bytes = fs::read(path).map_err(|error| {
        CliError::new(format!(
            "Failed to read cached git:directory archive {}: {error}",
            path.display()
        ))
    })?;
    git_archive_bytes_to_file_tree(&bytes, requested_path)?;
    Ok(())
}

fn git_archive_bytes_to_file_tree(
    bytes: &[u8],
    requested_path: &str,
) -> Result<BTreeMap<String, FileTreeEntry>> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| CliError::new(format!("Failed to read git archive ZIP: {error}")))?;
    let mut files = BTreeMap::new();
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read git archive entry: {error}")))?;
        if entry.is_dir() {
            continue;
        }
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let normalized = zip_path_to_string(&enclosed_name);
        let Some((_archive_root, repo_relative_path)) = normalized.split_once('/') else {
            continue;
        };
        let relative_path = if requested_path.is_empty() {
            repo_relative_path
        } else {
            let Some(relative_path) =
                repo_relative_path.strip_prefix(&(requested_path.to_string() + "/"))
            else {
                continue;
            };
            relative_path
        };
        if relative_path.is_empty() {
            continue;
        }
        let relative_path = normalize_file_tree_relative_path(relative_path, "git:directory")?;
        let mut contents = Vec::new();
        entry.read_to_end(&mut contents).map_err(|error| {
            CliError::new(format!(
                "Failed to read git archive entry {normalized}: {error}"
            ))
        })?;
        insert_file_tree_file(&mut files, &relative_path, contents)?;
    }
    if files.is_empty() {
        if requested_path.is_empty() {
            return Err(CliError::new("git:directory archive contains no files"));
        }
        return Err(CliError::new(format!(
            "git:directory path `{requested_path}` was not found in the archive"
        )));
    }
    Ok(files)
}

fn insert_file_tree_file(
    files: &mut BTreeMap<String, FileTreeEntry>,
    relative_path: &str,
    contents: Vec<u8>,
) -> Result<()> {
    let parts = relative_path
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    insert_file_tree_file_parts(files, &parts, contents)
}

fn insert_file_tree_file_parts(
    files: &mut BTreeMap<String, FileTreeEntry>,
    parts: &[&str],
    contents: Vec<u8>,
) -> Result<()> {
    let Some((first, rest)) = parts.split_first() else {
        return Err(CliError::new("git:directory archive entry path is empty"));
    };
    if rest.is_empty() {
        if matches!(files.get(*first), Some(FileTreeEntry::Directory(_))) {
            return Err(CliError::new(format!(
                "git:directory archive file `{first}` conflicts with an existing directory"
            )));
        }
        files.insert((*first).to_string(), FileTreeEntry::File(contents));
        return Ok(());
    }
    match files.entry((*first).to_string()) {
        std::collections::btree_map::Entry::Vacant(entry) => {
            let mut children = BTreeMap::new();
            insert_file_tree_file_parts(&mut children, rest, contents)?;
            entry.insert(FileTreeEntry::Directory(children));
            Ok(())
        }
        std::collections::btree_map::Entry::Occupied(mut entry) => match entry.get_mut() {
            FileTreeEntry::Directory(children) => {
                insert_file_tree_file_parts(children, rest, contents)
            }
            FileTreeEntry::File(_) => Err(CliError::new(format!(
                "git:directory archive directory `{first}` conflicts with an existing file"
            ))),
        },
    }
}

fn git_archive_download_url(resource: &GitDirectoryResource) -> Result<String> {
    let parsed = parse_http_repository_url(&resource.url)?;
    match parsed.host.as_str() {
        "github.com" => github_archive_download_url(&parsed, resource),
        "gitlab.com" => gitlab_archive_download_url(&parsed, resource),
        host => Err(CliError::new(format!(
            "git:directory repository host `{host}` does not have a built-in archive URL; use the Git CLI resolver."
        ))),
    }
}

fn git_archive_supported_host(resource: &GitDirectoryResource) -> Result<bool> {
    let parsed = parse_http_repository_url(&resource.url)?;
    Ok(matches!(parsed.host.as_str(), "github.com" | "gitlab.com"))
}

struct ParsedRepositoryUrl {
    scheme: String,
    host: String,
    path_parts: Vec<String>,
}

fn parse_http_repository_url(url: &str) -> Result<ParsedRepositoryUrl> {
    let (scheme, rest) = url
        .split_once("://")
        .ok_or_else(|| CliError::new(format!("Invalid git:directory repository URL `{url}`")))?;
    if scheme != "http" && scheme != "https" {
        return Err(CliError::new(format!(
            "git:directory repository URL `{url}` must use http:// or https://"
        )));
    }
    if rest.contains('?') || rest.contains('#') {
        return Err(CliError::new(format!(
            "git:directory repository URL `{url}` must not include query strings or fragments"
        )));
    }
    let (host, path) = rest.split_once('/').unwrap_or((rest, ""));
    let host = host.to_ascii_lowercase();
    let path_parts = path
        .split('/')
        .filter(|part| !part.is_empty())
        .map(|part| part.strip_suffix(".git").unwrap_or(part).to_string())
        .collect::<Vec<_>>();
    Ok(ParsedRepositoryUrl {
        scheme: scheme.to_string(),
        host,
        path_parts,
    })
}

fn github_archive_download_url(
    parsed: &ParsedRepositoryUrl,
    resource: &GitDirectoryResource,
) -> Result<String> {
    if parsed.path_parts.len() != 2 {
        return Err(CliError::new(
            "github.com git:directory URLs must use https://github.com/<owner>/<repo>",
        ));
    }
    let archive_ref = github_archive_ref(&resource.ref_name, resource.ref_type.as_deref());
    Ok(format!(
        "{}://github.com/{}/{}/archive/{}.zip",
        parsed.scheme,
        percent_encode_path_segment(&parsed.path_parts[0]),
        percent_encode_path_segment(&parsed.path_parts[1]),
        percent_encode_path(&archive_ref)
    ))
}

fn github_archive_ref(ref_name: &str, ref_type: Option<&str>) -> String {
    match ref_type {
        Some("branch") => format!("refs/heads/{ref_name}"),
        Some("tag") => format!("refs/tags/{ref_name}"),
        Some("commit") | Some("refname") | None => ref_name.to_string(),
        Some(_) => ref_name.to_string(),
    }
}

fn gitlab_archive_download_url(
    parsed: &ParsedRepositoryUrl,
    resource: &GitDirectoryResource,
) -> Result<String> {
    if parsed.path_parts.len() < 2 {
        return Err(CliError::new(
            "gitlab.com git:directory URLs must use https://gitlab.com/<namespace>/<repo>",
        ));
    }
    let repo = parsed.path_parts.last().unwrap();
    let namespace = parsed.path_parts[..parsed.path_parts.len() - 1]
        .iter()
        .map(|part| percent_encode_path_segment(part))
        .collect::<Vec<_>>()
        .join("/");
    let encoded_ref = percent_encode_path_segment(&resource.ref_name);
    Ok(format!(
        "{}://gitlab.com/{namespace}/{}/-/archive/{encoded_ref}/{}-{encoded_ref}.zip",
        parsed.scheme,
        percent_encode_path_segment(repo),
        percent_encode_path_segment(repo),
    ))
}

fn percent_encode_path(path: &str) -> String {
    path.split('/')
        .map(percent_encode_path_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_encode_path_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn sanitize_git_directory_name(name: &str) -> String {
    let mut output = String::new();
    let mut previous_dash = false;
    for character in name.chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '-' | '.') {
            output.push(character);
            previous_dash = false;
        } else if !previous_dash {
            output.push('-');
            previous_dash = true;
        }
    }
    let trimmed = output.trim_matches(|character: char| !character.is_ascii_alphanumeric());
    if trimmed.is_empty() {
        "git-directory".to_string()
    } else {
        trimmed.to_string()
    }
}

fn move_startup_path(source: &Path, target: &Path) -> std::io::Result<()> {
    if target.exists() && target.is_file() {
        fs::remove_file(target)?;
    }

    match fs::rename(source, target) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            if source.is_dir() {
                copy_dir_recursive(source, target)?;
                fs::remove_dir_all(source)?;
                Ok(())
            } else if source.is_file() {
                fs::copy(source, target)?;
                fs::remove_file(source)?;
                Ok(())
            } else {
                Err(rename_error)
            }
        }
    }
}

fn copy_dir_recursive(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::create_dir(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let child_source = entry.path();
        let child_target = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&child_source, &child_target)?;
        } else {
            fs::copy(&child_source, &child_target)?;
        }
    }
    Ok(())
}

fn run_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    step: &StartupStep,
) -> Result<()> {
    run_startup_step_with_symlink_policy(
        mounts,
        php,
        port,
        index,
        step,
        SymlinkPolicy::BlockEscapes,
    )
}

fn run_startup_step_with_symlink_policy(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    step: &StartupStep,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    if run_native_startup_step_with_symlink_policy(mounts, step, symlink_policy)? {
        return Ok(());
    }

    let mut cleanup_paths = Vec::new();
    let code = match step {
        StartupStep::Login { .. } | StartupStep::DisableLogin => return Ok(()),
        StartupStep::ActivatePlugin { plugin_path } => activate_plugin_script(plugin_path),
        StartupStep::ActivateTheme { theme_folder_name } => {
            activate_theme_script(theme_folder_name)
        }
        StartupStep::ActivateFirstTheme => activate_first_theme_script(),
        StartupStep::InstallPlugin { asset } => {
            let plugin_path = install_plugin_asset(mounts, asset)?;
            if !asset.activate {
                return Ok(());
            }
            activate_plugin_script(&plugin_path)
        }
        StartupStep::InstallTheme {
            asset,
            import_starter_content,
        } => {
            let folder_name =
                install_downloadable_asset(mounts, asset, "/wordpress/wp-content/themes", "theme")?;
            if *import_starter_content {
                if asset.activate {
                    run_startup_step_with_symlink_policy(
                        mounts,
                        php,
                        port,
                        index,
                        &StartupStep::ActivateTheme {
                            theme_folder_name: folder_name.clone(),
                        },
                        symlink_policy,
                    )?;
                }
                import_theme_starter_content_script(&folder_name)
            } else if asset.activate {
                activate_theme_script(&folder_name)
            } else {
                return Ok(());
            }
        }
        StartupStep::SetSiteOptions { options_json } => set_site_options_script(options_json),
        StartupStep::SetSiteLanguage { .. } => {
            return Err(CliError::new(
                "setSiteLanguage startup step requires run_startup_steps context",
            ));
        }
        StartupStep::UpdateUserMeta { user_id, meta_json } => {
            update_user_meta_script(*user_id, meta_json)
        }
        StartupStep::ResetData => reset_data_script(),
        StartupStep::Request { request } => {
            return run_request_startup_step(mounts, php, port, index, request, symlink_policy);
        }
        StartupStep::ImportWxr { .. } => {
            return Err(CliError::new(
                "importWxr startup step requires run_startup_steps context",
            ));
        }
        StartupStep::ImportWordPressFiles { .. } => {
            return Err(CliError::new(
                "importWordPressFiles startup step requires run_startup_steps context",
            ));
        }
        StartupStep::RunWpInstallationWizard { admin_password } => {
            return install_wordpress_with_api(
                mounts,
                php,
                port,
                admin_password.as_deref().unwrap_or("password"),
            );
        }
        StartupStep::EnableMultisite { .. } => {
            return Err(CliError::new(
                "enableMultisite startup step requires run_startup_steps context",
            ));
        }
        StartupStep::WpCli { wp_cli_path, args } => {
            return run_wp_cli_startup_step(mounts, php, index, wp_cli_path, args);
        }
        StartupStep::RunPhp { code } => code.clone(),
        StartupStep::RunPhpWithOptions { options } => {
            return run_php_with_options_startup_step(mounts, php, index, options);
        }
        StartupStep::DefineWpConfigConsts {
            constants,
            method: DefineWpConfigMethod::RewriteWpConfig,
        } => define_wp_config_consts_script(constants)?,
        StartupStep::DefineWpConfigConsts {
            method: DefineWpConfigMethod::DefineBeforeRun,
            ..
        } => unreachable!("define-before-run startup step should have been handled"),
        StartupStep::RunSql { sql } => {
            let sql_vfs_path = format!("/tmp/wp-playground-native-run-sql-{index}.sql");
            let stream_class_vfs_path =
                format!("/tmp/wp-playground-native-run-sql-stream-{index}.php");
            let sql_host_path = host_path_for_vfs_path(mounts, &sql_vfs_path)
                .ok_or_else(|| CliError::new("Missing /tmp mount for runSql SQL file"))?;
            let stream_class_host_path = host_path_for_vfs_path(mounts, &stream_class_vfs_path)
                .ok_or_else(|| CliError::new("Missing /tmp mount for runSql parser file"))?;
            let sql_bytes =
                read_file_content_source_with_symlink_policy(mounts, sql, symlink_policy)?;
            fs::write(&sql_host_path, sql_bytes).map_err(|error| {
                CliError::new(format!(
                    "Failed to stage runSql SQL file {}: {error}",
                    sql_host_path.display()
                ))
            })?;
            fs::write(&stream_class_host_path, WP_MYSQL_NAIVE_QUERY_STREAM).map_err(|error| {
                CliError::new(format!(
                    "Failed to stage runSql parser file {}: {error}",
                    stream_class_host_path.display()
                ))
            })?;
            cleanup_paths.push(sql_host_path);
            cleanup_paths.push(stream_class_host_path);
            run_sql_script(&sql_vfs_path, &stream_class_vfs_path)
        }
        StartupStep::EnsureWpCli { .. }
        | StartupStep::WriteFile { .. }
        | StartupStep::WriteFiles { .. }
        | StartupStep::Unzip { .. }
        | StartupStep::Mkdir { .. }
        | StartupStep::Rm { .. }
        | StartupStep::Rmdir { .. }
        | StartupStep::Cp { .. }
        | StartupStep::Mv { .. } => unreachable!("native startup step should have returned"),
    };
    let script_vfs_path = format!("/tmp/wp-playground-native-startup-{index}.php");
    let script_host_path = host_path_for_vfs_path(mounts, &script_vfs_path)
        .ok_or_else(|| CliError::new("Missing /tmp mount for startup Blueprint step"))?;
    fs::write(&script_host_path, code)?;

    let request = HttpRequest {
        method: "GET".to_string(),
        target: format!("/__wp_playground_native_startup_{index}.php"),
        version: "HTTP/1.1".to_string(),
        headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
        body: Vec::new(),
    };
    let php_request = php_request_from_http(&request, &script_vfs_path, None, port);
    let response_result = php.run_sapi_request(&php_request);
    let _ = fs::remove_file(&script_host_path);
    for path in cleanup_paths {
        let _ = fs::remove_file(path);
    }
    let response = response_result?;

    if response.exit_code == 0 {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "Startup Blueprint step {index} failed. Output: {}",
            response_excerpt(&response)
        )))
    }
}

fn run_request_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    request: &StartupHttpRequest,
    symlink_policy: SymlinkPolicy,
) -> Result<()> {
    let mut http_request = HttpRequest {
        method: request.method.clone(),
        target: request.target.clone(),
        version: "HTTP/1.1".to_string(),
        headers: request.headers.clone(),
        body: request.body.clone(),
    };
    if header_value(&http_request.headers, "host").is_none() {
        http_request
            .headers
            .push(("host".to_string(), format!("127.0.0.1:{port}")));
    }
    let response = handle_startup_http_request(&http_request, mounts, php, port, symlink_policy)?;
    if (200..400).contains(&response.status) {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "Request Blueprint step {index} failed with status {}. Body: {}",
            response.status,
            String::from_utf8_lossy(&response.body)
                .chars()
                .take(500)
                .collect::<String>()
        )))
    }
}

fn handle_startup_http_request(
    request: &HttpRequest,
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    symlink_policy: SymlinkPolicy,
) -> Result<HttpResponse> {
    let route = match resolve_route_with_symlink_policy(mounts, &request.target, symlink_policy) {
        Ok(route) => route,
        Err(_) => return Ok(http_error_response(400, "Bad Request")),
    };
    match route {
        RouteTarget::Php {
            vfs_path,
            path_info,
        } => Ok(handle_php_route_request(
            request,
            php,
            port,
            &vfs_path,
            path_info.as_deref(),
            false,
            None,
        )?
        .1),
        RouteTarget::Static { host_path } => {
            let body = fs::read(&host_path).map_err(|error| {
                CliError::new(format!(
                    "Failed to read static file {}: {error}",
                    host_path.display()
                ))
            })?;
            Ok(HttpResponse {
                status: 200,
                headers: vec![(
                    "Content-Type".to_string(),
                    content_type_for_path(&host_path).to_string(),
                )],
                body,
            })
        }
        RouteTarget::NotFound => Ok(HttpResponse {
            status: 404,
            headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
            body: b"Not Found\n".to_vec(),
        }),
    }
}

#[cfg(test)]
fn wp_installation_wizard_request(admin_password: Option<&str>) -> Result<StartupHttpRequest> {
    let user_name = admin_password.unwrap_or("admin");
    let password = admin_password.unwrap_or("password");
    let body = serde_json::json!({
        "language": "en",
        "prefix": "wp_",
        "weblog_title": "My WordPress Website",
        "user_name": user_name,
        "admin_password": password,
        "admin_password2": password,
        "Submit": "Install WordPress",
        "pw_weak": "1",
        "admin_email": "admin@localhost.com",
    });
    let (body, content_type, _) = startup_request_body_from_value(Some(&body))?;
    let mut headers = Vec::new();
    if let Some(content_type) = content_type {
        headers.push(("content-type".to_string(), content_type));
    }
    Ok(StartupHttpRequest {
        method: "POST".to_string(),
        target: "/wp-admin/install.php?step=2".to_string(),
        headers,
        body,
    })
}

fn run_import_wordpress_files_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    zip: &FileContentSource,
    path_in_zip: &str,
    host_options: &mut HostOptions,
) -> Result<()> {
    let mut old_site_url = import_wordpress_files_replace_files(mounts, index, zip, path_in_zip)?;
    let document_root =
        startup_host_path(mounts, "/wordpress", "importWordPressFiles document root")?;
    ensure_wp_config(&document_root)?;

    if old_site_url.is_none() {
        old_site_url = infer_import_wordpress_files_site_url(mounts, php, port, index)?;
    }

    let new_site_url = effective_site_url_from_host_options(host_options, port);
    let constants = vec![
        (
            "WP_HOME".to_string(),
            PhpConstantValue::string(new_site_url.clone()),
        ),
        (
            "WP_SITEURL".to_string(),
            PhpConstantValue::string(new_site_url.clone()),
        ),
    ];
    merge_defined_constants(&mut host_options.string_constants, &constants);
    php.define_constants(&constants);

    let upgrade_response = run_staged_startup_script(
        mounts,
        php,
        port,
        index,
        "import-wordpress-files-upgrade",
        import_wordpress_files_upgrade_script(),
    )?;
    if upgrade_response.exit_code != 0 {
        return Err(CliError::new(format!(
            "importWordPressFiles Blueprint step {index} database upgrade failed. Output: {}",
            response_excerpt(&upgrade_response)
        )));
    }

    if let Some(old_site_url) = old_site_url {
        replace_import_wordpress_files_scope_urls(
            mounts,
            php,
            port,
            index,
            &old_site_url,
            &new_site_url,
        )?;
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
struct ImportWordPressFilesManifest {
    #[serde(rename = "siteUrl")]
    site_url: Option<String>,
}

fn import_wordpress_files_replace_files(
    mounts: &[Mount],
    index: usize,
    zip: &FileContentSource,
    path_in_zip: &str,
) -> Result<Option<String>> {
    let document_root =
        startup_host_path(mounts, "/wordpress", "importWordPressFiles document root")?;
    let staging_vfs_path = format!("/tmp/wp-playground-native-import-wordpress-files-{index}");
    let staging_root = startup_host_path(mounts, &staging_vfs_path, "importWordPressFiles")?;
    let _ = remove_path_if_exists(&staging_root);
    fs::create_dir_all(&staging_root).map_err(|error| {
        CliError::new(format!(
            "Failed to create importWordPressFiles staging directory {}: {error}",
            staging_root.display()
        ))
    })?;

    let result = (|| {
        let bytes = read_file_content_source(mounts, zip)?;
        unzip_bytes_to_dir(&bytes, &staging_root)?;

        let import_root = import_wordpress_files_root(&staging_root, path_in_zip)?;
        let old_site_url = read_import_wordpress_files_manifest(&import_root)?;
        preserve_import_wordpress_files_wp_content(&document_root, &import_root)?;
        replace_document_root_with_import(&document_root, &import_root)?;
        Ok(old_site_url)
    })();

    let _ = remove_path_if_exists(&staging_root);
    result
}

fn import_wordpress_files_root(staging_root: &Path, path_in_zip: &str) -> Result<PathBuf> {
    let import_root = if path_in_zip.is_empty() {
        staging_root.to_path_buf()
    } else {
        let mut path = staging_root.to_path_buf();
        for part in path_in_zip.split('/').filter(|part| !part.is_empty()) {
            path.push(part);
        }
        path
    };
    if !import_root.is_dir() {
        return Err(CliError::new(format!(
            "importWordPressFiles pathInZip `{path_in_zip}` does not point to a directory in the ZIP"
        )));
    }
    Ok(import_root)
}

fn read_import_wordpress_files_manifest(import_root: &Path) -> Result<Option<String>> {
    let manifest_path = import_root.join("playground-export.json");
    if !manifest_path.is_file() {
        return Ok(None);
    }
    let contents = fs::read(&manifest_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read importWordPressFiles manifest {}: {error}",
            manifest_path.display()
        ))
    })?;
    let manifest = serde_json::from_slice::<ImportWordPressFilesManifest>(&contents).ok();
    if manifest.is_some() {
        let _ = fs::remove_file(&manifest_path);
    }
    Ok(manifest.and_then(|manifest| manifest.site_url))
}

fn preserve_import_wordpress_files_wp_content(
    document_root: &Path,
    import_root: &Path,
) -> Result<()> {
    let imported_wp_content = import_root.join("wp-content");
    let live_wp_content = document_root.join("wp-content");
    for relative_path in WP_CONTENT_FILES_EXCLUDED_FROM_EXPORT {
        let imported_path = join_relative_host_path(&imported_wp_content, relative_path);
        remove_path_if_exists(&imported_path)?;

        let live_path = join_relative_host_path(&live_wp_content, relative_path);
        if path_exists_no_follow(&live_path) {
            if let Some(parent) = imported_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    CliError::new(format!(
                        "Failed to create preserved wp-content parent {}: {error}",
                        parent.display()
                    ))
                })?;
            }
            move_startup_path(&live_path, &imported_path).map_err(|error| {
                CliError::new(format!(
                    "Failed to preserve wp-content path {} into {}: {error}",
                    live_path.display(),
                    imported_path.display()
                ))
            })?;
        }
    }

    let imported_database = imported_wp_content.join("database");
    if !path_exists_no_follow(&imported_database) {
        let live_database = live_wp_content.join("database");
        if path_exists_no_follow(&live_database) {
            if let Some(parent) = imported_database.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    CliError::new(format!(
                        "Failed to create imported database parent {}: {error}",
                        parent.display()
                    ))
                })?;
            }
            move_startup_path(&live_database, &imported_database).map_err(|error| {
                CliError::new(format!(
                    "Failed to preserve SQLite database directory {} into {}: {error}",
                    live_database.display(),
                    imported_database.display()
                ))
            })?;
        }
    }
    Ok(())
}

fn replace_document_root_with_import(document_root: &Path, import_root: &Path) -> Result<()> {
    let entries = fs::read_dir(import_root)
        .map_err(|error| {
            CliError::new(format!(
                "Failed to read importWordPressFiles directory {}: {error}",
                import_root.display()
            ))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to inspect importWordPressFiles directory {}: {error}",
                import_root.display()
            ))
        })?;

    for entry in entries {
        let target = document_root.join(entry.file_name());
        remove_path_if_exists(&target)?;
        move_startup_path(&entry.path(), &target).map_err(|error| {
            CliError::new(format!(
                "Failed to move imported WordPress path {} into {}: {error}",
                entry.path().display(),
                target.display()
            ))
        })?;
    }
    Ok(())
}

fn join_relative_host_path(root: &Path, relative_path: &str) -> PathBuf {
    let mut path = root.to_path_buf();
    for part in relative_path.split('/').filter(|part| !part.is_empty()) {
        path.push(part);
    }
    path
}

fn remove_path_if_exists(path: &Path) -> Result<()> {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return Ok(());
    };
    if metadata.is_dir() && !metadata.file_type().is_symlink() {
        fs::remove_dir_all(path).map_err(|error| {
            CliError::new(format!(
                "Failed to remove directory {}: {error}",
                path.display()
            ))
        })
    } else {
        fs::remove_file(path).map_err(|error| {
            CliError::new(format!("Failed to remove file {}: {error}", path.display()))
        })
    }
}

fn path_exists_no_follow(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

fn infer_import_wordpress_files_site_url(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
) -> Result<Option<String>> {
    let response = run_staged_startup_script(
        mounts,
        php,
        port,
        index,
        "import-wordpress-files-infer-site-url",
        import_wordpress_files_infer_site_url_script(),
    )?;
    if response.exit_code != 0 {
        return Err(CliError::new(format!(
            "importWordPressFiles Blueprint step {index} failed to infer the imported site URL. Output: {}",
            response_excerpt(&response)
        )));
    }
    let site_url = String::from_utf8_lossy(&response.stdout).trim().to_string();
    Ok((!site_url.is_empty()).then_some(site_url))
}

fn replace_import_wordpress_files_scope_urls(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    old_site_url: &str,
    new_site_url: &str,
) -> Result<()> {
    let Some(old_scope) = extract_scope_path(old_site_url) else {
        return Ok(());
    };
    let Some(new_scope) = extract_scope_path(new_site_url) else {
        return Ok(());
    };
    if old_scope == new_scope {
        return Ok(());
    }
    let response = run_staged_startup_script(
        mounts,
        php,
        port,
        index,
        "import-wordpress-files-rewrite-scope",
        &import_wordpress_files_rewrite_scope_script(&old_scope, &new_scope),
    )?;
    if response.exit_code == 0 {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "importWordPressFiles Blueprint step {index} URL rewrite failed. Output: {}",
            response_excerpt(&response)
        )))
    }
}

fn extract_scope_path(url: &str) -> Option<String> {
    let start = url.find("/scope:")?;
    let rest = &url[start..];
    let after_prefix = &rest["/scope:".len()..];
    if after_prefix.is_empty() {
        return None;
    }
    let end = after_prefix
        .find('/')
        .map(|index| "/scope:".len() + index + 1)
        .unwrap_or(rest.len());
    let mut scope = rest[..end].to_string();
    if !scope.ends_with('/') {
        scope.push('/');
    }
    Some(scope)
}

fn import_wordpress_files_infer_site_url_script() -> &'static str {
    r#"<?php
require_once '/wordpress/wp-load.php';
global $wpdb;
$row = $wpdb->get_row("SELECT option_value FROM {$wpdb->options} WHERE option_name = 'siteurl'");
echo $row ? $row->option_value : '';
"#
}

fn import_wordpress_files_upgrade_script() -> &'static str {
    r#"<?php
$_GET['step'] = 'upgrade_db';
require '/wordpress/wp-admin/upgrade.php';
"#
}

fn import_wordpress_files_rewrite_scope_script(old_scope: &str, new_scope: &str) -> String {
    format!(
        r#"<?php
require_once '/wordpress/wp-load.php';
global $wpdb;

$old_scope = {};
$new_scope = {};

$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->posts}} SET post_content = REPLACE(post_content, %s, %s)",
    $old_scope, $new_scope
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->posts}} SET post_excerpt = REPLACE(post_excerpt, %s, %s)",
    $old_scope, $new_scope
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->posts}} SET guid = REPLACE(guid, %s, %s)",
    $old_scope, $new_scope
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->postmeta}} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s",
    $old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->options}} SET option_value = REPLACE(option_value, %s, %s) WHERE option_value LIKE %s",
    $old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->usermeta}} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s",
    $old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->termmeta}} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s",
    $old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->comments}} SET comment_content = REPLACE(comment_content, %s, %s) WHERE comment_content LIKE %s",
    $old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
));
$wpdb->query($wpdb->prepare(
    "UPDATE {{$wpdb->comments}} SET comment_author_url = REPLACE(comment_author_url, %s, %s) WHERE comment_author_url LIKE %s",
    $old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
));
"#,
        php_single_quoted_string(old_scope),
        php_single_quoted_string(new_scope)
    )
}

fn run_set_site_language_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    language: &str,
    host_options: &mut HostOptions,
) -> Result<()> {
    let constants = vec![(
        "WPLANG".to_string(),
        PhpConstantValue::string(language.to_string()),
    )];
    merge_defined_constants(&mut host_options.string_constants, &constants);
    php.define_constants(&constants);

    let response = run_staged_startup_script(
        mounts,
        php,
        port,
        index,
        "set-site-language",
        &set_site_language_metadata_script(language),
    )?;
    if response.exit_code != 0 {
        return Err(CliError::new(format!(
            "setSiteLanguage Blueprint step {index} failed. Output: {}",
            response_excerpt(&response)
        )));
    }

    let metadata =
        serde_json::from_slice::<SiteLanguageMetadata>(&response.stdout).map_err(|error| {
            CliError::new(format!(
                "setSiteLanguage Blueprint step {index} returned invalid metadata: {error}. Output: {}",
                String::from_utf8_lossy(&response.stdout)
                    .chars()
                    .take(500)
                    .collect::<String>()
            ))
        })?;
    ensure_language_directories(mounts)?;

    let mut packages = vec![TranslationPackage {
        url: wordpress_translation_url(&metadata.wp_version, language)?,
        kind: TranslationPackageKind::Core,
    }];
    for plugin in metadata.plugins {
        if !plugin.slug.is_empty() && !plugin.version.is_empty() {
            packages.push(TranslationPackage {
                url: format!(
                    "https://downloads.wordpress.org/translation/plugin/{}/{}/{}.zip",
                    plugin.slug, plugin.version, language
                ),
                kind: TranslationPackageKind::Plugin,
            });
        }
    }
    for theme in metadata.themes {
        if !theme.slug.is_empty() && !theme.version.is_empty() {
            packages.push(TranslationPackage {
                url: format!(
                    "https://downloads.wordpress.org/translation/theme/{}/{}/{}.zip",
                    theme.slug, theme.version, language
                ),
                kind: TranslationPackageKind::Theme,
            });
        }
    }

    for package in packages {
        if let Err(error) = install_translation_package(mounts, &package) {
            if package.kind == TranslationPackageKind::Core {
                return Err(core_translation_download_error(language, error));
            }
            eprintln!(
                "Warning: Error downloading translations for {}: {error}",
                package.kind.as_str()
            );
        }
    }

    Ok(())
}

fn run_staged_startup_script(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    label: &str,
    code: &str,
) -> Result<PhpResponse> {
    let script_vfs_path = format!("/tmp/wp-playground-native-{label}-{index}.php");
    let script_host_path = host_path_for_vfs_path(mounts, &script_vfs_path)
        .ok_or_else(|| CliError::new(format!("Missing /tmp mount for {label} startup script")))?;
    fs::write(&script_host_path, code).map_err(|error| {
        CliError::new(format!(
            "Failed to stage {label} startup script {}: {error}",
            script_host_path.display()
        ))
    })?;

    let request = HttpRequest {
        method: "GET".to_string(),
        target: format!(
            "/__wp_playground_native_{}_{}.php",
            label.replace('-', "_"),
            index
        ),
        version: "HTTP/1.1".to_string(),
        headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
        body: Vec::new(),
    };
    let php_request = php_request_from_http(&request, &script_vfs_path, None, port);
    let response_result = php.run_sapi_request(&php_request);
    let _ = fs::remove_file(&script_host_path);
    response_result
}

#[derive(Debug, Deserialize)]
struct SiteLanguageMetadata {
    #[serde(rename = "wpVersion")]
    wp_version: String,
    plugins: Vec<TranslationTarget>,
    themes: Vec<TranslationTarget>,
}

#[derive(Debug, Deserialize)]
struct TranslationTarget {
    slug: String,
    version: String,
}

#[derive(Debug)]
struct TranslationPackage {
    url: String,
    kind: TranslationPackageKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TranslationPackageKind {
    Core,
    Plugin,
    Theme,
}

impl TranslationPackageKind {
    fn as_str(self) -> &'static str {
        match self {
            TranslationPackageKind::Core => "WordPress",
            TranslationPackageKind::Plugin => "plugin",
            TranslationPackageKind::Theme => "theme",
        }
    }

    fn destination_vfs_path(self) -> &'static str {
        match self {
            TranslationPackageKind::Core => "/wordpress/wp-content/languages",
            TranslationPackageKind::Plugin => "/wordpress/wp-content/languages/plugins",
            TranslationPackageKind::Theme => "/wordpress/wp-content/languages/themes",
        }
    }
}

fn install_translation_package(mounts: &[Mount], package: &TranslationPackage) -> Result<()> {
    let bytes = download_bytes(&package.url)?;
    let destination = startup_host_path(
        mounts,
        package.kind.destination_vfs_path(),
        "setSiteLanguage translation destination",
    )?;
    unzip_bytes_to_dir(&bytes, &destination)
}

fn ensure_language_directories(mounts: &[Mount]) -> Result<()> {
    for vfs_path in [
        "/wordpress/wp-content/languages",
        "/wordpress/wp-content/languages/plugins",
        "/wordpress/wp-content/languages/themes",
    ] {
        let host_path = startup_host_path(mounts, vfs_path, "setSiteLanguage language directory")?;
        fs::create_dir_all(&host_path).map_err(|error| {
            CliError::new(format!(
                "Failed to create language directory {}: {error}",
                host_path.display()
            ))
        })?;
    }
    Ok(())
}

fn wordpress_translation_url(wp_version: &str, language: &str) -> Result<String> {
    let mut api_url = reqwest::Url::parse("https://api.wordpress.org/translations/core/1.0/")
        .map_err(|error| {
            CliError::new(format!(
                "Failed to build WordPress translations API URL: {error}"
            ))
        })?;
    api_url.query_pairs_mut().append_pair("version", wp_version);
    let bytes = download_bytes(api_url.as_str())?;
    wordpress_translation_url_from_api_response(&bytes, language, wp_version)
}

#[derive(Debug, Deserialize)]
struct WordPressTranslationsResponse {
    translations: Vec<WordPressTranslation>,
}

#[derive(Debug, Deserialize)]
struct WordPressTranslation {
    language: String,
    package: String,
}

fn wordpress_translation_url_from_api_response(
    bytes: &[u8],
    language: &str,
    wp_version: &str,
) -> Result<String> {
    let response =
        serde_json::from_slice::<WordPressTranslationsResponse>(bytes).map_err(|error| {
            CliError::new(format!(
                "Failed to parse WordPress translations API response: {error}"
            ))
        })?;
    response
        .translations
        .into_iter()
        .find(|translation| translation.language.eq_ignore_ascii_case(language))
        .map(|translation| translation.package)
        .ok_or_else(|| {
            CliError::new(format!(
                "Failed to get {language} translation package for WordPress {wp_version}."
            ))
        })
}

fn core_translation_download_error(language: &str, source: CliError) -> CliError {
    CliError::new(format!(
        "Failed to download translations for WordPress. Please check if the language code {language} is correct. You can find all available languages and translations on https://translate.wordpress.org/. Source error: {source}"
    ))
}

fn set_site_language_metadata_script(language: &str) -> String {
    format!(
        r#"<?php
require_once '/wordpress/wp-load.php';
require_once '/wordpress/wp-admin/includes/plugin.php';
require_once '/wordpress/wp-admin/includes/theme.php';

update_option('WPLANG', {});
require '/wordpress/wp-includes/version.php';

$plugins = array_values(array_map(
    function($plugin) {{
        return array(
            'slug'    => isset($plugin['TextDomain']) ? $plugin['TextDomain'] : '',
            'version' => isset($plugin['Version']) ? $plugin['Version'] : '',
        );
    }},
    array_filter(
        get_plugins(),
        function($plugin) {{
            return !empty($plugin['TextDomain']);
        }}
    )
));

$themes = array_values(array_filter(array_map(
    function($theme) {{
        return array(
            'slug'    => $theme->get('TextDomain'),
            'version' => $theme->get('Version'),
        );
    }},
    wp_get_themes()
), function($theme) {{
    return !empty($theme['slug']);
}}));

echo json_encode(array(
    'wpVersion' => $wp_version,
    'plugins'   => $plugins,
    'themes'    => $themes,
));
"#,
        php_single_quoted_string(language)
    )
}

fn run_import_wxr_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    file: &FileContentSource,
    host_options: &HostOptions,
) -> Result<()> {
    let wxr_vfs_path = format!("/tmp/wp-playground-native-import-wxr-{index}.xml");
    let script_vfs_path = format!("/tmp/wp-playground-native-import-wxr-{index}.php");
    let wxr_host_path = host_path_for_vfs_path(mounts, &wxr_vfs_path)
        .ok_or_else(|| CliError::new("Missing /tmp mount for importWxr file"))?;
    let script_host_path = host_path_for_vfs_path(mounts, &script_vfs_path)
        .ok_or_else(|| CliError::new("Missing /tmp mount for importWxr script"))?;

    let wxr_bytes = read_file_content_source(mounts, file)?;
    fs::write(&wxr_host_path, wxr_bytes).map_err(|error| {
        CliError::new(format!(
            "Failed to stage importWxr file {}: {error}",
            wxr_host_path.display()
        ))
    })?;
    fs::write(&script_host_path, import_wxr_script()).map_err(|error| {
        CliError::new(format!(
            "Failed to stage importWxr script {}: {error}",
            script_host_path.display()
        ))
    })?;

    let site_url = effective_site_url_from_host_options(host_options, port);
    let options = PhpRunOptions {
        script: PhpRunScript::ScriptPath(script_vfs_path.clone()),
        relative_uri: "/wp-admin/import.php".to_string(),
        protocol: if site_url.starts_with("https://") {
            "https".to_string()
        } else {
            "http".to_string()
        },
        method: "GET".to_string(),
        headers: Vec::new(),
        body: Vec::new(),
        env: vec![
            ("IMPORT_FILE".to_string(), wxr_vfs_path.clone()),
            ("FETCH_ATTACHMENTS".to_string(), "true".to_string()),
        ],
        server_entries: vec![(
            "HTTPS".to_string(),
            if site_url.starts_with("https://") {
                "on".to_string()
            } else {
                String::new()
            },
        )],
    };
    let request = php_request_from_run_options(&options, &script_vfs_path)?;
    let response_result = php.run_sapi_request(&request);
    let _ = fs::remove_file(&wxr_host_path);
    let _ = fs::remove_file(&script_host_path);
    let response = response_result?;

    if response.exit_code == 0 {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "importWxr Blueprint step {index} failed. Output: {}",
            response_excerpt(&response)
        )))
    }
}

fn import_wxr_script() -> &'static str {
    r#"<?php
define('WP_LOAD_IMPORTERS', true);
require '/wordpress/wp-load.php';
require '/wordpress/wp-admin/includes/admin.php';

kses_remove_filters();

$admins = get_users(array('role' => 'Administrator', 'number' => 1));
if (empty($admins)) {
    echo 'No administrator user found for importWxr.';
    exit(1);
}
wp_set_current_user($admins[0]->ID);

$import_file = getenv('IMPORT_FILE') ?: '/tmp/import.wxr';

if (class_exists('WP_Import')) {
    $wp_import = new WP_Import();
    $import_data = $wp_import->parse($import_file);
    if (is_wp_error($import_data)) {
        echo $import_data->get_error_message();
        exit(1);
    }

    $wp_import->get_authors_from_import($import_data);
    unset($import_data);

    $wp_import->fetch_attachments = getenv('FETCH_ATTACHMENTS') === 'true';
    $_GET = array(
        'import' => 'wordpress',
        'step'   => 2,
    );
    $_POST = array(
        'imported_authors'  => array(),
        'user_map'          => array(),
        'fetch_attachments' => $wp_import->fetch_attachments,
    );

    $GLOBALS['wpcli_import_current_file'] = basename($import_file);
    $wp_import->import($import_file, array(
        'rewrite_urls' => true,
    ));
    return;
}

if (!class_exists('WXR_Importer')) {
    echo 'The wordpress-importer plugin is not active or did not load a supported importer class.';
    exit(1);
}

$GLOBALS['wpcli_import_current_file'] = basename($import_file);
$importer = new WXR_Importer(array(
    'fetch_attachments' => getenv('FETCH_ATTACHMENTS') === 'true',
    'default_author'    => $admins[0]->ID,
));
if (class_exists('WP_Importer_Logger_CLI')) {
    $importer->set_logger(new WP_Importer_Logger_CLI());
}
$result = $importer->import($import_file);
if (is_wp_error($result)) {
    echo $result->get_error_message();
    exit(1);
}
"#
}

fn run_enable_multisite_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    port: u16,
    index: usize,
    wp_cli_path: &str,
    host_options: &mut HostOptions,
) -> Result<()> {
    let site_url = effective_site_url_from_host_options(host_options, port);
    let multisite_url = multisite_url_settings(&site_url)?;
    let mut options = serde_json::Map::new();
    options.insert(
        "siteurl".to_string(),
        serde_json::Value::String(multisite_url.site_url.clone()),
    );
    options.insert(
        "home".to_string(),
        serde_json::Value::String(multisite_url.site_url.clone()),
    );
    let options_json = json_to_string(&options)?;
    run_startup_step(
        mounts,
        php,
        port,
        index,
        &StartupStep::SetSiteOptions { options_json },
    )?;

    let constants = vec![(
        "WP_ALLOW_MULTISITE".to_string(),
        PhpConstantValue::number("1"),
    )];
    merge_defined_constants(&mut host_options.string_constants, &constants);
    php.define_constants(&constants);

    run_wp_cli_startup_step(
        mounts,
        php,
        index,
        wp_cli_path,
        &[
            "core".to_string(),
            "multisite-convert".to_string(),
            format!("--base={}", multisite_url.site_path),
        ],
    )?;
    remove_wp_allow_multisite_from_wp_config(mounts)?;
    patch_wp_config_http_host(mounts, &multisite_url.host)
}

fn effective_site_url_from_host_options(host_options: &HostOptions, port: u16) -> String {
    host_options
        .string_constants
        .iter()
        .rev()
        .find_map(|(name, value)| {
            if name == "WP_HOME" {
                if let PhpConstantValue::String(value) = value {
                    return Some(value.clone());
                }
            }
            None
        })
        .unwrap_or_else(|| format!("http://127.0.0.1:{port}"))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MultisiteUrlSettings {
    host: String,
    site_path: String,
    site_url: String,
}

fn multisite_url_settings(site_url: &str) -> Result<MultisiteUrlSettings> {
    let url = reqwest::Url::parse(site_url)
        .map_err(|error| CliError::new(format!("enableMultisite site URL is invalid: {error}")))?;
    let host = url
        .host()
        .map(|host| host.to_string())
        .ok_or_else(|| CliError::new("enableMultisite site URL must include a host"))?;
    if let Some(port) = url.port() {
        let mut message = format!(
            "The current host is {host}:{port}, but WordPress multisites do not support custom ports."
        );
        if url.host_str() == Some("localhost") {
            message.push_str(
                " For development, configure a portless local domain and pass it with --site-url.",
            );
        }
        return Err(CliError::new(message));
    }
    let mut site_path = url.path().trim_end_matches('/').to_string();
    site_path.push('/');
    let site_url = format!("{}://{host}{site_path}", url.scheme());
    Ok(MultisiteUrlSettings {
        host,
        site_path,
        site_url,
    })
}

fn patch_wp_config_http_host(mounts: &[Mount], host: &str) -> Result<()> {
    let wp_config_path = host_path_for_vfs_path(mounts, "/wordpress/wp-config.php")
        .ok_or_else(|| CliError::new("Missing /wordpress/wp-config.php for enableMultisite"))?;
    let wp_config = fs::read_to_string(&wp_config_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read wp-config.php for enableMultisite at {}: {error}",
            wp_config_path.display()
        ))
    })?;
    let new_wp_config = inject_http_host_into_wp_config(&wp_config, host);
    if new_wp_config == wp_config {
        return Ok(());
    }
    fs::write(&wp_config_path, new_wp_config).map_err(|error| {
        CliError::new(format!(
            "Failed to write wp-config.php for enableMultisite at {}: {error}",
            wp_config_path.display()
        ))
    })
}

fn remove_wp_allow_multisite_from_wp_config(mounts: &[Mount]) -> Result<()> {
    let wp_config_path = host_path_for_vfs_path(mounts, "/wordpress/wp-config.php")
        .ok_or_else(|| CliError::new("Missing /wordpress/wp-config.php for enableMultisite"))?;
    let wp_config = fs::read_to_string(&wp_config_path).map_err(|error| {
        CliError::new(format!(
            "Failed to read wp-config.php for enableMultisite at {}: {error}",
            wp_config_path.display()
        ))
    })?;
    let new_wp_config = remove_wp_allow_multisite_define(&wp_config);
    if new_wp_config == wp_config {
        return Ok(());
    }
    fs::write(&wp_config_path, new_wp_config).map_err(|error| {
        CliError::new(format!(
            "Failed to write wp-config.php for enableMultisite at {}: {error}",
            wp_config_path.display()
        ))
    })
}

fn remove_wp_allow_multisite_define(wp_config: &str) -> String {
    let mut output = String::new();
    for line in wp_config.split_inclusive('\n') {
        if !line.contains("WP_ALLOW_MULTISITE") {
            output.push_str(line);
        }
    }
    if !wp_config.ends_with('\n') {
        if let Some(line) = wp_config.rsplit('\n').next() {
            if !line.contains("WP_ALLOW_MULTISITE") && !output.ends_with(line) {
                output.push_str(line);
            }
        }
    }
    output
}

fn inject_http_host_into_wp_config(wp_config: &str, host: &str) -> String {
    if wp_config.contains("$_SERVER['HTTP_HOST']") {
        return wp_config.to_string();
    }
    let assignment = format!(
        "$_SERVER['HTTP_HOST'] = {};\n",
        php_single_quoted_string(host)
    );
    if wp_config
        .get(..5)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("<?php"))
    {
        let mut insert_at = 5;
        while let Some(character) = wp_config[insert_at..].chars().next() {
            if !character.is_whitespace() {
                break;
            }
            insert_at += character.len_utf8();
        }
        format!("<?php\n{assignment}{}", &wp_config[insert_at..])
    } else {
        format!("<?php\n{assignment}{wp_config}")
    }
}

fn run_wp_cli_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    index: usize,
    wp_cli_path: &str,
    args: &[String],
) -> Result<()> {
    ensure_wp_cli_phar(mounts, wp_cli_path)?;
    let script_vfs_path = "/wordpress/run-cli.php";
    let script_host_path = host_path_for_vfs_path(mounts, script_vfs_path)
        .ok_or_else(|| CliError::new("Missing /wordpress mount for wp-cli startup script"))?;
    fs::write(&script_host_path, wp_cli_runner_script(wp_cli_path, args)).map_err(|error| {
        CliError::new(format!(
            "Failed to stage wp-cli runner {}: {error}",
            script_host_path.display()
        ))
    })?;

    let options = PhpRunOptions {
        script: PhpRunScript::ScriptPath(script_vfs_path.to_string()),
        relative_uri: String::new(),
        protocol: "http".to_string(),
        method: "GET".to_string(),
        headers: Vec::new(),
        body: Vec::new(),
        env: Vec::new(),
        server_entries: Vec::new(),
    };
    let request = php_request_from_run_options(&options, script_vfs_path)?;
    let response = php.run_sapi_request(&request)?;
    if response.exit_code == 0 {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&response.stderr);
        let detail = if stderr.trim().is_empty() {
            response_excerpt(&response)
        } else {
            stderr.trim().to_string()
        };
        Err(CliError::new(format!(
            "wp-cli Blueprint step {index} failed. Output: {detail}"
        )))
    }
}

fn ensure_wp_cli_phar(mounts: &[Mount], wp_cli_path: &str) -> Result<()> {
    let host_path = host_path_for_vfs_path(mounts, wp_cli_path).ok_or_else(|| {
        CliError::new(format!(
            "wp-cli.phar path {wp_cli_path} is not inside a mounted directory"
        ))
    })?;
    if host_path.is_file() {
        validate_wp_cli_phar(&host_path)?;
        return Ok(());
    }
    if host_path.exists() {
        return Err(CliError::new(format!(
            "wp-cli.phar path {wp_cli_path} exists but is not a file"
        )));
    }
    if wp_cli_path != DEFAULT_WP_CLI_PATH {
        return Err(CliError::new(format!(
            "wp-cli.phar not found at {wp_cli_path}; only the default {DEFAULT_WP_CLI_PATH} path is auto-downloaded"
        )));
    }
    if let Some(parent) = host_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            CliError::new(format!(
                "Failed to create wp-cli.phar directory {}: {error}",
                parent.display()
            ))
        })?;
    }
    let cached = cached_download_with_validator(
        DEFAULT_WP_CLI_URL,
        "blueprint-wp-cli.phar",
        validate_wp_cli_phar,
    )?;
    fs::copy(&cached, &host_path).map_err(|error| {
        CliError::new(format!(
            "Failed to install wp-cli.phar to {}: {error}",
            host_path.display()
        ))
    })?;
    validate_wp_cli_phar(&host_path)
}

fn validate_wp_cli_phar(path: &Path) -> Result<()> {
    let metadata = fs::metadata(path).map_err(|error| {
        CliError::new(format!(
            "Failed to inspect wp-cli.phar {}: {error}",
            path.display()
        ))
    })?;
    if !metadata.is_file() || metadata.len() < 1024 {
        return Err(CliError::new(format!(
            "wp-cli.phar {} is missing or too small",
            path.display()
        )));
    }
    Ok(())
}

fn wp_cli_runner_script(wp_cli_path: &str, args: &[String]) -> String {
    format!(
        r#"<?php
putenv('SHELL_PIPE=0');
$GLOBALS['argv'] = array_merge([
    {wp_cli_path},
    '--path=/wordpress',
], {args});
define('STDIN', fopen('php://stdin', 'rb'));
define('STDOUT', fopen('php://stdout', 'wb'));
define('STDERR', fopen('php://stderr', 'wb'));
require({wp_cli_path});
"#,
        wp_cli_path = php_single_quoted_string(wp_cli_path),
        args = php_string_array_literal(args),
    )
}

fn php_string_array_literal(values: &[String]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|value| php_single_quoted_string(value))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

fn run_php_with_options_startup_step(
    mounts: &[Mount],
    php: &mut PhpInstance,
    index: usize,
    options: &PhpRunOptions,
) -> Result<()> {
    let mut cleanup_path = None;
    let script_vfs_path = match &options.script {
        PhpRunScript::Code(code) => {
            let script_vfs_path = format!("/tmp/wp-playground-native-run-options-{index}.php");
            let script_host_path = host_path_for_vfs_path(mounts, &script_vfs_path)
                .ok_or_else(|| CliError::new("Missing /tmp mount for runPHPWithOptions code"))?;
            fs::write(&script_host_path, code).map_err(|error| {
                CliError::new(format!(
                    "Failed to stage runPHPWithOptions code {}: {error}",
                    script_host_path.display()
                ))
            })?;
            cleanup_path = Some(script_host_path);
            script_vfs_path
        }
        PhpRunScript::ScriptPath(script_path) => {
            if let Some(host_path) = host_path_for_vfs_path(mounts, script_path) {
                if !host_path.is_file() {
                    return Err(CliError::new(format!(
                        "runPHPWithOptions scriptPath {script_path} does not point to a file"
                    )));
                }
            }
            script_path.clone()
        }
    };

    let request = php_request_from_run_options(options, &script_vfs_path)?;
    let response_result = php.run_sapi_request(&request);
    if let Some(path) = cleanup_path {
        let _ = fs::remove_file(path);
    }
    let response = response_result?;

    if response.exit_code == 0 {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "Startup Blueprint step {index} failed. Output: {}",
            response_excerpt(&response)
        )))
    }
}

fn install_downloadable_asset(
    mounts: &[Mount],
    asset: &InstallAssetStep,
    target_vfs_path: &str,
    label: &str,
) -> Result<String> {
    let target_dir = host_path_for_vfs_path(mounts, target_vfs_path).ok_or_else(|| {
        CliError::new(format!(
            "Cannot install {label}: missing host mount for {target_vfs_path}"
        ))
    })?;
    fs::create_dir_all(&target_dir).map_err(|error| {
        CliError::new(format!(
            "Failed to create {label} install directory {}: {error}",
            target_dir.display()
        ))
    })?;
    let (zip_path, temporary_zip) = asset_zip_source_path(mounts, &target_dir, &asset.source)?;
    let result = install_asset_zip(
        &zip_path,
        asset.source.filename(),
        &target_dir,
        asset.target_folder_name.as_deref(),
        asset.if_already_installed,
    );
    if let Some(temporary_zip) = temporary_zip {
        let _ = fs::remove_file(temporary_zip);
    }
    result
}

fn install_plugin_asset(mounts: &[Mount], asset: &InstallAssetStep) -> Result<String> {
    let filename = asset.source.filename();
    if !is_php_plugin_file_name(filename) {
        let folder_name =
            install_downloadable_asset(mounts, asset, "/wordpress/wp-content/plugins", "plugin")?;
        return Ok(format!("/wordpress/wp-content/plugins/{folder_name}"));
    }

    let target_dir =
        host_path_for_vfs_path(mounts, "/wordpress/wp-content/plugins").ok_or_else(|| {
            CliError::new(
                "Cannot install plugin: missing host mount for /wordpress/wp-content/plugins",
            )
        })?;
    fs::create_dir_all(&target_dir).map_err(|error| {
        CliError::new(format!(
            "Failed to create plugin install directory {}: {error}",
            target_dir.display()
        ))
    })?;
    let target_path = target_dir.join(filename);
    if target_path.exists() {
        match asset.if_already_installed {
            IfAlreadyInstalled::Skip => {
                return Ok(format!("/wordpress/wp-content/plugins/{filename}"));
            }
            IfAlreadyInstalled::Error => {
                return Err(CliError::new(format!(
                    "Cannot install plugin {filename}: destination exists and ifAlreadyInstalled was set to error"
                )));
            }
            IfAlreadyInstalled::Overwrite => {
                if target_path.is_dir() {
                    return Err(CliError::new(format!(
                        "Cannot overwrite plugin file {filename}: destination is a directory"
                    )));
                }
            }
        }
    }
    let bytes = read_install_asset_source_bytes(mounts, &asset.source)?;
    fs::write(&target_path, bytes).map_err(|error| {
        CliError::new(format!(
            "Failed to install plugin file {}: {error}",
            target_path.display()
        ))
    })?;
    Ok(format!("/wordpress/wp-content/plugins/{filename}"))
}

fn read_install_asset_source_bytes(
    mounts: &[Mount],
    source: &InstallAssetSource,
) -> Result<Vec<u8>> {
    match source {
        InstallAssetSource::Download(asset) => download_bytes(&asset.url),
        InstallAssetSource::LocalFile { path, .. } => fs::read(path).map_err(|error| {
            CliError::new(format!(
                "Failed to read plugin file {}: {error}",
                path.display()
            ))
        }),
        InstallAssetSource::BundledFile { bytes, .. } => Ok(bytes.clone()),
        InstallAssetSource::Content { source, .. } => read_file_content_source(mounts, source),
    }
}

fn asset_zip_source_path(
    mounts: &[Mount],
    target_dir: &Path,
    source: &InstallAssetSource,
) -> Result<(PathBuf, Option<PathBuf>)> {
    match source {
        InstallAssetSource::Download(asset) => {
            let zip_path = cached_download_with_validator(&asset.url, &asset.cache_key, |path| {
                validate_install_asset_zip(path, &asset.filename)
            })?;
            Ok((zip_path, None))
        }
        InstallAssetSource::LocalFile { path, filename } => {
            validate_install_asset_zip(path, filename)?;
            Ok((path.clone(), None))
        }
        InstallAssetSource::BundledFile { bytes, .. } => {
            stage_temporary_asset_zip(target_dir, bytes, source.filename())
        }
        InstallAssetSource::Content {
            source: content, ..
        } => {
            let bytes = read_file_content_source(mounts, content)?;
            stage_temporary_asset_zip(target_dir, &bytes, source.filename())
        }
    }
}

fn stage_temporary_asset_zip(
    target_dir: &Path,
    bytes: &[u8],
    filename: &str,
) -> Result<(PathBuf, Option<PathBuf>)> {
    let temporary_zip = target_dir.join(format!(
        ".wp-playground-native-bundled-{}-{}.zip",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    fs::write(&temporary_zip, bytes).map_err(|error| {
        CliError::new(format!(
            "Failed to stage bundled asset ZIP {}: {error}",
            temporary_zip.display()
        ))
    })?;
    validate_install_asset_zip(&temporary_zip, filename)?;
    Ok((temporary_zip.clone(), Some(temporary_zip)))
}

fn validate_install_asset_zip(zip_path: &Path, zip_filename: &str) -> Result<()> {
    let file = fs::File::open(zip_path).map_err(|error| {
        CliError::new(format!(
            "Failed to open downloaded asset ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    let mut archive = ZipArchive::new(file).map_err(|error| {
        CliError::new(format!(
            "Failed to read downloaded asset ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    asset_zip_layout(&mut archive, zip_filename, None)?;
    Ok(())
}

fn install_asset_zip(
    zip_path: &Path,
    zip_filename: &str,
    target_dir: &Path,
    target_folder_name: Option<&str>,
    if_already_installed: IfAlreadyInstalled,
) -> Result<String> {
    let file = fs::File::open(zip_path).map_err(|error| {
        CliError::new(format!(
            "Failed to open downloaded asset ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    let mut archive = ZipArchive::new(file).map_err(|error| {
        CliError::new(format!(
            "Failed to read downloaded asset ZIP {}: {error}",
            zip_path.display()
        ))
    })?;
    let layout = asset_zip_layout(&mut archive, zip_filename, target_folder_name)?;
    let destination = target_dir.join(&layout.asset_folder_name);

    if destination.exists() {
        if !destination.is_dir() {
            return Err(CliError::new(format!(
                "Cannot install asset {} to {} because a file with the same name already exists.",
                layout.asset_folder_name,
                destination.display()
            )));
        }
        match if_already_installed {
            IfAlreadyInstalled::Overwrite => {}
            IfAlreadyInstalled::Skip => return Ok(layout.asset_folder_name),
            IfAlreadyInstalled::Error => {
                return Err(CliError::new(format!(
                    "Cannot install asset {} to {} because it already exists and ifAlreadyInstalled was set to error.",
                    layout.asset_folder_name,
                    target_dir.display()
                )));
            }
        }
    }

    let staging_root = target_dir.join(format!(
        ".wp-playground-native-install-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    let staging_asset = staging_root.join("asset");
    fs::create_dir_all(&staging_asset).map_err(|error| {
        CliError::new(format!(
            "Failed to create temporary asset install directory {}: {error}",
            staging_asset.display()
        ))
    })?;

    let result = extract_asset_zip(&mut archive, layout.root_folder.as_deref(), &staging_asset)
        .and_then(|_| {
            if destination.exists() {
                fs::remove_dir_all(&destination).map_err(|error| {
                    CliError::new(format!(
                        "Failed to remove existing asset directory {}: {error}",
                        destination.display()
                    ))
                })?;
            }
            fs::rename(&staging_asset, &destination).map_err(|error| {
                CliError::new(format!(
                    "Failed to install asset into {}: {error}",
                    destination.display()
                ))
            })?;
            Ok(layout.asset_folder_name.clone())
        });

    let _ = fs::remove_dir_all(&staging_root);
    result
}

fn unzip_bytes_to_dir(bytes: &[u8], destination: &Path) -> Result<()> {
    fs::create_dir_all(destination).map_err(|error| {
        CliError::new(format!(
            "Failed to create unzip destination {}: {error}",
            destination.display()
        ))
    })?;
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| CliError::new(format!("Failed to read unzip ZIP: {error}")))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read unzip ZIP entry: {error}")))?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        if enclosed_name.as_os_str().is_empty() {
            continue;
        }
        let normalized = zip_path_to_string(&enclosed_name);
        let target = join_zip_relative_path(destination, &normalized);
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|error| {
                CliError::new(format!(
                    "Failed to create unzip directory {}: {error}",
                    target.display()
                ))
            })?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    CliError::new(format!(
                        "Failed to create unzip parent {}: {error}",
                        parent.display()
                    ))
                })?;
            }
            let mut output = fs::File::create(&target).map_err(|error| {
                CliError::new(format!(
                    "Failed to create unzip output {}: {error}",
                    target.display()
                ))
            })?;
            std::io::copy(&mut entry, &mut output).map_err(|error| {
                CliError::new(format!(
                    "Failed to extract unzip ZIP entry {normalized}: {error}"
                ))
            })?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AssetZipLayout {
    root_folder: Option<String>,
    asset_folder_name: String,
}

fn asset_zip_layout<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    zip_filename: &str,
    target_folder_name: Option<&str>,
) -> Result<AssetZipLayout> {
    let mut top_level_dirs = BTreeSet::new();
    let mut has_root_file = false;
    let mut has_installable_entry = false;

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read asset ZIP entry: {error}")))?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let normalized = zip_path_to_string(&enclosed_name);
        let Some(first) = first_zip_path_component(&normalized) else {
            continue;
        };
        if first == "__MACOSX" {
            continue;
        }
        has_installable_entry = true;
        if zip_path_has_nested_component(&normalized) || entry.is_dir() {
            top_level_dirs.insert(first.to_string());
        } else {
            has_root_file = true;
        }
    }

    if !has_installable_entry {
        return Err(CliError::new(
            "Asset ZIP does not contain installable files",
        ));
    }

    let root_folder = if !has_root_file && top_level_dirs.len() == 1 {
        top_level_dirs.iter().next().cloned()
    } else {
        None
    };
    let inferred_folder = root_folder
        .clone()
        .unwrap_or_else(|| asset_folder_name_from_zip_filename(zip_filename));
    let asset_folder_name = target_folder_name
        .filter(|name| !name.is_empty())
        .unwrap_or(&inferred_folder)
        .to_string();
    validate_asset_folder_name(&asset_folder_name)?;

    Ok(AssetZipLayout {
        root_folder,
        asset_folder_name,
    })
}

fn extract_asset_zip<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    root_folder: Option<&str>,
    destination: &Path,
) -> Result<()> {
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| CliError::new(format!("Failed to read asset ZIP entry: {error}")))?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let normalized = zip_path_to_string(&enclosed_name);
        let Some(first) = first_zip_path_component(&normalized) else {
            continue;
        };
        if first == "__MACOSX" {
            continue;
        }
        let Some(relative_path) = asset_relative_zip_path(&normalized, root_folder) else {
            continue;
        };
        if relative_path.is_empty() {
            continue;
        }
        let host_path = join_zip_relative_path(destination, relative_path);
        if entry.is_dir() {
            fs::create_dir_all(&host_path)?;
        } else {
            if let Some(parent) = host_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut output = fs::File::create(&host_path)?;
            std::io::copy(&mut entry, &mut output).map_err(|error| {
                CliError::new(format!(
                    "Failed to extract asset ZIP entry {normalized}: {error}"
                ))
            })?;
        }
    }
    Ok(())
}

fn asset_relative_zip_path<'a>(path: &'a str, root_folder: Option<&str>) -> Option<&'a str> {
    match root_folder {
        Some(root) if path == root => Some(""),
        Some(root) => path.strip_prefix(&(root.to_string() + "/")),
        None => Some(path),
    }
}

fn first_zip_path_component(path: &str) -> Option<&str> {
    path.split('/').find(|part| !part.is_empty())
}

fn zip_path_has_nested_component(path: &str) -> bool {
    path.split('/').filter(|part| !part.is_empty()).count() > 1
}

fn join_zip_relative_path(root: &Path, relative_path: &str) -> PathBuf {
    let mut path = root.to_path_buf();
    for part in relative_path.split('/').filter(|part| !part.is_empty()) {
        path.push(part);
    }
    path
}

fn asset_folder_name_from_zip_filename(zip_filename: &str) -> String {
    let filename = zip_filename
        .rsplit(['/', '\\'])
        .find(|part| !part.is_empty())
        .unwrap_or("asset.zip");
    let without_zip = filename.strip_suffix(".zip").unwrap_or(filename);
    if without_zip.is_empty() {
        "asset".to_string()
    } else {
        without_zip.to_string()
    }
}

fn validate_asset_folder_name(folder_name: &str) -> Result<()> {
    if folder_name.is_empty()
        || folder_name == "."
        || folder_name == ".."
        || folder_name.contains(['/', '\\', '\0'])
    {
        return Err(CliError::new(format!(
            "Invalid asset target folder name `{folder_name}`"
        )));
    }
    Ok(())
}

fn set_site_options_script(options_json: &str) -> String {
    format!(
        r#"<?php
require_once '/wordpress/wp-load.php';
$options = json_decode({}, true);
if (!is_array($options)) {{
    echo 'Invalid setSiteOptions payload';
    exit(1);
}}
foreach ($options as $name => $value) {{
    update_option($name, $value);
}}
"#,
        php_single_quoted_string(options_json)
    )
}

fn define_wp_config_consts_script(constants: &[(String, PhpConstantValue)]) -> Result<String> {
    let constants_json = php_constants_json(constants)?;
    let transformer = WP_CONFIG_TRANSFORMER
        .trim_start()
        .strip_prefix("<?php")
        .unwrap_or(WP_CONFIG_TRANSFORMER);
    Ok(format!(
        r#"<?php
{transformer}
$wp_config_path = '/wordpress/wp-config.php';
$transformer = WP_Config_Transformer::from_file($wp_config_path);
$transformer->define_constants(json_decode({}, true));
$transformer->to_file($wp_config_path);
"#,
        php_single_quoted_string(&constants_json)
    ))
}

fn php_constants_json(constants: &[(String, PhpConstantValue)]) -> Result<String> {
    let mut json = serde_json::Map::new();
    for (name, value) in constants {
        let value = match value {
            PhpConstantValue::String(value) => serde_json::Value::String(value.clone()),
            PhpConstantValue::Bool(value) => serde_json::Value::Bool(*value),
            PhpConstantValue::Number(value) => {
                let number = serde_json::Number::from_f64(value.parse::<f64>().map_err(|_| {
                    CliError::new(format!(
                        "defineWpConfigConsts number constant `{name}` must be finite"
                    ))
                })?)
                .ok_or_else(|| {
                    CliError::new(format!(
                        "defineWpConfigConsts number constant `{name}` must be finite"
                    ))
                })?;
                serde_json::Value::Number(number)
            }
        };
        json.insert(name.clone(), value);
    }
    serde_json::to_string(&json)
        .map_err(|error| CliError::new(format!("Failed to serialize constants: {error}")))
}

fn update_user_meta_script(user_id: u64, meta_json: &str) -> String {
    format!(
        r#"<?php
require_once '/wordpress/wp-load.php';
$meta = json_decode({}, true);
if (!is_array($meta)) {{
    echo 'Invalid updateUserMeta payload';
    exit(1);
}}
foreach ($meta as $name => $value) {{
    update_user_meta({}, $name, $value);
}}
"#,
        php_single_quoted_string(meta_json),
        user_id
    )
}

fn reset_data_script() -> String {
    r#"<?php
require_once '/wordpress/wp-load.php';
if (!isset($GLOBALS['@pdo']) || !($GLOBALS['@pdo'] instanceof PDO)) {
    echo 'The resetData step requires the SQLite database integration PDO handle.';
    exit(1);
}
$GLOBALS['@pdo']->query('DELETE FROM wp_posts WHERE id > 0');
$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_posts'");

$GLOBALS['@pdo']->query('DELETE FROM wp_postmeta WHERE post_id > 1');
$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=20 WHERE NAME='wp_postmeta'");

$GLOBALS['@pdo']->query('DELETE FROM wp_comments');
$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_comments'");

$GLOBALS['@pdo']->query('DELETE FROM wp_commentmeta');
$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_commentmeta'");
"#
    .to_string()
}

fn run_sql_script(sql_vfs_path: &str, stream_class_vfs_path: &str) -> String {
    format!(
        r#"<?php
define('WP_SQLITE_AST_DRIVER', true);
require_once '/wordpress/wp-load.php';
require_once {};

global $wpdb;

do_action('run_sql_step');

$stream = new WP_MySQL_Naive_Query_Stream();
$handle = fopen({}, 'r');
if (!$handle) {{
    echo 'Failed to open SQL file';
    exit(1);
}}

$chunk_size = 8192;
while (!feof($handle)) {{
    $chunk = fread($handle, $chunk_size);
    if ($chunk === false) {{
        break;
    }}
    $stream->append_sql($chunk);
    while ($stream->next_query()) {{
        $query = $stream->get_query();
        $wpdb->query($query);
    }}
}}
fclose($handle);

$stream->mark_input_complete();
while ($stream->next_query()) {{
    $query = $stream->get_query();
    $wpdb->query($query);
}}
"#,
        php_single_quoted_string(stream_class_vfs_path),
        php_single_quoted_string(sql_vfs_path)
    )
}

fn activate_plugin_script(plugin_path: &str) -> String {
    format!(
        r#"<?php
define('WP_ADMIN', true);
require_once '/wordpress/wp-load.php';
require_once '/wordpress/wp-admin/includes/plugin.php';
$users = get_users(array('role' => 'Administrator', 'number' => 1));
if (!empty($users)) {{
    wp_set_current_user($users[0]->ID);
}}
$plugin_path = {};
$relative_plugin_path = null;
$response = false;
$plugin_directory = rtrim(WP_PLUGIN_DIR, '/') . '/';
if (is_dir($plugin_path)) {{
    foreach ((glob(rtrim($plugin_path, '/') . '/*.php') ?: array()) as $file) {{
        $info = get_plugin_data($file, false, false);
        if (!empty($info['Name'])) {{
            $relative_plugin_path = $file;
            if (strpos($relative_plugin_path, $plugin_directory) === 0) {{
                $relative_plugin_path = substr($relative_plugin_path, strlen($plugin_directory));
            }}
            $response = activate_plugin($relative_plugin_path);
            break;
        }}
    }}
}} else {{
    $relative_plugin_path = $plugin_path;
    if (strpos($relative_plugin_path, $plugin_directory) === 0) {{
        $relative_plugin_path = substr($relative_plugin_path, strlen($plugin_directory));
    }}
    $response = activate_plugin($relative_plugin_path);
}}
if (is_wp_error($response)) {{
    echo $response->get_error_message();
    exit(1);
}}
if ($response === false || !$relative_plugin_path) {{
    echo "The activatePlugin step wasn't able to find the plugin $plugin_path.";
    exit(1);
}}
$active_plugins = get_option('active_plugins');
if (!is_array($active_plugins) || !in_array($relative_plugin_path, $active_plugins, true)) {{
    echo "Plugin $relative_plugin_path was not active after activation.";
    exit(1);
}}
"#,
        php_single_quoted_string(plugin_path)
    )
}

fn activate_theme_script(theme_folder_name: &str) -> String {
    format!(
        r#"<?php
define('WP_ADMIN', true);
require_once '/wordpress/wp-load.php';
$users = get_users(array('role' => 'Administrator', 'number' => 1));
if (!empty($users)) {{
    wp_set_current_user($users[0]->ID);
}}
$theme = {};
if (!is_dir('/wordpress/wp-content/themes/' . $theme)) {{
    echo "Theme $theme was not found.";
    exit(1);
}}
switch_theme($theme);
if (wp_get_theme()->get_stylesheet() !== $theme) {{
    echo "Theme $theme could not be activated.";
    exit(1);
}}
"#,
        php_single_quoted_string(theme_folder_name)
    )
}

fn activate_first_theme_script() -> String {
    r#"<?php
require_once '/wordpress/wp-load.php';
$theme = wp_get_theme();
if (!$theme->exists()) {
    $themes = wp_get_themes();
    if (count($themes) > 0) {
        $themeName = array_keys($themes)[0];
        switch_theme($themeName);
    }
}
"#
    .to_string()
}

fn import_theme_starter_content_script(theme_folder_name: &str) -> String {
    format!(
        r#"<?php
function wp_playground_native_import_theme_starter_content_plugins_loaded() {{
    $admins = get_users(array('role' => 'Administrator', 'number' => 1));
    if (!empty($admins)) {{
        wp_set_current_user($admins[0]->ID);
    }}

    add_filter('pre_option_fresh_site', '__return_true');

    $_REQUEST['wp_customize']    = 'on';
    $_REQUEST['customize_theme'] = {};
    $_REQUEST['action']          = 'customize_save';
    add_filter('wp_doing_ajax', '__return_true');

    $_GET = $_REQUEST;
}}
playground_add_filter('plugins_loaded', 'wp_playground_native_import_theme_starter_content_plugins_loaded', 0);

require_once '/wordpress/wp-load.php';

if (!get_theme_starter_content()) {{
    return;
}}

if (!isset($wp_customize) || !method_exists($wp_customize, 'import_theme_starter_content')) {{
    echo 'The WordPress Customizer was not initialized for starter content import.';
    exit(1);
}}

$wp_customize->import_theme_starter_content();
wp_publish_post($wp_customize->changeset_post_id());
"#,
        php_single_quoted_string(theme_folder_name)
    )
}

fn php_single_quoted_string(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "\\'"))
}

fn json_to_string(value: &serde_json::Map<String, serde_json::Value>) -> Result<String> {
    serde_json::to_string(value)
        .map_err(|error| CliError::new(format!("Failed to serialize Blueprint JSON: {error}")))
}

fn response_excerpt(response: &PhpResponse) -> String {
    let mut text = String::from_utf8_lossy(&response.stdout).into_owned();
    if text.trim().is_empty() && !response.stderr.is_empty() {
        text = String::from_utf8_lossy(&response.stderr).into_owned();
    }
    if let Some(message) = extract_wp_die_message(&text) {
        text = message;
    }
    text.replace(['\r', '\n'], " ").chars().take(1000).collect()
}

fn extract_wp_die_message(text: &str) -> Option<String> {
    let marker = "wp-die-message";
    let start = text.find(marker)?;
    let after_marker = &text[start..];
    let open_end = after_marker.find('>')?;
    let message = &after_marker[open_end + 1..];
    let end = message.find("</div>").unwrap_or(message.len());
    Some(strip_html_tags(&message[..end]))
}

fn strip_html_tags(text: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for character in text.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    output
}

#[cfg(test)]
fn resolve_route(mounts: &[Mount], target: &str) -> Result<RouteTarget> {
    resolve_route_with_symlink_policy(mounts, target, SymlinkPolicy::BlockEscapes)
}

fn resolve_route_with_symlink_policy(
    mounts: &[Mount],
    target: &str,
    symlink_policy: SymlinkPolicy,
) -> Result<RouteTarget> {
    resolve_route_with_symlink_policy_with_counters(mounts, target, symlink_policy, None)
}

fn resolve_route_with_symlink_policy_with_counters(
    mounts: &[Mount],
    target: &str,
    symlink_policy: SymlinkPolicy,
    _counter: Option<RouteCounterContext<'_>>,
) -> Result<RouteTarget> {
    let request_path = request_path_from_target(target)?;
    let vfs_path = if request_path == "/" {
        "/wordpress".to_string()
    } else {
        normalize_vfs_path(&format!("/wordpress/{request_path}"))?
    };

    let candidates = route_candidates(&vfs_path);
    for candidate in &candidates {
        if let Some(host_path) =
            host_path_for_vfs_path_with_symlink_policy(mounts, candidate, symlink_policy)
        {
            if host_path.is_file() {
                if is_php_vfs_path(candidate) {
                    return Ok(RouteTarget::Php {
                        vfs_path: candidate.clone(),
                        path_info: None,
                    });
                }
                return Ok(RouteTarget::Static { host_path });
            }
        }
    }

    if let Some((vfs_path, path_info)) =
        php_script_with_path_info_with_symlink_policy(mounts, &vfs_path, symlink_policy)
    {
        return Ok(RouteTarget::Php {
            vfs_path,
            path_info: Some(path_info),
        });
    }

    if is_missing_static_wordpress_asset(&vfs_path) {
        return Ok(RouteTarget::NotFound);
    }

    if let Some(host_path) =
        host_path_for_vfs_path_with_symlink_policy(mounts, "/wordpress/index.php", symlink_policy)
    {
        if host_path.is_file() {
            return Ok(RouteTarget::Php {
                vfs_path: "/wordpress/index.php".to_string(),
                path_info: None,
            });
        }
    }

    Ok(RouteTarget::NotFound)
}

fn route_candidates(vfs_path: &str) -> Vec<String> {
    let mut candidates = Vec::new();
    candidates.push(vfs_path.to_string());
    if let Some(host_path) = Path::new(vfs_path)
        .file_name()
        .and_then(|name| name.to_str())
    {
        if host_path.contains('.') {
            return candidates;
        }
    }
    candidates.push(normalize_vfs_path(&format!("{vfs_path}/index.php")).unwrap());
    candidates.push(normalize_vfs_path(&format!("{vfs_path}/index.html")).unwrap());
    candidates
}

fn is_php_vfs_path(path: &str) -> bool {
    path.get(path.len().saturating_sub(4)..)
        .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".php"))
}

fn is_missing_static_wordpress_asset(path: &str) -> bool {
    if is_php_vfs_path(path) {
        return false;
    }
    let Some(file_name) = Path::new(path).file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    if !file_name.contains('.') {
        return false;
    }
    path.starts_with("/wordpress/wp-admin/")
        || path.starts_with("/wordpress/wp-includes/")
        || path.starts_with("/wordpress/wp-content/")
}

fn php_script_with_path_info_with_symlink_policy(
    mounts: &[Mount],
    vfs_path: &str,
    symlink_policy: SymlinkPolicy,
) -> Option<(String, String)> {
    let trimmed = vfs_path.trim_end_matches('/');
    let mut search = trimmed;
    while let Some(index) = search.rfind('/') {
        let script = &search[..index];
        if script.is_empty() {
            break;
        }
        if is_php_vfs_path(script) {
            if let Some(host_path) =
                host_path_for_vfs_path_with_symlink_policy(mounts, script, symlink_policy)
            {
                if host_path.is_file() {
                    return Some((script.to_string(), trimmed[script.len()..].to_string()));
                }
            }
        }
        search = script;
    }
    None
}

fn host_path_for_vfs_path(mounts: &[Mount], vfs_path: &str) -> Option<PathBuf> {
    host_path_for_vfs_path_with_symlink_policy(mounts, vfs_path, SymlinkPolicy::BlockEscapes)
}

fn host_path_for_vfs_path_with_symlink_policy(
    mounts: &[Mount],
    vfs_path: &str,
    symlink_policy: SymlinkPolicy,
) -> Option<PathBuf> {
    let normalized = normalize_vfs_path(vfs_path).ok()?;
    mounts
        .iter()
        .filter_map(|mount| {
            let suffix = vfs_mount_suffix(&normalized, &mount.vfs_path)?;
            let host_path = match symlink_policy {
                SymlinkPolicy::BlockEscapes => safe_join_mount_path(
                    &mount.host_path,
                    mount.canonical_host_path.as_deref(),
                    suffix,
                )?,
                SymlinkPolicy::Follow => join_mount_path(&mount.host_path, suffix),
            };
            Some((mount.vfs_path.len(), host_path))
        })
        .max_by_key(|(len, _)| *len)
        .map(|(_, path)| path)
}

fn safe_join_mount_path(
    host_path: &Path,
    canonical_mount: Option<&Path>,
    suffix: &str,
) -> Option<PathBuf> {
    let candidate = join_mount_path(host_path, suffix);
    let canonical_mount = canonical_mount?;
    if let Ok(canonical_candidate) = fs::canonicalize(&candidate) {
        return path_is_or_under(&canonical_candidate, canonical_mount).then_some(candidate);
    }

    let canonical_ancestor = canonical_existing_path_or_ancestor(&candidate)?;
    path_is_or_under(&canonical_ancestor, canonical_mount).then_some(candidate)
}

fn path_is_or_under(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn canonical_existing_path_or_ancestor(path: &Path) -> Option<PathBuf> {
    let mut current = Some(path);
    while let Some(candidate) = current {
        if fs::symlink_metadata(candidate).is_ok() {
            return fs::canonicalize(candidate).ok();
        }
        current = candidate.parent();
    }
    None
}

fn emit_route_resolve_total(
    counter: Option<RouteCounterContext<'_>>,
    started_at: Option<Instant>,
    result: std::result::Result<&RouteTarget, &CliError>,
) {
    let (Some(counter), Some(started_at)) = (counter, started_at) else {
        return;
    };
    let mut fields = counter.fields();
    fields.extend([
        Field::new(
            "route_elapsed_us",
            route_counters::elapsed_us(started_at.elapsed()),
        ),
        Field::new(
            "route_target",
            result.map(route_target_label).unwrap_or("error"),
        ),
    ]);
    match result {
        Ok(RouteTarget::Php {
            vfs_path,
            path_info,
        }) => fields.extend([
            Field::new("script_vfs_path", vfs_path),
            Field::new(
                "path_info_bytes",
                path_info.as_ref().map_or(0, |value| value.len()),
            ),
        ]),
        Ok(RouteTarget::Static { host_path }) => {
            fields.push(Field::new("host_path", host_path.display()));
        }
        Ok(RouteTarget::NotFound) => {}
        Err(error) => fields.push(Field::new("error", error)),
    }
    route_counters::emit("route.resolve_total", &fields);
}

fn route_target_label(route_target: &RouteTarget) -> &'static str {
    match route_target {
        RouteTarget::Php { .. } => "php",
        RouteTarget::Static { .. } => "static",
        RouteTarget::NotFound => "not_found",
    }
}

fn symlink_policy_label(symlink_policy: SymlinkPolicy) -> &'static str {
    match symlink_policy {
        SymlinkPolicy::BlockEscapes => "block_escapes",
        SymlinkPolicy::Follow => "follow",
    }
}

fn direct_child_mount_name<'a>(path: &str, mount_path: &'a str) -> Option<(&'a str, bool)> {
    let suffix = if path == "/" {
        mount_path.trim_start_matches('/')
    } else {
        mount_path.strip_prefix(&(path.to_string() + "/"))?
    };
    let mut parts = suffix.split('/').filter(|part| !part.is_empty());
    let name = parts.next()?;
    Some((name, parts.next().is_some()))
}

fn vfs_mount_suffix<'a>(path: &'a str, mount_path: &str) -> Option<&'a str> {
    if path == mount_path {
        return Some("");
    }
    path.strip_prefix(&(mount_path.to_string() + "/"))
}

fn join_mount_path(host_path: &Path, suffix: &str) -> PathBuf {
    let mut path = host_path.to_path_buf();
    for part in suffix.split('/').filter(|part| !part.is_empty()) {
        path.push(part);
    }
    path
}

fn request_path_from_target(target: &str) -> Result<String> {
    let path = target
        .split_once('?')
        .map(|(path, _)| path)
        .unwrap_or(target);
    if !path.starts_with('/') {
        return Err(CliError::new(format!("Invalid request target: {target}")));
    }
    percent_decode_path(path).and_then(|path| normalize_vfs_path(&path))
}

fn percent_decode_path(path: &str) -> Result<String> {
    let bytes = path.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err(CliError::new(format!(
                    "Invalid percent-encoded path: {path}"
                )));
            }
            let high = hex_value(bytes[index + 1])
                .ok_or_else(|| CliError::new(format!("Invalid percent-encoded path: {path}")))?;
            let low = hex_value(bytes[index + 2])
                .ok_or_else(|| CliError::new(format!("Invalid percent-encoded path: {path}")))?;
            output.push((high << 4) | low);
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(output)
        .map_err(|_| CliError::new(format!("Request path is not valid UTF-8: {path}")))
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
fn read_http_request(stream: &mut TcpStream) -> HttpParseResult<HttpRequest> {
    read_http_request_with_counter(stream, None)
}

fn read_http_request_with_counter(
    stream: &mut TcpStream,
    request_id: Option<RequestId>,
) -> HttpParseResult<HttpRequest> {
    let started_at = request_id.map(|_| Instant::now());
    let collect_counter_stats = request_id.is_some();
    let mut buffer = Vec::new();
    let mut temp = [0u8; 8192];
    let mut header_end = None;
    let mut expected_length = ExpectedBodyLength::Fixed(0);
    let mut read_calls = 0usize;
    let mut bytes_read = 0usize;
    let mut max_buffer_len = 0usize;

    loop {
        let count = match stream.read(&mut temp) {
            Ok(count) => count,
            Err(error) => {
                emit_http_read_counter(
                    request_id,
                    started_at,
                    read_calls,
                    bytes_read,
                    max_buffer_len,
                    &expected_length,
                    "error",
                );
                return Err(match error.kind() {
                    io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock => {
                        HttpProtocolError::new(408, "Request Timeout")
                    }
                    _ => {
                        HttpProtocolError::new(400, format!("Failed to read HTTP request: {error}"))
                    }
                });
            }
        };
        if count == 0 {
            break;
        }
        buffer.extend_from_slice(&temp[..count]);
        if collect_counter_stats {
            read_calls += 1;
            bytes_read += count;
            max_buffer_len = max_buffer_len.max(buffer.len());
        }
        if buffer.len() > MAX_REQUEST_BYTES {
            emit_http_read_counter(
                request_id,
                started_at,
                read_calls,
                bytes_read,
                max_buffer_len,
                &expected_length,
                "too_large",
            );
            return Err(HttpProtocolError::new(
                413,
                "HTTP request exceeds native server limit",
            ));
        }
        if header_end.is_none() {
            header_end = find_header_end(&buffer);
            if let Some(end) = header_end {
                match expected_body_length(&buffer[..end]) {
                    Ok(length) => expected_length = length,
                    Err(error) => {
                        emit_http_read_counter(
                            request_id,
                            started_at,
                            read_calls,
                            bytes_read,
                            max_buffer_len,
                            &expected_length,
                            "bad_length",
                        );
                        return Err(error);
                    }
                }
            }
        }
        if let Some(end) = header_end {
            match expected_length {
                ExpectedBodyLength::Fixed(content_length) => {
                    if buffer.len() >= end + content_length {
                        break;
                    }
                }
                ExpectedBodyLength::Chunked => match chunked_body_is_complete(&buffer[end..]) {
                    Ok(true) => break,
                    Ok(false) => {}
                    Err(error) => {
                        emit_http_read_counter(
                            request_id,
                            started_at,
                            read_calls,
                            bytes_read,
                            max_buffer_len,
                            &expected_length,
                            "bad_chunked",
                        );
                        return Err(error);
                    }
                },
            }
        }
    }

    emit_http_read_counter(
        request_id,
        started_at,
        read_calls,
        bytes_read,
        max_buffer_len,
        &expected_length,
        "ok",
    );
    parse_http_request_owned_with_counter(buffer, request_id)
}

#[cfg(test)]
fn parse_http_request(buffer: &[u8]) -> HttpParseResult<HttpRequest> {
    let parsed = parse_http_request_head(buffer)?;
    let body_start = parsed.header_end;
    let body = match parsed.body_encoding {
        BodyEncoding::Fixed(content_length) => {
            let body_end = fixed_body_end(body_start, content_length)?;
            if buffer.len() < body_end {
                return Err(HttpProtocolError::new(400, "Incomplete HTTP request body"));
            }
            buffer[body_start..body_end].to_vec()
        }
        BodyEncoding::Chunked => decode_chunked_body(&buffer[body_start..])?,
    };

    Ok(HttpRequest {
        method: parsed.method,
        target: parsed.target,
        version: parsed.version,
        headers: parsed.headers,
        body,
    })
}

#[cfg(test)]
fn parse_http_request_owned(buffer: Vec<u8>) -> HttpParseResult<HttpRequest> {
    parse_http_request_owned_with_counter(buffer, None)
}

fn parse_http_request_owned_with_counter(
    mut buffer: Vec<u8>,
    request_id: Option<RequestId>,
) -> HttpParseResult<HttpRequest> {
    let started_at = request_id.map(|_| Instant::now());
    let collect_counter_stats = request_id.is_some();
    let input_bytes = if collect_counter_stats {
        buffer.len()
    } else {
        0
    };
    let mut fixed_body_bytes = 0usize;
    let mut chunked_decoded_bytes = 0usize;
    let result = (|| {
        let parsed = parse_http_request_head(&buffer)?;
        let body_start = parsed.header_end;
        let body = match parsed.body_encoding {
            BodyEncoding::Fixed(content_length) => {
                let body_end = fixed_body_end(body_start, content_length)?;
                if buffer.len() < body_end {
                    return Err(HttpProtocolError::new(400, "Incomplete HTTP request body"));
                }
                if collect_counter_stats {
                    fixed_body_bytes = content_length;
                }
                buffer.truncate(body_end);
                buffer.drain(..body_start);
                buffer
            }
            BodyEncoding::Chunked => {
                let body = decode_chunked_body(&buffer[body_start..])?;
                if collect_counter_stats {
                    chunked_decoded_bytes = body.len();
                }
                body
            }
        };

        Ok(HttpRequest {
            method: parsed.method,
            target: parsed.target,
            version: parsed.version,
            headers: parsed.headers,
            body,
        })
    })();
    emit_http_parse_counter(
        request_id,
        started_at,
        input_bytes,
        fixed_body_bytes,
        chunked_decoded_bytes,
        result.as_ref(),
    );
    result
}

struct ParsedHttpHead {
    header_end: usize,
    method: String,
    target: String,
    version: String,
    headers: Vec<(String, String)>,
    body_encoding: BodyEncoding,
}

fn parse_http_request_head(buffer: &[u8]) -> HttpParseResult<ParsedHttpHead> {
    let header_end = find_header_end(buffer)
        .ok_or_else(|| HttpProtocolError::new(400, "Incomplete HTTP request headers"))?;
    let header_bytes = &buffer[..header_end - 4];
    let header_text = std::str::from_utf8(header_bytes)
        .map_err(|_| HttpProtocolError::new(400, "HTTP request headers are not valid UTF-8"))?;
    let mut lines = header_text.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| HttpProtocolError::new(400, "Missing HTTP request line"))?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts
        .next()
        .ok_or_else(|| HttpProtocolError::new(400, "Missing HTTP method"))?;
    let target = request_parts
        .next()
        .ok_or_else(|| HttpProtocolError::new(400, "Missing HTTP target"))?;
    let version = request_parts
        .next()
        .ok_or_else(|| HttpProtocolError::new(400, "Missing HTTP version"))?;
    if request_parts.next().is_some() {
        return Err(HttpProtocolError::new(400, "Invalid HTTP request line"));
    }
    if !matches!(version, "HTTP/1.0" | "HTTP/1.1") {
        return Err(HttpProtocolError::new(400, "Unsupported HTTP version"));
    }

    let mut headers = Vec::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let Some((name, value)) = line.split_once(':') else {
            return Err(HttpProtocolError::new(
                400,
                format!("Invalid HTTP header: {line}"),
            ));
        };
        let name = name.trim();
        if name.is_empty() {
            return Err(HttpProtocolError::new(
                400,
                "Invalid empty HTTP header name",
            ));
        }
        headers.push((name.to_ascii_lowercase(), value.trim().to_string()));
    }

    let body_encoding = body_encoding_from_headers(&headers)?;
    Ok(ParsedHttpHead {
        header_end,
        method: method.to_string(),
        target: target.to_string(),
        version: version.to_string(),
        headers,
        body_encoding,
    })
}

fn fixed_body_end(body_start: usize, content_length: usize) -> HttpParseResult<usize> {
    body_start
        .checked_add(content_length)
        .ok_or_else(|| HttpProtocolError::new(413, "HTTP request exceeds native server limit"))
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|position| position + 4)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ExpectedBodyLength {
    Fixed(usize),
    Chunked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BodyEncoding {
    Fixed(usize),
    Chunked,
}

fn expected_body_length(headers: &[u8]) -> HttpParseResult<ExpectedBodyLength> {
    let text = std::str::from_utf8(headers)
        .map_err(|_| HttpProtocolError::new(400, "HTTP request headers are not valid UTF-8"))?;
    let mut parsed_headers = Vec::new();
    for line in text.split("\r\n").skip(1) {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        parsed_headers.push((name.trim().to_ascii_lowercase(), value.trim().to_string()));
    }
    Ok(match body_encoding_from_headers(&parsed_headers)? {
        BodyEncoding::Fixed(length) => ExpectedBodyLength::Fixed(length),
        BodyEncoding::Chunked => ExpectedBodyLength::Chunked,
    })
}

fn body_encoding_from_headers(headers: &[(String, String)]) -> HttpParseResult<BodyEncoding> {
    let transfer_encodings = headers
        .iter()
        .filter(|(name, _)| name.eq_ignore_ascii_case("transfer-encoding"))
        .map(|(_, value)| value.as_str())
        .collect::<Vec<_>>();
    let content_lengths = headers
        .iter()
        .filter(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .map(|(_, value)| {
            value.parse::<usize>().map_err(|_| {
                HttpProtocolError::new(400, format!("Invalid Content-Length header: {value}"))
            })
        })
        .collect::<HttpParseResult<Vec<_>>>()?;
    if !transfer_encodings.is_empty() && !content_lengths.is_empty() {
        return Err(HttpProtocolError::new(
            400,
            "Transfer-Encoding and Content-Length cannot both be present",
        ));
    }
    if !transfer_encodings.is_empty() {
        if transfer_encodings.len() > 1 {
            return Err(HttpProtocolError::new(
                501,
                "Multiple Transfer-Encoding headers are not supported",
            ));
        }
        let raw_codings = transfer_encodings[0]
            .split(',')
            .map(|coding| coding.trim().to_ascii_lowercase())
            .collect::<Vec<_>>();
        if raw_codings.iter().any(|coding| coding.is_empty()) {
            return Err(HttpProtocolError::new(
                501,
                "Transfer-Encoding is not supported by wp-playground-native yet",
            ));
        }
        let codings = raw_codings;
        if codings == ["chunked"] {
            return Ok(BodyEncoding::Chunked);
        }
        return Err(HttpProtocolError::new(
            501,
            "Transfer-Encoding is not supported by wp-playground-native yet",
        ));
    }
    if content_lengths
        .windows(2)
        .any(|window| window[0] != window[1])
    {
        return Err(HttpProtocolError::new(
            400,
            "Conflicting Content-Length headers",
        ));
    }
    Ok(BodyEncoding::Fixed(
        content_lengths.first().copied().unwrap_or(0),
    ))
}

fn chunked_body_is_complete(body: &[u8]) -> HttpParseResult<bool> {
    let mut offset = 0usize;
    let mut decoded_len = 0usize;
    loop {
        let Some(line_end) = find_crlf(&body[offset..]) else {
            return Ok(false);
        };
        let line = &body[offset..offset + line_end];
        let chunk_size = parse_chunk_size(line)?;
        offset += line_end + 2;
        if chunk_size == 0 {
            let Some(trailer_end) = find_chunked_trailer_end(&body[offset..]) else {
                return Ok(false);
            };
            return Ok(body.len() >= offset + trailer_end);
        }
        if chunk_size > MAX_REQUEST_BYTES.saturating_sub(decoded_len) {
            return Err(HttpProtocolError::new(
                413,
                "Chunked request body is too large",
            ));
        }
        let Some(chunk_end) = offset.checked_add(chunk_size) else {
            return Err(HttpProtocolError::new(
                413,
                "Chunked request body is too large",
            ));
        };
        if body.len() < chunk_end + 2 {
            return Ok(false);
        }
        if &body[chunk_end..chunk_end + 2] != b"\r\n" {
            return Err(HttpProtocolError::new(
                400,
                "Invalid chunked request body framing",
            ));
        }
        decoded_len += chunk_size;
        offset = chunk_end + 2;
    }
}

fn decode_chunked_body(body: &[u8]) -> HttpParseResult<Vec<u8>> {
    decode_chunked_body_with_limit(body, MAX_REQUEST_BYTES)
}

fn decode_chunked_body_with_limit(
    body: &[u8],
    max_decoded_body: usize,
) -> HttpParseResult<Vec<u8>> {
    let mut offset = 0usize;
    let mut decoded = Vec::new();
    loop {
        let line_end = find_crlf(&body[offset..])
            .ok_or_else(|| HttpProtocolError::new(400, "Incomplete chunked request body"))?;
        let line = &body[offset..offset + line_end];
        let chunk_size = parse_chunk_size(line)?;
        offset += line_end + 2;
        if chunk_size == 0 {
            let trailer_end = find_chunked_trailer_end(&body[offset..])
                .ok_or_else(|| HttpProtocolError::new(400, "Incomplete chunked trailer"))?;
            let trailers = if trailer_end == 2 {
                &[]
            } else {
                &body[offset..offset + trailer_end - 4]
            };
            validate_chunked_trailers(trailers)?;
            return Ok(decoded);
        }
        if chunk_size > max_decoded_body.saturating_sub(decoded.len()) {
            return Err(HttpProtocolError::new(
                413,
                "Chunked request body is too large",
            ));
        }
        let chunk_end = offset
            .checked_add(chunk_size)
            .ok_or_else(|| HttpProtocolError::new(413, "Chunked request body is too large"))?;
        if body.len() < chunk_end + 2 {
            return Err(HttpProtocolError::new(
                400,
                "Incomplete chunked request body",
            ));
        }
        if &body[chunk_end..chunk_end + 2] != b"\r\n" {
            return Err(HttpProtocolError::new(
                400,
                "Invalid chunked request body framing",
            ));
        }
        let new_len = decoded
            .len()
            .checked_add(chunk_size)
            .ok_or_else(|| HttpProtocolError::new(413, "Chunked request body is too large"))?;
        debug_assert!(new_len <= max_decoded_body);
        decoded.extend_from_slice(&body[offset..chunk_end]);
        offset = chunk_end + 2;
    }
}

fn parse_chunk_size(line: &[u8]) -> HttpParseResult<usize> {
    let size_part = line.split(|byte| *byte == b';').next().unwrap_or(line);
    if size_part.is_empty() {
        return Err(HttpProtocolError::new(400, "Missing chunk size"));
    }
    if !size_part.iter().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(HttpProtocolError::new(400, "Invalid chunk size"));
    }
    let text = std::str::from_utf8(size_part)
        .map_err(|_| HttpProtocolError::new(400, "Chunk size is not valid UTF-8"))?;
    usize::from_str_radix(text, 16).map_err(|_| HttpProtocolError::new(400, "Invalid chunk size"))
}

fn validate_chunked_trailers(trailers: &[u8]) -> HttpParseResult<()> {
    if trailers.is_empty() {
        return Ok(());
    }
    let text = std::str::from_utf8(trailers)
        .map_err(|_| HttpProtocolError::new(400, "Chunk trailers are not valid UTF-8"))?;
    for line in text.split("\r\n") {
        if line.is_empty() {
            continue;
        }
        let Some((name, _value)) = line.split_once(':') else {
            return Err(HttpProtocolError::new(
                400,
                format!("Invalid chunk trailer: {line}"),
            ));
        };
        let name = name.trim();
        if name.is_empty() {
            return Err(HttpProtocolError::new(
                400,
                "Invalid empty chunk trailer name",
            ));
        }
        if name.eq_ignore_ascii_case("content-length")
            || name.eq_ignore_ascii_case("transfer-encoding")
        {
            return Err(HttpProtocolError::new(
                400,
                format!("Invalid chunk trailer: {name}"),
            ));
        }
    }
    Ok(())
}

fn find_crlf(buffer: &[u8]) -> Option<usize> {
    buffer.windows(2).position(|window| window == b"\r\n")
}

fn find_chunked_trailer_end(buffer: &[u8]) -> Option<usize> {
    if buffer.starts_with(b"\r\n") {
        Some(2)
    } else {
        find_header_end(buffer)
    }
}

fn write_http_response(
    stream: &mut TcpStream,
    response: &HttpResponse,
    suppress_body: bool,
) -> Result<()> {
    write_http_response_with_counter(stream, response, suppress_body, None)
}

fn write_http_response_with_counter(
    stream: &mut TcpStream,
    response: &HttpResponse,
    suppress_body: bool,
    request_id: Option<RequestId>,
) -> Result<()> {
    let started_at = request_id.map(|_| Instant::now());
    let head = http_response_head_bytes(response);
    let result = stream
        .write_all(&head)
        .and_then(|_| {
            if !suppress_body {
                stream.write_all(&response.body)?;
            }
            stream.flush()
        })
        .map_err(|error| CliError::new(format!("Failed to write HTTP response: {error}")));
    emit_response_write_counter(
        request_id,
        started_at,
        response.status,
        head.len(),
        response.body.len() as u64,
        suppress_body,
        result.as_ref().err(),
    );
    result
}

fn write_server_http_response_with_counter(
    stream: &mut TcpStream,
    response: &ServerHttpResponse,
    suppress_body: bool,
    request_id: Option<RequestId>,
) -> Result<()> {
    match response {
        ServerHttpResponse::Buffered(response) => {
            write_http_response_with_counter(stream, response, suppress_body, request_id)
        }
        ServerHttpResponse::StaticFile(host_path) => {
            write_static_file_response_with_counter(stream, host_path, suppress_body, request_id)
        }
    }
}

#[cfg(test)]
fn write_static_file_response(
    stream: &mut TcpStream,
    host_path: &Path,
    suppress_body: bool,
) -> Result<()> {
    write_static_file_response_with_counter(stream, host_path, suppress_body, None)
}

fn write_static_file_response_with_counter(
    stream: &mut TcpStream,
    host_path: &Path,
    suppress_body: bool,
    request_id: Option<RequestId>,
) -> Result<()> {
    let started_at = request_id.map(|_| Instant::now());
    let mut file = fs::File::open(host_path).map_err(|error| {
        CliError::new(format!(
            "Failed to open static file {}: {error}",
            host_path.display()
        ))
    })?;
    let body_len = file
        .metadata()
        .map_err(|error| {
            CliError::new(format!(
                "Failed to stat static file {}: {error}",
                host_path.display()
            ))
        })?
        .len();
    let response = HttpResponse {
        status: 200,
        headers: vec![(
            "Content-Type".to_string(),
            content_type_for_path(host_path).to_string(),
        )],
        body: Vec::new(),
    };
    let head = http_response_head_bytes_with_body_len(&response, body_len);
    let result = stream
        .write_all(&head)
        .and_then(|_| {
            if !suppress_body {
                io::copy(&mut file, stream)?;
            }
            stream.flush()
        })
        .map_err(|error| {
            CliError::new(format!(
                "Failed to write static file response for {}: {error}",
                host_path.display()
            ))
        });
    emit_response_write_counter(
        request_id,
        started_at,
        response.status,
        head.len(),
        body_len,
        suppress_body,
        result.as_ref().err(),
    );
    result
}

fn emit_http_read_counter(
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    read_calls: usize,
    bytes_read: usize,
    max_buffer_len: usize,
    expected_length: &ExpectedBodyLength,
    result: &str,
) {
    let (Some(request_id), Some(started_at)) = (request_id, started_at) else {
        return;
    };
    let fields = vec![
        Field::new("request_id", request_id.get()),
        Field::new("read_calls", read_calls),
        Field::new("bytes_read", bytes_read),
        Field::new("max_buffer_len", max_buffer_len),
        Field::new(
            "expected_body_length",
            expected_body_length_label(expected_length),
        ),
        Field::new(
            "read_elapsed_us",
            route_counters::elapsed_us(started_at.elapsed()),
        ),
        Field::new("result", result),
    ];
    route_counters::emit("http.read_loop", &fields);
}

fn expected_body_length_label(expected_length: &ExpectedBodyLength) -> String {
    match expected_length {
        ExpectedBodyLength::Fixed(length) => length.to_string(),
        ExpectedBodyLength::Chunked => "chunked".to_string(),
    }
}

fn emit_http_parse_counter(
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    input_bytes: usize,
    fixed_body_bytes: usize,
    chunked_decoded_bytes: usize,
    result: std::result::Result<&HttpRequest, &HttpProtocolError>,
) {
    let (Some(request_id), Some(started_at)) = (request_id, started_at) else {
        return;
    };
    let mut fields = vec![
        Field::new("request_id", request_id.get()),
        Field::new("input_bytes", input_bytes),
        Field::new("fixed_body_bytes", fixed_body_bytes),
        Field::new("chunked_decoded_bytes", chunked_decoded_bytes),
        Field::new(
            "parse_elapsed_us",
            route_counters::elapsed_us(started_at.elapsed()),
        ),
    ];
    match result {
        Ok(request) => fields.extend([
            Field::new("result", "ok"),
            Field::new("headers_count", request.headers.len()),
            Field::new("method_bytes", request.method.len()),
            Field::new("target_bytes", request.target.len()),
            Field::new("version_bytes", request.version.len()),
        ]),
        Err(error) => fields.extend([
            Field::new("result", "error"),
            Field::new("status", error.status),
            Field::new("message", &error.message),
        ]),
    }
    route_counters::emit("http.parse_owned", &fields);
}

fn emit_response_write_counter(
    request_id: Option<RequestId>,
    started_at: Option<Instant>,
    status: u16,
    head_bytes: usize,
    body_bytes: u64,
    suppress_body: bool,
    write_error: Option<&CliError>,
) {
    let (Some(request_id), Some(started_at)) = (request_id, started_at) else {
        return;
    };
    let mut fields = vec![
        Field::new("request_id", request_id.get()),
        Field::new("status", status),
        Field::new("head_bytes", head_bytes),
        Field::new("body_bytes", body_bytes),
        Field::new("suppress_body", suppress_body),
        Field::new(
            "write_elapsed_us",
            route_counters::elapsed_us(started_at.elapsed()),
        ),
        Field::new("result", if write_error.is_some() { "error" } else { "ok" }),
    ];
    if let Some(error) = write_error {
        fields.push(Field::new("write_error", error));
    }
    route_counters::emit("response.write", &fields);
}

#[cfg(test)]
fn http_response_bytes(response: &HttpResponse, suppress_body: bool) -> Vec<u8> {
    let mut bytes = http_response_head_bytes(response);
    if !suppress_body {
        bytes.extend_from_slice(&response.body);
    }
    bytes
}

fn http_response_head_bytes(response: &HttpResponse) -> Vec<u8> {
    http_response_head_bytes_with_body_len(response, response.body.len() as u64)
}

fn http_response_head_bytes_with_body_len(response: &HttpResponse, body_len: u64) -> Vec<u8> {
    let mut head = format!(
        "HTTP/1.1 {} {}\r\nConnection: close\r\nContent-Length: {}\r\n",
        response.status,
        reason_phrase(response.status),
        body_len
    );
    for (name, value) in &response.headers {
        if name.eq_ignore_ascii_case("content-length")
            || is_hop_by_hop_header(name)
            || !is_safe_header(name, value)
        {
            continue;
        }
        head.push_str(name);
        head.push_str(": ");
        head.push_str(value);
        head.push_str("\r\n");
    }
    head.push_str("\r\n");
    head.into_bytes()
}

#[derive(Debug, Deserialize)]
struct RawPhpHeaders {
    #[serde(default)]
    status: Option<u16>,
    #[serde(default)]
    headers: Vec<String>,
}

fn parse_php_headers(bytes: &[u8]) -> HttpResponse {
    let parsed = serde_json::from_slice::<RawPhpHeaders>(bytes).unwrap_or(RawPhpHeaders {
        status: Some(200),
        headers: Vec::new(),
    });
    let mut headers = Vec::new();
    for header in parsed.headers {
        if header == "__terminator__" {
            continue;
        }
        let Some((name, value)) = header.split_once(':') else {
            continue;
        };
        let name = name.trim();
        let value = value.trim();
        if is_safe_header(name, value) {
            headers.push((name.to_string(), value.to_string()));
        }
    }

    HttpResponse {
        status: parsed.status.unwrap_or(200),
        headers,
        body: Vec::new(),
    }
}

fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(candidate, _)| candidate.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.as_str())
}

fn host_name(host: &str) -> &str {
    host.split_once(':').map(|(name, _)| name).unwrap_or(host)
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("css") => "text/css",
        Some("gif") => "image/gif",
        Some("html") | Some("htm") => "text/html",
        Some("js") => "application/javascript",
        Some("json") => "application/json",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("txt") => "text/plain",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

fn reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        301 => "Moved Permanently",
        302 => "Found",
        304 => "Not Modified",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        408 => "Request Timeout",
        413 => "Content Too Large",
        422 => "Unprocessable Content",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        501 => "Not Implemented",
        503 => "Service Unavailable",
        _ => "Unknown",
    }
}

fn is_safe_header(name: &str, value: &str) -> bool {
    !name.contains(['\r', '\n']) && !value.contains(['\r', '\n']) && !name.trim().is_empty()
}

fn is_hop_by_hop_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

fn open_browser(url: &str) -> Result<()> {
    #[cfg(target_os = "macos")]
    let status = ProcessCommand::new("open").arg(url).status();
    #[cfg(target_os = "windows")]
    let status = ProcessCommand::new("cmd")
        .args(["/C", "start", "", url])
        .status();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = ProcessCommand::new("xdg-open").arg(url).status();

    status
        .map(|_| ())
        .map_err(|error| CliError::new(format!("Failed to open browser: {error}")))
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeMap,
        fs,
        io::{Cursor, Read, Write},
        net::{TcpListener, TcpStream},
        path::{Path, PathBuf},
        sync::{
            atomic::{AtomicBool, Ordering},
            Mutex,
        },
        thread::{self, JoinHandle},
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    use super::{
        asset_folder_name_from_zip_filename, auto_login_username,
        bind_server_listener_with_default, boot_wordpress_site, clear_auto_login_cookie_response,
        cpu_workers_minus_one, decode_chunked_body_with_limit, define_wp_config_consts_script,
        directory_zip_name, ensure_tmp_mount, extract_scope_path, filename_from_url,
        git_archive_bytes_to_file_tree, git_archive_download_url, git_archive_supported_host,
        host_path_for_vfs_path, http_response_bytes, http_response_head_bytes_with_body_len,
        import_theme_starter_content_script, import_wordpress_files_replace_files,
        import_wordpress_files_rewrite_scope_script, import_wxr_script,
        inject_http_host_into_wp_config, install_asset_zip, install_downloadable_asset,
        install_plugin_asset, lazy_worker_pool_enabled, looks_like_zip_file,
        mark_worker_request_finished, max_requests_per_worker_from_env, maybe_boot_wordpress_site,
        multisite_url_settings, normalize_git_directory_path, parse_http_request,
        parse_http_request_owned, parse_http_request_owned_with_counter, parse_php_headers,
        php_request_from_http, php_request_from_run_options, php_single_quoted_string,
        read_http_request, reason_phrase, recycle_wasm_memory_threshold_from_env,
        remove_wp_allow_multisite_define, request_error_total_counter, request_path_from_target,
        request_total_fields, requested_worker_count, reserve_lazy_worker_retirement,
        reset_data_script, resolve_git_directory_resource, resolve_route, route_target_label,
        run_git, run_native_startup_step, run_sql_script, run_startup_step, run_startup_steps,
        server_mounts, server_response_counter_stats, set_site_language_metadata_script,
        should_clear_auto_login_cookie, split_shell_command, startup_steps_from_blueprint_json,
        startup_steps_from_blueprint_source, startup_steps_from_blueprint_zip,
        startup_steps_from_remote_blueprint_bytes, unzip_bytes_to_dir, update_user_meta_script,
        validate_install_asset_zip, wordpress_importer_install_step,
        wordpress_translation_url_from_api_response, worker_after_request_label,
        worker_recycle_idle_delay_from_env, wp_cli_runner_script, wp_installation_wizard_request,
        write_http_response_with_counter, write_server_http_response_with_counter,
        write_static_file_response, write_wordpress_snapshot_zip, zip_path_to_string,
        DefineWpConfigMethod, DownloadableAsset, FileContentSource, FileTreeEntry, FileTreeSource,
        GitDirectoryResource, HttpRequest, HttpResponse, IfAlreadyInstalled, InstallAssetSource,
        InstallAssetStep, PhpConstantValue, PhpRunOptions, PhpRunScript, PhpWorker,
        RequestTotalRequest, RouteTarget, ServerHttpResponse, StartupHttpRequest, StartupStep,
        WorkerAfterRequest, AUTO_LOGIN_COOKIE_NAME, CLEAR_AUTO_LOGIN_COOKIE,
        DEFAULT_RECYCLE_WASM_MEMORY_MIB, DEFAULT_WP_CLI_PATH,
        MAX_NATIVE_ASYNCIFY_REQUESTS_PER_WORKER, MAX_REQUESTS_PER_WORKER_ENV_VAR,
        RECYCLE_WASM_MEMORY_MIB_ENV_VAR, WORKER_RECYCLE_IDLE_DELAY,
        WORKER_RECYCLE_IDLE_DELAY_ENV_VAR,
    };
    #[cfg(unix)]
    use super::{
        host_path_for_vfs_path_with_symlink_policy, resolve_route_with_symlink_policy,
        run_native_startup_step_with_symlink_policy,
        write_wordpress_snapshot_zip_with_symlink_policy, SymlinkPolicy,
    };
    use crate::download::url_cache_key;
    use crate::host::{HostMount, HostOptions};
    use crate::paths::{SiteStorage, WordPressInstallMode};
    use crate::route_counters;
    use crate::runtime::{repo_root_from_manifest_dir, NativeRuntime};
    use crate::wordpress::prepare_wordpress;
    use crate::{
        args::{parse_cli_args_from, CommandName, RuntimeCommand, RuntimeConfig},
        mount::Mount,
    };
    #[cfg(unix)]
    use zip::ZipArchive;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("wp-playground-native-server-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_file_tree_for_test(root: &Path, files: &BTreeMap<String, FileTreeEntry>) {
        fs::create_dir_all(root).unwrap();
        for (name, entry) in files {
            let path = root.join(name);
            match entry {
                FileTreeEntry::File(contents) => {
                    if let Some(parent) = path.parent() {
                        fs::create_dir_all(parent).unwrap();
                    }
                    fs::write(path, contents).unwrap();
                }
                FileTreeEntry::Directory(children) => {
                    write_file_tree_for_test(&path, children);
                }
            }
        }
    }

    fn file_url_for_path(path: &Path) -> String {
        let mut path = path
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        if cfg!(windows) {
            if let Some(stripped) = path.strip_prefix("//?/UNC/") {
                path = format!("//{stripped}");
            } else if let Some(stripped) = path.strip_prefix("//?/") {
                path = stripped.to_string();
            }
            if !path.starts_with('/') {
                path = format!("/{path}");
            }
        }
        let mut encoded = String::new();
        for byte in path.bytes() {
            if byte.is_ascii_alphanumeric()
                || matches!(byte, b'/' | b':' | b'-' | b'.' | b'_' | b'~')
            {
                encoded.push(byte as char);
            } else {
                encoded.push_str(&format!("%{byte:02X}"));
            }
        }
        format!("file://{encoded}")
    }

    fn host_options_for_test_mounts(mounts: &[Mount], site_url: &str) -> HostOptions {
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.to_string()),
        ));
        host_options.string_constants.push((
            "WP_SITEURL".to_string(),
            PhpConstantValue::string(site_url.to_string()),
        ));
        host_options
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm install-mode execution is an explicit smoke test."]
    fn real_install_from_existing_files_if_needed_skips_installed_site() {
        let root = temp_dir("if-needed-installed");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let install_options = parse_cli_args_from(
            vec![
                "server".to_string(),
                "--wp=6.9".to_string(),
                "--php=8.3".to_string(),
                "--wordpress-install-mode=download-and-install".to_string(),
            ],
            &root,
        )
        .unwrap();

        prepare_wordpress(runtime.repo_root(), &install_options, &mounts).unwrap();
        let port = 9491;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut install_php = runtime
            .instantiate_php_with_host_options(
                &install_options.php,
                host_options_for_test_mounts(&mounts, &site_url),
            )
            .unwrap();
        maybe_boot_wordpress_site(&mounts, &mut install_php, port, &install_options).unwrap();

        fs::write(
            wordpress_root.join("wp-admin/install.php"),
            "<?php fwrite(STDERR, 'installer should be skipped'); exit(99);",
        )
        .unwrap();
        let mut if_needed_options = install_options.clone();
        if_needed_options.wordpress_install_mode =
            WordPressInstallMode::InstallFromExistingFilesIfNeeded;
        let mut if_needed_php = runtime
            .instantiate_php_with_host_options(
                &if_needed_options.php,
                host_options_for_test_mounts(&mounts, &site_url),
            )
            .unwrap();

        maybe_boot_wordpress_site(&mounts, &mut if_needed_php, port, &if_needed_options).unwrap();

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn parses_http_request_with_body() {
        let request = parse_http_request(
            b"POST /index.php?x=1 HTTP/1.1\r\nHost: example.test\r\nContent-Length: 7\r\n\r\npayload",
        )
        .unwrap();

        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/index.php?x=1");
        assert_eq!(
            request.headers[0],
            ("host".to_string(), "example.test".to_string())
        );
        assert_eq!(request.body, b"payload");
    }

    #[test]
    fn owned_http_request_parser_reuses_fixed_body_buffer() {
        let buffer =
            b"POST /index.php HTTP/1.1\r\nHost: example.test\r\nContent-Length: 7\r\n\r\npayload"
                .to_vec();
        let buffer_ptr = buffer.as_ptr();

        let request = parse_http_request_owned(buffer).unwrap();

        assert_eq!(request.body, b"payload");
        assert_eq!(request.body.as_ptr(), buffer_ptr);
    }

    #[test]
    fn owned_http_request_parser_with_counter_preserves_fixed_body_behavior() {
        let buffer =
            b"POST /index.php HTTP/1.1\r\nHost: example.test\r\nContent-Length: 7\r\n\r\npayload"
                .to_vec();
        let buffer_ptr = buffer.as_ptr();

        let request = parse_http_request_owned_with_counter(
            buffer,
            Some(route_counters::request_id_for_test(101)),
        )
        .unwrap();

        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/index.php");
        assert_eq!(request.body, b"payload");
        assert_eq!(request.body.as_ptr(), buffer_ptr);
        assert_eq!(
            parse_http_request_owned_with_counter(
                b"POST / HTTP/1.1\r\nContent-Length: 7\r\n\r\nabc".to_vec(),
                Some(route_counters::request_id_for_test(102)),
            )
            .unwrap_err()
            .status,
            400
        );
    }

    #[test]
    fn owned_http_request_parser_with_counter_preserves_chunked_behavior() {
        let request = parse_http_request_owned_with_counter(
            b"POST /upload HTTP/1.1\r\nTransfer-Encoding: Chunked\r\n\r\n4;demo=true\r\nWiki\r\n5\r\npedia\r\n0\r\nX-Trailer: ignored\r\n\r\n".to_vec(),
            Some(route_counters::request_id_for_test(103)),
        )
        .unwrap();

        assert_eq!(request.body, b"Wikipedia");
        assert_eq!(
            parse_http_request_owned_with_counter(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc0\r\n\r\n".to_vec(),
                Some(route_counters::request_id_for_test(104)),
            )
            .unwrap_err()
            .status,
            400
        );
    }

    #[test]
    fn parse_http_request_rejects_malformed_headers_and_incomplete_bodies() {
        assert_eq!(
            parse_http_request(b"GET / HTTP/1.1\r\nBadHeader\r\n\r\n")
                .unwrap_err()
                .status,
            400
        );
        assert_eq!(
            parse_http_request(b"GET / HTTP/1.1\r\n: value\r\n\r\n")
                .unwrap_err()
                .status,
            400
        );
        assert_eq!(
            parse_http_request(b"GET / HTTP/1.1\r\nHost: \xFF\r\n\r\n")
                .unwrap_err()
                .status,
            400
        );
        assert_eq!(
            parse_http_request(b"GET / HTTP/1.1\nHost: x\n\n")
                .unwrap_err()
                .status,
            400
        );
        assert_eq!(
            parse_http_request(b"POST / HTTP/1.1\r\nContent-Length: 7\r\n\r\nabc")
                .unwrap_err()
                .status,
            400
        );
    }

    #[test]
    fn parse_http_request_rejects_transfer_encoding_and_conflicting_lengths() {
        assert_eq!(
            parse_http_request(b"POST / HTTP/1.1\r\nTransfer-Encoding: identity\r\n\r\n")
                .unwrap_err()
                .status,
            501
        );
        assert_eq!(
            parse_http_request(b"POST / HTTP/1.1\r\nTransfer-Encoding: gzip, chunked\r\n\r\n")
                .unwrap_err()
                .status,
            501
        );
        assert_eq!(
            parse_http_request(b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked,\r\n\r\n")
                .unwrap_err()
                .status,
            501
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\n\r\n",
            )
            .unwrap_err()
            .status,
            501
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\nContent-Length: 3\r\n\r\nabc",
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nContent-Length: 3\r\nContent-Length: 7\r\n\r\nabc",
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(b"POST / HTTP/1.1\r\nContent-Length: nope\r\n\r\n")
                .unwrap_err()
                .status,
            400
        );
    }

    #[test]
    fn parse_http_request_decodes_chunked_bodies_with_extensions_and_trailers() {
        let request = parse_http_request(
            b"POST /upload HTTP/1.1\r\nTransfer-Encoding: Chunked\r\n\r\n4;demo=true\r\nWiki\r\n5\r\npedia\r\n0\r\nX-Trailer: ignored\r\n\r\n",
        )
        .unwrap();

        assert_eq!(request.body, b"Wikipedia");
        assert!(request.headers.iter().all(|(name, _)| name != "x-trailer"));
    }

    #[test]
    fn parse_http_request_rejects_invalid_chunked_bodies() {
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\nZ\r\nbad\r\n0\r\n\r\n"
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n+4\r\nWiki\r\n0\r\n\r\n"
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n0x4\r\nWiki\r\n0\r\n\r\n"
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n 4\r\nWiki\r\n0\r\n\r\n"
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc0\r\n\r\n"
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(
                b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nBadTrailer\r\n\r\n"
            )
            .unwrap_err()
            .status,
            400
        );
        assert_eq!(
            parse_http_request(b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nContent-Length: 1\r\n\r\n")
                .unwrap_err()
                .status,
            400
        );
        assert_eq!(
            decode_chunked_body_with_limit(b"4\r\nWiki\r\n0\r\n\r\n", 3)
                .unwrap_err()
                .status,
            413
        );
        assert_eq!(
            decode_chunked_body_with_limit(b"4\r\n", 3)
                .unwrap_err()
                .status,
            413
        );
    }

    #[test]
    fn parse_http_request_accepts_duplicate_matching_content_length() {
        let request = parse_http_request(
            b"POST / HTTP/1.1\r\nContent-Length: 3\r\nContent-Length: 3\r\n\r\nabc",
        )
        .unwrap();

        assert_eq!(request.body, b"abc");
    }

    #[test]
    fn request_path_from_target_rejects_invalid_targets_and_percent_encoding() {
        assert!(request_path_from_target("index.php").is_err());
        assert!(request_path_from_target("http://example.test/").is_err());
        assert!(request_path_from_target("/bad/%").is_err());
        assert!(request_path_from_target("/bad/%A").is_err());
        assert!(request_path_from_target("/bad/%GG").is_err());
        assert!(request_path_from_target("/bad/%FF").is_err());
        assert!(request_path_from_target("/bad/%00").is_err());
    }

    #[test]
    fn read_http_request_times_out_waiting_for_headers_or_body() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let client = thread::spawn(move || {
            let mut stream = TcpStream::connect(address).unwrap();
            stream.write_all(b"GET / HTTP/1.1\r\n").unwrap();
            thread::sleep(Duration::from_millis(200));
        });
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(50)))
            .unwrap();

        assert_eq!(read_http_request(&mut stream).unwrap_err().status, 408);
        client.join().unwrap();

        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let client = thread::spawn(move || {
            let mut stream = TcpStream::connect(address).unwrap();
            stream
                .write_all(b"POST / HTTP/1.1\r\nContent-Length: 7\r\n\r\nabc")
                .unwrap();
            thread::sleep(Duration::from_millis(200));
        });
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(50)))
            .unwrap();

        assert_eq!(read_http_request(&mut stream).unwrap_err().status, 408);
        client.join().unwrap();
    }

    #[test]
    fn read_http_request_accepts_chunked_body_arriving_before_timeout() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let client = thread::spawn(move || {
            let mut stream = TcpStream::connect(address).unwrap();
            stream
                .write_all(b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki")
                .unwrap();
            thread::sleep(Duration::from_millis(25));
            stream.write_all(b"\r\n5\r\npedia\r\n0\r\n\r\n").unwrap();
            thread::sleep(Duration::from_millis(200));
        });
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(200)))
            .unwrap();

        let request = read_http_request(&mut stream).unwrap();

        assert_eq!(request.body, b"Wikipedia");
        client.join().unwrap();
    }

    #[test]
    fn read_http_request_times_out_during_chunked_body() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let client = thread::spawn(move || {
            let mut stream = TcpStream::connect(address).unwrap();
            stream
                .write_all(b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nabc")
                .unwrap();
            thread::sleep(Duration::from_millis(200));
        });
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(50)))
            .unwrap();

        assert_eq!(read_http_request(&mut stream).unwrap_err().status, 408);
        client.join().unwrap();
    }

    #[test]
    fn read_http_request_rejects_declared_chunk_over_native_limit() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let declared_size = format!("{:x}", super::MAX_REQUEST_BYTES + 1);
        let client = thread::spawn(move || {
            let mut stream = TcpStream::connect(address).unwrap();
            write!(
                stream,
                "POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n{declared_size}\r\n"
            )
            .unwrap();
            thread::sleep(Duration::from_millis(200));
        });
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(200)))
            .unwrap();

        assert_eq!(read_http_request(&mut stream).unwrap_err().status, 413);
        client.join().unwrap();
    }

    #[test]
    fn php_request_includes_server_and_environment_entries() {
        let request = HttpRequest {
            method: "POST".to_string(),
            target: "/wp-admin/admin-ajax.php?action=demo".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![
                ("host".to_string(), "example.test:9490".to_string()),
                ("content-type".to_string(), "text/plain".to_string()),
                ("content-length".to_string(), "7".to_string()),
                ("cookie".to_string(), "a=1".to_string()),
                ("x-native".to_string(), "yes".to_string()),
            ],
            body: b"payload".to_vec(),
        };

        let php_request =
            php_request_from_http(&request, "/wordpress/wp-admin/admin-ajax.php", None, 9490);

        assert!(php_request
            .server_entries
            .contains(&("DOCUMENT_ROOT".to_string(), "/wordpress".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("REQUEST_METHOD".to_string(), "POST".to_string())));
        assert!(php_request
            .env
            .contains(&("DOCUMENT_ROOT".to_string(), "/wordpress".to_string())));
        assert!(php_request
            .env
            .contains(&("SERVER_NAME".to_string(), "example.test".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("HTTP_HOST".to_string(), "example.test:9490".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("HTTPS".to_string(), "off".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("CONTENT_TYPE".to_string(), "text/plain".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("CONTENT_LENGTH".to_string(), "7".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("HTTP_COOKIE".to_string(), "a=1".to_string())));
        assert!(php_request
            .server_entries
            .contains(&("HTTP_X_NATIVE".to_string(), "yes".to_string())));

        let php_request = php_request_from_http(&request, "/wordpress/api.php", Some("/v1"), 9490);
        assert!(php_request
            .server_entries
            .contains(&("PATH_INFO".to_string(), "/v1".to_string())));
        assert!(php_request
            .env
            .contains(&("PATH_INFO".to_string(), "/v1".to_string())));
    }

    #[test]
    fn php_request_from_owned_http_request_moves_body_without_cloning() {
        let body = b"payload".repeat(1024);
        let body_ptr = body.as_ptr();
        let request = HttpRequest {
            method: "POST".to_string(),
            target: "/wp-admin/admin-ajax.php?action=demo".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![
                ("host".to_string(), "example.test:9490".to_string()),
                ("content-length".to_string(), body.len().to_string()),
            ],
            body,
        };

        let php_request =
            php_request_from_http(request, "/wordpress/wp-admin/admin-ajax.php", None, 9490);

        assert_eq!(php_request.body.as_ptr(), body_ptr);
        assert_eq!(php_request.body.len(), 7 * 1024);
    }

    #[test]
    fn php_run_options_request_maps_headers_server_and_env_entries() {
        let options = PhpRunOptions {
            script: PhpRunScript::ScriptPath("/wordpress/demo.php".to_string()),
            relative_uri: "/submit?x=1".to_string(),
            protocol: "https".to_string(),
            method: "POST".to_string(),
            headers: vec![
                ("host".to_string(), "example.test:9443".to_string()),
                ("content-type".to_string(), "text/plain".to_string()),
                ("content-length".to_string(), "7".to_string()),
                ("cookie".to_string(), "native=1".to_string()),
                ("x-custom".to_string(), "ok".to_string()),
            ],
            body: b"payload".to_vec(),
            env: vec![("NATIVE_ENV".to_string(), "present".to_string())],
            server_entries: vec![("CUSTOM_SERVER".to_string(), "set".to_string())],
        };

        let request = php_request_from_run_options(&options, "/wordpress/demo.php").unwrap();

        assert_eq!(request.script_path, "/wordpress/demo.php");
        assert_eq!(request.request_uri, "/submit?x=1");
        assert_eq!(request.method, "POST");
        assert_eq!(request.host, "example.test:9443");
        assert_eq!(request.port, 9443);
        assert_eq!(request.content_type, Some("text/plain".to_string()));
        assert_eq!(request.cookies, Some("native=1".to_string()));
        assert_eq!(request.body, b"payload");
        assert!(request
            .server_entries
            .contains(&("QUERY_STRING".to_string(), "x=1".to_string())));
        assert!(request
            .server_entries
            .contains(&("SERVER_NAME".to_string(), "example.test".to_string())));
        assert!(request
            .server_entries
            .contains(&("SERVER_PORT".to_string(), "9443".to_string())));
        assert!(request
            .server_entries
            .contains(&("HTTPS".to_string(), "on".to_string())));
        assert!(request
            .server_entries
            .contains(&("HTTP_HOST".to_string(), "example.test:9443".to_string())));
        assert!(request
            .server_entries
            .contains(&("CONTENT_TYPE".to_string(), "text/plain".to_string())));
        assert!(request
            .server_entries
            .contains(&("CONTENT_LENGTH".to_string(), "7".to_string())));
        assert!(request
            .server_entries
            .contains(&("HTTP_COOKIE".to_string(), "native=1".to_string())));
        assert!(request
            .server_entries
            .contains(&("HTTP_X_CUSTOM".to_string(), "ok".to_string())));
        assert!(request
            .server_entries
            .contains(&("CUSTOM_SERVER".to_string(), "set".to_string())));
        assert!(request
            .env
            .contains(&("NATIVE_ENV".to_string(), "present".to_string())));
    }

    #[test]
    fn parses_php_header_json() {
        let response =
            parse_php_headers(br#"{ "status": 404, "headers": ["X-Test: yes","__terminator__"]}"#);

        assert_eq!(response.status, 404);
        assert_eq!(
            response.headers,
            vec![("X-Test".to_string(), "yes".to_string())]
        );
    }

    #[test]
    fn head_response_keeps_content_length_and_omits_body() {
        let response = HttpResponse {
            status: 200,
            headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
            body: b"hello".to_vec(),
        };

        let bytes = http_response_bytes(&response, true);
        let text = String::from_utf8(bytes).unwrap();

        assert!(text.contains("Content-Length: 5\r\n"));
        assert!(text.contains("Content-Type: text/plain\r\n"));
        assert!(text.ends_with("\r\n\r\n"));
        assert!(!text.contains("hello"));
    }

    #[test]
    fn response_writer_drops_hop_by_hop_headers_and_keeps_set_cookie() {
        let response = HttpResponse {
            status: 503,
            headers: vec![
                ("Transfer-Encoding".to_string(), "chunked".to_string()),
                ("Connection".to_string(), "keep-alive".to_string()),
                ("Set-Cookie".to_string(), "a=1".to_string()),
                ("Set-Cookie".to_string(), "b=2".to_string()),
            ],
            body: Vec::new(),
        };

        let bytes = http_response_bytes(&response, false);
        let text = String::from_utf8(bytes).unwrap();

        assert!(text.starts_with("HTTP/1.1 503 Service Unavailable\r\n"));
        assert!(text.contains("Connection: close\r\n"));
        assert!(!text.contains("Transfer-Encoding: chunked\r\n"));
        assert!(!text.contains("Connection: keep-alive\r\n"));
        assert!(text.contains("Set-Cookie: a=1\r\n"));
        assert!(text.contains("Set-Cookie: b=2\r\n"));
    }

    #[test]
    fn static_file_response_streams_file_with_real_content_length() {
        let root = temp_dir("static-response");
        let file = root.join("asset.txt");
        fs::write(&file, b"hello").unwrap();

        let body_response = capture_static_file_response(&file, false);
        let body_text = String::from_utf8(body_response).unwrap();
        assert!(body_text.contains("HTTP/1.1 200 OK\r\n"));
        assert!(body_text.contains("Content-Length: 5\r\n"));
        assert!(body_text.contains("Content-Type: text/plain\r\n"));
        assert!(body_text.ends_with("\r\n\r\nhello"));

        let head_response = capture_static_file_response(&file, true);
        let head_text = String::from_utf8(head_response).unwrap();
        assert!(head_text.contains("Content-Length: 5\r\n"));
        assert!(head_text.ends_with("\r\n\r\n"));
        assert!(!head_text.contains("hello"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn server_response_wrapper_preserves_buffered_head_suppression() {
        let response = HttpResponse {
            status: 200,
            headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
            body: b"hello".to_vec(),
        };
        let expected = http_response_bytes(&response, true);

        let actual = capture_server_http_response(ServerHttpResponse::Buffered(response), true);

        assert_eq!(actual, expected);
        assert!(String::from_utf8(actual).unwrap().ends_with("\r\n\r\n"));
    }

    #[test]
    fn server_response_wrapper_preserves_static_head_length_without_body() {
        let root = temp_dir("static-server-response");
        let file = root.join("asset.css");
        fs::write(&file, b"a{b:c}").unwrap();

        let response = capture_server_http_response(ServerHttpResponse::StaticFile(file), true);
        let text = String::from_utf8(response).unwrap();

        assert!(text.contains("HTTP/1.1 200 OK\r\n"));
        assert!(text.contains("Content-Length: 6\r\n"));
        assert!(text.contains("Content-Type: text/css\r\n"));
        assert!(text.ends_with("\r\n\r\n"));
        assert!(!text.contains("a{b:c}"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn server_response_counter_stats_keeps_static_lengths_for_head_accounting() {
        let buffered_response = HttpResponse {
            status: 204,
            headers: vec![("X-Test".to_string(), "ok".to_string())],
            body: b"hello".to_vec(),
        };
        let buffered_header_bytes =
            http_response_head_bytes_with_body_len(&buffered_response, 5).len();

        assert_eq!(
            server_response_counter_stats(&ServerHttpResponse::Buffered(buffered_response)),
            (204, Some(5), Some(buffered_header_bytes))
        );

        let root = temp_dir("static-counter-stats");
        let file = root.join("asset.css");
        fs::write(&file, b"a{b:c}").unwrap();
        let static_response = HttpResponse {
            status: 200,
            headers: vec![("Content-Type".to_string(), "text/css".to_string())],
            body: Vec::new(),
        };
        let static_header_bytes = http_response_head_bytes_with_body_len(&static_response, 6).len();

        assert_eq!(
            server_response_counter_stats(&ServerHttpResponse::StaticFile(file.clone())),
            (200, Some(6), Some(static_header_bytes))
        );
        assert_eq!(
            server_response_counter_stats(&ServerHttpResponse::StaticFile(root.join("gone.txt"))),
            (200, None, None)
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn request_total_counter_marks_handle_http_request_errors() {
        let request = RequestTotalRequest {
            method: "POST".to_string(),
            target: "/wp-admin/post-new.php".to_string(),
            body_bytes: 7,
        };
        let error = crate::CliError::new("PHP worker lock was poisoned");
        let fields = request_total_fields(
            request_error_total_counter(
                Some(route_counters::request_id_for_test(501)),
                Some(Instant::now()),
                Some(&request),
                &error,
            ),
            42,
        )
        .unwrap();

        assert_eq!(
            route_counters::format_row("request.total.boundary", &fields),
            "route-counter\trow=request.total.boundary\trequest_id=501\tmethod=POST\ttarget=/wp-admin/post-new.php\troute_label=editor\tstatus=0\troute_target=handle_error\ttotal_elapsed_us=42\tbody_bytes=7\tresponse_body_bytes=unknown\theader_bytes=unknown\tworker_action=none\tresult=error\trequest_error=PHP worker lock was poisoned"
        );
    }

    fn capture_static_file_response(path: &Path, suppress_body: bool) -> Vec<u8> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let path = path.to_path_buf();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            write_static_file_response(&mut stream, &path, suppress_body).unwrap();
        });

        let mut stream = TcpStream::connect(address).unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).unwrap();
        handle.join().unwrap();
        response
    }

    fn capture_server_http_response(response: ServerHttpResponse, suppress_body: bool) -> Vec<u8> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            write_server_http_response_with_counter(&mut stream, &response, suppress_body, None)
                .unwrap();
        });

        let mut stream = TcpStream::connect(address).unwrap();
        let mut captured = Vec::new();
        stream.read_to_end(&mut captured).unwrap();
        handle.join().unwrap();
        captured
    }

    fn capture_http_response_with_counter(
        response: HttpResponse,
        suppress_body: bool,
        request_id: Option<route_counters::RequestId>,
    ) -> Vec<u8> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            write_http_response_with_counter(&mut stream, &response, suppress_body, request_id)
                .unwrap();
        });

        let mut stream = TcpStream::connect(address).unwrap();
        let mut captured = Vec::new();
        stream.read_to_end(&mut captured).unwrap();
        handle.join().unwrap();
        captured
    }

    #[test]
    fn reason_phrase_uses_unknown_for_unmapped_statuses() {
        assert_eq!(reason_phrase(408), "Request Timeout");
        assert_eq!(reason_phrase(413), "Content Too Large");
        assert_eq!(reason_phrase(422), "Unprocessable Content");
        assert_eq!(reason_phrase(501), "Not Implemented");
        assert_eq!(reason_phrase(599), "Unknown");
    }

    #[test]
    fn auto_login_cookie_clear_only_runs_on_first_request() {
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/wp-admin/".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![(
                "Cookie".to_string(),
                format!("wordpress_test_cookie=1; {AUTO_LOGIN_COOKIE_NAME}=1"),
            )],
            body: Vec::new(),
        };
        let first_request = AtomicBool::new(true);

        assert!(should_clear_auto_login_cookie(&first_request, &request));
        assert!(!first_request.load(Ordering::SeqCst));
        assert!(!should_clear_auto_login_cookie(&first_request, &request));

        let first_request = AtomicBool::new(true);
        let request_without_cookie = HttpRequest {
            headers: vec![("Cookie".to_string(), "wordpress_test_cookie=1".to_string())],
            ..request
        };

        assert!(!should_clear_auto_login_cookie(
            &first_request,
            &request_without_cookie
        ));
        assert!(!first_request.load(Ordering::SeqCst));
    }

    #[test]
    fn clear_auto_login_cookie_head_redirect_uses_counter_writer_without_body() {
        let request = HttpRequest {
            method: "HEAD".to_string(),
            target: "/wp-admin/?page=demo".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        };
        let response = clear_auto_login_cookie_response(&request);
        let expected = http_response_bytes(&response, true);

        let actual = capture_http_response_with_counter(
            response,
            true,
            Some(route_counters::request_id_for_test(151)),
        );

        assert_eq!(actual, expected);
        let text = String::from_utf8(actual).unwrap();
        assert!(text.contains("HTTP/1.1 302 Found\r\n"));
        assert!(text.contains("Content-Length: 0\r\n"));
        assert!(text.contains("Location: /wp-admin/?page=demo\r\n"));
        assert!(text.contains(&format!("Set-Cookie: {CLEAR_AUTO_LOGIN_COOKIE}\r\n")));
        assert!(text.ends_with("\r\n\r\n"));
    }

    #[test]
    fn clears_stale_auto_login_cookie_with_redirect_response() {
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/wp-admin/?page=demo".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        };

        let response = clear_auto_login_cookie_response(&request);

        assert_eq!(response.status, 302);
        assert!(response.body.is_empty());
        assert!(response
            .headers
            .contains(&("Location".to_string(), "/wp-admin/?page=demo".to_string())));
        assert!(response.headers.contains(&(
            "Set-Cookie".to_string(),
            CLEAR_AUTO_LOGIN_COOKIE.to_string()
        )));
    }

    #[test]
    fn default_server_port_falls_back_when_occupied() {
        let occupied = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let occupied_port = occupied.local_addr().unwrap().port();

        let listener = bind_server_listener_with_default(None, occupied_port).unwrap();
        assert_ne!(listener.local_addr().unwrap().port(), occupied_port);
    }

    #[test]
    fn explicit_server_port_fails_when_occupied() {
        let occupied = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let occupied_port = occupied.local_addr().unwrap().port();

        let error =
            bind_server_listener_with_default(Some(occupied_port), crate::args::DEFAULT_PORT)
                .expect_err("explicit occupied port should fail");
        assert!(error
            .to_string()
            .contains(&format!("127.0.0.1:{occupied_port}")));
    }

    #[test]
    fn resolves_root_to_wordpress_index_php_mount() {
        let root = temp_dir("route");
        fs::write(root.join("index.php"), b"<?php echo 'ok';").unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        assert_eq!(
            resolve_route(&mounts, "/").unwrap(),
            RouteTarget::Php {
                vfs_path: "/wordpress/index.php".to_string(),
                path_info: None
            }
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_static_file_from_longest_mount() {
        let root = temp_dir("static-root");
        let plugin = temp_dir("static-plugin");
        fs::create_dir_all(plugin.join("assets")).unwrap();
        fs::write(plugin.join("assets/app.js"), b"console.log('ok');").unwrap();
        let mounts = vec![
            Mount::new(&root, "/wordpress").unwrap(),
            Mount::new(&plugin, "/wordpress/wp-content/plugins/demo").unwrap(),
        ];

        let host_path =
            host_path_for_vfs_path(&mounts, "/wordpress/wp-content/plugins/demo/assets/app.js")
                .unwrap();
        assert_eq!(host_path, plugin.join("assets/app.js"));
        assert_eq!(
            resolve_route(&mounts, "/wp-content/plugins/demo/assets/app.js").unwrap(),
            RouteTarget::Static { host_path }
        );

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(plugin);
    }

    #[test]
    fn resolves_mixed_case_php_as_script() {
        let root = temp_dir("mixed-case-php");
        fs::write(root.join("Demo.PHP"), b"<?php echo 'ok';").unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        assert_eq!(
            resolve_route(&mounts, "/Demo.PHP").unwrap(),
            RouteTarget::Php {
                vfs_path: "/wordpress/Demo.PHP".to_string(),
                path_info: None
            }
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_php_path_info_before_wordpress_fallback() {
        let root = temp_dir("path-info");
        fs::write(root.join("index.php"), b"<?php echo 'index';").unwrap();
        fs::write(root.join("api.php"), b"<?php echo 'api';").unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        assert_eq!(
            resolve_route(&mounts, "/api.php/v1/resource?x=1").unwrap(),
            RouteTarget::Php {
                vfs_path: "/wordpress/api.php".to_string(),
                path_info: Some("/v1/resource".to_string())
            }
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn static_wordpress_asset_misses_do_not_fallback_to_index_php() {
        let root = temp_dir("static-miss");
        fs::write(root.join("index.php"), b"<?php echo 'index';").unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        assert_eq!(
            resolve_route(&mounts, "/wp-includes/js/missing-lane-f.js").unwrap(),
            RouteTarget::NotFound
        );
        assert_eq!(
            resolve_route(&mounts, "/wp-admin/css/missing-lane-f.css").unwrap(),
            RouteTarget::NotFound
        );
        assert_eq!(
            resolve_route(&mounts, "/wp-content/themes/demo/missing-lane-f.css").unwrap(),
            RouteTarget::NotFound
        );
        assert_eq!(
            resolve_route(&mounts, "/wp-json/").unwrap(),
            RouteTarget::Php {
                vfs_path: "/wordpress/index.php".to_string(),
                path_info: None,
            }
        );
        assert_eq!(
            resolve_route(&mounts, "/pretty-permalink/").unwrap(),
            RouteTarget::Php {
                vfs_path: "/wordpress/index.php".to_string(),
                path_info: None,
            }
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn route_target_labels_match_route_metadata_values() {
        let root = temp_dir("route-metadata");
        fs::write(root.join("index.php"), b"<?php echo 'index';").unwrap();
        fs::write(root.join("style.css"), b"body{}").unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        let php_route = resolve_route(&mounts, "/").unwrap();
        assert_eq!(route_target_label(&php_route), "php");
        assert_eq!(
            php_route,
            RouteTarget::Php {
                vfs_path: "/wordpress/index.php".to_string(),
                path_info: None,
            }
        );

        let static_route = resolve_route(&mounts, "/style.css").unwrap();
        assert_eq!(route_target_label(&static_route), "static");
        assert_eq!(
            static_route,
            RouteTarget::Static {
                host_path: root.join("style.css"),
            }
        );

        let not_found_route = resolve_route(&mounts, "/wp-content/missing.css").unwrap();
        assert_eq!(route_target_label(&not_found_route), "not_found");
        assert_eq!(not_found_route, RouteTarget::NotFound);

        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn host_path_for_vfs_path_blocks_symlink_escape() {
        let root = temp_dir("vfs-symlink-root");
        let outside = temp_dir("vfs-symlink-outside");
        fs::write(outside.join("secret.txt"), "outside").unwrap();
        std::os::unix::fs::symlink(outside.join("secret.txt"), root.join("link.txt")).unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        assert!(host_path_for_vfs_path(&mounts, "/wordpress/link.txt").is_none());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
    }

    #[test]
    fn server_mounts_refreshes_managed_wordpress_canonical_path_created_late() {
        let root = temp_dir("managed-canonical-root");
        let wordpress_root = root.join("wordpress");
        let mount = Mount::new(&wordpress_root, "/wordpress").unwrap();
        assert!(mount.canonical_host_path.is_none());

        let mut options = parse_cli_args_from(vec!["server".to_string()], &root).unwrap();
        options.mounts_before_install.push(mount);
        let config = RuntimeConfig {
            command: RuntimeCommand::Server,
            original_command: CommandName::Start,
            options,
            site_storage: Some(SiteStorage::Managed(wordpress_root.clone())),
            server_url: Some("http://127.0.0.1:9400".to_string()),
        };

        let mounts = server_mounts(&config).unwrap();
        let database_path = wordpress_root.join("wp-content/database/.ht.sqlite");
        fs::create_dir_all(database_path.parent().unwrap()).unwrap();
        fs::write(&database_path, b"sqlite").unwrap();

        assert_eq!(
            host_path_for_vfs_path(&mounts, "/wordpress/wp-content/database/.ht.sqlite"),
            Some(database_path)
        );

        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn server_mounts_refreshed_wordpress_mount_blocks_symlink_escape() {
        let root = temp_dir("managed-canonical-symlink-root");
        let wordpress_root = root.join("wordpress");
        let outside = temp_dir("managed-canonical-symlink-outside");
        fs::write(outside.join("secret.txt"), "outside").unwrap();
        let mount = Mount::new(&wordpress_root, "/wordpress").unwrap();
        assert!(mount.canonical_host_path.is_none());

        let mut options = parse_cli_args_from(vec!["server".to_string()], &root).unwrap();
        options.mounts.push(mount);
        let config = RuntimeConfig {
            command: RuntimeCommand::Server,
            original_command: CommandName::Start,
            options,
            site_storage: None,
            server_url: Some("http://127.0.0.1:9401".to_string()),
        };

        let mounts = server_mounts(&config).unwrap();
        let wordpress_mount = mounts
            .iter()
            .find(|mount| mount.vfs_path == "/wordpress")
            .unwrap();
        assert_eq!(
            wordpress_mount.canonical_host_path,
            fs::canonicalize(&wordpress_root).ok()
        );

        std::os::unix::fs::symlink(outside.join("secret.txt"), wordpress_root.join("link.txt"))
            .unwrap();

        assert!(host_path_for_vfs_path(&mounts, "/wordpress/link.txt").is_none());
        assert_eq!(
            host_path_for_vfs_path_with_symlink_policy(
                &mounts,
                "/wordpress/link.txt",
                SymlinkPolicy::Follow,
            )
            .unwrap(),
            wordpress_root.join("link.txt")
        );

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
    }

    #[cfg(unix)]
    #[test]
    fn follow_symlinks_policy_allows_static_native_write_and_snapshot_paths() {
        let root = temp_dir("follow-symlink-root");
        let outside = temp_dir("follow-symlink-outside");
        fs::write(outside.join("asset.txt"), "outside").unwrap();
        fs::write(outside.join("target.txt"), "before").unwrap();
        std::os::unix::fs::symlink(outside.join("asset.txt"), root.join("asset.txt")).unwrap();
        std::os::unix::fs::symlink(outside.join("target.txt"), root.join("target.txt")).unwrap();
        let mounts = vec![Mount::new(&root, "/wordpress").unwrap()];

        assert!(
            host_path_for_vfs_path(&mounts, "/wordpress/asset.txt").is_none(),
            "default policy must still block symlink escapes"
        );
        assert_eq!(
            host_path_for_vfs_path_with_symlink_policy(
                &mounts,
                "/wordpress/asset.txt",
                SymlinkPolicy::Follow,
            )
            .unwrap(),
            root.join("asset.txt")
        );
        assert_eq!(
            resolve_route_with_symlink_policy(&mounts, "/asset.txt", SymlinkPolicy::Follow)
                .unwrap(),
            RouteTarget::Static {
                host_path: root.join("asset.txt")
            }
        );

        run_native_startup_step_with_symlink_policy(
            &mounts,
            &StartupStep::WriteFile {
                path: "/wordpress/target.txt".to_string(),
                data: FileContentSource::Bytes(b"after".to_vec()),
            },
            SymlinkPolicy::Follow,
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(outside.join("target.txt")).unwrap(),
            "after"
        );

        let outfile = root.join("snapshot.zip");
        write_wordpress_snapshot_zip_with_symlink_policy(&mounts, &outfile, SymlinkPolicy::Follow)
            .unwrap();
        let file = fs::File::open(&outfile).unwrap();
        let mut zip = ZipArchive::new(file).unwrap();
        let mut entry = zip.by_name("/wordpress/asset.txt").unwrap();
        let mut contents = String::new();
        entry.read_to_string(&mut contents).unwrap();
        assert_eq!(contents, "outside");

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(outside);
    }

    #[test]
    fn adds_writable_tmp_mount_when_missing() {
        let mut mounts = Vec::new();

        ensure_tmp_mount(&mut mounts).unwrap();

        let tmp = mounts
            .iter()
            .find(|mount| mount.vfs_path == "/tmp")
            .unwrap()
            .host_path
            .clone();
        assert!(tmp.is_dir());
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn resolves_requested_worker_count() {
        let cwd = temp_dir("workers");
        let default = parse_cli_args_from(vec!["server".to_string()], &cwd).unwrap();
        let fixed =
            parse_cli_args_from(vec!["server".to_string(), "--workers=3".to_string()], &cwd)
                .unwrap();
        let auto = parse_cli_args_from(
            vec!["server".to_string(), "--workers=auto".to_string()],
            &cwd,
        )
        .unwrap();

        assert_eq!(
            requested_worker_count(&default),
            cpu_workers_minus_one().min(6)
        );
        assert_eq!(requested_worker_count(&fixed), 3);
        assert_eq!(requested_worker_count(&auto), cpu_workers_minus_one());
        assert!(lazy_worker_pool_enabled(&default));
        assert!(!lazy_worker_pool_enabled(&fixed));
        assert!(!lazy_worker_pool_enabled(&auto));
        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn max_requests_per_worker_env_override_accepts_positive_values() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = std::env::var_os(MAX_REQUESTS_PER_WORKER_ENV_VAR);
        std::env::remove_var(MAX_REQUESTS_PER_WORKER_ENV_VAR);
        assert_eq!(
            max_requests_per_worker_from_env(),
            MAX_NATIVE_ASYNCIFY_REQUESTS_PER_WORKER
        );

        std::env::set_var(MAX_REQUESTS_PER_WORKER_ENV_VAR, "1");
        assert_eq!(max_requests_per_worker_from_env(), 1);

        std::env::set_var(MAX_REQUESTS_PER_WORKER_ENV_VAR, "0");
        assert_eq!(
            max_requests_per_worker_from_env(),
            MAX_NATIVE_ASYNCIFY_REQUESTS_PER_WORKER
        );

        std::env::set_var(MAX_REQUESTS_PER_WORKER_ENV_VAR, "not-a-number");
        assert_eq!(
            max_requests_per_worker_from_env(),
            MAX_NATIVE_ASYNCIFY_REQUESTS_PER_WORKER
        );

        if let Some(previous) = previous {
            std::env::set_var(MAX_REQUESTS_PER_WORKER_ENV_VAR, previous);
        } else {
            std::env::remove_var(MAX_REQUESTS_PER_WORKER_ENV_VAR);
        }
    }

    #[test]
    fn recycle_wasm_memory_threshold_env_accepts_mib_values() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = std::env::var_os(RECYCLE_WASM_MEMORY_MIB_ENV_VAR);
        std::env::remove_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR);
        assert_eq!(
            recycle_wasm_memory_threshold_from_env(),
            Some(DEFAULT_RECYCLE_WASM_MEMORY_MIB * 1024 * 1024)
        );

        std::env::set_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR, "80");
        assert_eq!(
            recycle_wasm_memory_threshold_from_env(),
            Some(80 * 1024 * 1024)
        );

        std::env::set_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR, "0");
        assert_eq!(recycle_wasm_memory_threshold_from_env(), None);

        std::env::set_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR, "4097");
        assert_eq!(
            recycle_wasm_memory_threshold_from_env(),
            Some(DEFAULT_RECYCLE_WASM_MEMORY_MIB * 1024 * 1024)
        );

        std::env::set_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR, "not-a-number");
        assert_eq!(
            recycle_wasm_memory_threshold_from_env(),
            Some(DEFAULT_RECYCLE_WASM_MEMORY_MIB * 1024 * 1024)
        );

        if let Some(previous) = previous {
            std::env::set_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR, previous);
        } else {
            std::env::remove_var(RECYCLE_WASM_MEMORY_MIB_ENV_VAR);
        }
    }

    #[test]
    fn worker_recycle_idle_delay_env_override_accepts_milliseconds() {
        let _guard = ENV_LOCK.lock().unwrap();
        let previous = std::env::var_os(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR);
        std::env::remove_var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR);
        assert_eq!(
            worker_recycle_idle_delay_from_env(),
            WORKER_RECYCLE_IDLE_DELAY
        );

        std::env::set_var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR, "250");
        assert_eq!(
            worker_recycle_idle_delay_from_env(),
            Duration::from_millis(250)
        );

        std::env::set_var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR, "not-a-number");
        assert_eq!(
            worker_recycle_idle_delay_from_env(),
            WORKER_RECYCLE_IDLE_DELAY
        );

        std::env::set_var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR, "60001");
        assert_eq!(
            worker_recycle_idle_delay_from_env(),
            WORKER_RECYCLE_IDLE_DELAY
        );

        if let Some(previous) = previous {
            std::env::set_var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR, previous);
        } else {
            std::env::remove_var(WORKER_RECYCLE_IDLE_DELAY_ENV_VAR);
        }
    }

    #[test]
    fn lazy_worker_retirement_reserves_extra_workers_only() {
        let created_workers = Mutex::new(3);

        assert!(reserve_lazy_worker_retirement(true, &created_workers).unwrap());
        assert_eq!(*created_workers.lock().unwrap(), 2);
        assert!(reserve_lazy_worker_retirement(true, &created_workers).unwrap());
        assert_eq!(*created_workers.lock().unwrap(), 1);
        assert!(!reserve_lazy_worker_retirement(true, &created_workers).unwrap());
        assert_eq!(*created_workers.lock().unwrap(), 1);

        let fixed_workers = Mutex::new(3);
        assert!(!reserve_lazy_worker_retirement(false, &fixed_workers).unwrap());
        assert_eq!(*fixed_workers.lock().unwrap(), 3);
    }

    #[test]
    fn worker_after_request_labels_match_counter_values() {
        assert_eq!(
            worker_after_request_label(&WorkerAfterRequest::Keep),
            "keep"
        );
        assert_eq!(
            worker_after_request_label(&WorkerAfterRequest::Recycle {
                delay: Duration::from_millis(25),
                force: false,
            }),
            "recycle"
        );
        assert_eq!(
            worker_after_request_label(&WorkerAfterRequest::Recycle {
                delay: Duration::ZERO,
                force: true,
            }),
            "recycle_force"
        );
        assert_eq!(
            worker_after_request_label(&WorkerAfterRequest::Retire),
            "retire"
        );
    }

    #[test]
    fn mark_worker_request_finished_keeps_recycles_forces_and_retires() {
        let created_workers = Mutex::new(1);
        let mut worker = retained_worker(0, false);
        let action = mark_worker_request_finished(
            &mut worker,
            &created_workers,
            false,
            2,
            None,
            Duration::from_millis(25),
            None,
        )
        .unwrap();
        assert!(matches!(action, WorkerAfterRequest::Keep));
        assert_eq!(worker_after_request_label(&action), "keep");
        assert_eq!(worker.requests_handled, 1);
        assert!(!worker.recycle_scheduled);

        let mut worker = retained_worker(1, false);
        let action = mark_worker_request_finished(
            &mut worker,
            &created_workers,
            false,
            2,
            None,
            Duration::from_millis(25),
            None,
        )
        .unwrap();
        assert!(matches!(
            action,
            WorkerAfterRequest::Recycle {
                delay,
                force: false,
            } if delay == Duration::from_millis(25)
        ));
        assert_eq!(worker_after_request_label(&action), "recycle");
        assert_eq!(worker.requests_handled, 2);
        assert!(worker.recycle_scheduled);

        let mut worker = retained_worker(0, false);
        let action = mark_worker_request_finished(
            &mut worker,
            &created_workers,
            false,
            10,
            Some(100),
            Duration::from_millis(25),
            Some(100),
        )
        .unwrap();
        assert!(matches!(
            action,
            WorkerAfterRequest::Recycle {
                delay,
                force: true,
            } if delay == Duration::from_millis(25)
        ));
        assert_eq!(worker_after_request_label(&action), "recycle_force");
        assert_eq!(worker.requests_handled, 1);
        assert!(worker.recycle_scheduled);

        let created_workers = Mutex::new(2);
        let mut worker = retained_worker(0, false);
        let action = mark_worker_request_finished(
            &mut worker,
            &created_workers,
            true,
            10,
            None,
            Duration::from_millis(25),
            None,
        )
        .unwrap();
        assert!(matches!(action, WorkerAfterRequest::Retire));
        assert_eq!(worker_after_request_label(&action), "retire");
        assert_eq!(worker.requests_handled, 1);
        assert_eq!(*created_workers.lock().unwrap(), 1);
        assert!(!worker.recycle_scheduled);
    }

    #[test]
    fn mark_worker_request_finished_keeps_already_scheduled_recycle() {
        let created_workers = Mutex::new(2);
        let mut worker = retained_worker(10, true);
        let action = mark_worker_request_finished(
            &mut worker,
            &created_workers,
            true,
            1,
            Some(1),
            Duration::from_millis(25),
            Some(1),
        )
        .unwrap();

        assert!(matches!(action, WorkerAfterRequest::Keep));
        assert_eq!(worker_after_request_label(&action), "keep");
        assert_eq!(worker.requests_handled, 11);
        assert_eq!(*created_workers.lock().unwrap(), 2);
        assert!(worker.recycle_scheduled);
    }

    fn retained_worker(requests_handled: usize, recycle_scheduled: bool) -> PhpWorker {
        PhpWorker {
            php: None,
            requests_handled,
            last_request_finished_at: Instant::now(),
            recycle_scheduled,
        }
    }

    #[test]
    fn parses_supported_blueprint_startup_steps() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "siteOptions": { "blogname": "Native Blog" },
                "steps": [
                    {
                        "step": "setSiteOptions",
                        "options": { "blogdescription": "Local" }
                    },
                    {
                        "step": "activatePlugin",
                        "pluginPath": "/wordpress/wp-content/plugins/demo"
                    },
                    {
                        "step": "activateTheme",
                        "themeFolderName": "twentytwentyfive"
                    },
                    {
                        "step": "setSiteLanguage",
                        "language": "es_ES"
                    },
                    {
                        "step": "runPHP",
                        "code": { "content": "<?php echo 'ok';" }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::SetSiteOptions {
                    options_json: r#"{"blogname":"Native Blog"}"#.to_string()
                },
                StartupStep::SetSiteOptions {
                    options_json: r#"{"blogdescription":"Local"}"#.to_string()
                },
                StartupStep::ActivatePlugin {
                    plugin_path: "/wordpress/wp-content/plugins/demo".to_string()
                },
                StartupStep::ActivateTheme {
                    theme_folder_name: "twentytwentyfive".to_string()
                },
                StartupStep::SetSiteLanguage {
                    language: "es_ES".to_string()
                },
                StartupStep::RunPhp {
                    code: "<?php echo 'ok';".to_string()
                },
            ]
        );
    }

    #[test]
    fn rejects_invalid_set_site_language_shapes() {
        let missing_language = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "setSiteLanguage" }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(missing_language
            .to_string()
            .contains("setSiteLanguage requires a string language"));

        let empty_language = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "setSiteLanguage", "language": "" }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(empty_language
            .to_string()
            .contains("setSiteLanguage language cannot be empty"));
    }

    #[test]
    fn selects_wordpress_translation_url_case_insensitively() {
        let url = wordpress_translation_url_from_api_response(
            br#"{
                "translations": [
                    { "language": "fr_FR", "package": "https://example.com/fr.zip" },
                    { "language": "es_ES", "package": "https://example.com/es.zip" }
                ]
            }"#,
            "es_es",
            "6.8",
        )
        .unwrap();

        assert_eq!(url, "https://example.com/es.zip");

        let error = wordpress_translation_url_from_api_response(
            br#"{ "translations": [] }"#,
            "zz_ZZ",
            "6.8",
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("Failed to get zz_ZZ translation package for WordPress 6.8"));
    }

    #[test]
    fn set_site_language_script_updates_option_and_escapes_language() {
        let script = set_site_language_metadata_script(r"es_ES'\demo");

        assert!(script.contains("update_option('WPLANG', 'es_ES\\'\\\\demo');"));
        assert!(script.contains("'wpVersion' => $wp_version"));
        assert!(script.contains("get_plugins()"));
        assert!(script.contains("wp_get_themes()"));
    }

    #[test]
    fn parses_run_php_with_options_step() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "runPHPWithOptions",
                        "options": {
                            "code": "<?php echo file_get_contents('php://input');",
                            "relativeUri": "/native-run?x=1",
                            "protocol": "https",
                            "method": "post",
                            "headers": {
                                "Host": "example.test:9443",
                                "Content-Type": "text/plain",
                                "Cookie": "native=1"
                            },
                            "body": "payload",
                            "env": { "NATIVE_ENV": "present" },
                            "$_SERVER": { "CUSTOM_SERVER": "set" }
                        }
                    },
                    {
                        "step": "runPHPWithOptions",
                        "options": {
                            "scriptPath": "wordpress/custom.php",
                            "relativeUri": "/custom.php"
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        let StartupStep::RunPhpWithOptions { options } = &steps[0] else {
            panic!("expected runPHPWithOptions");
        };
        assert_eq!(
            options.script,
            PhpRunScript::Code("<?php echo file_get_contents('php://input');".to_string())
        );
        assert_eq!(options.relative_uri, "/native-run?x=1");
        assert_eq!(options.protocol, "https");
        assert_eq!(options.method, "POST");
        assert!(options
            .headers
            .contains(&("host".to_string(), "example.test:9443".to_string())));
        assert!(options
            .headers
            .contains(&("content-type".to_string(), "text/plain".to_string())));
        assert!(options
            .headers
            .contains(&("cookie".to_string(), "native=1".to_string())));
        assert_eq!(options.body, b"payload");
        assert_eq!(
            options.env,
            vec![("NATIVE_ENV".to_string(), "present".to_string())]
        );
        assert_eq!(
            options.server_entries,
            vec![("CUSTOM_SERVER".to_string(), "set".to_string())]
        );

        let StartupStep::RunPhpWithOptions { options } = &steps[1] else {
            panic!("expected runPHPWithOptions");
        };
        assert_eq!(
            options.script,
            PhpRunScript::ScriptPath("/wordpress/custom.php".to_string())
        );
        assert_eq!(options.relative_uri, "/custom.php");
        assert_eq!(options.method, "GET");
    }

    #[test]
    fn rejects_invalid_run_php_with_options_shapes() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "runPHPWithOptions", "options": [] }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("options must be an object"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "runPHPWithOptions", "options": { "body": "payload" } }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("must include code or scriptPath"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "runPHPWithOptions",
                        "options": {
                            "code": "<?php",
                            "headers": { "X-Native": 1 }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("header `X-Native` value"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "runPHPWithOptions",
                        "options": {
                            "code": "<?php",
                            "env": { "NATIVE_ENV": false }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("options.env.NATIVE_ENV must be a string"));
    }

    #[test]
    fn parses_request_step_with_relative_absolute_and_form_requests() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "request",
                        "request": {
                            "method": "post",
                            "url": "https://example.test/wp-admin/admin-ajax.php?action=demo#fragment",
                            "headers": { "X-Native": "yes" },
                            "body": {
                                "action": "demo",
                                "binary": {
                                    "BYTES_PER_ELEMENT": 1,
                                    "buffer": { "byteLength": 2 },
                                    "byteLength": 2,
                                    "byteOffset": 0,
                                    "length": 2,
                                    "0": 65,
                                    "1": 66
                                }
                            }
                        }
                    },
                    {
                        "step": "request",
                        "request": {
                            "url": "wp-admin/",
                            "formData": { "legacy": "field" }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        let StartupStep::Request { request } = &steps[0] else {
            panic!("expected request step");
        };
        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/wp-admin/admin-ajax.php?action=demo");
        assert!(request
            .headers
            .contains(&("x-native".to_string(), "yes".to_string())));
        let content_type = request
            .headers
            .iter()
            .find(|(name, _)| name == "content-type")
            .map(|(_, value)| value.as_str())
            .unwrap();
        assert!(content_type.starts_with("multipart/form-data; boundary="));
        let body = String::from_utf8_lossy(&request.body);
        assert!(body.contains("name=\"action\""));
        assert!(body.contains("demo"));
        assert!(body.contains("name=\"binary\""));
        assert!(request
            .body
            .windows(b"AB".len())
            .any(|window| window == b"AB"));

        let StartupStep::Request { request } = &steps[1] else {
            panic!("expected request step");
        };
        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/wp-admin/");
        assert!(request
            .headers
            .iter()
            .any(|(name, value)| name == "content-type" && value.starts_with("multipart/")));
    }

    #[test]
    fn rejects_invalid_request_step_shapes() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "request", "request": { "url": "" } }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("url cannot be empty"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "request", "request": { "url": "/", "method": "TRACE" } }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("method `TRACE` is not supported"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "request",
                        "request": {
                            "url": "/",
                            "body": "body",
                            "formData": { "field": "value" }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("both request.body and request.formData"));
    }

    #[test]
    fn parses_import_wxr_and_injects_wordpress_importer() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "importWxr",
                        "file": {
                            "resource": "literal",
                            "name": "content.xml",
                            "contents": "<rss></rss>"
                        }
                    },
                    {
                        "step": "importWxr",
                        "file": {
                            "resource": "vfs",
                            "path": "/tmp/second.xml"
                        },
                        "importer": "default"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(steps[0], wordpress_importer_install_step());
        assert_eq!(
            steps[1],
            StartupStep::ImportWxr {
                file: FileContentSource::Bytes(b"<rss></rss>".to_vec()),
            }
        );
        assert_eq!(
            steps[2],
            StartupStep::ImportWxr {
                file: FileContentSource::VfsPath("/tmp/second.xml".to_string()),
            }
        );
        assert!(import_wxr_script().contains("define('WP_LOAD_IMPORTERS', true);"));
        assert!(import_wxr_script().contains("'rewrite_urls' => true"));
    }

    #[test]
    fn parses_legacy_import_file_as_import_wxr() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "importFile",
                        "file": {
                            "resource": "literal",
                            "name": "legacy.xml",
                            "contents": "<rss></rss>"
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(steps[0], wordpress_importer_install_step());
        assert_eq!(
            steps[1],
            StartupStep::ImportWxr {
                file: FileContentSource::Bytes(b"<rss></rss>".to_vec()),
            }
        );
    }

    #[test]
    fn rejects_invalid_import_wxr_shapes() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "importWxr" }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("importWxr requires file"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "importWxr",
                        "file": { "resource": "literal", "name": "content.xml", "contents": "" },
                        "importer": "unknown"
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("importWxr importer `unknown` is not supported"));
    }

    #[test]
    fn parses_import_wordpress_files_and_rejects_unsafe_path_in_zip() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "importWordPressFiles",
                        "wordPressFilesZip": {
                            "resource": "literal",
                            "name": "export.zip",
                            "contents": "zip-bytes"
                        },
                        "pathInZip": "/nested/site/"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::ImportWordPressFiles {
                zip: FileContentSource::Bytes(b"zip-bytes".to_vec()),
                path_in_zip: "nested/site".to_string(),
            }]
        );

        let missing_zip = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "importWordPressFiles" }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(missing_zip
            .to_string()
            .contains("importWordPressFiles requires wordPressFilesZip"));

        for path_in_zip in ["../site", "C:/site", "nested\\site"] {
            let blueprint = serde_json::json!({
                "steps": [
                    {
                        "step": "importWordPressFiles",
                        "wordPressFilesZip": {
                            "resource": "literal",
                            "name": "export.zip",
                            "contents": ""
                        },
                        "pathInZip": path_in_zip
                    }
                ]
            })
            .to_string();
            let error = startup_steps_from_blueprint_json(&blueprint, false).unwrap_err();
            assert!(error
                .to_string()
                .contains("pathInZip must be a relative path inside the ZIP"));
        }
    }

    #[test]
    fn native_import_wordpress_files_replaces_files_and_preserves_playground_paths() {
        let root = temp_dir("import-wordpress-files-native");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(wordpress_root.join("wp-content/plugins/akismet")).unwrap();
        fs::create_dir_all(wordpress_root.join("wp-content/plugins/custom")).unwrap();
        fs::create_dir_all(wordpress_root.join("wp-content/database")).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        fs::write(wordpress_root.join("index.php"), "old index").unwrap();
        fs::write(
            wordpress_root.join("old-only.txt"),
            "preserve absent top-level",
        )
        .unwrap();
        fs::write(wordpress_root.join("wp-content/db.php"), "live db dropin").unwrap();
        fs::write(
            wordpress_root.join("wp-content/plugins/akismet/live.php"),
            "live akismet",
        )
        .unwrap();
        fs::write(
            wordpress_root.join("wp-content/plugins/custom/old.php"),
            "old custom",
        )
        .unwrap();
        fs::write(
            wordpress_root.join("wp-content/database/.ht.sqlite"),
            "live sqlite",
        )
        .unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let zip = blueprint_zip(vec![
            (
                "site/playground-export.json",
                r#"{ "siteUrl": "http://playground.test/scope:old/" }"#,
            ),
            ("site/index.php", "new index"),
            ("site/wp-content/db.php", "imported db dropin"),
            (
                "site/wp-content/plugins/akismet/imported.php",
                "imported akismet",
            ),
            ("site/wp-content/plugins/custom/new.php", "new custom"),
        ]);

        let old_site_url = import_wordpress_files_replace_files(
            &mounts,
            0,
            &FileContentSource::Bytes(zip),
            "site",
        )
        .unwrap();

        assert_eq!(
            old_site_url,
            Some("http://playground.test/scope:old/".to_string())
        );
        assert_eq!(
            fs::read_to_string(wordpress_root.join("index.php")).unwrap(),
            "new index"
        );
        assert_eq!(
            fs::read_to_string(wordpress_root.join("old-only.txt")).unwrap(),
            "preserve absent top-level"
        );
        assert!(!wordpress_root.join("playground-export.json").exists());
        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/db.php")).unwrap(),
            "live db dropin"
        );
        assert!(wordpress_root
            .join("wp-content/plugins/akismet/live.php")
            .is_file());
        assert!(!wordpress_root
            .join("wp-content/plugins/akismet/imported.php")
            .exists());
        assert!(wordpress_root
            .join("wp-content/plugins/custom/new.php")
            .is_file());
        assert!(!wordpress_root
            .join("wp-content/plugins/custom/old.php")
            .exists());
        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/database/.ht.sqlite")).unwrap(),
            "live sqlite"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_import_wordpress_files_keeps_imported_database_and_malformed_manifest() {
        let root = temp_dir("import-wordpress-files-imported-db");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(wordpress_root.join("wp-content/database")).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        fs::write(
            wordpress_root.join("wp-content/database/.ht.sqlite"),
            "live sqlite",
        )
        .unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let zip = blueprint_zip(vec![
            ("playground-export.json", "{not json"),
            ("wp-content/database/imported.sqlite", "imported sqlite"),
        ]);

        let old_site_url =
            import_wordpress_files_replace_files(&mounts, 0, &FileContentSource::Bytes(zip), "")
                .unwrap();

        assert_eq!(old_site_url, None);
        assert!(wordpress_root.join("playground-export.json").is_file());
        assert!(wordpress_root
            .join("wp-content/database/imported.sqlite")
            .is_file());
        assert!(!wordpress_root
            .join("wp-content/database/.ht.sqlite")
            .exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn import_wordpress_files_scope_helpers_match_blueprint_behavior() {
        assert_eq!(
            extract_scope_path("http://playground.test/scope:source/wp-admin/"),
            Some("/scope:source/".to_string())
        );
        assert_eq!(
            extract_scope_path("http://playground.test/scope:source"),
            Some("/scope:source/".to_string())
        );
        assert_eq!(extract_scope_path("http://localhost:9400/"), None);

        let script = import_wordpress_files_rewrite_scope_script("/scope:old'\\/", "/scope:new/");
        assert!(script.contains("post_content = REPLACE"));
        assert!(script.contains("comment_author_url = REPLACE"));
        assert!(script.contains("scope:old"));
        assert!(script.contains("scope:new"));
    }

    #[test]
    fn parses_run_wp_installation_wizard_step_and_builds_request() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "runWpInstallationWizard",
                        "options": {}
                    },
                    {
                        "step": "runWpInstallationWizard",
                        "options": {
                            "adminUsername": "ignored",
                            "adminPassword": "secret"
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::RunWpInstallationWizard {
                    admin_password: None,
                },
                StartupStep::RunWpInstallationWizard {
                    admin_password: Some("secret".to_string()),
                },
            ]
        );

        let request = wp_installation_wizard_request(Some("secret")).unwrap();
        assert_eq!(request.method, "POST");
        assert_eq!(request.target, "/wp-admin/install.php?step=2");
        assert!(request
            .headers
            .iter()
            .any(|(name, value)| name == "content-type" && value.starts_with("multipart/")));
        let body = String::from_utf8_lossy(&request.body);
        assert!(body.contains("name=\"user_name\""));
        assert!(body.contains("secret"));
        assert!(body.contains("name=\"admin_password\""));
        assert!(body.contains("name=\"admin_password2\""));

        let request = wp_installation_wizard_request(None).unwrap();
        let body = String::from_utf8_lossy(&request.body);
        assert!(body.contains("admin"));
        assert!(body.contains("password"));
    }

    #[test]
    fn rejects_invalid_run_wp_installation_wizard_options() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "runWpInstallationWizard", "options": [] }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("options must be an object"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "runWpInstallationWizard",
                        "options": { "adminPassword": false }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("options.adminPassword must be a string"));
    }

    #[test]
    fn parses_wp_cli_steps_and_splits_shell_commands() {
        assert_eq!(
            split_shell_command(r#"wp option update blogname "Native Blog""#),
            vec!["wp", "option", "update", "blogname", "Native Blog"]
        );
        assert_eq!(
            split_shell_command(r#"wp post create --post_title='Quoted title'"#),
            vec!["wp", "post", "create", "--post_title=Quoted title"]
        );

        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "wp-cli",
                        "command": "wp option update blogname \"Native Blog\""
                    },
                    {
                        "step": "wp-cli",
                        "wpCliPath": "/tools/wp-cli.phar",
                        "command": [
                            "wp",
                            "media",
                            "import",
                            "wordpress/wp-content/uploads/demo.png"
                        ]
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::EnsureWpCli {
                    wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
                },
                StartupStep::WpCli {
                    wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
                    args: vec![
                        "option".to_string(),
                        "update".to_string(),
                        "blogname".to_string(),
                        "Native Blog".to_string(),
                    ],
                },
                StartupStep::WpCli {
                    wp_cli_path: "/tools/wp-cli.phar".to_string(),
                    args: vec![
                        "media".to_string(),
                        "import".to_string(),
                        "/wordpress/wp-content/uploads/demo.png".to_string(),
                    ],
                },
            ]
        );

        let script = wp_cli_runner_script(
            "/tools/wp-cli.phar",
            &[
                "option".to_string(),
                "update".to_string(),
                "blogname".to_string(),
                "Native Blog".to_string(),
            ],
        );
        assert!(script.contains("putenv('SHELL_PIPE=0');"));
        assert!(script.contains("'--path=/wordpress'"));
        assert!(script.contains("'Native Blog'"));
        assert!(script.contains("require('/tools/wp-cli.phar');"));
    }

    #[test]
    fn injects_wp_cli_library_step_for_extra_libraries_and_dependent_steps() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "extraLibraries": [ "wp-cli" ],
                "steps": [
                    {
                        "step": "setSiteOptions",
                        "options": { "blogname": "Native Blog" }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::SetSiteOptions {
                    options_json: r#"{"blogname":"Native Blog"}"#.to_string(),
                },
                StartupStep::EnsureWpCli {
                    wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
                },
            ]
        );

        let steps = startup_steps_from_blueprint_json(
            r#"{
                "extraLibraries": [ "wp-cli" ],
                "steps": [
                    {
                        "step": "setSiteOptions",
                        "options": { "blogname": "Native Blog" }
                    },
                    {
                        "step": "wp-cli",
                        "command": "wp option get blogname"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::SetSiteOptions {
                    options_json: r#"{"blogname":"Native Blog"}"#.to_string(),
                },
                StartupStep::EnsureWpCli {
                    wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
                },
                StartupStep::WpCli {
                    wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
                    args: vec![
                        "option".to_string(),
                        "get".to_string(),
                        "blogname".to_string(),
                    ],
                },
            ]
        );

        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "wp-cli",
                        "command": "wp option get blogname"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps[0],
            StartupStep::EnsureWpCli {
                wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
            }
        );
    }

    #[test]
    fn parses_enable_multisite_and_validates_multisite_url_settings() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "enableMultisite",
                        "wpCliPath": "/tools/wp-cli.phar"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::EnsureWpCli {
                    wp_cli_path: DEFAULT_WP_CLI_PATH.to_string(),
                },
                StartupStep::EnableMultisite {
                    wp_cli_path: "/tools/wp-cli.phar".to_string(),
                },
            ]
        );

        let settings = multisite_url_settings("http://playground-domain/scope:987987/").unwrap();
        assert_eq!(settings.host, "playground-domain");
        assert_eq!(settings.site_path, "/scope:987987/");
        assert_eq!(settings.site_url, "http://playground-domain/scope:987987/");

        let settings = multisite_url_settings("https://playground-domain").unwrap();
        assert_eq!(settings.host, "playground-domain");
        assert_eq!(settings.site_path, "/");
        assert_eq!(settings.site_url, "https://playground-domain/");

        let error = multisite_url_settings("http://localhost:9400/").unwrap_err();
        assert!(error.to_string().contains("do not support custom ports"));
        assert!(error.to_string().contains("--site-url"));
    }

    #[test]
    fn injects_http_host_into_wp_config_for_multisite() {
        assert_eq!(
            inject_http_host_into_wp_config("<?php\nrequire_once 'wp-settings.php';", "site.test"),
            "<?php\n$_SERVER['HTTP_HOST'] = 'site.test';\nrequire_once 'wp-settings.php';"
        );
        assert_eq!(
            inject_http_host_into_wp_config(
                "<?php\n$_SERVER['HTTP_HOST'] = 'already.test';\n",
                "site.test"
            ),
            "<?php\n$_SERVER['HTTP_HOST'] = 'already.test';\n"
        );
        assert_eq!(
            remove_wp_allow_multisite_define(
                "<?php\ndefine( 'WP_ALLOW_MULTISITE', true );\ndefine( 'MULTISITE', true );\n"
            ),
            "<?php\ndefine( 'MULTISITE', true );\n"
        );
    }

    #[test]
    fn rejects_invalid_extra_libraries() {
        let error = startup_steps_from_blueprint_json(
            r#"{ "extraLibraries": "wp-cli", "steps": [] }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("extraLibraries must be an array"));

        let error =
            startup_steps_from_blueprint_json(r#"{ "extraLibraries": [ 1 ], "steps": [] }"#, false)
                .unwrap_err();
        assert!(error
            .to_string()
            .contains("extraLibraries entries must be strings"));

        let error = startup_steps_from_blueprint_json(
            r#"{ "extraLibraries": [ "unsupported" ], "steps": [] }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("extraLibraries entry `unsupported` is not supported"));
    }

    #[test]
    fn rejects_invalid_wp_cli_steps() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "wp-cli", "command": "option get blogname" }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("first wp-cli command argument"));

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "wp-cli", "command": ["wp", 1] }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("array values must be strings"));
    }

    #[test]
    fn parses_file_blueprint_steps_and_resources() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "writeFile",
                        "path": "wordpress/generated.txt",
                        "data": "plain text"
                    },
                    {
                        "step": "writeFile",
                        "path": "/wordpress/literal.txt",
                        "data": {
                            "resource": "literal",
                            "name": "literal.txt",
                            "contents": "literal text"
                        }
                    },
                    {
                        "step": "writeFile",
                        "path": "/wordpress/binary.dat",
                        "data": {
                            "BYTES_PER_ELEMENT": 1,
                            "buffer": { "byteLength": 3 },
                            "byteLength": 3,
                            "byteOffset": 0,
                            "length": 3,
                            "0": 65,
                            "1": 0,
                            "2": 66
                        }
                    },
                    {
                        "step": "writeFile",
                        "path": "/wordpress/from-vfs.txt",
                        "data": { "resource": "vfs", "path": "tmp/source.txt" }
                    },
                    {
                        "step": "writeFile",
                        "path": "/wordpress/from-url.zip",
                        "data": {
                            "resource": "wordpress.org/plugins",
                            "slug": "hello-dolly"
                        }
                    },
                    { "step": "mkdir", "path": "wordpress/new-dir" },
                    { "step": "rm", "path": "wordpress/old.txt" },
                    { "step": "rmdir", "path": "wordpress/old-dir" },
                    {
                        "step": "cp",
                        "fromPath": "wordpress/generated.txt",
                        "toPath": "/tmp/generated.txt"
                    },
                    {
                        "step": "mv",
                        "fromPath": "/tmp/generated.txt",
                        "toPath": "wordpress/moved.txt"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::WriteFile {
                    path: "/wordpress/generated.txt".to_string(),
                    data: FileContentSource::Bytes(b"plain text".to_vec())
                },
                StartupStep::WriteFile {
                    path: "/wordpress/literal.txt".to_string(),
                    data: FileContentSource::Bytes(b"literal text".to_vec())
                },
                StartupStep::WriteFile {
                    path: "/wordpress/binary.dat".to_string(),
                    data: FileContentSource::Bytes(vec![65, 0, 66])
                },
                StartupStep::WriteFile {
                    path: "/wordpress/from-vfs.txt".to_string(),
                    data: FileContentSource::VfsPath("/tmp/source.txt".to_string())
                },
                StartupStep::WriteFile {
                    path: "/wordpress/from-url.zip".to_string(),
                    data: FileContentSource::Url(
                        "https://downloads.wordpress.org/plugin/hello-dolly.latest-stable.zip"
                            .to_string()
                    )
                },
                StartupStep::Mkdir {
                    path: "/wordpress/new-dir".to_string()
                },
                StartupStep::Rm {
                    path: "/wordpress/old.txt".to_string()
                },
                StartupStep::Rmdir {
                    path: "/wordpress/old-dir".to_string()
                },
                StartupStep::Cp {
                    from_path: "/wordpress/generated.txt".to_string(),
                    to_path: "/tmp/generated.txt".to_string()
                },
                StartupStep::Mv {
                    from_path: "/tmp/generated.txt".to_string(),
                    to_path: "/wordpress/moved.txt".to_string()
                },
            ]
        );
    }

    #[test]
    fn parses_write_files_literal_directory() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "writeFiles",
                        "writeToPath": "wordpress/wp-content/plugins/native-demo",
                        "filesTree": {
                            "resource": "literal:directory",
                            "name": "native-demo",
                            "files": {
                                "demo.php": "<?php echo 'demo';",
                                "assets": {
                                    "style.css": "body { color: black; }",
                                    "binary.dat": {
                                        "BYTES_PER_ELEMENT": 1,
                                        "buffer": { "byteLength": 2 },
                                        "byteLength": 2,
                                        "byteOffset": 0,
                                        "length": 2,
                                        "0": 1,
                                        "1": 255
                                    }
                                }
                            }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        let mut assets = BTreeMap::new();
        assets.insert("binary.dat".to_string(), FileTreeEntry::File(vec![1, 255]));
        assets.insert(
            "style.css".to_string(),
            FileTreeEntry::File(b"body { color: black; }".to_vec()),
        );
        let mut files = BTreeMap::new();
        files.insert("assets".to_string(), FileTreeEntry::Directory(assets));
        files.insert(
            "demo.php".to_string(),
            FileTreeEntry::File(b"<?php echo 'demo';".to_vec()),
        );

        assert_eq!(
            steps,
            vec![StartupStep::WriteFiles {
                write_to_path: "/wordpress/wp-content/plugins/native-demo".to_string(),
                files: FileTreeSource::Literal(files),
            }]
        );
    }

    #[test]
    fn parses_unzip_zip_file_and_deprecated_zip_path() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "unzip",
                        "zipFile": {
                            "resource": "literal",
                            "name": "files.zip",
                            "contents": "zip-bytes"
                        },
                        "extractToPath": "wordpress/wp-content/uploads"
                    },
                    {
                        "step": "unzip",
                        "zipPath": "tmp/files.zip",
                        "extractToPath": "/wordpress/extracted"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::Unzip {
                    zip: FileContentSource::Bytes(b"zip-bytes".to_vec()),
                    extract_to_path: "/wordpress/wp-content/uploads".to_string(),
                },
                StartupStep::Unzip {
                    zip: FileContentSource::VfsPath("/tmp/files.zip".to_string()),
                    extract_to_path: "/wordpress/extracted".to_string(),
                },
            ]
        );
    }

    #[test]
    fn parses_zip_wrapped_literal_directory_install_asset() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "zip",
                            "name": "demo-plugin.zip",
                            "inner": {
                                "resource": "literal:directory",
                                "name": "demo-plugin",
                                "files": {
                                    "demo.php": "<?php echo 'demo';",
                                    "assets": {
                                        "style.css": "body { color: black; }"
                                    }
                                }
                            }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        let mut assets = BTreeMap::new();
        assets.insert(
            "style.css".to_string(),
            FileTreeEntry::File(b"body { color: black; }".to_vec()),
        );
        let mut files = BTreeMap::new();
        files.insert("assets".to_string(), FileTreeEntry::Directory(assets));
        files.insert(
            "demo.php".to_string(),
            FileTreeEntry::File(b"<?php echo 'demo';".to_vec()),
        );

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Content {
                        source: FileContentSource::ZipWrappedDirectory {
                            name: "demo-plugin".to_string(),
                            files,
                        },
                        filename: "demo-plugin.zip".to_string(),
                    },
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: true,
                }
            }]
        );
    }

    #[test]
    fn parses_zip_wrapped_git_directory_resource() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "unzip",
                        "zipFile": {
                            "resource": "zip",
                            "inner": {
                                "resource": "git:directory",
                                "url": "https://github.com/example/repo",
                                "ref": "trunk"
                            }
                        },
                        "extractToPath": "/wordpress"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::Unzip {
                zip: FileContentSource::ZipWrappedGitDirectory(GitDirectoryResource {
                    url: "https://github.com/example/repo".to_string(),
                    ref_name: "trunk".to_string(),
                    ref_type: None,
                    path: String::new(),
                    include_git: false,
                }),
                extract_to_path: "/wordpress".to_string(),
            }]
        );
    }

    #[test]
    fn derives_zip_wrapper_name_without_double_zip_suffix() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "zip",
                            "inner": {
                                "resource": "literal:directory",
                                "name": "already.zip",
                                "files": {
                                    "demo.php": "<?php"
                                }
                            }
                        },
                        "options": { "activate": false }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Content {
                        source: FileContentSource::ZipWrappedDirectory {
                            name: "already.zip".to_string(),
                            files: BTreeMap::from([(
                                "demo.php".to_string(),
                                FileTreeEntry::File(b"<?php".to_vec()),
                            )]),
                        },
                        filename: "already.zip".to_string(),
                    },
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: false,
                }
            }]
        );
    }

    #[test]
    fn parses_update_user_meta_and_reset_data_steps() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "updateUserMeta",
                        "userId": 1,
                        "meta": {
                            "first_name": "Ada",
                            "native_flag": true
                        }
                    },
                    { "step": "resetData" }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::UpdateUserMeta {
                    user_id: 1,
                    meta_json: r#"{"first_name":"Ada","native_flag":true}"#.to_string()
                },
                StartupStep::ResetData,
            ]
        );
    }

    #[test]
    fn parses_define_wp_config_consts_steps() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "defineWpConfigConsts",
                        "consts": {
                            "WP_DEBUG": true,
                            "BLOG_ID_CURRENT_SITE": 1,
                            "WP_ENVIRONMENT_TYPE": "local"
                        }
                    },
                    {
                        "step": "defineWpConfigConsts",
                        "method": "rewrite-wp-config",
                        "consts": {
                            "DISALLOW_FILE_EDIT": false
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::DefineWpConfigConsts {
                    constants: vec![
                        (
                            "BLOG_ID_CURRENT_SITE".to_string(),
                            PhpConstantValue::number("1")
                        ),
                        ("WP_DEBUG".to_string(), PhpConstantValue::bool(true)),
                        (
                            "WP_ENVIRONMENT_TYPE".to_string(),
                            PhpConstantValue::string("local"),
                        ),
                    ],
                    method: DefineWpConfigMethod::DefineBeforeRun,
                },
                StartupStep::DefineWpConfigConsts {
                    constants: vec![(
                        "DISALLOW_FILE_EDIT".to_string(),
                        PhpConstantValue::bool(false),
                    )],
                    method: DefineWpConfigMethod::RewriteWpConfig,
                },
            ]
        );

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "defineWpConfigConsts",
                        "consts": { "BAD": ["array"] }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("must be a string, boolean, or number"));

        let script = define_wp_config_consts_script(&[(
            "WP_DEBUG".to_string(),
            PhpConstantValue::bool(true),
        )])
        .unwrap();
        assert!(script.starts_with("<?php\n"));
        assert!(!script.contains("<?php\n<?php"));
        assert!(script.contains("WP_Config_Transformer::from_file"));
    }

    #[test]
    fn parses_define_site_url_step() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "defineSiteUrl",
                        "siteUrl": "https://native.example"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::DefineWpConfigConsts {
                constants: vec![
                    (
                        "WP_HOME".to_string(),
                        PhpConstantValue::string("https://native.example"),
                    ),
                    (
                        "WP_SITEURL".to_string(),
                        PhpConstantValue::string("https://native.example"),
                    ),
                ],
                method: DefineWpConfigMethod::DefineBeforeRun,
            }]
        );

        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "defineSiteUrl",
                        "siteUrl": ""
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(error.to_string().contains("siteUrl cannot be empty"));
    }

    #[test]
    fn rejects_update_user_meta_without_numeric_user_id() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "updateUserMeta",
                        "userId": "1",
                        "meta": { "first_name": "Ada" }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();

        assert!(error.to_string().contains("numeric userId"));
    }

    #[test]
    fn rejects_unzip_without_zip_source() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "unzip", "extractToPath": "/wordpress" }
                ]
            }"#,
            false,
        )
        .unwrap_err();

        assert!(error.to_string().contains("zipFile or zipPath"));
    }

    #[test]
    fn parses_write_files_git_directory_and_rejects_escaping_trees() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "writeFiles",
                        "writeToPath": "/wordpress/wp-content/plugins/demo",
                        "filesTree": {
                            "resource": "git:directory",
                            "url": "https://github.com/example/repo",
                            "ref": "trunk",
                            "path": "plugins/demo"
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();
        assert_eq!(
            steps,
            vec![StartupStep::WriteFiles {
                write_to_path: "/wordpress/wp-content/plugins/demo".to_string(),
                files: FileTreeSource::Git(GitDirectoryResource {
                    url: "https://github.com/example/repo".to_string(),
                    ref_name: "trunk".to_string(),
                    ref_type: None,
                    path: "plugins/demo".to_string(),
                    include_git: false,
                }),
            }]
        );

        let git_metadata_steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "writeFiles",
                        "writeToPath": "/wordpress/wp-content/plugins/demo",
                        "filesTree": {
                            "resource": "git:directory",
                            "url": "https://github.com/example/repo",
                            "ref": "trunk",
                            ".git": true
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();
        assert_eq!(
            git_metadata_steps,
            vec![StartupStep::WriteFiles {
                write_to_path: "/wordpress/wp-content/plugins/demo".to_string(),
                files: FileTreeSource::Git(GitDirectoryResource {
                    url: "https://github.com/example/repo".to_string(),
                    ref_name: "trunk".to_string(),
                    ref_type: None,
                    path: String::new(),
                    include_git: true,
                }),
            }]
        );

        let escape_error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "writeFiles",
                        "writeToPath": "/wordpress/wp-content/plugins/demo",
                        "filesTree": {
                            "resource": "literal:directory",
                            "name": "demo",
                            "files": {
                                "../escape.php": "<?php"
                            }
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();
        assert!(escape_error
            .to_string()
            .contains("cannot escape writeToPath"));
    }

    #[test]
    fn parses_run_sql_file_resources() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "runSql",
                        "sql": {
                            "resource": "literal",
                            "name": "schema.sql",
                            "contents": "UPDATE wp_options SET option_value = 'Native' WHERE option_name = 'blogname';"
                        }
                    },
                    {
                        "step": "runSql",
                        "sql": { "resource": "vfs", "path": "tmp/schema.sql" }
                    },
                    {
                        "step": "runSql",
                        "sql": { "resource": "url", "url": "https://example.com/schema.sql" }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::RunSql {
                    sql: FileContentSource::Bytes(
                        b"UPDATE wp_options SET option_value = 'Native' WHERE option_name = 'blogname';"
                            .to_vec()
                    )
                },
                StartupStep::RunSql {
                    sql: FileContentSource::VfsPath("/tmp/schema.sql".to_string())
                },
                StartupStep::RunSql {
                    sql: FileContentSource::Url("https://example.com/schema.sql".to_string())
                },
            ]
        );
    }

    #[test]
    fn rejects_run_sql_string_sql() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    { "step": "runSql", "sql": "SELECT 1;" }
                ]
            }"#,
            false,
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("runSql sql must be a file resource object"));
    }

    #[test]
    fn run_sql_script_loads_wordpress_and_streams_queries() {
        let script = run_sql_script("/tmp/schema.sql", "/tmp/stream.php");

        assert!(script.contains("define('WP_SQLITE_AST_DRIVER', true);"));
        assert!(script.contains("require_once '/wordpress/wp-load.php';"));
        assert!(script.contains("require_once '/tmp/stream.php';"));
        assert!(script.contains("fopen('/tmp/schema.sql', 'r');"));
        assert!(script.contains("$stream->next_query()"));
        assert!(script.contains("$wpdb->query($query);"));
    }

    #[test]
    fn update_user_meta_script_loads_wordpress_and_updates_each_meta_value() {
        let script = update_user_meta_script(7, r#"{"first_name":"Ada"}"#);

        assert!(script.contains("require_once '/wordpress/wp-load.php';"));
        assert!(script.contains("json_decode('{\"first_name\":\"Ada\"}', true);"));
        assert!(script.contains("update_user_meta(7, $name, $value);"));
    }

    #[test]
    fn reset_data_script_uses_sqlite_pdo_and_resets_core_tables() {
        let script = reset_data_script();

        assert!(script.contains("$GLOBALS['@pdo']"));
        assert!(script.contains("DELETE FROM wp_posts WHERE id > 0"));
        assert!(script.contains("DELETE FROM wp_comments"));
        assert!(script.contains("DELETE FROM wp_commentmeta"));
    }

    #[test]
    #[ignore = "Full PHP wasm startup execution is an explicit smoke test."]
    fn real_run_php_with_options_startup_step_observes_request_state() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-run-php-with-options");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![Mount::new(&tmp_root, "/tmp").unwrap()];
        let host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();

        run_startup_step(
            &mounts,
            &mut php,
            9460,
            0,
            &StartupStep::RunPhpWithOptions {
                options: PhpRunOptions {
                    script: PhpRunScript::Code(
                        r#"<?php
file_put_contents('/tmp/observed.json', json_encode([
    'input' => file_get_contents('php://input'),
    'env' => getenv('NATIVE_ENV'),
    'custom_server' => $_SERVER['CUSTOM_SERVER'] ?? '',
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? '',
    'cookie' => $_SERVER['HTTP_COOKIE'] ?? '',
    'header' => $_SERVER['HTTP_X_NATIVE'] ?? '',
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'uri' => $_SERVER['REQUEST_URI'] ?? '',
]));
"#
                        .to_string(),
                    ),
                    relative_uri: "/native-run?x=1".to_string(),
                    protocol: "http".to_string(),
                    method: "POST".to_string(),
                    headers: vec![
                        ("host".to_string(), "example.test:9460".to_string()),
                        ("content-type".to_string(), "text/plain".to_string()),
                        ("cookie".to_string(), "native=1".to_string()),
                        ("x-native".to_string(), "yes".to_string()),
                    ],
                    body: b"payload".to_vec(),
                    env: vec![("NATIVE_ENV".to_string(), "present".to_string())],
                    server_entries: vec![("CUSTOM_SERVER".to_string(), "set".to_string())],
                },
            },
        )
        .unwrap();

        let observed: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(tmp_root.join("observed.json")).unwrap())
                .unwrap();
        assert_eq!(observed["input"], "payload");
        assert_eq!(observed["env"], "present");
        assert_eq!(observed["custom_server"], "set");
        assert_eq!(observed["content_type"], "text/plain");
        assert_eq!(observed["cookie"], "native=1");
        assert_eq!(observed["header"], "yes");
        assert_eq!(observed["method"], "POST");
        assert_eq!(observed["uri"], "/native-run?x=1");

        fs::write(
            tmp_root.join("script-path.php"),
            "<?php file_put_contents('/tmp/script-path.txt', 'script:' . ($_SERVER['REQUEST_URI'] ?? ''));",
        )
        .unwrap();
        run_startup_step(
            &mounts,
            &mut php,
            9460,
            1,
            &StartupStep::RunPhpWithOptions {
                options: PhpRunOptions {
                    script: PhpRunScript::ScriptPath("/tmp/script-path.php".to_string()),
                    relative_uri: "/script-path.php?mode=mounted".to_string(),
                    protocol: "http".to_string(),
                    method: "GET".to_string(),
                    headers: Vec::new(),
                    body: Vec::new(),
                    env: Vec::new(),
                    server_entries: Vec::new(),
                },
            },
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(tmp_root.join("script-path.txt")).unwrap(),
            "script:/script-path.php?mode=mounted"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    #[ignore = "Full PHP wasm startup execution is an explicit smoke test."]
    fn real_request_startup_step_dispatches_php_and_checks_status() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-request-step");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        fs::write(
            wordpress_root.join("capture.php"),
            r#"<?php
file_put_contents('/tmp/request-observed.json', json_encode([
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'query' => $_SERVER['QUERY_STRING'] ?? '',
    'input' => file_get_contents('php://input'),
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? '',
    'header' => $_SERVER['HTTP_X_NATIVE'] ?? '',
]));
echo "ok";
"#,
        )
        .unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();

        run_startup_step(
            &mounts,
            &mut php,
            9461,
            0,
            &StartupStep::Request {
                request: StartupHttpRequest {
                    method: "POST".to_string(),
                    target: "/capture.php?x=1".to_string(),
                    headers: vec![
                        ("content-type".to_string(), "text/plain".to_string()),
                        ("x-native".to_string(), "yes".to_string()),
                    ],
                    body: b"payload".to_vec(),
                },
            },
        )
        .unwrap();

        let observed: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(tmp_root.join("request-observed.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(observed["method"], "POST");
        assert_eq!(observed["query"], "x=1");
        assert_eq!(observed["input"], "payload");
        assert_eq!(observed["content_type"], "text/plain");
        assert_eq!(observed["header"], "yes");

        let error = run_startup_step(
            &mounts,
            &mut php,
            9461,
            1,
            &StartupStep::Request {
                request: StartupHttpRequest {
                    method: "GET".to_string(),
                    target: "/missing.php".to_string(),
                    headers: Vec::new(),
                    body: Vec::new(),
                },
            },
        )
        .unwrap_err();
        assert!(error.to_string().contains("failed with status 404"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm startup execution is an explicit smoke test."]
    fn real_run_wp_installation_wizard_startup_step_installs_wordpress() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-wp-installation-wizard");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9462;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        run_startup_step(
            &mounts,
            &mut php,
            port,
            0,
            &StartupStep::RunWpInstallationWizard {
                admin_password: Some("secret".to_string()),
            },
        )
        .unwrap();

        assert!(wordpress_root
            .join("wp-content/database/.ht.sqlite")
            .is_file());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm WXR import execution is an explicit smoke test."]
    fn real_import_wxr_startup_step_imports_fixture_post() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let repo_root = repo_root_from_manifest_dir();
        let importer_zip =
            repo_root.join("packages/playground/website/public/wordpress-importer.zip");
        let wxr_path = repo_root
            .join("packages/playground/blueprints/src/tests/fixtures/import-wxr-slash-issue.xml");
        let root = temp_dir("real-import-wxr-step");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9468;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options.clone())
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();
        run_startup_steps(
            &[
                StartupStep::InstallPlugin {
                    asset: InstallAssetStep {
                        source: InstallAssetSource::LocalFile {
                            path: importer_zip,
                            filename: "wordpress-importer.zip".to_string(),
                        },
                        target_folder_name: None,
                        if_already_installed: IfAlreadyInstalled::Overwrite,
                        activate: true,
                    },
                },
                StartupStep::ImportWxr {
                    file: FileContentSource::LocalFile(wxr_path),
                },
            ],
            &mounts,
            &mut php,
            port,
            &mut host_options,
        )
        .unwrap();

        let check_script_path = tmp_root.join("check-import-wxr.php");
        fs::write(
            &check_script_path,
            r#"<?php
require_once '/wordpress/wp-load.php';
global $wpdb;
echo $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_name = 'issue' AND post_type = 'post'");
"#,
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_import_wxr.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
            body: Vec::new(),
        };
        let php_request = php_request_from_http(&request, "/tmp/check-import-wxr.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        assert_eq!(body, "1", "stderr={stderr}");
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm site import execution is an explicit smoke test."]
    fn real_import_wordpress_files_startup_step_rewrites_scoped_urls() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-import-wordpress-files-step");
        let source_wordpress_root = root.join("source-wordpress");
        let source_tmp_root = root.join("source-tmp");
        let target_wordpress_root = root.join("target-wordpress");
        let target_tmp_root = root.join("target-tmp");
        fs::create_dir_all(&source_wordpress_root).unwrap();
        fs::create_dir_all(&source_tmp_root).unwrap();
        fs::create_dir_all(&target_wordpress_root).unwrap();
        fs::create_dir_all(&target_tmp_root).unwrap();
        let source_mounts = vec![
            Mount::new(&source_wordpress_root, "/wordpress").unwrap(),
            Mount::new(&source_tmp_root, "/tmp").unwrap(),
        ];
        let target_mounts = vec![
            Mount::new(&target_wordpress_root, "/wordpress").unwrap(),
            Mount::new(&target_tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &source_mounts).unwrap();
        prepare_wordpress(runtime.repo_root(), &options, &target_mounts).unwrap();

        let source_port = 9471;
        let target_port = 9472;
        let source_site_url = "http://playground-domain/scope:source-scope-123/".to_string();
        let target_site_url = "http://playground-domain/scope:target-scope-456/".to_string();

        let source_host_options = host_options_for_test_mounts(&source_mounts, &source_site_url);
        let mut source_php = runtime
            .instantiate_php_with_host_options(&options.php, source_host_options)
            .unwrap();
        boot_wordpress_site(&source_mounts, &mut source_php, source_port).unwrap();
        run_startup_step(
            &source_mounts,
            &mut source_php,
            source_port,
            0,
            &StartupStep::RunPhp {
                code: format!(
                    r#"<?php
require '/wordpress/wp-load.php';
global $wpdb;
$wpdb->update($wpdb->options, array('option_value' => {source_url}), array('option_name' => 'siteurl'));
$wpdb->update($wpdb->options, array('option_value' => {source_url}), array('option_name' => 'home'));
$post_id = wp_insert_post(array(
    'post_title'   => 'Imported scoped post',
    'post_content' => '<img src="{source_no_slash}/wp-content/uploads/2024/01/test-image.png">',
    'post_status'  => 'publish',
));
update_post_meta($post_id, '_custom_image_url', '{source_no_slash}/wp-content/uploads/2024/01/featured.jpg');
update_option('custom_logo_url', '{source_no_slash}/wp-content/uploads/logo.png');
"#,
                    source_url = php_single_quoted_string(&source_site_url),
                    source_no_slash = source_site_url.trim_end_matches('/'),
                ),
            },
        )
        .unwrap();
        let export_zip = zip_wp_content_export(&source_wordpress_root, &source_site_url);

        let mut target_host_options =
            host_options_for_test_mounts(&target_mounts, &target_site_url);
        let mut target_php = runtime
            .instantiate_php_with_host_options(&options.php, target_host_options.clone())
            .unwrap();
        boot_wordpress_site(&target_mounts, &mut target_php, target_port).unwrap();
        run_startup_steps(
            &[StartupStep::ImportWordPressFiles {
                zip: FileContentSource::Bytes(export_zip),
                path_in_zip: String::new(),
            }],
            &target_mounts,
            &mut target_php,
            target_port,
            &mut target_host_options,
        )
        .unwrap();

        let check_script_path = target_tmp_root.join("check-import-wordpress-files.php");
        fs::write(
            &check_script_path,
            r#"<?php
require_once '/wordpress/wp-load.php';
$posts = get_posts(array(
    'post_status' => 'publish',
    'numberposts' => 1,
    'orderby' => 'ID',
    'order' => 'DESC',
));
$post = $posts[0];
echo json_encode(array(
    'content' => $post->post_content,
    'meta' => get_post_meta($post->ID, '_custom_image_url', true),
    'option' => get_option('custom_logo_url'),
));
"#,
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_import_wordpress_files.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{target_port}"))],
            body: Vec::new(),
        };
        let php_request = php_request_from_http(
            &request,
            "/tmp/check-import-wordpress-files.php",
            None,
            target_port,
        );
        let response = target_php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        for field in ["content", "meta", "option"] {
            let value = json[field].as_str().unwrap();
            assert!(value.contains("scope:target-scope-456"), "{field}: {value}");
            assert!(
                !value.contains("scope:source-scope-123"),
                "{field}: {value}"
            );
        }
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm translation execution is an explicit smoke test."]
    fn real_set_site_language_startup_step_downloads_translations() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-set-site-language-step");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.6".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9469;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options.clone())
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();
        run_startup_steps(
            &[StartupStep::SetSiteLanguage {
                language: "es_ES".to_string(),
            }],
            &mounts,
            &mut php,
            port,
            &mut host_options,
        )
        .unwrap();

        assert!(host_options
            .string_constants
            .contains(&("WPLANG".to_string(), PhpConstantValue::string("es_ES"))));
        assert!(wordpress_root
            .join("wp-content/languages/es_ES.mo")
            .is_file());

        let check_script_path = tmp_root.join("check-site-language.php");
        fs::write(
            &check_script_path,
            "<?php require_once '/wordpress/wp-load.php'; echo get_option('WPLANG');",
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_site_language.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
            body: Vec::new(),
        };
        let php_request =
            php_request_from_http(&request, "/tmp/check-site-language.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        assert_eq!(body, "es_ES", "stderr={stderr}");
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm theme starter-content execution is an explicit smoke test."]
    fn real_install_theme_startup_step_imports_starter_content() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-theme-starter-content-step");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9470;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();

        let mut theme_zip = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut theme_zip);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            zip.start_file("test-theme/style.css", options).unwrap();
            zip.write_all(
                b"/*
Theme Name: Test Theme
Theme URI: https://example.com/test-theme
Author: Test Author
*/",
            )
            .unwrap();
            zip.start_file("test-theme/index.php", options).unwrap();
            zip.write_all(b"").unwrap();
            zip.start_file("test-theme/functions.php", options).unwrap();
            zip.write_all(
                br#"<?php
function testtheme_theme_support() {
    add_theme_support( 'starter-content', array(
        'posts' => array(
            'front' => array(
                'post_type'    => 'page',
                'post_title'   => 'Static front',
                'post_content' => 'Static front page content',
            ),
            'blog',
        ),
        'options' => array(
            'show_on_front'  => 'page',
            'page_on_front'  => '{{front}}',
            'page_for_posts' => '{{blog}}',
        ),
    ) );
}
add_action( 'after_setup_theme', 'testtheme_theme_support' );
"#,
            )
            .unwrap();
            zip.finish().unwrap();
        }

        run_startup_step(
            &mounts,
            &mut php,
            port,
            0,
            &StartupStep::InstallTheme {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Content {
                        source: FileContentSource::Bytes(theme_zip.into_inner()),
                        filename: "test-theme.zip".to_string(),
                    },
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: false,
                },
                import_starter_content: true,
            },
        )
        .unwrap();

        let check_script_path = tmp_root.join("check-theme-starter-content.php");
        fs::write(
            &check_script_path,
            r#"<?php
require_once '/wordpress/wp-load.php';
$front = get_post(get_option('page_on_front'));
echo json_encode(array(
    'show_on_front' => get_option('show_on_front'),
    'front_title'   => $front ? $front->post_title : '',
));
"#,
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_theme_starter_content.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
            body: Vec::new(),
        };
        let php_request =
            php_request_from_http(&request, "/tmp/check-theme-starter-content.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["show_on_front"], "page");
        assert_eq!(json["front_title"], "Static front");
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm WP-CLI execution is an explicit smoke test."]
    fn real_wp_cli_startup_step_updates_wordpress_option() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let repo_root = repo_root_from_manifest_dir();
        let fixtures = repo_root.join("packages/playground/cli/tests/fixtures");
        let root = temp_dir("real-wp-cli-step");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
            Mount::new(&fixtures, "/tools").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9463;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();
        run_startup_step(
            &mounts,
            &mut php,
            port,
            0,
            &StartupStep::WpCli {
                wp_cli_path: "/tools/wp-cli.phar".to_string(),
                args: vec![
                    "option".to_string(),
                    "update".to_string(),
                    "blogname".to_string(),
                    "Native WP-CLI Blog".to_string(),
                ],
            },
        )
        .unwrap();

        let check_script_path = tmp_root.join("check-wp-cli-blogname.php");
        fs::write(
            &check_script_path,
            "<?php require_once '/wordpress/wp-load.php'; echo get_option('blogname');",
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_wp_cli_blogname.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
            body: Vec::new(),
        };
        let php_request =
            php_request_from_http(&request, "/tmp/check-wp-cli-blogname.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        assert_eq!(body, "Native WP-CLI Blog", "stderr={stderr}");
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm multisite execution is an explicit smoke test."]
    fn real_enable_multisite_startup_step_converts_wordpress() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let repo_root = repo_root_from_manifest_dir();
        let fixtures = repo_root.join("packages/playground/cli/tests/fixtures");
        let root = temp_dir("real-enable-multisite-step");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
            Mount::new(&fixtures, "/tools").unwrap(),
        ];
        let options = parse_cli_args_from(
            vec![
                "server".to_string(),
                "--wp=6.9".to_string(),
                "--site-url=http://playground-domain/scope:987987/".to_string(),
            ],
            &root,
        )
        .unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9467;
        let site_url = "http://playground-domain/scope:987987/".to_string();
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options.clone())
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();
        run_startup_steps(
            &[StartupStep::EnableMultisite {
                wp_cli_path: "/tools/wp-cli.phar".to_string(),
            }],
            &mounts,
            &mut php,
            port,
            &mut host_options,
        )
        .unwrap();

        let wp_config = fs::read_to_string(wordpress_root.join("wp-config.php")).unwrap();
        assert!(wp_config.contains("define( 'MULTISITE', true );"));
        assert!(wp_config.contains("define( 'SUBDOMAIN_INSTALL', false );"));
        assert!(wp_config.contains("$_SERVER['HTTP_HOST'] = 'playground-domain';"));

        let check_script_path = tmp_root.join("check-enable-multisite.php");
        fs::write(
            &check_script_path,
            "<?php require_once '/wordpress/wp-load.php'; echo is_multisite() ? 'multisite' : 'single';",
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/scope:987987/__wp_playground_native_check_enable_multisite.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), "playground-domain".to_string())],
            body: Vec::new(),
        };
        let php_request =
            php_request_from_http(&request, "/tmp/check-enable-multisite.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        assert_eq!(body, "multisite", "stderr={stderr}");
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm startup execution is an explicit smoke test."]
    fn real_run_sql_startup_step_updates_wordpress_option() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-run-sql");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9457;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();
        run_startup_step(
            &mounts,
            &mut php,
            port,
            0,
            &StartupStep::RunSql {
                sql: FileContentSource::Bytes(
                    b"UPDATE wp_options SET option_value = 'Native SQL Blog' WHERE option_name = 'blogname';"
                        .to_vec(),
                ),
            },
        )
        .unwrap();

        let check_script_path = tmp_root.join("check-blogname.php");
        fs::write(
            &check_script_path,
            "<?php require_once '/wordpress/wp-load.php'; echo get_option('blogname');",
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_blogname.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
            body: Vec::new(),
        };
        let php_request = php_request_from_http(&request, "/tmp/check-blogname.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        assert_eq!(body, "Native SQL Blog", "stderr={stderr}");
    }

    #[test]
    #[ignore = "Full WordPress + PHP wasm startup execution is an explicit smoke test."]
    fn real_update_user_meta_startup_step_updates_admin_user() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let root = temp_dir("real-update-user-meta");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let options =
            parse_cli_args_from(vec!["server".to_string(), "--wp=6.9".to_string()], &root).unwrap();

        prepare_wordpress(runtime.repo_root(), &options, &mounts).unwrap();

        let port = 9458;
        let site_url = format!("http://127.0.0.1:{port}");
        let mut host_options = HostOptions {
            echo_output: false,
            mounts: mounts
                .iter()
                .map(|mount| HostMount {
                    host_path: mount.host_path.clone(),
                    vfs_path: mount.vfs_path.clone(),
                })
                .collect(),
            ..HostOptions::default()
        };
        host_options.string_constants.push((
            "WP_HOME".to_string(),
            PhpConstantValue::string(site_url.clone()),
        ));
        host_options
            .string_constants
            .push(("WP_SITEURL".to_string(), PhpConstantValue::string(site_url)));
        let mut php = runtime
            .instantiate_php_with_host_options(&options.php, host_options)
            .unwrap();

        boot_wordpress_site(&mounts, &mut php, port).unwrap();
        run_startup_step(
            &mounts,
            &mut php,
            port,
            0,
            &StartupStep::UpdateUserMeta {
                user_id: 1,
                meta_json: r#"{"first_name":"Ada","native_flag":"yes"}"#.to_string(),
            },
        )
        .unwrap();

        let check_script_path = tmp_root.join("check-user-meta.php");
        fs::write(
            &check_script_path,
            "<?php require_once '/wordpress/wp-load.php'; echo get_user_meta(1, 'first_name', true) . ':' . get_user_meta(1, 'native_flag', true);",
        )
        .unwrap();
        let request = HttpRequest {
            method: "GET".to_string(),
            target: "/__wp_playground_native_check_user_meta.php".to_string(),
            version: "HTTP/1.1".to_string(),
            headers: vec![("host".to_string(), format!("127.0.0.1:{port}"))],
            body: Vec::new(),
        };
        let php_request = php_request_from_http(&request, "/tmp/check-user-meta.php", None, port);
        let response = php.run_sapi_request(&php_request).unwrap();
        let body = String::from_utf8_lossy(&response.stdout);
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(root);

        assert_eq!(response.exit_code, 0, "stderr={stderr}");
        assert_eq!(body, "Ada:yes", "stderr={stderr}");
    }

    #[test]
    fn parses_blueprint_login_requests() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "login": { "username": "editor", "password": "ignored" },
                "steps": [
                    { "step": "login", "username": "admin" }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![
                StartupStep::Login {
                    username: "editor".to_string()
                },
                StartupStep::Login {
                    username: "admin".to_string()
                },
            ]
        );

        let steps = startup_steps_from_blueprint_json(r#"{ "login": false }"#, false).unwrap();
        assert_eq!(steps, vec![StartupStep::DisableLogin]);
    }

    #[test]
    fn resolves_auto_login_username_from_blueprint_or_cli_default() {
        let cwd = temp_dir("login-username");
        let start = parse_cli_args_from(vec!["start".to_string()], &cwd).unwrap();
        let server = parse_cli_args_from(vec!["server".to_string()], &cwd).unwrap();
        let steps = vec![StartupStep::Login {
            username: "editor".to_string(),
        }];

        assert_eq!(auto_login_username(&server, &[]), None);
        assert_eq!(auto_login_username(&start, &[]), Some("admin".to_string()));
        assert_eq!(
            auto_login_username(&start, &[StartupStep::DisableLogin]),
            None
        );
        assert_eq!(
            auto_login_username(&start, &steps),
            Some("editor".to_string())
        );
        assert_eq!(
            auto_login_username(
                &start,
                &[
                    StartupStep::DisableLogin,
                    StartupStep::Login {
                        username: "author".to_string()
                    }
                ]
            ),
            Some("author".to_string())
        );
        let _ = fs::remove_dir_all(cwd);
    }

    #[test]
    fn parses_install_plugin_wordpress_org_resource() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "wordpress.org/plugins",
                            "slug": "gutenberg"
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Download(DownloadableAsset {
                        url: "https://downloads.wordpress.org/plugin/gutenberg.latest-stable.zip"
                            .to_string(),
                        filename: "gutenberg.latest-stable.zip".to_string(),
                        cache_key: "blueprint-plugin-gutenberg.latest-stable.zip".to_string(),
                    }),
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: true,
                }
            }]
        );
    }

    #[test]
    fn parses_install_plugin_git_directory_resource() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "git:directory",
                            "url": "https://github.com/example/repo.git",
                            "ref": "trunk",
                            "refType": "branch",
                            "path": "/wp-content/plugins/demo"
                        },
                        "options": {
                            "targetFolderName": "demo",
                            "activate": false
                        },
                        "ifAlreadyInstalled": "skip"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();
        let resource = GitDirectoryResource {
            url: "https://github.com/example/repo.git".to_string(),
            ref_name: "trunk".to_string(),
            ref_type: Some("branch".to_string()),
            path: "wp-content/plugins/demo".to_string(),
            include_git: false,
        };

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Content {
                        filename: format!("{}.zip", resource.filename()),
                        source: FileContentSource::ZipWrappedGitDirectory(resource),
                    },
                    target_folder_name: Some("demo".to_string()),
                    if_already_installed: IfAlreadyInstalled::Skip,
                    activate: false,
                }
            }]
        );
    }

    #[test]
    fn parses_install_plugin_literal_php_file_resource() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "literal",
                            "name": "single-file.php",
                            "contents": "<?php\n/* Plugin Name: Single File */\n"
                        },
                        "options": { "activate": false }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Content {
                        source: FileContentSource::Bytes(
                            b"<?php\n/* Plugin Name: Single File */\n".to_vec()
                        ),
                        filename: "single-file.php".to_string(),
                    },
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: false,
                }
            }]
        );
    }

    #[test]
    fn parses_install_theme_url_resource_options() {
        let url = "https://example.com/releases/demo-theme.zip?download=1";
        let steps = startup_steps_from_blueprint_json(
            &format!(
                r#"{{
                    "steps": [
                        {{
                            "step": "installTheme",
                            "themeData": {{ "resource": "url", "url": "{url}" }},
                            "ifAlreadyInstalled": "skip",
                            "options": {{
                                "activate": false,
                                "targetFolderName": "custom-theme",
                                "importStarterContent": false
                            }}
                        }}
                    ]
                }}"#
            ),
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallTheme {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Download(DownloadableAsset {
                        url: url.to_string(),
                        filename: "demo-theme.zip".to_string(),
                        cache_key: url_cache_key("blueprint-theme", url, ".zip"),
                    }),
                    target_folder_name: Some("custom-theme".to_string()),
                    if_already_installed: IfAlreadyInstalled::Skip,
                    activate: false,
                },
                import_starter_content: false,
            }]
        );
    }

    #[test]
    fn deprecated_install_asset_fields_win_when_present() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "wordpress.org/plugins",
                            "slug": "new-plugin"
                        },
                        "pluginZipFile": {
                            "resource": "wordpress.org/plugins",
                            "slug": "legacy-plugin.zip"
                        }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::Download(DownloadableAsset {
                        url: "https://downloads.wordpress.org/plugin/legacy-plugin.zip".to_string(),
                        filename: "legacy-plugin.zip".to_string(),
                        cache_key: "blueprint-plugin-legacy-plugin.zip".to_string(),
                    }),
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: true,
                }
            }]
        );
    }

    #[test]
    fn local_blueprint_bundled_asset_requires_consent_and_resolves_adjacent_file() {
        let root = temp_dir("blueprint-bundled-local");
        let assets_dir = root.join("assets");
        fs::create_dir_all(&assets_dir).unwrap();
        let zip_path = assets_dir.join("demo-plugin.zip");
        fs::write(
            &zip_path,
            blueprint_zip(vec![(
                "demo-plugin/demo.php",
                "<?php\n/* Plugin Name: Demo Plugin */\n",
            )]),
        )
        .unwrap();
        let blueprint_path = root.join("blueprint.json");
        fs::write(
            &blueprint_path,
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": {
                            "resource": "bundled",
                            "path": "/assets/demo-plugin.zip"
                        },
                        "options": { "activate": false }
                    }
                ]
            }"#,
        )
        .unwrap();

        let error = startup_steps_from_blueprint_source(&blueprint_path.to_string_lossy(), false)
            .unwrap_err();
        assert!(error
            .to_string()
            .contains("requires --blueprint-may-read-adjacent-files"));

        let steps =
            startup_steps_from_blueprint_source(&blueprint_path.to_string_lossy(), true).unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::LocalFile {
                        path: fs::canonicalize(&zip_path).unwrap(),
                        filename: "demo-plugin.zip".to_string(),
                    },
                    target_folder_name: None,
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: false,
                }
            }]
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn local_blueprint_bundled_write_file_resolves_adjacent_file() {
        let root = temp_dir("blueprint-bundled-write-file");
        let assets_dir = root.join("assets");
        fs::create_dir_all(&assets_dir).unwrap();
        let asset_path = assets_dir.join("message.txt");
        fs::write(&asset_path, b"bundled text").unwrap();
        let blueprint_path = root.join("blueprint.json");
        fs::write(
            &blueprint_path,
            r#"{
                "steps": [
                    {
                        "step": "writeFile",
                        "path": "/wordpress/from-bundle.txt",
                        "data": {
                            "resource": "bundled",
                            "path": "assets/message.txt"
                        }
                    }
                ]
            }"#,
        )
        .unwrap();

        let error = startup_steps_from_blueprint_source(&blueprint_path.to_string_lossy(), false)
            .unwrap_err();
        assert!(error
            .to_string()
            .contains("requires --blueprint-may-read-adjacent-files"));

        let steps =
            startup_steps_from_blueprint_source(&blueprint_path.to_string_lossy(), true).unwrap();
        assert_eq!(
            steps,
            vec![StartupStep::WriteFile {
                path: "/wordpress/from-bundle.txt".to_string(),
                data: FileContentSource::LocalFile(fs::canonicalize(&asset_path).unwrap())
            }]
        );

        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];
        assert!(run_native_startup_step(&mounts, &steps[0]).unwrap());
        assert_eq!(
            fs::read_to_string(wordpress_root.join("from-bundle.txt")).unwrap(),
            "bundled text"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn local_blueprint_bundled_run_sql_resolves_adjacent_file() {
        let root = temp_dir("blueprint-bundled-run-sql");
        let sql_dir = root.join("sql");
        fs::create_dir_all(&sql_dir).unwrap();
        let sql_path = sql_dir.join("schema.sql");
        fs::write(&sql_path, "SELECT 1;").unwrap();
        let blueprint_path = root.join("blueprint.json");
        fs::write(
            &blueprint_path,
            r#"{
                "steps": [
                    {
                        "step": "runSql",
                        "sql": {
                            "resource": "bundled",
                            "path": "sql/schema.sql"
                        }
                    }
                ]
            }"#,
        )
        .unwrap();

        let steps =
            startup_steps_from_blueprint_source(&blueprint_path.to_string_lossy(), true).unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::RunSql {
                sql: FileContentSource::LocalFile(fs::canonicalize(&sql_path).unwrap())
            }]
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn blueprint_zip_bundled_write_file_resolves_file_bytes() {
        let bundle = blueprint_zip_bytes(vec![
            (
                "blueprint.json",
                br#"{
                    "steps": [
                        {
                            "step": "writeFile",
                            "path": "/wordpress/from-zip.txt",
                            "data": {
                                "resource": "bundled",
                                "path": "files/message.txt"
                            }
                        }
                    ]
                }"#,
            ),
            ("files/message.txt", b"zip bundled text"),
        ]);

        let steps = startup_steps_from_blueprint_zip(&bundle, false).unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::WriteFile {
                path: "/wordpress/from-zip.txt".to_string(),
                data: FileContentSource::BundledFile(b"zip bundled text".to_vec())
            }]
        );
    }

    #[test]
    fn blueprint_zip_bundled_plugin_asset_can_be_installed() {
        let plugin_zip = blueprint_zip(vec![(
            "demo-plugin/demo.php",
            "<?php\n/* Plugin Name: Demo Plugin */\n",
        )]);
        let bundle = blueprint_zip_bytes(vec![
            (
                "blueprint.json",
                br#"{
                    "steps": [
                        {
                            "step": "installPlugin",
                            "pluginZipFile": {
                                "resource": "bundled",
                                "path": "assets/demo-plugin.zip"
                            },
                            "ifAlreadyInstalled": "overwrite",
                            "options": {
                                "activate": false,
                                "targetFolderName": "installed-demo"
                            }
                        }
                    ]
                }"#,
            ),
            ("assets/demo-plugin.zip", &plugin_zip),
        ]);

        let steps = startup_steps_from_blueprint_zip(&bundle, false).unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::InstallPlugin {
                asset: InstallAssetStep {
                    source: InstallAssetSource::BundledFile {
                        bytes: plugin_zip,
                        filename: "demo-plugin.zip".to_string(),
                    },
                    target_folder_name: Some("installed-demo".to_string()),
                    if_already_installed: IfAlreadyInstalled::Overwrite,
                    activate: false,
                }
            }]
        );

        let target = temp_dir("blueprint-bundled-install");
        let wordpress_root = target.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];
        let StartupStep::InstallPlugin { asset } = &steps[0] else {
            panic!("expected installPlugin step");
        };
        let folder =
            install_downloadable_asset(&mounts, asset, "/wordpress/wp-content/plugins", "plugin")
                .unwrap();

        assert_eq!(folder, "installed-demo");
        assert!(wordpress_root
            .join("wp-content/plugins/installed-demo/demo.php")
            .is_file());
        assert!(!wordpress_root
            .join("wp-content/plugins/.wp-playground-native-bundled.zip")
            .exists());

        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn rejects_unsupported_install_asset_resource() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installPlugin",
                        "pluginData": { "resource": "literal", "name": "demo" }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("literal file resources must use a .php filename"));
    }

    #[test]
    fn parses_theme_starter_content_import_option() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installTheme",
                        "themeData": {
                            "resource": "wordpress.org/themes",
                            "slug": "twentytwentyfour"
                        },
                        "options": { "importStarterContent": true }
                    }
                ]
            }"#,
            false,
        )
        .unwrap();

        let [StartupStep::InstallTheme {
            import_starter_content,
            ..
        }] = &steps[..]
        else {
            panic!("expected one installTheme step");
        };
        assert!(*import_starter_content);
    }

    #[test]
    fn rejects_invalid_theme_starter_content_import_option() {
        let error = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "installTheme",
                        "themeData": {
                            "resource": "wordpress.org/themes",
                            "slug": "twentytwentyfour"
                        },
                        "options": { "importStarterContent": "yes" }
                    }
                ]
            }"#,
            false,
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("installTheme options.importStarterContent must be a boolean"));
    }

    #[test]
    fn import_theme_starter_content_script_sets_customizer_request() {
        let script = import_theme_starter_content_script(r"theme'\demo");

        assert!(script.contains("playground_add_filter('plugins_loaded'"));
        assert!(script.contains("$_REQUEST['wp_customize']"));
        assert!(script.contains("$_REQUEST['customize_theme'] = 'theme\\'\\\\demo';"));
        assert!(script.contains("import_theme_starter_content()"));
    }

    #[test]
    fn derives_wordpress_org_zip_names_and_url_filenames() {
        assert_eq!(
            directory_zip_name("hello-dolly"),
            "hello-dolly.latest-stable.zip"
        );
        assert_eq!(directory_zip_name("hello-dolly.zip"), "hello-dolly.zip");
        assert_eq!(
            filename_from_url("https://example.com/releases/plugin.zip?download=1#asset"),
            "plugin.zip"
        );
        assert_eq!(
            filename_from_url("https://example.com/download/"),
            "download"
        );
        assert_eq!(
            asset_folder_name_from_zip_filename("plugin.latest-stable.zip"),
            "plugin.latest-stable"
        );
    }

    #[test]
    fn derives_git_archive_urls_and_normalizes_paths() {
        let github = GitDirectoryResource {
            url: "https://github.com/example/demo".to_string(),
            ref_name: "feature/demo".to_string(),
            ref_type: Some("branch".to_string()),
            path: "plugins/demo".to_string(),
            include_git: false,
        };
        assert_eq!(
            git_archive_download_url(&github).unwrap(),
            "https://github.com/example/demo/archive/refs/heads/feature/demo.zip"
        );
        assert_eq!(
            github.filename(),
            "https-github.com-example-demo-feature-demo-at-plugins-demo"
        );

        let gitlab = GitDirectoryResource {
            url: "https://gitlab.com/group/subgroup/demo".to_string(),
            ref_name: "release/v1".to_string(),
            ref_type: Some("tag".to_string()),
            path: String::new(),
            include_git: false,
        };
        assert_eq!(
            git_archive_download_url(&gitlab).unwrap(),
            "https://gitlab.com/group/subgroup/demo/-/archive/release%2Fv1/demo-release%2Fv1.zip"
        );
        let self_hosted = GitDirectoryResource {
            url: "https://git.example.com/group/demo".to_string(),
            ref_name: "main".to_string(),
            ref_type: Some("branch".to_string()),
            path: String::new(),
            include_git: false,
        };
        assert!(!git_archive_supported_host(&self_hosted).unwrap());

        assert_eq!(normalize_git_directory_path("/", "writeFiles").unwrap(), "");
        assert_eq!(
            normalize_git_directory_path("./plugins/demo", "writeFiles").unwrap(),
            "plugins/demo"
        );
        assert!(normalize_git_directory_path("../demo", "writeFiles")
            .unwrap_err()
            .to_string()
            .contains("cannot escape writeToPath"));
    }

    #[test]
    fn extracts_git_archive_subdirectory_to_file_tree() {
        let archive = blueprint_zip(vec![
            ("repo-main/plugins/demo/demo.php", "<?php echo 'demo';"),
            ("repo-main/plugins/demo/assets/style.css", "body{}"),
            ("repo-main/plugins/other/ignored.php", "<?php"),
            ("repo-main/readme.md", "root"),
        ]);

        let files = git_archive_bytes_to_file_tree(&archive, "plugins/demo").unwrap();

        assert_eq!(
            files.get("demo.php"),
            Some(&FileTreeEntry::File(b"<?php echo 'demo';".to_vec()))
        );
        assert_eq!(
            files.get("assets"),
            Some(&FileTreeEntry::Directory(BTreeMap::from([(
                "style.css".to_string(),
                FileTreeEntry::File(b"body{}".to_vec())
            )])))
        );
        assert!(!files.contains_key("readme.md"));
        assert!(git_archive_bytes_to_file_tree(&archive, "missing")
            .unwrap_err()
            .to_string()
            .contains("was not found"));
    }

    #[test]
    fn resolves_git_directory_with_dot_git_metadata_using_git_cli() {
        run_git(None, &["--version"], "check git availability").unwrap();
        let repo = temp_dir("git-source");
        run_git(Some(&repo), &["init"], "initialize source repository").unwrap();
        run_git(
            Some(&repo),
            &["checkout", "-b", "trunk"],
            "create source branch",
        )
        .unwrap();
        run_git(
            Some(&repo),
            &["config", "user.email", "native@example.com"],
            "configure source email",
        )
        .unwrap();
        run_git(
            Some(&repo),
            &["config", "user.name", "Native Test"],
            "configure source user",
        )
        .unwrap();
        fs::create_dir_all(repo.join("plugins/demo/assets")).unwrap();
        fs::write(repo.join("plugins/demo/demo.php"), "<?php echo 'demo';\n").unwrap();
        fs::write(repo.join("plugins/demo/assets/style.css"), "body{}\n").unwrap();
        fs::write(repo.join("ignored.txt"), "ignored\n").unwrap();
        run_git(Some(&repo), &["add", "."], "stage source files").unwrap();
        run_git(
            Some(&repo),
            &["commit", "-m", "Initial demo plugin"],
            "commit source files",
        )
        .unwrap();
        let commit = run_git(Some(&repo), &["rev-parse", "HEAD"], "read source commit")
            .unwrap()
            .trim()
            .to_string();
        let repo_url = file_url_for_path(&repo);
        let resource = GitDirectoryResource {
            url: repo_url.clone(),
            ref_name: "trunk".to_string(),
            ref_type: Some("branch".to_string()),
            path: "plugins/demo".to_string(),
            include_git: true,
        };

        let (_, files) = resolve_git_directory_resource(&resource).unwrap();

        assert_eq!(
            files.get("demo.php"),
            Some(&FileTreeEntry::File(b"<?php echo 'demo';\n".to_vec()))
        );
        assert!(matches!(
            files.get(".git"),
            Some(FileTreeEntry::Directory(_))
        ));
        assert!(!files.contains_key("ignored.txt"));

        let materialized = temp_dir("git-materialized");
        write_file_tree_for_test(&materialized, &files);
        assert!(materialized.join(".git/shallow").is_file());
        assert_eq!(
            run_git(
                Some(&materialized),
                &["rev-parse", "HEAD"],
                "read materialized HEAD"
            )
            .unwrap()
            .trim(),
            commit
        );
        assert_eq!(
            run_git(
                Some(&materialized),
                &["remote", "get-url", "origin"],
                "read materialized remote"
            )
            .unwrap()
            .trim(),
            repo_url
        );
        let mut tracked = run_git(
            Some(&materialized),
            &["ls-files"],
            "list materialized git files",
        )
        .unwrap()
        .lines()
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
        tracked.sort();
        assert_eq!(tracked, vec!["assets/style.css", "demo.php"]);
        run_git(
            Some(&materialized),
            &["add", "-A"],
            "normalize materialized git index",
        )
        .unwrap();
        fs::write(materialized.join("demo.php"), "<?php echo 'modified';\n").unwrap();
        let status = run_git(
            Some(&materialized),
            &["status", "--porcelain"],
            "read materialized git status",
        )
        .unwrap();
        assert!(status.contains("demo.php"));

        let _ = fs::remove_dir_all(repo);
        let _ = fs::remove_dir_all(materialized);
    }

    #[test]
    fn parses_local_blueprint_zip_with_root_json() {
        let zip = blueprint_zip(vec![(
            "blueprint.json",
            r#"{ "siteOptions": { "blogname": "Zip Blog" } }"#,
        )]);

        let steps = startup_steps_from_blueprint_zip(&zip, false).unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::SetSiteOptions {
                options_json: r#"{"blogname":"Zip Blog"}"#.to_string()
            }]
        );
        assert!(looks_like_zip_file(&zip));
    }

    #[test]
    fn parses_remote_blueprint_zip_with_single_top_level_directory() {
        let zip = blueprint_zip(vec![(
            "bundle/blueprint.json",
            r#"{ "steps": [ { "step": "runPHP", "code": "<?php echo 'zip';" } ] }"#,
        )]);

        let steps =
            startup_steps_from_remote_blueprint_bytes("https://example.com/bundle.zip", &zip)
                .unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::RunPhp {
                code: "<?php echo 'zip';".to_string()
            }]
        );
    }

    #[test]
    fn rejects_local_blueprint_zip_without_root_json() {
        let zip = blueprint_zip(vec![(
            "bundle/blueprint.json",
            r#"{ "siteOptions": { "blogname": "Zip Blog" } }"#,
        )]);

        let error = startup_steps_from_blueprint_zip(&zip, false).unwrap_err();

        assert!(error.to_string().contains("blueprint.json at the root"));
    }

    #[test]
    fn resolves_remote_blueprint_json_source() {
        let (url, handle) =
            spawn_http_server(br#"{ "siteOptions": { "blogname": "Remote JSON" } }"#.to_vec());

        let steps = super::startup_steps_from_blueprint_source(&url, false).unwrap();

        assert_eq!(
            steps,
            vec![StartupStep::SetSiteOptions {
                options_json: r#"{"blogname":"Remote JSON"}"#.to_string()
            }]
        );
        handle.join().unwrap();
    }

    #[test]
    fn installs_asset_zip_with_single_root_folder() {
        let target = temp_dir("asset-root-target");
        let zip_path = temp_dir("asset-root-zip").join("remote-plugin.zip");
        fs::write(
            &zip_path,
            blueprint_zip(vec![
                (
                    "demo-plugin/demo.php",
                    "<?php\n/* Plugin Name: Demo Plugin */\n",
                ),
                ("__MACOSX/ignored", "ignored"),
            ]),
        )
        .unwrap();

        let folder = install_asset_zip(
            &zip_path,
            "remote-plugin.zip",
            &target,
            None,
            IfAlreadyInstalled::Overwrite,
        )
        .unwrap();

        assert_eq!(folder, "demo-plugin");
        assert!(target.join("demo-plugin/demo.php").is_file());
        assert!(!target.join("demo-plugin/__MACOSX").exists());
        let _ = fs::remove_dir_all(target);
        let _ = fs::remove_dir_all(zip_path.parent().unwrap());
    }

    #[test]
    fn validates_install_asset_zip_before_install() {
        let root = temp_dir("validate-install-asset");
        let valid = root.join("demo-plugin.zip");
        fs::write(
            &valid,
            blueprint_zip(vec![("demo-plugin/demo.php", "<?php echo 'demo';")]),
        )
        .unwrap();
        let corrupt = root.join("corrupt-plugin.zip");
        fs::write(&corrupt, b"not a zip").unwrap();

        validate_install_asset_zip(&valid, "demo-plugin.zip").unwrap();
        assert!(validate_install_asset_zip(&corrupt, "corrupt-plugin.zip")
            .unwrap_err()
            .to_string()
            .contains("Failed to read downloaded asset ZIP"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn snapshot_zip_uses_absolute_wordpress_paths_and_visible_mounts() {
        let wordpress = temp_dir("snapshot-wordpress");
        fs::create_dir_all(wordpress.join("wp-content/plugins/demo")).unwrap();
        fs::write(wordpress.join("index.php"), "<?php echo 'root';").unwrap();
        fs::write(
            wordpress.join("wp-content/plugins/demo/root-only.php"),
            "<?php echo 'hidden';",
        )
        .unwrap();
        let plugin = temp_dir("snapshot-plugin");
        fs::write(plugin.join("demo.php"), "<?php echo 'plugin';").unwrap();
        let virtual_file = temp_dir("snapshot-virtual-file").join("only.txt");
        fs::write(&virtual_file, "virtual mount").unwrap();
        let outfile = temp_dir("snapshot-out").join("wordpress.zip");
        let mounts = vec![
            Mount::new(&wordpress, "/wordpress").unwrap(),
            Mount::new(&plugin, "/wordpress/wp-content/plugins/demo").unwrap(),
            Mount::new(&virtual_file, "/wordpress/virtual/deep/only.txt").unwrap(),
        ];

        write_wordpress_snapshot_zip(&mounts, &outfile).unwrap();

        let bytes = fs::read(&outfile).unwrap();
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        assert_eq!(
            zip.by_name("/wordpress/index.php").unwrap().size(),
            "<?php echo 'root';".len() as u64
        );
        assert_eq!(
            zip.by_name("/wordpress/wp-content/plugins/demo/demo.php")
                .unwrap()
                .size(),
            "<?php echo 'plugin';".len() as u64
        );
        assert_eq!(
            zip.by_name("/wordpress/virtual/deep/only.txt")
                .unwrap()
                .size(),
            "virtual mount".len() as u64
        );
        assert!(zip
            .by_name("/wordpress/wp-content/plugins/demo/root-only.php")
            .is_err());
        assert!(zip.by_name("playground-export.json").is_err());

        let _ = fs::remove_dir_all(wordpress);
        let _ = fs::remove_dir_all(plugin);
        let _ = fs::remove_dir_all(virtual_file.parent().unwrap());
        let _ = fs::remove_dir_all(outfile.parent().unwrap());
    }

    #[test]
    fn installs_rootless_asset_zip_under_filename_stem_or_target_override() {
        let target = temp_dir("asset-rootless-target");
        let zip_path = temp_dir("asset-rootless-zip").join("remote-theme.zip");
        fs::write(
            &zip_path,
            blueprint_zip(vec![
                ("style.css", "/*\nTheme Name: Remote Theme\n*/\n"),
                ("templates/index.html", "<!-- wp:paragraph -->"),
            ]),
        )
        .unwrap();

        let folder = install_asset_zip(
            &zip_path,
            "remote-theme.zip",
            &target,
            Some("custom-theme"),
            IfAlreadyInstalled::Overwrite,
        )
        .unwrap();

        assert_eq!(folder, "custom-theme");
        assert!(target.join("custom-theme/style.css").is_file());
        assert!(target.join("custom-theme/templates/index.html").is_file());
        let _ = fs::remove_dir_all(target);
        let _ = fs::remove_dir_all(zip_path.parent().unwrap());
    }

    #[test]
    fn install_asset_zip_honors_existing_destination_policy() {
        let target = temp_dir("asset-policy-target");
        let zip_path = temp_dir("asset-policy-zip").join("policy-plugin.zip");
        fs::write(
            &zip_path,
            blueprint_zip(vec![("policy-plugin/new.php", "<?php echo 'new';")]),
        )
        .unwrap();
        fs::create_dir_all(target.join("policy-plugin")).unwrap();
        fs::write(target.join("policy-plugin/old.php"), "old").unwrap();

        let folder = install_asset_zip(
            &zip_path,
            "policy-plugin.zip",
            &target,
            None,
            IfAlreadyInstalled::Skip,
        )
        .unwrap();
        assert_eq!(folder, "policy-plugin");
        assert!(target.join("policy-plugin/old.php").is_file());
        assert!(!target.join("policy-plugin/new.php").exists());

        let error = install_asset_zip(
            &zip_path,
            "policy-plugin.zip",
            &target,
            None,
            IfAlreadyInstalled::Error,
        )
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("ifAlreadyInstalled was set to error"));

        install_asset_zip(
            &zip_path,
            "policy-plugin.zip",
            &target,
            None,
            IfAlreadyInstalled::Overwrite,
        )
        .unwrap();
        assert!(!target.join("policy-plugin/old.php").exists());
        assert!(target.join("policy-plugin/new.php").is_file());
        let _ = fs::remove_dir_all(target);
        let _ = fs::remove_dir_all(zip_path.parent().unwrap());
    }

    #[test]
    fn unzip_bytes_extracts_and_overwrites_safe_entries() {
        let target = temp_dir("unzip-target");
        fs::create_dir_all(target.join("nested")).unwrap();
        fs::write(target.join("nested/file.txt"), "old").unwrap();
        let zip = blueprint_zip(vec![
            ("nested/file.txt", "new"),
            ("nested/second.txt", "second"),
            ("dir/", ""),
            ("dir/inside.txt", "inside"),
        ]);

        unzip_bytes_to_dir(&zip, &target).unwrap();

        assert_eq!(
            fs::read_to_string(target.join("nested/file.txt")).unwrap(),
            "new"
        );
        assert_eq!(
            fs::read_to_string(target.join("nested/second.txt")).unwrap(),
            "second"
        );
        assert_eq!(
            fs::read_to_string(target.join("dir/inside.txt")).unwrap(),
            "inside"
        );

        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn unzip_bytes_skips_entries_that_escape_destination() {
        let target = temp_dir("unzip-unsafe");
        let zip = blueprint_zip(vec![("../escape.txt", "bad"), ("safe.txt", "ok")]);

        unzip_bytes_to_dir(&zip, &target).unwrap();

        assert_eq!(fs::read_to_string(target.join("safe.txt")).unwrap(), "ok");
        assert!(!target.parent().unwrap().join("escape.txt").exists());

        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn native_unzip_startup_step_extracts_to_mount() {
        let root = temp_dir("native-unzip");
        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];
        let zip = blueprint_zip(vec![("plugin/demo.php", "<?php echo 'demo';")]);

        assert!(run_native_startup_step(
            &mounts,
            &StartupStep::Unzip {
                zip: FileContentSource::Bytes(zip),
                extract_to_path: "/wordpress/wp-content/plugins".to_string(),
            },
        )
        .unwrap());

        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/plugins/plugin/demo.php")).unwrap(),
            "<?php echo 'demo';"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_unzip_startup_step_extracts_zip_wrapped_literal_directory() {
        let steps = startup_steps_from_blueprint_json(
            r#"{
                "steps": [
                    {
                        "step": "unzip",
                        "zipFile": {
                            "resource": "zip",
                            "inner": {
                                "resource": "literal:directory",
                                "name": "bundle-root",
                                "files": {
                                    "nested/file.txt": "generated"
                                }
                            }
                        },
                        "extractToPath": "/wordpress/extracted"
                    }
                ]
            }"#,
            false,
        )
        .unwrap();
        let root = temp_dir("native-zip-resource-unzip");
        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];

        assert!(run_native_startup_step(&mounts, &steps[0]).unwrap());

        assert_eq!(
            fs::read_to_string(wordpress_root.join("extracted/bundle-root/nested/file.txt"))
                .unwrap(),
            "generated"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn install_asset_accepts_zip_wrapped_literal_directory() {
        let root = temp_dir("install-zip-resource");
        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];
        let mut files = BTreeMap::new();
        files.insert(
            "demo.php".to_string(),
            FileTreeEntry::File(b"<?php echo 'demo';".to_vec()),
        );
        let asset = InstallAssetStep {
            source: InstallAssetSource::Content {
                source: FileContentSource::ZipWrappedDirectory {
                    name: "demo-plugin".to_string(),
                    files,
                },
                filename: "demo-plugin.zip".to_string(),
            },
            target_folder_name: None,
            if_already_installed: IfAlreadyInstalled::Overwrite,
            activate: false,
        };

        let folder =
            install_downloadable_asset(&mounts, &asset, "/wordpress/wp-content/plugins", "plugin")
                .unwrap();

        assert_eq!(folder, "demo-plugin");
        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/plugins/demo-plugin/demo.php"))
                .unwrap(),
            "<?php echo 'demo';"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn install_plugin_accepts_single_php_file_resource() {
        let root = temp_dir("install-single-file-plugin");
        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];
        let asset = InstallAssetStep {
            source: InstallAssetSource::Content {
                source: FileContentSource::Bytes(
                    b"<?php\n/* Plugin Name: Single File */\n".to_vec(),
                ),
                filename: "single-file.php".to_string(),
            },
            target_folder_name: None,
            if_already_installed: IfAlreadyInstalled::Overwrite,
            activate: false,
        };

        let plugin_path = install_plugin_asset(&mounts, &asset).unwrap();

        assert_eq!(plugin_path, "/wordpress/wp-content/plugins/single-file.php");
        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/plugins/single-file.php")).unwrap(),
            "<?php\n/* Plugin Name: Single File */\n"
        );

        let skip_asset = InstallAssetStep {
            if_already_installed: IfAlreadyInstalled::Skip,
            ..asset
        };
        install_plugin_asset(&mounts, &skip_asset).unwrap();
        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/plugins/single-file.php")).unwrap(),
            "<?php\n/* Plugin Name: Single File */\n"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_file_blueprint_steps_modify_mounted_files() {
        let root = temp_dir("native-file-steps");
        let wordpress_root = root.join("wordpress");
        let tmp_root = root.join("tmp");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&tmp_root).unwrap();
        let mounts = vec![
            Mount::new(&wordpress_root, "/wordpress").unwrap(),
            Mount::new(&tmp_root, "/tmp").unwrap(),
        ];
        let steps = vec![
            StartupStep::Mkdir {
                path: "/wordpress/generated/sub".to_string(),
            },
            StartupStep::WriteFile {
                path: "/wordpress/generated/source.txt".to_string(),
                data: FileContentSource::Bytes(b"source".to_vec()),
            },
            StartupStep::Cp {
                from_path: "/wordpress/generated/source.txt".to_string(),
                to_path: "/tmp/copied.txt".to_string(),
            },
            StartupStep::Mv {
                from_path: "/tmp/copied.txt".to_string(),
                to_path: "/wordpress/generated/moved.txt".to_string(),
            },
            StartupStep::Mkdir {
                path: "/wordpress/remove-me/nested".to_string(),
            },
            StartupStep::WriteFile {
                path: "/wordpress/remove-me/nested/file.txt".to_string(),
                data: FileContentSource::Bytes(b"remove me".to_vec()),
            },
            StartupStep::Rmdir {
                path: "/wordpress/remove-me".to_string(),
            },
            StartupStep::Rm {
                path: "/wordpress/generated/source.txt".to_string(),
            },
        ];

        for step in &steps {
            assert!(run_native_startup_step(&mounts, step).unwrap());
        }

        assert!(wordpress_root.join("generated/sub").is_dir());
        assert_eq!(
            fs::read_to_string(wordpress_root.join("generated/moved.txt")).unwrap(),
            "source"
        );
        assert!(!tmp_root.join("copied.txt").exists());
        assert!(!wordpress_root.join("generated/source.txt").exists());
        assert!(!wordpress_root.join("remove-me").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_write_files_writes_nested_tree_to_mount() {
        let root = temp_dir("native-write-files");
        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];

        let mut assets = BTreeMap::new();
        assets.insert(
            "style.css".to_string(),
            FileTreeEntry::File(b"body { color: black; }".to_vec()),
        );
        let mut files = BTreeMap::new();
        files.insert(
            "demo.php".to_string(),
            FileTreeEntry::File(b"<?php echo 'demo';".to_vec()),
        );
        files.insert("assets".to_string(), FileTreeEntry::Directory(assets));

        assert!(run_native_startup_step(
            &mounts,
            &StartupStep::WriteFiles {
                write_to_path: "/wordpress/wp-content/plugins/native-demo".to_string(),
                files: FileTreeSource::Literal(files),
            },
        )
        .unwrap());

        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/plugins/native-demo/demo.php"))
                .unwrap(),
            "<?php echo 'demo';"
        );
        assert_eq!(
            fs::read_to_string(
                wordpress_root.join("wp-content/plugins/native-demo/assets/style.css")
            )
            .unwrap(),
            "body { color: black; }"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn native_write_file_requires_parent_except_mu_plugins() {
        let root = temp_dir("native-write-file-parent");
        let wordpress_root = root.join("wordpress");
        fs::create_dir_all(&wordpress_root).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];

        let error = run_native_startup_step(
            &mounts,
            &StartupStep::WriteFile {
                path: "/wordpress/missing-parent/file.txt".to_string(),
                data: FileContentSource::Bytes(b"missing".to_vec()),
            },
        )
        .unwrap_err();
        assert!(error.to_string().contains("writeFile failed"));

        assert!(run_native_startup_step(
            &mounts,
            &StartupStep::WriteFile {
                path: "/wordpress/wp-content/mu-plugins/demo.php".to_string(),
                data: FileContentSource::Bytes(b"<?php".to_vec()),
            },
        )
        .unwrap());
        assert_eq!(
            fs::read_to_string(wordpress_root.join("wp-content/mu-plugins/demo.php")).unwrap(),
            "<?php"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn native_write_file_blocks_symlink_escape() {
        let root = temp_dir("native-write-file-symlink");
        let wordpress_root = root.join("wordpress");
        let outside_root = root.join("outside");
        fs::create_dir_all(&wordpress_root).unwrap();
        fs::create_dir_all(&outside_root).unwrap();
        std::os::unix::fs::symlink(&outside_root, wordpress_root.join("linked-outside")).unwrap();
        let mounts = vec![Mount::new(&wordpress_root, "/wordpress").unwrap()];

        let error = run_native_startup_step(
            &mounts,
            &StartupStep::WriteFile {
                path: "/wordpress/linked-outside/escape.txt".to_string(),
                data: FileContentSource::Bytes(b"escape".to_vec()),
            },
        )
        .unwrap_err();

        assert!(error.to_string().contains("not covered by a host mount"));
        assert!(!outside_root.join("escape.txt").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn php_single_quoted_string_escapes_quotes_and_backslashes() {
        assert_eq!(
            php_single_quoted_string(r"a\b'c"),
            r#"'a\\b\'c'"#.to_string()
        );
    }

    fn blueprint_zip(entries: Vec<(&str, &str)>) -> Vec<u8> {
        let entries = entries
            .into_iter()
            .map(|(name, contents)| (name, contents.as_bytes()))
            .collect();
        blueprint_zip_bytes(entries)
    }

    fn blueprint_zip_bytes(entries: Vec<(&str, &[u8])>) -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut bytes);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            for (name, contents) in entries {
                zip.start_file(name, options).unwrap();
                zip.write_all(contents).unwrap();
            }
            zip.finish().unwrap();
        }
        bytes.into_inner()
    }

    fn zip_wp_content_export(document_root: &Path, site_url: &str) -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut bytes);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            zip_directory_relative(
                &mut zip,
                document_root,
                &document_root.join("wp-content"),
                options,
            );
            zip.start_file("playground-export.json", options).unwrap();
            zip.write_all(format!(r#"{{"siteUrl":"{site_url}"}}"#).as_bytes())
                .unwrap();
            zip.finish().unwrap();
        }
        bytes.into_inner()
    }

    fn zip_directory_relative<W: Write + std::io::Seek>(
        zip: &mut zip::ZipWriter<W>,
        root: &Path,
        current: &Path,
        options: zip::write::SimpleFileOptions,
    ) {
        let mut entries = fs::read_dir(current)
            .unwrap()
            .collect::<std::result::Result<Vec<_>, _>>()
            .unwrap();
        entries.sort_by_key(|entry| entry.path());
        for entry in entries {
            let path = entry.path();
            if path.is_dir() {
                zip_directory_relative(zip, root, &path, options);
            } else if path.is_file() {
                let relative = path.strip_prefix(root).unwrap();
                zip.start_file(zip_path_to_string(relative), options)
                    .unwrap();
                zip.write_all(&fs::read(path).unwrap()).unwrap();
            }
        }
    }

    fn spawn_http_server(body: Vec<u8>) -> (String, JoinHandle<()>) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 1024];
            let _ = std::io::Read::read(&mut stream, &mut request).unwrap();
            let headers = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            stream.write_all(headers.as_bytes()).unwrap();
            stream.write_all(&body).unwrap();
        });
        (url, handle)
    }
}
