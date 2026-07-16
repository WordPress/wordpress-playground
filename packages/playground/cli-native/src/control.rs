use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{php_runtime_files::PhpConstantValue, vfs::normalize_vfs_path, CliError, Result};

pub const CONTROL_TOKEN_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_CONTROL_TOKEN";
pub const CONTROL_PROTOCOL_VERSION: u32 = 1;
const MAX_CONTROL_HEADER_BYTES: usize = 32 * 1024;
const MAX_CONTROL_BODY_BYTES: usize = 128 * 1024 * 1024;
const MAX_CONTROL_CONNECTIONS: usize = 64;
const CONTROL_IO_TIMEOUT: Duration = Duration::from_secs(30);

pub type RequestHandler =
    Arc<dyn Fn(ControlHttpRequest) -> Result<ControlHttpResponse> + Send + Sync>;
pub type RunHandler = Arc<dyn Fn(ControlRunRequest) -> Result<ControlRunResponse> + Send + Sync>;
pub type PathResolver = Arc<dyn Fn(&str) -> Result<PathBuf> + Send + Sync>;
pub type DefineConstantHandler = Arc<dyn Fn(String, PhpConstantValue) -> Result<()> + Send + Sync>;

#[derive(Clone)]
pub struct ControlBackend {
    pub server_url: String,
    pub native_server_url: String,
    pub worker_count: usize,
    pub document_root: String,
    pub request: RequestHandler,
    pub run: RunHandler,
    pub resolve_path: PathResolver,
    pub define_constant: DefineConstantHandler,
}

#[derive(Debug, Clone)]
pub struct ControlOptions {
    pub handshake_path: PathBuf,
    pub token: String,
}

impl ControlOptions {
    pub fn from_handshake_path(handshake_path: PathBuf) -> Result<Self> {
        let token = std::env::var(CONTROL_TOKEN_ENV_VAR);
        std::env::remove_var(CONTROL_TOKEN_ENV_VAR);
        let token = token.map_err(|_| {
            CliError::new(format!(
                "{CONTROL_TOKEN_ENV_VAR} is required with --experimental-control-handshake"
            ))
        })?;
        validate_control_token(&token)?;
        Ok(Self {
            handshake_path,
            token,
        })
    }
}

pub struct ControlServer {
    shutdown: Arc<AtomicBool>,
    listener_thread: Option<JoinHandle<()>>,
    handshake_path: PathBuf,
}

impl ControlServer {
    pub fn start(options: ControlOptions, backend: ControlBackend) -> Result<Self> {
        let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| {
            CliError::new(format!("Failed to bind native control server: {error}"))
        })?;
        listener.set_nonblocking(true).map_err(|error| {
            CliError::new(format!(
                "Failed to configure native control server listener: {error}"
            ))
        })?;
        let address = listener.local_addr().map_err(|error| {
            CliError::new(format!(
                "Failed to inspect native control server address: {error}"
            ))
        })?;
        let control_url = format!("http://{address}/rpc");
        let handshake = ControlHandshake {
            protocol_version: CONTROL_PROTOCOL_VERSION,
            server_url: backend.server_url.clone(),
            native_server_url: backend.native_server_url.clone(),
            control_url,
            worker_count: backend.worker_count,
            document_root: backend.document_root.clone(),
            pid: std::process::id(),
        };
        let shutdown = Arc::new(AtomicBool::new(false));
        let thread_shutdown = Arc::clone(&shutdown);
        let token = options.token;
        let listener_thread = thread::Builder::new()
            .name("wp-playground-control".to_string())
            .spawn(move || control_accept_loop(listener, token, backend, thread_shutdown))
            .map_err(|error| {
                CliError::new(format!("Failed to start native control server: {error}"))
            })?;
        if let Err(error) = write_handshake(&options.handshake_path, &handshake) {
            shutdown.store(true, Ordering::Release);
            let _ = listener_thread.join();
            return Err(error);
        }

        Ok(Self {
            shutdown,
            listener_thread: Some(listener_thread),
            handshake_path: options.handshake_path,
        })
    }

    pub fn shutdown_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.shutdown)
    }
}

impl Drop for ControlServer {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Release);
        if let Some(listener_thread) = self.listener_thread.take() {
            let _ = listener_thread.join();
        }
        let _ = fs::remove_file(&self.handshake_path);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ControlHandshake {
    protocol_version: u32,
    server_url: String,
    native_server_url: String,
    control_url: String,
    worker_count: usize,
    document_root: String,
    pid: u32,
}

