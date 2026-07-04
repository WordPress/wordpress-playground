use std::{
    cell::{Cell, RefCell},
    collections::{BTreeMap, HashMap, VecDeque},
    fmt::{Display, Formatter},
    fs,
    io::{self, Read, Seek, SeekFrom, Write},
    net::{IpAddr, Ipv4Addr, Ipv6Addr, Shutdown, SocketAddr, TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Condvar, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use mio::net::TcpStream as MioTcpStream;
use mio::{Events, Interest, Poll as MioPoll, Token};
use socket2::{
    Domain as SocketDomain, Protocol as SocketProtocol, SockAddr, Socket as Socket2,
    Type as SocketType,
};
use wasmtime::{
    Caller, ExternType, Func, Global, Linker, Memory, Module, Ref, Store, Val, ValType,
};

use futures_executor::block_on;

use crate::{assets::PhpAssetRuntime, vfs::normalize_vfs_path, CliError, Result};

type GuestIovWrites = Vec<(i32, Vec<u8>)>;
type HostIovReadResult = std::result::Result<(GuestIovWrites, usize, usize), i32>;
type CheckedIovRanges = (Memory, Vec<(usize, usize)>, usize);

const EBADF: i32 = 8;
const EACCES: i32 = 2;
const EADDRINUSE: i32 = 3;
const EADDRNOTAVAIL: i32 = 4;
const EAGAIN: i32 = 6;
const EALREADY: i32 = 7;
const ECONNABORTED: i32 = 13;
const ECONNREFUSED: i32 = 14;
const EEXIST: i32 = 20;
const EINVAL: i32 = 28;
const EINPROGRESS: i32 = 26;
const ENOENT: i32 = 44;
const ENOSYS: i32 = 52;
const ENOTDIR: i32 = 54;
const ENOTTY: i32 = 59;
const EPIPE: i32 = 64;
const ERANGE: i32 = 68;
const EAFNOSUPPORT: i32 = 5;
const ECONNRESET: i32 = 15;
const EHOSTUNREACH: i32 = 23;
const EISCONN: i32 = 30;
const ENETUNREACH: i32 = 40;
const ENOPROTOOPT: i32 = 50;
const ENOTCONN: i32 = 53;
const EPROTONOSUPPORT: i32 = 66;
const ETIMEDOUT: i32 = 73;
const ESRCH: i32 = 71;
const EOPNOTSUPP: i32 = 138;
const EAI_NONAME: i32 = -2;
const EAI_SERVICE: i32 = -8;
const EAI_OVERFLOW: i32 = -12;
const AT_FDCWD: i32 = -100;
const AT_SYMLINK_NOFOLLOW: i32 = 256;
const AT_REMOVEDIR: i32 = 512;
const AT_EACCESS: i32 = 512;
const AT_EMPTY_PATH: i32 = 4096;
const O_ACCMODE: i32 = 0o3;
const O_WRONLY: i32 = 0o1;
const O_RDWR: i32 = 0o2;
const O_CREAT: i32 = 0o100;
const O_EXCL: i32 = 0o200;
const O_TRUNC: i32 = 0o1000;
const O_APPEND: i32 = 0o2000;
const O_NONBLOCK: i32 = 0o4000;
const O_DIRECTORY: i32 = 0o200000;
const O_TMPFILE: i32 = 0o20200000;
const PROT_WRITE: i32 = 0x2;
const MAP_PRIVATE: i32 = 0x2;
const F_DUPFD: i32 = 0;
const F_GETFD: i32 = 1;
const F_SETFD: i32 = 2;
const F_GETFL: i32 = 3;
const F_SETFL: i32 = 4;
const F_GETLK: i32 = 5;
const F_SETLK: i32 = 6;
const F_SETLKW: i32 = 7;
const F_GETLK64: i32 = 12;
const F_SETLK64: i32 = 13;
const F_SETLKW64: i32 = 14;
const F_DUPFD_CLOEXEC: i32 = 1030;
const F_RDLCK: u16 = 0;
const F_WRLCK: u16 = 1;
const F_UNLCK: u16 = 2;
const LOCK_SH: i32 = 1;
const LOCK_EX: i32 = 2;
const LOCK_NB: i32 = 4;
const LOCK_UN: i32 = 8;
const SEEK_SET: u16 = 0;
const SEEK_CUR: u16 = 1;
const SEEK_END: u16 = 2;
const MAX_LOCK_OFFSET: u64 = 9_007_199_254_740_991;
const PIPE_BUFFER_LIMIT: usize = 64 * 1024;
const S_IFCHR: u32 = 0o020000;
const S_IFIFO: u32 = 0o010000;
const S_IFDIR: u32 = 0o040000;
const S_IFREG: u32 = 0o100000;
const S_IFLNK: u32 = 0o120000;
const ASYNCIFY_STACK_SIZE: u32 = 4096;
const DIRENT64_SIZE: usize = 280;
const AF_INET: i32 = 2;
const AF_INET6: i32 = 10;
const SOCK_STREAM: i32 = 1;
const SOCK_DGRAM: i32 = 2;
const SOCK_TYPE_MASK: i32 = !526_336;
const SOCK_CLOEXEC: i32 = 0o2000000;
const IPPROTO_TCP: i32 = 6;
const SOL_SOCKET: i32 = 1;
const SO_ERROR: i32 = 4;
const SO_KEEPALIVE: i32 = 9;
const SO_RCVTIMEO: i32 = 66;
const SO_SNDTIMEO: i32 = 67;
const TCP_NODELAY: i32 = 1;
const UTIME_NOW: i32 = 1_073_741_823;
const UTIME_OMIT: i32 = 1_073_741_822;
const DEFAULT_PHP_INI_BASE: &str = concat!(
    "memory_limit=256M\n",
    "error_reporting=E_ALL\n",
    "display_errors=1\n",
    "log_errors=1\n",
    "implicit_flush=1\n",
    "output_buffering=0\n",
    "max_execution_time=0\n",
    "max_input_time=-1\n",
    "openssl.cafile=/internal/shared/ca-bundle.crt\n",
    "curl.cainfo=/internal/shared/ca-bundle.crt\n",
    "auto_prepend_file=/internal/shared/auto_prepend_file.php\n",
    "opcache.enable=1\n",
    "opcache.enable_cli=1\n",
    "opcache.jit=0\n",
    "opcache.interned_strings_buffer=8\n",
    "opcache.max_accelerated_files=10000\n",
    "opcache.memory_consumption=64\n",
    "opcache.max_wasted_percentage=5\n",
    "opcache.file_cache=/tmp/opcache\n",
    "opcache.file_cache_only=0\n",
    "opcache.file_cache_consistency_checks=1\n",
);
const POLLIN: u16 = 1;
const POLLPRI: u16 = 2;
const POLLOUT: u16 = 4;
const POLLERR: u16 = 8;
const POLLHUP: u16 = 16;
const POLLNVAL: u16 = 32;
const DEFAULT_SOCKET_TIMEOUT: Duration = Duration::from_secs(60);
const OPCACHE_MEMORY_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_OPCACHE_MEMORY_MB";
const OPCACHE_INTERNED_STRINGS_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_OPCACHE_INTERNED_STRINGS_MB";
const OPCACHE_MAX_ACCELERATED_FILES_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_OPCACHE_MAX_ACCELERATED_FILES";
const EXPERIMENTAL_PHP_INI_APPEND_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_EXPERIMENTAL_PHP_INI_APPEND";
pub(crate) const PROFILE_IMPORTS_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_PROFILE_IMPORTS";
pub(crate) const PROFILE_IMPORT_FAMILIES_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_PROFILE_IMPORT_FAMILIES";
pub(crate) const PROFILE_IMPORT_TOP_N_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_PROFILE_IMPORT_TOP_N";
pub(crate) const PROFILE_IMPORT_SELF_TIME_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_PROFILE_IMPORT_SELF_TIME";
pub(crate) const PROFILE_IMPORT_INCLUSIVE_TIME_ENV_VAR: &str =
    "WP_PLAYGROUND_NATIVE_PROFILE_IMPORT_INCLUSIVE_TIME";
static NEXT_HOST_LOCK_OWNER_ID: AtomicU64 = AtomicU64::new(1);
static ADVISORY_LOCKS: OnceLock<Mutex<HashMap<PathBuf, Vec<AdvisoryLock>>>> = OnceLock::new();

#[derive(Debug, Clone, PartialEq, Eq)]
struct AdvisoryLock {
    owner_id: u64,
    fd: i32,
    lock_type: u16,
    scope: AdvisoryLockScope,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AdvisoryLockScope {
    WholeFile,
    Range(AdvisoryLockRange),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct AdvisoryLockRange {
    start: u64,
    end: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct FcntlLockRequest {
    lock_type: u16,
    whence: u16,
    start: i64,
    len: i64,
}

#[derive(Debug, Clone, Copy)]
struct EmscriptenNowBase {
    instant: Instant,
    epoch_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpExitStatus(pub i32);

impl Display for PhpExitStatus {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "PHP exited with status {}", self.0)
    }
}

impl std::error::Error for PhpExitStatus {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmscriptenLongjmp;

impl Display for EmscriptenLongjmp {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Emscripten longjmp")
    }
}

impl std::error::Error for EmscriptenLongjmp {}

pub struct HostState {
    pub called_imports: Vec<String>,
    import_call_count: usize,
    import_self_time: Option<ImportSelfTimeProfile>,
    import_inclusive_time: Option<ImportInclusiveTimeProfile>,
    options: HostOptions,
    resolved_mounts: Vec<ResolvedHostMount>,
    canonical_allowed_host_paths: Vec<PathBuf>,
    cwd: String,
    env: Vec<String>,
    internal_files: HashMap<String, Arc<[u8]>>,
    followed_symlink_roots: Vec<PathBuf>,
    fds: Vec<Option<FdEntry>>,
    mmap_regions: Vec<MmapRegion>,
    sockets: HashMap<i32, SocketEntry>,
    next_socket_id: i32,
    processes: HashMap<i32, ProcessEntry>,
    next_process_id: i32,
    next_popen_file_id: u64,
    captured_stdout: Vec<u8>,
    captured_stderr: Vec<u8>,
    captured_headers: Vec<u8>,
    asyncify_state: AsyncifyState,
    asyncify_data: Option<u32>,
    lock_owner_id: u64,
    host_cache_enabled: bool,
    host_cache_generation: Cell<u64>,
    host_path_cache: RefCell<HashMap<(String, bool, bool), Option<PathBuf>>>,
    host_stat_cache: RefCell<HashMap<(String, bool), std::result::Result<VfsStat, i32>>>,
    emscripten_now_base: Option<EmscriptenNowBase>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ImportSelfTimeSnapshot {
    pub totals: BTreeMap<String, ImportSelfTimeTotal>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ImportSelfTimeTotal {
    pub calls: u64,
    pub total_ns: u128,
}

#[derive(Debug, Default)]
struct ImportSelfTimeProfile {
    totals: BTreeMap<String, ImportSelfTimeTotal>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ImportInclusiveTimeSnapshot {
    pub totals: BTreeMap<String, ImportInclusiveTimeTotal>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ImportInclusiveTimeTotal {
    pub calls: u64,
    pub total_ns: u128,
}

#[derive(Debug, Default)]
struct ImportInclusiveTimeProfile {
    totals: BTreeMap<String, ImportInclusiveTimeTotal>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PhpConstantValue {
    String(String),
    Bool(bool),
    Number(String),
}

impl PhpConstantValue {
    pub fn string(value: impl Into<String>) -> Self {
        Self::String(value.into())
    }

    pub fn bool(value: bool) -> Self {
        Self::Bool(value)
    }

    pub fn number(value: impl Into<String>) -> Self {
        Self::Number(value.into())
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum OpcacheMode {
    #[default]
    Validate,
    Revalidate,
    Immutable,
    Middle,
    LowMemory,
    Off,
}

impl OpcacheMode {
    pub fn enables_host_cache(self) -> bool {
        matches!(self, Self::Immutable | Self::Middle | Self::LowMemory)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostOptions {
    pub max_import_calls: Option<usize>,
    pub capture_import_trace: bool,
    pub allowed_host_paths: Vec<PathBuf>,
    pub mounts: Vec<HostMount>,
    pub follow_symlinks: bool,
    pub echo_output: bool,
    pub string_constants: Vec<(String, PhpConstantValue)>,
    pub process_policy: HostProcessPolicy,
    pub opcache_mode: OpcacheMode,
    pub host_cache: bool,
    pub php_version: Option<String>,
    pub php_runtime: PhpAssetRuntime,
}

impl Default for HostOptions {
    fn default() -> Self {
        Self {
            max_import_calls: None,
            capture_import_trace: true,
            allowed_host_paths: Vec::new(),
            mounts: Vec::new(),
            follow_symlinks: false,
            echo_output: true,
            string_constants: Vec::new(),
            process_policy: HostProcessPolicy::default(),
            opcache_mode: OpcacheMode::default(),
            host_cache: false,
            php_version: None,
            php_runtime: PhpAssetRuntime::Asyncify,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostProcessPolicy {
    pub allowed_commands: Vec<HostProcessCommand>,
    pub max_popen_output_bytes: usize,
}

impl Default for HostProcessPolicy {
    fn default() -> Self {
        Self {
            allowed_commands: Vec::new(),
            max_popen_output_bytes: 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostProcessCommand {
    pub command: String,
    pub executable: PathBuf,
}

impl HostProcessCommand {
    pub fn new(command: impl Into<String>, executable: impl Into<PathBuf>) -> Self {
        Self {
            command: command.into(),
            executable: executable.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostMount {
    pub host_path: PathBuf,
    pub vfs_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ResolvedHostMount {
    host_path: PathBuf,
    canonical_host_path: PathBuf,
    vfs_path: String,
}

fn constants_json(constants: &[(String, PhpConstantValue)]) -> Vec<u8> {
    let mut json = serde_json::Map::new();
    for (key, value) in constants {
        let value = match value {
            PhpConstantValue::String(value) => serde_json::Value::String(value.clone()),
            PhpConstantValue::Bool(value) => serde_json::Value::Bool(*value),
            PhpConstantValue::Number(value) => value
                .parse::<f64>()
                .ok()
                .and_then(serde_json::Number::from_f64)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
        };
        json.insert(key.clone(), value);
    }
    serde_json::to_vec(&json).unwrap_or_else(|_| b"{}".to_vec())
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AsyncifyState {
    #[default]
    Normal,
    Unwinding,
    Rewinding,
}

#[derive(Debug, Clone)]
enum FdEntry {
    Stdin,
    Stdout,
    Stderr,
    RequestStdout,
    RequestStderr,
    RequestHeaders,
    Random,
    File {
        path: String,
        host_path: Option<PathBuf>,
        data: Vec<u8>,
        position: usize,
        access_mode: i32,
        append: bool,
        nonblocking: bool,
        dirty: bool,
    },
    HostReadFile {
        path: String,
        host_path: PathBuf,
        file: Arc<Mutex<fs::File>>,
        position: usize,
        append: bool,
        nonblocking: bool,
        cached_stat: VfsStat,
        cached_stat_generation: u64,
    },
    InternalReadFile {
        path: String,
        data: Arc<[u8]>,
        position: usize,
        append: bool,
        nonblocking: bool,
    },
    Directory {
        path: String,
        position: usize,
    },
    Pipe {
        pipe: Arc<PipeShared>,
        end: PipeEnd,
        nonblocking: bool,
    },
    Socket {
        socket_id: i32,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PipeEnd {
    Read,
    Write,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CaptureWriteTarget {
    Stdout,
    Stderr,
    Headers,
}

#[derive(Debug)]
struct PipeShared {
    state: Mutex<PipeState>,
    ready: Condvar,
}

#[derive(Debug)]
struct PipeState {
    buffer: VecDeque<u8>,
    readers: usize,
    writers: usize,
}

#[derive(Debug, Clone)]
struct MmapRegion {
    addr: usize,
    len: usize,
    file_offset: usize,
    prot: i32,
    flags: i32,
    backing: MmapBacking,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum MmapBacking {
    HostPath(PathBuf),
    Fd { fd: i32, path: String },
}

#[derive(Debug)]
struct SocketEntry {
    domain: i32,
    socket_type: i32,
    stream: Option<TcpStream>,
    server: Option<TcpServerSocket>,
    pending_connect: Option<PendingConnect>,
    peer: Option<SocketAddr>,
    local: Option<SocketAddr>,
    error: i32,
    nonblocking: bool,
    receive_timeout: Option<Duration>,
    send_timeout: Option<Duration>,
}

#[derive(Debug)]
struct TcpServerSocket {
    socket: Socket2,
    listening: bool,
    pending_accepts: VecDeque<AcceptedConnection>,
}

#[derive(Debug)]
struct AcceptedConnection {
    stream: TcpStream,
    peer: SocketAddr,
}

#[derive(Debug)]
struct PendingConnect {
    peer: SocketAddr,
    stream: MioTcpStream,
}

#[derive(Debug)]
struct ProcessEntry {
    child: Child,
    exit_code: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ProcessDescriptor {
    target_fd: i32,
    child_fd: i32,
    parent_fd: i32,
}

#[derive(Debug)]
struct PreparedProcessStdio {
    stdin: Option<PipeEndpoint>,
    stdout: Option<PipeEndpoint>,
    stderr: Option<PipeEndpoint>,
}

#[derive(Debug)]
struct PipeEndpoint {
    pipe: Arc<PipeShared>,
    end: PipeEnd,
}

impl Drop for PipeEndpoint {
    fn drop(&mut self) {
        if let Ok(mut state) = self.pipe.state.lock() {
            match self.end {
                PipeEnd::Read => state.readers = state.readers.saturating_sub(1),
                PipeEnd::Write => state.writers = state.writers.saturating_sub(1),
            }
            self.pipe.ready.notify_all();
        }
    }
}

impl Default for HostState {
    fn default() -> Self {
        Self::new(HostOptions::default())
    }
}

fn default_php_ini(options: &HostOptions) -> Vec<u8> {
    let mut ini = String::from(DEFAULT_PHP_INI_BASE);
    match options.opcache_mode {
        OpcacheMode::Validate => {}
        OpcacheMode::Revalidate => {
            ini.push_str("opcache.revalidate_freq=60\n");
        }
        OpcacheMode::Immutable => {
            ini.push_str("opcache.validate_timestamps=0\n");
        }
        OpcacheMode::Middle => {
            ini.push_str(concat!(
                "opcache.validate_timestamps=0\n",
                "opcache.memory_consumption=18\n",
                "opcache.interned_strings_buffer=3\n",
                "opcache.max_accelerated_files=4096\n",
                "opcache.max_wasted_percentage=10\n",
            ));
        }
        OpcacheMode::LowMemory => {
            ini.push_str(concat!(
                "opcache.validate_timestamps=0\n",
                "opcache.memory_consumption=8\n",
                "opcache.interned_strings_buffer=2\n",
                "opcache.max_accelerated_files=2048\n",
                "opcache.max_wasted_percentage=10\n",
            ));
        }
        OpcacheMode::Off => {
            ini.push_str("opcache.enable=0\nopcache.enable_cli=0\n");
        }
    }
    append_opcache_compatibility_fallback(&mut ini, options);
    append_opcache_env_override(
        &mut ini,
        OPCACHE_MEMORY_ENV_VAR,
        "opcache.memory_consumption",
    );
    append_opcache_env_override(
        &mut ini,
        OPCACHE_INTERNED_STRINGS_ENV_VAR,
        "opcache.interned_strings_buffer",
    );
    append_opcache_env_override(
        &mut ini,
        OPCACHE_MAX_ACCELERATED_FILES_ENV_VAR,
        "opcache.max_accelerated_files",
    );
    append_experimental_php_ini(&mut ini);
    ini.into_bytes()
}

fn append_opcache_compatibility_fallback(ini: &mut String, options: &HostOptions) {
    if matches!(options.opcache_mode, OpcacheMode::Off) {
        return;
    }
    if !php_version_uses_file_cache_only_opcache_fallback(options.php_version.as_deref()) {
        return;
    }

    // PHP 7.4 and 8.0 still fail native Wasmtime OPcache shared-memory startup.
    // Keep version coverage while a host-level runtime fix remains separate work.
    ini.push_str("opcache.file_cache_only=1\n");
}

fn php_version_uses_file_cache_only_opcache_fallback(php_version: Option<&str>) -> bool {
    let Some(php_version) = php_version else {
        return false;
    };
    php_version.starts_with("7.4") || php_version.starts_with("8.0")
}

fn append_opcache_env_override(ini: &mut String, env_name: &str, directive: &str) {
    let Ok(value) = std::env::var(env_name) else {
        return;
    };
    let Ok(parsed) = value.parse::<u32>() else {
        return;
    };
    if parsed == 0 || parsed > 1_000_000 {
        return;
    }
    ini.push_str(directive);
    ini.push('=');
    ini.push_str(&parsed.to_string());
    ini.push('\n');
}

fn append_experimental_php_ini(ini: &mut String) {
    let Ok(extra_ini) = std::env::var(EXPERIMENTAL_PHP_INI_APPEND_ENV_VAR) else {
        return;
    };
    let extra_ini = extra_ini.trim();
    if extra_ini.is_empty() {
        return;
    }
    if !ini.ends_with('\n') {
        ini.push('\n');
    }
    ini.push_str(extra_ini);
    if !ini.ends_with('\n') {
        ini.push('\n');
    }
}

fn shared_internal_files() -> &'static HashMap<String, Arc<[u8]>> {
    static SHARED_INTERNAL_FILES: OnceLock<HashMap<String, Arc<[u8]>>> = OnceLock::new();
    SHARED_INTERNAL_FILES.get_or_init(|| {
        let mut internal_files: HashMap<String, Arc<[u8]>> = HashMap::new();
        internal_files.insert(
            "/internal/shared/ca-bundle.crt".to_string(),
            Arc::from(&include_bytes!(concat!(env!("OUT_DIR"), "/ca-bundle.crt"))[..]),
        );
        internal_files.insert(
            "/internal/shared/auto_prepend_file.php".to_string(),
            Arc::from(
                &br#"<?php
if (file_exists('/internal/shared/consts.json')) {
    $consts = json_decode(file_get_contents('/internal/shared/consts.json'), true);
    if (is_array($consts)) {
        foreach ($consts as $const => $value) {
            if (!defined($const) && is_scalar($value)) {
                define($const, $value);
            }
        }
    }
}
if (!defined('DISABLE_WP_CRON')) {
    define('DISABLE_WP_CRON', true);
}
if (!defined('AUTOMATIC_UPDATER_DISABLED')) {
    define('AUTOMATIC_UPDATER_DISABLED', true);
}
if (!defined('WP_AUTO_UPDATE_CORE')) {
    define('WP_AUTO_UPDATE_CORE', false);
}
if (file_exists('/internal/shared/preload/env.php')) {
    require_once '/internal/shared/preload/env.php';
}
"#[..],
            ),
        );
        internal_files.insert(
            "/internal/shared/preload/env.php".to_string(),
            Arc::from(
                &br#"<?php
function playground_add_filter($tag, $function_to_add, $priority = 10, $accepted_args = 1) {
    global $wp_filter;
    $wp_filter[$tag][$priority][$function_to_add] = array('function' => $function_to_add, 'accepted_args' => $accepted_args);
}
function playground_add_action($tag, $function_to_add, $priority = 10, $accepted_args = 1) {
    playground_add_filter($tag, $function_to_add, $priority, $accepted_args);
}
playground_add_action('muplugins_loaded', 'playground_load_mu_plugins', 0);
function playground_load_mu_plugins() {
    $mu_plugins_dir = '/internal/shared/mu-plugins';
    if (!is_dir($mu_plugins_dir)) {
        return;
    }
    $mu_plugins = glob($mu_plugins_dir . '/*.php');
    if (!is_array($mu_plugins)) {
        return;
    }
    sort($mu_plugins);
    foreach ($mu_plugins as $mu_plugin) {
        require_once $mu_plugin;
    }
}
"#[..],
            ),
        );
        internal_files.insert(
            "/internal/shared/mu-plugins/1-auto-login.php".to_string(),
            Arc::from(
                &br#"<?php
function playground_get_username_for_auto_login() {
    if (defined('PLAYGROUND_AUTO_LOGIN_AS_USER') && !isset($_COOKIE['playground_auto_login_already_happened'])) {
        return PLAYGROUND_AUTO_LOGIN_AS_USER;
    }
    if (defined('PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED') && isset($_GET['playground_force_auto_login_as_user'])) {
        return $_GET['playground_force_auto_login_as_user'];
    }
    return false;
}

function playground_auto_login() {
    if (empty($_SERVER['REQUEST_URI'])) {
        return;
    }
    $user_name = playground_get_username_for_auto_login();
    if (false === $user_name) {
        return;
    }
    if (wp_doing_ajax() || defined('REST_REQUEST') || is_user_logged_in()) {
        return;
    }
    $user = get_user_by('login', $user_name);
    if (!$user || headers_sent()) {
        return;
    }
    wp_set_current_user($user->ID, $user->user_login);
    wp_set_auth_cookie($user->ID);
    do_action('wp_login', $user->user_login, $user);
    setcookie('playground_auto_login_already_happened', '1');
    if (headers_sent()) {
        return;
    }
    header('Location: ' . $_SERVER['REQUEST_URI'], true, 302);
    exit;
}
add_action('init', 'playground_auto_login', 1);

function playground_auto_login_redirect_target() {
    if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '?playground-redirection-handler') !== false) {
        $next = isset($_GET['next']) ? $_GET['next'] : '/';
        header('Location: ' . $next, true, 302);
        exit;
    }
}
add_action('init', 'playground_auto_login_redirect_target', 1);

add_filter('admin_email_check_interval', function($interval) {
    if (false === playground_get_username_for_auto_login()) {
        return 0;
    }
    return $interval;
});
"#[..],
            ),
        );
        internal_files.insert(
            "/internal/shared/mu-plugins/0-playground.php".to_string(),
            Arc::from(
                &br#"<?php
if (!defined('DISABLE_WP_CRON')) {
    define('DISABLE_WP_CRON', true);
}
if (isset($_SERVER['PHP_SELF']) && substr($_SERVER['PHP_SELF'], -12) === '/wp-cron.php') {
    http_response_code(503);
    header('Content-Type: text/plain');
    echo 'WP Cron is disabled in wp-playground-native.';
    exit;
}
add_filter('automatic_updater_disabled', '__return_true');
add_filter('auto_update_core', '__return_false');
add_filter('auto_update_plugin', '__return_false');
add_filter('auto_update_theme', '__return_false');
"#[..],
            ),
        );
        internal_files
    })
}

impl HostState {
    fn new(mut options: HostOptions) -> Self {
        if env_flag(PROFILE_IMPORTS_ENV_VAR) || env_flag(PROFILE_IMPORT_FAMILIES_ENV_VAR) {
            options.capture_import_trace = true;
        }
        let host_cache_enabled = options.host_cache || env_flag("WP_PLAYGROUND_NATIVE_HOST_CACHE");
        let mut internal_files = shared_internal_files().clone();
        internal_files.insert(
            "/internal/shared/php.ini".to_string(),
            default_php_ini(&options).into(),
        );
        internal_files.insert(
            "/internal/shared/consts.json".to_string(),
            constants_json(&options.string_constants).into(),
        );

        let mut resolved_mounts: Vec<ResolvedHostMount> = options
            .mounts
            .iter()
            .map(|mount| ResolvedHostMount {
                host_path: mount.host_path.clone(),
                canonical_host_path: fs::canonicalize(&mount.host_path)
                    .unwrap_or_else(|_| mount.host_path.clone()),
                vfs_path: normalize_vfs_path(&mount.vfs_path)
                    .unwrap_or_else(|_| mount.vfs_path.clone()),
            })
            .collect();
        resolved_mounts.sort_by_key(|mount| std::cmp::Reverse(mount.vfs_path.len()));
        let canonical_allowed_host_paths = options
            .allowed_host_paths
            .iter()
            .filter_map(|allowed| fs::canonicalize(allowed).ok())
            .collect();

        Self {
            called_imports: Vec::new(),
            import_call_count: 0,
            import_self_time: env_flag(PROFILE_IMPORT_SELF_TIME_ENV_VAR)
                .then(ImportSelfTimeProfile::default),
            import_inclusive_time: env_flag(PROFILE_IMPORT_INCLUSIVE_TIME_ENV_VAR)
                .then(ImportInclusiveTimeProfile::default),
            resolved_mounts,
            canonical_allowed_host_paths,
            options,
            cwd: "/".to_string(),
            env: vec![
                "USER=web_user".to_string(),
                "LOGNAME=web_user".to_string(),
                "PATH=/".to_string(),
                "PWD=/".to_string(),
                "HOME=/home/web_user".to_string(),
                "LANG=C.UTF-8".to_string(),
                "_=php".to_string(),
            ],
            internal_files,
            followed_symlink_roots: Vec::new(),
            fds: vec![
                Some(FdEntry::Stdin),
                Some(FdEntry::Stdout),
                Some(FdEntry::Stderr),
            ],
            mmap_regions: Vec::new(),
            sockets: HashMap::new(),
            next_socket_id: 1,
            processes: HashMap::new(),
            next_process_id: 1000,
            next_popen_file_id: 1,
            captured_stdout: Vec::new(),
            captured_stderr: Vec::new(),
            captured_headers: Vec::new(),
            asyncify_state: AsyncifyState::Normal,
            asyncify_data: None,
            lock_owner_id: NEXT_HOST_LOCK_OWNER_ID.fetch_add(1, Ordering::Relaxed),
            host_cache_enabled,
            host_cache_generation: Cell::new(0),
            host_path_cache: RefCell::new(HashMap::new()),
            host_stat_cache: RefCell::new(HashMap::new()),
            emscripten_now_base: None,
        }
    }

    pub fn define_constants(&mut self, constants: &[(String, PhpConstantValue)]) {
        let mut merged = self.options.string_constants.clone();
        for (name, value) in constants {
            if let Some((_, existing)) = merged.iter_mut().find(|(existing, _)| existing == name) {
                *existing = value.clone();
            } else {
                merged.push((name.clone(), value.clone()));
            }
        }
        self.options.string_constants = merged;
        self.internal_files.insert(
            "/internal/shared/consts.json".to_string(),
            constants_json(&self.options.string_constants).into(),
        );
    }

    pub fn asyncify_state(&self) -> AsyncifyState {
        self.asyncify_state
    }

    pub fn asyncify_data(&self) -> Option<u32> {
        self.asyncify_data
    }

    pub fn set_asyncify_state(&mut self, state: AsyncifyState) {
        self.asyncify_state = state;
    }

    pub fn take_captured_stdout(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.captured_stdout)
    }

    pub fn take_captured_stderr(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.captured_stderr)
    }

    pub fn take_captured_headers(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.captured_headers)
    }

    pub fn import_call_count(&self) -> usize {
        self.import_call_count
    }

    pub fn import_self_time_snapshot(&self) -> ImportSelfTimeSnapshot {
        ImportSelfTimeSnapshot {
            totals: self
                .import_self_time
                .as_ref()
                .map(|profile| profile.totals.clone())
                .unwrap_or_default(),
        }
    }

    pub fn import_inclusive_time_snapshot(&self) -> ImportInclusiveTimeSnapshot {
        ImportInclusiveTimeSnapshot {
            totals: self
                .import_inclusive_time
                .as_ref()
                .map(|profile| profile.totals.clone())
                .unwrap_or_default(),
        }
    }

    fn record_import(&mut self, label: &str) -> wasmtime::Result<()> {
        self.import_call_count = self.import_call_count.saturating_add(1);
        if self.options.capture_import_trace {
            self.called_imports.push(label.to_string());
        }

        if let Some(max_import_calls) = self.options.max_import_calls {
            if self.import_call_count > max_import_calls {
                let recent_start = self.called_imports.len().saturating_sub(20);
                return Err(wasmtime::Error::msg(format!(
                    "host import call limit exceeded after {max_import_calls} calls; recent imports: {}",
                    self.called_imports[recent_start..].join(", ")
                )));
            }
        }

        Ok(())
    }

    fn should_record_import_self_time(&self, label: &str) -> bool {
        self.import_self_time.is_some() && profile_import_self_time_label(label)
    }

    fn record_import_self_time(&mut self, label: &str, elapsed: Duration) {
        let Some(profile) = self.import_self_time.as_mut() else {
            return;
        };
        let entry = profile.totals.entry(label.to_string()).or_default();
        entry.calls = entry.calls.saturating_add(1);
        entry.total_ns = entry.total_ns.saturating_add(elapsed.as_nanos());
    }

    fn should_record_import_inclusive_time(&self, label: &str) -> bool {
        self.import_inclusive_time.is_some() && profile_import_inclusive_time_label(label)
    }

    fn record_import_inclusive_time(&mut self, label: &str, elapsed: Duration) {
        let Some(profile) = self.import_inclusive_time.as_mut() else {
            return;
        };
        let entry = profile.totals.entry(label.to_string()).or_default();
        entry.calls = entry.calls.saturating_add(1);
        entry.total_ns = entry.total_ns.saturating_add(elapsed.as_nanos());
    }

    fn trace_enabled(&self) -> bool {
        self.options.max_import_calls.is_some()
    }

    fn synthetic_pid(&self) -> i32 {
        i32::try_from(self.lock_owner_id).unwrap_or(i32::MAX)
    }

    fn emscripten_unix_time_ms(&mut self) -> wasmtime::Result<f64> {
        let base = match self.emscripten_now_base {
            Some(base) => base,
            None => {
                let epoch_ms = unix_time_ns()? as f64 / 1_000_000.0;
                let base = EmscriptenNowBase {
                    instant: Instant::now(),
                    epoch_ms,
                };
                self.emscripten_now_base = Some(base);
                base
            }
        };

        Ok(base.epoch_ms + base.instant.elapsed().as_secs_f64() * 1_000.0)
    }

    fn alloc_fd(&mut self, entry: FdEntry) -> i32 {
        for (fd, slot) in self.fds.iter_mut().enumerate().skip(3) {
            if slot.is_none() {
                *slot = Some(entry);
                return fd as i32;
            }
        }
        self.fds.push(Some(entry));
        (self.fds.len() - 1) as i32
    }

    fn get_fd(&self, fd: i32) -> std::result::Result<&FdEntry, i32> {
        self.fds
            .get(usize::try_from(fd).map_err(|_| EBADF)?)
            .and_then(|entry| entry.as_ref())
            .ok_or(EBADF)
    }

    fn get_fd_mut(&mut self, fd: i32) -> std::result::Result<&mut FdEntry, i32> {
        self.fds
            .get_mut(usize::try_from(fd).map_err(|_| EBADF)?)
            .and_then(|entry| entry.as_mut())
            .ok_or(EBADF)
    }

    fn retain_fd_entry_resources(entry: &FdEntry) {
        if let FdEntry::Pipe { pipe, end, .. } = entry {
            if let Ok(mut state) = pipe.state.lock() {
                match end {
                    PipeEnd::Read => state.readers = state.readers.saturating_add(1),
                    PipeEnd::Write => state.writers = state.writers.saturating_add(1),
                }
                pipe.ready.notify_all();
            }
        }
    }

    fn release_fd_entry_resources(entry: &FdEntry) {
        if let FdEntry::Pipe { pipe, end, .. } = entry {
            if let Ok(mut state) = pipe.state.lock() {
                match end {
                    PipeEnd::Read => state.readers = state.readers.saturating_sub(1),
                    PipeEnd::Write => state.writers = state.writers.saturating_sub(1),
                }
                pipe.ready.notify_all();
            }
        }
    }

    fn close_fd(&mut self, fd: i32) -> i32 {
        let Ok(index) = usize::try_from(fd) else {
            return EBADF;
        };
        if index >= self.fds.len() || self.fds[index].is_none() {
            return EBADF;
        }
        self.release_advisory_locks_for_fd(fd);
        let mut invalidate_path = None;
        if let Some(FdEntry::File {
            path,
            host_path: Some(host_path),
            data,
            dirty: true,
            ..
        }) = self.fds[index].as_ref()
        {
            if fs::write(host_path, data).is_err() {
                return EINVAL;
            }
            invalidate_path = Some(path.clone());
        }
        let closed_socket_id = match self.fds[index].as_ref() {
            Some(FdEntry::Socket { socket_id }) => Some(*socket_id),
            _ => None,
        };
        if let Some(entry) = self.fds[index].as_ref() {
            Self::release_fd_entry_resources(entry);
        }
        self.fds[index] = None;
        if let Some(socket_id) = closed_socket_id {
            let still_open = self.fds.iter().flatten().any(
                |entry| matches!(entry, FdEntry::Socket { socket_id: id } if *id == socket_id),
            );
            if !still_open {
                self.sockets.remove(&socket_id);
            }
        }
        if let Some(path) = invalidate_path {
            self.invalidate_host_cache_path(&path);
        }
        0
    }

    fn flush_fd(&mut self, fd: i32) -> i32 {
        let socket_id = match self.get_fd(fd) {
            Ok(FdEntry::Socket { socket_id }) => Some(*socket_id),
            _ => None,
        };
        if let Some(socket_id) = socket_id {
            return match self.sockets.get_mut(&socket_id) {
                Some(socket) => match socket.stream.as_mut() {
                    Some(stream) => stream.flush().map_or(EINVAL, |_| 0),
                    None => 0,
                },
                None => EBADF,
            };
        }

        let mut invalidate_path = None;
        let result = match self.get_fd_mut(fd) {
            Ok(FdEntry::File {
                path,
                host_path: Some(host_path),
                data,
                dirty,
                ..
            }) => {
                if !*dirty {
                    return 0;
                }
                match fs::write(host_path, data) {
                    Ok(_) => {
                        *dirty = false;
                        invalidate_path = Some(path.clone());
                        0
                    }
                    Err(_) => EINVAL,
                }
            }
            Ok(FdEntry::File {
                host_path: None, ..
            })
            | Ok(FdEntry::HostReadFile { .. })
            | Ok(FdEntry::InternalReadFile { .. })
            | Ok(FdEntry::Stdout)
            | Ok(FdEntry::Stderr)
            | Ok(FdEntry::RequestStdout)
            | Ok(FdEntry::RequestStderr)
            | Ok(FdEntry::RequestHeaders)
            | Ok(FdEntry::Random)
            | Ok(FdEntry::Pipe { .. }) => 0,
            Ok(FdEntry::Directory { .. }) => EINVAL,
            Ok(FdEntry::Stdin) => EBADF,
            Ok(FdEntry::Socket { .. }) => unreachable!(),
            Err(errno) => errno,
        };
        if let Some(path) = invalidate_path {
            self.invalidate_host_cache_path(&path);
        }
        result
    }

    fn truncate_fd(&mut self, fd: i32, length: i64) -> i32 {
        let Ok(length) = usize::try_from(length) else {
            return -EINVAL;
        };
        let mut invalidate_path = None;
        let result = match self.get_fd_mut(fd) {
            Ok(FdEntry::File {
                path,
                data,
                host_path,
                position,
                access_mode,
                dirty,
                ..
            }) => {
                if !file_descriptor_allows_write(*access_mode) {
                    return -EBADF;
                }
                *position = (*position).min(length);
                if let Some(host_path) = host_path {
                    let Ok(file) = fs::OpenOptions::new().write(true).open(host_path) else {
                        return -EINVAL;
                    };
                    if file.set_len(length as u64).is_err() {
                        return -EINVAL;
                    }
                    data.clear();
                    *dirty = false;
                    invalidate_path = Some(path.clone());
                } else {
                    data.resize(length, 0);
                    *dirty = true;
                }
                0
            }
            Ok(FdEntry::HostReadFile { .. }) | Ok(FdEntry::InternalReadFile { .. }) => -EBADF,
            Ok(_) => -EINVAL,
            Err(errno) => -errno,
        };
        if result == 0 {
            if let Some(path) = invalidate_path {
                self.invalidate_host_cache_path(&path);
            }
        }
        result
    }

    fn fallocate_fd(&mut self, fd: i32, mode: i32, offset: i64, length: i64) -> i32 {
        if mode != 0 {
            return -EINVAL;
        }
        let Ok(offset) = usize::try_from(offset) else {
            return -EINVAL;
        };
        let Ok(length) = usize::try_from(length) else {
            return -EINVAL;
        };
        let Some(end) = offset.checked_add(length) else {
            return -EINVAL;
        };
        let mut invalidate_path = None;
        let result = match self.get_fd_mut(fd) {
            Ok(FdEntry::File {
                path,
                data,
                host_path,
                access_mode,
                dirty,
                ..
            }) => {
                if !file_descriptor_allows_write(*access_mode) {
                    return -EBADF;
                }
                if let Some(host_path) = host_path {
                    match fs::metadata(&*host_path) {
                        Ok(metadata) if metadata.len() < end as u64 => {
                            let Ok(file) = fs::OpenOptions::new().write(true).open(&*host_path)
                            else {
                                return -EINVAL;
                            };
                            if file.set_len(end as u64).is_err() {
                                return -EINVAL;
                            }
                            invalidate_path = Some(path.clone());
                        }
                        Ok(_) => {}
                        Err(_) => return -EINVAL,
                    }
                    data.clear();
                    *dirty = false;
                } else if data.len() < end {
                    data.resize(end, 0);
                    *dirty = true;
                }
                0
            }
            Ok(FdEntry::HostReadFile { .. }) | Ok(FdEntry::InternalReadFile { .. }) => -EBADF,
            Ok(_) => -EINVAL,
            Err(errno) => -errno,
        };
        if result == 0 {
            if let Some(path) = invalidate_path {
                self.invalidate_host_cache_path(&path);
            }
        }
        result
    }

    fn advisory_lock_path_for_fd(&self, fd: i32) -> std::result::Result<Option<PathBuf>, i32> {
        match self.get_fd(fd)? {
            FdEntry::File {
                host_path: Some(host_path),
                ..
            } => Ok(Some(canonical_lock_path(host_path))),
            FdEntry::HostReadFile { host_path, .. } => Ok(Some(canonical_lock_path(host_path))),
            FdEntry::File {
                host_path: None, ..
            } => Ok(None),
            FdEntry::InternalReadFile { .. } => Ok(None),
            _ => Err(EBADF),
        }
    }

    fn file_position_and_len_for_fd(&self, fd: i32) -> std::result::Result<(u64, u64), i32> {
        match self.get_fd(fd)? {
            FdEntry::File {
                data,
                host_path,
                position,
                ..
            } => {
                let len = host_path
                    .as_ref()
                    .and_then(|path| fs::metadata(path).ok().map(|metadata| metadata.len()))
                    .unwrap_or(data.len() as u64);
                Ok((*position as u64, len))
            }
            FdEntry::HostReadFile {
                host_path,
                position,
                ..
            } => {
                let len = fs::metadata(host_path)
                    .ok()
                    .map(|metadata| metadata.len())
                    .unwrap_or(0);
                Ok((*position as u64, len))
            }
            FdEntry::InternalReadFile { data, position, .. } => {
                Ok((*position as u64, data.len() as u64))
            }
            _ => Err(EBADF),
        }
    }

    fn check_advisory_lock_params(&self, fd: i32, lock_type: u16) -> i32 {
        let access_mode = match self.get_fd(fd) {
            Ok(FdEntry::File { access_mode, .. }) => *access_mode,
            Ok(FdEntry::HostReadFile { .. }) | Ok(FdEntry::InternalReadFile { .. }) => 0,
            Ok(_) => return EBADF,
            Err(errno) => return errno,
        };
        if !matches!(lock_type, F_RDLCK | F_WRLCK | F_UNLCK) {
            return EINVAL;
        }
        if lock_type == F_WRLCK && access_mode == 0 {
            return EBADF;
        }
        if lock_type == F_RDLCK && access_mode == O_WRONLY {
            return EBADF;
        }
        0
    }

    fn resolve_advisory_lock_range(
        &self,
        fd: i32,
        request: FcntlLockRequest,
    ) -> std::result::Result<AdvisoryLockRange, i32> {
        let (position, len) = self.file_position_and_len_for_fd(fd)?;
        let base = match request.whence {
            SEEK_SET => 0i128,
            SEEK_CUR => position as i128,
            SEEK_END => len as i128,
            _ => return Err(EINVAL),
        };
        let start = base.checked_add(request.start as i128).ok_or(EINVAL)?;
        if start < 0 {
            return Err(EINVAL);
        }
        if request.len == 0 {
            return Ok(AdvisoryLockRange {
                start: start as u64,
                end: MAX_LOCK_OFFSET,
            });
        }

        let end = start.checked_add(request.len as i128).ok_or(EINVAL)?;
        if end < 0 {
            return Err(EINVAL);
        }
        let start = start as u64;
        let end = end as u64;
        Ok(if start <= end {
            AdvisoryLockRange {
                start,
                end: end.min(MAX_LOCK_OFFSET),
            }
        } else {
            AdvisoryLockRange {
                start: end,
                end: start.min(MAX_LOCK_OFFSET),
            }
        })
    }

    fn set_advisory_lock(&self, fd: i32, lock_type: u16) -> i32 {
        let path = match self.advisory_lock_path_for_fd(fd) {
            Ok(Some(path)) => path,
            Ok(None) => return 0,
            Err(errno) => return errno,
        };
        let params_errno = self.check_advisory_lock_params(fd, lock_type);
        if params_errno != 0 {
            return params_errno;
        }

        let mut locks = match advisory_locks().lock() {
            Ok(locks) => locks,
            Err(_) => return EINVAL,
        };
        let path_locks = locks.entry(path.clone()).or_default();
        if lock_type != F_UNLCK
            && path_locks
                .iter()
                .any(|lock| whole_file_lock_conflicts(lock, self.lock_owner_id, fd, lock_type))
        {
            return EAGAIN;
        }

        path_locks.retain(|lock| {
            if lock.owner_id != self.lock_owner_id
                || !matches!(lock.scope, AdvisoryLockScope::WholeFile)
            {
                return true;
            }
            match lock_type {
                F_UNLCK => lock.fd != fd,
                F_WRLCK => false,
                F_RDLCK => lock.fd != fd && lock.lock_type != F_WRLCK,
                _ => true,
            }
        });
        if lock_type != F_UNLCK {
            path_locks.push(AdvisoryLock {
                owner_id: self.lock_owner_id,
                fd,
                lock_type,
                scope: AdvisoryLockScope::WholeFile,
            });
        }
        if path_locks.is_empty() {
            locks.remove(&path);
        }
        0
    }

    fn set_advisory_lock_blocking(&self, fd: i32, lock_type: u16) -> i32 {
        loop {
            let errno = self.set_advisory_lock(fd, lock_type);
            if errno != EAGAIN {
                return errno;
            }
            thread::sleep(Duration::from_millis(5));
        }
    }

    fn set_advisory_range_lock(
        &self,
        fd: i32,
        request: FcntlLockRequest,
        wait_for_lock: bool,
    ) -> i32 {
        if wait_for_lock {
            loop {
                let errno = self.set_advisory_range_lock(fd, request, false);
                if errno != EAGAIN {
                    return errno;
                }
                thread::sleep(Duration::from_millis(5));
            }
        }

        let path = match self.advisory_lock_path_for_fd(fd) {
            Ok(Some(path)) => path,
            Ok(None) => return 0,
            Err(errno) => return errno,
        };
        let params_errno = self.check_advisory_lock_params(fd, request.lock_type);
        if params_errno != 0 {
            return params_errno;
        }
        let range = match self.resolve_advisory_lock_range(fd, request) {
            Ok(range) => range,
            Err(errno) => return errno,
        };

        let mut locks = match advisory_locks().lock() {
            Ok(locks) => locks,
            Err(_) => return EINVAL,
        };
        let path_locks = locks.entry(path.clone()).or_default();

        if request.lock_type == F_UNLCK {
            let mut next_locks = Vec::with_capacity(path_locks.len());
            for lock in path_locks.drain(..) {
                let AdvisoryLockScope::Range(existing_range) = lock.scope else {
                    next_locks.push(lock);
                    continue;
                };
                if lock.owner_id != self.lock_owner_id
                    || !lock_ranges_overlap(existing_range, range)
                {
                    next_locks.push(lock);
                    continue;
                }
                if existing_range.start < range.start {
                    next_locks.push(AdvisoryLock {
                        scope: AdvisoryLockScope::Range(AdvisoryLockRange {
                            start: existing_range.start,
                            end: range.start,
                        }),
                        ..lock.clone()
                    });
                }
                if existing_range.end > range.end {
                    next_locks.push(AdvisoryLock {
                        scope: AdvisoryLockScope::Range(AdvisoryLockRange {
                            start: range.end,
                            end: existing_range.end,
                        }),
                        ..lock
                    });
                }
            }
            *path_locks = next_locks;
            if path_locks.is_empty() {
                locks.remove(&path);
            }
            return 0;
        }

        if path_locks
            .iter()
            .any(|lock| range_lock_conflicts(lock, self.lock_owner_id, request.lock_type, range))
        {
            return EAGAIN;
        }

        let mut merged_range = range;
        path_locks.retain(|lock| {
            let AdvisoryLockScope::Range(existing_range) = lock.scope else {
                return true;
            };
            if lock.owner_id == self.lock_owner_id && lock_ranges_overlap(existing_range, range) {
                merged_range.start = merged_range.start.min(existing_range.start);
                merged_range.end = merged_range.end.max(existing_range.end);
                false
            } else {
                true
            }
        });
        path_locks.push(AdvisoryLock {
            owner_id: self.lock_owner_id,
            fd,
            lock_type: request.lock_type,
            scope: AdvisoryLockScope::Range(merged_range),
        });
        0
    }

    fn flock_fd(&self, fd: i32, operation: i32) -> i32 {
        let nonblocking = operation & LOCK_NB != 0;
        let operation = operation & !LOCK_NB;
        let lock_type = match operation {
            LOCK_SH => F_RDLCK,
            LOCK_EX => F_WRLCK,
            LOCK_UN => F_UNLCK,
            _ => return EINVAL,
        };
        if nonblocking {
            self.set_advisory_lock(fd, lock_type)
        } else {
            self.set_advisory_lock_blocking(fd, lock_type)
        }
    }

    fn conflicting_advisory_lock(
        &self,
        fd: i32,
        request: FcntlLockRequest,
    ) -> Option<AdvisoryLock> {
        let path = match self.advisory_lock_path_for_fd(fd) {
            Ok(Some(path)) => path,
            _ => return None,
        };
        if !matches!(request.lock_type, F_RDLCK | F_WRLCK) {
            return None;
        }
        let range = self.resolve_advisory_lock_range(fd, request).ok()?;
        let Ok(locks) = advisory_locks().lock() else {
            return None;
        };
        locks
            .get(&path)
            .and_then(|path_locks| {
                path_locks.iter().find(|lock| {
                    range_lock_conflicts(lock, self.lock_owner_id, request.lock_type, range)
                })
            })
            .cloned()
    }

    #[cfg(test)]
    fn conflicting_advisory_lock_type(&self, fd: i32, requested_type: u16) -> u16 {
        self.conflicting_advisory_lock(
            fd,
            FcntlLockRequest {
                lock_type: requested_type,
                whence: SEEK_SET,
                start: 0,
                len: 0,
            },
        )
        .map(|lock| lock.lock_type)
        .unwrap_or(F_UNLCK)
    }

    fn release_advisory_locks_for_fd(&self, fd: i32) {
        let target_path = self.advisory_lock_path_for_fd(fd).ok().flatten();
        let Ok(mut locks) = advisory_locks().lock() else {
            return;
        };
        locks.retain(|path, path_locks| {
            path_locks.retain(|lock| {
                if lock.owner_id != self.lock_owner_id {
                    return true;
                }
                match lock.scope {
                    AdvisoryLockScope::WholeFile => lock.fd != fd,
                    AdvisoryLockScope::Range(_) => target_path.as_ref() != Some(path),
                }
            });
            !path_locks.is_empty()
        });
    }

    fn release_all_advisory_locks(&self) {
        let Ok(mut locks) = advisory_locks().lock() else {
            return;
        };
        locks.retain(|_, path_locks| {
            path_locks.retain(|lock| lock.owner_id != self.lock_owner_id);
            !path_locks.is_empty()
        });
    }

    fn dup_fd(&mut self, fd: i32) -> i32 {
        match self.get_fd(fd).cloned() {
            Ok(entry) => {
                Self::retain_fd_entry_resources(&entry);
                self.alloc_fd(entry)
            }
            Err(errno) => -errno,
        }
    }

    fn dup_fd_to(&mut self, fd: i32, new_fd: i32) -> i32 {
        if fd == new_fd {
            return -EINVAL;
        }
        let entry = match self.get_fd(fd).cloned() {
            Ok(entry) => entry,
            Err(errno) => return -errno,
        };
        let Ok(index) = usize::try_from(new_fd) else {
            return -EBADF;
        };
        if self.fds.len() <= index {
            self.fds.resize_with(index + 1, || None);
        }
        if let Some(old_entry) = self.fds[index].as_ref() {
            Self::release_fd_entry_resources(old_entry);
        }
        Self::retain_fd_entry_resources(&entry);
        self.fds[index] = Some(entry);
        new_fd
    }

    fn socket_id_for_fd(&self, fd: i32) -> std::result::Result<i32, i32> {
        match self.get_fd(fd)? {
            FdEntry::Socket { socket_id } => Ok(*socket_id),
            _ => Err(EBADF),
        }
    }

    fn create_pipe(&mut self) -> (i32, i32) {
        let pipe = Arc::new(PipeShared {
            state: Mutex::new(PipeState {
                buffer: VecDeque::new(),
                readers: 1,
                writers: 1,
            }),
            ready: Condvar::new(),
        });
        let read_fd = self.alloc_fd(FdEntry::Pipe {
            pipe: pipe.clone(),
            end: PipeEnd::Read,
            nonblocking: false,
        });
        let write_fd = self.alloc_fd(FdEntry::Pipe {
            pipe,
            end: PipeEnd::Write,
            nonblocking: false,
        });
        (read_fd, write_fd)
    }

    fn pipe_endpoint_for_fd(
        &mut self,
        fd: i32,
        expected_end: PipeEnd,
    ) -> std::result::Result<PipeEndpoint, i32> {
        let (pipe, end) = match self.get_fd(fd)? {
            FdEntry::Pipe { pipe, end, .. } => (pipe.clone(), *end),
            _ => return Err(EBADF),
        };
        if end != expected_end {
            return Err(EBADF);
        }
        Self::retain_fd_entry_resources(self.get_fd(fd)?);
        Ok(PipeEndpoint { pipe, end })
    }

    fn prepare_process_stdio(
        &mut self,
        descriptors: &[ProcessDescriptor],
    ) -> std::result::Result<PreparedProcessStdio, i32> {
        let mut prepared = PreparedProcessStdio {
            stdin: None,
            stdout: None,
            stderr: None,
        };
        let mut child_fds = Vec::new();

        for descriptor in descriptors {
            if !matches!(descriptor.target_fd, 0..=2) {
                return Err(EINVAL);
            }
            if descriptor.parent_fd < 0 {
                return Err(EINVAL);
            }
            match descriptor.target_fd {
                0 => {
                    prepared.stdin =
                        Some(self.pipe_endpoint_for_fd(descriptor.child_fd, PipeEnd::Read)?);
                }
                1 => {
                    prepared.stdout =
                        Some(self.pipe_endpoint_for_fd(descriptor.child_fd, PipeEnd::Write)?);
                }
                2 => {
                    prepared.stderr =
                        Some(self.pipe_endpoint_for_fd(descriptor.child_fd, PipeEnd::Write)?);
                }
                _ => unreachable!(),
            }
            child_fds.push(descriptor.child_fd);
        }

        for fd in child_fds {
            let _ = self.close_fd(fd);
        }

        Ok(prepared)
    }

    fn resolve_process_executable(&self, command: &str) -> std::result::Result<PathBuf, i32> {
        if command.is_empty() {
            return Err(EINVAL);
        }
        if self.options.process_policy.allowed_commands.is_empty() {
            return Err(ENOSYS);
        }
        self.options
            .process_policy
            .allowed_commands
            .iter()
            .find(|allowed| allowed.command == command)
            .map(|allowed| allowed.executable.clone())
            .ok_or(EACCES)
    }

    fn resolve_process_cwd(&self, cwd: Option<&str>) -> std::result::Result<Option<PathBuf>, i32> {
        let Some(cwd) = cwd else {
            return Ok(None);
        };
        if cwd.is_empty() {
            return Ok(None);
        }
        let path = self.resolve_host_path(cwd).ok_or(EACCES)?;
        if path.is_dir() {
            Ok(Some(path))
        } else {
            Err(ENOTDIR)
        }
    }

    fn spawn_process(
        &mut self,
        command: &str,
        args: &[String],
        descriptors: &[ProcessDescriptor],
        cwd: Option<&str>,
        env: Option<&[(String, String)]>,
    ) -> std::result::Result<i32, i32> {
        let executable = self.resolve_process_executable(command)?;
        let cwd = self.resolve_process_cwd(cwd)?;
        let prepared = self.prepare_process_stdio(descriptors)?;

        let mut process = Command::new(executable);
        process.args(args);
        process.stdin(if prepared.stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        });
        process.stdout(if prepared.stdout.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        });
        process.stderr(if prepared.stderr.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        });
        process.env_clear();
        if let Some(cwd) = cwd {
            process.current_dir(cwd);
        }
        if let Some(env) = env {
            for (key, value) in env {
                process.env(key, value);
            }
        }

        let mut child = process
            .spawn()
            .map_err(|error| process_error_errno(&error))?;

        if let (Some(endpoint), Some(stdin)) = (prepared.stdin, child.stdin.take()) {
            thread::spawn(move || pump_pipe_to_child_stdin(endpoint, stdin));
        }
        if let (Some(endpoint), Some(stdout)) = (prepared.stdout, child.stdout.take()) {
            thread::spawn(move || pump_child_output_to_pipe(stdout, endpoint));
        }
        if let (Some(endpoint), Some(stderr)) = (prepared.stderr, child.stderr.take()) {
            thread::spawn(move || pump_child_output_to_pipe(stderr, endpoint));
        }

        let pid = self.next_process_id;
        self.next_process_id = self.next_process_id.saturating_add(1);
        self.processes.insert(
            pid,
            ProcessEntry {
                child,
                exit_code: None,
            },
        );
        Ok(pid)
    }

    fn process_status(&mut self, pid: i32) -> std::result::Result<Option<i32>, i32> {
        let process = self.processes.get_mut(&pid).ok_or(ESRCH)?;
        if let Some(exit_code) = process.exit_code {
            return Ok(Some(exit_code));
        }
        match process.child.try_wait() {
            Ok(Some(status)) => {
                let exit_code = status.code().unwrap_or(1);
                process.exit_code = Some(exit_code);
                Ok(Some(exit_code))
            }
            Ok(None) => Ok(None),
            Err(error) => Err(process_error_errno(&error)),
        }
    }

    fn wait_process(&mut self, pid: i32) -> std::result::Result<i32, i32> {
        let process = self.processes.get_mut(&pid).ok_or(ESRCH)?;
        if let Some(exit_code) = process.exit_code {
            return Ok(exit_code);
        }
        let status = process
            .child
            .wait()
            .map_err(|error| process_error_errno(&error))?;
        let exit_code = status.code().unwrap_or(1);
        process.exit_code = Some(exit_code);
        Ok(exit_code)
    }

    fn run_popen_command(
        &mut self,
        command: &str,
        mode: &str,
    ) -> std::result::Result<(String, i32), i32> {
        if !mode.starts_with('r') {
            return Err(EINVAL);
        }
        let (command, args) = split_simple_process_command(command)?;
        let executable = self.resolve_process_executable(&command)?;
        let output = Command::new(executable)
            .args(args)
            .stdin(Stdio::null())
            .output()
            .map_err(|error| process_error_errno(&error))?;
        if output.stdout.len() > self.options.process_policy.max_popen_output_bytes {
            return Err(EINVAL);
        }
        let path = format!("/tmp/popen-output-{}", self.next_popen_file_id);
        self.next_popen_file_id = self.next_popen_file_id.saturating_add(1);
        self.internal_files
            .insert(path.clone(), output.stdout.into());
        Ok((path, output.status.code().unwrap_or(1)))
    }

    fn get_socket(&self, fd: i32) -> std::result::Result<&SocketEntry, i32> {
        let socket_id = self.socket_id_for_fd(fd)?;
        self.sockets.get(&socket_id).ok_or(EBADF)
    }

    fn get_socket_mut(&mut self, fd: i32) -> std::result::Result<&mut SocketEntry, i32> {
        let socket_id = self.socket_id_for_fd(fd)?;
        self.sockets.get_mut(&socket_id).ok_or(EBADF)
    }

    fn create_socket(&mut self, domain: i32, socket_type: i32, protocol: i32) -> i32 {
        if domain != AF_INET && domain != AF_INET6 {
            return -EAFNOSUPPORT;
        }
        let nonblocking = socket_type & O_NONBLOCK != 0;
        let socket_type = socket_type & SOCK_TYPE_MASK;
        if socket_type != SOCK_STREAM && socket_type != SOCK_DGRAM {
            return -EINVAL;
        }
        if socket_type == SOCK_STREAM && protocol != 0 && protocol != IPPROTO_TCP {
            return -EPROTONOSUPPORT;
        }

        let socket_id = self.next_socket_id;
        self.next_socket_id = self.next_socket_id.saturating_add(1);
        let fd = self.alloc_fd(FdEntry::Socket { socket_id });
        self.sockets.insert(
            socket_id,
            SocketEntry {
                domain,
                socket_type,
                stream: None,
                server: None,
                pending_connect: None,
                peer: None,
                local: None,
                error: 0,
                nonblocking,
                receive_timeout: Some(DEFAULT_SOCKET_TIMEOUT),
                send_timeout: Some(DEFAULT_SOCKET_TIMEOUT),
            },
        );
        fd
    }

    fn status_flags(&self, fd: i32) -> std::result::Result<i32, i32> {
        match self.get_fd(fd)? {
            FdEntry::File {
                access_mode,
                append,
                nonblocking,
                ..
            } => {
                let mut flags = *access_mode & O_ACCMODE;
                if *append {
                    flags |= O_APPEND;
                }
                if *nonblocking {
                    flags |= O_NONBLOCK;
                }
                Ok(flags)
            }
            FdEntry::HostReadFile {
                append,
                nonblocking,
                ..
            } => {
                let mut flags = 0;
                if *append {
                    flags |= O_APPEND;
                }
                if *nonblocking {
                    flags |= O_NONBLOCK;
                }
                Ok(flags)
            }
            FdEntry::InternalReadFile {
                append,
                nonblocking,
                ..
            } => {
                let mut flags = 0;
                if *append {
                    flags |= O_APPEND;
                }
                if *nonblocking {
                    flags |= O_NONBLOCK;
                }
                Ok(flags)
            }
            FdEntry::Socket { socket_id } => {
                let socket = self.sockets.get(socket_id).ok_or(EBADF)?;
                Ok(if socket.nonblocking { O_NONBLOCK } else { 0 })
            }
            FdEntry::Pipe { nonblocking, .. } => Ok(if *nonblocking { O_NONBLOCK } else { 0 }),
            _ => Ok(0),
        }
    }

    fn set_status_flags(&mut self, fd: i32, flags: i32) -> i32 {
        let append = flags & O_APPEND != 0;
        let nonblocking = flags & O_NONBLOCK != 0;
        match self.get_fd_mut(fd) {
            Ok(FdEntry::File {
                append: current_append,
                nonblocking: current_nonblocking,
                ..
            }) => {
                *current_append = append;
                *current_nonblocking = nonblocking;
                0
            }
            Ok(FdEntry::HostReadFile {
                append: current_append,
                nonblocking: current_nonblocking,
                ..
            }) => {
                *current_append = append;
                *current_nonblocking = nonblocking;
                0
            }
            Ok(FdEntry::InternalReadFile {
                append: current_append,
                nonblocking: current_nonblocking,
                ..
            }) => {
                *current_append = append;
                *current_nonblocking = nonblocking;
                0
            }
            Ok(FdEntry::Socket { socket_id }) => {
                let socket_id = *socket_id;
                let Some(socket) = self.sockets.get_mut(&socket_id) else {
                    return EBADF;
                };
                socket.nonblocking = nonblocking;
                if let Some(stream) = socket.stream.as_ref() {
                    if stream.set_nonblocking(nonblocking).is_err() {
                        return EINVAL;
                    }
                    if !nonblocking {
                        let _ = stream.set_read_timeout(socket.receive_timeout);
                        let _ = stream.set_write_timeout(socket.send_timeout);
                    }
                }
                if let Some(server) = socket.server.as_ref() {
                    if server.socket.set_nonblocking(nonblocking).is_err() {
                        return EINVAL;
                    }
                }
                0
            }
            Ok(FdEntry::Pipe {
                nonblocking: current_nonblocking,
                ..
            }) => {
                *current_nonblocking = nonblocking;
                0
            }
            Ok(_) => 0,
            Err(errno) => errno,
        }
    }

    fn finish_pending_connect(&mut self, fd: i32) -> std::result::Result<bool, i32> {
        let socket = self.get_socket_mut(fd)?;
        let Some(pending) = socket.pending_connect.as_mut() else {
            return Ok(true);
        };
        let completion = check_pending_connect_completion(pending, Some(Duration::ZERO))?;
        match completion {
            PendingConnectCompletion::Pending => Ok(false),
            PendingConnectCompletion::Connected => {
                let pending = socket.pending_connect.take().ok_or(EINVAL)?;
                let stream = TcpStream::from(pending.stream);
                let _ = stream.set_read_timeout(socket.receive_timeout);
                let _ = stream.set_write_timeout(socket.send_timeout);
                let _ = stream.set_nodelay(true);
                let _ = stream.set_nonblocking(socket.nonblocking);
                socket.local = stream.local_addr().ok();
                socket.peer = Some(pending.peer);
                socket.error = 0;
                socket.stream = Some(stream);
                Ok(true)
            }
            PendingConnectCompletion::Failed(errno) => {
                socket.pending_connect = None;
                socket.error = errno;
                Ok(true)
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PendingConnectCompletion {
    Pending,
    Connected,
    Failed(i32),
}

fn check_pending_connect_completion(
    pending: &mut PendingConnect,
    timeout: Option<Duration>,
) -> std::result::Result<PendingConnectCompletion, i32> {
    if let Some(error) = pending.stream.take_error().map_err(|_| EINVAL)? {
        return Ok(PendingConnectCompletion::Failed(pending_connect_errno(
            &error,
        )));
    }

    let mut poll = MioPoll::new().map_err(|_| EINVAL)?;
    let mut events = Events::with_capacity(4);
    poll.registry()
        .register(
            &mut pending.stream,
            Token(0),
            Interest::READABLE | Interest::WRITABLE,
        )
        .map_err(|_| EINVAL)?;
    let poll_result = poll.poll(&mut events, timeout);
    let _ = poll.registry().deregister(&mut pending.stream);
    poll_result.map_err(|_| EINVAL)?;
    if events.is_empty() {
        return Ok(PendingConnectCompletion::Pending);
    }

    if let Some(error) = pending.stream.take_error().map_err(|_| EINVAL)? {
        return Ok(PendingConnectCompletion::Failed(pending_connect_errno(
            &error,
        )));
    }
    match pending.stream.peer_addr() {
        Ok(_) => Ok(PendingConnectCompletion::Connected),
        Err(error) if connection_still_pending(&error) => Ok(PendingConnectCompletion::Pending),
        Err(error) => Ok(PendingConnectCompletion::Failed(pending_connect_errno(
            &error,
        ))),
    }
}

fn pending_connect_errno(error: &io::Error) -> i32 {
    #[cfg(windows)]
    if matches!(error.raw_os_error(), Some(10057)) {
        return ECONNREFUSED;
    }

    io_error_errno(error)
}

fn connection_still_pending(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::WouldBlock | io::ErrorKind::NotConnected
    ) || matches!(
        error.raw_os_error(),
        Some(26) | Some(35) | Some(36) | Some(10035) | Some(10036) | Some(10037)
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StubbedImport {
    pub module: String,
    pub name: String,
    pub ty: String,
    pub classification: ImportClassification,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportClassification {
    NativeHost,
    RuntimeGlue,
    IntentionalTrap,
    IntentionalUnsupported,
    IntentionalNoop,
    KnownGapDefault,
    SyntheticGlobal,
    UnknownDefault,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportExternKind {
    Func,
    Global,
    Other,
}

pub struct StubImportLinker {
    pub linker: Linker<HostState>,
    pub store: Store<HostState>,
    pub imports: Vec<StubbedImport>,
    got_func_globals: HashMap<String, Global>,
    uses_wasmtime_async: bool,
}

impl StubImportLinker {
    pub fn instantiate(&mut self, module: &Module) -> Result<wasmtime::Instance> {
        let instance = if self.uses_wasmtime_async {
            block_on(self.linker.instantiate_async(&mut self.store, module))
        } else {
            self.linker.instantiate(&mut self.store, module)
        }
        .map_err(|error| CliError::new(format!("Failed to instantiate wasm module: {error}")))?;
        self.patch_got_func_exit(&instance)?;
        Ok(instance)
    }

    pub fn uses_wasmtime_async(&self) -> bool {
        self.uses_wasmtime_async
    }

    fn patch_got_func_exit(&mut self, instance: &wasmtime::Instance) -> Result<()> {
        let Some(global) = self.got_func_globals.get("exit").copied() else {
            return Ok(());
        };
        let Ok(exit_extern) = self.linker.get(&mut self.store, "env", "exit") else {
            return Ok(());
        };
        let exit_func = exit_extern
            .into_func()
            .ok_or_else(|| CliError::new("env.exit import is not a function"))?;
        let table = instance
            .get_table(&mut self.store, "__indirect_function_table")
            .ok_or_else(|| CliError::new("Missing __indirect_function_table export"))?;
        let slot = table
            .grow(&mut self.store, 1, Ref::Func(None))
            .map_err(|error| CliError::new(format!("Failed to grow function table: {error}")))?;
        table
            .set(&mut self.store, slot, Ref::Func(Some(exit_func)))
            .map_err(|error| {
                CliError::new(format!("Failed to patch env.exit table slot: {error}"))
            })?;
        global
            .set(&mut self.store, Val::I32(slot as i32))
            .map_err(|error| CliError::new(format!("Failed to patch GOT.func.exit: {error}")))?;
        Ok(())
    }
}

pub fn create_stub_import_linker(module: &Module) -> Result<StubImportLinker> {
    create_stub_import_linker_with_options(module, HostOptions::default())
}

pub fn create_stub_import_linker_with_options(
    module: &Module,
    options: HostOptions,
) -> Result<StubImportLinker> {
    let engine = module.engine();
    let php_runtime = options.php_runtime;
    let uses_wasmtime_async = php_runtime.uses_wasmtime_async();
    let retain_import_metadata = options.capture_import_trace || options.max_import_calls.is_some();
    let mut store = Store::new(engine, HostState::new(options));
    let mut linker = Linker::new(engine);
    let mut imports = Vec::new();
    let mut got_func_globals = HashMap::new();

    for import in module.imports() {
        let module_name = import.module().to_string();
        let import_name = import.name().to_string();
        let import_label = format!("{module_name}.{import_name}");
        let ty = import.ty();
        let ty_description = format!("{ty:?}");

        match ty {
            ExternType::Func(func_ty) => {
                let classification;
                if define_special_func_import(
                    &mut linker,
                    &module_name,
                    &import_name,
                    &import_label,
                    php_runtime,
                )? {
                    classification = classify_special_func_import(&module_name, &import_name);
                    // Defined by the native PHP host layer.
                } else if module_name == "env" && import_name.starts_with("invoke_") {
                    classification = ImportClassification::RuntimeGlue;
                    define_invoke_import(
                        &mut store,
                        &mut linker,
                        &module_name,
                        &import_name,
                        &import_label,
                        func_ty,
                    )?;
                } else {
                    classification = classify_default_func_import(&module_name, &import_name);
                    if classification == ImportClassification::UnknownDefault {
                        return Err(CliError::new(format!(
                            "Unclassified PHP wasm function import {import_label}"
                        )));
                    }
                    define_default_func_import(
                        &mut store,
                        &mut linker,
                        &module_name,
                        &import_name,
                        &import_label,
                        func_ty,
                    )?;
                }
                if retain_import_metadata {
                    imports.push(StubbedImport {
                        module: module_name,
                        name: import_name,
                        ty: ty_description,
                        classification,
                    });
                }
            }
            ExternType::Global(global_ty) => {
                let classification = classify_global_import(&module_name, &import_name);
                if classification == ImportClassification::UnknownDefault {
                    return Err(CliError::new(format!(
                        "Unclassified PHP wasm global import {import_label}"
                    )));
                }
                let value = Val::default_for_ty(global_ty.content()).ok_or_else(|| {
                    CliError::new(format!(
                        "Cannot synthesize default value for global import {import_label}"
                    ))
                })?;
                let global = Global::new(&mut store, global_ty, value).map_err(|error| {
                    CliError::new(format!("Failed to create global {import_label}: {error}"))
                })?;
                if module_name == "GOT.func" {
                    got_func_globals.insert(import_name.clone(), global);
                }
                linker
                    .define(&store, &module_name, &import_name, global)
                    .map_err(|error| {
                        CliError::new(format!("Failed to define import {import_label}: {error}"))
                    })?;
                if retain_import_metadata {
                    imports.push(StubbedImport {
                        module: module_name,
                        name: import_name,
                        ty: ty_description,
                        classification,
                    });
                }
            }
            ExternType::Table(_) | ExternType::Memory(_) | ExternType::Tag(_) => {
                return Err(CliError::new(format!(
                    "Unsupported imported extern type for {import_label}: {ty_description}"
                )));
            }
        }
    }

    Ok(StubImportLinker {
        linker,
        store,
        imports,
        got_func_globals,
        uses_wasmtime_async,
    })
}

pub fn classify_php_wasm_import(
    module_name: &str,
    import_name: &str,
    kind: ImportExternKind,
) -> ImportClassification {
    match kind {
        ImportExternKind::Func => {
            if is_special_func_import(module_name, import_name) {
                classify_special_func_import(module_name, import_name)
            } else if module_name == "env" && import_name.starts_with("invoke_") {
                ImportClassification::RuntimeGlue
            } else {
                classify_default_func_import(module_name, import_name)
            }
        }
        ImportExternKind::Global => classify_global_import(module_name, import_name),
        ImportExternKind::Other => ImportClassification::UnknownDefault,
    }
}

fn define_default_func_import(
    store: &mut Store<HostState>,
    linker: &mut Linker<HostState>,
    module_name: &str,
    import_name: &str,
    import_label: &str,
    func_ty: wasmtime::FuncType,
) -> Result<()> {
    let label = import_label.to_string();
    let module_name_for_result = module_name.to_string();
    let import_name_for_result = import_name.to_string();
    let result_types = func_ty.results().collect::<Vec<_>>();
    let func = Func::new(&mut *store, func_ty, move |mut caller, _params, results| {
        caller.data_mut().record_import(&label)?;
        if default_import_should_trap(&module_name_for_result, &import_name_for_result) {
            return Err(wasmtime::Error::msg(format!(
                "Unsupported PHP wasm import called: {label}"
            )));
        }
        for (result, ty) in results.iter_mut().zip(&result_types) {
            *result =
                default_import_result_value(&module_name_for_result, &import_name_for_result, ty)?;
        }
        Ok(())
    });
    linker
        .define(&*store, module_name, import_name, func)
        .map_err(|error| {
            CliError::new(format!("Failed to define import {import_label}: {error}"))
        })?;
    Ok(())
}

fn classify_special_func_import(module_name: &str, import_name: &str) -> ImportClassification {
    if module_name == "env"
        && matches!(
            import_name,
            "emscripten_sleep" | "emscripten_exit_with_live_runtime"
        )
    {
        ImportClassification::RuntimeGlue
    } else {
        ImportClassification::NativeHost
    }
}

fn is_special_func_import(module_name: &str, import_name: &str) -> bool {
    if module_name == "wasi_snapshot_preview1" {
        return matches!(
            import_name,
            "clock_time_get"
                | "environ_sizes_get"
                | "environ_get"
                | "fd_close"
                | "fd_fdstat_get"
                | "fd_read"
                | "fd_seek"
                | "fd_write"
                | "fd_pread"
                | "fd_pwrite"
                | "fd_sync"
                | "proc_exit"
                | "random_get"
        );
    }

    module_name == "env"
        && matches!(
            import_name,
            "js_fd_read"
                | "js_getpid"
                | "js_open_process"
                | "js_waitpid"
                | "js_process_status"
                | "js_popen_to_file"
                | "__asyncjs__js_popen_to_file"
                | "js_flock"
                | "js_release_file_locks"
                | "getaddrinfo"
                | "_emscripten_lookup_name"
                | "wasm_setsockopt"
                | "wasm_poll_socket"
                | "wasm_close"
                | "wasm_shutdown"
                | "getdtablesize"
                | "getprotobyname"
                | "getprotobynumber"
                | "emscripten_get_heap_max"
                | "emscripten_resize_heap"
                | "emscripten_get_now"
                | "emscripten_date_now"
                | "emscripten_sleep"
                | "_emscripten_throw_longjmp"
                | "exit"
                | "_tzset_js"
                | "_gmtime_js"
                | "_localtime_js"
                | "_mktime_js"
                | "__syscall_getcwd"
                | "__syscall_chdir"
                | "__syscall_chmod"
                | "__syscall_stat64"
                | "__syscall_lstat64"
                | "__syscall_newfstatat"
                | "__syscall_openat"
                | "__syscall_mkdirat"
                | "__syscall_fstat64"
                | "__syscall_fchmod"
                | "__syscall_fchown32"
                | "__syscall_fchownat"
                | "__syscall_fcntl64"
                | "__syscall_ftruncate64"
                | "__syscall_fdatasync"
                | "__syscall_fallocate"
                | "__syscall_readlinkat"
                | "__syscall_renameat"
                | "__syscall_rmdir"
                | "__syscall_symlinkat"
                | "__syscall_utimensat"
                | "__syscall_unlinkat"
                | "__syscall_faccessat"
                | "__syscall_statfs64"
                | "__syscall_getdents64"
                | "__syscall_dup"
                | "__syscall_dup3"
                | "__syscall_pipe"
                | "__syscall_socket"
                | "__syscall_connect"
                | "__syscall_bind"
                | "__syscall_listen"
                | "__syscall_accept4"
                | "__syscall_sendto"
                | "__syscall_sendmsg"
                | "__syscall_recvfrom"
                | "__syscall_getsockopt"
                | "__syscall_getsockname"
                | "__syscall_getpeername"
                | "__syscall_poll"
                | "__syscall_ioctl"
                | "getnameinfo"
                | "strptime"
                | "_mmap_js"
                | "_munmap_js"
                | "__asyncjs__wasm_poll_socket"
        )
}

fn classify_default_func_import(module_name: &str, import_name: &str) -> ImportClassification {
    if default_import_should_trap(module_name, import_name) {
        return ImportClassification::IntentionalTrap;
    }

    if module_name == "env"
        && matches!(
            import_name,
            "_dlopen_js" | "_dlsym_js" | "_emscripten_system" | "_setitimer_js"
        )
    {
        return ImportClassification::IntentionalUnsupported;
    }

    if module_name == "env"
        && matches!(
            import_name,
            "__handle_stack_overflow"
                | "_emscripten_runtime_keepalive_clear"
                | "_tzset_js"
                | "emscripten_get_now"
                | "emscripten_get_now_is_monotonic"
                | "js_wasm_trace"
        )
    {
        return ImportClassification::IntentionalNoop;
    }

    if matches!(module_name, "GOT.func" | "GOT.mem") {
        return ImportClassification::RuntimeGlue;
    }

    ImportClassification::UnknownDefault
}

fn classify_global_import(module_name: &str, import_name: &str) -> ImportClassification {
    if matches!(module_name, "GOT.func" | "GOT.mem")
        || (module_name == "env" && matches!(import_name, "__asyncify_state" | "__asyncify_data"))
    {
        ImportClassification::SyntheticGlobal
    } else {
        ImportClassification::UnknownDefault
    }
}

fn default_import_should_trap(module_name: &str, import_name: &str) -> bool {
    module_name == "env"
        && matches!(
            import_name,
            "__assert_fail"
                | "__resumeException"
                | "__cxa_find_matching_catch_2"
                | "_abort_js"
                | "__asyncjs__js_module_onMessage"
                | "getcontext"
                | "makecontext"
                | "swapcontext"
                | "__call_sighandler"
        )
}

fn default_import_result_value(
    module_name: &str,
    import_name: &str,
    ty: &ValType,
) -> wasmtime::Result<Val> {
    if module_name == "env" && import_name == "getnameinfo" {
        return match ty {
            ValType::I32 => Ok(Val::I32(EAI_NONAME)),
            ValType::I64 => Ok(Val::I64(EAI_NONAME as i64)),
            _ => Val::default_for_ty(ty)
                .ok_or_else(|| wasmtime::Error::msg("cannot synthesize default result value")),
        };
    }

    if module_name == "env"
        && (import_name.starts_with("__syscall_")
            || matches!(import_name, "_emscripten_system" | "_setitimer_js"))
    {
        return match ty {
            ValType::I32 => Ok(Val::I32(-ENOSYS)),
            ValType::I64 => Ok(Val::I64(-(ENOSYS as i64))),
            _ => Val::default_for_ty(ty)
                .ok_or_else(|| wasmtime::Error::msg("cannot synthesize default result value")),
        };
    }

    Val::default_for_ty(ty)
        .ok_or_else(|| wasmtime::Error::msg("cannot synthesize default result value"))
}

fn profile_import_self_time_label(label: &str) -> bool {
    matches!(
        label,
        "wasi_snapshot_preview1.fd_read"
            | "wasi_snapshot_preview1.fd_seek"
            | "wasi_snapshot_preview1.fd_write"
            | "env.js_fd_read"
            | "env.js_getpid"
            | "env.emscripten_get_now"
            | "env.emscripten_date_now"
            | "env.__syscall_stat64"
            | "env.__syscall_lstat64"
            | "env.__syscall_newfstatat"
            | "env.__syscall_openat"
            | "env.__syscall_fstat64"
            | "env.__syscall_fcntl64"
            | "env.__syscall_faccessat"
    )
}

fn profile_import_inclusive_time_label(label: &str) -> bool {
    label.starts_with("env.invoke_")
}

fn profiled_import<R>(
    caller: &mut Caller<'_, HostState>,
    label: &str,
    body: impl FnOnce(&mut Caller<'_, HostState>) -> wasmtime::Result<R>,
) -> wasmtime::Result<R> {
    caller.data_mut().record_import(label)?;
    let started_at = caller
        .data()
        .should_record_import_self_time(label)
        .then(Instant::now);
    let result = body(caller);
    if let Some(started_at) = started_at {
        caller
            .data_mut()
            .record_import_self_time(label, started_at.elapsed());
    }
    result
}

fn profiled_inclusive_import<R>(
    caller: &mut Caller<'_, HostState>,
    label: &str,
    body: impl FnOnce(&mut Caller<'_, HostState>) -> wasmtime::Result<R>,
) -> wasmtime::Result<R> {
    caller.data_mut().record_import(label)?;
    let started_at = caller
        .data()
        .should_record_import_inclusive_time(label)
        .then(Instant::now);
    let result = body(caller);
    if let Some(started_at) = started_at {
        caller
            .data_mut()
            .record_import_inclusive_time(label, started_at.elapsed());
    }
    result
}

fn define_special_func_import(
    linker: &mut Linker<HostState>,
    module_name: &str,
    import_name: &str,
    import_label: &str,
    php_runtime: PhpAssetRuntime,
) -> Result<bool> {
    if module_name == "wasi_snapshot_preview1" {
        match import_name {
            "clock_time_get" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              clock_id: i32,
                              _precision: i64,
                              ptime: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            if !(0..=3).contains(&clock_id) {
                                return Ok(EINVAL);
                            }
                            write_u64(&mut caller, ptime, unix_time_ns()?)?;
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "environ_sizes_get" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              penviron_count: i32,
                              penviron_buf_size: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let env = caller.data().env.clone();
                            let size = env.iter().map(|value| value.len() + 1).sum::<usize>();
                            write_u32(&mut caller, penviron_count, env.len() as u32)?;
                            write_u32(&mut caller, penviron_buf_size, size as u32)?;
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "environ_get" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              environ: i32,
                              environ_buf: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let env = caller.data().env.clone();
                            let mut buf_offset = 0u32;
                            for (index, value) in env.iter().enumerate() {
                                let ptr = environ_buf as u32 + buf_offset;
                                write_u32(&mut caller, environ + (index as i32 * 4), ptr)?;
                                write_bytes(&mut caller, ptr as i32, value.as_bytes())?;
                                write_bytes(&mut caller, ptr as i32 + value.len() as i32, &[0])?;
                                buf_offset += value.len() as u32 + 1;
                            }
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_close" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().close_fd(fd))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_fdstat_get" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              pbuf: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let file_type = match caller.data().get_fd(fd) {
                                Ok(entry) => entry.wasi_file_type(),
                                Err(errno) => return Ok(errno),
                            };
                            write_u8(&mut caller, pbuf, file_type)?;
                            write_u16(&mut caller, pbuf + 2, 0)?;
                            write_u64(&mut caller, pbuf + 8, 0)?;
                            write_u64(&mut caller, pbuf + 16, 0)?;
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_read" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              iov: i32,
                              iovcnt: i32,
                              pnum: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                fd_read(caller, fd, iov, iovcnt, pnum)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_seek" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              offset: i64,
                              whence: i32,
                              new_offset: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                fd_seek(caller, fd, offset, whence, new_offset)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_write" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              iov: i32,
                              iovcnt: i32,
                              pnum: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                fd_write(caller, fd, iov, iovcnt, pnum)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_pread" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              iov: i32,
                              iovcnt: i32,
                              offset: i64,
                              pnum: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            fd_pread(&mut caller, fd, iov, iovcnt, offset, pnum)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_pwrite" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              iov: i32,
                              iovcnt: i32,
                              offset: i64,
                              pnum: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            fd_pwrite(&mut caller, fd, iov, iovcnt, offset, pnum)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "fd_sync" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().flush_fd(fd))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "proc_exit" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              code: i32|
                              -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            Err(wasmtime::Error::new(PhpExitStatus(code)))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "random_get" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              buffer: i32,
                              size: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let mut bytes = vec![
                                0;
                                usize::try_from(size).map_err(|_| {
                                    wasmtime::Error::msg("random_get size is negative")
                                })?
                            ];
                            getrandom::fill(&mut bytes).map_err(|error| {
                                wasmtime::Error::msg(format!("random_get failed: {error}"))
                            })?;
                            write_bytes(&mut caller, buffer, &bytes)?;
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            _ => {}
        }
    }

    if module_name == "env" {
        match import_name {
            "js_fd_read" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              iov: i32,
                              iovcnt: i32,
                              pnum: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                fd_read(caller, fd, iov, iovcnt, pnum)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_getpid" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>| {
                            profiled_import(&mut caller, &label, |caller| {
                                Ok::<i32, wasmtime::Error>(caller.data().synthetic_pid())
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_open_process" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              _command: i32,
                              _args_ptr: i32,
                              _args_length: i32,
                              _descriptors_ptr: i32,
                              _descriptors_length: i32,
                              _cwd_ptr: i32,
                              _cwd_length: i32,
                              _env_ptr: i32,
                              _env_length: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let result = js_open_process(
                                &mut caller,
                                _command,
                                _args_ptr,
                                _args_length,
                                _descriptors_ptr,
                                _descriptors_length,
                                _cwd_ptr,
                                _cwd_length,
                                _env_ptr,
                                _env_length,
                            )?;
                            Ok(result)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_process_status" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              pid: i32,
                              exit_code_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let status = caller.data_mut().process_status(pid);
                            match status {
                                Ok(Some(exit_code)) => {
                                    write_u32(&mut caller, exit_code_ptr, exit_code as u32)?;
                                    Ok(1)
                                }
                                Ok(None) => Ok(0),
                                Err(errno) => {
                                    set_errno(&mut caller, errno)?;
                                    Ok(-1)
                                }
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_waitpid" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              pid: i32,
                              exit_code_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let result = caller.data_mut().wait_process(pid);
                            match result {
                                Ok(exit_code) => {
                                    write_u32(&mut caller, exit_code_ptr, exit_code as u32)?;
                                    Ok(pid)
                                }
                                Err(errno) => {
                                    set_errno(&mut caller, errno)?;
                                    Ok(-1)
                                }
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_popen_to_file" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              command: i32,
                              mode: i32,
                              exit_code_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            js_popen_to_file(&mut caller, command, mode, exit_code_ptr)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__asyncjs__js_popen_to_file" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              command: i32,
                              mode: i32,
                              exit_code_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            js_popen_to_file(&mut caller, command, mode, exit_code_ptr)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_flock" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              operation: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let errno = caller.data().flock_fd(fd, operation);
                            Ok(if errno == 0 { 0 } else { -errno })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "js_release_file_locks" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>| -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            caller.data().release_all_advisory_locks();
                            Ok(())
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "getaddrinfo" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              node: i32,
                              service: i32,
                              hints: i32,
                              out: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            getaddrinfo(&mut caller, node, service, hints, out)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_emscripten_lookup_name" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              name: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            if name == 0 {
                                return Ok(0);
                            }
                            let name = read_c_string(&mut caller, name)?;
                            Ok(emscripten_lookup_name(&name) as i32)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "wasm_setsockopt" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              socket: i32,
                              level: i32,
                              option_name: i32,
                              option_value: i32,
                              option_len: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            wasm_setsockopt(
                                &mut caller,
                                socket,
                                level,
                                option_name,
                                option_value,
                                option_len,
                            )
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "wasm_poll_socket" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              socket: i32,
                              events: i32,
                              timeout: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(wasm_poll_socket(&mut caller, socket, events, timeout))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__asyncjs__wasm_poll_socket" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              socket: i32,
                              events: i32,
                              timeout: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(wasm_poll_socket(&mut caller, socket, events, timeout))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "wasm_close" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              socket: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().close_fd(socket))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "wasm_shutdown" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              socket: i32,
                              how: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(wasm_shutdown(&mut caller, socket, how))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "getdtablesize" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>| {
                            caller.data_mut().record_import(&label)?;
                            Ok::<i32, wasmtime::Error>(1024)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "getprotobyname" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              name_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            if name_ptr == 0 {
                                return Ok(0);
                            }
                            let name = read_c_string(&mut caller, name_ptr)?;
                            match protocol_by_name(&name) {
                                Some((name, number, aliases)) => {
                                    write_protoent(&mut caller, name, number, aliases)
                                }
                                None => Ok(0),
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "getprotobynumber" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              number: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            match protocol_by_number(number) {
                                Some((name, number, aliases)) => {
                                    write_protoent(&mut caller, name, number, aliases)
                                }
                                None => Ok(0),
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "emscripten_get_heap_max" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>| {
                            caller.data_mut().record_import(&label)?;
                            Ok::<i32, wasmtime::Error>(2147483648u32 as i32)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "emscripten_resize_heap" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              requested_size: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            emscripten_resize_heap(&mut caller, requested_size)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "emscripten_get_now" | "emscripten_date_now" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>| {
                            profiled_import(&mut caller, &label, |caller| {
                                caller.data_mut().emscripten_unix_time_ms()
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "emscripten_sleep" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              _ms: i32|
                              -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            if php_runtime.uses_wasmtime_async() {
                                emscripten_sleep_wasmtime_async(_ms);
                                Ok(())
                            } else {
                                emscripten_sleep(&mut caller)
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_emscripten_throw_longjmp" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>| -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            Err(wasmtime::Error::new(EmscriptenLongjmp))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "exit" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              code: i32|
                              -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            Err(wasmtime::Error::new(PhpExitStatus(code)))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_tzset_js" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              timezone: i32,
                              daylight: i32,
                              std_name: i32,
                              dst_name: i32|
                              -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            write_u32(&mut caller, timezone, 0)?;
                            write_u32(&mut caller, daylight, 0)?;
                            write_c_string_fixed(&mut caller, std_name, "UTC", 17)?;
                            write_c_string_fixed(&mut caller, dst_name, "UTC", 17)?;
                            Ok(())
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_gmtime_js" | "_localtime_js" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              time: i64,
                              tm_ptr: i32|
                              -> wasmtime::Result<()> {
                            caller.data_mut().record_import(&label)?;
                            write_tm_utc(&mut caller, tm_ptr, time, 0)?;
                            Ok(())
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_mktime_js" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              tm_ptr: i32|
                              -> wasmtime::Result<i64> {
                            caller.data_mut().record_import(&label)?;
                            mktime_utc(&mut caller, tm_ptr)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_getcwd" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              buf: i32,
                              size: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let cwd = caller.data().cwd.clone();
                            let bytes = cwd.as_bytes();
                            let required = bytes.len() + 1;
                            if size == 0 {
                                return Ok(-EINVAL);
                            }
                            if usize::try_from(size).unwrap_or_default() < required {
                                return Ok(-ERANGE);
                            }
                            write_bytes(&mut caller, buf, bytes)?;
                            write_bytes(&mut caller, buf + bytes.len() as i32, &[0])?;
                            Ok(required as i32)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_chdir" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              path_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            Ok(caller.data_mut().chdir_path(&path))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_chmod" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              path_ptr: i32,
                              mode: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            Ok(caller.data().chmod_path(&path, mode))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_stat64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              path_ptr: i32,
                              buf: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                let path = read_c_string(caller, path_ptr)?;
                                syscall_stat_path(caller, &path, buf, true)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_lstat64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              path_ptr: i32,
                              buf: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                let path = read_c_string(caller, path_ptr)?;
                                syscall_stat_path(caller, &path, buf, false)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_newfstatat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              buf: i32,
                              flags: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                let path = read_c_string(caller, path_ptr)?;
                                let allow_empty = flags & AT_EMPTY_PATH != 0;
                                let resolved =
                                    match caller.data().resolve_at(dirfd, &path, allow_empty) {
                                        Ok(path) => path,
                                        Err(errno) => return Ok(-errno),
                                    };
                                syscall_stat_path(
                                    caller,
                                    &resolved,
                                    buf,
                                    flags & AT_SYMLINK_NOFOLLOW == 0,
                                )
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_openat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              flags: i32,
                              _varargs: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                let path = read_c_string(caller, path_ptr)?;
                                let result = match caller.data().resolve_at(dirfd, &path, false) {
                                    Ok(path) => {
                                        let result = caller.data_mut().open_path(&path, flags);
                                        if caller.data().trace_enabled() {
                                            eprintln!(
                                                "debug: host openat dirfd={dirfd} path={path} flags={flags:#x} -> {result}"
                                            );
                                        }
                                        result
                                    }
                                    Err(errno) => -errno,
                                };
                                Ok(result)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_mkdirat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              _mode: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            let path = match caller.data().resolve_at(dirfd, &path, false) {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            Ok(caller.data().mkdir_path(&path))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fstat64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              buf: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                let stat = match caller.data().fd_stat(fd) {
                                    Ok(stat) => stat,
                                    Err(errno) => return Ok(-errno),
                                };
                                write_stat(caller, buf, &stat)?;
                                Ok(0)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fchmod" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              mode: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data().chmod_fd(fd, mode))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fchown32" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              _owner: i32,
                              _group: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(match caller.data().get_fd(fd) {
                                Ok(_) => 0,
                                Err(errno) => -errno,
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fchownat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              _owner: i32,
                              _group: i32,
                              flags: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            if flags & !AT_SYMLINK_NOFOLLOW != 0 {
                                return Ok(-EINVAL);
                            }
                            let resolved = match caller.data().resolve_at(dirfd, &path, false) {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            Ok(
                                match caller.data().stat_path_with_follow(
                                    &resolved,
                                    flags & AT_SYMLINK_NOFOLLOW == 0,
                                ) {
                                    Ok(_) => 0,
                                    Err(errno) => -errno,
                                },
                            )
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fcntl64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              cmd: i32,
                              varargs: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                syscall_fcntl64(caller, fd, cmd, varargs)
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_ftruncate64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              length: i64|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().truncate_fd(fd, length))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fdatasync" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let errno = caller.data_mut().flush_fd(fd);
                            if errno == 0 {
                                Ok(0)
                            } else {
                                Ok(-errno)
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_fallocate" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              mode: i32,
                              offset: i64,
                              length: i64|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().fallocate_fd(fd, mode, offset, length))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_readlinkat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              buf: i32,
                              bufsize: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            let path = match caller.data().resolve_at(dirfd, &path, false) {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            let target = match caller.data_mut().readlink_path(&path) {
                                Ok(target) => target,
                                Err(errno) => return Ok(-errno),
                            };
                            let bufsize = match usize::try_from(bufsize) {
                                Ok(size) => size,
                                Err(_) => return Ok(-EINVAL),
                            };
                            let bytes = target.as_bytes();
                            let count = bytes.len().min(bufsize);
                            write_bytes(&mut caller, buf, &bytes[..count])?;
                            Ok(i32::try_from(count).unwrap_or(i32::MAX))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_renameat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              olddirfd: i32,
                              oldpath_ptr: i32,
                              newdirfd: i32,
                              newpath_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let oldpath = read_c_string(&mut caller, oldpath_ptr)?;
                            let newpath = read_c_string(&mut caller, newpath_ptr)?;
                            let oldpath = match caller.data().resolve_at(olddirfd, &oldpath, false)
                            {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            let newpath = match caller.data().resolve_at(newdirfd, &newpath, false)
                            {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            Ok(caller.data().rename_path(&oldpath, &newpath))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_rmdir" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              path_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            let path = match caller.data().resolve_at(AT_FDCWD, &path, false) {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            Ok(caller.data().remove_dir_path(&path))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_symlinkat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              target_ptr: i32,
                              dirfd: i32,
                              linkpath_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let target = read_c_string(&mut caller, target_ptr)?;
                            let linkpath = read_c_string(&mut caller, linkpath_ptr)?;
                            Ok(caller.data().symlink_path(&target, dirfd, &linkpath))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_utimensat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              times_ptr: i32,
                              flags: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            syscall_utimensat(&mut caller, dirfd, &path, times_ptr, flags)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_unlinkat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              flags: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            let path = match caller.data().resolve_at(dirfd, &path, false) {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            if flags == AT_REMOVEDIR {
                                Ok(caller.data().remove_dir_path(&path))
                            } else if flags == 0 {
                                Ok(caller.data().unlink_path(&path))
                            } else {
                                Ok(-EINVAL)
                            }
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_faccessat" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              dirfd: i32,
                              path_ptr: i32,
                              amode: i32,
                              flags: i32|
                              -> wasmtime::Result<i32> {
                            profiled_import(&mut caller, &label, |caller| {
                                if amode & !0o7 != 0 {
                                    return Ok(-EINVAL);
                                }
                                if flags & !(AT_SYMLINK_NOFOLLOW | AT_EACCESS) != 0 {
                                    return Ok(-EINVAL);
                                }
                                let path = read_c_string(caller, path_ptr)?;
                                let path = match caller.data().resolve_at(dirfd, &path, false) {
                                    Ok(path) => path,
                                    Err(errno) => return Ok(-errno),
                                };
                                let stat = match caller
                                    .data()
                                    .stat_path_with_follow(&path, flags & AT_SYMLINK_NOFOLLOW == 0)
                                {
                                    Ok(stat) => stat,
                                    Err(errno) => return Ok(-errno),
                                };
                                Ok(if access_mode_allowed(stat.mode, amode) {
                                    0
                                } else {
                                    -EACCES
                                })
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_statfs64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              path_ptr: i32,
                              _size: i32,
                              buf: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            let path = read_c_string(&mut caller, path_ptr)?;
                            let path = match caller.data().resolve_at(AT_FDCWD, &path, false) {
                                Ok(path) => path,
                                Err(errno) => return Ok(-errno),
                            };
                            if caller.data().stat_path(&path).is_err() {
                                return Ok(-ENOENT);
                            }
                            write_statfs64(&mut caller, buf)?;
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_getdents64" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              dirp: i32,
                              count: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_getdents64(&mut caller, fd, dirp, count)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_dup" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().dup_fd(fd))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_dup3" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              new_fd: i32,
                              _flags: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller.data_mut().dup_fd_to(fd, new_fd))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_pipe" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fds_ptr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            if fds_ptr == 0 {
                                return Ok(-EINVAL);
                            }
                            let (read_fd, write_fd) = caller.data_mut().create_pipe();
                            write_u32(&mut caller, fds_ptr, read_fd as u32)?;
                            write_u32(&mut caller, fds_ptr + 4, write_fd as u32)?;
                            Ok(0)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_socket" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              domain: i32,
                              socket_type: i32,
                              protocol: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(caller
                                .data_mut()
                                .create_socket(domain, socket_type, protocol))
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_connect" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              addr: i32,
                              addrlen: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_connect(&mut caller, fd, addr, addrlen)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_bind" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              addr: i32,
                              addrlen: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_bind(&mut caller, fd, addr, addrlen)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_listen" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              backlog: i32,
                              _c: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_listen(&mut caller, fd, backlog)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_accept4" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              addr: i32,
                              addrlen: i32,
                              flags: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_accept4(&mut caller, fd, addr, addrlen, flags)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_sendto" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              message: i32,
                              length: i32,
                              flags: i32,
                              addr: i32,
                              addr_len: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_sendto(&mut caller, fd, message, length, flags, addr, addr_len)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_recvfrom" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              buf: i32,
                              len: i32,
                              flags: i32,
                              addr: i32,
                              addrlen: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_recvfrom(&mut caller, fd, buf, len, flags, addr, addrlen)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_sendmsg" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              _fd: i32,
                              _message: i32,
                              _flags: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(-ENOSYS)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_getsockopt" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              level: i32,
                              optname: i32,
                              optval: i32,
                              optlen: i32,
                              _d: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_getsockopt(&mut caller, fd, level, optname, optval, optlen)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_getsockname" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              addr: i32,
                              addrlen: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_getsockname(&mut caller, fd, addr, addrlen)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_getpeername" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              addr: i32,
                              addrlen: i32,
                              _d: i32,
                              _e: i32,
                              _f: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_getpeername(&mut caller, fd, addr, addrlen)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_poll" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fds: i32,
                              nfds: i32,
                              timeout: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_poll(&mut caller, fds, nfds, timeout)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "__syscall_ioctl" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              fd: i32,
                              _op: i32,
                              _varargs: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            Ok(match caller.data().get_fd(fd) {
                                Ok(_) => -ENOTTY,
                                Err(errno) => -errno,
                            })
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "getnameinfo" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              sa: i32,
                              salen: i32,
                              node: i32,
                              nodelen: i32,
                              serv: i32,
                              servlen: i32,
                              flags: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            syscall_getnameinfo(
                                &mut caller,
                                GetNameInfoArgs {
                                    sa,
                                    salen,
                                    node,
                                    nodelen,
                                    serv,
                                    servlen,
                                    flags,
                                },
                            )
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "strptime" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              buf: i32,
                              format: i32,
                              tm: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            strptime_utc(&mut caller, buf, format, tm)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_mmap_js" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              len: i32,
                              prot: i32,
                              flags: i32,
                              fd: i32,
                              offset: i64,
                              allocated: i32,
                              addr: i32|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            mmap_file(
                                &mut caller,
                                MmapArgs {
                                    len,
                                    prot,
                                    flags,
                                    fd,
                                    offset,
                                    allocated,
                                    addr,
                                },
                            )
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            "_munmap_js" => {
                let label = import_label.to_string();
                linker
                    .func_wrap(
                        module_name,
                        import_name,
                        move |mut caller: Caller<'_, HostState>,
                              addr: i32,
                              len: i32,
                              _prot: i32,
                              _flags: i32,
                              _fd: i32,
                              _offset: i64|
                              -> wasmtime::Result<i32> {
                            caller.data_mut().record_import(&label)?;
                            munmap_file(&mut caller, addr, len)
                        },
                    )
                    .map_err(|error| define_error(import_label, error))?;
                return Ok(true);
            }
            _ => {}
        }
    }

    Ok(false)
}

fn define_error(import_label: &str, error: wasmtime::Error) -> CliError {
    CliError::new(format!("Failed to define import {import_label}: {error}"))
}

fn define_invoke_import(
    store: &mut Store<HostState>,
    linker: &mut Linker<HostState>,
    module_name: &str,
    import_name: &str,
    import_label: &str,
    func_ty: wasmtime::FuncType,
) -> Result<()> {
    let label = import_label.to_string();
    let result_types = func_ty.results().collect::<Vec<_>>();
    let func = Func::new(&mut *store, func_ty, move |mut caller, params, results| {
        profiled_inclusive_import(&mut caller, &label, |caller| {
            invoke_indirect_function(caller, &label, params, results, &result_types)
        })
    });
    linker
        .define(&*store, module_name, import_name, func)
        .map_err(|error| {
            CliError::new(format!("Failed to define import {import_label}: {error}"))
        })?;
    Ok(())
}

fn invoke_indirect_function(
    caller: &mut Caller<'_, HostState>,
    import_label: &str,
    params: &[Val],
    results: &mut [Val],
    result_types: &[ValType],
) -> wasmtime::Result<()> {
    let index = match params.first() {
        Some(Val::I32(index)) => *index,
        _ => {
            return Err(wasmtime::Error::msg(format!(
                "{import_label} expected an i32 table index as its first argument"
            )));
        }
    };
    let index = u64::try_from(index).map_err(|_| {
        wasmtime::Error::msg(format!(
            "{import_label} received a negative table index: {index}"
        ))
    })?;

    let table = caller
        .get_export("__indirect_function_table")
        .and_then(|export| export.into_table())
        .ok_or_else(|| {
            wasmtime::Error::msg(format!(
                "{import_label} could not find exported __indirect_function_table"
            ))
        })?;

    let table_ref = table.get(&mut *caller, index).ok_or_else(|| {
        wasmtime::Error::msg(format!(
            "{import_label} table index {index} is out of bounds"
        ))
    })?;
    let func = match table_ref {
        Ref::Func(Some(func)) => func,
        Ref::Func(None) => {
            return Err(wasmtime::Error::msg(format!(
                "{import_label} table index {index} is a null function reference"
            )));
        }
        other => {
            return Err(wasmtime::Error::msg(format!(
                "{import_label} table index {index} is not a function reference: {other:?}"
            )));
        }
    };

    match func.call(&mut *caller, &params[1..], results) {
        Ok(()) => Ok(()),
        Err(error) if error.downcast_ref::<EmscriptenLongjmp>().is_some() => {
            set_threw(caller)?;
            for (result, ty) in results.iter_mut().zip(result_types) {
                *result = Val::default_for_ty(ty).ok_or_else(|| {
                    wasmtime::Error::msg("cannot synthesize invoke result after setThrew")
                })?;
            }
            Ok(())
        }
        Err(error) => {
            if error.downcast_ref::<PhpExitStatus>().is_some() {
                Err(error)
            } else {
                Err(wasmtime::Error::msg(format!(
                    "{import_label} indirect table call {index} failed: {error}"
                )))
            }
        }
    }
}

fn set_threw(caller: &mut Caller<'_, HostState>) -> wasmtime::Result<()> {
    let Some(set_threw) = caller
        .get_export("setThrew")
        .and_then(|export| export.into_func())
    else {
        return Ok(());
    };
    set_threw.call(&mut *caller, &[Val::I32(1), Val::I32(0)], &mut [])
}

fn js_popen_to_file(
    caller: &mut Caller<'_, HostState>,
    command: i32,
    mode: i32,
    exit_code_ptr: i32,
) -> wasmtime::Result<i32> {
    if command == 0 || mode == 0 {
        if exit_code_ptr != 0 {
            write_u8(caller, exit_code_ptr, 1)?;
        }
        set_errno(caller, EINVAL)?;
        return Ok(0);
    }
    let command = read_c_string(caller, command)?;
    let mode = read_c_string(caller, mode)?;
    let result = caller.data_mut().run_popen_command(&command, &mode);
    match result {
        Ok((path, exit_code)) => {
            if exit_code_ptr != 0 {
                write_u8(caller, exit_code_ptr, exit_code as u8)?;
            }
            write_malloced_c_string(caller, &path)
        }
        Err(errno) => {
            set_errno(caller, errno)?;
            if exit_code_ptr != 0 {
                write_u8(caller, exit_code_ptr, 1)?;
            }
            Ok(0)
        }
    }
}

fn emscripten_sleep(caller: &mut Caller<'_, HostState>) -> wasmtime::Result<()> {
    match caller.data().asyncify_state() {
        AsyncifyState::Normal => {
            let data = ensure_asyncify_data(caller)?;
            caller
                .data_mut()
                .set_asyncify_state(AsyncifyState::Unwinding);
            call_export_void1(caller, "asyncify_start_unwind", data)
        }
        AsyncifyState::Rewinding => {
            caller.data_mut().set_asyncify_state(AsyncifyState::Normal);
            call_export_void0(caller, "asyncify_stop_rewind")
        }
        AsyncifyState::Unwinding => Err(wasmtime::Error::msg(
            "emscripten_sleep called while Asyncify is already unwinding",
        )),
    }
}

fn emscripten_sleep_wasmtime_async(ms: i32) {
    let Ok(ms) = u64::try_from(ms) else {
        return;
    };
    if ms != 0 {
        thread::sleep(Duration::from_millis(ms));
    }
}

fn emscripten_resize_heap(
    caller: &mut Caller<'_, HostState>,
    requested_size: i32,
) -> wasmtime::Result<i32> {
    const WASM_PAGE_SIZE: u64 = 65_536;

    let requested_size = match u64::try_from(requested_size) {
        Ok(size) => size,
        Err(_) => return Ok(0),
    };
    let memory = exported_memory(caller)?;
    let current_pages = memory.size(&mut *caller);
    let current_size = current_pages.saturating_mul(WASM_PAGE_SIZE);
    if requested_size <= current_size {
        return Ok(1);
    }

    let target_pages = requested_size.div_ceil(WASM_PAGE_SIZE);
    match memory.grow(&mut *caller, target_pages.saturating_sub(current_pages)) {
        Ok(_) => Ok(1),
        Err(_) => Ok(0),
    }
}

fn ensure_asyncify_data(caller: &mut Caller<'_, HostState>) -> wasmtime::Result<u32> {
    let data = if let Some(data) = caller.data().asyncify_data() {
        data
    } else {
        let data = wasm_malloc(caller, 12 + ASYNCIFY_STACK_SIZE)?;
        caller.data_mut().asyncify_data = Some(data);
        data
    };

    write_u32(caller, data as i32, data + 12)?;
    write_u32(caller, data as i32 + 4, data + 12 + ASYNCIFY_STACK_SIZE)?;
    write_u32(caller, data as i32 + 8, 0)?;
    Ok(data)
}

fn call_export_void0(caller: &mut Caller<'_, HostState>, export: &str) -> wasmtime::Result<()> {
    let func = caller
        .get_export(export)
        .and_then(|export| export.into_func())
        .ok_or_else(|| wasmtime::Error::msg(format!("caller does not export {export}")))?;
    func.call(&mut *caller, &[], &mut [])
}

fn call_export_void1(
    caller: &mut Caller<'_, HostState>,
    export: &str,
    arg: u32,
) -> wasmtime::Result<()> {
    let func = caller
        .get_export(export)
        .and_then(|export| export.into_func())
        .ok_or_else(|| wasmtime::Error::msg(format!("caller does not export {export}")))?;
    func.call(&mut *caller, &[Val::I32(arg as i32)], &mut [])
}

fn advisory_locks() -> &'static Mutex<HashMap<PathBuf, Vec<AdvisoryLock>>> {
    ADVISORY_LOCKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn canonical_lock_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn lock_types_conflict(existing_type: u16, requested_type: u16) -> bool {
    matches!(requested_type, F_WRLCK) || matches!(existing_type, F_WRLCK)
}

fn lock_ranges_overlap(left: AdvisoryLockRange, right: AdvisoryLockRange) -> bool {
    left.start < right.end && right.start < left.end
}

fn whole_file_lock_conflicts(
    lock: &AdvisoryLock,
    owner_id: u64,
    fd: i32,
    requested_type: u16,
) -> bool {
    match lock.scope {
        AdvisoryLockScope::WholeFile => match requested_type {
            F_RDLCK => lock.lock_type == F_WRLCK && lock.owner_id != owner_id,
            F_WRLCK => {
                if lock.lock_type == F_WRLCK {
                    lock.owner_id != owner_id || lock.fd != fd
                } else {
                    lock.owner_id != owner_id
                }
            }
            _ => false,
        },
        AdvisoryLockScope::Range(_) => match requested_type {
            F_RDLCK => lock.lock_type == F_WRLCK,
            F_WRLCK => matches!(lock.lock_type, F_RDLCK | F_WRLCK),
            _ => false,
        },
    }
}

fn range_lock_conflicts(
    lock: &AdvisoryLock,
    owner_id: u64,
    requested_type: u16,
    requested_range: AdvisoryLockRange,
) -> bool {
    match lock.scope {
        AdvisoryLockScope::Range(existing_range) => {
            lock.owner_id != owner_id
                && lock_ranges_overlap(existing_range, requested_range)
                && lock_types_conflict(lock.lock_type, requested_type)
        }
        AdvisoryLockScope::WholeFile => lock_types_conflict(lock.lock_type, requested_type),
    }
}

#[derive(Debug, Clone)]
struct VfsStat {
    mode: u32,
    nlink: u32,
    size: u64,
    ino: u64,
    atime_secs: Option<u64>,
    mtime_secs: Option<u64>,
    ctime_secs: Option<u64>,
}

impl FdEntry {
    fn path(&self) -> &str {
        match self {
            FdEntry::File { path, .. }
            | FdEntry::HostReadFile { path, .. }
            | FdEntry::InternalReadFile { path, .. }
            | FdEntry::Directory { path, .. } => path,
            FdEntry::Stdin => "/dev/stdin",
            FdEntry::Stdout => "/dev/stdout",
            FdEntry::Stderr => "/dev/stderr",
            FdEntry::RequestStdout => "/request/stdout",
            FdEntry::RequestStderr => "/request/stderr",
            FdEntry::RequestHeaders => "/request/headers",
            FdEntry::Random => "/dev/urandom",
            FdEntry::Pipe { .. } => "/dev/pipe",
            FdEntry::Socket { .. } => "/dev/socket",
        }
    }

    fn stat(&self, host_read_file_cached_generation: Option<u64>) -> VfsStat {
        match self {
            FdEntry::Stdin
            | FdEntry::Stdout
            | FdEntry::Stderr
            | FdEntry::RequestStdout
            | FdEntry::RequestStderr
            | FdEntry::RequestHeaders
            | FdEntry::Random
            | FdEntry::Socket { .. } => VfsStat::character_device(),
            FdEntry::Pipe { .. } => VfsStat::fifo(),
            FdEntry::File { data, path, .. } => VfsStat::file(path, data.len() as u64),
            FdEntry::InternalReadFile { data, path, .. } => VfsStat::file(path, data.len() as u64),
            FdEntry::HostReadFile {
                path,
                host_path,
                cached_stat,
                cached_stat_generation,
                ..
            } => {
                if host_read_file_cached_generation == Some(*cached_stat_generation) {
                    cached_stat.clone()
                } else {
                    fs::metadata(host_path)
                        .map(|metadata| VfsStat::from_host_metadata(path, &metadata))
                        .unwrap_or_else(|_| VfsStat::file(path, 0))
                }
            }
            FdEntry::Directory { path, .. } => VfsStat::directory(path),
        }
    }

    fn wasi_file_type(&self) -> u8 {
        match self {
            FdEntry::Stdin
            | FdEntry::Stdout
            | FdEntry::Stderr
            | FdEntry::RequestStdout
            | FdEntry::RequestStderr
            | FdEntry::RequestHeaders
            | FdEntry::Random
            | FdEntry::Socket { .. } => 2,
            FdEntry::Pipe { .. } => 6,
            FdEntry::Directory { .. } => 3,
            FdEntry::File { .. }
            | FdEntry::HostReadFile { .. }
            | FdEntry::InternalReadFile { .. } => 4,
        }
    }
}

impl VfsStat {
    fn file(path: &str, size: u64) -> Self {
        Self {
            mode: S_IFREG | 0o666,
            nlink: 1,
            size,
            ino: stable_inode(path),
            atime_secs: None,
            mtime_secs: None,
            ctime_secs: None,
        }
    }

    fn directory(path: &str) -> Self {
        Self {
            mode: S_IFDIR | 0o777,
            nlink: 2,
            size: 4096,
            ino: stable_inode(path),
            atime_secs: None,
            mtime_secs: None,
            ctime_secs: None,
        }
    }

    fn character_device() -> Self {
        Self {
            mode: S_IFCHR | 0o666,
            nlink: 1,
            size: 0,
            ino: 1,
            atime_secs: None,
            mtime_secs: None,
            ctime_secs: None,
        }
    }

    fn fifo() -> Self {
        Self {
            mode: S_IFIFO | 0o666,
            nlink: 1,
            size: 0,
            ino: 1,
            atime_secs: None,
            mtime_secs: None,
            ctime_secs: None,
        }
    }

    fn from_host_metadata(path: &str, metadata: &fs::Metadata) -> Self {
        let permissions = host_metadata_permissions(metadata);
        let atime_secs = metadata.accessed().ok().and_then(system_time_unix_secs);
        let mtime_secs = metadata.modified().ok().and_then(system_time_unix_secs);
        let ctime_secs = metadata
            .created()
            .ok()
            .and_then(system_time_unix_secs)
            .or(mtime_secs);
        if metadata.is_dir() {
            Self {
                mode: S_IFDIR | permissions,
                nlink: 2,
                size: 4096,
                ino: stable_inode(path),
                atime_secs,
                mtime_secs,
                ctime_secs,
            }
        } else if metadata.file_type().is_symlink() {
            Self {
                mode: S_IFLNK | permissions,
                nlink: 1,
                size: metadata.len(),
                ino: stable_inode(path),
                atime_secs,
                mtime_secs,
                ctime_secs,
            }
        } else {
            Self {
                mode: S_IFREG | permissions,
                nlink: 1,
                size: metadata.len(),
                ino: stable_inode(path),
                atime_secs,
                mtime_secs,
                ctime_secs,
            }
        }
    }
}

fn system_time_unix_secs(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs())
}

fn host_vfs_stat(
    path: &str,
    host_path: &Path,
    follow_final_symlink: bool,
) -> std::result::Result<VfsStat, i32> {
    let metadata = if follow_final_symlink {
        fs::metadata(host_path)
    } else {
        fs::symlink_metadata(host_path)
    }
    .map_err(|_| ENOENT)?;
    if metadata.is_dir() || metadata.is_file() || metadata.file_type().is_symlink() {
        Ok(VfsStat::from_host_metadata(path, &metadata))
    } else {
        Err(EINVAL)
    }
}

fn host_metadata_permissions(metadata: &fs::Metadata) -> u32 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o7777
    }

    #[cfg(not(unix))]
    {
        if metadata.permissions().readonly() {
            0o444
        } else if metadata.is_dir() {
            0o777
        } else {
            0o666
        }
    }
}

fn access_mode_allowed(mode: u32, amode: i32) -> bool {
    if amode == 0 {
        return true;
    }
    let permissions = mode & 0o777;
    (amode & 0o4 == 0 || permissions & 0o444 != 0)
        && (amode & 0o2 == 0 || permissions & 0o222 != 0)
        && (amode & 0o1 == 0 || permissions & 0o111 != 0)
}

fn file_descriptor_allows_read(access_mode: i32) -> bool {
    access_mode & O_ACCMODE != O_WRONLY
}

fn file_descriptor_allows_write(access_mode: i32) -> bool {
    matches!(access_mode & O_ACCMODE, O_WRONLY | O_RDWR)
}

fn cache_path_related_to_change(cached_path: &str, changed_path: &str) -> bool {
    cached_path == changed_path
        || cached_path == "/"
        || changed_path == "/"
        || cached_path
            .strip_prefix(changed_path)
            .is_some_and(|suffix| suffix.starts_with('/'))
        || changed_path
            .strip_prefix(cached_path)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "on"))
        .unwrap_or(false)
}

impl HostState {
    #[cfg(test)]
    fn clear_host_cache(&self) {
        if self.host_cache_enabled {
            self.clear_host_cache_entries();
        }
    }

    fn invalidate_host_cache_path(&self, path: &str) {
        if self.host_cache_enabled {
            self.invalidate_host_cache_path_entries(path);
        }
    }

    #[cfg(test)]
    fn clear_host_cache_entries(&self) {
        self.host_path_cache.borrow_mut().clear();
        self.host_stat_cache.borrow_mut().clear();
        self.host_cache_generation
            .set(self.host_cache_generation.get().wrapping_add(1));
    }

    fn invalidate_host_cache_path_entries(&self, path: &str) {
        self.host_path_cache
            .borrow_mut()
            .retain(|(cached_path, _, _), _| !cache_path_related_to_change(cached_path, path));
        self.host_stat_cache
            .borrow_mut()
            .retain(|(cached_path, _), _| !cache_path_related_to_change(cached_path, path));
        self.host_cache_generation
            .set(self.host_cache_generation.get().wrapping_add(1));
    }

    fn cached_resolve_host_path_for_open(&self, path: &str, allow_create: bool) -> Option<PathBuf> {
        if !self.host_cache_enabled || allow_create {
            return self.resolve_host_path_for_open_uncached(path, allow_create);
        }
        let key = (path.to_string(), allow_create, true);
        if let Some(cached) = self.host_path_cache.borrow().get(&key) {
            return cached.clone();
        }
        let resolved = self.resolve_host_path_for_open_uncached(path, allow_create);
        self.host_path_cache
            .borrow_mut()
            .insert(key, resolved.clone());
        resolved
    }

    fn cached_resolve_host_path_no_follow(&self, path: &str) -> Option<PathBuf> {
        if !self.host_cache_enabled {
            return self.resolve_host_path_no_follow_uncached(path);
        }
        let key = (path.to_string(), false, false);
        if let Some(cached) = self.host_path_cache.borrow().get(&key) {
            return cached.clone();
        }
        let resolved = self.resolve_host_path_no_follow_uncached(path);
        self.host_path_cache
            .borrow_mut()
            .insert(key, resolved.clone());
        resolved
    }

    fn resolve_at(
        &self,
        dirfd: i32,
        path: &str,
        allow_empty: bool,
    ) -> std::result::Result<String, i32> {
        if path.is_empty() {
            if !allow_empty {
                return Err(ENOENT);
            }
            return if dirfd == AT_FDCWD {
                Ok(self.cwd.clone())
            } else {
                Ok(self.get_fd(dirfd)?.path().to_string())
            };
        }

        let combined = if path.starts_with('/') {
            path.to_string()
        } else {
            let base = if dirfd == AT_FDCWD {
                self.cwd.as_str()
            } else {
                self.get_fd(dirfd)?.path()
            };
            format!("{base}/{path}")
        };

        normalize_vfs_path(&combined).map_err(|_| EINVAL)
    }

    fn open_path(&mut self, path: &str, flags: i32) -> i32 {
        match path {
            "/request/stdout" => return self.alloc_fd(FdEntry::RequestStdout),
            "/request/stderr" => return self.alloc_fd(FdEntry::RequestStderr),
            "/request/headers" => return self.alloc_fd(FdEntry::RequestHeaders),
            "/dev/random" | "/dev/urandom" => return self.alloc_fd(FdEntry::Random),
            _ => {}
        }
        let access_mode = flags & O_ACCMODE;
        let writable = matches!(access_mode, O_WRONLY | O_RDWR);

        if flags & O_TMPFILE == O_TMPFILE {
            if !writable {
                return -EINVAL;
            }
            if !self.virtual_dir_exists(path) {
                let Some(host_path) = self.resolve_host_path_for_open(path, false) else {
                    return -ENOENT;
                };
                match fs::metadata(host_path) {
                    Ok(metadata) if metadata.is_dir() => {}
                    Ok(_) => return -ENOTDIR,
                    Err(_) => return -ENOENT,
                }
            }
            return self.alloc_fd(FdEntry::File {
                path: path.to_string(),
                host_path: None,
                data: Vec::new(),
                position: 0,
                access_mode,
                append: false,
                nonblocking: flags & O_NONBLOCK != 0,
                dirty: false,
            });
        }

        if self.virtual_dir_exists(path) {
            if flags & O_DIRECTORY == 0 && writable {
                return -EACCES;
            }
            return self.alloc_fd(FdEntry::Directory {
                path: path.to_string(),
                position: 0,
            });
        }

        if let Some(data) = self.internal_files.get(path) {
            if writable {
                return -EACCES;
            }
            return self.alloc_fd(FdEntry::InternalReadFile {
                path: path.to_string(),
                data: Arc::clone(data),
                position: 0,
                append: flags & O_APPEND != 0,
                nonblocking: flags & O_NONBLOCK != 0,
            });
        }

        let wants_create = flags & O_CREAT != 0;
        let Some(host_path) = self.resolve_host_path_for_open(path, wants_create) else {
            return -ENOENT;
        };
        if !writable && !wants_create {
            if let Some(cached_stat) = self.cached_host_file_stat_for_open(path) {
                match self.open_cached_host_read_file(path, host_path.clone(), flags, cached_stat) {
                    Ok(fd) => return fd,
                    Err(_) => {
                        // Fall through to the existing metadata-driven path so error handling
                        // and stale external filesystem changes keep the old behavior.
                    }
                }
            }
        }
        match fs::metadata(&host_path) {
            Ok(metadata) if metadata.is_dir() => self.alloc_fd(FdEntry::Directory {
                path: path.to_string(),
                position: 0,
            }),
            Ok(metadata) if metadata.is_file() => {
                if wants_create && flags & O_EXCL != 0 {
                    return -EEXIST;
                }
                if !writable {
                    let cached_stat_generation = self.host_cache_generation.get();
                    return match fs::File::open(&host_path) {
                        Ok(file) => {
                            let cached_stat = VfsStat::from_host_metadata(path, &metadata);
                            self.alloc_fd(FdEntry::HostReadFile {
                                path: path.to_string(),
                                host_path,
                                file: Arc::new(Mutex::new(file)),
                                position: if flags & O_APPEND != 0 {
                                    metadata.len() as usize
                                } else {
                                    0
                                },
                                append: flags & O_APPEND != 0,
                                nonblocking: flags & O_NONBLOCK != 0,
                                cached_stat,
                                cached_stat_generation,
                            })
                        }
                        Err(_) => -EINVAL,
                    };
                }
                let mut position = if flags & O_APPEND != 0 {
                    metadata.len() as usize
                } else {
                    0
                };
                if flags & O_TRUNC != 0 {
                    match fs::OpenOptions::new().write(true).open(&host_path) {
                        Ok(file) if file.set_len(0).is_ok() => {
                            position = 0;
                            self.invalidate_host_cache_path(path);
                        }
                        _ => return -EINVAL,
                    }
                }
                self.alloc_fd(FdEntry::File {
                    path: path.to_string(),
                    host_path: Some(host_path),
                    data: Vec::new(),
                    position,
                    access_mode,
                    append: flags & O_APPEND != 0,
                    nonblocking: flags & O_NONBLOCK != 0,
                    dirty: false,
                })
            }
            Ok(_) => -EINVAL,
            Err(_) if wants_create => {
                if let Some(parent) = host_path.parent() {
                    if !parent.exists() {
                        return -ENOENT;
                    }
                }
                match fs::File::create(&host_path) {
                    Ok(_) => {
                        self.invalidate_host_cache_path(path);
                        self.alloc_fd(FdEntry::File {
                            path: path.to_string(),
                            host_path: Some(host_path),
                            data: Vec::new(),
                            position: 0,
                            access_mode,
                            append: flags & O_APPEND != 0,
                            nonblocking: flags & O_NONBLOCK != 0,
                            dirty: false,
                        })
                    }
                    Err(_) => -EINVAL,
                }
            }
            Err(_) => -ENOENT,
        }
    }

    fn cached_host_file_stat_for_open(&self, path: &str) -> Option<VfsStat> {
        if !self.host_cache_enabled {
            return None;
        }
        let key = (path.to_string(), true);
        match self.host_stat_cache.borrow().get(&key) {
            Some(Ok(stat)) if stat.mode & S_IFREG == S_IFREG => Some(stat.clone()),
            _ => None,
        }
    }

    fn open_cached_host_read_file(
        &mut self,
        path: &str,
        host_path: PathBuf,
        flags: i32,
        cached_stat: VfsStat,
    ) -> std::result::Result<i32, ()> {
        let file = fs::File::open(&host_path).map_err(|_| ())?;
        let cached_stat_generation = self.host_cache_generation.get();
        Ok(self.alloc_fd(FdEntry::HostReadFile {
            path: path.to_string(),
            host_path,
            file: Arc::new(Mutex::new(file)),
            position: if flags & O_APPEND != 0 {
                cached_stat.size as usize
            } else {
                0
            },
            append: flags & O_APPEND != 0,
            nonblocking: flags & O_NONBLOCK != 0,
            cached_stat,
            cached_stat_generation,
        }))
    }

    fn stat_path(&self, path: &str) -> std::result::Result<VfsStat, i32> {
        self.stat_path_with_follow(path, true)
    }

    fn stat_path_with_follow(
        &self,
        path: &str,
        follow_final_symlink: bool,
    ) -> std::result::Result<VfsStat, i32> {
        if self.virtual_dir_exists(path) {
            return Ok(VfsStat::directory(path));
        }
        if let Some(data) = self.internal_files.get(path) {
            return Ok(VfsStat::file(path, data.len() as u64));
        }
        if matches!(
            path,
            "/request/stdout"
                | "/request/stderr"
                | "/request/headers"
                | "/dev/random"
                | "/dev/urandom"
        ) {
            return Ok(VfsStat::character_device());
        }

        let host_path = if follow_final_symlink {
            self.resolve_host_path(path)
        } else {
            self.resolve_host_path_no_follow(path)
        };
        let Some(host_path) = host_path else {
            return Err(ENOENT);
        };
        if self.host_cache_enabled {
            let key = (path.to_string(), follow_final_symlink);
            if let Some(cached) = self.host_stat_cache.borrow().get(&key) {
                return cached.clone();
            }
            let stat = host_vfs_stat(path, &host_path, follow_final_symlink);
            self.host_stat_cache.borrow_mut().insert(key, stat.clone());
            stat
        } else {
            host_vfs_stat(path, &host_path, follow_final_symlink)
        }
    }

    fn fd_stat(&self, fd: i32) -> std::result::Result<VfsStat, i32> {
        let host_read_file_cached_generation = if self.host_cache_enabled {
            Some(self.host_cache_generation.get())
        } else {
            None
        };
        match self.get_fd(fd)? {
            FdEntry::File {
                path,
                host_path: Some(host_path),
                data,
                ..
            } => Ok(fs::metadata(host_path)
                .map(|metadata| VfsStat::from_host_metadata(path, &metadata))
                .unwrap_or_else(|_| VfsStat::file(path, data.len() as u64))),
            FdEntry::Directory { path, .. } => Ok(self.fd_directory_stat(path)),
            entry => Ok(entry.stat(host_read_file_cached_generation)),
        }
    }

    fn fd_directory_stat(&self, path: &str) -> VfsStat {
        if self.host_cache_enabled {
            let key = (path.to_string(), true);
            if let Some(Ok(stat)) = self.host_stat_cache.borrow().get(&key) {
                return stat.clone();
            }
            if let Some(host_path) = self.resolve_host_path(path) {
                if let Ok(metadata) = fs::metadata(host_path) {
                    let stat = VfsStat::from_host_metadata(path, &metadata);
                    self.host_stat_cache
                        .borrow_mut()
                        .insert(key, Ok(stat.clone()));
                    return stat;
                }
            }
            return VfsStat::directory(path);
        }

        if let Some(host_path) = self.resolve_host_path(path) {
            if let Ok(metadata) = fs::metadata(host_path) {
                return VfsStat::from_host_metadata(path, &metadata);
            }
        }
        VfsStat::directory(path)
    }

    fn virtual_dir_exists(&self, path: &str) -> bool {
        matches!(
            path,
            "/" | "/internal"
                | "/internal/shared"
                | "/internal/shared/preload"
                | "/internal/shared/mu-plugins"
                | "/request"
                | "/tmp"
                | "/dev"
                | "/home"
                | "/home/web_user"
        ) || self.internal_symlink_virtual_dir_exists(path)
            || self
                .options
                .mounts
                .iter()
                .any(|mount| vfs_mount_suffix(&mount.vfs_path, path).is_some())
    }

    fn resolve_host_path(&self, path: &str) -> Option<PathBuf> {
        self.cached_resolve_host_path_for_open(path, false)
    }

    fn resolve_host_path_no_follow(&self, path: &str) -> Option<PathBuf> {
        self.cached_resolve_host_path_no_follow(path)
    }

    fn resolve_host_path_no_follow_uncached(&self, path: &str) -> Option<PathBuf> {
        let normalized = normalize_vfs_path(path).ok()?;
        if let Some(host_path) = self.resolve_internal_symlink_host_path(&normalized, false) {
            return Some(host_path);
        }
        for mount in &self.resolved_mounts {
            if let Some(suffix) = vfs_mount_suffix_normalized(&normalized, &mount.vfs_path) {
                let candidate = join_host_mount_path(&mount.host_path, suffix);
                if suffix.is_empty() {
                    return Some(candidate);
                }
                let parent = candidate.parent()?;
                let canonical_parent = fs::canonicalize(parent).ok()?;
                if canonical_parent == mount.canonical_host_path
                    || canonical_parent.starts_with(&mount.canonical_host_path)
                    || self.options.follow_symlinks
                {
                    return Some(candidate);
                }
            }
        }

        let candidate = PathBuf::from(path);
        if !candidate.is_absolute() {
            return None;
        }
        let parent = candidate.parent()?;
        let canonical_parent = fs::canonicalize(parent).ok()?;
        self.canonical_allowed_host_paths
            .iter()
            .any(|allowed| {
                canonical_parent == *allowed
                    || (allowed.is_dir() && canonical_parent.starts_with(allowed))
            })
            .then_some(candidate)
    }

    fn resolve_host_path_for_open(&self, path: &str, allow_create: bool) -> Option<PathBuf> {
        self.cached_resolve_host_path_for_open(path, allow_create)
    }

    fn resolve_host_path_for_open_uncached(
        &self,
        path: &str,
        allow_create: bool,
    ) -> Option<PathBuf> {
        let normalized = normalize_vfs_path(path).ok()?;
        if let Some(host_path) = self.resolve_internal_symlink_host_path(&normalized, allow_create)
        {
            return Some(host_path);
        }
        for mount in &self.resolved_mounts {
            if let Some(suffix) = vfs_mount_suffix_normalized(&normalized, &mount.vfs_path) {
                let candidate = join_host_mount_path(&mount.host_path, suffix);
                if let Ok(canonical_candidate) = fs::canonicalize(&candidate) {
                    if canonical_candidate == mount.canonical_host_path
                        || canonical_candidate.starts_with(&mount.canonical_host_path)
                        || self.options.follow_symlinks
                    {
                        return Some(canonical_candidate);
                    }
                } else if allow_create {
                    let parent = candidate.parent()?;
                    let canonical_parent = fs::canonicalize(parent).ok()?;
                    if canonical_parent == mount.canonical_host_path
                        || canonical_parent.starts_with(&mount.canonical_host_path)
                        || self.options.follow_symlinks
                    {
                        return Some(candidate);
                    }
                }
            }
        }

        let candidate = PathBuf::from(path);
        if !candidate.is_absolute() {
            return None;
        }
        let canonical = fs::canonicalize(&candidate).ok()?;
        self.canonical_allowed_host_paths
            .iter()
            .any(|allowed| {
                canonical == *allowed || (allowed.is_dir() && canonical.starts_with(allowed))
            })
            .then_some(canonical)
    }

    fn chdir_path(&mut self, path: &str) -> i32 {
        let resolved = match self.resolve_at(AT_FDCWD, path, false) {
            Ok(path) => path,
            Err(errno) => return -errno,
        };
        let stat = match self.stat_path(&resolved) {
            Ok(stat) => stat,
            Err(errno) => return -errno,
        };
        if stat.mode & S_IFDIR != S_IFDIR {
            return -ENOTDIR;
        }

        self.cwd = resolved;
        0
    }

    fn chmod_path(&self, path: &str, mode: i32) -> i32 {
        let resolved = match self.resolve_at(AT_FDCWD, path, false) {
            Ok(path) => path,
            Err(errno) => return -errno,
        };
        if let Err(errno) = self.stat_path(&resolved) {
            return -errno;
        }

        let Some(host_path) = self.resolve_host_path(&resolved) else {
            return 0;
        };
        let result = chmod_host_path(&host_path, mode);
        if result == 0 {
            self.invalidate_host_cache_path(&resolved);
        }
        result
    }

    fn chmod_fd(&self, fd: i32, mode: i32) -> i32 {
        let (host_path, invalidate_path) = match self.get_fd(fd) {
            Ok(FdEntry::File {
                path,
                host_path: Some(host_path),
                ..
            }) => (Some(host_path.clone()), Some(path.clone())),
            Ok(FdEntry::File {
                host_path: None, ..
            }) => (None, None),
            Ok(FdEntry::InternalReadFile { .. }) => (None, None),
            Ok(FdEntry::HostReadFile {
                path, host_path, ..
            }) => (Some(host_path.clone()), Some(path.clone())),
            Ok(FdEntry::Directory { path, .. }) => {
                (self.resolve_host_path(path), Some(path.clone()))
            }
            Ok(_) => return -EBADF,
            Err(errno) => return -errno,
        };

        let Some(host_path) = host_path else {
            return 0;
        };
        let result = chmod_host_path(&host_path, mode);
        if result == 0 {
            if let Some(path) = invalidate_path {
                self.invalidate_host_cache_path(&path);
            }
        }
        result
    }

    fn symlink_path(&self, target: &str, dirfd: i32, linkpath: &str) -> i32 {
        let resolved_link = match self.resolve_at(dirfd, linkpath, false) {
            Ok(path) => path,
            Err(errno) => return -errno,
        };
        let Some(host_link_path) = self.resolve_host_path_for_open(&resolved_link, true) else {
            return -ENOENT;
        };
        if fs::symlink_metadata(&host_link_path).is_ok() {
            return -EEXIST;
        }

        let host_target = self.host_symlink_target(target, &host_link_path);
        let result = create_host_symlink(&host_target, &host_link_path);
        if result == 0 {
            self.invalidate_host_cache_path(&resolved_link);
        }
        result
    }

    fn host_symlink_target(&self, target: &str, host_link_path: &Path) -> PathBuf {
        if target.starts_with('/') {
            if let Ok(resolved_target) = self.resolve_at(AT_FDCWD, target, false) {
                if let Some(host_target) = self.resolve_host_path(&resolved_target) {
                    return host_target;
                }
            }
        }

        let target_path = PathBuf::from(target);
        if target_path.is_absolute() {
            target_path
        } else {
            host_link_path
                .parent()
                .map(|parent| parent.join(target_path))
                .unwrap_or_else(|| PathBuf::from(target))
        }
    }

    fn resolve_host_path_for_readlink(&self, path: &str) -> Option<PathBuf> {
        let normalized = normalize_vfs_path(path).ok()?;
        for mount in &self.resolved_mounts {
            if let Some(suffix) = vfs_mount_suffix_normalized(&normalized, &mount.vfs_path) {
                let candidate = join_host_mount_path(&mount.host_path, suffix);
                let parent = candidate.parent()?;
                let canonical_parent = fs::canonicalize(parent).ok()?;
                if canonical_parent == mount.canonical_host_path
                    || canonical_parent.starts_with(&mount.canonical_host_path)
                {
                    return Some(candidate);
                }
            }
        }

        let candidate = PathBuf::from(path);
        if !candidate.is_absolute() {
            return None;
        }
        let parent = candidate.parent()?;
        let canonical_parent = fs::canonicalize(parent).ok()?;
        self.canonical_allowed_host_paths
            .iter()
            .any(|allowed| {
                canonical_parent == *allowed
                    || (allowed.is_dir() && canonical_parent.starts_with(allowed))
            })
            .then_some(candidate)
    }

    fn internal_symlink_virtual_dir_exists(&self, path: &str) -> bool {
        if !self.options.follow_symlinks {
            return false;
        }
        if path == "/internal/symlinks" {
            return true;
        }
        self.followed_symlink_roots.iter().any(|root| {
            let root_vfs_path = internal_symlink_vfs_path(root);
            path == root_vfs_path || root_vfs_path.starts_with(&(path.to_string() + "/"))
        })
    }

    fn resolve_internal_symlink_host_path(
        &self,
        path: &str,
        allow_create: bool,
    ) -> Option<PathBuf> {
        let candidate = host_path_from_internal_symlink_vfs_path(path)?;
        if let Ok(canonical_candidate) = fs::canonicalize(&candidate) {
            return self
                .followed_symlink_roots
                .iter()
                .any(|root| path_is_or_under(&canonical_candidate, root))
                .then_some(canonical_candidate);
        }
        if allow_create {
            let parent = candidate.parent()?;
            let canonical_parent = fs::canonicalize(parent).ok()?;
            return self
                .followed_symlink_roots
                .iter()
                .any(|root| path_is_or_under(&canonical_parent, root))
                .then_some(candidate);
        }
        None
    }

    fn readlink_path(&mut self, path: &str) -> std::result::Result<String, i32> {
        if !self.options.follow_symlinks {
            return Err(EINVAL);
        }
        let host_path = self.resolve_host_path_for_readlink(path).ok_or(ENOENT)?;
        let metadata = fs::symlink_metadata(&host_path).map_err(|_| ENOENT)?;
        if !metadata.file_type().is_symlink() {
            return Err(EINVAL);
        }
        let target = fs::read_link(&host_path).map_err(|_| EINVAL)?;
        let absolute_target = if target.is_absolute() {
            target
        } else {
            host_path.parent().ok_or(ENOENT)?.join(target)
        };
        let canonical_target = fs::canonicalize(&absolute_target).map_err(|_| ENOENT)?;
        let target_metadata = fs::metadata(&canonical_target).map_err(|_| ENOENT)?;
        let allowed_root = if target_metadata.is_file() {
            canonical_target.parent().ok_or(ENOENT)?.to_path_buf()
        } else if target_metadata.is_dir() {
            canonical_target.clone()
        } else {
            return Err(EINVAL);
        };
        if !self
            .followed_symlink_roots
            .iter()
            .any(|root| root == &allowed_root)
        {
            self.followed_symlink_roots.push(allowed_root);
        }
        Ok(internal_symlink_vfs_path(&canonical_target))
    }

    fn mkdir_path(&self, path: &str) -> i32 {
        let Some(host_path) = self.resolve_host_path_for_open(path, true) else {
            return -ENOENT;
        };
        if host_path.exists() {
            return -EEXIST;
        }
        match fs::create_dir(&host_path) {
            Ok(_) => {
                self.invalidate_host_cache_path(path);
                0
            }
            Err(_) => -EINVAL,
        }
    }

    fn unlink_path(&self, path: &str) -> i32 {
        let Some(host_path) = self.resolve_host_path(path) else {
            return -ENOENT;
        };
        match fs::remove_file(&host_path) {
            Ok(_) => {
                self.invalidate_host_cache_path(path);
                0
            }
            Err(_) => -EINVAL,
        }
    }

    fn remove_dir_path(&self, path: &str) -> i32 {
        let Some(host_path) = self.resolve_host_path(path) else {
            return -ENOENT;
        };
        match fs::remove_dir(&host_path) {
            Ok(_) => {
                self.invalidate_host_cache_path(path);
                0
            }
            Err(_) => -EINVAL,
        }
    }

    fn rename_path(&self, oldpath: &str, newpath: &str) -> i32 {
        let Some(old_host_path) = self.resolve_host_path(oldpath) else {
            return -ENOENT;
        };
        let Some(new_host_path) = self.resolve_host_path_for_open(newpath, true) else {
            return -ENOENT;
        };
        match fs::rename(old_host_path, new_host_path) {
            Ok(_) => {
                self.invalidate_host_cache_path(oldpath);
                self.invalidate_host_cache_path(newpath);
                0
            }
            Err(_) => -EINVAL,
        }
    }

    fn read_dir_entries(&self, path: &str) -> std::result::Result<Vec<DirEntryInfo>, i32> {
        let mut entries = vec![
            DirEntryInfo::directory(".", stable_inode(path)),
            DirEntryInfo::directory("..", stable_inode(path)),
        ];

        if let Some(host_path) = self.resolve_host_path(path) {
            let read_dir = fs::read_dir(host_path).map_err(|_| ENOTDIR)?;
            for entry in read_dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let file_type = entry.file_type().ok();
                let dirent_type = if file_type.as_ref().is_some_and(|ty| ty.is_dir()) {
                    4
                } else if file_type.as_ref().is_some_and(|ty| ty.is_file()) {
                    8
                } else {
                    0
                };
                entries.push(DirEntryInfo {
                    name,
                    ino: stable_inode(&entry.path().to_string_lossy()),
                    dirent_type,
                });
            }
            self.append_direct_child_mount_entries(path, &mut entries);
            return Ok(entries);
        }

        match path {
            "/" => {
                entries.extend([
                    DirEntryInfo::directory("internal", stable_inode("/internal")),
                    DirEntryInfo::directory("request", stable_inode("/request")),
                    DirEntryInfo::directory("tmp", stable_inode("/tmp")),
                    DirEntryInfo::directory("dev", stable_inode("/dev")),
                    DirEntryInfo::directory("home", stable_inode("/home")),
                ]);
                for mount in &self.options.mounts {
                    if let Some(first) = mount
                        .vfs_path
                        .trim_start_matches('/')
                        .split('/')
                        .find(|part| !part.is_empty())
                    {
                        if !entries.iter().any(|entry| entry.name == first) {
                            entries.push(DirEntryInfo::directory(
                                first,
                                stable_inode(&format!("/{first}")),
                            ));
                        }
                    }
                }
                Ok(entries)
            }
            "/internal" => {
                Ok(vec![
                    DirEntryInfo::directory(".", stable_inode(path)),
                    DirEntryInfo::directory("..", stable_inode(path)),
                    DirEntryInfo::directory("shared", stable_inode("/internal/shared")),
                ]
                .into_iter()
                .chain(self.options.follow_symlinks.then(|| {
                    DirEntryInfo::directory("symlinks", stable_inode("/internal/symlinks"))
                }))
                .collect())
            }
            "/internal/shared" => Ok(vec![
                DirEntryInfo::directory(".", stable_inode(path)),
                DirEntryInfo::directory("..", stable_inode(path)),
                DirEntryInfo::directory("preload", stable_inode("/internal/shared/preload")),
                DirEntryInfo::directory("mu-plugins", stable_inode("/internal/shared/mu-plugins")),
                DirEntryInfo::file("php.ini", stable_inode("/internal/shared/php.ini")),
                DirEntryInfo::file(
                    "ca-bundle.crt",
                    stable_inode("/internal/shared/ca-bundle.crt"),
                ),
                DirEntryInfo::file(
                    "auto_prepend_file.php",
                    stable_inode("/internal/shared/auto_prepend_file.php"),
                ),
                DirEntryInfo::file("consts.json", stable_inode("/internal/shared/consts.json")),
            ]),
            "/internal/shared/preload" => Ok(vec![
                DirEntryInfo::directory(".", stable_inode(path)),
                DirEntryInfo::directory("..", stable_inode(path)),
                DirEntryInfo::file("env.php", stable_inode("/internal/shared/preload/env.php")),
            ]),
            "/internal/shared/mu-plugins" => Ok(vec![
                DirEntryInfo::directory(".", stable_inode(path)),
                DirEntryInfo::directory("..", stable_inode(path)),
                DirEntryInfo::file(
                    "0-playground.php",
                    stable_inode("/internal/shared/mu-plugins/0-playground.php"),
                ),
                DirEntryInfo::file(
                    "1-auto-login.php",
                    stable_inode("/internal/shared/mu-plugins/1-auto-login.php"),
                ),
            ]),
            "/request" => Ok(vec![
                DirEntryInfo::directory(".", stable_inode(path)),
                DirEntryInfo::directory("..", stable_inode(path)),
                DirEntryInfo::character("stdout"),
                DirEntryInfo::character("stderr"),
                DirEntryInfo::character("headers"),
            ]),
            "/dev" => Ok(vec![
                DirEntryInfo::directory(".", stable_inode(path)),
                DirEntryInfo::directory("..", stable_inode(path)),
                DirEntryInfo::character("random"),
                DirEntryInfo::character("urandom"),
            ]),
            "/tmp" | "/home" | "/home/web_user" => Ok(entries),
            _ if self.internal_symlink_virtual_dir_exists(path) => {
                self.append_internal_symlink_child_entries(path, &mut entries);
                Ok(entries)
            }
            _ if self.has_direct_child_mount(path) => {
                self.append_direct_child_mount_entries(path, &mut entries);
                Ok(entries)
            }
            _ => Err(ENOENT),
        }
    }

    fn has_direct_child_mount(&self, path: &str) -> bool {
        self.options
            .mounts
            .iter()
            .any(|mount| direct_child_mount_name(path, &mount.vfs_path).is_some())
    }

    fn append_direct_child_mount_entries(&self, path: &str, entries: &mut Vec<DirEntryInfo>) {
        for mount in &self.options.mounts {
            let Some((name, is_directory)) = direct_child_mount_name(path, &mount.vfs_path) else {
                continue;
            };
            if entries.iter().any(|entry| entry.name == name) {
                continue;
            }
            let dirent_type = if is_directory || mount.host_path.is_dir() {
                4
            } else if mount.host_path.is_file() {
                8
            } else {
                0
            };
            entries.push(DirEntryInfo {
                name: name.to_string(),
                ino: stable_inode(&mount.vfs_path),
                dirent_type,
            });
        }
    }

    fn append_internal_symlink_child_entries(&self, path: &str, entries: &mut Vec<DirEntryInfo>) {
        for root in &self.followed_symlink_roots {
            let root_vfs_path = internal_symlink_vfs_path(root);
            let Some((name, is_directory)) = direct_child_mount_name(path, &root_vfs_path) else {
                continue;
            };
            if entries.iter().any(|entry| entry.name == name) {
                continue;
            }
            let dirent_type = if is_directory || root.is_dir() { 4 } else { 8 };
            entries.push(DirEntryInfo {
                name: name.to_string(),
                ino: stable_inode(&format!("{path}/{name}")),
                dirent_type,
            });
        }
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

#[derive(Debug, Clone)]
struct DirEntryInfo {
    name: String,
    ino: u64,
    dirent_type: u8,
}

impl DirEntryInfo {
    fn directory(name: &str, ino: u64) -> Self {
        Self {
            name: name.to_string(),
            ino,
            dirent_type: 4,
        }
    }

    fn file(name: &str, ino: u64) -> Self {
        Self {
            name: name.to_string(),
            ino,
            dirent_type: 8,
        }
    }

    fn character(name: &str) -> Self {
        Self {
            name: name.to_string(),
            ino: stable_inode(name),
            dirent_type: 2,
        }
    }
}

fn vfs_mount_suffix<'a>(path: &'a str, mount_path: &str) -> Option<&'a str> {
    let mount_path = normalize_vfs_path(mount_path).ok()?;
    vfs_mount_suffix_normalized(path, &mount_path)
}

fn vfs_mount_suffix_normalized<'a>(path: &'a str, mount_path: &str) -> Option<&'a str> {
    if path == mount_path {
        return Some("");
    }
    path.strip_prefix(mount_path)
        .and_then(|suffix| suffix.strip_prefix('/'))
}

fn join_host_mount_path(host_path: &Path, suffix: &str) -> PathBuf {
    let mut path = host_path.to_path_buf();
    for part in suffix.split('/').filter(|part| !part.is_empty()) {
        path.push(part);
    }
    path
}

fn chmod_host_path(host_path: &Path, mode: i32) -> i32 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let metadata = match fs::metadata(host_path) {
            Ok(metadata) => metadata,
            Err(error) => return -fs_error_errno(&error),
        };
        let mut permissions = metadata.permissions();
        permissions.set_mode((mode as u32) & 0o7777);
        match fs::set_permissions(host_path, permissions) {
            Ok(_) => 0,
            Err(error) => -fs_error_errno(&error),
        }
    }

    #[cfg(not(unix))]
    {
        let _ = (host_path, mode);
        0
    }
}

fn create_host_symlink(target: &Path, linkpath: &Path) -> i32 {
    #[cfg(unix)]
    {
        match std::os::unix::fs::symlink(target, linkpath) {
            Ok(_) => 0,
            Err(error) => -fs_error_errno(&error),
        }
    }

    #[cfg(windows)]
    {
        let result = if target.is_dir() {
            std::os::windows::fs::symlink_dir(target, linkpath)
        } else {
            std::os::windows::fs::symlink_file(target, linkpath)
        };
        match result {
            Ok(_) => 0,
            Err(error) => -fs_error_errno(&error),
        }
    }
}

fn internal_symlink_vfs_path(host_path: &Path) -> String {
    let raw = host_path.to_string_lossy().replace('\\', "/");
    let relative = raw.trim_start_matches('/');
    normalize_vfs_path(&format!("/internal/symlinks/{relative}"))
        .unwrap_or_else(|_| "/internal/symlinks".to_string())
}

fn host_path_from_internal_symlink_vfs_path(path: &str) -> Option<PathBuf> {
    let suffix = if path == "/internal/symlinks" {
        ""
    } else {
        path.strip_prefix("/internal/symlinks/")?
    };
    if suffix.is_empty() {
        return None;
    }

    #[cfg(windows)]
    {
        Some(PathBuf::from(suffix.replace('/', "\\")))
    }
    #[cfg(not(windows))]
    {
        Some(PathBuf::from(format!("/{suffix}")))
    }
}

fn path_is_or_under(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn syscall_stat_path(
    caller: &mut Caller<'_, HostState>,
    path: &str,
    buf: i32,
    follow_final_symlink: bool,
) -> wasmtime::Result<i32> {
    let path = match caller.data().resolve_at(AT_FDCWD, path, false) {
        Ok(path) => path,
        Err(errno) => return Ok(-errno),
    };
    let stat = match caller
        .data()
        .stat_path_with_follow(&path, follow_final_symlink)
    {
        Ok(stat) => stat,
        Err(errno) => return Ok(-errno),
    };
    write_stat(caller, buf, &stat)?;
    Ok(0)
}

fn syscall_utimensat(
    caller: &mut Caller<'_, HostState>,
    dirfd: i32,
    path: &str,
    times_ptr: i32,
    flags: i32,
) -> wasmtime::Result<i32> {
    if flags & !(AT_EMPTY_PATH | AT_SYMLINK_NOFOLLOW) != 0 {
        return Ok(-EINVAL);
    }
    let resolved = match caller
        .data()
        .resolve_at(dirfd, path, flags & AT_EMPTY_PATH != 0)
    {
        Ok(path) => path,
        Err(errno) => return Ok(-errno),
    };
    if let Err(errno) = caller.data().stat_path(&resolved) {
        return Ok(-errno);
    }

    let times = match read_file_times(caller, times_ptr)? {
        Ok(times) => times,
        Err(errno) => return Ok(-errno),
    };
    let Some(times) = times else {
        return Ok(0);
    };
    let Some(host_path) = caller.data().resolve_host_path(&resolved) else {
        return Ok(0);
    };

    match fs::File::open(&host_path).and_then(|file| file.set_times(times)) {
        Ok(_) => Ok(0),
        Err(error) => Ok(-fs_error_errno(&error)),
    }
}

fn syscall_getdents64(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    dirp: i32,
    count: i32,
) -> wasmtime::Result<i32> {
    let max_entries = match usize::try_from(count) {
        Ok(count) => count / DIRENT64_SIZE,
        Err(_) => return Ok(-EINVAL),
    };
    let (path, start_index) = {
        let entry = match caller.data_mut().get_fd_mut(fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(-errno),
        };
        match entry {
            FdEntry::Directory { path, position } => (path.clone(), *position / DIRENT64_SIZE),
            _ => return Ok(-ENOTDIR),
        }
    };

    let entries = match caller.data().read_dir_entries(&path) {
        Ok(entries) => entries,
        Err(errno) => return Ok(-errno),
    };
    let end_index = entries.len().min(start_index.saturating_add(max_entries));
    let mut written = 0usize;
    for (entry_index, entry) in entries[start_index..end_index].iter().enumerate() {
        let offset = dirp + i32::try_from(entry_index * DIRENT64_SIZE).unwrap_or(i32::MAX);
        write_u64(caller, offset, entry.ino)?;
        write_u64(
            caller,
            offset + 8,
            u64::try_from((start_index + entry_index + 1) * DIRENT64_SIZE).unwrap_or(u64::MAX),
        )?;
        write_u16(caller, offset + 16, DIRENT64_SIZE as u16)?;
        write_u8(caller, offset + 18, entry.dirent_type)?;
        write_dirent_name(caller, offset + 19, &entry.name)?;
        written += DIRENT64_SIZE;
    }

    if let Ok(FdEntry::Directory { position, .. }) = caller.data_mut().get_fd_mut(fd) {
        *position = end_index * DIRENT64_SIZE;
    }

    Ok(i32::try_from(written).unwrap_or(i32::MAX))
}

fn syscall_fcntl64(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    cmd: i32,
    varargs: i32,
) -> wasmtime::Result<i32> {
    if caller.data().trace_enabled() {
        eprintln!("debug: host fcntl64 fd={fd} cmd={cmd} varargs={varargs:#x}");
    }
    if let Err(errno) = caller.data().get_fd(fd) {
        return Ok(-errno);
    }

    match cmd {
        F_DUPFD | F_DUPFD_CLOEXEC => Ok(caller.data_mut().dup_fd(fd)),
        F_GETFD => Ok(0),
        F_GETFL => match caller.data().status_flags(fd) {
            Ok(flags) => Ok(flags),
            Err(errno) => Ok(-errno),
        },
        F_SETFD => Ok(0),
        F_SETFL => {
            let flags = if varargs == 0 {
                0
            } else {
                read_i32(caller, varargs)?
            };
            let errno = caller.data_mut().set_status_flags(fd, flags);
            if errno == 0 {
                Ok(0)
            } else {
                Ok(-errno)
            }
        }
        F_SETLK | F_SETLKW | F_SETLK64 | F_SETLKW64 => {
            let flock_ptr = read_u32(caller, varargs)? as i32;
            if flock_ptr == 0 {
                return Ok(0);
            }
            let lock_request = read_fcntl_lock_request(caller, flock_ptr)?;
            let errno = if matches!(cmd, F_SETLKW | F_SETLKW64) {
                caller
                    .data()
                    .set_advisory_range_lock(fd, lock_request, true)
            } else {
                caller
                    .data()
                    .set_advisory_range_lock(fd, lock_request, false)
            };
            if errno == 0 {
                Ok(0)
            } else {
                Ok(-errno)
            }
        }
        F_GETLK | F_GETLK64 => {
            let flock_ptr = read_u32(caller, varargs)? as i32;
            if flock_ptr != 0 {
                let lock_request = read_fcntl_lock_request(caller, flock_ptr)?;
                let params_errno = caller
                    .data()
                    .check_advisory_lock_params(fd, lock_request.lock_type);
                if params_errno != 0 {
                    return Ok(-EINVAL);
                }
                if let Some(conflicting_lock) =
                    caller.data().conflicting_advisory_lock(fd, lock_request)
                {
                    write_fcntl_lock_conflict(caller, flock_ptr, &conflicting_lock)?;
                } else {
                    write_u16(caller, flock_ptr, F_UNLCK)?;
                }
            }
            Ok(0)
        }
        _ => Ok(-EINVAL),
    }
}

fn read_fcntl_lock_request(
    caller: &mut Caller<'_, HostState>,
    flock_ptr: i32,
) -> wasmtime::Result<FcntlLockRequest> {
    Ok(FcntlLockRequest {
        lock_type: read_u16(caller, flock_ptr)?,
        whence: read_u16(caller, flock_ptr + 2)?,
        start: read_i64(caller, flock_ptr + 8)?,
        len: read_i64(caller, flock_ptr + 16)?,
    })
}

fn write_fcntl_lock_conflict(
    caller: &mut Caller<'_, HostState>,
    flock_ptr: i32,
    lock: &AdvisoryLock,
) -> wasmtime::Result<()> {
    write_u16(caller, flock_ptr, lock.lock_type)?;
    write_u16(caller, flock_ptr + 2, SEEK_SET)?;
    match lock.scope {
        AdvisoryLockScope::Range(range) => {
            write_i64(caller, flock_ptr + 8, range.start as i64)?;
            write_i64(
                caller,
                flock_ptr + 16,
                range.end.saturating_sub(range.start) as i64,
            )?;
            write_u32(
                caller,
                flock_ptr + 24,
                i32::try_from(lock.owner_id).unwrap_or(i32::MAX) as u32,
            )?;
        }
        AdvisoryLockScope::WholeFile => {
            write_i64(caller, flock_ptr + 8, 0)?;
            write_i64(caller, flock_ptr + 16, 0)?;
            write_u32(caller, flock_ptr + 24, u32::MAX)?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Copy)]
struct AddrInfoHints {
    family: i32,
    socket_type: i32,
    protocol: i32,
}

fn getaddrinfo(
    caller: &mut Caller<'_, HostState>,
    node: i32,
    service: i32,
    hints: i32,
    out: i32,
) -> wasmtime::Result<i32> {
    if out == 0 {
        return Ok(EAI_NONAME);
    }
    write_u32(caller, out, 0)?;

    let hints = read_addrinfo_hints(caller, hints)?;
    let host = if node == 0 {
        if hints.family == AF_INET6 {
            "::1".to_string()
        } else {
            "127.0.0.1".to_string()
        }
    } else {
        let value = read_c_string(caller, node)?;
        if value.is_empty() {
            if hints.family == AF_INET6 {
                "::1".to_string()
            } else {
                "127.0.0.1".to_string()
            }
        } else {
            value
        }
    };
    let service = if service == 0 {
        None
    } else {
        Some(read_c_string(caller, service)?)
    };
    let port = match service_to_port(service.as_deref()) {
        Ok(port) => port,
        Err(error) => return Ok(error),
    };
    if hints.family != 0 && hints.family != AF_INET && hints.family != AF_INET6 {
        return Ok(EAI_NONAME);
    }
    if hints.socket_type != 0 && hints.socket_type != SOCK_STREAM && hints.socket_type != SOCK_DGRAM
    {
        return Ok(EAI_NONAME);
    }

    let socket_type = if hints.socket_type == 0 {
        SOCK_STREAM
    } else {
        hints.socket_type
    };
    let protocol = if hints.protocol == 0 && socket_type == SOCK_STREAM {
        IPPROTO_TCP
    } else {
        hints.protocol
    };
    if socket_type == SOCK_STREAM && protocol != 0 && protocol != IPPROTO_TCP {
        return Ok(EAI_NONAME);
    }

    let addrs = resolve_socket_addrs(&host, port, hints.family);
    if addrs.is_empty() {
        return Ok(EAI_NONAME);
    };

    let mut first_addrinfo = 0;
    let mut previous_addrinfo = None;
    for addr in addrs {
        let sockaddr_len = sockaddr_len(addr);
        let sockaddr = wasm_malloc(caller, sockaddr_len)? as i32;
        write_sockaddr(caller, sockaddr, addr, 0)?;

        let addrinfo = wasm_malloc(caller, 32)? as i32;
        write_bytes(caller, addrinfo, &[0; 32])?;
        write_u32(caller, addrinfo, 0)?;
        write_u32(caller, addrinfo + 4, socket_family(addr) as u32)?;
        write_u32(caller, addrinfo + 8, socket_type as u32)?;
        write_u32(caller, addrinfo + 12, protocol as u32)?;
        write_u32(caller, addrinfo + 16, sockaddr_len)?;
        write_u32(caller, addrinfo + 20, sockaddr as u32)?;
        write_u32(caller, addrinfo + 24, 0)?;
        write_u32(caller, addrinfo + 28, 0)?;
        if let Some(previous_addrinfo) = previous_addrinfo {
            write_u32(caller, previous_addrinfo + 28, addrinfo as u32)?;
        } else {
            first_addrinfo = addrinfo;
        }
        previous_addrinfo = Some(addrinfo);
    }
    write_u32(caller, out, first_addrinfo as u32)?;
    Ok(0)
}

fn read_addrinfo_hints(
    caller: &mut Caller<'_, HostState>,
    hints: i32,
) -> wasmtime::Result<AddrInfoHints> {
    if hints == 0 {
        return Ok(AddrInfoHints {
            family: 0,
            socket_type: 0,
            protocol: 0,
        });
    }
    Ok(AddrInfoHints {
        family: read_i32(caller, hints + 4)?,
        socket_type: read_i32(caller, hints + 8)? & SOCK_TYPE_MASK,
        protocol: read_i32(caller, hints + 12)?,
    })
}

fn service_to_port(service: Option<&str>) -> std::result::Result<u16, i32> {
    let Some(service) = service else {
        return Ok(0);
    };
    if service.is_empty() {
        return Ok(0);
    }
    match service {
        "http" => Ok(80),
        "https" => Ok(443),
        "ftp" => Ok(21),
        _ => service.parse::<u16>().map_err(|_| EAI_SERVICE),
    }
}

fn socket_family(addr: SocketAddr) -> i32 {
    match addr.ip() {
        IpAddr::V4(_) => AF_INET,
        IpAddr::V6(_) => AF_INET6,
    }
}

fn sockaddr_len(addr: SocketAddr) -> u32 {
    match addr.ip() {
        IpAddr::V4(_) => 16,
        IpAddr::V6(_) => 28,
    }
}

fn family_matches(family: i32, addr: SocketAddr) -> bool {
    family == 0 || family == socket_family(addr)
}

fn resolve_socket_addrs(host: &str, port: u16, family: i32) -> Vec<SocketAddr> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        let addr = SocketAddr::new(ip, port);
        return if family_matches(family, addr) {
            vec![addr]
        } else {
            Vec::new()
        };
    }
    (host, port)
        .to_socket_addrs()
        .map(|addrs| {
            addrs
                .filter(|addr| family_matches(family, *addr))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn emscripten_lookup_name(host: &str) -> u32 {
    resolve_socket_addrs(host, 0, AF_INET)
        .into_iter()
        .find_map(|addr| match addr.ip() {
            IpAddr::V4(ip) => Some(emscripten_inet_pton4(ip)),
            IpAddr::V6(_) => None,
        })
        .unwrap_or(0)
}

fn emscripten_inet_pton4(addr: Ipv4Addr) -> u32 {
    let octets = addr.octets();
    u32::from(octets[0])
        | (u32::from(octets[1]) << 8)
        | (u32::from(octets[2]) << 16)
        | (u32::from(octets[3]) << 24)
}

fn read_sockaddr(
    caller: &mut Caller<'_, HostState>,
    addr: i32,
    addrlen: i32,
) -> wasmtime::Result<std::result::Result<SocketAddr, i32>> {
    if addr == 0 {
        return Ok(Err(EINVAL));
    }
    let family = read_u16(caller, addr)?;
    match i32::from(family) {
        AF_INET => {
            if addrlen < 16 {
                return Ok(Err(EINVAL));
            }
            let port = u16::from_be(read_u16(caller, addr + 2)?);
            let octets = read_bytes(caller, addr + 4, 4)?;
            Ok(Ok(SocketAddr::new(
                IpAddr::V4(Ipv4Addr::new(octets[0], octets[1], octets[2], octets[3])),
                port,
            )))
        }
        AF_INET6 => {
            if addrlen < 28 {
                return Ok(Err(EINVAL));
            }
            let port = u16::from_be(read_u16(caller, addr + 2)?);
            let octets = read_bytes(caller, addr + 8, 16)?;
            let scope_id = read_u32(caller, addr + 24)?;
            Ok(Ok(SocketAddr::V6(std::net::SocketAddrV6::new(
                Ipv6Addr::from(<[u8; 16]>::try_from(octets).unwrap()),
                port,
                0,
                scope_id,
            ))))
        }
        _ => Ok(Err(EAFNOSUPPORT)),
    }
}

fn write_sockaddr(
    caller: &mut Caller<'_, HostState>,
    addr: i32,
    socket_addr: SocketAddr,
    addrlen: i32,
) -> wasmtime::Result<()> {
    if addr == 0 {
        return Ok(());
    }
    let len = sockaddr_len(socket_addr);
    write_bytes(caller, addr, &vec![0; len as usize])?;
    match socket_addr {
        SocketAddr::V4(socket_addr) => {
            write_u16(caller, addr, AF_INET as u16)?;
            write_u16(caller, addr + 2, socket_addr.port().to_be())?;
            write_bytes(caller, addr + 4, &socket_addr.ip().octets())?;
        }
        SocketAddr::V6(socket_addr) => {
            write_u16(caller, addr, AF_INET6 as u16)?;
            write_u16(caller, addr + 2, socket_addr.port().to_be())?;
            write_u32(caller, addr + 4, socket_addr.flowinfo())?;
            write_bytes(caller, addr + 8, &socket_addr.ip().octets())?;
            write_u32(caller, addr + 24, socket_addr.scope_id())?;
        }
    }
    if addrlen != 0 {
        write_u32(caller, addrlen, len)?;
    }
    Ok(())
}

fn socket2_domain(domain: i32) -> std::result::Result<SocketDomain, i32> {
    match domain {
        AF_INET => Ok(SocketDomain::IPV4),
        AF_INET6 => Ok(SocketDomain::IPV6),
        _ => Err(EAFNOSUPPORT),
    }
}

fn socket_bind_errno(error: &io::Error) -> i32 {
    match error.kind() {
        io::ErrorKind::AddrInUse => EADDRINUSE,
        io::ErrorKind::AddrNotAvailable => EADDRNOTAVAIL,
        io::ErrorKind::PermissionDenied => EACCES,
        io::ErrorKind::WouldBlock => EAGAIN,
        _ => EINVAL,
    }
}

fn socket_accept_errno(error: &io::Error) -> i32 {
    match error.kind() {
        io::ErrorKind::WouldBlock => EAGAIN,
        io::ErrorKind::ConnectionAborted => ECONNABORTED,
        io::ErrorKind::PermissionDenied => EACCES,
        _ => EINVAL,
    }
}

fn socket_addr_from_sockaddr(addr: &SockAddr) -> std::result::Result<SocketAddr, i32> {
    addr.as_socket().ok_or(EINVAL)
}

fn syscall_bind(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    addr: i32,
    addrlen: i32,
) -> wasmtime::Result<i32> {
    let local = match read_sockaddr(caller, addr, addrlen)? {
        Ok(local) => local,
        Err(errno) => return Ok(-errno),
    };
    let server_socket = {
        let socket = match caller.data().get_socket(fd) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        if socket.socket_type != SOCK_STREAM {
            return Ok(-EOPNOTSUPP);
        }
        if socket.stream.is_some() || socket.pending_connect.is_some() || socket.server.is_some() {
            return Ok(-EISCONN);
        }
        if !family_matches(socket.domain, local) {
            return Ok(-EAFNOSUPPORT);
        }
        let domain = match socket2_domain(socket.domain) {
            Ok(domain) => domain,
            Err(errno) => return Ok(-errno),
        };
        let server_socket =
            match Socket2::new(domain, SocketType::STREAM, Some(SocketProtocol::TCP)) {
                Ok(socket) => socket,
                Err(error) => return Ok(-socket_bind_errno(&error)),
            };
        let _ = server_socket.set_reuse_address(true);
        if let Err(error) = server_socket.bind(&SockAddr::from(local)) {
            return Ok(-socket_bind_errno(&error));
        }
        if let Err(error) = server_socket.set_nonblocking(socket.nonblocking) {
            return Ok(-socket_bind_errno(&error));
        }
        server_socket
    };

    let actual_local = server_socket
        .local_addr()
        .ok()
        .and_then(|addr| addr.as_socket())
        .unwrap_or(local);
    let socket = match caller.data_mut().get_socket_mut(fd) {
        Ok(socket) => socket,
        Err(errno) => return Ok(-errno),
    };
    socket.local = Some(actual_local);
    socket.error = 0;
    socket.server = Some(TcpServerSocket {
        socket: server_socket,
        listening: false,
        pending_accepts: VecDeque::new(),
    });
    Ok(0)
}

fn syscall_listen(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    backlog: i32,
) -> wasmtime::Result<i32> {
    let socket = match caller.data_mut().get_socket_mut(fd) {
        Ok(socket) => socket,
        Err(errno) => return Ok(-errno),
    };
    if socket.socket_type != SOCK_STREAM {
        return Ok(-EOPNOTSUPP);
    }
    let Some(server) = socket.server.as_mut() else {
        return Ok(-EINVAL);
    };
    match server.socket.listen(backlog.max(0)) {
        Ok(_) => {
            server.listening = true;
            socket.error = 0;
            socket.local = server
                .socket
                .local_addr()
                .ok()
                .and_then(|addr| addr.as_socket());
            Ok(0)
        }
        Err(error) => {
            let errno = socket_bind_errno(&error);
            socket.error = errno;
            Ok(-errno)
        }
    }
}

fn syscall_accept4(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    addr: i32,
    addrlen: i32,
    flags: i32,
) -> wasmtime::Result<i32> {
    if flags & !(O_NONBLOCK | SOCK_CLOEXEC) != 0 {
        return Ok(-EINVAL);
    }
    let accepted = {
        let socket = match caller.data_mut().get_socket_mut(fd) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        if socket.socket_type != SOCK_STREAM {
            return Ok(-EOPNOTSUPP);
        }
        let Some(server) = socket.server.as_mut() else {
            return Ok(-EINVAL);
        };
        if !server.listening {
            return Ok(-EINVAL);
        }
        if let Some(accepted) = server.pending_accepts.pop_front() {
            accepted
        } else {
            let (accepted_socket, peer) = match server.socket.accept() {
                Ok(accepted) => accepted,
                Err(error) => {
                    let errno = socket_accept_errno(&error);
                    if errno != EAGAIN {
                        socket.error = errno;
                    }
                    return Ok(-errno);
                }
            };
            let peer = match socket_addr_from_sockaddr(&peer) {
                Ok(peer) => peer,
                Err(errno) => return Ok(-errno),
            };
            AcceptedConnection {
                stream: accepted_socket.into(),
                peer,
            }
        }
    };

    let peer = accepted.peer;
    let accepted_fd = match accepted_stream_to_fd(caller.data_mut(), fd, accepted, flags) {
        Ok(fd) => fd,
        Err(errno) => return Ok(-errno),
    };
    write_sockaddr(caller, addr, peer, addrlen)?;
    Ok(accepted_fd)
}

fn accepted_stream_to_fd(
    state: &mut HostState,
    parent_fd: i32,
    accepted: AcceptedConnection,
    flags: i32,
) -> std::result::Result<i32, i32> {
    let parent = state.get_socket(parent_fd)?;
    let nonblocking = parent.nonblocking || flags & O_NONBLOCK != 0;
    let receive_timeout = parent.receive_timeout;
    let send_timeout = parent.send_timeout;
    let domain = parent.domain;
    let stream = accepted.stream;
    let _ = stream.set_read_timeout(receive_timeout);
    let _ = stream.set_write_timeout(send_timeout);
    let _ = stream.set_nodelay(true);
    stream.set_nonblocking(nonblocking).map_err(|_| EINVAL)?;
    let local = stream.local_addr().ok();
    let socket_id = state.next_socket_id;
    state.next_socket_id = state.next_socket_id.saturating_add(1);
    let fd = state.alloc_fd(FdEntry::Socket { socket_id });
    state.sockets.insert(
        socket_id,
        SocketEntry {
            domain,
            socket_type: SOCK_STREAM,
            stream: Some(stream),
            server: None,
            pending_connect: None,
            peer: Some(accepted.peer),
            local,
            error: 0,
            nonblocking,
            receive_timeout,
            send_timeout,
        },
    );
    Ok(fd)
}

fn queue_pending_accept(socket: &mut SocketEntry) -> bool {
    let Some(server) = socket.server.as_mut() else {
        return false;
    };
    if !server.listening {
        return false;
    }
    if !server.pending_accepts.is_empty() {
        return true;
    }
    if !socket.nonblocking && server.socket.set_nonblocking(true).is_err() {
        socket.error = EINVAL;
        return false;
    }
    let accepted = server.socket.accept();
    if !socket.nonblocking {
        let _ = server.socket.set_nonblocking(false);
    }
    match accepted {
        Ok((accepted_socket, peer)) => {
            let Ok(peer) = socket_addr_from_sockaddr(&peer) else {
                socket.error = EINVAL;
                return false;
            };
            server.pending_accepts.push_back(AcceptedConnection {
                stream: accepted_socket.into(),
                peer,
            });
            socket.error = 0;
            true
        }
        Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
            if socket.error == EAGAIN {
                socket.error = 0;
            }
            false
        }
        Err(error) => {
            socket.error = socket_accept_errno(&error);
            false
        }
    }
}

fn syscall_connect(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    addr: i32,
    addrlen: i32,
) -> wasmtime::Result<i32> {
    let peer = match read_sockaddr(caller, addr, addrlen)? {
        Ok(peer) => peer,
        Err(errno) => return Ok(-errno),
    };
    let timeout = {
        let socket = match caller.data().get_socket(fd) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        if socket.socket_type != SOCK_STREAM {
            return Ok(-EOPNOTSUPP);
        }
        if socket.stream.is_some() {
            return Ok(-EISCONN);
        }
        if socket.server.is_some() {
            return Ok(-EINVAL);
        }
        if socket.pending_connect.is_some() {
            return Ok(-EALREADY);
        }
        if !family_matches(socket.domain, peer) {
            return Ok(-EAFNOSUPPORT);
        }
        socket.send_timeout.unwrap_or(DEFAULT_SOCKET_TIMEOUT)
    };

    if caller
        .data()
        .get_socket(fd)
        .is_ok_and(|socket| socket.nonblocking)
    {
        let stream = match MioTcpStream::connect(peer) {
            Ok(stream) => stream,
            Err(error) => {
                let errno = if connection_still_pending(&error) {
                    EAGAIN
                } else {
                    io_error_errno(&error)
                };
                if let Ok(socket) = caller.data_mut().get_socket_mut(fd) {
                    socket.error = errno;
                }
                return Ok(-errno);
            }
        };
        let socket = match caller.data_mut().get_socket_mut(fd) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        socket.pending_connect = Some(PendingConnect { peer, stream });
        socket.peer = Some(peer);
        socket.local = None;
        socket.error = 0;
        return Ok(-EINPROGRESS);
    }

    match TcpStream::connect_timeout(&peer, timeout) {
        Ok(stream) => {
            let socket = match caller.data_mut().get_socket_mut(fd) {
                Ok(socket) => socket,
                Err(errno) => return Ok(-errno),
            };
            let _ = stream.set_read_timeout(socket.receive_timeout);
            let _ = stream.set_write_timeout(socket.send_timeout);
            let _ = stream.set_nodelay(true);
            let _ = stream.set_nonblocking(socket.nonblocking);
            socket.local = stream.local_addr().ok();
            socket.peer = Some(peer);
            socket.error = 0;
            socket.stream = Some(stream);
            Ok(0)
        }
        Err(error) => {
            let errno = io_error_errno(&error);
            if let Ok(socket) = caller.data_mut().get_socket_mut(fd) {
                socket.error = errno;
            }
            Ok(-errno)
        }
    }
}

fn syscall_sendto(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    message: i32,
    length: i32,
    _flags: i32,
    addr: i32,
    addr_len: i32,
) -> wasmtime::Result<i32> {
    let length = match usize::try_from(length) {
        Ok(length) => length,
        Err(_) => return Ok(-EINVAL),
    };
    if addr != 0 {
        match read_sockaddr(caller, addr, addr_len)? {
            Ok(_) => {}
            Err(errno) => return Ok(-errno),
        }
    }
    let bytes = read_bytes(caller, message, length)?;
    match socket_write_bytes(caller.data_mut(), fd, &bytes) {
        Ok(written) => Ok(written as i32),
        Err(errno) => Ok(-errno),
    }
}

fn syscall_recvfrom(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    buf: i32,
    len: i32,
    flags: i32,
    addr: i32,
    addrlen: i32,
) -> wasmtime::Result<i32> {
    let len = match usize::try_from(len) {
        Ok(len) => len,
        Err(_) => return Ok(-EINVAL),
    };
    if len == 0 {
        return Ok(0);
    }
    let peek = flags & 2 != 0;
    let (bytes, peer) = match socket_read_bytes(caller.data_mut(), fd, len, peek) {
        Ok(result) => result,
        Err(errno) => return Ok(-errno),
    };
    if addr != 0 && addrlen != 0 {
        if let Some(peer) = peer {
            write_sockaddr(caller, addr, peer, addrlen)?;
        }
    }
    write_bytes(caller, buf, &bytes)?;
    Ok(bytes.len() as i32)
}

fn syscall_getsockopt(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    level: i32,
    optname: i32,
    optval: i32,
    optlen: i32,
) -> wasmtime::Result<i32> {
    if level != SOL_SOCKET || optname != SO_ERROR {
        return Ok(-ENOPROTOOPT);
    }
    if optval == 0 || optlen == 0 {
        return Ok(-EINVAL);
    }
    if let Err(errno) = caller.data_mut().finish_pending_connect(fd) {
        return Ok(-errno);
    }
    let error = {
        let socket = match caller.data_mut().get_socket_mut(fd) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        let error = socket.error;
        socket.error = 0;
        error
    };
    write_u32(caller, optval, error as u32)?;
    write_u32(caller, optlen, 4)?;
    Ok(0)
}

fn syscall_getsockname(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    addr: i32,
    addrlen: i32,
) -> wasmtime::Result<i32> {
    let local = match caller.data().get_socket(fd) {
        Ok(socket) => socket.local.unwrap_or_else(|| {
            if socket.domain == AF_INET6 {
                SocketAddr::new(IpAddr::V6(Ipv6Addr::UNSPECIFIED), 0)
            } else {
                SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 0)
            }
        }),
        Err(errno) => return Ok(-errno),
    };
    write_sockaddr(caller, addr, local, addrlen)?;
    Ok(0)
}

fn syscall_getpeername(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    addr: i32,
    addrlen: i32,
) -> wasmtime::Result<i32> {
    match caller.data_mut().finish_pending_connect(fd) {
        Ok(true) => {}
        Ok(false) => return Ok(-EAGAIN),
        Err(errno) => return Ok(-errno),
    }
    let peer = match caller.data().get_socket(fd) {
        Ok(socket) if socket.stream.is_some() => socket.peer,
        Ok(_) => return Ok(-ENOTCONN),
        Err(errno) => return Ok(-errno),
    };
    let Some(peer) = peer else {
        return Ok(-ENOTCONN);
    };
    write_sockaddr(caller, addr, peer, addrlen)?;
    Ok(0)
}

#[derive(Debug, Clone, Copy)]
struct GetNameInfoArgs {
    sa: i32,
    salen: i32,
    node: i32,
    nodelen: i32,
    serv: i32,
    servlen: i32,
    flags: i32,
}

fn syscall_getnameinfo(
    caller: &mut Caller<'_, HostState>,
    args: GetNameInfoArgs,
) -> wasmtime::Result<i32> {
    let socket_addr = match read_sockaddr(caller, args.sa, args.salen)? {
        Ok(socket_addr) => socket_addr,
        Err(_) => return Ok(EAI_NONAME),
    };

    if args.node != 0 && args.nodelen > 0 && args.flags & 8 != 0 {
        return Ok(EAI_NONAME);
    }

    let mut overflowed = false;
    if args.node != 0 && args.nodelen > 0 {
        overflowed |= write_c_string_bounded(
            caller,
            args.node,
            args.nodelen,
            &socket_addr.ip().to_string(),
        )?;
    }
    if args.serv != 0 && args.servlen > 0 {
        overflowed |= write_c_string_bounded(
            caller,
            args.serv,
            args.servlen,
            &socket_addr.port().to_string(),
        )?;
    }

    if overflowed {
        Ok(EAI_OVERFLOW)
    } else {
        Ok(0)
    }
}

fn syscall_poll(
    caller: &mut Caller<'_, HostState>,
    fds: i32,
    nfds: i32,
    timeout: i32,
) -> wasmtime::Result<i32> {
    let nfds = match usize::try_from(nfds) {
        Ok(nfds) => nfds,
        Err(_) => return Ok(-EINVAL),
    };
    let mut poll_fds = Vec::with_capacity(nfds);
    for index in 0..nfds {
        let base = fds + (index as i32 * 8);
        let fd = read_i32(caller, base)?;
        let events = read_u16(caller, base + 4)?;
        poll_fds.push((base + 6, fd, events));
    }

    let deadline = poll_deadline(timeout);
    let (mut updates, ready) = loop {
        let mut updates = Vec::with_capacity(nfds);
        let mut ready = 0i32;
        for (revents_ptr, fd, events) in &poll_fds {
            let revents = poll_fd(caller.data_mut(), *fd, *events);
            if revents != 0 {
                ready += 1;
            }
            updates.push((*revents_ptr, revents));
        }
        if ready != 0 || timeout == 0 || poll_timed_out(deadline) {
            break (updates, ready);
        }
        sleep_until_next_poll(deadline);
    };

    for (ptr, revents) in updates.drain(..) {
        write_u16(caller, ptr, revents)?;
    }
    Ok(ready)
}

fn poll_deadline(timeout: i32) -> Option<Instant> {
    if timeout < 0 {
        None
    } else {
        Some(Instant::now() + Duration::from_millis(timeout as u64))
    }
}

fn poll_timed_out(deadline: Option<Instant>) -> bool {
    deadline.is_some_and(|deadline| Instant::now() >= deadline)
}

fn sleep_until_next_poll(deadline: Option<Instant>) {
    let sleep_for = match deadline {
        Some(deadline) => deadline
            .saturating_duration_since(Instant::now())
            .min(Duration::from_millis(10)),
        None => Duration::from_millis(10),
    };
    if !sleep_for.is_zero() {
        thread::sleep(sleep_for);
    }
}

fn poll_until_ready(state: &mut HostState, fd: i32, events: u16, timeout: i32) -> u16 {
    let deadline = poll_deadline(timeout);
    loop {
        let revents = poll_fd(state, fd, events);
        if revents != 0 {
            return revents;
        }
        if timeout == 0 || poll_timed_out(deadline) {
            return 0;
        }
        sleep_until_next_poll(deadline);
    }
}

fn wasm_setsockopt(
    caller: &mut Caller<'_, HostState>,
    socket: i32,
    level: i32,
    option_name: i32,
    option_value: i32,
    option_len: i32,
) -> wasmtime::Result<i32> {
    if level == SOL_SOCKET && (option_name == SO_RCVTIMEO || option_name == SO_SNDTIMEO) {
        let Some(timeout) = read_socket_timeout(caller, option_value, option_len)? else {
            return Ok(-EINVAL);
        };
        let socket = match caller.data_mut().get_socket_mut(socket) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        if option_name == SO_RCVTIMEO {
            socket.receive_timeout = timeout;
            if let Some(stream) = socket.stream.as_ref() {
                let _ = stream.set_read_timeout(timeout);
            }
        } else {
            socket.send_timeout = timeout;
            if let Some(stream) = socket.stream.as_ref() {
                let _ = stream.set_write_timeout(timeout);
            }
        }
        return Ok(0);
    }

    if level == SOL_SOCKET && option_name == SO_KEEPALIVE {
        return Ok(0);
    }
    if level == IPPROTO_TCP && option_name == TCP_NODELAY {
        let value = if option_value == 0 {
            true
        } else {
            read_bytes(caller, option_value, 1)?
                .first()
                .copied()
                .unwrap_or(1)
                != 0
        };
        let socket = match caller.data_mut().get_socket_mut(socket) {
            Ok(socket) => socket,
            Err(errno) => return Ok(-errno),
        };
        if let Some(stream) = socket.stream.as_ref() {
            let _ = stream.set_nodelay(value);
        }
        return Ok(0);
    }

    Ok(-ENOPROTOOPT)
}

fn wasm_poll_socket(
    caller: &mut Caller<'_, HostState>,
    socket: i32,
    events: i32,
    timeout: i32,
) -> i32 {
    let events = events as u16;
    let revents = poll_until_ready(caller.data_mut(), socket, events, timeout);
    if revents & (events | POLLERR | POLLHUP | POLLNVAL) != 0 {
        1
    } else {
        0
    }
}

fn wasm_shutdown(caller: &mut Caller<'_, HostState>, socket: i32, how: i32) -> i32 {
    let shutdown = match how {
        0 => Shutdown::Read,
        1 => Shutdown::Write,
        _ => Shutdown::Both,
    };
    match caller.data_mut().get_socket_mut(socket) {
        Ok(socket) => {
            if let Some(stream) = socket.stream.as_ref() {
                stream.shutdown(shutdown).map_or(-EINVAL, |_| 0)
            } else {
                -ENOTCONN
            }
        }
        Err(errno) => -errno,
    }
}

fn read_socket_timeout(
    caller: &mut Caller<'_, HostState>,
    option_value: i32,
    option_len: i32,
) -> wasmtime::Result<Option<Option<Duration>>> {
    if option_value == 0 || option_len < 8 {
        return Ok(None);
    }
    let (seconds, microseconds) = if option_len >= 16 {
        (
            read_u64(caller, option_value)?,
            read_u64(caller, option_value + 8)?,
        )
    } else {
        (
            u64::from(read_u32(caller, option_value)?),
            u64::from(read_u32(caller, option_value + 4)?),
        )
    };
    let Some(millis_from_seconds) = seconds.checked_mul(1000) else {
        return Ok(None);
    };
    let millis = millis_from_seconds.saturating_add(microseconds.div_ceil(1000));
    if millis == 0 {
        Ok(Some(None))
    } else {
        Ok(Some(Some(Duration::from_millis(millis))))
    }
}

#[allow(clippy::too_many_arguments)]
fn js_open_process(
    caller: &mut Caller<'_, HostState>,
    command_ptr: i32,
    args_ptr: i32,
    args_length: i32,
    descriptors_ptr: i32,
    descriptors_length: i32,
    cwd_ptr: i32,
    cwd_length: i32,
    env_ptr: i32,
    env_length: i32,
) -> wasmtime::Result<i32> {
    if command_ptr == 0 {
        set_errno(caller, EINVAL)?;
        return Ok(-1);
    }
    let command = read_c_string(caller, command_ptr)?;
    if command.is_empty() {
        set_errno(caller, EINVAL)?;
        return Ok(-1);
    }
    let args = read_string_array(caller, args_ptr, args_length)?;
    let descriptors = read_process_descriptors(caller, descriptors_ptr, descriptors_length)?;
    let cwd = if cwd_ptr == 0 {
        None
    } else {
        Some(read_c_string_with_optional_len(
            caller, cwd_ptr, cwd_length,
        )?)
    };
    let env = if env_length == 0 {
        None
    } else {
        Some(read_env_array(caller, env_ptr, env_length)?)
    };

    let result = caller.data_mut().spawn_process(
        &command,
        &args,
        &descriptors,
        cwd.as_deref(),
        env.as_deref(),
    );
    match result {
        Ok(pid) => Ok(pid),
        Err(errno) => {
            set_errno(caller, errno)?;
            Ok(-1)
        }
    }
}

fn read_string_array(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    length: i32,
) -> wasmtime::Result<Vec<String>> {
    let length = usize::try_from(length)
        .map_err(|_| wasmtime::Error::msg("string array length cannot be negative"))?;
    if length == 0 {
        return Ok(Vec::new());
    }
    if ptr == 0 {
        return Err(wasmtime::Error::msg("string array pointer is null"));
    }
    let mut strings = Vec::with_capacity(length);
    for index in 0..length {
        let string_ptr = read_u32(caller, ptr + (index as i32 * 4))? as i32;
        if string_ptr == 0 {
            return Err(wasmtime::Error::msg("string array contains null pointer"));
        }
        strings.push(read_c_string(caller, string_ptr)?);
    }
    Ok(strings)
}

fn read_env_array(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    length: i32,
) -> wasmtime::Result<Vec<(String, String)>> {
    let entries = read_string_array(caller, ptr, length)?;
    let mut env = Vec::new();
    for entry in entries {
        let Some((key, value)) = entry.split_once('=') else {
            continue;
        };
        if !key.is_empty() {
            env.push((key.to_string(), value.to_string()));
        }
    }
    Ok(env)
}

fn read_process_descriptors(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    length: i32,
) -> wasmtime::Result<Vec<ProcessDescriptor>> {
    let length = usize::try_from(length)
        .map_err(|_| wasmtime::Error::msg("descriptor length cannot be negative"))?;
    if length == 0 {
        return Ok(Vec::new());
    }
    if ptr == 0 {
        return Err(wasmtime::Error::msg("descriptor array pointer is null"));
    }
    let mut descriptors = Vec::with_capacity(length);
    for index in 0..length {
        let descriptor_ptr = read_u32(caller, ptr + (index as i32 * 4))? as i32;
        if descriptor_ptr == 0 {
            return Err(wasmtime::Error::msg("descriptor pointer is null"));
        }
        descriptors.push(ProcessDescriptor {
            target_fd: read_i32(caller, descriptor_ptr)?,
            child_fd: read_i32(caller, descriptor_ptr + 4)?,
            parent_fd: read_i32(caller, descriptor_ptr + 8)?,
        });
    }
    Ok(descriptors)
}

fn read_c_string_with_optional_len(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    len: i32,
) -> wasmtime::Result<String> {
    if len <= 0 {
        return read_c_string(caller, ptr);
    }
    let len =
        usize::try_from(len).map_err(|_| wasmtime::Error::msg("string length is negative"))?;
    let bytes = read_bytes(caller, ptr, len)?;
    String::from_utf8(bytes)
        .map_err(|error| wasmtime::Error::msg(format!("invalid UTF-8: {error}")))
}

fn split_simple_process_command(command: &str) -> std::result::Result<(String, Vec<String>), i32> {
    let command = command.trim();
    if command.is_empty() {
        return Err(EINVAL);
    }
    if command.bytes().any(|byte| {
        matches!(
            byte,
            b';' | b'|' | b'&' | b'<' | b'>' | b'$' | b'`' | b'\n' | b'\r'
        )
    }) {
        return Err(EACCES);
    }
    if command
        .bytes()
        .any(|byte| matches!(byte, b'\'' | b'"' | b'\\'))
    {
        return Err(EACCES);
    }
    let mut parts = command.split_whitespace();
    let command = parts.next().ok_or(EINVAL)?.to_string();
    let args = parts.map(str::to_string).collect();
    Ok((command, args))
}

#[derive(Debug, Clone, Copy)]
struct TmFields {
    sec: i32,
    min: i32,
    hour: i32,
    mday: i32,
    mon: i32,
    year: i32,
    isdst: i32,
    gmtoff: i32,
}

fn read_tm(caller: &mut Caller<'_, HostState>, tm_ptr: i32) -> wasmtime::Result<TmFields> {
    Ok(TmFields {
        sec: read_i32(caller, tm_ptr)?,
        min: read_i32(caller, tm_ptr + 4)?,
        hour: read_i32(caller, tm_ptr + 8)?,
        mday: read_i32(caller, tm_ptr + 12)?,
        mon: read_i32(caller, tm_ptr + 16)?,
        year: read_i32(caller, tm_ptr + 20)?,
        isdst: read_i32(caller, tm_ptr + 32)?,
        gmtoff: read_i32(caller, tm_ptr + 36)?,
    })
}

fn write_tm_utc(
    caller: &mut Caller<'_, HostState>,
    tm_ptr: i32,
    timestamp: i64,
    gmtoff: i32,
) -> wasmtime::Result<()> {
    let days = timestamp.div_euclid(86_400);
    let seconds_of_day = timestamp.rem_euclid(86_400);
    let (year, month, mday) = civil_from_days(days);
    write_tm_fields(
        caller,
        tm_ptr,
        TmFields {
            sec: (seconds_of_day % 60) as i32,
            min: ((seconds_of_day / 60) % 60) as i32,
            hour: (seconds_of_day / 3600) as i32,
            mday,
            mon: month - 1,
            year: year - 1900,
            isdst: 0,
            gmtoff,
        },
    )
}

fn write_tm_fields(
    caller: &mut Caller<'_, HostState>,
    tm_ptr: i32,
    fields: TmFields,
) -> wasmtime::Result<()> {
    let year = fields.year + 1900;
    let month = fields.mon + 1;
    let days = days_from_civil(year, month, fields.mday);
    write_i32(caller, tm_ptr, fields.sec)?;
    write_i32(caller, tm_ptr + 4, fields.min)?;
    write_i32(caller, tm_ptr + 8, fields.hour)?;
    write_i32(caller, tm_ptr + 12, fields.mday)?;
    write_i32(caller, tm_ptr + 16, fields.mon)?;
    write_i32(caller, tm_ptr + 20, fields.year)?;
    write_i32(caller, tm_ptr + 24, weekday_from_days(days))?;
    write_i32(caller, tm_ptr + 28, yday_from_days(year, days))?;
    write_i32(caller, tm_ptr + 32, fields.isdst)?;
    write_i32(caller, tm_ptr + 36, fields.gmtoff)
}

fn mktime_utc(caller: &mut Caller<'_, HostState>, tm_ptr: i32) -> wasmtime::Result<i64> {
    let tm = read_tm(caller, tm_ptr)?;
    let timestamp = timestamp_from_tm(tm);
    write_tm_utc(caller, tm_ptr, timestamp, 0)?;
    Ok(timestamp)
}

fn timestamp_from_tm(tm: TmFields) -> i64 {
    let mut year = tm.year + 1900;
    let normalized_month = tm.mon.div_euclid(12);
    year += normalized_month;
    let month = tm.mon.rem_euclid(12) + 1;
    let days = days_from_civil(year, month, 1) + i64::from(tm.mday - 1);
    days * 86_400 + i64::from(tm.hour) * 3600 + i64::from(tm.min) * 60 + i64::from(tm.sec)
}

fn civil_from_days(days: i64) -> (i32, i32, i32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 }.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    (year as i32, month as i32, day as i32)
}

fn days_from_civil(year: i32, month: i32, day: i32) -> i64 {
    let mut year = i64::from(year);
    let month = i64::from(month);
    let day = i64::from(day);
    year -= i64::from(month <= 2);
    let era = if year >= 0 { year } else { year - 399 }.div_euclid(400);
    let yoe = year - era * 400;
    let month_prime = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * month_prime + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn weekday_from_days(days: i64) -> i32 {
    (days + 4).rem_euclid(7) as i32
}

fn yday_from_days(year: i32, days: i64) -> i32 {
    (days - days_from_civil(year, 1, 1)) as i32
}

fn strptime_utc(
    caller: &mut Caller<'_, HostState>,
    buf: i32,
    format: i32,
    tm: i32,
) -> wasmtime::Result<i32> {
    if buf == 0 || format == 0 || tm == 0 {
        return Ok(0);
    }
    let input = read_c_string_bytes(caller, buf)?;
    let format = read_c_string_bytes(caller, format)?;
    let initial = read_tm(caller, tm)?;
    let mut parsed = StrptimeState::from_tm(initial);
    let Some(consumed) = parse_strptime_format(&format, &input, 0, &mut parsed) else {
        return Ok(0);
    };
    let fields = parsed.into_tm_fields();
    let timestamp = timestamp_from_tm(fields);
    write_tm_utc(caller, tm, timestamp, fields.gmtoff)?;
    Ok(buf + consumed as i32)
}

#[derive(Debug, Clone)]
struct StrptimeState {
    year: i32,
    month: i32,
    day: i32,
    hour: i32,
    min: i32,
    sec: i32,
    gmtoff: i32,
    century: Option<i32>,
    two_digit_year: Option<i32>,
    hour12: Option<i32>,
    pm: Option<bool>,
    yday: Option<i32>,
}

impl StrptimeState {
    fn from_tm(tm: TmFields) -> Self {
        Self {
            year: (tm.year + 1900).clamp(1970, 9999),
            month: tm.mon.clamp(0, 11),
            day: tm.mday.clamp(1, 31),
            hour: tm.hour.clamp(0, 23),
            min: tm.min.clamp(0, 59),
            sec: tm.sec.clamp(0, 60),
            gmtoff: 0,
            century: None,
            two_digit_year: None,
            hour12: None,
            pm: None,
            yday: None,
        }
    }

    fn into_tm_fields(mut self) -> TmFields {
        if let Some(year) = self.two_digit_year {
            self.year = if let Some(century) = self.century {
                century * 100 + year
            } else if year < 69 {
                2000 + year
            } else {
                1900 + year
            };
        }
        if let Some(hour12) = self.hour12 {
            self.hour = hour12 + i32::from(self.pm.unwrap_or(false)) * 12;
        }
        if let Some(yday) = self.yday {
            let days = days_from_civil(self.year, 1, 1) + i64::from(yday - 1);
            let (year, month, day) = civil_from_days(days);
            self.year = year;
            self.month = month - 1;
            self.day = day;
        }
        TmFields {
            sec: self.sec,
            min: self.min,
            hour: self.hour,
            mday: self.day,
            mon: self.month,
            year: self.year - 1900,
            isdst: 0,
            gmtoff: self.gmtoff,
        }
    }
}

fn parse_strptime_format(
    format: &[u8],
    input: &[u8],
    mut pos: usize,
    state: &mut StrptimeState,
) -> Option<usize> {
    let mut index = 0usize;
    while index < format.len() {
        let byte = format[index];
        if byte.is_ascii_whitespace() {
            while index < format.len() && format[index].is_ascii_whitespace() {
                index += 1;
            }
            while pos < input.len() && input[pos].is_ascii_whitespace() {
                pos += 1;
            }
            continue;
        }
        if byte != b'%' {
            if pos >= input.len() || !input[pos].eq_ignore_ascii_case(&byte) {
                return None;
            }
            index += 1;
            pos += 1;
            continue;
        }
        index += 1;
        if index >= format.len() {
            return None;
        }
        let directive = format[index];
        index += 1;
        pos = parse_strptime_directive(directive, input, pos, state)?;
    }
    Some(pos)
}

fn parse_strptime_directive(
    directive: u8,
    input: &[u8],
    pos: usize,
    state: &mut StrptimeState,
) -> Option<usize> {
    match directive {
        b'%' => {
            if input.get(pos).copied() == Some(b'%') {
                Some(pos + 1)
            } else {
                None
            }
        }
        b'Y' => parse_fixed_digits(input, pos, 4).map(|(value, pos)| {
            state.year = value;
            pos
        }),
        b'y' => parse_fixed_digits(input, pos, 2).map(|(value, pos)| {
            state.two_digit_year = Some(value);
            pos
        }),
        b'C' => parse_fixed_digits(input, pos, 2).map(|(value, pos)| {
            state.century = Some(value);
            pos
        }),
        b'm' => parse_number_range(input, pos, 1, 2, 1, 12).map(|(value, pos)| {
            state.month = value - 1;
            pos
        }),
        b'd' | b'e' => parse_number_range(input, pos, 1, 2, 1, 31).map(|(value, pos)| {
            state.day = value;
            pos
        }),
        b'H' => parse_number_range(input, pos, 1, 2, 0, 23).map(|(value, pos)| {
            state.hour = value;
            pos
        }),
        b'I' => parse_number_range(input, pos, 1, 2, 0, 12).map(|(value, pos)| {
            state.hour12 = Some(value);
            pos
        }),
        b'M' => parse_number_range(input, pos, 1, 2, 0, 59).map(|(value, pos)| {
            state.min = value;
            pos
        }),
        b'S' => parse_number_range(input, pos, 1, 2, 0, 60).map(|(value, pos)| {
            state.sec = value;
            pos
        }),
        b'j' => parse_number_range(input, pos, 1, 3, 1, 366).map(|(value, pos)| {
            state.yday = Some(value);
            pos
        }),
        b'p' => parse_ampm(input, pos).map(|(pm, pos)| {
            state.pm = Some(pm);
            pos
        }),
        b'b' | b'B' | b'h' => parse_month_name(input, pos).map(|(month, pos)| {
            state.month = month;
            pos
        }),
        b'a' | b'A' => parse_weekday_name(input, pos),
        b'w' => parse_number_range(input, pos, 1, 1, 0, 6).map(|(_, pos)| pos),
        b'U' | b'W' => parse_number_range(input, pos, 1, 2, 0, 53).map(|(_, pos)| pos),
        b'z' => parse_timezone_offset(input, pos).map(|(gmtoff, pos)| {
            state.gmtoff = gmtoff;
            pos
        }),
        b'n' | b't' => {
            let mut pos = pos;
            while pos < input.len() && input[pos].is_ascii_whitespace() {
                pos += 1;
            }
            Some(pos)
        }
        b'F' => parse_strptime_format(b"%Y-%m-%d", input, pos, state),
        b'T' | b'X' => parse_strptime_format(b"%H:%M:%S", input, pos, state),
        b'R' => parse_strptime_format(b"%H:%M", input, pos, state),
        b'D' => parse_strptime_format(b"%m/%d/%y", input, pos, state),
        b'c' => parse_strptime_format(b"%a %b %d %H:%M:%S %Y", input, pos, state),
        b'r' => parse_strptime_format(b"%I:%M:%S %p", input, pos, state),
        b'x' => parse_strptime_format(b"%m/%d/%Y", input, pos, state)
            .or_else(|| parse_strptime_format(b"%m/%d/%y", input, pos, state)),
        _ => None,
    }
}

fn parse_fixed_digits(input: &[u8], pos: usize, count: usize) -> Option<(i32, usize)> {
    if pos.checked_add(count)? > input.len() {
        return None;
    }
    let mut value = 0i32;
    for offset in 0..count {
        let byte = input[pos + offset];
        if !byte.is_ascii_digit() {
            return None;
        }
        value = value * 10 + i32::from(byte - b'0');
    }
    Some((value, pos + count))
}

fn parse_number_range(
    input: &[u8],
    pos: usize,
    min_len: usize,
    max_len: usize,
    min: i32,
    max: i32,
) -> Option<(i32, usize)> {
    let mut value = 0i32;
    let mut len = 0usize;
    while len < max_len && pos + len < input.len() && input[pos + len].is_ascii_digit() {
        value = value * 10 + i32::from(input[pos + len] - b'0');
        len += 1;
    }
    if len < min_len || !(min..=max).contains(&value) {
        None
    } else {
        Some((value, pos + len))
    }
}

fn parse_ampm(input: &[u8], pos: usize) -> Option<(bool, usize)> {
    for (value, pm) in [(b"AM".as_slice(), false), (b"PM".as_slice(), true)] {
        if input
            .get(pos..pos + value.len())
            .is_some_and(|candidate| candidate.eq_ignore_ascii_case(value))
        {
            return Some((pm, pos + value.len()));
        }
    }
    for (value, pm) in [(b"A.M.".as_slice(), false), (b"P.M.".as_slice(), true)] {
        if input
            .get(pos..pos + value.len())
            .is_some_and(|candidate| candidate.eq_ignore_ascii_case(value))
        {
            return Some((pm, pos + value.len()));
        }
    }
    None
}

fn parse_month_name(input: &[u8], pos: usize) -> Option<(i32, usize)> {
    const MONTHS: [(&str, &str); 12] = [
        ("Jan", "January"),
        ("Feb", "February"),
        ("Mar", "March"),
        ("Apr", "April"),
        ("May", "May"),
        ("Jun", "June"),
        ("Jul", "July"),
        ("Aug", "August"),
        ("Sep", "September"),
        ("Oct", "October"),
        ("Nov", "November"),
        ("Dec", "December"),
    ];
    for (index, (short, long)) in MONTHS.iter().enumerate() {
        if let Some(next) = consume_ascii_word(input, pos, long) {
            return Some((index as i32, next));
        }
        if let Some(next) = consume_ascii_word(input, pos, short) {
            return Some((index as i32, next));
        }
    }
    None
}

fn parse_weekday_name(input: &[u8], pos: usize) -> Option<usize> {
    const WEEKDAYS: [(&str, &str); 7] = [
        ("Sun", "Sunday"),
        ("Mon", "Monday"),
        ("Tue", "Tuesday"),
        ("Wed", "Wednesday"),
        ("Thu", "Thursday"),
        ("Fri", "Friday"),
        ("Sat", "Saturday"),
    ];
    for (short, long) in WEEKDAYS {
        if let Some(next) = consume_ascii_word(input, pos, long) {
            return Some(next);
        }
        if let Some(next) = consume_ascii_word(input, pos, short) {
            return Some(next);
        }
    }
    None
}

fn consume_ascii_word(input: &[u8], pos: usize, word: &str) -> Option<usize> {
    let bytes = word.as_bytes();
    input
        .get(pos..pos + bytes.len())
        .filter(|candidate| candidate.eq_ignore_ascii_case(bytes))
        .map(|_| pos + bytes.len())
}

fn parse_timezone_offset(input: &[u8], pos: usize) -> Option<(i32, usize)> {
    if input
        .get(pos)
        .is_some_and(|byte| byte.eq_ignore_ascii_case(&b'Z'))
    {
        return Some((0, pos + 1));
    }
    let sign = match input.get(pos).copied()? {
        b'+' => 1,
        b'-' => -1,
        _ => return None,
    };
    let (hours, mut pos) = parse_fixed_digits(input, pos + 1, 2)?;
    let minutes = if input.get(pos).copied() == Some(b':') {
        let parsed = parse_fixed_digits(input, pos + 1, 2)?;
        pos = parsed.1;
        parsed.0
    } else if pos + 2 <= input.len()
        && input[pos].is_ascii_digit()
        && input[pos + 1].is_ascii_digit()
    {
        let parsed = parse_fixed_digits(input, pos, 2)?;
        pos = parsed.1;
        parsed.0
    } else {
        0
    };
    if hours > 23 || minutes > 59 {
        return None;
    }
    Some((sign * (hours * 3600 + minutes * 60), pos))
}

fn poll_fd(state: &mut HostState, fd: i32, events: u16) -> u16 {
    let Ok(entry) = state.get_fd(fd) else {
        return POLLNVAL;
    };
    match entry {
        FdEntry::Socket { .. } => {
            if let Err(errno) = state.finish_pending_connect(fd) {
                return if errno == EBADF { POLLNVAL } else { POLLERR };
            }
            let Ok(socket) = state.get_socket_mut(fd) else {
                return POLLNVAL;
            };
            if socket.stream.is_none() {
                if socket.server.is_some() {
                    let mut revents = 0;
                    if socket.error != 0 {
                        revents |= POLLERR;
                    }
                    if events & POLLIN != 0 && queue_pending_accept(socket) {
                        revents |= POLLIN;
                    }
                    return revents;
                }
                if socket.pending_connect.is_some() {
                    return 0;
                }
                return if socket.error != 0 { POLLERR } else { 0 };
            }
            let mut revents = 0;
            if socket.error != 0 {
                revents |= POLLERR;
            }
            if events & POLLOUT != 0 {
                revents |= POLLOUT;
            }
            if events & POLLIN != 0 {
                if socket.nonblocking {
                    if let Some(stream) = socket.stream.as_ref() {
                        let mut byte = [0; 1];
                        match stream.peek(&mut byte) {
                            Ok(0) => revents |= POLLIN | POLLHUP,
                            Ok(_) => revents |= POLLIN,
                            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {}
                            Err(_) => revents |= POLLERR,
                        }
                    }
                } else {
                    revents |= POLLIN;
                }
            }
            if events & POLLPRI != 0 {
                revents |= POLLPRI;
            }
            revents
        }
        FdEntry::Pipe { pipe, end, .. } => match pipe.state.lock() {
            Ok(state) => {
                let mut revents = 0;
                match end {
                    PipeEnd::Read => {
                        if events & POLLIN != 0 && (!state.buffer.is_empty() || state.writers == 0)
                        {
                            revents |= POLLIN;
                        }
                        if state.writers == 0 {
                            revents |= POLLHUP;
                        }
                    }
                    PipeEnd::Write => {
                        if state.readers == 0 {
                            revents |= POLLERR;
                        } else if events & POLLOUT != 0 && state.buffer.len() < PIPE_BUFFER_LIMIT {
                            revents |= POLLOUT;
                        }
                    }
                }
                revents
            }
            Err(_) => POLLERR,
        },
        FdEntry::Stdin
        | FdEntry::File { .. }
        | FdEntry::HostReadFile { .. }
        | FdEntry::InternalReadFile { .. }
        | FdEntry::Directory { .. }
        | FdEntry::Random => events & (POLLIN | POLLPRI),
        FdEntry::Stdout
        | FdEntry::Stderr
        | FdEntry::RequestStdout
        | FdEntry::RequestStderr
        | FdEntry::RequestHeaders => events & POLLOUT,
    }
}

impl PipeEndpoint {
    fn read_blocking(&self, len: usize) -> std::result::Result<Vec<u8>, i32> {
        if self.end != PipeEnd::Read {
            return Err(EBADF);
        }
        let mut state = self.pipe.state.lock().map_err(|_| EINVAL)?;
        loop {
            if !state.buffer.is_empty() {
                let count = len.min(state.buffer.len());
                let mut bytes = Vec::with_capacity(count);
                for _ in 0..count {
                    if let Some(byte) = state.buffer.pop_front() {
                        bytes.push(byte);
                    }
                }
                self.pipe.ready.notify_all();
                return Ok(bytes);
            }
            if state.writers == 0 {
                return Ok(Vec::new());
            }
            state = self.pipe.ready.wait(state).map_err(|_| EINVAL)?;
        }
    }

    fn write_blocking(&self, mut bytes: &[u8]) -> std::result::Result<(), i32> {
        if self.end != PipeEnd::Write {
            return Err(EBADF);
        }
        while !bytes.is_empty() {
            let mut state = self.pipe.state.lock().map_err(|_| EINVAL)?;
            while state.readers > 0 && state.buffer.len() >= PIPE_BUFFER_LIMIT {
                state = self.pipe.ready.wait(state).map_err(|_| EINVAL)?;
            }
            if state.readers == 0 {
                return Err(EPIPE);
            }
            let available = PIPE_BUFFER_LIMIT.saturating_sub(state.buffer.len());
            let count = available.min(bytes.len());
            state.buffer.extend(bytes[..count].iter().copied());
            bytes = &bytes[count..];
            self.pipe.ready.notify_all();
        }
        Ok(())
    }
}

fn pump_pipe_to_child_stdin(endpoint: PipeEndpoint, mut stdin: std::process::ChildStdin) {
    while let Ok(bytes) = endpoint.read_blocking(8192) {
        if bytes.is_empty() {
            break;
        }
        if stdin.write_all(&bytes).is_err() {
            break;
        }
    }
}

fn pump_child_output_to_pipe<R: Read>(mut output: R, endpoint: PipeEndpoint) {
    let mut buffer = [0u8; 8192];
    loop {
        match output.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => {
                if endpoint.write_blocking(&buffer[..count]).is_err() {
                    break;
                }
            }
            Err(_) => break,
        }
    }
}

fn pipe_read_bytes(
    state: &mut HostState,
    fd: i32,
    len: usize,
) -> std::result::Result<Vec<u8>, i32> {
    let (pipe, end) = match state.get_fd(fd)? {
        FdEntry::Pipe { pipe, end, .. } => (pipe.clone(), *end),
        _ => return Err(EBADF),
    };
    if end != PipeEnd::Read {
        return Err(EBADF);
    }
    let mut state = pipe.state.lock().map_err(|_| EINVAL)?;
    if state.buffer.is_empty() {
        if state.writers == 0 {
            return Ok(Vec::new());
        }
        return Err(EAGAIN);
    }
    let count = len.min(state.buffer.len());
    let mut bytes = Vec::with_capacity(count);
    for _ in 0..count {
        if let Some(byte) = state.buffer.pop_front() {
            bytes.push(byte);
        }
    }
    pipe.ready.notify_all();
    Ok(bytes)
}

fn pipe_write_bytes(
    state: &mut HostState,
    fd: i32,
    bytes: &[u8],
) -> std::result::Result<usize, i32> {
    let (pipe, end) = match state.get_fd(fd)? {
        FdEntry::Pipe { pipe, end, .. } => (pipe.clone(), *end),
        _ => return Err(EBADF),
    };
    if end != PipeEnd::Write {
        return Err(EBADF);
    }
    let mut state = pipe.state.lock().map_err(|_| EINVAL)?;
    if state.readers == 0 {
        return Err(EPIPE);
    }
    let available = PIPE_BUFFER_LIMIT.saturating_sub(state.buffer.len());
    if available == 0 {
        return Err(EAGAIN);
    }
    let count = available.min(bytes.len());
    state.buffer.extend(bytes[..count].iter().copied());
    pipe.ready.notify_all();
    Ok(count)
}

fn socket_read_bytes(
    state: &mut HostState,
    fd: i32,
    len: usize,
    peek: bool,
) -> std::result::Result<(Vec<u8>, Option<SocketAddr>), i32> {
    state.finish_pending_connect(fd)?;
    let socket = state.get_socket_mut(fd)?;
    if socket.socket_type != SOCK_STREAM {
        return Err(EOPNOTSUPP);
    }
    if socket.pending_connect.is_some() {
        return Err(EAGAIN);
    }
    let Some(stream) = socket.stream.as_mut() else {
        let errno = if socket.error != 0 {
            socket.error
        } else {
            ENOTCONN
        };
        socket.error = errno;
        return Err(errno);
    };
    let mut bytes = vec![0; len];
    let result = if peek {
        stream.peek(&mut bytes)
    } else {
        stream.read(&mut bytes)
    };
    match result {
        Ok(count) => {
            bytes.truncate(count);
            socket.error = 0;
            Ok((bytes, socket.peer))
        }
        Err(error) => {
            let errno = io_error_errno(&error);
            socket.error = errno;
            Err(errno)
        }
    }
}

fn socket_write_bytes(
    state: &mut HostState,
    fd: i32,
    bytes: &[u8],
) -> std::result::Result<usize, i32> {
    state.finish_pending_connect(fd)?;
    let socket = state.get_socket_mut(fd)?;
    if socket.socket_type != SOCK_STREAM {
        return Err(EOPNOTSUPP);
    }
    if socket.pending_connect.is_some() {
        return Err(EAGAIN);
    }
    let Some(stream) = socket.stream.as_mut() else {
        let errno = if socket.error != 0 {
            socket.error
        } else {
            ENOTCONN
        };
        socket.error = errno;
        return Err(errno);
    };
    match stream.write(bytes) {
        Ok(count) => {
            socket.error = 0;
            Ok(count)
        }
        Err(error) => {
            let errno = io_error_errno(&error);
            socket.error = errno;
            Err(errno)
        }
    }
}

fn io_error_errno(error: &io::Error) -> i32 {
    #[cfg(windows)]
    if let Some(errno) = windows_socket_error_errno(error.raw_os_error()) {
        return errno;
    }

    match error.kind() {
        io::ErrorKind::ConnectionRefused => ECONNREFUSED,
        io::ErrorKind::ConnectionReset => ECONNRESET,
        io::ErrorKind::NotConnected => ENOTCONN,
        io::ErrorKind::BrokenPipe => EPIPE,
        io::ErrorKind::TimedOut => ETIMEDOUT,
        io::ErrorKind::WouldBlock => EAGAIN,
        io::ErrorKind::PermissionDenied => EACCES,
        io::ErrorKind::AddrNotAvailable => EHOSTUNREACH,
        io::ErrorKind::AddrInUse => EHOSTUNREACH,
        io::ErrorKind::NetworkUnreachable => ENETUNREACH,
        _ => EHOSTUNREACH,
    }
}

#[cfg(windows)]
fn windows_socket_error_errno(raw_os_error: Option<i32>) -> Option<i32> {
    match raw_os_error? {
        10035 => Some(EAGAIN),
        10036 | 10037 => Some(EALREADY),
        10048 => Some(EADDRINUSE),
        10049 => Some(EADDRNOTAVAIL),
        10051 => Some(ENETUNREACH),
        10054 => Some(ECONNRESET),
        10060 => Some(ETIMEDOUT),
        10061 => Some(ECONNREFUSED),
        10065 => Some(EHOSTUNREACH),
        _ => None,
    }
}

fn process_error_errno(error: &io::Error) -> i32 {
    match error.kind() {
        io::ErrorKind::NotFound => ENOENT,
        io::ErrorKind::PermissionDenied => EACCES,
        io::ErrorKind::InvalidInput => EINVAL,
        io::ErrorKind::BrokenPipe => EPIPE,
        _ => EINVAL,
    }
}

fn fs_error_errno(error: &io::Error) -> i32 {
    match error.kind() {
        io::ErrorKind::NotFound => ENOENT,
        io::ErrorKind::PermissionDenied => EACCES,
        io::ErrorKind::AlreadyExists => EEXIST,
        io::ErrorKind::NotADirectory => ENOTDIR,
        _ => EINVAL,
    }
}

fn cached_host_read_file_len(
    host_cache_enabled: bool,
    host_cache_generation: u64,
    cached_stat: &VfsStat,
    cached_stat_generation: u64,
) -> Option<usize> {
    if host_cache_enabled && host_cache_generation == cached_stat_generation {
        usize::try_from(cached_stat.size).ok()
    } else {
        None
    }
}

fn read_host_file_iovs(
    file: &Arc<Mutex<fs::File>>,
    mut position: usize,
    iovs: &[(i32, usize)],
    cached_file_len: Option<usize>,
) -> HostIovReadResult {
    let mut writes = Vec::new();
    let mut total = 0usize;
    let mut file = file.lock().map_err(|_| EINVAL)?;
    let file_len = match cached_file_len {
        Some(len) => len,
        None => file
            .metadata()
            .map_err(|error| fs_error_errno(&error))?
            .len()
            .try_into()
            .unwrap_or(usize::MAX),
    };

    for (ptr, len) in iovs {
        if *len == 0 {
            continue;
        }
        if position >= file_len {
            break;
        }
        let count = file_len.saturating_sub(position).min(*len);
        if count == 0 {
            break;
        }
        file.seek(SeekFrom::Start(position as u64))
            .map_err(|error| fs_error_errno(&error))?;
        let mut bytes = vec![0; count];
        let read = file
            .read(&mut bytes)
            .map_err(|error| fs_error_errno(&error))?;
        if read == 0 {
            break;
        }
        bytes.truncate(read);
        position += read;
        total += read;
        writes.push((*ptr, bytes));
        if read < *len {
            break;
        }
    }

    Ok((writes, position, total))
}

fn read_host_path_iovs(
    host_path: &Path,
    mut position: usize,
    iovs: &[(i32, usize)],
) -> HostIovReadResult {
    let mut writes = Vec::new();
    let mut total = 0usize;
    let mut file = fs::File::open(host_path).map_err(|error| fs_error_errno(&error))?;
    let file_len = file
        .metadata()
        .map_err(|error| fs_error_errno(&error))?
        .len()
        .try_into()
        .unwrap_or(usize::MAX);

    for (ptr, len) in iovs {
        if *len == 0 {
            continue;
        }
        if position >= file_len {
            break;
        }
        let count = file_len.saturating_sub(position).min(*len);
        if count == 0 {
            break;
        }
        file.seek(SeekFrom::Start(position as u64))
            .map_err(|error| fs_error_errno(&error))?;
        let mut bytes = vec![0; count];
        let read = file
            .read(&mut bytes)
            .map_err(|error| fs_error_errno(&error))?;
        if read == 0 {
            break;
        }
        bytes.truncate(read);
        position += read;
        total += read;
        writes.push((*ptr, bytes));
        if read < *len {
            break;
        }
    }

    Ok((writes, position, total))
}

fn write_host_path_chunks(
    host_path: &Path,
    mut position: usize,
    chunks: &[Vec<u8>],
    append: bool,
) -> std::result::Result<(usize, usize), i32> {
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(host_path)
        .map_err(|error| fs_error_errno(&error))?;
    let mut total = 0usize;
    for chunk in chunks {
        if chunk.is_empty() {
            continue;
        }
        if append {
            position = file
                .seek(SeekFrom::End(0))
                .map_err(|error| fs_error_errno(&error))?
                .try_into()
                .unwrap_or(usize::MAX);
        } else {
            file.seek(SeekFrom::Start(position as u64))
                .map_err(|error| fs_error_errno(&error))?;
        }
        file.write_all(chunk)
            .map_err(|error| fs_error_errno(&error))?;
        position = position.saturating_add(chunk.len());
        total = total.saturating_add(chunk.len());
    }
    Ok((position, total))
}

fn read_host_file_region(
    host_path: &Path,
    offset: usize,
    len: usize,
) -> std::result::Result<Vec<u8>, i32> {
    let mut file = fs::File::open(host_path).map_err(|error| fs_error_errno(&error))?;
    file.seek(SeekFrom::Start(offset as u64))
        .map_err(|error| fs_error_errno(&error))?;
    let mut bytes = vec![0; len];
    let mut read_total = 0usize;
    while read_total < len {
        match file.read(&mut bytes[read_total..]) {
            Ok(0) => break,
            Ok(count) => read_total += count,
            Err(error) => return Err(fs_error_errno(&error)),
        }
    }
    Ok(bytes)
}

fn fd_read(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    iov: i32,
    iovcnt: i32,
    pnum: i32,
) -> wasmtime::Result<i32> {
    let iovs = read_iovs(caller, iov, iovcnt)?;
    let mut writes = Vec::new();
    let mut total = 0usize;
    let host_cache_enabled = caller.data().host_cache_enabled;
    let host_cache_generation = caller.data().host_cache_generation.get();
    if matches!(caller.data().get_fd(fd), Ok(FdEntry::Socket { .. })) {
        for (ptr, len) in iovs {
            if len == 0 {
                continue;
            }
            let bytes = match socket_read_bytes(caller.data_mut(), fd, len, false) {
                Ok((bytes, _peer)) => bytes,
                Err(errno) => return Ok(errno),
            };
            let count = bytes.len();
            writes.push((ptr, bytes));
            total += count;
            if count < len {
                break;
            }
        }
        for (ptr, bytes) in writes {
            write_bytes(caller, ptr, &bytes)?;
        }
        write_u32(caller, pnum, total as u32)?;
        return Ok(0);
    }
    if matches!(caller.data().get_fd(fd), Ok(FdEntry::Pipe { .. })) {
        for (ptr, len) in iovs {
            if len == 0 {
                continue;
            }
            let bytes = match pipe_read_bytes(caller.data_mut(), fd, len) {
                Ok(bytes) => bytes,
                Err(errno) => return Ok(errno),
            };
            let count = bytes.len();
            writes.push((ptr, bytes));
            total += count;
            if count < len {
                break;
            }
        }
        for (ptr, bytes) in writes {
            write_bytes(caller, ptr, &bytes)?;
        }
        write_u32(caller, pnum, total as u32)?;
        return Ok(0);
    }
    {
        let entry = match caller.data_mut().get_fd_mut(fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(errno),
        };
        match entry {
            FdEntry::File {
                host_path: Some(host_path),
                position,
                access_mode,
                ..
            } => {
                if !file_descriptor_allows_read(*access_mode) {
                    return Ok(EBADF);
                }
                let (stream_writes, next_position, stream_total) =
                    match read_host_path_iovs(host_path, *position, &iovs) {
                        Ok(result) => result,
                        Err(errno) => return Ok(errno),
                    };
                writes = stream_writes;
                *position = next_position;
                total = stream_total;
            }
            FdEntry::HostReadFile {
                file,
                position,
                cached_stat,
                cached_stat_generation,
                ..
            } => {
                let cached_file_len = cached_host_read_file_len(
                    host_cache_enabled,
                    host_cache_generation,
                    cached_stat,
                    *cached_stat_generation,
                );
                let (stream_writes, next_position, stream_total) =
                    match read_host_file_iovs(file, *position, &iovs, cached_file_len) {
                        Ok(result) => result,
                        Err(errno) => return Ok(errno),
                    };
                writes = stream_writes;
                *position = next_position;
                total = stream_total;
            }
            FdEntry::InternalReadFile { data, position, .. } => {
                for (ptr, len) in iovs {
                    if *position >= data.len() {
                        break;
                    }
                    let available = data.len().saturating_sub(*position);
                    let count = available.min(len);
                    writes.push((ptr, data[*position..*position + count].to_vec()));
                    *position += count;
                    total += count;
                    if count < len {
                        break;
                    }
                }
            }
            FdEntry::File {
                data,
                position,
                access_mode,
                ..
            } => {
                if !file_descriptor_allows_read(*access_mode) {
                    return Ok(EBADF);
                }
                for (ptr, len) in iovs {
                    if *position >= data.len() {
                        break;
                    }
                    let available = data.len().saturating_sub(*position);
                    let count = available.min(len);
                    writes.push((ptr, data[*position..*position + count].to_vec()));
                    *position += count;
                    total += count;
                    if count < len {
                        break;
                    }
                }
            }
            FdEntry::Stdin => {
                total = 0;
            }
            FdEntry::Random => {
                for (ptr, len) in iovs {
                    let mut bytes = vec![0; len];
                    getrandom::fill(&mut bytes).map_err(|error| {
                        wasmtime::Error::msg(format!("/dev/urandom read failed: {error}"))
                    })?;
                    writes.push((ptr, bytes));
                    total += len;
                }
            }
            _ => return Ok(EBADF),
        }
    }

    for (ptr, bytes) in writes {
        write_bytes(caller, ptr, &bytes)?;
    }
    write_u32(caller, pnum, total as u32)?;
    Ok(0)
}

fn fd_write(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    iov: i32,
    iovcnt: i32,
    pnum: i32,
) -> wasmtime::Result<i32> {
    let iovs = read_iovs(caller, iov, iovcnt)?;
    let direct_capture_target = match caller.data().get_fd(fd) {
        Ok(FdEntry::Stdout | FdEntry::RequestStdout) if !caller.data().options.echo_output => {
            Some(CaptureWriteTarget::Stdout)
        }
        Ok(FdEntry::Stderr | FdEntry::RequestStderr) if !caller.data().options.echo_output => {
            Some(CaptureWriteTarget::Stderr)
        }
        Ok(FdEntry::RequestHeaders) => Some(CaptureWriteTarget::Headers),
        Ok(_) => None,
        Err(errno) => return Ok(errno),
    };
    if let Some(target) = direct_capture_target {
        let total = capture_fd_write_iovs(caller, target, &iovs)?;
        write_u32(caller, pnum, total as u32)?;
        return Ok(0);
    }

    let mut chunks = Vec::new();
    for (ptr, len) in iovs {
        chunks.push(read_bytes(caller, ptr, len)?);
    }
    let mut total = chunks.iter().map(Vec::len).sum::<usize>();

    if matches!(caller.data().get_fd(fd), Ok(FdEntry::Socket { .. })) {
        total = 0;
        for chunk in &chunks {
            let written = match socket_write_bytes(caller.data_mut(), fd, chunk) {
                Ok(written) => written,
                Err(errno) => return Ok(errno),
            };
            total += written;
            if written < chunk.len() {
                break;
            }
        }
        write_u32(caller, pnum, total as u32)?;
        return Ok(0);
    }
    if matches!(caller.data().get_fd(fd), Ok(FdEntry::Pipe { .. })) {
        total = 0;
        for chunk in &chunks {
            let written = match pipe_write_bytes(caller.data_mut(), fd, chunk) {
                Ok(written) => written,
                Err(errno) => return Ok(errno),
            };
            total += written;
            if written < chunk.len() {
                break;
            }
        }
        write_u32(caller, pnum, total as u32)?;
        return Ok(0);
    }

    let mut invalidate_path = None;
    {
        let state = caller.data_mut();
        let entry = match state.get_fd_mut(fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(errno),
        };
        match entry {
            FdEntry::Stdout | FdEntry::RequestStdout => {
                for chunk in &chunks {
                    state.captured_stdout.extend_from_slice(chunk);
                    if state.options.echo_output {
                        std::io::stdout().write_all(chunk).map_err(|error| {
                            wasmtime::Error::msg(format!("failed writing stdout: {error}"))
                        })?;
                    }
                }
                if state.options.echo_output {
                    std::io::stdout().flush().map_err(|error| {
                        wasmtime::Error::msg(format!("failed flushing stdout: {error}"))
                    })?;
                }
            }
            FdEntry::Stderr | FdEntry::RequestStderr => {
                for chunk in &chunks {
                    state.captured_stderr.extend_from_slice(chunk);
                    if state.options.echo_output {
                        std::io::stderr().write_all(chunk).map_err(|error| {
                            wasmtime::Error::msg(format!("failed writing stderr: {error}"))
                        })?;
                    }
                }
                if state.options.echo_output {
                    std::io::stderr().flush().map_err(|error| {
                        wasmtime::Error::msg(format!("failed flushing stderr: {error}"))
                    })?;
                }
            }
            FdEntry::RequestHeaders => {
                for chunk in &chunks {
                    state.captured_headers.extend_from_slice(chunk);
                }
            }
            FdEntry::File {
                path,
                host_path: Some(host_path),
                position,
                access_mode,
                append,
                dirty,
                ..
            } => {
                if !file_descriptor_allows_write(*access_mode) {
                    return Ok(EBADF);
                }
                let (next_position, written) =
                    match write_host_path_chunks(host_path, *position, &chunks, *append) {
                        Ok(result) => result,
                        Err(errno) => return Ok(errno),
                    };
                *position = next_position;
                total = written;
                *dirty = false;
                invalidate_path = Some(path.clone());
            }
            FdEntry::File {
                data,
                host_path: None,
                position,
                access_mode,
                append,
                dirty,
                ..
            } => {
                if !file_descriptor_allows_write(*access_mode) {
                    return Ok(EBADF);
                }
                for chunk in &chunks {
                    if *append {
                        *position = data.len();
                    }
                    let end = *position + chunk.len();
                    if data.len() < end {
                        data.resize(end, 0);
                    }
                    data[*position..end].copy_from_slice(chunk);
                    *position = end;
                }
                *dirty = true;
            }
            _ => return Ok(EBADF),
        }
    }

    if let Some(path) = invalidate_path {
        caller.data().invalidate_host_cache_path(&path);
    }
    write_u32(caller, pnum, total as u32)?;
    Ok(0)
}

fn fd_pread(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    iov: i32,
    iovcnt: i32,
    offset: i64,
    pnum: i32,
) -> wasmtime::Result<i32> {
    let mut position = match usize::try_from(offset) {
        Ok(offset) => offset,
        Err(_) => return Ok(EINVAL),
    };
    let iovs = read_iovs(caller, iov, iovcnt)?;
    let mut writes = Vec::new();
    let mut total = 0usize;
    let host_cache_enabled = caller.data().host_cache_enabled;
    let host_cache_generation = caller.data().host_cache_generation.get();
    {
        let entry = match caller.data_mut().get_fd_mut(fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(errno),
        };
        match entry {
            FdEntry::HostReadFile {
                file,
                cached_stat,
                cached_stat_generation,
                ..
            } => {
                let cached_file_len = cached_host_read_file_len(
                    host_cache_enabled,
                    host_cache_generation,
                    cached_stat,
                    *cached_stat_generation,
                );
                let (stream_writes, _next_position, stream_total) =
                    match read_host_file_iovs(file, position, &iovs, cached_file_len) {
                        Ok(result) => result,
                        Err(errno) => return Ok(errno),
                    };
                writes = stream_writes;
                total = stream_total;
            }
            FdEntry::File {
                host_path: Some(host_path),
                access_mode,
                ..
            } => {
                if !file_descriptor_allows_read(*access_mode) {
                    return Ok(EBADF);
                }
                let (stream_writes, _next_position, stream_total) =
                    match read_host_path_iovs(host_path, position, &iovs) {
                        Ok(result) => result,
                        Err(errno) => return Ok(errno),
                    };
                writes = stream_writes;
                total = stream_total;
            }
            FdEntry::File {
                data, access_mode, ..
            } => {
                if !file_descriptor_allows_read(*access_mode) {
                    return Ok(EBADF);
                }
                for (ptr, len) in iovs {
                    if position >= data.len() {
                        break;
                    }
                    let available = data.len().saturating_sub(position);
                    let count = available.min(len);
                    writes.push((ptr, data[position..position + count].to_vec()));
                    position += count;
                    total += count;
                    if count < len {
                        break;
                    }
                }
            }
            FdEntry::InternalReadFile { data, .. } => {
                for (ptr, len) in iovs {
                    if position >= data.len() {
                        break;
                    }
                    let available = data.len().saturating_sub(position);
                    let count = available.min(len);
                    writes.push((ptr, data[position..position + count].to_vec()));
                    position += count;
                    total += count;
                    if count < len {
                        break;
                    }
                }
            }
            _ => return Ok(EBADF),
        };
    }

    for (ptr, bytes) in writes {
        write_bytes(caller, ptr, &bytes)?;
    }
    write_u32(caller, pnum, total as u32)?;
    Ok(0)
}

fn fd_pwrite(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    iov: i32,
    iovcnt: i32,
    offset: i64,
    pnum: i32,
) -> wasmtime::Result<i32> {
    let mut position = match usize::try_from(offset) {
        Ok(offset) => offset,
        Err(_) => return Ok(EINVAL),
    };
    let iovs = read_iovs(caller, iov, iovcnt)?;
    let mut chunks = Vec::new();
    for (ptr, len) in iovs {
        chunks.push(read_bytes(caller, ptr, len)?);
    }
    let mut total = chunks.iter().map(Vec::len).sum::<usize>();

    let mut invalidate_path = None;
    {
        let entry = match caller.data_mut().get_fd_mut(fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(errno),
        };
        match entry {
            FdEntry::File {
                path,
                host_path: Some(host_path),
                access_mode,
                dirty,
                ..
            } => {
                if !file_descriptor_allows_write(*access_mode) {
                    return Ok(EBADF);
                }
                let (_next_position, written) =
                    match write_host_path_chunks(host_path, position, &chunks, false) {
                        Ok(result) => result,
                        Err(errno) => return Ok(errno),
                    };
                total = written;
                *dirty = false;
                invalidate_path = Some(path.clone());
            }
            FdEntry::File {
                data,
                host_path: None,
                access_mode,
                dirty,
                ..
            } => {
                if !file_descriptor_allows_write(*access_mode) {
                    return Ok(EBADF);
                }
                for chunk in &chunks {
                    let end = position + chunk.len();
                    if data.len() < end {
                        data.resize(end, 0);
                    }
                    data[position..end].copy_from_slice(chunk);
                    position = end;
                }
                *dirty = true;
            }
            _ => return Ok(EBADF),
        }
    }

    if let Some(path) = invalidate_path {
        caller.data().invalidate_host_cache_path(&path);
    }
    write_u32(caller, pnum, total as u32)?;
    Ok(0)
}

fn fd_seek(
    caller: &mut Caller<'_, HostState>,
    fd: i32,
    offset: i64,
    whence: i32,
    new_offset: i32,
) -> wasmtime::Result<i32> {
    let position = {
        let entry = match caller.data_mut().get_fd_mut(fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(errno),
        };
        let (position, len) = match entry {
            FdEntry::File {
                data,
                host_path,
                position,
                ..
            } => {
                let len = host_path
                    .as_ref()
                    .and_then(|path| {
                        fs::metadata(path)
                            .ok()
                            .map(|metadata| metadata.len() as usize)
                    })
                    .unwrap_or(data.len());
                (position, len)
            }
            FdEntry::HostReadFile {
                host_path,
                position,
                ..
            } => {
                let len = fs::metadata(host_path)
                    .ok()
                    .map(|metadata| metadata.len() as usize)
                    .unwrap_or(0);
                (position, len)
            }
            FdEntry::InternalReadFile { data, position, .. } => (position, data.len()),
            FdEntry::Directory { position, .. } => (position, 0),
            _ => return Ok(EBADF),
        };
        let base = match whence {
            0 => 0i64,
            1 => *position as i64,
            2 => len as i64,
            _ => return Ok(EINVAL),
        };
        let next = base.saturating_add(offset);
        if next < 0 {
            return Ok(EINVAL);
        }
        *position = next as usize;
        *position
    };
    write_u64(caller, new_offset, position as u64)?;
    Ok(0)
}

#[derive(Debug, Clone, Copy)]
struct MmapArgs {
    len: i32,
    prot: i32,
    flags: i32,
    fd: i32,
    offset: i64,
    allocated: i32,
    addr: i32,
}

fn mmap_file(caller: &mut Caller<'_, HostState>, args: MmapArgs) -> wasmtime::Result<i32> {
    let len = match usize::try_from(args.len) {
        Ok(len) => len,
        Err(_) => return Ok(-EINVAL),
    };
    let offset = match usize::try_from(args.offset) {
        Ok(offset) => offset,
        Err(_) => return Ok(-EINVAL),
    };
    let (bytes, backing) = {
        let entry = match caller.data().get_fd(args.fd) {
            Ok(entry) => entry,
            Err(errno) => return Ok(-errno),
        };
        match entry {
            FdEntry::File {
                host_path: Some(host_path),
                access_mode,
                ..
            } => {
                if !file_descriptor_allows_read(*access_mode)
                    || (args.prot & PROT_WRITE != 0
                        && args.flags & MAP_PRIVATE == 0
                        && !file_descriptor_allows_write(*access_mode))
                {
                    return Ok(-EACCES);
                }
                let bytes = match read_host_file_region(host_path, offset, len) {
                    Ok(bytes) => bytes,
                    Err(errno) => return Ok(-errno),
                };
                (bytes, MmapBacking::HostPath(host_path.clone()))
            }
            FdEntry::HostReadFile { host_path, .. } => {
                if args.prot & PROT_WRITE != 0 && args.flags & MAP_PRIVATE == 0 {
                    return Ok(-EACCES);
                }
                let bytes = match read_host_file_region(host_path, offset, len) {
                    Ok(bytes) => bytes,
                    Err(errno) => return Ok(-errno),
                };
                (bytes, MmapBacking::HostPath(host_path.clone()))
            }
            FdEntry::InternalReadFile { path, data, .. } => {
                if args.prot & PROT_WRITE != 0 && args.flags & MAP_PRIVATE == 0 {
                    return Ok(-EACCES);
                }
                let available = data.len().saturating_sub(offset);
                let count = available.min(len);
                let mut bytes = vec![0; len];
                bytes[..count].copy_from_slice(&data[offset..offset + count]);
                (
                    bytes,
                    MmapBacking::Fd {
                        fd: args.fd,
                        path: path.clone(),
                    },
                )
            }
            FdEntry::File {
                path,
                data,
                access_mode,
                ..
            } => {
                if !file_descriptor_allows_read(*access_mode)
                    || (args.prot & PROT_WRITE != 0
                        && args.flags & MAP_PRIVATE == 0
                        && !file_descriptor_allows_write(*access_mode))
                {
                    return Ok(-EACCES);
                }
                let available = data.len().saturating_sub(offset);
                let count = available.min(len);
                let mut bytes = vec![0; len];
                bytes[..count].copy_from_slice(&data[offset..offset + count]);
                (
                    bytes,
                    MmapBacking::Fd {
                        fd: args.fd,
                        path: path.clone(),
                    },
                )
            }
            _ => return Ok(-EINVAL),
        }
    };

    let ptr = wasm_malloc(caller, len.max(1) as u32)?;
    if (ptr as usize).checked_add(len).is_none() {
        return Ok(-EINVAL);
    }
    let wasm_ptr = match i32::try_from(ptr) {
        Ok(ptr) => ptr,
        Err(_) => return Ok(-EINVAL),
    };
    write_bytes(caller, wasm_ptr, &bytes)?;
    write_u32(caller, args.allocated, 1)?;
    write_u32(caller, args.addr, ptr)?;
    caller.data_mut().mmap_regions.push(MmapRegion {
        addr: ptr as usize,
        len,
        file_offset: offset,
        prot: args.prot,
        flags: args.flags,
        backing,
    });
    Ok(0)
}

fn munmap_file(caller: &mut Caller<'_, HostState>, addr: i32, len: i32) -> wasmtime::Result<i32> {
    let addr = match usize::try_from(addr) {
        Ok(addr) => addr,
        Err(_) => return Ok(-EINVAL),
    };
    let len = match usize::try_from(len) {
        Ok(len) if len > 0 => len,
        _ => return Ok(-EINVAL),
    };
    let unmap_end = match addr.checked_add(len) {
        Some(end) => end,
        None => return Ok(-EINVAL),
    };
    let Some((index, region)) = caller
        .data()
        .mmap_regions
        .iter()
        .enumerate()
        .find(|(_, region)| {
            let Some(region_end) = region.addr.checked_add(region.len) else {
                return false;
            };
            addr >= region.addr && unmap_end <= region_end
        })
        .map(|(index, region)| (index, region.clone()))
    else {
        return Ok(-EINVAL);
    };

    if region.prot & PROT_WRITE != 0 && region.flags & MAP_PRIVATE == 0 {
        let wasm_addr = match i32::try_from(addr) {
            Ok(addr) => addr,
            Err(_) => return Ok(-EINVAL),
        };
        let bytes = read_bytes(caller, wasm_addr, len)?;
        let relative_offset = addr.saturating_sub(region.addr);
        let file_offset = match region.file_offset.checked_add(relative_offset) {
            Some(offset) => offset,
            None => return Ok(-EINVAL),
        };
        match &region.backing {
            MmapBacking::HostPath(host_path) => {
                let end = match file_offset.checked_add(bytes.len()) {
                    Some(end) => end,
                    None => return Ok(-EINVAL),
                };
                let mut file = match fs::OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(host_path)
                {
                    Ok(file) => file,
                    Err(error) => return Ok(-fs_error_errno(&error)),
                };
                let len = match file.metadata() {
                    Ok(metadata) => metadata.len(),
                    Err(error) => return Ok(-fs_error_errno(&error)),
                };
                if len < end as u64 {
                    if let Err(error) = file.set_len(end as u64) {
                        return Ok(-fs_error_errno(&error));
                    }
                }
                if let Err(error) = file.seek(SeekFrom::Start(file_offset as u64)) {
                    return Ok(-fs_error_errno(&error));
                }
                if let Err(error) = file.write_all(&bytes) {
                    return Ok(-fs_error_errno(&error));
                }
            }
            MmapBacking::Fd { fd, path } => {
                let entry = match caller.data_mut().get_fd_mut(*fd) {
                    Ok(entry) => entry,
                    Err(errno) => return Ok(-errno),
                };
                let FdEntry::File {
                    path: current_path,
                    host_path: None,
                    data,
                    dirty,
                    ..
                } = entry
                else {
                    return Ok(-EBADF);
                };
                if current_path != path {
                    return Ok(-EBADF);
                }
                let end = match file_offset.checked_add(bytes.len()) {
                    Some(end) => end,
                    None => return Ok(-EINVAL),
                };
                if data.len() < end {
                    data.resize(end, 0);
                }
                data[file_offset..end].copy_from_slice(&bytes);
                *dirty = true;
            }
        }
    }

    remove_mmap_region_range(caller.data_mut(), index, addr, len);
    Ok(0)
}

fn remove_mmap_region_range(state: &mut HostState, index: usize, addr: usize, len: usize) {
    let region = state.mmap_regions.remove(index);
    let Some(unmap_end) = addr.checked_add(len) else {
        return;
    };
    let Some(region_end) = region.addr.checked_add(region.len) else {
        return;
    };
    let mut inserts = Vec::new();
    if addr > region.addr {
        inserts.push(MmapRegion {
            addr: region.addr,
            len: addr - region.addr,
            file_offset: region.file_offset,
            prot: region.prot,
            flags: region.flags,
            backing: region.backing.clone(),
        });
    }
    if unmap_end < region_end {
        let right_offset = unmap_end - region.addr;
        inserts.push(MmapRegion {
            addr: unmap_end,
            len: region_end - unmap_end,
            file_offset: region.file_offset + right_offset,
            prot: region.prot,
            flags: region.flags,
            backing: region.backing,
        });
    }
    for (offset, insert) in inserts.into_iter().enumerate() {
        state.mmap_regions.insert(index + offset, insert);
    }
}

fn read_iovs(
    caller: &mut Caller<'_, HostState>,
    iov: i32,
    iovcnt: i32,
) -> wasmtime::Result<Vec<(i32, usize)>> {
    let iovcnt =
        usize::try_from(iovcnt).map_err(|_| wasmtime::Error::msg("iovcnt cannot be negative"))?;
    let mut iovs = Vec::with_capacity(iovcnt);
    for index in 0..iovcnt {
        let base = iov + (index as i32 * 8);
        let ptr = read_u32(caller, base)? as i32;
        let len = read_u32(caller, base + 4)? as usize;
        iovs.push((ptr, len));
    }
    Ok(iovs)
}

fn checked_iov_ranges(
    caller: &mut Caller<'_, HostState>,
    iovs: &[(i32, usize)],
) -> wasmtime::Result<CheckedIovRanges> {
    let memory = exported_memory(caller)?;
    let data = memory.data(&*caller);
    let mut ranges = Vec::with_capacity(iovs.len());
    let mut total = 0usize;
    for (ptr, len) in iovs {
        let start =
            usize::try_from(*ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
        let end = start
            .checked_add(*len)
            .ok_or_else(|| wasmtime::Error::msg("wasm memory read range overflow"))?;
        data.get(start..end)
            .ok_or_else(|| wasmtime::Error::msg("failed reading wasm memory: out of bounds"))?;
        total = total
            .checked_add(*len)
            .ok_or_else(|| wasmtime::Error::msg("fd_write byte count overflow"))?;
        ranges.push((start, end));
    }
    Ok((memory, ranges, total))
}

fn capture_fd_write_iovs(
    caller: &mut Caller<'_, HostState>,
    target: CaptureWriteTarget,
    iovs: &[(i32, usize)],
) -> wasmtime::Result<usize> {
    let (memory, ranges, total) = checked_iov_ranges(caller, iovs)?;
    let mut buffer = {
        let state = caller.data_mut();
        match target {
            CaptureWriteTarget::Stdout => std::mem::take(&mut state.captured_stdout),
            CaptureWriteTarget::Stderr => std::mem::take(&mut state.captured_stderr),
            CaptureWriteTarget::Headers => std::mem::take(&mut state.captured_headers),
        }
    };
    buffer.reserve(total);
    {
        let data = memory.data(&*caller);
        for (start, end) in ranges {
            buffer.extend_from_slice(&data[start..end]);
        }
    }
    let state = caller.data_mut();
    match target {
        CaptureWriteTarget::Stdout => state.captured_stdout = buffer,
        CaptureWriteTarget::Stderr => state.captured_stderr = buffer,
        CaptureWriteTarget::Headers => state.captured_headers = buffer,
    }
    Ok(total)
}

fn exported_memory(caller: &mut Caller<'_, HostState>) -> wasmtime::Result<Memory> {
    caller
        .get_export("memory")
        .and_then(|export| export.into_memory())
        .ok_or_else(|| wasmtime::Error::msg("caller does not export memory"))
}

fn read_bytes(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    len: usize,
) -> wasmtime::Result<Vec<u8>> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data(&*caller);
    let end = ptr
        .checked_add(len)
        .ok_or_else(|| wasmtime::Error::msg("wasm memory read range overflow"))?;
    let bytes = data
        .get(ptr..end)
        .ok_or_else(|| wasmtime::Error::msg("failed reading wasm memory: out of bounds"))?;
    Ok(bytes.to_vec())
}

fn write_bytes(caller: &mut Caller<'_, HostState>, ptr: i32, bytes: &[u8]) -> wasmtime::Result<()> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data_mut(&mut *caller);
    let end = ptr
        .checked_add(bytes.len())
        .ok_or_else(|| wasmtime::Error::msg("wasm memory write range overflow"))?;
    let dest = data
        .get_mut(ptr..end)
        .ok_or_else(|| wasmtime::Error::msg("failed writing wasm memory: out of bounds"))?;
    dest.copy_from_slice(bytes);
    Ok(())
}

fn read_u32(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<u32> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data(&*caller);
    let bytes = data
        .get(ptr..ptr.saturating_add(4))
        .and_then(|bytes| bytes.try_into().ok())
        .ok_or_else(|| wasmtime::Error::msg("failed reading wasm memory: out of bounds"))?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_i32(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<i32> {
    Ok(read_u32(caller, ptr)? as i32)
}

fn read_u16(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<u16> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data(&*caller);
    let bytes = data
        .get(ptr..ptr.saturating_add(2))
        .and_then(|bytes| bytes.try_into().ok())
        .ok_or_else(|| wasmtime::Error::msg("failed reading wasm memory: out of bounds"))?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_u64(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<u64> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data(&*caller);
    let bytes = data
        .get(ptr..ptr.saturating_add(8))
        .and_then(|bytes| bytes.try_into().ok())
        .ok_or_else(|| wasmtime::Error::msg("failed reading wasm memory: out of bounds"))?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_i64(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<i64> {
    let bytes = read_bytes(caller, ptr, 8)?;
    Ok(i64::from_le_bytes(bytes.try_into().unwrap()))
}

fn write_u8(caller: &mut Caller<'_, HostState>, ptr: i32, value: u8) -> wasmtime::Result<()> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data_mut(&mut *caller);
    let dest = data
        .get_mut(ptr)
        .ok_or_else(|| wasmtime::Error::msg("failed writing wasm memory: out of bounds"))?;
    *dest = value;
    Ok(())
}

fn write_u16(caller: &mut Caller<'_, HostState>, ptr: i32, value: u16) -> wasmtime::Result<()> {
    write_bytes(caller, ptr, &value.to_le_bytes())
}

fn write_u32(caller: &mut Caller<'_, HostState>, ptr: i32, value: u32) -> wasmtime::Result<()> {
    write_bytes(caller, ptr, &value.to_le_bytes())
}

fn write_i32(caller: &mut Caller<'_, HostState>, ptr: i32, value: i32) -> wasmtime::Result<()> {
    write_bytes(caller, ptr, &value.to_le_bytes())
}

fn write_u64(caller: &mut Caller<'_, HostState>, ptr: i32, value: u64) -> wasmtime::Result<()> {
    write_bytes(caller, ptr, &value.to_le_bytes())
}

fn write_i64(caller: &mut Caller<'_, HostState>, ptr: i32, value: i64) -> wasmtime::Result<()> {
    write_bytes(caller, ptr, &value.to_le_bytes())
}

fn read_c_string(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<String> {
    String::from_utf8(read_c_string_bytes(caller, ptr)?)
        .map_err(|error| wasmtime::Error::msg(format!("invalid UTF-8 string: {error}")))
}

fn read_c_string_bytes(caller: &mut Caller<'_, HostState>, ptr: i32) -> wasmtime::Result<Vec<u8>> {
    let ptr = usize::try_from(ptr).map_err(|_| wasmtime::Error::msg("negative memory pointer"))?;
    let memory = exported_memory(caller)?;
    let data = memory.data(&*caller);
    let max_end = ptr.saturating_add(65536).min(data.len());
    let bytes = data
        .get(ptr..max_end)
        .ok_or_else(|| wasmtime::Error::msg("failed reading wasm memory: out of bounds"))?;
    let nul = bytes
        .iter()
        .position(|byte| *byte == 0)
        .ok_or_else(|| wasmtime::Error::msg("unterminated C string"))?;
    Ok(bytes[..nul].to_vec())
}

fn write_c_string_fixed(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    value: &str,
    max_len: usize,
) -> wasmtime::Result<()> {
    let mut bytes = value.as_bytes().to_vec();
    bytes.truncate(max_len.saturating_sub(1));
    bytes.push(0);
    if bytes.len() < max_len {
        bytes.resize(max_len, 0);
    }
    write_bytes(caller, ptr, &bytes)
}

fn write_c_string_bounded(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    max_len: i32,
    value: &str,
) -> wasmtime::Result<bool> {
    let max_len = match usize::try_from(max_len) {
        Ok(max_len) if max_len > 0 => max_len,
        _ => return Ok(true),
    };
    let mut bytes = value.as_bytes().to_vec();
    let overflowed = bytes.len().saturating_add(1) > max_len;
    bytes.truncate(max_len.saturating_sub(1));
    bytes.push(0);
    write_bytes(caller, ptr, &bytes)?;
    Ok(overflowed)
}

fn read_file_times(
    caller: &mut Caller<'_, HostState>,
    times_ptr: i32,
) -> wasmtime::Result<std::result::Result<Option<fs::FileTimes>, i32>> {
    if times_ptr == 0 {
        let now = SystemTime::now();
        return Ok(Ok(Some(
            fs::FileTimes::new().set_accessed(now).set_modified(now),
        )));
    }

    let now = SystemTime::now();
    let accessed = match read_timespec_time(caller, times_ptr, now)? {
        Ok(time) => time,
        Err(errno) => return Ok(Err(errno)),
    };
    let modified = match read_timespec_time(caller, times_ptr + 16, now)? {
        Ok(time) => time,
        Err(errno) => return Ok(Err(errno)),
    };
    if accessed.is_none() && modified.is_none() {
        return Ok(Ok(None));
    }

    let mut times = fs::FileTimes::new();
    if let Some(accessed) = accessed {
        times = times.set_accessed(accessed);
    }
    if let Some(modified) = modified {
        times = times.set_modified(modified);
    }
    Ok(Ok(Some(times)))
}

fn read_timespec_time(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    now: SystemTime,
) -> wasmtime::Result<std::result::Result<Option<SystemTime>, i32>> {
    let seconds = read_i64(caller, ptr)?;
    let nanoseconds = read_i32(caller, ptr + 8)?;
    match nanoseconds {
        UTIME_NOW => Ok(Ok(Some(now))),
        UTIME_OMIT => Ok(Ok(None)),
        0..=999_999_999 => Ok(system_time_from_unix_parts(seconds, nanoseconds as u32).map(Some)),
        _ => Ok(Err(EINVAL)),
    }
}

fn system_time_from_unix_parts(
    seconds: i64,
    nanoseconds: u32,
) -> std::result::Result<SystemTime, i32> {
    let duration = Duration::new(seconds.unsigned_abs(), nanoseconds);
    if seconds >= 0 {
        UNIX_EPOCH.checked_add(duration).ok_or(EINVAL)
    } else {
        UNIX_EPOCH.checked_sub(duration).ok_or(EINVAL)
    }
}

fn write_dirent_name(
    caller: &mut Caller<'_, HostState>,
    ptr: i32,
    value: &str,
) -> wasmtime::Result<()> {
    let mut bytes = [0u8; 256];
    let value = value.as_bytes();
    let len = value.len().min(255);
    bytes[..len].copy_from_slice(&value[..len]);
    write_bytes(caller, ptr, &bytes)
}

fn write_stat(
    caller: &mut Caller<'_, HostState>,
    buf: i32,
    stat: &VfsStat,
) -> wasmtime::Result<()> {
    let now_secs = unix_time_ns()? / 1_000_000_000;
    write_u32(caller, buf, 1)?;
    write_u32(caller, buf + 4, stat.mode)?;
    write_u32(caller, buf + 8, stat.nlink)?;
    write_u32(caller, buf + 12, 0)?;
    write_u32(caller, buf + 16, 0)?;
    write_u32(caller, buf + 20, 0)?;
    write_u64(caller, buf + 24, stat.size)?;
    write_u32(caller, buf + 32, 4096)?;
    write_u32(caller, buf + 36, stat.size.div_ceil(512) as u32)?;
    write_u64(caller, buf + 40, stat.atime_secs.unwrap_or(now_secs))?;
    write_u32(caller, buf + 48, 0)?;
    write_u64(caller, buf + 56, stat.mtime_secs.unwrap_or(now_secs))?;
    write_u32(caller, buf + 64, 0)?;
    write_u64(caller, buf + 72, stat.ctime_secs.unwrap_or(now_secs))?;
    write_u32(caller, buf + 80, 0)?;
    write_u64(caller, buf + 88, stat.ino)?;
    Ok(())
}

fn write_statfs64(caller: &mut Caller<'_, HostState>, buf: i32) -> wasmtime::Result<()> {
    write_bytes(caller, buf, &[0; 120])?;
    write_u32(caller, buf, 0xEF53)?;
    write_u32(caller, buf + 4, 4096)?;
    write_u64(caller, buf + 8, 1_048_576)?;
    write_u64(caller, buf + 16, 1_048_576)?;
    write_u64(caller, buf + 24, 1_048_576)?;
    write_u64(caller, buf + 32, 1_048_576)?;
    write_u64(caller, buf + 40, 1_048_576)?;
    write_u32(caller, buf + 56, 255)?;
    write_u32(caller, buf + 60, 4096)?;
    Ok(())
}

fn wasm_malloc(caller: &mut Caller<'_, HostState>, len: u32) -> wasmtime::Result<u32> {
    let malloc = caller
        .get_export("malloc")
        .and_then(|export| export.into_func())
        .ok_or_else(|| wasmtime::Error::msg("caller does not export malloc"))?;
    let mut results = [Val::I32(0)];
    malloc.call(&mut *caller, &[Val::I32(len as i32)], &mut results)?;
    match results[0] {
        Val::I32(ptr) => Ok(ptr as u32),
        _ => Err(wasmtime::Error::msg("malloc returned a non-i32 value")),
    }
}

fn write_malloced_c_string(
    caller: &mut Caller<'_, HostState>,
    value: &str,
) -> wasmtime::Result<i32> {
    let ptr = wasm_malloc(caller, value.len().saturating_add(1) as u32)? as i32;
    write_bytes(caller, ptr, value.as_bytes())?;
    write_u8(caller, ptr + value.len() as i32, 0)?;
    Ok(ptr)
}

fn protocol_by_name(name: &str) -> Option<(&'static str, i32, &'static [&'static str])> {
    if name.eq_ignore_ascii_case("tcp") {
        Some(("tcp", IPPROTO_TCP, &["TCP"]))
    } else if name.eq_ignore_ascii_case("udp") {
        Some(("udp", 17, &["UDP"]))
    } else {
        None
    }
}

fn protocol_by_number(number: i32) -> Option<(&'static str, i32, &'static [&'static str])> {
    match number {
        IPPROTO_TCP => Some(("tcp", IPPROTO_TCP, &["TCP"])),
        17 => Some(("udp", 17, &["UDP"])),
        _ => None,
    }
}

fn write_protoent(
    caller: &mut Caller<'_, HostState>,
    name: &str,
    number: i32,
    aliases: &[&str],
) -> wasmtime::Result<i32> {
    let name_ptr = write_malloced_c_string(caller, name)?;
    let alias_list_ptr = wasm_malloc(caller, (aliases.len().saturating_add(1) * 4) as u32)? as i32;
    for (index, alias) in aliases.iter().enumerate() {
        let alias_ptr = write_malloced_c_string(caller, alias)?;
        write_u32(
            caller,
            alias_list_ptr + (index as i32 * 4),
            alias_ptr as u32,
        )?;
    }
    write_u32(caller, alias_list_ptr + (aliases.len() as i32 * 4), 0)?;
    let protoent_ptr = wasm_malloc(caller, 12)? as i32;
    write_u32(caller, protoent_ptr, name_ptr as u32)?;
    write_u32(caller, protoent_ptr + 4, alias_list_ptr as u32)?;
    write_u32(caller, protoent_ptr + 8, number as u32)?;
    Ok(protoent_ptr)
}

fn set_errno(caller: &mut Caller<'_, HostState>, errno: i32) -> wasmtime::Result<()> {
    let Some(errno_location) = caller
        .get_export("__errno_location")
        .and_then(|export| export.into_func())
    else {
        return Ok(());
    };
    let mut results = [Val::I32(0)];
    errno_location.call(&mut *caller, &[], &mut results)?;
    let Val::I32(ptr) = results[0] else {
        return Err(wasmtime::Error::msg(
            "__errno_location returned a non-i32 value",
        ));
    };
    if ptr != 0 {
        write_u32(caller, ptr, errno as u32)?;
    }
    Ok(())
}

fn unix_time_ns() -> wasmtime::Result<u64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| {
            wasmtime::Error::msg(format!("system clock before UNIX epoch: {error}"))
        })?;
    Ok(duration.as_nanos() as u64)
}

fn stable_inode(path: &str) -> u64 {
    let mut hash = 1469598103934665603u64;
    for byte in path.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1099511628211);
    }
    hash.max(2)
}

#[cfg(test)]
mod tests {
    use std::{
        ffi::OsString,
        fs,
        io::{Read, Write},
        net::{TcpListener, TcpStream as StdTcpStream},
        sync::Mutex,
        thread,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    use wasmtime::{Engine, Memory, Module, Store, Val};

    use super::{
        cached_host_read_file_len, create_stub_import_linker,
        create_stub_import_linker_with_options, read_host_file_iovs, AdvisoryLockRange,
        FcntlLockRequest, FdEntry, HostMount, HostOptions, HostState, ImportClassification,
        OpcacheMode, PhpConstantValue, AF_INET, EACCES, EAGAIN, EAI_NONAME, EALREADY, EINPROGRESS,
        EINVAL, ENOENT, ENOSYS, EXPERIMENTAL_PHP_INI_APPEND_ENV_VAR, F_RDLCK, F_UNLCK, F_WRLCK,
        LOCK_EX, LOCK_NB, LOCK_SH, LOCK_UN, MAX_LOCK_OFFSET, OPCACHE_INTERNED_STRINGS_ENV_VAR,
        OPCACHE_MAX_ACCELERATED_FILES_ENV_VAR, OPCACHE_MEMORY_ENV_VAR, O_EXCL, O_NONBLOCK, O_RDWR,
        O_TMPFILE, O_TRUNC, O_WRONLY, POLLERR, POLLIN, POLLOUT,
        PROFILE_IMPORT_INCLUSIVE_TIME_ENV_VAR, SEEK_CUR, SEEK_END, SEEK_SET, SOCK_STREAM, S_IFDIR,
        S_IFREG,
    };
    #[cfg(unix)]
    use super::{HostProcessCommand, HostProcessPolicy};

    const EXPECTED_ECONNREFUSED: i32 = 14;
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("wp-playground-native-host-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn internal_file_text(state: &HostState, path: &str) -> String {
        String::from_utf8(state.internal_files.get(path).unwrap().as_ref().to_vec()).unwrap()
    }

    struct EnvVarGuard {
        name: &'static str,
        previous: Option<OsString>,
    }

    impl EnvVarGuard {
        fn set(name: &'static str, value: &str) -> Self {
            let previous = std::env::var_os(name);
            std::env::set_var(name, value);
            Self { name, previous }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            restore_env(self.name, self.previous.take());
        }
    }

    fn write_ipv4_sockaddr(store: &mut Store<HostState>, memory: &Memory, port: u16) {
        let mut sockaddr = [0u8; 16];
        sockaddr[0..2].copy_from_slice(&(AF_INET as u16).to_le_bytes());
        sockaddr[2..4].copy_from_slice(&port.to_be_bytes());
        sockaddr[4..8].copy_from_slice(&[127, 0, 0, 1]);
        memory.write(store, 64, &sockaddr).unwrap();
    }

    fn stub_linker_error(module: &Module) -> String {
        match create_stub_import_linker(module) {
            Ok(_) => panic!("expected stub linker creation to fail"),
            Err(error) => error.to_string(),
        }
    }

    fn read_ipv4_sockaddr_port(store: &Store<HostState>, memory: &Memory, offset: usize) -> u16 {
        let mut sockaddr = [0u8; 16];
        memory.read(store, offset, &mut sockaddr).unwrap();
        u16::from_be_bytes([sockaddr[2], sockaddr[3]])
    }

    #[test]
    fn stub_linker_instantiates_and_calls_tiny_imported_module() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "js_wasm_trace" (func $js_wasm_trace (param i32) (result i32)))
                (import "GOT.func" "exit" (global (mut i32)))
                (func (export "call_import") (result i32)
                    i32.const 123
                    call $js_wasm_trace
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        assert_eq!(linker.imports.len(), 2);

        let instance = linker.instantiate(&module).unwrap();
        let call_import = instance.get_func(&mut linker.store, "call_import").unwrap();
        let mut results = [Val::I32(-1)];
        call_import
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.js_wasm_trace".to_string()]
        );
    }

    #[test]
    fn stub_linker_skips_import_metadata_when_trace_disabled() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "js_wasm_trace" (func $js_wasm_trace (param i32) (result i32)))
                (func (export "call_import") (result i32)
                    i32.const 123
                    call $js_wasm_trace
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                capture_import_trace: false,
                ..HostOptions::default()
            },
        )
        .unwrap();
        assert!(linker.imports.is_empty());

        let instance = linker.instantiate(&module).unwrap();
        let call_import = instance.get_func(&mut linker.store, "call_import").unwrap();
        let mut results = [Val::I32(-1)];
        call_import
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert!(linker.store.data().called_imports.is_empty());
        assert_eq!(linker.store.data().import_call_count(), 1);
    }

    #[test]
    fn emscripten_now_imports_return_epoch_ms_and_advance() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "emscripten_date_now" (func $date_now (result f64)))
                (import "env" "emscripten_get_now" (func $get_now (result f64)))
                (func (export "date_now") (result f64)
                    call $date_now
                )
                (func (export "get_now") (result f64)
                    call $get_now
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let date_now = instance
            .get_typed_func::<(), f64>(&mut linker.store, "date_now")
            .unwrap();
        let get_now = instance
            .get_typed_func::<(), f64>(&mut linker.store, "get_now")
            .unwrap();

        let first = date_now.call(&mut linker.store, ()).unwrap();
        thread::sleep(Duration::from_millis(2));
        let second = get_now.call(&mut linker.store, ()).unwrap();

        assert!(first > 1_000_000_000_000.0);
        assert!(second >= first);
        assert_eq!(linker.store.data().import_call_count(), 2);
    }

    #[test]
    fn network_imports_resolve_and_talk_to_loopback_tcp() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 1024];
            let bytes_read = stream.read(&mut request).unwrap();
            assert!(request[..bytes_read]
                .windows(b"GET / HTTP/1.0".len())
                .any(|window| window == b"GET / HTTP/1.0"));
            stream
                .write_all(b"HTTP/1.0 200 OK\r\nContent-Length: 5\r\n\r\nhello")
                .unwrap();
        });

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "getaddrinfo"
                    (func $getaddrinfo (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_socket"
                    (func $socket (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_connect"
                    (func $connect (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_sendto"
                    (func $sendto (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_recvfrom"
                    (func $recvfrom (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_getsockopt"
                    (func $getsockopt (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_poll"
                    (func $poll (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 2048))
                (data (i32.const 64) "127.0.0.1\00")
                (data (i32.const 384) "GET / HTTP/1.0\r\nHost: localhost\r\n\r\n")
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func (export "resolve") (result i32)
                    i32.const 64
                    i32.const 128
                    i32.const 0
                    i32.const 16
                    call $getaddrinfo
                )
                (func (export "addrinfo_out") (result i32)
                    i32.const 16
                    i32.load
                )
                (func (export "socket") (result i32)
                    i32.const 2
                    i32.const 1
                    i32.const 6
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $socket
                )
                (func (export "ai_family") (result i32)
                    i32.const 16
                    i32.load
                    i32.const 4
                    i32.add
                    i32.load
                )
                (func (export "connect_fd") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 16
                    i32.load
                    i32.const 20
                    i32.add
                    i32.load
                    i32.const 16
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $connect
                )
                (func (export "send_request") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 384
                    i32.const 35
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $sendto
                )
                (func (export "poll_fd") (param $fd i32) (result i32)
                    i32.const 768
                    local.get $fd
                    i32.store
                    i32.const 772
                    i32.const 5
                    i32.store16
                    i32.const 774
                    i32.const 0
                    i32.store16
                    i32.const 768
                    i32.const 1
                    i32.const 0
                    call $poll
                )
                (func (export "poll_revents") (result i32)
                    i32.const 774
                    i32.load16_u
                )
                (func (export "getsock_error") (param $fd i32) (result i32)
                    (local $rc i32)
                    i32.const 900
                    i32.const 4
                    i32.store
                    local.get $fd
                    i32.const 1
                    i32.const 4
                    i32.const 904
                    i32.const 900
                    i32.const 0
                    call $getsockopt
                    local.set $rc
                    local.get $rc
                    if (result i32)
                        local.get $rc
                    else
                        i32.const 904
                        i32.load
                    end
                )
                (func (export "recv_response") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 512
                    i32.const 128
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $recvfrom
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        let service = port.to_string();
        memory
            .write(&mut linker.store, 128, service.as_bytes())
            .unwrap();
        memory
            .write(&mut linker.store, 128 + service.len(), &[0])
            .unwrap();

        let resolve = instance.get_func(&mut linker.store, "resolve").unwrap();
        let addrinfo_out = instance
            .get_func(&mut linker.store, "addrinfo_out")
            .unwrap();
        let socket = instance.get_func(&mut linker.store, "socket").unwrap();
        let ai_family = instance.get_func(&mut linker.store, "ai_family").unwrap();
        let connect_fd = instance.get_func(&mut linker.store, "connect_fd").unwrap();
        let send_request = instance
            .get_func(&mut linker.store, "send_request")
            .unwrap();
        let poll_fd = instance.get_func(&mut linker.store, "poll_fd").unwrap();
        let poll_revents = instance
            .get_func(&mut linker.store, "poll_revents")
            .unwrap();
        let getsock_error = instance
            .get_func(&mut linker.store, "getsock_error")
            .unwrap();
        let recv_response = instance
            .get_func(&mut linker.store, "recv_response")
            .unwrap();

        let mut results = [Val::I32(0)];
        resolve.call(&mut linker.store, &[], &mut results).unwrap();
        assert!(matches!(results, [Val::I32(0)]));

        addrinfo_out
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value >= 2048));

        ai_family
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(2)]));

        socket.call(&mut linker.store, &[], &mut results).unwrap();
        let Val::I32(fd) = results[0] else {
            panic!("socket fd must be i32");
        };
        assert!(fd >= 3);

        connect_fd
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));

        getsock_error
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));

        poll_fd
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(1)]));
        poll_revents
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value & 4 == 4));

        send_request
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(35)]));

        recv_response
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        let Val::I32(bytes_read) = results[0] else {
            panic!("recv count must be i32");
        };
        assert!(bytes_read > 0);

        let mut response = vec![0; usize::try_from(bytes_read).unwrap()];
        memory.read(&linker.store, 512, &mut response).unwrap();
        assert!(response
            .windows(b"hello".len())
            .any(|window| window == b"hello"));

        server.join().unwrap();
    }

    fn tcp_listener_test_module(engine: &Engine) -> Module {
        Module::new(
            engine,
            r#"
            (module
                (import "env" "__syscall_socket"
                    (func $socket (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_bind"
                    (func $bind (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_listen"
                    (func $listen (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_getsockname"
                    (func $getsockname (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_accept4"
                    (func $accept4 (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_sendto"
                    (func $sendto (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_recvfrom"
                    (func $recvfrom (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_poll"
                    (func $poll (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 2048))
                (global $listener (mut i32) (i32.const -1))
                (global $accepted (mut i32) (i32.const -1))
                (data (i32.const 320) "pong")
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func (export "setup_listener") (param $socket_type i32) (result i32)
                    (local $fd i32)
                    (local $rc i32)
                    i32.const 2
                    local.get $socket_type
                    i32.const 6
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $socket
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if
                        local.get $fd
                        return
                    end

                    local.get $fd
                    i32.const 64
                    i32.const 16
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $bind
                    local.tee $rc
                    if
                        local.get $rc
                        return
                    end

                    local.get $fd
                    i32.const 4
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $listen
                    local.tee $rc
                    if
                        local.get $rc
                        return
                    end

                    local.get $fd
                    global.set $listener
                    i32.const 124
                    i32.const 16
                    i32.store
                    local.get $fd
                    i32.const 128
                    i32.const 124
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $getsockname
                    local.tee $rc
                    if
                        local.get $rc
                        return
                    end
                    local.get $fd
                )
                (func (export "accept_store") (param $flags i32) (result i32)
                    (local $fd i32)
                    i32.const 188
                    i32.const 16
                    i32.store
                    global.get $listener
                    i32.const 192
                    i32.const 188
                    local.get $flags
                    i32.const 0
                    i32.const 0
                    call $accept4
                    local.tee $fd
                    i32.const 0
                    i32.ge_s
                    if
                        local.get $fd
                        global.set $accepted
                    end
                    local.get $fd
                )
                (func (export "echo_accepted") (result i32)
                    (local $rc i32)
                    global.get $accepted
                    i32.const 256
                    i32.const 4
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $recvfrom
                    local.tee $rc
                    i32.const 4
                    i32.ne
                    if
                        local.get $rc
                        return
                    end
                    global.get $accepted
                    i32.const 320
                    i32.const 4
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $sendto
                )
                (func (export "poll_listener") (param $timeout i32) (result i32)
                    i32.const 512
                    global.get $listener
                    i32.store
                    i32.const 516
                    i32.const 1
                    i32.store16
                    i32.const 518
                    i32.const 0
                    i32.store16
                    i32.const 512
                    i32.const 1
                    local.get $timeout
                    call $poll
                )
                (func (export "poll_revents") (result i32)
                    i32.const 518
                    i32.load16_u
                )
            )
            "#,
        )
        .unwrap()
    }

    #[test]
    fn network_imports_bind_listen_accept4_tcp_round_trip() {
        let engine = Engine::default();
        let module = tcp_listener_test_module(&engine);
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        write_ipv4_sockaddr(&mut linker.store, &memory, 0);
        let setup_listener = instance
            .get_typed_func::<i32, i32>(&mut linker.store, "setup_listener")
            .unwrap();
        let accept_store = instance
            .get_typed_func::<i32, i32>(&mut linker.store, "accept_store")
            .unwrap();
        let echo_accepted = instance
            .get_typed_func::<(), i32>(&mut linker.store, "echo_accepted")
            .unwrap();

        let listener_fd = setup_listener.call(&mut linker.store, SOCK_STREAM).unwrap();
        assert!(listener_fd >= 0);
        let port = read_ipv4_sockaddr_port(&linker.store, &memory, 128);
        let client = thread::spawn(move || {
            let mut stream = StdTcpStream::connect(("127.0.0.1", port)).unwrap();
            stream.write_all(b"ping").unwrap();
            let mut response = [0; 4];
            stream.read_exact(&mut response).unwrap();
            assert_eq!(&response, b"pong");
        });

        let accepted_fd = accept_store.call(&mut linker.store, 0).unwrap();
        assert!(accepted_fd >= 0);
        assert_eq!(echo_accepted.call(&mut linker.store, ()).unwrap(), 4);
        client.join().unwrap();
    }

    #[test]
    fn network_imports_nonblocking_listener_poll_queues_accept() {
        let engine = Engine::default();
        let module = tcp_listener_test_module(&engine);
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        write_ipv4_sockaddr(&mut linker.store, &memory, 0);
        let setup_listener = instance
            .get_typed_func::<i32, i32>(&mut linker.store, "setup_listener")
            .unwrap();
        let accept_store = instance
            .get_typed_func::<i32, i32>(&mut linker.store, "accept_store")
            .unwrap();
        let echo_accepted = instance
            .get_typed_func::<(), i32>(&mut linker.store, "echo_accepted")
            .unwrap();
        let poll_listener = instance
            .get_typed_func::<i32, i32>(&mut linker.store, "poll_listener")
            .unwrap();
        let poll_revents = instance
            .get_typed_func::<(), i32>(&mut linker.store, "poll_revents")
            .unwrap();

        let listener_fd = setup_listener
            .call(&mut linker.store, SOCK_STREAM | O_NONBLOCK)
            .unwrap();
        assert!(listener_fd >= 0);
        assert_eq!(accept_store.call(&mut linker.store, 0).unwrap(), -EAGAIN);
        let port = read_ipv4_sockaddr_port(&linker.store, &memory, 128);
        let client = thread::spawn(move || {
            let mut stream = StdTcpStream::connect(("127.0.0.1", port)).unwrap();
            stream.write_all(b"ping").unwrap();
            let mut response = [0; 4];
            stream.read_exact(&mut response).unwrap();
            assert_eq!(&response, b"pong");
        });

        assert_eq!(poll_listener.call(&mut linker.store, 1000).unwrap(), 1);
        let revents = poll_revents.call(&mut linker.store, ()).unwrap();
        assert_ne!(revents & i32::from(POLLIN), 0, "revents={revents}");
        let accepted_fd = accept_store.call(&mut linker.store, 0).unwrap();
        assert!(accepted_fd >= 0);
        assert_eq!(echo_accepted.call(&mut linker.store, ()).unwrap(), 4);
        client.join().unwrap();
    }

    #[test]
    fn network_imports_resolve_and_talk_to_ipv6_loopback_tcp() {
        let listener = TcpListener::bind((std::net::Ipv6Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 1024];
            let bytes_read = stream.read(&mut request).unwrap();
            assert!(request[..bytes_read]
                .windows(b"GET / HTTP/1.0".len())
                .any(|window| window == b"GET / HTTP/1.0"));
            stream
                .write_all(b"HTTP/1.0 200 OK\r\nContent-Length: 5\r\n\r\nhello")
                .unwrap();
        });

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "getaddrinfo"
                    (func $getaddrinfo (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_socket"
                    (func $socket (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_connect"
                    (func $connect (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_sendto"
                    (func $sendto (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_recvfrom"
                    (func $recvfrom (param i32 i32 i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 2048))
                (data (i32.const 64) "::1\00")
                (data (i32.const 384) "GET / HTTP/1.0\r\nHost: localhost\r\n\r\n")
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func (export "resolve") (result i32)
                    i32.const 64
                    i32.const 128
                    i32.const 0
                    i32.const 16
                    call $getaddrinfo
                )
                (func (export "addrinfo_out") (result i32)
                    i32.const 16
                    i32.load
                )
                (func (export "ai_family") (result i32)
                    i32.const 16
                    i32.load
                    i32.const 4
                    i32.add
                    i32.load
                )
                (func (export "ai_addrlen") (result i32)
                    i32.const 16
                    i32.load
                    i32.const 16
                    i32.add
                    i32.load
                )
                (func (export "socket") (result i32)
                    i32.const 10
                    i32.const 1
                    i32.const 6
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $socket
                )
                (func (export "connect_fd") (param $fd i32) (result i32)
                    (local $addrinfo i32)
                    local.get $fd
                    i32.const 16
                    i32.load
                    local.tee $addrinfo
                    i32.const 20
                    i32.add
                    i32.load
                    local.get $addrinfo
                    i32.const 16
                    i32.add
                    i32.load
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $connect
                )
                (func (export "send_request") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 384
                    i32.const 35
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $sendto
                )
                (func (export "recv_response") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 512
                    i32.const 128
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $recvfrom
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        let service = port.to_string();
        memory
            .write(&mut linker.store, 128, service.as_bytes())
            .unwrap();
        memory
            .write(&mut linker.store, 128 + service.len(), &[0])
            .unwrap();

        let resolve = instance.get_func(&mut linker.store, "resolve").unwrap();
        let addrinfo_out = instance
            .get_func(&mut linker.store, "addrinfo_out")
            .unwrap();
        let ai_family = instance.get_func(&mut linker.store, "ai_family").unwrap();
        let ai_addrlen = instance.get_func(&mut linker.store, "ai_addrlen").unwrap();
        let socket = instance.get_func(&mut linker.store, "socket").unwrap();
        let connect_fd = instance.get_func(&mut linker.store, "connect_fd").unwrap();
        let send_request = instance
            .get_func(&mut linker.store, "send_request")
            .unwrap();
        let recv_response = instance
            .get_func(&mut linker.store, "recv_response")
            .unwrap();

        let mut results = [Val::I32(0)];
        resolve.call(&mut linker.store, &[], &mut results).unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        addrinfo_out
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value >= 2048));
        ai_family
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(10)]));
        ai_addrlen
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(28)]));

        socket.call(&mut linker.store, &[], &mut results).unwrap();
        let Val::I32(fd) = results[0] else {
            panic!("socket fd must be i32");
        };
        assert!(fd >= 3);

        connect_fd
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        send_request
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(35)]));
        recv_response
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        let Val::I32(bytes_read) = results[0] else {
            panic!("recv count must be i32");
        };
        assert!(bytes_read > 0);

        let mut response = vec![0; usize::try_from(bytes_read).unwrap()];
        memory.read(&linker.store, 512, &mut response).unwrap();
        assert!(response
            .windows(b"hello".len())
            .any(|window| window == b"hello"));

        server.join().unwrap();
    }

    #[test]
    fn network_imports_preserve_socket_nonblocking_status_flags() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            std::thread::sleep(Duration::from_millis(200));
            let _ = stream.write_all(b"hello");
        });

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "getaddrinfo"
                    (func $getaddrinfo (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_socket"
                    (func $socket (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_connect"
                    (func $connect (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_fcntl64"
                    (func $fcntl (param i32 i32 i32) (result i32)))
                (import "env" "__syscall_poll"
                    (func $poll (param i32 i32 i32) (result i32)))
                (import "env" "__syscall_recvfrom"
                    (func $recvfrom (param i32 i32 i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 2048))
                (data (i32.const 64) "127.0.0.1\00")
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func (export "resolve") (result i32)
                    i32.const 64
                    i32.const 128
                    i32.const 0
                    i32.const 16
                    call $getaddrinfo
                )
                (func (export "socket") (result i32)
                    i32.const 2
                    i32.const 1
                    i32.const 6
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $socket
                )
                (func (export "connect_fd") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 16
                    i32.load
                    i32.const 20
                    i32.add
                    i32.load
                    i32.const 16
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $connect
                )
                (func (export "set_nonblocking") (param $fd i32) (result i32)
                    i32.const 32
                    i32.const 2048
                    i32.store
                    local.get $fd
                    i32.const 4
                    i32.const 32
                    call $fcntl
                )
                (func (export "get_flags") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 3
                    i32.const 0
                    call $fcntl
                )
                (func (export "poll_read") (param $fd i32) (result i32)
                    i32.const 768
                    local.get $fd
                    i32.store
                    i32.const 772
                    i32.const 1
                    i32.store16
                    i32.const 774
                    i32.const 0
                    i32.store16
                    i32.const 768
                    i32.const 1
                    i32.const 0
                    call $poll
                )
                (func (export "poll_revents") (result i32)
                    i32.const 774
                    i32.load16_u
                )
                (func (export "recv_now") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 512
                    i32.const 8
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $recvfrom
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        let service = port.to_string();
        memory
            .write(&mut linker.store, 128, service.as_bytes())
            .unwrap();
        memory
            .write(&mut linker.store, 128 + service.len(), &[0])
            .unwrap();

        let resolve = instance.get_func(&mut linker.store, "resolve").unwrap();
        let socket = instance.get_func(&mut linker.store, "socket").unwrap();
        let connect_fd = instance.get_func(&mut linker.store, "connect_fd").unwrap();
        let set_nonblocking = instance
            .get_func(&mut linker.store, "set_nonblocking")
            .unwrap();
        let get_flags = instance.get_func(&mut linker.store, "get_flags").unwrap();
        let poll_read = instance.get_func(&mut linker.store, "poll_read").unwrap();
        let poll_revents = instance
            .get_func(&mut linker.store, "poll_revents")
            .unwrap();
        let recv_now = instance.get_func(&mut linker.store, "recv_now").unwrap();

        let mut results = [Val::I32(0)];
        resolve.call(&mut linker.store, &[], &mut results).unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        socket.call(&mut linker.store, &[], &mut results).unwrap();
        let Val::I32(fd) = results[0] else {
            panic!("socket fd must be i32");
        };
        connect_fd
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        set_nonblocking
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        get_flags
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(flags)] if flags & O_NONBLOCK == O_NONBLOCK));
        poll_read
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        poll_revents
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));
        recv_now
            .call(&mut linker.store, &[Val::I32(fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value == -EAGAIN));

        server.join().unwrap();
    }

    #[test]
    fn network_imports_nonblocking_connect_reports_pending_and_so_error() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let success_port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let _ = listener.accept().unwrap();
        });

        let refused_port = {
            let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
            listener.local_addr().unwrap().port()
        };

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_socket"
                    (func $socket (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_connect"
                    (func $connect (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_poll"
                    (func $poll (param i32 i32 i32) (result i32)))
                (import "env" "__syscall_getsockopt"
                    (func $getsockopt (param i32 i32 i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (func (export "socket_nonblocking") (result i32)
                    i32.const 2
                    i32.const 2049
                    i32.const 6
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $socket
                )
                (func (export "connect_fd") (param $fd i32) (result i32)
                    local.get $fd
                    i32.const 64
                    i32.const 16
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $connect
                )
                (func (export "poll_write") (param $fd i32) (result i32)
                    i32.const 128
                    local.get $fd
                    i32.store
                    i32.const 132
                    i32.const 4
                    i32.store16
                    i32.const 134
                    i32.const 0
                    i32.store16
                    i32.const 128
                    i32.const 1
                    i32.const 1000
                    call $poll
                )
                (func (export "poll_revents") (result i32)
                    i32.const 134
                    i32.load16_u
                )
                (func (export "getsock_error") (param $fd i32) (result i32)
                    (local $rc i32)
                    i32.const 900
                    i32.const 4
                    i32.store
                    local.get $fd
                    i32.const 1
                    i32.const 4
                    i32.const 904
                    i32.const 900
                    i32.const 0
                    call $getsockopt
                    local.set $rc
                    local.get $rc
                    if (result i32)
                        local.get $rc
                    else
                        i32.const 904
                        i32.load
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();

        let socket_nonblocking = instance
            .get_func(&mut linker.store, "socket_nonblocking")
            .unwrap();
        let connect_fd = instance.get_func(&mut linker.store, "connect_fd").unwrap();
        let poll_write = instance.get_func(&mut linker.store, "poll_write").unwrap();
        let poll_revents = instance
            .get_func(&mut linker.store, "poll_revents")
            .unwrap();
        let getsock_error = instance
            .get_func(&mut linker.store, "getsock_error")
            .unwrap();
        let mut results = [Val::I32(0)];

        write_ipv4_sockaddr(&mut linker.store, &memory, success_port);
        socket_nonblocking
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        let Val::I32(success_fd) = results[0] else {
            panic!("socket fd must be i32");
        };
        connect_fd
            .call(&mut linker.store, &[Val::I32(success_fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value == -EINPROGRESS));
        connect_fd
            .call(&mut linker.store, &[Val::I32(success_fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value == -EALREADY));
        poll_write
            .call(&mut linker.store, &[Val::I32(success_fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(1)]));
        poll_revents
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value & i32::from(POLLOUT) != 0));
        getsock_error
            .call(&mut linker.store, &[Val::I32(success_fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));

        write_ipv4_sockaddr(&mut linker.store, &memory, refused_port);
        socket_nonblocking
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        let Val::I32(refused_fd) = results[0] else {
            panic!("socket fd must be i32");
        };
        connect_fd
            .call(&mut linker.store, &[Val::I32(refused_fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(value)] if value == -EINPROGRESS));
        poll_write
            .call(&mut linker.store, &[Val::I32(refused_fd)], &mut results)
            .unwrap();
        let Val::I32(refused_ready) = results[0] else {
            panic!("poll result must be i32");
        };
        #[cfg(windows)]
        if refused_ready == 0 {
            getsock_error
                .call(&mut linker.store, &[Val::I32(refused_fd)], &mut results)
                .unwrap();
            assert!(matches!(results, [Val::I32(0)]));
            server.join().unwrap();
            return;
        }
        assert_eq!(refused_ready, 1);
        poll_revents
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        let Val::I32(refused_revents) = results[0] else {
            panic!("poll revents must be i32");
        };
        #[cfg(windows)]
        assert!(refused_revents & (i32::from(POLLERR) | i32::from(POLLOUT)) != 0);
        #[cfg(not(windows))]
        assert!(refused_revents & i32::from(POLLERR) != 0);
        getsock_error
            .call(&mut linker.store, &[Val::I32(refused_fd)], &mut results)
            .unwrap();
        let Val::I32(refused_error) = results[0] else {
            panic!("SO_ERROR must be an i32 errno");
        };
        assert_eq!(refused_error, EXPECTED_ECONNREFUSED);
        getsock_error
            .call(&mut linker.store, &[Val::I32(refused_fd)], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));

        server.join().unwrap();
    }

    #[test]
    fn invoke_import_calls_indirect_function_table() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "invoke_ii" (func $invoke_ii (param i32 i32) (result i32)))
                (table (export "__indirect_function_table") 1 funcref)
                (elem (i32.const 0) $add_one)
                (func $add_one (param i32) (result i32)
                    local.get 0
                    i32.const 1
                    i32.add
                )
                (func (export "call_invoke") (result i32)
                    i32.const 0
                    i32.const 41
                    call $invoke_ii
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_invoke = instance.get_func(&mut linker.store, "call_invoke").unwrap();
        let mut results = [Val::I32(-1)];
        call_invoke
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(42)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.invoke_ii".to_string()]
        );
    }

    #[test]
    fn invoke_import_forwards_void_callback_args() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "invoke_vii" (func $invoke_vii (param i32 i32 i32)))
                (table (export "__indirect_function_table") 1 funcref)
                (global $sum (mut i32) (i32.const 0))
                (elem (i32.const 0) $store_sum)
                (func $store_sum (param i32 i32)
                    local.get 0
                    local.get 1
                    i32.add
                    global.set $sum
                )
                (func (export "call_invoke") (result i32)
                    i32.const 0
                    i32.const 20
                    i32.const 22
                    call $invoke_vii
                    global.get $sum
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_invoke = instance.get_func(&mut linker.store, "call_invoke").unwrap();
        let mut results = [Val::I32(-1)];
        call_invoke
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(42)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.invoke_vii".to_string()]
        );
    }

    #[test]
    fn invoke_import_records_inclusive_time_when_enabled() {
        let _guard = ENV_LOCK.lock().unwrap();
        let _env = EnvVarGuard::set(PROFILE_IMPORT_INCLUSIVE_TIME_ENV_VAR, "1");

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "invoke_ii" (func $invoke_ii (param i32 i32) (result i32)))
                (table (export "__indirect_function_table") 1 funcref)
                (elem (i32.const 0) $spin)
                (func $spin (param $iterations i32) (result i32)
                    (local $value i32)
                    loop $loop
                        local.get $value
                        i32.const 1
                        i32.add
                        local.set $value
                        local.get $iterations
                        i32.const 1
                        i32.sub
                        local.tee $iterations
                        br_if $loop
                    end
                    local.get $value
                )
                (func (export "call_invoke") (result i32)
                    i32.const 0
                    i32.const 1000
                    call $invoke_ii
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_invoke = instance.get_func(&mut linker.store, "call_invoke").unwrap();
        let mut results = [Val::I32(-1)];
        call_invoke
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let snapshot = linker.store.data().import_inclusive_time_snapshot();
        let invoke = snapshot.totals.get("env.invoke_ii").unwrap();

        assert!(matches!(results, [Val::I32(1000)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.invoke_ii".to_string()]
        );
        assert_eq!(invoke.calls, 1);
        assert!(invoke.total_ns > 0);
    }

    #[test]
    fn got_func_exit_is_patched_to_host_exit_table_slot() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (type $exit_t (func (param i32)))
                (import "env" "exit" (func $exit (param i32)))
                (import "GOT.func" "exit" (global $got_exit (mut i32)))
                (table (export "__indirect_function_table") 0 funcref)
                (func (export "call_got_exit")
                    i32.const 42
                    global.get $got_exit
                    call_indirect (type $exit_t)
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_got_exit = instance
            .get_func(&mut linker.store, "call_got_exit")
            .unwrap();
        let error = call_got_exit
            .call(&mut linker.store, &[], &mut [])
            .unwrap_err();

        assert_eq!(
            error.downcast_ref::<super::PhpExitStatus>(),
            Some(&super::PhpExitStatus(42))
        );
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.exit".to_string()]
        );
    }

    #[test]
    fn fd_write_captures_stdout_without_echoing_when_disabled() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "wasi_snapshot_preview1" "fd_write"
                    (func $fd_write (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 32) "captured")
                (func (export "write_stdout") (result i32)
                    i32.const 8
                    i32.const 32
                    i32.store
                    i32.const 12
                    i32.const 8
                    i32.store
                    i32.const 1
                    i32.const 8
                    i32.const 1
                    i32.const 24
                    call $fd_write
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                echo_output: false,
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let write_stdout = instance
            .get_func(&mut linker.store, "write_stdout")
            .unwrap();
        let mut results = [Val::I32(-1)];
        write_stdout
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(linker.store.data_mut().take_captured_stdout(), b"captured");
        assert_eq!(
            linker.store.data().called_imports,
            vec!["wasi_snapshot_preview1.fd_write".to_string()]
        );
    }

    #[test]
    fn request_headers_device_captures_written_bytes() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_write"
                    (func $fd_write (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/request/headers\00")
                (data (i32.const 96) "{\"headers\":[]}")
                (func (export "open_and_write_headers") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if (result i32)
                        local.get $fd
                    else
                        i32.const 16
                        i32.const 96
                        i32.store
                        i32.const 20
                        i32.const 14
                        i32.store
                        local.get $fd
                        i32.const 16
                        i32.const 1
                        i32.const 28
                        call $fd_write
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                echo_output: false,
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let open_and_write_headers = instance
            .get_func(&mut linker.store, "open_and_write_headers")
            .unwrap();
        let mut results = [Val::I32(-1)];
        open_and_write_headers
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(
            linker.store.data_mut().take_captured_headers(),
            br#"{"headers":[]}"#
        );
    }

    #[test]
    fn js_fd_read_reads_from_native_fd_table() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_fd_read"
                    (func $js_fd_read (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/internal/shared/php.ini\00")
                (func (export "read_first_byte") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 16
                        i32.const 128
                        i32.store
                        i32.const 20
                        i32.const 1
                        i32.store
                        local.get $fd
                        i32.const 16
                        i32.const 1
                        i32.const 32
                        call $js_fd_read
                        if (result i32)
                            i32.const -2
                        else
                            i32.const 128
                            i32.load8_u
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let read_first_byte = instance
            .get_func(&mut linker.store, "read_first_byte")
            .unwrap();
        let mut results = [Val::I32(-1)];
        read_first_byte
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(109)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec![
                "env.__syscall_openat".to_string(),
                "env.js_fd_read".to_string(),
            ]
        );
    }

    #[test]
    fn host_mount_translates_vfs_paths_to_host_files() {
        let host_root = temp_dir("mount");
        fs::write(host_root.join("index.php"), b"<?php echo 'mounted';").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_fd_read"
                    (func $js_fd_read (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/index.php\00")
                (func (export "read_first_byte") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 16
                        i32.const 128
                        i32.store
                        i32.const 20
                        i32.const 1
                        i32.store
                        local.get $fd
                        i32.const 16
                        i32.const 1
                        i32.const 32
                        call $js_fd_read
                        if (result i32)
                            i32.const -2
                        else
                            i32.const 128
                            i32.load8_u
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let read_first_byte = instance
            .get_func(&mut linker.store, "read_first_byte")
            .unwrap();
        let mut results = [Val::I32(-1)];
        read_first_byte
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let _ = fs::remove_dir_all(host_root);

        assert!(matches!(results, [Val::I32(60)]));
    }

    #[test]
    fn chdir_updates_cwd_for_relative_vfs_resolution() {
        let host_root = temp_dir("chdir");
        fs::create_dir_all(host_root.join("wp-content/plugins/demo")).unwrap();
        fs::write(
            host_root.join("wp-content/plugins/demo/relative.txt"),
            b"mounted",
        )
        .unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_chdir"
                    (func $chdir (param i32) (result i32)))
                (import "env" "__syscall_getcwd"
                    (func $getcwd (param i32 i32) (result i32)))
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_fd_read"
                    (func $js_fd_read (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/wp-content/plugins/demo\00")
                (data (i32.const 128) "relative.txt\00")
                (func (export "chdir_getcwd_and_read") (result i32)
                    (local $fd i32)
                    i32.const 64
                    call $chdir
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 256
                        i32.const 128
                        call $getcwd
                        i32.const 0
                        i32.lt_s
                        if (result i32)
                            i32.const -2
                        else
                            i32.const -100
                            i32.const 128
                            i32.const 0
                            i32.const 0
                            call $openat
                            local.tee $fd
                            i32.const 0
                            i32.lt_s
                            if (result i32)
                                i32.const -3
                            else
                                i32.const 16
                                i32.const 512
                                i32.store
                                i32.const 20
                                i32.const 1
                                i32.store
                                local.get $fd
                                i32.const 16
                                i32.const 1
                                i32.const 32
                                call $js_fd_read
                                if (result i32)
                                    i32.const -4
                                else
                                    i32.const 512
                                    i32.load8_u
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let chdir_getcwd_and_read = instance
            .get_func(&mut linker.store, "chdir_getcwd_and_read")
            .unwrap();
        let mut results = [Val::I32(-1)];
        chdir_getcwd_and_read
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        let mut cwd = vec![0; "/wordpress/wp-content/plugins/demo".len() + 1];
        memory.read(&linker.store, 256, &mut cwd).unwrap();
        let _ = fs::remove_dir_all(host_root);

        assert!(matches!(results, [Val::I32(109)]));
        assert_eq!(
            std::str::from_utf8(&cwd).unwrap().trim_end_matches('\0'),
            "/wordpress/wp-content/plugins/demo"
        );
        assert_eq!(
            linker.store.data().called_imports,
            vec![
                "env.__syscall_chdir".to_string(),
                "env.__syscall_getcwd".to_string(),
                "env.__syscall_openat".to_string(),
                "env.js_fd_read".to_string(),
            ]
        );
    }

    #[cfg(unix)]
    #[test]
    fn metadata_syscalls_update_host_backed_files() {
        use std::os::unix::fs::PermissionsExt;

        let host_root = temp_dir("metadata-syscalls");
        fs::write(host_root.join("file.txt"), b"metadata").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_chmod"
                    (func $chmod (param i32 i32) (result i32)))
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_fchmod"
                    (func $fchmod (param i32 i32) (result i32)))
                (import "env" "__syscall_fchown32"
                    (func $fchown32 (param i32 i32 i32) (result i32)))
                (import "env" "__syscall_fchownat"
                    (func $fchownat (param i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_utimensat"
                    (func $utimensat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_symlinkat"
                    (func $symlinkat (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (data (i32.const 96) "/wordpress/link.txt\00")
                (data (i32.const 128) "file.txt\00")
                (func (export "run_metadata_syscalls") (result i32)
                    (local $fd i32)
                    i32.const 256
                    i64.const 1
                    i64.store
                    i32.const 264
                    i32.const 0
                    i32.store
                    i32.const 272
                    i64.const 2
                    i64.store
                    i32.const 280
                    i32.const 0
                    i32.store

                    i32.const 64
                    i32.const 420
                    call $chmod
                    if (result i32)
                        i32.const -1
                    else
                        i32.const -100
                        i32.const 64
                        i32.const 2
                        i32.const 0
                        call $openat
                        local.tee $fd
                        i32.const 0
                        i32.lt_s
                        if (result i32)
                            i32.const -2
                        else
                            local.get $fd
                            i32.const 384
                            call $fchmod
                            if (result i32)
                                i32.const -3
                            else
                                local.get $fd
                                i32.const -1
                                i32.const -1
                                call $fchown32
                                if (result i32)
                                    i32.const -4
                                else
                                    i32.const -100
                                    i32.const 64
                                    i32.const -1
                                    i32.const -1
                                    i32.const 0
                                    call $fchownat
                                    if (result i32)
                                        i32.const -5
                                    else
                                        i32.const -100
                                        i32.const 64
                                        i32.const 256
                                        i32.const 0
                                        call $utimensat
                                        if (result i32)
                                            i32.const -6
                                        else
                                            i32.const 128
                                            i32.const -100
                                            i32.const 96
                                            call $symlinkat
                                            if (result i32)
                                                i32.const -7
                                            else
                                                i32.const 0
                                            end
                                        end
                                    end
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let run_metadata_syscalls = instance
            .get_func(&mut linker.store, "run_metadata_syscalls")
            .unwrap();
        let mut results = [Val::I32(-99)];
        run_metadata_syscalls
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let metadata = fs::metadata(host_root.join("file.txt")).unwrap();
        let mode = metadata.permissions().mode() & 0o777;
        let modified = metadata
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let link_target = fs::read_link(host_root.join("link.txt")).unwrap();
        let _ = fs::remove_dir_all(host_root);

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(mode, 0o600);
        assert_eq!(modified, 2);
        assert_eq!(link_target.file_name().unwrap(), "file.txt");
    }

    #[cfg(unix)]
    #[test]
    fn stat_access_and_fd_modes_respect_symlinks_and_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let host_root = temp_dir("stat-access");
        let file_path = host_root.join("file.txt");
        fs::write(&file_path, b"x").unwrap();
        let mut permissions = fs::metadata(&file_path).unwrap().permissions();
        permissions.set_mode(0o600);
        fs::set_permissions(&file_path, permissions).unwrap();
        std::os::unix::fs::symlink("file.txt", host_root.join("link.txt")).unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_stat64"
                    (func $stat (param i32 i32) (result i32)))
                (import "env" "__syscall_lstat64"
                    (func $lstat (param i32 i32) (result i32)))
                (import "env" "__syscall_newfstatat"
                    (func $newfstatat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_faccessat"
                    (func $faccessat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_fd_read"
                    (func $fd_read (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_write"
                    (func $fd_write (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_ftruncate64"
                    (func $ftruncate (param i32 i64) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (data (i32.const 96) "/wordpress/link.txt\00")
                (data (i32.const 128) "x")
                (func (export "check_metadata") (result i32)
                    (local $fd i32)
                    i32.const 32
                    i32.const 128
                    i32.store
                    i32.const 36
                    i32.const 1
                    i32.store

                    i32.const 96
                    i32.const 256
                    call $lstat
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 260
                        i32.load
                        i32.const 61440
                        i32.and
                        i32.const 40960
                        i32.ne
                        if (result i32)
                            i32.const -2
                        else
                            i32.const 96
                            i32.const 384
                            call $stat
                            if (result i32)
                                i32.const -3
                            else
                                i32.const 388
                                i32.load
                                i32.const 61440
                                i32.and
                                i32.const 32768
                                i32.ne
                                if (result i32)
                                    i32.const -4
                                else
                                    i32.const -100
                                    i32.const 96
                                    i32.const 512
                                    i32.const 256
                                    call $newfstatat
                                    if (result i32)
                                        i32.const -5
                                    else
                                        i32.const 516
                                        i32.load
                                        i32.const 61440
                                        i32.and
                                        i32.const 40960
                                        i32.ne
                                        if (result i32)
                                            i32.const -6
                                        else
                                            i32.const -100
                                            i32.const 64
                                            i32.const 4
                                            i32.const 0
                                            call $faccessat
                                            if (result i32)
                                                i32.const -7
                                            else
                                                i32.const -100
                                                i32.const 64
                                                i32.const 1
                                                i32.const 0
                                                call $faccessat
                                                i32.const -2
                                                i32.ne
                                                if (result i32)
                                                    i32.const -8
                                                else
                                                    i32.const -100
                                                    i32.const 64
                                                    i32.const 0
                                                    i32.const 0
                                                    call $openat
                                                    local.tee $fd
                                                    i32.const 0
                                                    i32.lt_s
                                                    if (result i32)
                                                        i32.const -9
                                                    else
                                                        local.get $fd
                                                        i32.const 32
                                                        i32.const 1
                                                        i32.const 48
                                                        call $fd_write
                                                        i32.const 8
                                                        i32.ne
                                                        if (result i32)
                                                            i32.const -10
                                                        else
                                                            local.get $fd
                                                            i64.const 0
                                                            call $ftruncate
                                                            i32.const -8
                                                            i32.ne
                                                            if (result i32)
                                                                i32.const -11
                                                            else
                                                                i32.const -100
                                                                i32.const 64
                                                                i32.const 1
                                                                i32.const 0
                                                                call $openat
                                                                local.tee $fd
                                                                i32.const 0
                                                                i32.lt_s
                                                                if (result i32)
                                                                    i32.const -12
                                                                else
                                                                    local.get $fd
                                                                    i32.const 32
                                                                    i32.const 1
                                                                    i32.const 48
                                                                    call $fd_read
                                                                    i32.const 8
                                                                    i32.ne
                                                                    if (result i32)
                                                                        i32.const -13
                                                                    else
                                                                        i32.const 0
                                                                    end
                                                                end
                                                            end
                                                        end
                                                    end
                                                end
                                            end
                                        end
                                    end
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let check_metadata = instance
            .get_func(&mut linker.store, "check_metadata")
            .unwrap();
        let mut results = [Val::I32(-99)];
        check_metadata
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let _ = fs::remove_dir_all(host_root);

        assert!(matches!(results, [Val::I32(0)]));
    }

    #[test]
    fn mmap_shared_private_and_error_paths_are_tracked() {
        let host_root = temp_dir("mmap-writeback");
        fs::write(host_root.join("shared.txt"), b"abcdef").unwrap();
        fs::write(host_root.join("private.txt"), b"abcdef").unwrap();
        fs::write(host_root.join("readonly.txt"), b"abcdef").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "_mmap_js"
                    (func $mmap
                        (param i32 i32 i32 i32 i64 i32 i32)
                        (result i32)))
                (import "env" "_munmap_js"
                    (func $munmap
                        (param i32 i32 i32 i32 i32 i64)
                        (result i32)))
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 2048))
                (data (i32.const 64) "/wordpress/shared.txt\00")
                (data (i32.const 96) "/wordpress/private.txt\00")
                (data (i32.const 128) "/wordpress/readonly.txt\00")
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func $map_mutate_unmap
                    (param $path i32)
                    (param $open_flags i32)
                    (param $map_flags i32)
                    (result i32)
                    (local $fd i32)
                    (local $ptr i32)
                    (local $rc i32)

                    i32.const -100
                    local.get $path
                    local.get $open_flags
                    i32.const 0
                    call $openat
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 3
                        i32.const 2
                        local.get $map_flags
                        local.get $fd
                        i64.const 1
                        i32.const 16
                        i32.const 20
                        call $mmap
                        local.tee $rc
                        i32.const 0
                        i32.ne
                        if (result i32)
                            local.get $rc
                        else
                            i32.const 20
                            i32.load
                            local.tee $ptr
                            i32.const 1
                            i32.add
                            i32.const 90
                            i32.store8
                            local.get $ptr
                            i32.const 3
                            i32.const 2
                            local.get $map_flags
                            local.get $fd
                            i64.const 1
                            call $munmap
                        end
                    end
                )
                (func (export "shared_flushes") (result i32)
                    i32.const 64
                    i32.const 2
                    i32.const 1
                    call $map_mutate_unmap
                )
                (func (export "private_does_not_flush") (result i32)
                    i32.const 96
                    i32.const 2
                    i32.const 2
                    call $map_mutate_unmap
                )
                (func (export "shared_write_requires_rdwr") (result i32)
                    i32.const 128
                    i32.const 0
                    i32.const 1
                    call $map_mutate_unmap
                )
                (func (export "untracked_munmap") (result i32)
                    i32.const 4096
                    i32.const 1
                    i32.const 0
                    i32.const 0
                    i32.const -1
                    i64.const 0
                    call $munmap
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        for (export, expected) in [
            ("shared_flushes", 0),
            ("private_does_not_flush", 0),
            ("shared_write_requires_rdwr", -EACCES),
            ("untracked_munmap", -EINVAL),
        ] {
            let func = instance.get_func(&mut linker.store, export).unwrap();
            let mut results = [Val::I32(-99)];
            func.call(&mut linker.store, &[], &mut results).unwrap();
            assert!(
                matches!(results, [Val::I32(value)] if value == expected),
                "{export} returned {results:?}"
            );
        }

        let shared = fs::read_to_string(host_root.join("shared.txt")).unwrap();
        let private = fs::read_to_string(host_root.join("private.txt")).unwrap();
        let readonly = fs::read_to_string(host_root.join("readonly.txt")).unwrap();
        let _ = fs::remove_dir_all(host_root);

        assert_eq!(shared, "abZdef");
        assert_eq!(private, "abcdef");
        assert_eq!(readonly, "abcdef");
    }

    #[test]
    fn getpeername_and_getnameinfo_report_connected_peer() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let _ = listener.accept().unwrap();
        });

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_socket"
                    (func $socket (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_connect"
                    (func $connect (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_getpeername"
                    (func $getpeername (param i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "getnameinfo"
                    (func $getnameinfo (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (func (export "connect_and_name_peer") (result i32)
                    (local $fd i32)
                    i32.const 2
                    i32.const 1
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $socket
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if (result i32)
                        i32.const -1
                    else
                        local.get $fd
                        i32.const 64
                        i32.const 16
                        i32.const 0
                        i32.const 0
                        i32.const 0
                        call $connect
                        if (result i32)
                            i32.const -2
                        else
                            local.get $fd
                            i32.const 128
                            i32.const 160
                            i32.const 0
                            i32.const 0
                            i32.const 0
                            call $getpeername
                            if (result i32)
                                i32.const -3
                            else
                                i32.const 128
                                i32.const 16
                                i32.const 200
                                i32.const 64
                                i32.const 300
                                i32.const 16
                                i32.const 0
                                call $getnameinfo
                                if (result i32)
                                    i32.const -4
                                else
                                    i32.const 200
                                    i32.load8_u
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        write_ipv4_sockaddr(&mut linker.store, &memory, port);
        let connect_and_name_peer = instance
            .get_func(&mut linker.store, "connect_and_name_peer")
            .unwrap();
        let mut results = [Val::I32(-99)];
        connect_and_name_peer
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let mut node = vec![0; 16];
        let mut service = vec![0; 8];
        memory.read(&linker.store, 200, &mut node).unwrap();
        memory.read(&linker.store, 300, &mut service).unwrap();
        server.join().unwrap();

        assert!(matches!(results, [Val::I32(49)]));
        assert_eq!(
            std::str::from_utf8(&node).unwrap().trim_end_matches('\0'),
            "127.0.0.1"
        );
        assert_eq!(
            std::str::from_utf8(&service)
                .unwrap()
                .trim_end_matches('\0'),
            port.to_string()
        );
    }

    #[test]
    fn unknown_env_syscall_import_is_rejected() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_missing"
                    (func $missing (result i32)))
            )
            "#,
        )
        .unwrap();
        let error = stub_linker_error(&module);
        assert!(error.contains("Unclassified PHP wasm function import env.__syscall_missing"));
    }

    #[test]
    fn syscall_pipe_round_trips_bytes_and_tracks_close_semantics() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_pipe"
                    (func $pipe (param i32) (result i32)))
                (import "env" "__syscall_dup"
                    (func $dup (param i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_close"
                    (func $close (param i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_write"
                    (func $write (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_fd_read"
                    (func $read (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_poll"
                    (func $poll (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 128) "abc")
                (func (export "run_pipe") (result i32)
                    (local $readfd i32)
                    (local $writefd i32)
                    (local $dupfd i32)

                    i32.const 32
                    i32.const 128
                    i32.store
                    i32.const 36
                    i32.const 3
                    i32.store
                    i32.const 40
                    i32.const 256
                    i32.store
                    i32.const 44
                    i32.const 3
                    i32.store

                    i32.const 64
                    call $pipe
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 64
                        i32.load
                        local.set $readfd
                        i32.const 68
                        i32.load
                        local.set $writefd

                        i32.const 80
                        local.get $readfd
                        i32.store
                        i32.const 84
                        i32.const 1
                        i32.store16
                        i32.const 86
                        i32.const 0
                        i32.store16
                        i32.const 80
                        i32.const 1
                        i32.const 0
                        call $poll
                        if (result i32)
                            i32.const -2
                        else
                            local.get $writefd
                            call $dup
                            local.tee $dupfd
                            i32.const 0
                            i32.lt_s
                            if (result i32)
                                i32.const -3
                            else
                                local.get $writefd
                                call $close
                                if (result i32)
                                    i32.const -4
                                else
                                    local.get $dupfd
                                    i32.const 32
                                    i32.const 1
                                    i32.const 72
                                    call $write
                                    if (result i32)
                                        i32.const -5
                                    else
                                        i32.const 72
                                        i32.load
                                        i32.const 3
                                        i32.ne
                                        if (result i32)
                                            i32.const -6
                                        else
                                            i32.const 80
                                            i32.const 1
                                            i32.const 0
                                            call $poll
                                            i32.const 1
                                            i32.ne
                                            if (result i32)
                                                i32.const -7
                                            else
                                                i32.const 86
                                                i32.load16_u
                                                i32.const 1
                                                i32.and
                                                i32.eqz
                                                if (result i32)
                                                    i32.const -8
                                                else
                                                    local.get $readfd
                                                    i32.const 40
                                                    i32.const 1
                                                    i32.const 76
                                                    call $read
                                                    if (result i32)
                                                        i32.const -9
                                                    else
                                                        i32.const 76
                                                        i32.load
                                                        i32.const 3
                                                        i32.ne
                                                        if (result i32)
                                                            i32.const -10
                                                        else
                                                            local.get $dupfd
                                                            call $close
                                                            if (result i32)
                                                                i32.const -11
                                                            else
                                                                local.get $readfd
                                                                i32.const 40
                                                                i32.const 1
                                                                i32.const 76
                                                                call $read
                                                                if (result i32)
                                                                    i32.const -12
                                                                else
                                                                    i32.const 76
                                                                    i32.load
                                                                    if (result i32)
                                                                        i32.const -13
                                                                    else
                                                                        local.get $readfd
                                                                        call $close
                                                                        if (result i32)
                                                                            i32.const -14
                                                                        else
                                                                            i32.const 64
                                                                            call $pipe
                                                                            if (result i32)
                                                                                i32.const -15
                                                                            else
                                                                                i32.const 64
                                                                                i32.load
                                                                                call $close
                                                                                if (result i32)
                                                                                    i32.const -16
                                                                                else
                                                                                    i32.const 68
                                                                                    i32.load
                                                                                    i32.const 32
                                                                                    i32.const 1
                                                                                    i32.const 72
                                                                                    call $write
                                                                                    i32.const 64
                                                                                    i32.ne
                                                                                    if (result i32)
                                                                                        i32.const -17
                                                                                    else
                                                                                        i32.const 256
                                                                                        i32.load8_u
                                                                                    end
                                                                                end
                                                                            end
                                                                        end
                                                                    end
                                                                end
                                                            end
                                                        end
                                                    end
                                                end
                                            end
                                        end
                                    end
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let run_pipe = instance.get_func(&mut linker.store, "run_pipe").unwrap();
        let mut results = [Val::I32(0)];
        run_pipe.call(&mut linker.store, &[], &mut results).unwrap();

        assert!(
            matches!(results, [Val::I32(value)] if value == i32::from(b'a')),
            "run_pipe returned {results:?}"
        );
    }

    #[test]
    fn unknown_env_helper_import_is_rejected() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "mystery_helper"
                    (func $helper (result i32)))
            )
            "#,
        )
        .unwrap();
        let error = stub_linker_error(&module);
        assert!(error.contains("Unclassified PHP wasm function import env.mystery_helper"));
    }

    #[test]
    fn unknown_env_global_import_is_rejected() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (global $imported (import "env" "mystery_global") i32))
            "#,
        )
        .unwrap();
        let error = stub_linker_error(&module);
        assert!(error.contains("Unclassified PHP wasm global import env.mystery_global"));
    }

    #[test]
    fn getnameinfo_invalid_sockaddr_returns_lookup_failure() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "getnameinfo"
                    (func $getnameinfo
                        (param i32 i32 i32 i32 i32 i32 i32)
                        (result i32)))
                (func (export "call_getnameinfo") (result i32)
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $getnameinfo
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_getnameinfo = instance
            .get_func(&mut linker.store, "call_getnameinfo")
            .unwrap();
        let mut results = [Val::I32(0)];
        call_getnameinfo
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(value)] if value == EAI_NONAME));
    }

    #[test]
    fn unsupported_default_abort_import_traps() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__assert_fail"
                    (func $assert_fail))
                (func (export "call_assert_fail")
                    call $assert_fail
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_assert_fail = instance
            .get_func(&mut linker.store, "call_assert_fail")
            .unwrap();

        assert!(call_assert_fail
            .call(&mut linker.store, &[], &mut [])
            .is_err());
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.__assert_fail".to_string()]
        );
    }

    #[test]
    fn intentionally_unsupported_default_imports_are_classified_and_fail_stably() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "_dlopen_js"
                    (func $dlopen (param i32) (result i32)))
                (import "env" "_dlsym_js"
                    (func $dlsym (param i32 i32 i32) (result i32)))
                (import "env" "_emscripten_system"
                    (func $system (param i32) (result i32)))
                (import "env" "_setitimer_js"
                    (func $setitimer (param i32 f64) (result i32)))
                (func (export "call_unsupported") (result i32)
                    i32.const 0
                    call $dlopen
                    if
                        i32.const -1
                        return
                    end
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $dlsym
                    if
                        i32.const -2
                        return
                    end
                    i32.const 0
                    call $system
                    i32.const -52
                    i32.ne
                    if
                        i32.const -3
                        return
                    end
                    i32.const 0
                    f64.const 100
                    call $setitimer
                    i32.const -52
                    i32.ne
                    if
                        i32.const -4
                        return
                    end
                    i32.const 0
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        assert!(linker
            .imports
            .iter()
            .all(|import| import.classification == ImportClassification::IntentionalUnsupported));
        let instance = linker.instantiate(&module).unwrap();
        let call_unsupported = instance
            .get_func(&mut linker.store, "call_unsupported")
            .unwrap();
        let mut results = [Val::I32(0)];
        call_unsupported
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
    }

    #[test]
    fn process_imports_default_to_enosys_and_set_errno() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "js_open_process"
                    (func $open_process (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 16) "cat\00")
                (func (export "__errno_location") (result i32)
                    i32.const 64
                )
                (func (export "call_open") (result i32)
                    i32.const 16
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $open_process
                    i32.const -1
                    i32.ne
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 64
                        i32.load
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_open = instance.get_func(&mut linker.store, "call_open").unwrap();
        let mut results = [Val::I32(0)];
        call_open
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(value)] if value == ENOSYS));
        assert_eq!(
            linker.store.data().called_imports,
            vec!["env.js_open_process".to_string()]
        );
    }

    #[cfg(unix)]
    #[test]
    fn allowlisted_process_stdout_flows_through_native_pipe() {
        let echo_executable = std::env::var_os("PATH")
            .into_iter()
            .flat_map(|paths| std::env::split_paths(&paths).collect::<Vec<_>>())
            .map(|path| path.join("echo"))
            .find(|path| path.is_file())
            .expect("echo executable should be available on PATH");
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "js_open_process"
                    (func $open_process (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "js_waitpid"
                    (func $waitpid (param i32 i32) (result i32)))
                (import "env" "__syscall_pipe"
                    (func $pipe (param i32) (result i32)))
                (import "env" "__syscall_poll"
                    (func $poll (param i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_read"
                    (func $fd_read (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 16) "echo\00")
                (data (i32.const 32) "native-process\00")
                (func (export "__errno_location") (result i32)
                    i32.const 280
                )
                (func (export "run_process") (result i32)
                    (local $read_fd i32)
                    (local $write_fd i32)
                    (local $pid i32)

                    i32.const 96
                    call $pipe
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 96
                        i32.load
                        local.set $read_fd
                        i32.const 100
                        i32.load
                        local.set $write_fd

                        i32.const 64
                        i32.const 32
                        i32.store

                        i32.const 120
                        i32.const 132
                        i32.store
                        i32.const 132
                        i32.const 1
                        i32.store
                        i32.const 136
                        local.get $write_fd
                        i32.store
                        i32.const 140
                        local.get $read_fd
                        i32.store

                        i32.const 16
                        i32.const 64
                        i32.const 1
                        i32.const 120
                        i32.const 1
                        i32.const 0
                        i32.const 0
                        i32.const 0
                        i32.const 0
                        call $open_process
                        local.tee $pid
                        i32.const 0
                        i32.le_s
                        if (result i32)
                            i32.const -2
                        else
                            local.get $pid
                            i32.const 200
                            call $waitpid
                            local.get $pid
                            i32.ne
                            if (result i32)
                                i32.const -3
                            else
                                i32.const 220
                                local.get $read_fd
                                i32.store
                                i32.const 224
                                i32.const 1
                                i32.store16
                                i32.const 226
                                i32.const 0
                                i32.store16
                                i32.const 220
                                i32.const 1
                                i32.const 1000
                                call $poll
                                i32.const 1
                                i32.lt_s
                                if (result i32)
                                    i32.const -4
                                else
                                    i32.const 240
                                    i32.const 300
                                    i32.store
                                    i32.const 244
                                    i32.const 32
                                    i32.store
                                    local.get $read_fd
                                    i32.const 240
                                    i32.const 1
                                    i32.const 260
                                    call $fd_read
                                    if (result i32)
                                        i32.const -5
                                    else
                                        i32.const 260
                                        i32.load
                                    end
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                process_policy: HostProcessPolicy {
                    allowed_commands: vec![HostProcessCommand::new("echo", echo_executable)],
                    ..HostProcessPolicy::default()
                },
                echo_output: false,
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let run_process = instance.get_func(&mut linker.store, "run_process").unwrap();
        let mut results = [Val::I32(0)];
        run_process
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(
            matches!(results, [Val::I32(15)]),
            "expected fd_read to return 15 bytes from native stdout pipe, got {results:?}"
        );
        let memory = instance.get_memory(&mut linker.store, "memory").unwrap();
        let mut output = vec![0; 15];
        memory
            .read(&linker.store, 300, &mut output)
            .expect("stdout buffer should be readable");
        assert_eq!(output, b"native-process\n");
    }

    #[test]
    fn process_import_failure_paths_return_explicit_errors() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "js_open_process"
                    (func $open_process (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
                (import "env" "js_process_status"
                    (func $process_status (param i32 i32) (result i32)))
                (import "env" "js_waitpid"
                    (func $waitpid (param i32 i32) (result i32)))
                (import "env" "js_popen_to_file"
                    (func $popen_to_file (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (func (export "call_process_imports") (result i32)
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    i32.const 0
                    call $open_process
                    i32.const -1
                    i32.ne
                    if (result i32)
                        i32.const -10
                    else
                        i32.const 123
                        i32.const 64
                        call $process_status
                        i32.const -1
                        i32.ne
                        if (result i32)
                            i32.const -20
                        else
                            i32.const 123
                            i32.const 64
                            call $waitpid
                            i32.const -1
                            i32.ne
                            if (result i32)
                                i32.const -30
                            else
                                i32.const 0
                                i32.const 0
                                i32.const 64
                                call $popen_to_file
                                if (result i32)
                                    i32.const -40
                                else
                                    i32.const 64
                                    i32.load8_u
                                end
                            end
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_process_imports = instance
            .get_func(&mut linker.store, "call_process_imports")
            .unwrap();
        let mut results = [Val::I32(0)];
        call_process_imports
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(1)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec![
                "env.js_open_process".to_string(),
                "env.js_process_status".to_string(),
                "env.js_waitpid".to_string(),
                "env.js_popen_to_file".to_string(),
            ]
        );
    }

    #[test]
    fn protocol_imports_return_protoent_records() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "getdtablesize"
                    (func $getdtablesize (result i32)))
                (import "env" "getprotobyname"
                    (func $getprotobyname (param i32) (result i32)))
                (import "env" "getprotobynumber"
                    (func $getprotobynumber (param i32) (result i32)))
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 1024))
                (data (i32.const 16) "tcp\00")
                (data (i32.const 24) "missing\00")
                (func (export "malloc") (param $len i32) (result i32)
                    (local $ptr i32)
                    global.get $heap
                    local.set $ptr
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                    local.get $ptr
                )
                (func (export "check_protocols") (result i32)
                    (local $protoent i32)
                    call $getdtablesize
                    i32.const 64
                    i32.lt_s
                    if
                        i32.const -1
                        return
                    end
                    i32.const 16
                    call $getprotobyname
                    local.tee $protoent
                    i32.eqz
                    if
                        i32.const -2
                        return
                    end
                    local.get $protoent
                    i32.const 8
                    i32.add
                    i32.load
                    i32.const 6
                    i32.ne
                    if
                        i32.const -3
                        return
                    end
                    local.get $protoent
                    i32.load
                    i32.load8_u
                    i32.const 116
                    i32.ne
                    if
                        i32.const -4
                        return
                    end
                    i32.const 17
                    call $getprotobynumber
                    local.tee $protoent
                    i32.eqz
                    if
                        i32.const -5
                        return
                    end
                    local.get $protoent
                    i32.const 8
                    i32.add
                    i32.load
                    i32.const 17
                    i32.ne
                    if
                        i32.const -6
                        return
                    end
                    i32.const 24
                    call $getprotobyname
                    if
                        i32.const -7
                        return
                    end
                    i32.const 0
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let check_protocols = instance
            .get_func(&mut linker.store, "check_protocols")
            .unwrap();
        let mut results = [Val::I32(0)];
        check_protocols
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec![
                "env.getdtablesize".to_string(),
                "env.getprotobyname".to_string(),
                "env.getprotobynumber".to_string(),
                "env.getprotobyname".to_string(),
            ]
        );
    }

    #[test]
    fn emscripten_lookup_name_returns_packed_ipv4_address() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "_emscripten_lookup_name"
                    (func $lookup_name (param i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 16) "127.0.0.1\00")
                (data (i32.const 32) "::1\00")
                (func (export "check_lookup") (result i32)
                    i32.const 16
                    call $lookup_name
                    i32.const 16777343
                    i32.ne
                    if
                        i32.const -1
                        return
                    end
                    i32.const 32
                    call $lookup_name
                    if
                        i32.const -2
                        return
                    end
                    i32.const 0
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let check_lookup = instance
            .get_func(&mut linker.store, "check_lookup")
            .unwrap();
        let mut results = [Val::I32(0)];
        check_lookup
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
    }

    #[test]
    fn time_imports_populate_tm_records_and_parse_strptime() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "_gmtime_js"
                    (func $gmtime (param i64 i32)))
                (import "env" "_localtime_js"
                    (func $localtime (param i64 i32)))
                (import "env" "_mktime_js"
                    (func $mktime (param i32) (result i64)))
                (import "env" "strptime"
                    (func $strptime (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 300) "2024-06-24T13:45:59+0230xxx\00")
                (data (i32.const 340) "%Y-%m-%dT%H:%M:%S%z\00")
                (func (export "check_time") (result i32)
                    i64.const 0
                    i32.const 100
                    call $gmtime
                    i32.const 100
                    i32.load
                    if
                        i32.const -1
                        return
                    end
                    i32.const 104
                    i32.load
                    if
                        i32.const -2
                        return
                    end
                    i32.const 108
                    i32.load
                    if
                        i32.const -3
                        return
                    end
                    i32.const 112
                    i32.load
                    i32.const 1
                    i32.ne
                    if
                        i32.const -4
                        return
                    end
                    i32.const 116
                    i32.load
                    if
                        i32.const -5
                        return
                    end
                    i32.const 120
                    i32.load
                    i32.const 70
                    i32.ne
                    if
                        i32.const -6
                        return
                    end
                    i32.const 124
                    i32.load
                    i32.const 4
                    i32.ne
                    if
                        i32.const -7
                        return
                    end
                    i32.const 128
                    i32.load
                    if
                        i32.const -8
                        return
                    end

                    i64.const 951827696
                    i32.const 140
                    call $localtime
                    i32.const 140
                    i32.load
                    i32.const 56
                    i32.ne
                    if
                        i32.const -9
                        return
                    end
                    i32.const 152
                    i32.load
                    i32.const 29
                    i32.ne
                    if
                        i32.const -10
                        return
                    end
                    i32.const 156
                    i32.load
                    i32.const 1
                    i32.ne
                    if
                        i32.const -11
                        return
                    end
                    i32.const 160
                    i32.load
                    i32.const 100
                    i32.ne
                    if
                        i32.const -12
                        return
                    end
                    i32.const 168
                    i32.load
                    i32.const 59
                    i32.ne
                    if
                        i32.const -13
                        return
                    end
                    i32.const 172
                    i32.load
                    if
                        i32.const -14
                        return
                    end
                    i32.const 176
                    i32.load
                    if
                        i32.const -15
                        return
                    end

                    i32.const 200
                    i32.const 0
                    i32.store
                    i32.const 204
                    i32.const 0
                    i32.store
                    i32.const 208
                    i32.const 0
                    i32.store
                    i32.const 212
                    i32.const 32
                    i32.store
                    i32.const 216
                    i32.const 0
                    i32.store
                    i32.const 220
                    i32.const 70
                    i32.store
                    i32.const 232
                    i32.const -1
                    i32.store
                    i32.const 200
                    call $mktime
                    i64.const 2678400
                    i64.ne
                    if
                        i32.const -16
                        return
                    end
                    i32.const 212
                    i32.load
                    i32.const 1
                    i32.ne
                    if
                        i32.const -17
                        return
                    end
                    i32.const 216
                    i32.load
                    i32.const 1
                    i32.ne
                    if
                        i32.const -18
                        return
                    end
                    i32.const 228
                    i32.load
                    i32.const 31
                    i32.ne
                    if
                        i32.const -19
                        return
                    end

                    i32.const 300
                    i32.const 340
                    i32.const 400
                    call $strptime
                    i32.const 324
                    i32.ne
                    if
                        i32.const -20
                        return
                    end
                    i32.const 400
                    i32.load
                    i32.const 59
                    i32.ne
                    if
                        i32.const -21
                        return
                    end
                    i32.const 408
                    i32.load
                    i32.const 13
                    i32.ne
                    if
                        i32.const -22
                        return
                    end
                    i32.const 412
                    i32.load
                    i32.const 24
                    i32.ne
                    if
                        i32.const -23
                        return
                    end
                    i32.const 416
                    i32.load
                    i32.const 5
                    i32.ne
                    if
                        i32.const -24
                        return
                    end
                    i32.const 420
                    i32.load
                    i32.const 124
                    i32.ne
                    if
                        i32.const -25
                        return
                    end
                    i32.const 436
                    i32.load
                    i32.const 9000
                    i32.ne
                    if
                        i32.const -26
                        return
                    end
                    i32.const 0
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let check_time = instance.get_func(&mut linker.store, "check_time").unwrap();
        let mut results = [Val::I32(0)];
        check_time
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
    }

    #[cfg(unix)]
    #[test]
    fn host_mount_blocks_symlink_escape_by_default() {
        let host_root = temp_dir("mount-symlink-blocked");
        let external_root = temp_dir("mount-symlink-blocked-external");
        fs::write(external_root.join("secret.txt"), b"outside").unwrap();
        std::os::unix::fs::symlink(external_root.join("secret.txt"), host_root.join("link.txt"))
            .unwrap();

        let state = HostState::new(HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        });

        assert!(state.resolve_host_path("/wordpress/link.txt").is_none());

        let _ = fs::remove_dir_all(host_root);
        let _ = fs::remove_dir_all(external_root);
    }

    #[cfg(unix)]
    #[test]
    fn follow_symlinks_allows_mount_symlink_targets() {
        let host_root = temp_dir("mount-symlink-follow");
        let external_root = temp_dir("mount-symlink-follow-external");
        let external_file = external_root.join("secret.txt");
        fs::write(&external_file, b"outside").unwrap();
        std::os::unix::fs::symlink(&external_file, host_root.join("link.txt")).unwrap();

        let state = HostState::new(HostOptions {
            follow_symlinks: true,
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        });

        assert_eq!(
            state.resolve_host_path("/wordpress/link.txt").unwrap(),
            fs::canonicalize(&external_file).unwrap()
        );

        let _ = fs::remove_dir_all(host_root);
        let _ = fs::remove_dir_all(external_root);
    }

    #[cfg(unix)]
    #[test]
    fn readlink_registers_usable_internal_symlink_mount() {
        let host_root = temp_dir("mount-readlink");
        let external_root = temp_dir("mount-readlink-external");
        fs::write(external_root.join("document.txt"), b"outside").unwrap();
        std::os::unix::fs::symlink(&external_root, host_root.join("linked-dir")).unwrap();

        let mut state = HostState::new(HostOptions {
            follow_symlinks: true,
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        });

        let target = state.readlink_path("/wordpress/linked-dir").unwrap();
        assert!(target.starts_with("/internal/symlinks/"));
        let internal_entries = state.read_dir_entries("/internal/symlinks").unwrap();
        let first_target_part = target
            .trim_start_matches("/internal/symlinks/")
            .split('/')
            .next()
            .unwrap();
        assert!(internal_entries
            .iter()
            .any(|entry| entry.name == first_target_part));
        assert_eq!(
            state
                .resolve_host_path(&format!("{target}/document.txt"))
                .unwrap(),
            fs::canonicalize(external_root.join("document.txt")).unwrap()
        );

        let _ = fs::remove_dir_all(host_root);
        let _ = fs::remove_dir_all(external_root);
    }

    #[cfg(unix)]
    #[test]
    fn internal_symlink_root_is_virtual_not_host_root() {
        let state = HostState::new(HostOptions {
            follow_symlinks: true,
            ..HostOptions::default()
        });

        assert!(state.resolve_host_path("/internal/symlinks").is_none());
        assert_eq!(
            state
                .read_dir_entries("/internal/symlinks")
                .unwrap()
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec![".", ".."]
        );
    }

    #[test]
    fn host_mount_writes_new_files_back_to_host_on_close() {
        let host_root = temp_dir("mount-write");

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_write"
                    (func $fd_write (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_close"
                    (func $fd_close (param i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/generated.txt\00")
                (data (i32.const 128) "persisted")
                (func (export "write_file") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 577
                    i32.const 0
                    call $openat
                    local.tee $fd
                    i32.const 0
                    i32.lt_s
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 16
                        i32.const 128
                        i32.store
                        i32.const 20
                        i32.const 9
                        i32.store
                        local.get $fd
                        i32.const 16
                        i32.const 1
                        i32.const 32
                        call $fd_write
                        if (result i32)
                            i32.const -2
                        else
                            local.get $fd
                            call $fd_close
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let write_file = instance.get_func(&mut linker.store, "write_file").unwrap();
        let mut results = [Val::I32(-1)];
        write_file
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(
            fs::read(host_root.join("generated.txt")).unwrap(),
            b"persisted"
        );
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn host_mount_mkdir_and_getdents_reflect_host_directories() {
        let host_root = temp_dir("mount-dir");

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_mkdirat"
                    (func $mkdirat (param i32 i32 i32) (result i32)))
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_getdents64"
                    (func $getdents64 (param i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_close"
                    (func $fd_close (param i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/cache\00")
                (data (i32.const 96) "/wordpress\00")
                (func (export "mkdir_and_list") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 511
                    call $mkdirat
                    if (result i32)
                        i32.const -1
                    else
                        i32.const -100
                        i32.const 96
                        i32.const 65536
                        i32.const 0
                        call $openat
                        local.tee $fd
                        i32.const 0
                        i32.lt_s
                        if (result i32)
                            i32.const -2
                        else
                            local.get $fd
                            i32.const 256
                            i32.const 1120
                            call $getdents64
                            local.get $fd
                            call $fd_close
                            drop
                        end
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let mkdir_and_list = instance
            .get_func(&mut linker.store, "mkdir_and_list")
            .unwrap();
        let mut results = [Val::I32(-1)];
        mkdir_and_list
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        let Val::I32(bytes_written) = results[0] else {
            panic!("expected i32 result");
        };
        assert!(bytes_written > 0);
        assert!(host_root.join("cache").is_dir());

        let memory = instance
            .get_memory(&mut linker.store, "memory")
            .expect("fixture exports memory");
        let mut dirents = vec![0; usize::try_from(bytes_written).unwrap()];
        memory.read(&linker.store, 256, &mut dirents).unwrap();
        assert!(dirents
            .windows(b"cache".len())
            .any(|window| window == b"cache"));

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn directory_entries_include_direct_child_mount_points() {
        let wordpress_root = temp_dir("mount-overlay-wordpress");
        let plugin_root = temp_dir("mount-overlay-plugin");
        fs::create_dir_all(wordpress_root.join("wp-content/plugins")).unwrap();
        fs::write(plugin_root.join("demo.php"), b"<?php").unwrap();

        let state = HostState::new(HostOptions {
            mounts: vec![
                HostMount {
                    host_path: wordpress_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                },
                HostMount {
                    host_path: plugin_root.clone(),
                    vfs_path: "/wordpress/wp-content/plugins/demo".to_string(),
                },
            ],
            ..HostOptions::default()
        });

        let entries = state
            .read_dir_entries("/wordpress/wp-content/plugins")
            .unwrap();
        assert!(entries.iter().any(|entry| entry.name == "demo"));

        let _ = fs::remove_dir_all(wordpress_root);
        let _ = fs::remove_dir_all(plugin_root);
    }

    #[test]
    fn overlapping_mount_create_uses_deepest_vfs_mount() {
        let parent_root = temp_dir("mount-overlap-parent");
        let child_root = temp_dir("mount-overlap-child");
        fs::create_dir_all(parent_root.join("sub")).unwrap();
        fs::write(child_root.join("existing.txt"), b"child").unwrap();

        let state = HostState::new(HostOptions {
            mounts: vec![
                HostMount {
                    host_path: parent_root.clone(),
                    vfs_path: "/data".to_string(),
                },
                HostMount {
                    host_path: child_root.clone(),
                    vfs_path: "/data/sub".to_string(),
                },
            ],
            ..HostOptions::default()
        });

        assert_eq!(
            state.resolve_host_path("/data/sub/existing.txt").unwrap(),
            fs::canonicalize(child_root.join("existing.txt")).unwrap()
        );
        assert_eq!(
            state
                .resolve_host_path_for_open("/data/sub/new.txt", true)
                .unwrap(),
            child_root.join("new.txt")
        );
        assert_eq!(
            state
                .resolve_host_path_for_open("/data/root.txt", true)
                .unwrap(),
            parent_root.join("root.txt")
        );

        let _ = fs::remove_dir_all(parent_root);
        let _ = fs::remove_dir_all(child_root);
    }

    #[test]
    fn fd_read_past_eof_returns_zero_bytes() {
        let host_root = temp_dir("read-eof");
        fs::write(host_root.join("short.txt"), b"abc").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_fd_read"
                    (func $js_fd_read (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_seek"
                    (func $fd_seek (param i32 i64 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/short.txt\00")
                (func (export "read_after_eof") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.tee $fd
                    i64.const 99
                    i32.const 0
                    i32.const 32
                    call $fd_seek
                    drop
                    i32.const 16
                    i32.const 128
                    i32.store
                    i32.const 20
                    i32.const 8
                    i32.store
                    local.get $fd
                    i32.const 16
                    i32.const 1
                    i32.const 40
                    call $js_fd_read
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 40
                        i32.load
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let read_after_eof = instance
            .get_func(&mut linker.store, "read_after_eof")
            .unwrap();
        let mut results = [Val::I32(-1)];
        read_after_eof
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fd_pwrite_ftruncate_and_sync_flush_to_host_file() {
        let host_root = temp_dir("pwrite");
        fs::write(host_root.join("file.txt"), b"000000").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_ftruncate64"
                    (func $ftruncate (param i32 i64) (result i32)))
                (import "wasi_snapshot_preview1" "fd_pwrite"
                    (func $fd_pwrite (param i32 i32 i32 i64 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_sync"
                    (func $fd_sync (param i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_close"
                    (func $fd_close (param i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (data (i32.const 128) "abc")
                (func (export "write_file") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 2
                    i32.const 0
                    call $openat
                    local.set $fd
                    i32.const 16
                    i32.const 128
                    i32.store
                    i32.const 20
                    i32.const 3
                    i32.store
                    local.get $fd
                    i32.const 16
                    i32.const 1
                    i64.const 2
                    i32.const 40
                    call $fd_pwrite
                    drop
                    local.get $fd
                    i64.const 4
                    call $ftruncate
                    drop
                    local.get $fd
                    call $fd_sync
                    drop
                    local.get $fd
                    call $fd_close
                    drop
                    i32.const 40
                    i32.load
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let write_file = instance.get_func(&mut linker.store, "write_file").unwrap();
        let mut results = [Val::I32(-1)];
        write_file
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(3)]));
        assert_eq!(fs::read(host_root.join("file.txt")).unwrap(), b"00ab");
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn host_backed_file_descriptors_see_each_others_writes() {
        let host_root = temp_dir("coherent-fds");
        fs::write(host_root.join("file.txt"), b"0000").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_pwrite"
                    (func $fd_pwrite (param i32 i32 i32 i64 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_pread"
                    (func $fd_pread (param i32 i32 i32 i64 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (data (i32.const 128) "xy")
                (func (export "check_coherence") (result i32)
                    (local $fd1 i32)
                    (local $fd2 i32)
                    i32.const -100
                    i32.const 64
                    i32.const 2
                    i32.const 0
                    call $openat
                    local.set $fd1
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.set $fd2
                    i32.const 16
                    i32.const 128
                    i32.store
                    i32.const 20
                    i32.const 2
                    i32.store
                    local.get $fd1
                    i32.const 16
                    i32.const 1
                    i64.const 0
                    i32.const 40
                    call $fd_pwrite
                    drop
                    i32.const 24
                    i32.const 160
                    i32.store
                    i32.const 28
                    i32.const 2
                    i32.store
                    local.get $fd2
                    i32.const 24
                    i32.const 1
                    i64.const 0
                    i32.const 44
                    call $fd_pread
                    drop
                    i32.const 160
                    i32.load8_u
                    i32.const 120
                    i32.eq
                    i32.const 161
                    i32.load8_u
                    i32.const 121
                    i32.eq
                    i32.and
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let check_coherence = instance
            .get_func(&mut linker.store, "check_coherence")
            .unwrap();
        let mut results = [Val::I32(-1)];
        check_coherence
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(1)]));
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn closing_clean_host_file_descriptor_does_not_overwrite_newer_file() {
        let host_root = temp_dir("clean-close");
        let file_path = host_root.join("file.txt");
        fs::write(&file_path, b"old").unwrap();
        let mut state = HostState::new(HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        });
        let fd = state.open_path("/wordpress/file.txt", O_RDWR);
        assert!(fd >= 3);

        fs::write(&file_path, b"new").unwrap();

        assert_eq!(state.close_fd(fd), 0);
        assert_eq!(fs::read(&file_path).unwrap(), b"new");
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn host_read_file_fd_stat_cache_is_opt_in_and_invalidated() {
        let host_root = temp_dir("read-fstat-cache");
        let file_path = host_root.join("file.txt");
        fs::write(&file_path, b"old").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };

        let mut uncached = HostState::new(options.clone());
        let uncached_fd = uncached.open_path("/wordpress/file.txt", 0);
        assert!(uncached_fd >= 3);
        fs::write(&file_path, b"updated").unwrap();
        assert_eq!(uncached.fd_stat(uncached_fd).unwrap().size, 7);

        let mut cached = HostState::new(HostOptions {
            host_cache: true,
            ..options
        });
        let cached_fd = cached.open_path("/wordpress/file.txt", 0);
        assert!(cached_fd >= 3);
        assert_eq!(cached.fd_stat(cached_fd).unwrap().size, 7);

        fs::write(&file_path, b"updated-again").unwrap();
        assert_eq!(cached.fd_stat(cached_fd).unwrap().size, 7);

        cached.clear_host_cache();
        assert_eq!(cached.fd_stat(cached_fd).unwrap().size, 13);

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn read_only_open_reuses_cached_host_file_stat_when_cache_enabled() {
        let host_root = temp_dir("read-open-stat-cache");
        let file_path = host_root.join("file.txt");
        fs::write(&file_path, b"old").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            host_cache: true,
            ..HostOptions::default()
        };

        let mut cached = HostState::new(options);
        assert_eq!(cached.stat_path("/wordpress/file.txt").unwrap().size, 3);
        assert!(cached
            .host_stat_cache
            .borrow()
            .contains_key(&("/wordpress/file.txt".to_string(), true)));

        fs::write(&file_path, b"updated").unwrap();
        let fd = cached.open_path("/wordpress/file.txt", 0);
        assert!(fd >= 3);
        assert_eq!(cached.fd_stat(fd).unwrap().size, 3);

        cached.clear_host_cache();
        assert_eq!(cached.fd_stat(fd).unwrap().size, 7);

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn scoped_host_cache_invalidation_preserves_unrelated_wordpress_stats() {
        let host_root = temp_dir("scoped-cache-invalidation");
        let stable_path = host_root.join("wp-includes/version.php");
        let changed_path = host_root.join("wp-content/cache/item.php");
        fs::create_dir_all(stable_path.parent().unwrap()).unwrap();
        fs::create_dir_all(changed_path.parent().unwrap()).unwrap();
        fs::write(&stable_path, b"stable").unwrap();
        fs::write(&changed_path, b"changed").unwrap();

        let state = HostState::new(HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            host_cache: true,
            ..HostOptions::default()
        });

        assert_eq!(
            state
                .stat_path("/wordpress/wp-includes/version.php")
                .unwrap()
                .size,
            6
        );
        assert_eq!(
            state
                .stat_path("/wordpress/wp-content/cache/item.php")
                .unwrap()
                .size,
            7
        );
        assert!(state
            .host_stat_cache
            .borrow()
            .contains_key(&("/wordpress/wp-includes/version.php".to_string(), true)));
        assert!(state
            .host_stat_cache
            .borrow()
            .contains_key(&("/wordpress/wp-content/cache/item.php".to_string(), true)));

        state.invalidate_host_cache_path("/wordpress/wp-content/cache/item.php");

        assert!(state
            .host_stat_cache
            .borrow()
            .contains_key(&("/wordpress/wp-includes/version.php".to_string(), true)));
        assert!(!state
            .host_stat_cache
            .borrow()
            .contains_key(&("/wordpress/wp-content/cache/item.php".to_string(), true)));

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn cached_read_only_open_falls_back_when_host_file_disappears() {
        let host_root = temp_dir("read-open-stat-cache-gone");
        let file_path = host_root.join("file.txt");
        fs::write(&file_path, b"old").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            host_cache: true,
            ..HostOptions::default()
        };

        let mut cached = HostState::new(options);
        assert_eq!(cached.stat_path("/wordpress/file.txt").unwrap().size, 3);

        fs::remove_file(&file_path).unwrap();
        assert_eq!(cached.open_path("/wordpress/file.txt", 0), -ENOENT);

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn host_read_file_uses_cached_length_when_cache_generation_matches() {
        let host_root = temp_dir("read-length-cache");
        let file_path = host_root.join("file.txt");
        fs::write(&file_path, b"old").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };

        let mut uncached = HostState::new(options.clone());
        let uncached_fd = uncached.open_path("/wordpress/file.txt", 0);
        assert!(uncached_fd >= 3);
        fs::write(&file_path, b"updated").unwrap();
        let uncached_total = match uncached.get_fd_mut(uncached_fd).unwrap() {
            FdEntry::HostReadFile { file, .. } => {
                read_host_file_iovs(file, 0, &[(0, 16)], None).unwrap().2
            }
            _ => panic!("expected host read file descriptor"),
        };
        assert_eq!(uncached_total, 7);

        fs::write(&file_path, b"old").unwrap();
        let mut cached = HostState::new(HostOptions {
            host_cache: true,
            ..options
        });
        let cached_fd = cached.open_path("/wordpress/file.txt", 0);
        assert!(cached_fd >= 3);
        fs::write(&file_path, b"updated").unwrap();
        let cached_generation = cached.host_cache_generation.get();
        let host_cache_enabled = cached.host_cache_enabled;
        let cached_total = match cached.get_fd_mut(cached_fd).unwrap() {
            FdEntry::HostReadFile {
                file,
                cached_stat,
                cached_stat_generation,
                ..
            } => {
                let cached_len = cached_host_read_file_len(
                    host_cache_enabled,
                    cached_generation,
                    cached_stat,
                    *cached_stat_generation,
                );
                read_host_file_iovs(file, 0, &[(0, 16)], cached_len)
                    .unwrap()
                    .2
            }
            _ => panic!("expected host read file descriptor"),
        };
        assert_eq!(cached_total, 3);

        cached.clear_host_cache();
        let invalidated_generation = cached.host_cache_generation.get();
        let invalidated_total = match cached.get_fd_mut(cached_fd).unwrap() {
            FdEntry::HostReadFile {
                file,
                cached_stat,
                cached_stat_generation,
                ..
            } => {
                let cached_len = cached_host_read_file_len(
                    host_cache_enabled,
                    invalidated_generation,
                    cached_stat,
                    *cached_stat_generation,
                );
                read_host_file_iovs(file, 0, &[(0, 16)], cached_len)
                    .unwrap()
                    .2
            }
            _ => panic!("expected host read file descriptor"),
        };
        assert_eq!(invalidated_total, 7);

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn host_directory_fd_stat_cache_is_opt_in_and_invalidated() {
        let host_root = temp_dir("dir-fstat-cache");
        let dir_path = host_root.join("content");
        fs::create_dir(&dir_path).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };

        let mut uncached = HostState::new(options.clone());
        let uncached_fd = uncached.open_path("/wordpress/content", 0);
        assert!(uncached_fd >= 3);
        assert!(uncached.fd_stat(uncached_fd).unwrap().mode & S_IFDIR != 0);
        assert!(uncached.host_stat_cache.borrow().is_empty());

        let mut cached = HostState::new(HostOptions {
            host_cache: true,
            ..options
        });
        let cached_fd = cached.open_path("/wordpress/content", 0);
        assert!(cached_fd >= 3);
        let initial_cached_stat = cached.fd_stat(cached_fd).unwrap();
        assert!(initial_cached_stat.mode & S_IFDIR != 0);
        assert!(initial_cached_stat.mtime_secs.is_some());
        assert!(cached
            .host_stat_cache
            .borrow()
            .contains_key(&("/wordpress/content".to_string(), true)));

        fs::remove_dir(&dir_path).unwrap();
        let removed_cached_stat = cached.fd_stat(cached_fd).unwrap();
        assert_eq!(
            removed_cached_stat.mtime_secs,
            initial_cached_stat.mtime_secs
        );

        cached.clear_host_cache();
        let invalidated_stat = cached.fd_stat(cached_fd).unwrap();
        assert!(invalidated_stat.mode & S_IFDIR != 0);
        assert!(invalidated_stat.mtime_secs.is_none());
        assert!(cached.host_stat_cache.borrow().is_empty());

        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn opening_host_file_with_truncate_clears_existing_contents() {
        let host_root = temp_dir("truncate-open");
        let file_path = host_root.join("coordination.txt");
        fs::write(&file_path, b"exclusive-ready-for-unlock").unwrap();
        let mut state = HostState::new(HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        });

        let fd = state.open_path("/wordpress/coordination.txt", O_WRONLY | O_TRUNC);
        assert!(fd >= 3);
        assert_eq!(fs::read(&file_path).unwrap(), b"");
        assert_eq!(state.close_fd(fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn opening_tmpfile_directory_returns_lockable_anonymous_regular_file() {
        let host_root = temp_dir("tmpfile-open");
        fs::create_dir(host_root.join("cache")).unwrap();
        let mut state = HostState::new(HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        });

        let fd = state.open_path("/wordpress/cache", O_TMPFILE | O_RDWR | O_EXCL);

        assert!(fd >= 3);
        assert!(matches!(
            state.get_fd(fd).unwrap(),
            FdEntry::File {
                host_path: None,
                access_mode: O_RDWR,
                ..
            }
        ));
        assert_eq!(
            state.set_advisory_range_lock(fd, fcntl_request(F_WRLCK, 0, 0), false),
            0
        );
        assert_eq!(state.fd_stat(fd).unwrap().mode & S_IFREG, S_IFREG);
        assert!(fs::read_dir(host_root.join("cache"))
            .unwrap()
            .next()
            .is_none());
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn advisory_write_lock_blocks_other_host_states_until_released() {
        let host_root = temp_dir("advisory-lock-conflict");
        fs::write(host_root.join("db.sqlite"), b"database").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_fd = first.open_path("/wordpress/db.sqlite", O_RDWR);
        let second_fd = second.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(first.set_advisory_lock(first_fd, F_WRLCK), 0);
        assert_eq!(
            second.conflicting_advisory_lock_type(second_fd, F_RDLCK),
            F_WRLCK
        );
        assert_eq!(second.set_advisory_lock(second_fd, F_RDLCK), EAGAIN);

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(second.set_advisory_lock(second_fd, F_RDLCK), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    fn fcntl_request(lock_type: u16, start: i64, len: i64) -> FcntlLockRequest {
        FcntlLockRequest {
            lock_type,
            whence: SEEK_SET,
            start,
            len,
        }
    }

    #[test]
    fn fcntl_range_locks_allow_non_overlapping_regions() {
        let host_root = temp_dir("fcntl-range-non-overlap");
        fs::write(host_root.join("db.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_fd = first.open_path("/wordpress/db.sqlite", O_RDWR);
        let second_fd = second.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_WRLCK, 0, 100), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_WRLCK, 100, 100), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_RDLCK, 50, 25), false),
            EAGAIN
        );

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_shared_range_locks_can_overlap_but_block_writers() {
        let host_root = temp_dir("fcntl-range-shared");
        fs::write(host_root.join("db.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options.clone());
        let mut third = HostState::new(options);
        let first_fd = first.open_path("/wordpress/db.sqlite", O_RDWR);
        let second_fd = second.open_path("/wordpress/db.sqlite", O_RDWR);
        let third_fd = third.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_RDLCK, 20, 80), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_RDLCK, 50, 80), false),
            0
        );
        assert_eq!(
            third.set_advisory_range_lock(third_fd, fcntl_request(F_WRLCK, 75, 10), false),
            EAGAIN
        );
        assert_eq!(
            third.set_advisory_range_lock(third_fd, fcntl_request(F_WRLCK, 150, 10), false),
            0
        );

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        assert_eq!(third.close_fd(third_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_partial_unlock_splits_owned_range_lock() {
        let host_root = temp_dir("fcntl-range-split");
        fs::write(host_root.join("db.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options.clone());
        let mut third = HostState::new(options);
        let first_fd = first.open_path("/wordpress/db.sqlite", O_RDWR);
        let second_fd = second.open_path("/wordpress/db.sqlite", O_RDWR);
        let third_fd = third.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_WRLCK, 0, 200), false),
            0
        );
        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_UNLCK, 50, 100), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_WRLCK, 50, 100), false),
            0
        );
        assert_eq!(
            third.set_advisory_range_lock(third_fd, fcntl_request(F_WRLCK, 0, 50), false),
            EAGAIN
        );
        assert_eq!(
            third.set_advisory_range_lock(third_fd, fcntl_request(F_WRLCK, 150, 50), false),
            EAGAIN
        );

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        assert_eq!(third.close_fd(third_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_zero_length_range_extends_to_max_offset() {
        let host_root = temp_dir("fcntl-range-to-eof");
        fs::write(host_root.join("db.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_fd = first.open_path("/wordpress/db.sqlite", O_RDWR);
        let second_fd = second.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_WRLCK, 100, 0), false),
            0
        );
        assert_eq!(
            first
                .resolve_advisory_lock_range(first_fd, fcntl_request(F_WRLCK, 100, 0))
                .unwrap(),
            AdvisoryLockRange {
                start: 100,
                end: MAX_LOCK_OFFSET
            }
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_WRLCK, 0, 100), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_WRLCK, 100, 100), false),
            EAGAIN
        );

        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_UNLCK, 100, 0), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_WRLCK, 100, 100), false),
            0
        );

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_same_owner_overlapping_range_replaces_and_merges() {
        let host_root = temp_dir("fcntl-range-merge");
        fs::write(host_root.join("db.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_fd = first.open_path("/wordpress/db.sqlite", O_RDWR);
        let second_fd = second.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_RDLCK, 0, 100), false),
            0
        );
        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_WRLCK, 50, 100), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_RDLCK, 25, 100), false),
            EAGAIN
        );
        assert_eq!(
            first.set_advisory_range_lock(first_fd, fcntl_request(F_UNLCK, 0, 150), false),
            0
        );
        assert_eq!(
            second.set_advisory_range_lock(second_fd, fcntl_request(F_WRLCK, 25, 100), false),
            0
        );

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_range_resolves_seek_end_and_current_offsets() {
        let host_root = temp_dir("fcntl-range-whence");
        fs::write(host_root.join("db.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut state = HostState::new(options);
        let fd = state.open_path("/wordpress/db.sqlite", O_RDWR);

        assert_eq!(
            state
                .resolve_advisory_lock_range(
                    fd,
                    FcntlLockRequest {
                        lock_type: F_WRLCK,
                        whence: SEEK_END,
                        start: -56,
                        len: 10,
                    },
                )
                .unwrap(),
            AdvisoryLockRange {
                start: 200,
                end: 210
            }
        );
        if let Ok(super::FdEntry::File { position, .. }) = state.get_fd_mut(fd) {
            *position = 30;
        }
        assert_eq!(
            state
                .resolve_advisory_lock_range(
                    fd,
                    FcntlLockRequest {
                        lock_type: F_WRLCK,
                        whence: SEEK_CUR,
                        start: 5,
                        len: 10,
                    },
                )
                .unwrap(),
            AdvisoryLockRange { start: 35, end: 45 }
        );

        assert_eq!(state.close_fd(fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn host_states_have_distinct_synthetic_pids() {
        let first = HostState::default();
        let second = HostState::default();

        assert!(first.synthetic_pid() > 0);
        assert!(second.synthetic_pid() > 0);
        assert_ne!(first.synthetic_pid(), second.synthetic_pid());
    }

    #[test]
    fn flock_exclusive_lock_blocks_other_host_states_until_unlocked() {
        let host_root = temp_dir("flock-conflict");
        fs::write(host_root.join("file.txt"), b"data").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_fd = first.open_path("/wordpress/file.txt", O_RDWR);
        let second_fd = second.open_path("/wordpress/file.txt", O_RDWR);

        assert_eq!(first.flock_fd(first_fd, LOCK_EX), 0);
        assert_eq!(second.flock_fd(second_fd, LOCK_SH | LOCK_NB), EAGAIN);
        assert_eq!(second.flock_fd(second_fd, LOCK_EX | LOCK_NB), EAGAIN);

        assert_eq!(first.flock_fd(first_fd, LOCK_UN), 0);
        assert_eq!(second.flock_fd(second_fd, LOCK_SH | LOCK_NB), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        assert_eq!(first.close_fd(first_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn flock_shared_locks_can_coexist_and_block_exclusive_locks() {
        let host_root = temp_dir("flock-shared");
        fs::write(host_root.join("file.txt"), b"data").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options.clone());
        let mut third = HostState::new(options);
        let first_fd = first.open_path("/wordpress/file.txt", O_RDWR);
        let second_fd = second.open_path("/wordpress/file.txt", O_RDWR);
        let third_fd = third.open_path("/wordpress/file.txt", O_RDWR);

        assert_eq!(first.flock_fd(first_fd, LOCK_SH), 0);
        assert_eq!(second.flock_fd(second_fd, LOCK_SH | LOCK_NB), 0);
        assert_eq!(third.flock_fd(third_fd, LOCK_EX | LOCK_NB), EAGAIN);

        assert_eq!(first.close_fd(first_fd), 0);
        assert_eq!(third.flock_fd(third_fd, LOCK_EX | LOCK_NB), EAGAIN);
        assert_eq!(second.close_fd(second_fd), 0);
        assert_eq!(third.flock_fd(third_fd, LOCK_EX | LOCK_NB), 0);
        assert_eq!(third.close_fd(third_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn flock_blocking_waits_until_conflicting_lock_is_released() {
        let host_root = temp_dir("flock-blocking");
        fs::write(host_root.join("file.txt"), b"data").unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_fd = first.open_path("/wordpress/file.txt", O_RDWR);
        let second_fd = second.open_path("/wordpress/file.txt", O_RDWR);
        assert_eq!(first.flock_fd(first_fd, LOCK_EX), 0);

        let release = thread::spawn(move || {
            thread::sleep(Duration::from_millis(25));
            first.close_fd(first_fd)
        });
        let start = Instant::now();
        assert_eq!(second.flock_fd(second_fd, LOCK_EX), 0);
        assert!(start.elapsed() >= Duration::from_millis(20));
        assert_eq!(release.join().unwrap(), 0);
        assert_eq!(second.close_fd(second_fd), 0);
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn js_flock_imports_share_locks_across_host_states() {
        let host_root = temp_dir("js-flock");
        fs::write(host_root.join("file.txt"), b"data").unwrap();
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "js_flock"
                    (func $flock (param i32 i32) (result i32)))
                (import "env" "js_getpid"
                    (func $getpid (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (func (export "open_file") (result i32)
                    i32.const -100
                    i32.const 64
                    i32.const 2
                    i32.const 0
                    call $openat
                )
                (func (export "flock_file") (param $fd i32) (param $operation i32) (result i32)
                    local.get $fd
                    local.get $operation
                    call $flock
                )
                (func (export "pid") (result i32)
                    call $getpid
                )
            )
            "#,
        )
        .unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = create_stub_import_linker_with_options(&module, options.clone()).unwrap();
        let mut second = create_stub_import_linker_with_options(&module, options).unwrap();
        let first_instance = first.instantiate(&module).unwrap();
        let second_instance = second.instantiate(&module).unwrap();
        let first_open = first_instance
            .get_typed_func::<(), i32>(&mut first.store, "open_file")
            .unwrap();
        let second_open = second_instance
            .get_typed_func::<(), i32>(&mut second.store, "open_file")
            .unwrap();
        let first_flock = first_instance
            .get_typed_func::<(i32, i32), i32>(&mut first.store, "flock_file")
            .unwrap();
        let second_flock = second_instance
            .get_typed_func::<(i32, i32), i32>(&mut second.store, "flock_file")
            .unwrap();
        let first_pid = first_instance
            .get_typed_func::<(), i32>(&mut first.store, "pid")
            .unwrap();
        let second_pid = second_instance
            .get_typed_func::<(), i32>(&mut second.store, "pid")
            .unwrap();

        let first_fd = first_open.call(&mut first.store, ()).unwrap();
        let second_fd = second_open.call(&mut second.store, ()).unwrap();
        assert_ne!(
            first_pid.call(&mut first.store, ()).unwrap(),
            second_pid.call(&mut second.store, ()).unwrap()
        );

        assert_eq!(
            first_flock
                .call(&mut first.store, (first_fd, LOCK_EX))
                .unwrap(),
            0
        );
        assert_eq!(
            second_flock
                .call(&mut second.store, (second_fd, LOCK_SH | LOCK_NB))
                .unwrap(),
            -EAGAIN
        );
        assert_eq!(
            first_flock
                .call(&mut first.store, (first_fd, LOCK_UN))
                .unwrap(),
            0
        );
        assert_eq!(
            second_flock
                .call(&mut second.store, (second_fd, LOCK_SH | LOCK_NB))
                .unwrap(),
            0
        );
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn release_all_advisory_locks_releases_request_locks() {
        let host_root = temp_dir("release-request-locks");
        fs::write(host_root.join("whole.sqlite"), b"database").unwrap();
        fs::write(host_root.join("range.sqlite"), vec![0; 256]).unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = HostState::new(options.clone());
        let mut second = HostState::new(options);
        let first_whole_fd = first.open_path("/wordpress/whole.sqlite", O_RDWR);
        let second_whole_fd = second.open_path("/wordpress/whole.sqlite", O_RDWR);
        let first_range_fd = first.open_path("/wordpress/range.sqlite", O_RDWR);
        let second_range_fd = second.open_path("/wordpress/range.sqlite", O_RDWR);

        assert_eq!(first.flock_fd(first_whole_fd, LOCK_EX), 0);
        assert_eq!(
            first.set_advisory_range_lock(first_range_fd, fcntl_request(F_WRLCK, 0, 100), false),
            0
        );
        assert_eq!(second.flock_fd(second_whole_fd, LOCK_EX | LOCK_NB), EAGAIN);
        assert_eq!(
            second.set_advisory_range_lock(second_range_fd, fcntl_request(F_WRLCK, 50, 25), false),
            EAGAIN
        );

        first.release_all_advisory_locks();

        assert_eq!(second.flock_fd(second_whole_fd, LOCK_EX | LOCK_NB), 0);
        assert_eq!(
            second.set_advisory_range_lock(second_range_fd, fcntl_request(F_WRLCK, 50, 25), false),
            0
        );
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_getlk_reports_unlocked_file() {
        let host_root = temp_dir("fcntl");
        fs::write(host_root.join("file.txt"), b"data").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_fcntl64"
                    (func $fcntl (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (func (export "get_lock_type") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.set $fd
                    i32.const 32
                    i32.const 128
                    i32.store
                    local.get $fd
                    i32.const 5
                    i32.const 32
                    call $fcntl
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 128
                        i32.load16_u
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let get_lock_type = instance
            .get_func(&mut linker.store, "get_lock_type")
            .unwrap();
        let mut results = [Val::I32(-1)];
        get_lock_type
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(2)]));
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl64_setlk64_is_accepted() {
        let host_root = temp_dir("fcntl64");
        fs::write(host_root.join("file.txt"), b"data").unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_fcntl64"
                    (func $fcntl (param i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (func (export "set_lock64") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.set $fd
                    i32.const 32
                    i32.const 0
                    i32.store
                    local.get $fd
                    i32.const 13
                    i32.const 32
                    call $fcntl
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker_with_options(
            &module,
            HostOptions {
                mounts: vec![HostMount {
                    host_path: host_root.clone(),
                    vfs_path: "/wordpress".to_string(),
                }],
                ..HostOptions::default()
            },
        )
        .unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let set_lock64 = instance.get_func(&mut linker.store, "set_lock64").unwrap();
        let mut results = [Val::I32(-1)];
        set_lock64
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn fcntl_getlk_reports_conflicting_range_metadata() {
        let host_root = temp_dir("fcntl-getlk-conflict");
        fs::write(host_root.join("file.txt"), vec![0; 256]).unwrap();

        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "env" "__syscall_fcntl64"
                    (func $fcntl (param i32 i32 i32) (result i32)))
                (import "env" "js_getpid"
                    (func $getpid (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/wordpress/file.txt\00")
                (func (export "open_file") (result i32)
                    i32.const -100
                    i32.const 64
                    i32.const 2
                    i32.const 0
                    call $openat
                )
                (func $prepare_flock
                    (param $lock_type i32)
                    (param $whence i32)
                    (param $start i64)
                    (param $len i64)
                    i32.const 128
                    local.get $lock_type
                    i32.store16
                    i32.const 130
                    local.get $whence
                    i32.store16
                    i32.const 136
                    local.get $start
                    i64.store
                    i32.const 144
                    local.get $len
                    i64.store
                    i32.const 152
                    i32.const 0
                    i32.store
                    i32.const 32
                    i32.const 128
                    i32.store
                )
                (func (export "set_lock")
                    (param $fd i32)
                    (param $lock_type i32)
                    (param $start i64)
                    (param $len i64)
                    (result i32)
                    local.get $lock_type
                    i32.const 0
                    local.get $start
                    local.get $len
                    call $prepare_flock
                    local.get $fd
                    i32.const 13
                    i32.const 32
                    call $fcntl
                )
                (func (export "get_lock")
                    (param $fd i32)
                    (param $lock_type i32)
                    (param $start i64)
                    (param $len i64)
                    (result i32)
                    local.get $lock_type
                    i32.const 0
                    local.get $start
                    local.get $len
                    call $prepare_flock
                    local.get $fd
                    i32.const 5
                    i32.const 32
                    call $fcntl
                )
                (func (export "lock_type") (result i32)
                    i32.const 128
                    i32.load16_u
                )
                (func (export "lock_whence") (result i32)
                    i32.const 130
                    i32.load16_u
                )
                (func (export "lock_start") (result i64)
                    i32.const 136
                    i64.load
                )
                (func (export "lock_len") (result i64)
                    i32.const 144
                    i64.load
                )
                (func (export "lock_pid") (result i32)
                    i32.const 152
                    i32.load
                )
                (func (export "pid") (result i32)
                    call $getpid
                )
            )
            "#,
        )
        .unwrap();
        let options = HostOptions {
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut first = create_stub_import_linker_with_options(&module, options.clone()).unwrap();
        let mut second = create_stub_import_linker_with_options(&module, options).unwrap();
        let first_instance = first.instantiate(&module).unwrap();
        let second_instance = second.instantiate(&module).unwrap();
        let first_open = first_instance
            .get_typed_func::<(), i32>(&mut first.store, "open_file")
            .unwrap();
        let second_open = second_instance
            .get_typed_func::<(), i32>(&mut second.store, "open_file")
            .unwrap();
        let first_set_lock = first_instance
            .get_typed_func::<(i32, i32, i64, i64), i32>(&mut first.store, "set_lock")
            .unwrap();
        let second_get_lock = second_instance
            .get_typed_func::<(i32, i32, i64, i64), i32>(&mut second.store, "get_lock")
            .unwrap();
        let first_pid = first_instance
            .get_typed_func::<(), i32>(&mut first.store, "pid")
            .unwrap();
        let second_type = second_instance
            .get_typed_func::<(), i32>(&mut second.store, "lock_type")
            .unwrap();
        let second_whence = second_instance
            .get_typed_func::<(), i32>(&mut second.store, "lock_whence")
            .unwrap();
        let second_start = second_instance
            .get_typed_func::<(), i64>(&mut second.store, "lock_start")
            .unwrap();
        let second_len = second_instance
            .get_typed_func::<(), i64>(&mut second.store, "lock_len")
            .unwrap();
        let second_pid = second_instance
            .get_typed_func::<(), i32>(&mut second.store, "lock_pid")
            .unwrap();

        let first_fd = first_open.call(&mut first.store, ()).unwrap();
        let second_fd = second_open.call(&mut second.store, ()).unwrap();
        assert_eq!(
            first_set_lock
                .call(&mut first.store, (first_fd, F_WRLCK as i32, 40, 20))
                .unwrap(),
            0
        );
        assert_eq!(
            second_get_lock
                .call(&mut second.store, (second_fd, F_RDLCK as i32, 50, 5))
                .unwrap(),
            0
        );

        assert_eq!(
            second_type.call(&mut second.store, ()).unwrap(),
            F_WRLCK as i32
        );
        assert_eq!(
            second_whence.call(&mut second.store, ()).unwrap(),
            SEEK_SET as i32
        );
        assert_eq!(second_start.call(&mut second.store, ()).unwrap(), 40);
        assert_eq!(second_len.call(&mut second.store, ()).unwrap(), 20);
        assert_eq!(
            second_pid.call(&mut second.store, ()).unwrap(),
            first_pid.call(&mut first.store, ()).unwrap()
        );
        let _ = fs::remove_dir_all(host_root);
    }

    #[test]
    fn dev_urandom_reads_requested_bytes() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "__syscall_openat"
                    (func $openat (param i32 i32 i32 i32) (result i32)))
                (import "wasi_snapshot_preview1" "fd_read"
                    (func $fd_read (param i32 i32 i32 i32) (result i32)))
                (memory (export "memory") 1)
                (data (i32.const 64) "/dev/urandom\00")
                (func (export "read_random") (result i32)
                    (local $fd i32)
                    i32.const -100
                    i32.const 64
                    i32.const 0
                    i32.const 0
                    call $openat
                    local.set $fd
                    i32.const 16
                    i32.const 128
                    i32.store
                    i32.const 20
                    i32.const 16
                    i32.store
                    local.get $fd
                    i32.const 16
                    i32.const 1
                    i32.const 40
                    call $fd_read
                    if (result i32)
                        i32.const -1
                    else
                        i32.const 40
                        i32.load
                    end
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let read_random = instance.get_func(&mut linker.store, "read_random").unwrap();
        let mut results = [Val::I32(-1)];
        read_random
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(16)]));
    }

    #[test]
    fn internal_file_opens_share_read_only_backing() {
        let mut state = HostState::new(HostOptions::default());

        let first_fd = state.open_path("/internal/shared/php.ini", 0);
        let second_fd = state.open_path("/internal/shared/php.ini", 0);

        assert!(first_fd >= 3);
        assert!(second_fd >= 3);
        match (state.get_fd(first_fd), state.get_fd(second_fd)) {
            (
                Ok(FdEntry::InternalReadFile { data: first, .. }),
                Ok(FdEntry::InternalReadFile { data: second, .. }),
            ) => assert!(std::sync::Arc::ptr_eq(first, second)),
            other => panic!("expected shared internal read files, got {other:?}"),
        }
        assert_eq!(
            state.open_path("/internal/shared/php.ini", O_WRONLY),
            -EACCES
        );
    }

    #[test]
    fn immutable_internal_files_share_backing_across_host_states() {
        let first = HostState::new(HostOptions::default());
        let second = HostState::new(HostOptions::default());

        assert!(std::sync::Arc::ptr_eq(
            first
                .internal_files
                .get("/internal/shared/ca-bundle.crt")
                .unwrap(),
            second
                .internal_files
                .get("/internal/shared/ca-bundle.crt")
                .unwrap()
        ));
        assert!(!std::sync::Arc::ptr_eq(
            first
                .internal_files
                .get("/internal/shared/php.ini")
                .unwrap(),
            second
                .internal_files
                .get("/internal/shared/php.ini")
                .unwrap()
        ));
        assert!(!std::sync::Arc::ptr_eq(
            first
                .internal_files
                .get("/internal/shared/consts.json")
                .unwrap(),
            second
                .internal_files
                .get("/internal/shared/consts.json")
                .unwrap()
        ));
    }

    #[test]
    fn internal_php_ini_loads_string_constants_auto_prepend() {
        let state = HostState::new(HostOptions {
            string_constants: vec![
                (
                    "WP_HOME".to_string(),
                    PhpConstantValue::string("http://127.0.0.1:9400"),
                ),
                ("WP_DEBUG".to_string(), PhpConstantValue::bool(true)),
                ("LIMIT".to_string(), PhpConstantValue::number("42")),
            ],
            ..HostOptions::default()
        });
        let php_ini = internal_file_text(&state, "/internal/shared/php.ini");
        let consts = internal_file_text(&state, "/internal/shared/consts.json");

        assert!(php_ini.contains("auto_prepend_file=/internal/shared/auto_prepend_file.php"));
        assert!(php_ini.contains("openssl.cafile=/internal/shared/ca-bundle.crt"));
        assert!(php_ini.contains("curl.cainfo=/internal/shared/ca-bundle.crt"));
        assert!(php_ini.contains("opcache.enable=1"));
        assert!(php_ini.contains("opcache.enable_cli=1"));
        assert!(php_ini.contains("opcache.memory_consumption=64"));
        assert!(php_ini.contains("opcache.file_cache=/tmp/opcache"));
        assert!(php_ini.contains("opcache.file_cache_only=0"));
        assert!(!php_ini.contains("opcache.revalidate_freq=60"));
        assert!(!php_ini.contains("opcache.validate_timestamps=0"));
        assert!(state
            .internal_files
            .get("/internal/shared/ca-bundle.crt")
            .is_some_and(|bundle| bundle.starts_with(b"##")));
        assert!(state
            .internal_files
            .contains_key("/internal/shared/preload/env.php"));
        assert!(state
            .internal_files
            .contains_key("/internal/shared/mu-plugins/0-playground.php"));
        assert!(state
            .internal_files
            .contains_key("/internal/shared/mu-plugins/1-auto-login.php"));
        let auto_prepend = internal_file_text(&state, "/internal/shared/auto_prepend_file.php");
        assert!(auto_prepend.contains("require_once '/internal/shared/preload/env.php'"));
        assert!(consts.contains(r#""WP_HOME":"http://127.0.0.1:9400""#));
        assert!(consts.contains(r#""WP_DEBUG":true"#));
        assert!(consts.contains(r#""LIMIT":42.0"#) || consts.contains(r#""LIMIT":42"#));
        let mut state = state;
        state.define_constants(&[
            ("WP_DEBUG".to_string(), PhpConstantValue::bool(false)),
            (
                "WP_ENVIRONMENT_TYPE".to_string(),
                PhpConstantValue::string("local"),
            ),
        ]);
        let updated_consts = internal_file_text(&state, "/internal/shared/consts.json");
        assert!(updated_consts.contains(r#""WP_DEBUG":false"#));
        assert!(updated_consts.contains(r#""WP_ENVIRONMENT_TYPE":"local""#));
        assert!(state.virtual_dir_exists("/internal/shared/preload"));
        assert!(state.virtual_dir_exists("/internal/shared/mu-plugins"));
        assert!(state
            .read_dir_entries("/internal/shared/mu-plugins")
            .unwrap()
            .iter()
            .any(|entry| entry.name == "0-playground.php"));
        assert!(state
            .read_dir_entries("/internal/shared/mu-plugins")
            .unwrap()
            .iter()
            .any(|entry| entry.name == "1-auto-login.php"));
    }

    #[test]
    fn internal_php_ini_supports_explicit_opcache_modes() {
        let revalidate = HostState::new(HostOptions {
            opcache_mode: OpcacheMode::Revalidate,
            ..HostOptions::default()
        });
        let revalidate_php_ini = internal_file_text(&revalidate, "/internal/shared/php.ini");
        assert!(revalidate_php_ini.contains("opcache.revalidate_freq=60"));
        assert!(!revalidate_php_ini.contains("opcache.validate_timestamps=0"));

        let immutable = HostState::new(HostOptions {
            opcache_mode: OpcacheMode::Immutable,
            ..HostOptions::default()
        });
        let immutable_php_ini = internal_file_text(&immutable, "/internal/shared/php.ini");
        assert!(immutable_php_ini.contains("opcache.validate_timestamps=0"));
        assert!(!immutable_php_ini.contains("opcache.revalidate_freq=60"));

        let middle = HostState::new(HostOptions {
            opcache_mode: OpcacheMode::Middle,
            ..HostOptions::default()
        });
        let middle_php_ini = internal_file_text(&middle, "/internal/shared/php.ini");
        assert!(middle_php_ini.contains("opcache.validate_timestamps=0"));
        assert!(middle_php_ini.contains("opcache.memory_consumption=18"));
        assert!(middle_php_ini.contains("opcache.interned_strings_buffer=3"));
        assert!(middle_php_ini.contains("opcache.max_accelerated_files=4096"));

        let low_memory = HostState::new(HostOptions {
            opcache_mode: OpcacheMode::LowMemory,
            ..HostOptions::default()
        });
        let low_memory_php_ini = internal_file_text(&low_memory, "/internal/shared/php.ini");
        assert!(low_memory_php_ini.contains("opcache.validate_timestamps=0"));
        assert!(low_memory_php_ini.contains("opcache.memory_consumption=8"));
        assert!(low_memory_php_ini.contains("opcache.interned_strings_buffer=2"));
        assert!(low_memory_php_ini.contains("opcache.max_accelerated_files=2048"));

        let _guard = ENV_LOCK.lock().unwrap();
        let _memory_env = EnvVarGuard::set(OPCACHE_MEMORY_ENV_VAR, "16");
        let _interned_env = EnvVarGuard::set(OPCACHE_INTERNED_STRINGS_ENV_VAR, "3");
        let _files_env = EnvVarGuard::set(OPCACHE_MAX_ACCELERATED_FILES_ENV_VAR, "3072");
        let tuned = HostState::new(HostOptions {
            opcache_mode: OpcacheMode::Middle,
            ..HostOptions::default()
        });
        let tuned_php_ini = internal_file_text(&tuned, "/internal/shared/php.ini");
        assert!(tuned_php_ini.contains("opcache.memory_consumption=18"));
        assert!(tuned_php_ini.contains("opcache.memory_consumption=16"));
        assert!(tuned_php_ini.contains("opcache.interned_strings_buffer=3"));
        assert!(tuned_php_ini.contains("opcache.max_accelerated_files=3072"));

        let off = HostState::new(HostOptions {
            opcache_mode: OpcacheMode::Off,
            ..HostOptions::default()
        });
        let off_php_ini = internal_file_text(&off, "/internal/shared/php.ini");
        assert!(off_php_ini.contains("opcache.enable=0"));
        assert!(off_php_ini.contains("opcache.enable_cli=0"));
    }

    #[test]
    fn internal_php_ini_applies_file_cache_only_fallback_to_affected_php_versions() {
        for php_version in ["7.4", "7.4.33", "8.0", "8.0.30"] {
            let state = HostState::new(HostOptions {
                php_version: Some(php_version.to_string()),
                opcache_mode: OpcacheMode::Middle,
                ..HostOptions::default()
            });
            let php_ini = internal_file_text(&state, "/internal/shared/php.ini");

            assert!(php_ini.contains("opcache.file_cache_only=0"));
            assert!(
                php_ini.contains("opcache.file_cache_only=1"),
                "expected file-cache-only fallback for PHP {php_version}"
            );
        }
    }

    #[test]
    fn internal_php_ini_does_not_apply_file_cache_only_fallback_to_unaffected_versions() {
        for php_version in ["8.1", "8.2", "8.3", "8.4", "8.5", "8.5.5"] {
            let state = HostState::new(HostOptions {
                php_version: Some(php_version.to_string()),
                opcache_mode: OpcacheMode::Middle,
                ..HostOptions::default()
            });
            let php_ini = internal_file_text(&state, "/internal/shared/php.ini");

            assert!(php_ini.contains("opcache.file_cache_only=0"));
            assert!(
                !php_ini.contains("opcache.file_cache_only=1"),
                "did not expect file-cache-only fallback for PHP {php_version}"
            );
        }
    }

    #[test]
    fn internal_php_ini_keeps_opcache_off_without_file_cache_only_fallback() {
        for php_version in ["7.4", "8.0", "8.5"] {
            let state = HostState::new(HostOptions {
                php_version: Some(php_version.to_string()),
                opcache_mode: OpcacheMode::Off,
                ..HostOptions::default()
            });
            let php_ini = internal_file_text(&state, "/internal/shared/php.ini");

            assert!(php_ini.contains("opcache.enable=0"));
            assert!(php_ini.contains("opcache.enable_cli=0"));
            assert!(php_ini.contains("opcache.file_cache_only=0"));
            assert!(
                !php_ini.contains("opcache.file_cache_only=1"),
                "opcache off should not get fallback for PHP {php_version}"
            );
        }
    }

    #[test]
    fn internal_php_ini_supports_experimental_append_env() {
        let _guard = ENV_LOCK.lock().unwrap();
        let _env = EnvVarGuard::set(
            EXPERIMENTAL_PHP_INI_APPEND_ENV_VAR,
            "realpath_cache_size=512K\noutput_buffering=4096",
        );

        let state = HostState::new(HostOptions::default());
        let php_ini = internal_file_text(&state, "/internal/shared/php.ini");

        assert!(php_ini.contains("realpath_cache_size=512K\n"));
        assert!(php_ini.contains("output_buffering=4096\n"));
    }

    fn restore_env(name: &str, previous: Option<std::ffi::OsString>) {
        if let Some(value) = previous {
            std::env::set_var(name, value);
        } else {
            std::env::remove_var(name);
        }
    }

    #[test]
    fn emscripten_resize_heap_grows_exported_memory() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "env" "emscripten_resize_heap"
                    (func $resize_heap (param i32) (result i32)))
                (memory (export "memory") 1 3)
                (func (export "grow_to_two_pages") (result i32)
                    i32.const 131072
                    call $resize_heap
                    if (result i32)
                        memory.size
                    else
                        i32.const -1
                    end
                )
                (func (export "grow_past_max") (result i32)
                    i32.const 262145
                    call $resize_heap
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let grow_to_two_pages = instance
            .get_func(&mut linker.store, "grow_to_two_pages")
            .unwrap();
        let grow_past_max = instance
            .get_func(&mut linker.store, "grow_past_max")
            .unwrap();

        let mut results = [Val::I32(-1)];
        grow_to_two_pages
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(2)]));

        grow_past_max
            .call(&mut linker.store, &[], &mut results)
            .unwrap();
        assert!(matches!(results, [Val::I32(0)]));
    }

    #[test]
    fn linker_uses_native_wasi_preview1_bindings() {
        let engine = Engine::default();
        let module = Module::new(
            &engine,
            r#"
            (module
                (import "wasi_snapshot_preview1" "random_get"
                    (func $random_get (param i32 i32) (result i32)))
                (memory (export "memory") 1)
                (func (export "call_random_get") (result i32)
                    i32.const 0
                    i32.const 4
                    call $random_get
                )
            )
            "#,
        )
        .unwrap();
        let mut linker = create_stub_import_linker(&module).unwrap();
        let instance = linker.instantiate(&module).unwrap();
        let call_random_get = instance
            .get_func(&mut linker.store, "call_random_get")
            .unwrap();
        let mut results = [Val::I32(-1)];
        call_random_get
            .call(&mut linker.store, &[], &mut results)
            .unwrap();

        assert!(matches!(results, [Val::I32(0)]));
        assert_eq!(
            linker.store.data().called_imports,
            vec!["wasi_snapshot_preview1.random_get".to_string()]
        );
    }
}