#[derive(Debug, Clone)]
pub struct ControlHttpRequest {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct ControlHttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct ControlRunRequest {
    pub code: Option<String>,
    pub script_path: Option<String>,
    pub relative_uri: String,
    pub protocol: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub env: Vec<(String, String)>,
    pub server_entries: Vec<(String, String)>,
}

#[derive(Debug, Clone)]
pub struct ControlRunResponse {
    pub exit_code: i32,
    pub http_status_code: u16,
    pub headers: Vec<(String, String)>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RpcRequest {
    protocol_version: u32,
    #[serde(default)]
    id: Value,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RpcResponse {
    protocol_version: u32,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcErrorBody>,
}

#[derive(Debug, Serialize)]
struct RpcErrorBody {
    code: &'static str,
    message: String,
}

#[derive(Debug)]
struct RpcError {
    code: &'static str,
    message: String,
}

impl RpcError {
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST",
            message: message.into(),
        }
    }

    fn unsupported(method: &str) -> Self {
        Self {
            code: "ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED",
            message: format!("The native control protocol does not support `{method}`"),
        }
    }

    fn runtime(error: impl std::fmt::Display) -> Self {
        Self {
            code: "ERR_WP_PLAYGROUND_NATIVE_RUNTIME",
            message: error.to_string(),
        }
    }

    fn io(error: impl std::fmt::Display) -> Self {
        Self {
            code: "ERR_WP_PLAYGROUND_NATIVE_IO",
            message: error.to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestParams {
    #[serde(alias = "url")]
    path: String,
    #[serde(default = "default_get")]
    method: String,
    #[serde(default)]
    headers: Vec<HeaderPair>,
    #[serde(default)]
    body: Option<TaggedBytes>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunParams {
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    script_path: Option<String>,
    #[serde(default = "default_relative_uri")]
    relative_uri: String,
    #[serde(default = "default_protocol")]
    protocol: String,
    #[serde(default = "default_get")]
    method: String,
    #[serde(default)]
    headers: Vec<HeaderPair>,
    #[serde(default)]
    body: Option<TaggedBytes>,
    #[serde(default)]
    env: BTreeMap<String, String>,
    #[serde(default, rename = "$_SERVER")]
    server_entries: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct HeaderPair {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct PathParams {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteFileParams {
    path: String,
    data: TaggedBytes,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveParams {
    from_path: String,
    to_path: String,
}

#[derive(Debug, Deserialize)]
struct DefineConstantParams {
    name: String,
    value: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct TaggedBytes {
    encoding: String,
    data: String,
}

impl TaggedBytes {
    fn from_bytes(bytes: &[u8]) -> Self {
        Self {
            encoding: "base64".to_string(),
            data: BASE64.encode(bytes),
        }
    }

    fn decode(self) -> std::result::Result<Vec<u8>, RpcError> {
        if self.encoding != "base64" {
            return Err(RpcError::invalid(
                "Binary values must use the `base64` encoding",
            ));
        }
        BASE64
            .decode(self.data)
            .map_err(|error| RpcError::invalid(format!("Invalid base64 data: {error}")))
    }
}

struct ControlState {
    backend: ControlBackend,
    cwd: Mutex<String>,
    shutdown: Arc<AtomicBool>,
}

struct ControlConnectionPermit {
    active: Arc<AtomicUsize>,
}

impl ControlConnectionPermit {
    fn try_acquire(active: &Arc<AtomicUsize>) -> Option<Self> {
        active
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
                (current < MAX_CONTROL_CONNECTIONS).then_some(current + 1)
            })
            .ok()
            .map(|_| Self {
                active: Arc::clone(active),
            })
    }
}

impl Drop for ControlConnectionPermit {
    fn drop(&mut self) {
        self.active.fetch_sub(1, Ordering::AcqRel);
    }
}

fn control_accept_loop(
    listener: TcpListener,
    token: String,
    backend: ControlBackend,
    shutdown: Arc<AtomicBool>,
) {
    let state = Arc::new(ControlState {
        cwd: Mutex::new(backend.document_root.clone()),
        backend,
        shutdown: Arc::clone(&shutdown),
    });
    let active_connections = Arc::new(AtomicUsize::new(0));
    while !shutdown.load(Ordering::Acquire) {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let Some(permit) = ControlConnectionPermit::try_acquire(&active_connections) else {
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
                    let _ = write_control_http_response(
                        &mut stream,
                        503,
                        "application/json",
                        br#"{"error":{"code":"ERR_WP_PLAYGROUND_NATIVE_BUSY","message":"Too many concurrent native control connections"}}"#,
                    );
                    continue;
                };
                let token = token.clone();
                let state = Arc::clone(&state);
                let _ = thread::Builder::new()
                    .name("wp-playground-control-request".to_string())
                    .spawn(move || {
                        let _permit = permit;
                        if let Err(error) = handle_control_stream(stream, &token, &state) {
                            eprintln!("warning: native control request failed: {error}");
                        }
                    });
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => {
                eprintln!("warning: native control server stopped accepting requests: {error}");
                break;
            }
        }
    }
}

fn handle_control_stream(mut stream: TcpStream, token: &str, state: &ControlState) -> Result<()> {
    let _ = stream.set_read_timeout(Some(CONTROL_IO_TIMEOUT));
    let _ = stream.set_write_timeout(Some(CONTROL_IO_TIMEOUT));
    let mut reader = BufReader::new(&mut stream);
    let request_head = read_control_http_head(&mut reader)?;
    if !constant_time_eq(
        request_head.authorization.as_deref().unwrap_or_default(),
        &format!("Bearer {token}"),
    ) {
        drop(reader);
        return write_control_http_response(
            &mut stream,
            401,
            "application/json",
            br#"{"error":{"code":"ERR_WP_PLAYGROUND_NATIVE_AUTH","message":"Unauthorized"}}"#,
        );
    }
    if request_head.content_length > MAX_CONTROL_BODY_BYTES {
        drop(reader);
        return write_control_http_response(
            &mut stream,
            413,
            "application/json",
            br#"{"error":{"code":"ERR_WP_PLAYGROUND_NATIVE_REQUEST_TOO_LARGE","message":"Native control request body is too large"}}"#,
        );
    }
    let mut body = vec![0u8; request_head.content_length];
    reader.read_exact(&mut body)?;
    drop(reader);
    let request = ControlHttpEnvelope {
        method: request_head.method,
        path: request_head.path,
        body,
    };

    if request.method == "GET" && request.path == "/events" {
        return write_event_stream(&mut stream, state);
    }
    if request.method != "POST" || request.path != "/rpc" {
        return write_control_http_response(
            &mut stream,
            404,
            "application/json",
            br#"{"error":{"code":"ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST","message":"Not Found"}}"#,
        );
    }

    let response = match serde_json::from_slice::<RpcRequest>(&request.body) {
        Ok(request) => dispatch_rpc(request, state),
        Err(error) => RpcResponse {
            protocol_version: CONTROL_PROTOCOL_VERSION,
            id: Value::Null,
            result: None,
            error: Some(RpcErrorBody {
                code: "ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST",
                message: format!("Invalid JSON-RPC request: {error}"),
            }),
        },
    };
    let body = serde_json::to_vec(&response)
        .map_err(|error| CliError::new(format!("Failed to serialize control response: {error}")))?;
    write_control_http_response(&mut stream, 200, "application/json", &body)
}

fn dispatch_rpc(request: RpcRequest, state: &ControlState) -> RpcResponse {
    let id = request.id;
    let result = if request.protocol_version != CONTROL_PROTOCOL_VERSION {
        Err(RpcError::invalid(format!(
            "Unsupported control protocol version {}; expected {CONTROL_PROTOCOL_VERSION}",
            request.protocol_version
        )))
    } else {
        dispatch_method(&request.method, request.params, state)
    };
    match result {
        Ok(result) => RpcResponse {
            protocol_version: CONTROL_PROTOCOL_VERSION,
            id,
            result: Some(result),
            error: None,
        },
        Err(error) => RpcResponse {
            protocol_version: CONTROL_PROTOCOL_VERSION,
            id,
            result: None,
            error: Some(RpcErrorBody {
                code: error.code,
                message: error.message,
            }),
        },
    }
}

fn dispatch_method(
    method: &str,
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    match method {
        "server.info" => Ok(json!({
            "protocolVersion": CONTROL_PROTOCOL_VERSION,
            "serverUrl": state.backend.server_url,
            "nativeServerUrl": state.backend.native_server_url,
            "workerCount": state.backend.worker_count,
            "documentRoot": state.backend.document_root,
            "cwd": current_cwd(state)?,
            "absoluteUrl": state.backend.server_url,
        })),
        "request" => dispatch_request(params, state),
        "run" => dispatch_run(params, state),
        "mkdir" => dispatch_mkdir(params, state, false),
        "mkdirTree" => dispatch_mkdir(params, state, true),
        "readFileAsText" => dispatch_read_file(params, state, true),
        "readFileAsBuffer" => dispatch_read_file(params, state, false),
        "writeFile" => dispatch_write_file(params, state),
        "unlink" => dispatch_remove_file(params, state),
        "mv" => dispatch_move(params, state),
        "rmdir" => dispatch_remove_dir(params, state),
        "listFiles" => dispatch_list_files(params, state),
        "isDir" => dispatch_is_type(params, state, true),
        "isFile" => dispatch_is_type(params, state, false),
        "fileExists" => dispatch_exists(params, state),
        "chdir" => dispatch_chdir(params, state),
        "cwd" => Ok(Value::String(current_cwd(state)?)),
        "defineConstant" => dispatch_define_constant(params, state),
        "absoluteUrl" => Ok(Value::String(state.backend.server_url.clone())),
        "documentRoot" => Ok(Value::String(state.backend.document_root.clone())),
        "pathToInternalUrl" => dispatch_path_to_url(params, state),
        "internalUrlToPath" => dispatch_url_to_path(params, state),
        "dispose" => {
            state.shutdown.store(true, Ordering::Release);
            Ok(json!({"disposed": true}))
        }
        "cli"
        | "requestStreamed"
        | "addEventListener"
        | "removeEventListener"
        | "onMessage"
        | "acquirePHPInstance"
        | "releasePHPInstance" => Err(RpcError::unsupported(method)),
        _ => Err(RpcError::unsupported(method)),
    }
}

fn dispatch_request(params: Value, state: &ControlState) -> std::result::Result<Value, RpcError> {
    let params: RequestParams = parse_params(params)?;
    let path = request_path(&params.path, &state.backend.server_url)?;
    let response = (state.backend.request)(ControlHttpRequest {
        method: params.method,
        path,
        headers: header_pairs(params.headers),
        body: decode_optional_bytes(params.body)?,
    })
    .map_err(RpcError::runtime)?;
    Ok(json!({
        "httpStatusCode": response.status,
        "headers": response.headers.into_iter().map(|(name, value)| HeaderPair { name, value }).collect::<Vec<_>>(),
        "body": TaggedBytes::from_bytes(&response.body),
    }))
}

fn dispatch_run(params: Value, state: &ControlState) -> std::result::Result<Value, RpcError> {
    let params: RunParams = parse_params(params)?;
    if params.code.is_some() == params.script_path.is_some() {
        return Err(RpcError::invalid(
            "run requires exactly one of `code` or `scriptPath`",
        ));
    }
    let response = (state.backend.run)(ControlRunRequest {
        code: params.code,
        script_path: params.script_path,
        relative_uri: request_path(&params.relative_uri, &state.backend.server_url)?,
        protocol: params.protocol,
        method: params.method,
        headers: header_pairs(params.headers),
        body: decode_optional_bytes(params.body)?,
        env: params.env.into_iter().collect(),
        server_entries: params.server_entries.into_iter().collect(),
    })
    .map_err(RpcError::runtime)?;
    Ok(json!({
        "exitCode": response.exit_code,
        "httpStatusCode": response.http_status_code,
        "headers": response.headers.into_iter().map(|(name, value)| HeaderPair { name, value }).collect::<Vec<_>>(),
        "stdout": TaggedBytes::from_bytes(&response.stdout),
        "stderr": TaggedBytes::from_bytes(&response.stderr),
    }))
}

fn dispatch_mkdir(
    params: Value,
    state: &ControlState,
    recursive: bool,
) -> std::result::Result<Value, RpcError> {
    let host = resolve_param_path(params, state)?;
    if recursive {
        fs::create_dir_all(host).map_err(RpcError::io)?;
    } else {
        fs::create_dir(host).map_err(RpcError::io)?;
    }
    Ok(Value::Null)
}

fn dispatch_read_file(
    params: Value,
    state: &ControlState,
    text: bool,
) -> std::result::Result<Value, RpcError> {
    let bytes = fs::read(resolve_param_path(params, state)?).map_err(RpcError::io)?;
    if text {
        String::from_utf8(bytes)
            .map(Value::String)
            .map_err(|error| RpcError::io(format!("File is not valid UTF-8: {error}")))
    } else {
        serde_json::to_value(TaggedBytes::from_bytes(&bytes)).map_err(RpcError::runtime)
    }
}

fn dispatch_write_file(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    let params: WriteFileParams = parse_params(params)?;
    let path = resolve_vfs_path(&params.path, state)?;
    let host = (state.backend.resolve_path)(&path).map_err(RpcError::io)?;
    fs::write(host, params.data.decode()?).map_err(RpcError::io)?;
    Ok(Value::Null)
}

fn dispatch_remove_file(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    fs::remove_file(resolve_param_path(params, state)?).map_err(RpcError::io)?;
    Ok(Value::Null)
}

fn dispatch_move(params: Value, state: &ControlState) -> std::result::Result<Value, RpcError> {
    let params: MoveParams = parse_params(params)?;
    let from = (state.backend.resolve_path)(&resolve_vfs_path(&params.from_path, state)?)
        .map_err(RpcError::io)?;
    let to = (state.backend.resolve_path)(&resolve_vfs_path(&params.to_path, state)?)
        .map_err(RpcError::io)?;
    fs::rename(from, to).map_err(RpcError::io)?;
    Ok(Value::Null)
}

fn dispatch_remove_dir(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    fs::remove_dir(resolve_param_path(params, state)?).map_err(RpcError::io)?;
    Ok(Value::Null)
}

fn dispatch_list_files(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    let mut names = fs::read_dir(resolve_param_path(params, state)?)
        .map_err(RpcError::io)?
        .map(|entry| {
            entry
                .map_err(RpcError::io)
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
        })
        .collect::<std::result::Result<Vec<_>, _>>()?;
    names.sort();
    Ok(json!(names))
}

fn dispatch_is_type(
    params: Value,
    state: &ControlState,
    directory: bool,
) -> std::result::Result<Value, RpcError> {
    let metadata = fs::metadata(resolve_param_path(params, state)?);
    Ok(Value::Bool(match metadata {
        Ok(metadata) if directory => metadata.is_dir(),
        Ok(metadata) => metadata.is_file(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(RpcError::io(error)),
    }))
}

fn dispatch_exists(params: Value, state: &ControlState) -> std::result::Result<Value, RpcError> {
    let exists = match fs::metadata(resolve_param_path(params, state)?) {
        Ok(_) => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(RpcError::io(error)),
    };
    Ok(Value::Bool(exists))
}

fn dispatch_chdir(params: Value, state: &ControlState) -> std::result::Result<Value, RpcError> {
    let params: PathParams = parse_params(params)?;
    let path = resolve_vfs_path(&params.path, state)?;
    let host = (state.backend.resolve_path)(&path).map_err(RpcError::io)?;
    if !host.is_dir() {
        return Err(RpcError::io(format!("Not a directory: {path}")));
    }
    *state
        .cwd
        .lock()
        .map_err(|_| RpcError::runtime("Control cwd lock was poisoned"))? = path;
    Ok(Value::Null)
}

fn dispatch_define_constant(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    let params: DefineConstantParams = parse_params(params)?;
    if params.name.is_empty()
        || !params
            .name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        return Err(RpcError::invalid("Invalid PHP constant name"));
    }
    let value = match params.value {
        Value::String(value) => PhpConstantValue::String(value),
        Value::Bool(value) => PhpConstantValue::Bool(value),
        Value::Number(value) => PhpConstantValue::Number(value.to_string()),
        _ => {
            return Err(RpcError::invalid(
                "PHP constants must be strings, booleans, or numbers",
            ))
        }
    };
    (state.backend.define_constant)(params.name, value).map_err(RpcError::runtime)?;
    Ok(Value::Null)
}

fn dispatch_path_to_url(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    let params: PathParams = parse_params(params)?;
    let path = resolve_vfs_path(&params.path, state)?;
    let relative = path
        .strip_prefix(&state.backend.document_root)
        .filter(|relative| relative.is_empty() || relative.starts_with('/'))
        .ok_or_else(|| RpcError::invalid("Path is outside the document root"))?;
    Ok(Value::String(format!(
        "{}{}",
        state.backend.server_url.trim_end_matches('/'),
        if relative.is_empty() { "/" } else { relative }
    )))
}

fn dispatch_url_to_path(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    #[derive(Deserialize)]
    struct UrlParams {
        url: String,
    }
    let params: UrlParams = parse_params(params)?;
    let relative = request_path(&params.url, &state.backend.server_url)?;
    normalize_vfs_path(&format!(
        "{}/{}",
        state.backend.document_root.trim_end_matches('/'),
        relative.trim_start_matches('/')
    ))
    .map(Value::String)
    .map_err(|error| RpcError::invalid(error.to_string()))
}

fn parse_params<T: for<'de> Deserialize<'de>>(params: Value) -> std::result::Result<T, RpcError> {
    serde_json::from_value(params)
        .map_err(|error| RpcError::invalid(format!("Invalid method parameters: {error}")))
}

fn resolve_param_path(
    params: Value,
    state: &ControlState,
) -> std::result::Result<PathBuf, RpcError> {
    let params: PathParams = parse_params(params)?;
    let path = resolve_vfs_path(&params.path, state)?;
    (state.backend.resolve_path)(&path).map_err(RpcError::io)
}

fn resolve_vfs_path(path: &str, state: &ControlState) -> std::result::Result<String, RpcError> {
    if path.starts_with('/') {
        normalize_vfs_path(path).map_err(|error| RpcError::invalid(error.to_string()))
    } else {
        normalize_vfs_path(&format!("{}/{}", current_cwd(state)?, path))
            .map_err(|error| RpcError::invalid(error.to_string()))
    }
}

fn current_cwd(state: &ControlState) -> std::result::Result<String, RpcError> {
    state
        .cwd
        .lock()
        .map(|cwd| cwd.clone())
        .map_err(|_| RpcError::runtime("Control cwd lock was poisoned"))
}

fn request_path(value: &str, server_url: &str) -> std::result::Result<String, RpcError> {
    if value.starts_with('/') {
        return Ok(value.to_string());
    }
    if let Some(path) = value.strip_prefix(server_url.trim_end_matches('/')) {
        if path.is_empty() {
            return Ok("/".to_string());
        }
        if path.starts_with('/') {
            return Ok(path.to_string());
        }
    }
    Err(RpcError::invalid(format!(
        "Request URL must be relative or use the Playground origin {server_url}"
    )))
}

fn header_pairs(headers: Vec<HeaderPair>) -> Vec<(String, String)> {
    headers
        .into_iter()
        .map(|header| (header.name, header.value))
        .collect()
}

fn decode_optional_bytes(bytes: Option<TaggedBytes>) -> std::result::Result<Vec<u8>, RpcError> {
    bytes
        .map(TaggedBytes::decode)
        .transpose()
        .map(Option::unwrap_or_default)
}

fn default_get() -> String {
    "GET".to_string()
}

fn default_relative_uri() -> String {
    "/".to_string()
}

fn default_protocol() -> String {
    "http".to_string()
}

struct ControlHttpEnvelope {
    method: String,
    path: String,
    body: Vec<u8>,
}

struct ControlHttpHead {
    method: String,
    path: String,
    authorization: Option<String>,
    content_length: usize,
}

fn read_control_http_head(reader: &mut impl BufRead) -> Result<ControlHttpHead> {
    let mut line = Vec::with_capacity(MAX_CONTROL_HEADER_BYTES + 1);
    read_bounded_control_line(reader, &mut line, MAX_CONTROL_HEADER_BYTES)?;
    let request_line = control_line_text(&line)?;
    let mut parts = request_line
        .trim_end_matches(['\r', '\n'])
        .split_whitespace();
    let method = parts
        .next()
        .ok_or_else(|| CliError::new("Missing control request method"))?
        .to_string();
    let path = parts
        .next()
        .ok_or_else(|| CliError::new("Missing control request path"))?
        .to_string();
    if parts.next().is_none() || parts.next().is_some() {
        return Err(CliError::new("Invalid control request line"));
    }

    let mut header_bytes = line.len();
    let mut content_length = 0usize;
    let mut authorization = None;
    loop {
        read_bounded_control_line(reader, &mut line, MAX_CONTROL_HEADER_BYTES - header_bytes)?;
        header_bytes = header_bytes.saturating_add(line.len());
        if line == b"\r\n" || line == b"\n" {
            break;
        }
        let (name, value) = control_line_text(&line)?
            .trim_end_matches(['\r', '\n'])
            .split_once(':')
            .ok_or_else(|| CliError::new("Malformed native control request header"))?;
        match name.trim().to_ascii_lowercase().as_str() {
            "content-length" => {
                content_length = value
                    .trim()
                    .parse::<usize>()
                    .map_err(|_| CliError::new("Invalid native control Content-Length"))?;
            }
            "authorization" => authorization = Some(value.trim().to_string()),
            _ => {}
        }
    }
    Ok(ControlHttpHead {
        method,
        path,
        authorization,
        content_length,
    })
}

fn read_bounded_control_line(
    reader: &mut impl BufRead,
    line: &mut Vec<u8>,
    max_bytes: usize,
) -> Result<()> {
    line.clear();
    let read_limit = max_bytes.saturating_add(1);
    reader.take(read_limit as u64).read_until(b'\n', line)?;
    if line.len() > max_bytes {
        return Err(CliError::new(
            "Native control request headers are too large",
        ));
    }
    Ok(())
}

fn control_line_text(line: &[u8]) -> Result<&str> {
    std::str::from_utf8(line)
        .map_err(|_| CliError::new("Native control request headers must be valid UTF-8"))
}

fn write_control_http_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> Result<()> {
    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        413 => "Payload Too Large",
        503 => "Service Unavailable",
        _ => "Error",
    };
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n",
        body.len()
    )?;
    stream.write_all(body)?;
    stream.flush()?;
    Ok(())
}

fn write_event_stream(stream: &mut TcpStream, state: &ControlState) -> Result<()> {
    write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nConnection: close\r\n\r\nevent: ready\ndata: {{\"protocolVersion\":{CONTROL_PROTOCOL_VERSION}}}\n\n"
    )?;
    stream.flush()?;
    while !state.shutdown.load(Ordering::Acquire) {
        thread::sleep(Duration::from_secs(10));
        if stream.write_all(b": keepalive\n\n").is_err() || stream.flush().is_err() {
            return Ok(());
        }
    }
    let _ = stream.write_all(b"event: shutdown\ndata: {}\n\n");
    let _ = stream.flush();
    Ok(())
}

fn write_handshake(path: &Path, handshake: &ControlHandshake) -> Result<()> {
    if path.exists() {
        return Err(CliError::new(format!(
            "Native control handshake path already exists: {}",
            path.display()
        )));
    }
    let parent = path.parent().ok_or_else(|| {
        CliError::new(format!(
            "Native control handshake path has no parent: {}",
            path.display()
        ))
    })?;
    fs::create_dir_all(parent)?;
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("handshake.json");
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = parent.join(format!(".{filename}.{}.{}.tmp", std::process::id(), unique));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary).map_err(|error| {
        CliError::new(format!(
            "Failed to create native control handshake {}: {error}",
            temporary.display()
        ))
    })?;
    let result = (|| -> Result<()> {
        serde_json::to_writer(&mut file, handshake).map_err(|error| {
            CliError::new(format!(
                "Failed to serialize native control handshake: {error}"
            ))
        })?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path).map_err(|error| {
            CliError::new(format!(
                "Failed to publish native control handshake {}: {error}",
                path.display()
            ))
        })?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn validate_control_token(token: &str) -> Result<()> {
    if token.len() == 64 && token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(CliError::new(format!(
            "{CONTROL_TOKEN_ENV_VAR} must contain exactly 64 hexadecimal characters"
        )))
    }
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.bytes()
        .zip(right.bytes())
        .fold(0u8, |difference, (left, right)| difference | (left ^ right))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::BTreeMap, io::Cursor};

    fn backend(root: PathBuf) -> ControlBackend {
        let root_for_resolver = root.clone();
        ControlBackend {
            server_url: "http://127.0.0.1:9400".to_string(),
            native_server_url: "http://127.0.0.1:9401".to_string(),
            worker_count: 3,
            document_root: "/wordpress".to_string(),
            request: Arc::new(|request| {
                Ok(ControlHttpResponse {
                    status: 200,
                    headers: vec![("X-Method".to_string(), request.method)],
                    body: request.body,
                })
            }),
            run: Arc::new(|request| {
                Ok(ControlRunResponse {
                    exit_code: 0,
                    http_status_code: 200,
                    headers: Vec::new(),
                    stdout: request.code.unwrap_or_default().into_bytes(),
                    stderr: Vec::new(),
                })
            }),
            resolve_path: Arc::new(move |path| {
                let relative = path
                    .strip_prefix("/wordpress")
                    .ok_or_else(|| CliError::new("outside mount"))?;
                Ok(root_for_resolver.join(relative.trim_start_matches('/')))
            }),
            define_constant: Arc::new(|_, _| Ok(())),
        }
    }

    fn state(root: PathBuf) -> ControlState {
        ControlState {
            backend: backend(root),
            cwd: Mutex::new("/wordpress".to_string()),
            shutdown: Arc::new(AtomicBool::new(false)),
        }
    }

    fn rpc_http_request(control_url: &str, token: Option<&str>, body: &str) -> String {
        let endpoint = control_url.strip_prefix("http://").unwrap();
        let (address, path) = endpoint.split_once('/').unwrap();
        raw_http_request(
            address,
            &format!(
            "POST /{path} HTTP/1.1\r\nHost: {address}\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            token
                .map(|token| format!("Authorization: Bearer {token}\r\n"))
                .unwrap_or_default(),
            body.len(),
            ),
        )
    }

    fn raw_http_request(address: &str, request: &str) -> String {
        let mut stream = TcpStream::connect(address).unwrap();
        stream.write_all(request.as_bytes()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }

    #[test]
    fn validates_exact_control_token_shape() {
        assert!(validate_control_token(&"a".repeat(64)).is_ok());
        assert!(validate_control_token(&"z".repeat(64)).is_err());
        assert!(validate_control_token(&"a".repeat(63)).is_err());
    }

    #[test]
    fn rejects_foreign_request_origins() {
        assert_eq!(
            request_path("http://127.0.0.1:9400/wp-admin/", "http://127.0.0.1:9400").unwrap(),
            "/wp-admin/"
        );
        assert!(request_path("https://example.com/", "http://127.0.0.1:9400").is_err());
    }

    #[test]
    fn path_to_internal_url_requires_an_exact_document_root_segment() {
        let state = state(std::env::temp_dir());
        let url = dispatch_method(
            "pathToInternalUrl",
            json!({"path":"/wordpress/wp-admin/"}),
            &state,
        )
        .unwrap();
        assert_eq!(url, json!("http://127.0.0.1:9400/wp-admin"));

        let error = dispatch_method(
            "pathToInternalUrl",
            json!({"path":"/wordpress@example.com/escape"}),
            &state,
        )
        .unwrap_err();
        assert!(error.message.contains("outside the document root"));
    }

    #[test]
    fn bounds_control_line_reads_before_rejecting() {
        let mut reader = Cursor::new(vec![b'a'; MAX_CONTROL_HEADER_BYTES + 1024]);
        let mut line = Vec::new();
        let error = read_bounded_control_line(&mut reader, &mut line, MAX_CONTROL_HEADER_BYTES)
            .unwrap_err();

        assert!(error.message().contains("headers are too large"));
        assert_eq!(line.len(), MAX_CONTROL_HEADER_BYTES + 1);
        assert_eq!(reader.position(), (MAX_CONTROL_HEADER_BYTES + 1) as u64);
    }

    #[test]
    fn caps_and_releases_concurrent_control_connections() {
        let active = Arc::new(AtomicUsize::new(0));
        let mut permits = (0..MAX_CONTROL_CONNECTIONS)
            .map(|_| ControlConnectionPermit::try_acquire(&active).unwrap())
            .collect::<Vec<_>>();

        assert_eq!(active.load(Ordering::Acquire), MAX_CONTROL_CONNECTIONS);
        assert!(ControlConnectionPermit::try_acquire(&active).is_none());
        permits.pop();
        assert_eq!(active.load(Ordering::Acquire), MAX_CONTROL_CONNECTIONS - 1);
        assert!(ControlConnectionPermit::try_acquire(&active).is_some());
    }

    #[test]
    fn authenticated_body_limit_accepts_boundary_and_returns_structured_413_above_it() {
        let request =
            format!("POST /rpc HTTP/1.1\r\nContent-Length: {MAX_CONTROL_BODY_BYTES}\r\n\r\n");
        let head = read_control_http_head(&mut Cursor::new(request.into_bytes())).unwrap();
        assert_eq!(head.content_length, MAX_CONTROL_BODY_BYTES);

        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-body-limit-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "b".repeat(64);
        let server = ControlServer::start(
            ControlOptions {
                handshake_path: handshake_path.clone(),
                token: token.clone(),
            },
            backend(root.clone()),
        )
        .unwrap();
        let handshake: Value = serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
        let endpoint = handshake["controlUrl"]
            .as_str()
            .unwrap()
            .strip_prefix("http://")
            .unwrap();
        let (address, path) = endpoint.split_once('/').unwrap();
        let response = raw_http_request(
            address,
            &format!(
                "POST /{path} HTTP/1.1\r\nAuthorization: Bearer {token}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                MAX_CONTROL_BODY_BYTES + 1
            ),
        );

        assert!(response.starts_with("HTTP/1.1 413 Payload Too Large\r\n"));
        assert!(response.contains("ERR_WP_PLAYGROUND_NATIVE_REQUEST_TOO_LARGE"));
        drop(server);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn filesystem_rpc_uses_virtual_cwd_and_binary_encoding() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let state = state(root.clone());
        dispatch_method(
            "writeFile",
            json!({"path":"hello.txt","data":{"encoding":"base64","data":"aGVsbG8="}}),
            &state,
        )
        .unwrap();
        assert_eq!(fs::read(root.join("hello.txt")).unwrap(), b"hello");
        let value =
            dispatch_method("readFileAsBuffer", json!({"path":"hello.txt"}), &state).unwrap();
        assert_eq!(value["encoding"], "base64");
        assert_eq!(value["data"], "aGVsbG8=");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rpc_errors_have_stable_codes_and_preserve_ids() {
        let root = std::env::temp_dir();
        let state = state(root);
        let response = dispatch_rpc(
            RpcRequest {
                protocol_version: CONTROL_PROTOCOL_VERSION,
                id: json!(41),
                method: "cli".to_string(),
                params: json!({}),
            },
            &state,
        );
        assert_eq!(response.id, json!(41));
        assert_eq!(
            response.error.unwrap().code,
            "ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED"
        );
    }

    #[test]
    fn handshake_is_atomic_and_private_on_unix() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-handshake-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("handshake.json");
        write_handshake(
            &path,
            &ControlHandshake {
                protocol_version: 1,
                server_url: "http://127.0.0.1:9400".to_string(),
                native_server_url: "http://127.0.0.1:9401".to_string(),
                control_url: "http://127.0.0.1:1234".to_string(),
                worker_count: 2,
                document_root: "/wordpress".to_string(),
                pid: 1,
            },
        )
        .unwrap();
        let value: BTreeMap<String, Value> =
            serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(value["protocolVersion"], 1);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn control_server_requires_bearer_auth_and_disposes_cleanly() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-http-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "a".repeat(64);
        let server = ControlServer::start(
            ControlOptions {
                handshake_path: handshake_path.clone(),
                token: token.clone(),
            },
            backend(root.clone()),
        )
        .unwrap();
        let handshake: Value = serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
        let control_url = handshake["controlUrl"].as_str().unwrap();

        let unauthorized = rpc_http_request(
            control_url,
            None,
            r#"{"protocolVersion":1,"id":1,"method":"server.info","params":{}}"#,
        );
        assert!(unauthorized.starts_with("HTTP/1.1 401"));

        let authorized = rpc_http_request(
            control_url,
            Some(&token),
            r#"{"protocolVersion":1,"id":2,"method":"server.info","params":{}}"#,
        );
        assert!(authorized.starts_with("HTTP/1.1 200"));
        assert!(authorized.contains("\"nativeServerUrl\":\"http://127.0.0.1:9401\""));

        let disposed = rpc_http_request(
            control_url,
            Some(&token),
            r#"{"protocolVersion":1,"id":3,"method":"dispose","params":{}}"#,
        );
        assert!(disposed.contains("\"disposed\":true"));
        drop(server);
        assert!(!handshake_path.exists());
        let _ = fs::remove_dir_all(root);
    }
}
