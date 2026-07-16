use std::{
    collections::{BTreeMap, HashMap},
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender, TrySendError},
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
pub const CONTROL_PROTOCOL_VERSION: u32 = 2;
const MAX_CONTROL_HEADER_BYTES: usize = 32 * 1024;
const MAX_CONTROL_BODY_BYTES: usize = 128 * 1024 * 1024;
const MAX_CONTROL_CONNECTIONS: usize = 64;
pub const MAX_STREAM_FRAME_BYTES: usize = 64 * 1024;
const MAX_STREAM_HEADER_BYTES: usize = 64 * 1024;
const MAX_STREAM_HEADER_COUNT: usize = 1024;
const STREAM_QUEUE_CAPACITY: usize = 8;
const EVENT_QUEUE_CAPACITY: usize = 64;
const CONTROL_IO_TIMEOUT: Duration = Duration::from_secs(30);

pub type RequestHandler =
    Arc<dyn Fn(ControlHttpRequest) -> Result<ControlHttpResponse> + Send + Sync>;
pub type RunHandler = Arc<dyn Fn(ControlRunRequest) -> Result<ControlRunResponse> + Send + Sync>;
pub type StreamHandler = Arc<
    dyn Fn(
            ControlHttpRequest,
            ControlStreamEmitter,
            Arc<AtomicBool>,
        ) -> Result<ControlStreamResponse>
        + Send
        + Sync,
>;
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
    pub stream: StreamHandler,
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
    events: Arc<EventHub>,
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
        let events = Arc::new(EventHub::default());
        let thread_shutdown = Arc::clone(&shutdown);
        let thread_events = Arc::clone(&events);
        let token = options.token;
        let listener_thread = thread::Builder::new()
            .name("wp-playground-control".to_string())
            .spawn(move || {
                control_accept_loop(listener, token, backend, thread_shutdown, thread_events)
            })
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
            events,
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
        publish_shutdown(&self.events);
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
    pub exit_code: i32,
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub stderr: Vec<u8>,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlStreamChannel {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ControlStreamEvent {
    Headers {
        status: u16,
        headers: Vec<(String, String)>,
    },
    Output {
        channel: ControlStreamChannel,
        bytes: Vec<u8>,
    },
}

pub type ControlStreamEmitter = Arc<dyn Fn(ControlStreamEvent) -> Result<()> + Send + Sync>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ControlStreamResponse {
    pub exit_code: i32,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
struct HeaderPair {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PathParams {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
struct WriteFileParams {
    path: String,
    data: TaggedBytes,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
struct MoveParams {
    from_path: String,
    to_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RmdirParams {
    path: String,
    #[serde(default)]
    options: RmdirOptions,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RmdirOptions {
    #[serde(default = "default_true")]
    recursive: bool,
}

impl Default for RmdirOptions {
    fn default() -> Self {
        Self { recursive: true }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ListFilesParams {
    path: String,
    #[serde(default)]
    options: ListFilesOptions,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ListFilesOptions {
    #[serde(default)]
    prepend_path: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct DefineConstantParams {
    name: String,
    value: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TaggedBytes {
    encoding: String,
    data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CancelRequest {
    protocol_version: u32,
    id: Value,
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
    active_streams: Mutex<HashMap<u64, Arc<AtomicBool>>>,
    events: Arc<EventHub>,
}

#[derive(Debug, Clone)]
struct ControlEvent {
    name: &'static str,
    data: Value,
}

#[derive(Default)]
struct EventHub {
    subscribers: Mutex<EventSubscribers>,
}

#[derive(Default)]
struct EventSubscribers {
    next_id: u64,
    senders: HashMap<u64, SyncSender<ControlEvent>>,
}

struct EventSubscription {
    id: u64,
    receiver: Receiver<ControlEvent>,
    hub: Arc<EventHub>,
}

impl EventHub {
    fn subscribe(self: &Arc<Self>) -> Result<EventSubscription> {
        let (sender, receiver) = sync_channel(EVENT_QUEUE_CAPACITY);
        let mut subscribers = self
            .subscribers
            .lock()
            .map_err(|_| CliError::new("Native event subscriber lock was poisoned"))?;
        subscribers.next_id = subscribers.next_id.wrapping_add(1).max(1);
        let id = subscribers.next_id;
        subscribers.senders.insert(id, sender);
        Ok(EventSubscription {
            id,
            receiver,
            hub: Arc::clone(self),
        })
    }

    fn publish(&self, event: ControlEvent) {
        let Ok(mut subscribers) = self.subscribers.lock() else {
            return;
        };
        subscribers
            .senders
            .retain(|_, sender| match sender.try_send(event.clone()) {
                Ok(()) => true,
                Err(TrySendError::Full(_) | TrySendError::Disconnected(_)) => false,
            });
    }
}

impl Drop for EventSubscription {
    fn drop(&mut self) {
        if let Ok(mut subscribers) = self.hub.subscribers.lock() {
            subscribers.senders.remove(&self.id);
        }
    }
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
    events: Arc<EventHub>,
) {
    let state = Arc::new(ControlState {
        cwd: Mutex::new(backend.document_root.clone()),
        backend,
        shutdown: Arc::clone(&shutdown),
        active_streams: Mutex::new(HashMap::new()),
        events,
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
    stream.set_nonblocking(false).map_err(|error| {
        CliError::new(format!(
            "Failed to configure native control connection for blocking I/O: {error}"
        ))
    })?;
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
    if request.method == "POST" && request.path == "/rpc/stream" {
        return handle_stream_request(&mut stream, &request.body, state);
    }
    if request.method == "POST" && request.path == "/rpc/cancel" {
        return handle_cancel_request(&mut stream, &request.body, state);
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

enum StreamMessage {
    Event(ControlStreamEvent),
    Finished(Result<ControlStreamResponse>),
}

fn handle_stream_request(stream: &mut TcpStream, body: &[u8], state: &ControlState) -> Result<()> {
    let request = match serde_json::from_slice::<RpcRequest>(body) {
        Ok(request) => request,
        Err(error) => {
            return write_single_stream_error(
                stream,
                Value::Null,
                "ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST",
                &format!("Invalid streaming request: {error}"),
            )
        }
    };
    let id = request.id.clone();
    let stream_id = match validate_stream_envelope(&request) {
        Ok(id) => id,
        Err(error) => {
            return write_single_stream_error(stream, id, error.code, &error.message);
        }
    };
    let params: RequestParams = match parse_params(request.params) {
        Ok(params) => params,
        Err(error) => {
            return write_single_stream_error(stream, id, error.code, &error.message);
        }
    };
    let path = match request_path(&params.path, &state.backend.server_url) {
        Ok(path) => path,
        Err(error) => {
            return write_single_stream_error(stream, id, error.code, &error.message);
        }
    };
    let body = match decode_optional_bytes(params.body) {
        Ok(body) => body,
        Err(error) => {
            return write_single_stream_error(stream, id, error.code, &error.message);
        }
    };
    let cancellation = Arc::new(AtomicBool::new(false));
    {
        let mut active = state
            .active_streams
            .lock()
            .map_err(|_| CliError::new("Native stream registry lock was poisoned"))?;
        if active.contains_key(&stream_id) {
            return write_single_stream_error(
                stream,
                id,
                "ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST",
                "A stream with this request ID is already active",
            );
        }
        active.insert(stream_id, Arc::clone(&cancellation));
    }

    let result = run_stream_request(
        stream,
        id,
        ControlHttpRequest {
            method: params.method,
            path,
            headers: header_pairs(params.headers),
            body,
        },
        Arc::clone(&cancellation),
        Arc::clone(&state.backend.stream),
        Arc::clone(&state.events),
    );
    cancellation.store(true, Ordering::Release);
    state
        .active_streams
        .lock()
        .map_err(|_| CliError::new("Native stream registry lock was poisoned"))?
        .remove(&stream_id);
    result
}

fn validate_stream_envelope(request: &RpcRequest) -> std::result::Result<u64, RpcError> {
    if request.protocol_version != CONTROL_PROTOCOL_VERSION {
        return Err(RpcError::invalid(format!(
            "Unsupported control protocol version {}; expected {CONTROL_PROTOCOL_VERSION}",
            request.protocol_version
        )));
    }
    if request.method != "requestStreamed" {
        return Err(RpcError::unsupported(&request.method));
    }
    request
        .id
        .as_u64()
        .ok_or_else(|| RpcError::invalid("Streaming request IDs must be unsigned integers"))
}

fn run_stream_request(
    stream: &mut TcpStream,
    id: Value,
    request: ControlHttpRequest,
    cancellation: Arc<AtomicBool>,
    handler: StreamHandler,
    events: Arc<EventHub>,
) -> Result<()> {
    write_stream_http_head(stream)?;
    let mut disconnect_stream = stream.try_clone().map_err(|error| {
        CliError::new(format!(
            "Failed to monitor the native stream connection: {error}"
        ))
    })?;
    disconnect_stream
        .set_read_timeout(Some(Duration::from_millis(100)))
        .map_err(|error| {
            CliError::new(format!(
                "Failed to configure native stream disconnect monitoring: {error}"
            ))
        })?;
    let disconnect_unblock = disconnect_stream.try_clone().map_err(|error| {
        CliError::new(format!(
            "Failed to prepare native stream disconnect cancellation: {error}"
        ))
    })?;
    let disconnect_watcher_shutdown = Arc::new(AtomicBool::new(false));
    let watcher_shutdown = Arc::clone(&disconnect_watcher_shutdown);
    let watcher_cancellation = Arc::clone(&cancellation);
    let disconnect_watcher = thread::Builder::new()
        .name("wp-playground-control-disconnect".to_string())
        .spawn(move || {
            let mut unexpected = [0u8; 1];
            loop {
                match disconnect_stream.read(&mut unexpected) {
                    // EOF only closes the peer's request-writing half. HTTP
                    // clients may legally half-close after sending the full
                    // Content-Length while continuing to read our response.
                    // Explicit /rpc/cancel requests cover supported-client
                    // cancellation, while later response writes detect readers
                    // which have closed their half of the connection.
                    Ok(0) => return,
                    Ok(_) => {
                        if !watcher_shutdown.load(Ordering::Acquire) {
                            watcher_cancellation.store(true, Ordering::Release);
                        }
                        return;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(error)
                        if matches!(
                            error.kind(),
                            std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                        ) =>
                    {
                        if watcher_shutdown.load(Ordering::Acquire) {
                            return;
                        }
                    }
                    Err(_) => {
                        if !watcher_shutdown.load(Ordering::Acquire) {
                            watcher_cancellation.store(true, Ordering::Release);
                        }
                        return;
                    }
                }
            }
        })
        .map_err(|error| {
            CliError::new(format!(
                "Failed to start native stream disconnect monitor: {error}"
            ))
        })?;
    let (sender, receiver) = sync_channel::<StreamMessage>(STREAM_QUEUE_CAPACITY);
    let emitter_sender = sender.clone();
    let emitter: ControlStreamEmitter =
        Arc::new(move |event| send_bounded_stream_event(&emitter_sender, event));
    let task_cancellation = Arc::clone(&cancellation);
    let task = thread::Builder::new()
        .name("wp-playground-control-stream".to_string())
        .spawn(move || {
            let result = handler(request, emitter, task_cancellation);
            let _ = sender.send(StreamMessage::Finished(result));
        });
    let task = match task {
        Ok(task) => task,
        Err(error) => {
            disconnect_watcher_shutdown.store(true, Ordering::Release);
            let _ = disconnect_unblock.shutdown(Shutdown::Read);
            let _ = disconnect_watcher.join();
            return Err(CliError::new(format!(
                "Failed to start native stream task: {error}"
            )));
        }
    };

    let mut headers_sent = false;
    let mut sequence = 0u64;
    let mut write_error = None;
    let mut terminal_published = false;
    while let Ok(message) = receiver.recv() {
        let frame = match message {
            StreamMessage::Event(ControlStreamEvent::Headers { status, headers }) => {
                if headers_sent {
                    cancellation.store(true, Ordering::Release);
                    stream_error_frame(
                        &id,
                        "ERR_WP_PLAYGROUND_NATIVE_PROTOCOL",
                        "The native stream emitted more than one headers frame",
                    )
                } else {
                    headers_sent = true;
                    json!({
                        "protocolVersion": CONTROL_PROTOCOL_VERSION,
                        "id": id,
                        "type": "headers",
                        "httpStatusCode": status,
                        "headers": headers.into_iter().map(|(name, value)| HeaderPair { name, value }).collect::<Vec<_>>(),
                    })
                }
            }
            StreamMessage::Event(ControlStreamEvent::Output { channel, bytes }) => {
                if !headers_sent {
                    cancellation.store(true, Ordering::Release);
                    stream_error_frame(
                        &id,
                        "ERR_WP_PLAYGROUND_NATIVE_PROTOCOL",
                        "The native stream emitted output before headers",
                    )
                } else {
                    let frame_type = match channel {
                        ControlStreamChannel::Stdout => "stdout",
                        ControlStreamChannel::Stderr => "stderr",
                    };
                    let frame = json!({
                        "protocolVersion": CONTROL_PROTOCOL_VERSION,
                        "id": id,
                        "type": frame_type,
                        "sequence": sequence,
                        "data": TaggedBytes::from_bytes(&bytes),
                    });
                    sequence = sequence.saturating_add(1);
                    frame
                }
            }
            StreamMessage::Finished(Ok(response)) if headers_sent => json!({
                "protocolVersion": CONTROL_PROTOCOL_VERSION,
                "id": id,
                "type": "complete",
                "exitCode": response.exit_code,
            }),
            StreamMessage::Finished(Ok(_)) => stream_error_frame(
                &id,
                "ERR_WP_PLAYGROUND_NATIVE_PROTOCOL",
                "The native stream completed without headers",
            ),
            StreamMessage::Finished(Err(error)) => {
                let (code, message) = if cancellation.load(Ordering::Acquire) {
                    (
                        "ERR_WP_PLAYGROUND_NATIVE_ABORTED",
                        "The native stream was cancelled".to_string(),
                    )
                } else {
                    ("ERR_WP_PLAYGROUND_NATIVE_RUNTIME", error.to_string())
                };
                stream_error_frame(&id, code, &message)
            }
        };
        if matches!(
            frame.get("type").and_then(Value::as_str),
            Some("complete" | "error")
        ) {
            publish_stream_terminal(&events, &id, &frame);
            terminal_published = true;
        }
        if let Err(error) = write_ndjson_frame(stream, &frame) {
            cancellation.store(true, Ordering::Release);
            write_error = Some(error);
            break;
        }
        if matches!(
            frame.get("type").and_then(Value::as_str),
            Some("complete" | "error")
        ) {
            break;
        }
    }
    drop(receiver);
    disconnect_watcher_shutdown.store(true, Ordering::Release);
    let _ = disconnect_unblock.shutdown(Shutdown::Read);
    let _ = disconnect_watcher.join();
    if task.join().is_err() {
        if !terminal_published {
            publish_request_error(
                &events,
                &id,
                "ERR_WP_PLAYGROUND_NATIVE_RUNTIME",
                "Native stream task panicked",
                "php-wasm",
            );
        }
        if write_error.is_none() {
            return Err(CliError::new("Native stream task panicked"));
        }
    } else if write_error.is_some() && !terminal_published {
        publish_request_error(
            &events,
            &id,
            "ERR_WP_PLAYGROUND_NATIVE_ABORTED",
            "The native stream consumer disconnected",
            "request",
        );
    }
    match write_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

fn send_bounded_stream_event(
    sender: &SyncSender<StreamMessage>,
    event: ControlStreamEvent,
) -> Result<()> {
    match event {
        ControlStreamEvent::Output { channel, bytes } => {
            for chunk in bytes.chunks(MAX_STREAM_FRAME_BYTES) {
                sender
                    .send(StreamMessage::Event(ControlStreamEvent::Output {
                        channel,
                        bytes: chunk.to_vec(),
                    }))
                    .map_err(|_| CliError::new("Native stream consumer disconnected"))?;
            }
        }
        ControlStreamEvent::Headers { status, headers } => {
            if headers.len() > MAX_STREAM_HEADER_COUNT {
                return Err(CliError::new(format!(
                    "Native stream response has more than {MAX_STREAM_HEADER_COUNT} headers"
                )));
            }
            let encoded_headers = headers
                .iter()
                .map(|(name, value)| HeaderPair {
                    name: name.clone(),
                    value: value.clone(),
                })
                .collect::<Vec<_>>();
            let encoded_size = serde_json::to_vec(&encoded_headers)
                .map_err(|error| CliError::new(format!("Failed to size stream headers: {error}")))?
                .len();
            if encoded_size > MAX_STREAM_HEADER_BYTES {
                return Err(CliError::new(format!(
                    "Native stream response headers exceed {} KiB",
                    MAX_STREAM_HEADER_BYTES / 1024
                )));
            }
            sender
                .send(StreamMessage::Event(ControlStreamEvent::Headers {
                    status,
                    headers,
                }))
                .map_err(|_| CliError::new("Native stream consumer disconnected"))?;
        }
    }
    Ok(())
}

fn handle_cancel_request(stream: &mut TcpStream, body: &[u8], state: &ControlState) -> Result<()> {
    let parsed = serde_json::from_slice::<CancelRequest>(body);
    let (id, result) = match parsed {
        Ok(request) if request.protocol_version == CONTROL_PROTOCOL_VERSION => {
            let id = request.id;
            let result = match id.as_u64() {
                Some(stream_id) => {
                    let cancellation = state
                        .active_streams
                        .lock()
                        .map_err(|_| CliError::new("Native stream registry lock was poisoned"))?
                        .get(&stream_id)
                        .cloned();
                    if let Some(cancellation) = cancellation {
                        cancellation.store(true, Ordering::Release);
                        Ok(json!({"cancelled": true}))
                    } else {
                        Ok(json!({"cancelled": false}))
                    }
                }
                None => Err(RpcError::invalid(
                    "Streaming request IDs must be unsigned integers",
                )),
            };
            (id, result)
        }
        Ok(request) => (
            request.id,
            Err(RpcError::invalid(format!(
                "Unsupported control protocol version {}; expected {CONTROL_PROTOCOL_VERSION}",
                request.protocol_version
            ))),
        ),
        Err(error) => (
            Value::Null,
            Err(RpcError::invalid(format!(
                "Invalid cancellation request: {error}"
            ))),
        ),
    };
    let response = match result {
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
    };
    let body = serde_json::to_vec(&response)
        .map_err(|error| CliError::new(format!("Failed to serialize cancel response: {error}")))?;
    write_control_http_response(stream, 200, "application/json", &body)
}

fn write_single_stream_error(
    stream: &mut TcpStream,
    id: Value,
    code: &'static str,
    message: &str,
) -> Result<()> {
    write_stream_http_head(stream)?;
    write_ndjson_frame(stream, &stream_error_frame(&id, code, message))
}

fn write_stream_http_head(stream: &mut TcpStream) -> Result<()> {
    stream.write_all(
        b"HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
    )?;
    stream.flush()?;
    Ok(())
}

fn write_ndjson_frame(stream: &mut TcpStream, frame: &Value) -> Result<()> {
    serde_json::to_writer(&mut *stream, frame)
        .map_err(|error| CliError::new(format!("Failed to serialize stream frame: {error}")))?;
    stream.write_all(b"\n")?;
    stream.flush()?;
    Ok(())
}

fn stream_error_frame(id: &Value, code: &'static str, message: &str) -> Value {
    json!({
        "protocolVersion": CONTROL_PROTOCOL_VERSION,
        "id": id,
        "type": "error",
        "error": {"code": code, "message": message},
    })
}

fn publish_stream_terminal(events: &EventHub, id: &Value, frame: &Value) {
    match frame.get("type").and_then(Value::as_str) {
        Some("complete") => publish_request_end(events, id),
        Some("error") => {
            let error = frame.get("error").unwrap_or(&Value::Null);
            publish_request_error(
                events,
                id,
                error
                    .get("code")
                    .and_then(Value::as_str)
                    .unwrap_or("ERR_WP_PLAYGROUND_NATIVE_RUNTIME"),
                error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("Native stream failed"),
                "php-wasm",
            );
        }
        _ => {}
    }
}

fn publish_request_end(events: &EventHub, id: &Value) {
    events.publish(ControlEvent {
        name: "request.end",
        data: json!({
            "protocolVersion": CONTROL_PROTOCOL_VERSION,
            "requestId": id,
        }),
    });
}

fn publish_request_error(
    events: &EventHub,
    id: &Value,
    code: &str,
    message: &str,
    source: &'static str,
) {
    events.publish(ControlEvent {
        name: "request.error",
        data: json!({
            "protocolVersion": CONTROL_PROTOCOL_VERSION,
            "requestId": id,
            "source": source,
            "error": {"code": code, "message": message},
        }),
    });
}

fn publish_shutdown(events: &EventHub) {
    events.publish(ControlEvent {
        name: "shutdown",
        data: json!({"protocolVersion": CONTROL_PROTOCOL_VERSION}),
    });
}

fn dispatch_rpc(request: RpcRequest, state: &ControlState) -> RpcResponse {
    let id = request.id;
    let method = request.method;
    let result = if request.protocol_version != CONTROL_PROTOCOL_VERSION {
        Err(RpcError::invalid(format!(
            "Unsupported control protocol version {}; expected {CONTROL_PROTOCOL_VERSION}",
            request.protocol_version
        )))
    } else {
        dispatch_method(&method, request.params, state)
    };
    if method == "request" {
        match &result {
            Ok(_) => publish_request_end(&state.events, &id),
            Err(error) => {
                publish_request_error(&state.events, &id, error.code, &error.message, "request")
            }
        }
    }
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
    let filesystem_event = filesystem_write_event(method, &params);
    let result = match method {
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
            publish_shutdown(&state.events);
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
    };
    if result.is_ok() {
        if let Some((method, path)) = filesystem_event {
            state.events.publish(ControlEvent {
                name: "filesystem.write",
                data: json!({
                    "protocolVersion": CONTROL_PROTOCOL_VERSION,
                    "method": method,
                    "path": path,
                }),
            });
        }
    }
    result
}

fn filesystem_write_event(method: &str, params: &Value) -> Option<(String, String)> {
    let path = match method {
        "mkdir" | "mkdirTree" | "writeFile" | "unlink" | "rmdir" => params.get("path"),
        "mv" => params.get("toPath"),
        _ => None,
    }?
    .as_str()?;
    Some((method.to_string(), path.to_string()))
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
        "exitCode": response.exit_code,
        "httpStatusCode": response.status,
        "headers": response.headers.into_iter().map(|(name, value)| HeaderPair { name, value }).collect::<Vec<_>>(),
        "body": TaggedBytes::from_bytes(&response.body),
        "stderr": TaggedBytes::from_bytes(&response.stderr),
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
        Ok(Value::String(String::from_utf8_lossy(&bytes).into_owned()))
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
    let params: RmdirParams = parse_params(params)?;
    let path = resolve_vfs_path(&params.path, state)?;
    let host = (state.backend.resolve_path)(&path).map_err(RpcError::io)?;
    if params.options.recursive {
        fs::remove_dir_all(host).map_err(RpcError::io)?;
    } else {
        fs::remove_dir(host).map_err(RpcError::io)?;
    }
    move_cwd_out_of_removed_tree(state, &path)?;
    Ok(Value::Null)
}

fn move_cwd_out_of_removed_tree(
    state: &ControlState,
    removed_path: &str,
) -> std::result::Result<(), RpcError> {
    let mut cwd = state
        .cwd
        .lock()
        .map_err(|_| RpcError::runtime("Control cwd lock was poisoned"))?;
    let is_inside = *cwd == removed_path
        || cwd
            .strip_prefix(removed_path)
            .is_some_and(|suffix| suffix.starts_with('/'));
    if is_inside {
        *cwd = removed_path
            .rsplit_once('/')
            .map(|(parent, _)| if parent.is_empty() { "/" } else { parent })
            .unwrap_or("/")
            .to_string();
    }
    Ok(())
}

fn dispatch_list_files(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    let params: ListFilesParams = parse_params(params)?;
    let prepend_path = params.path.trim_end_matches('/').to_string();
    let path = resolve_vfs_path(&params.path, state)?;
    let host = (state.backend.resolve_path)(&path).map_err(RpcError::io)?;
    let entries = match fs::read_dir(host) {
        Ok(entries) => entries,
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::NotADirectory
            ) =>
        {
            return Ok(json!([]));
        }
        Err(error) => return Err(RpcError::io(error)),
    };
    let mut names = entries
        .map(|entry| {
            entry
                .map_err(RpcError::io)
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
        })
        .collect::<std::result::Result<Vec<_>, _>>()?;
    names.sort();
    if params.options.prepend_path {
        names = names
            .into_iter()
            .map(|name| format!("{prepend_path}/{name}"))
            .collect();
    }
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
        Value::Null => PhpConstantValue::Null,
        _ => {
            return Err(RpcError::invalid(
                "PHP constants must be strings, booleans, numbers, or null",
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
    let (path, suffix) = split_url_suffix(&params.path);
    let path = normalize_vfs_path(path).map_err(|error| RpcError::invalid(error.to_string()))?;
    Ok(Value::String(format!(
        "{}{path}{suffix}",
        state.backend.server_url.trim_end_matches('/'),
    )))
}

fn dispatch_url_to_path(
    params: Value,
    state: &ControlState,
) -> std::result::Result<Value, RpcError> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct UrlParams {
        url: String,
    }
    let params: UrlParams = parse_params(params)?;
    let relative = request_path(&params.url, &state.backend.server_url)?;
    let (path, suffix) = split_url_suffix(&relative);
    normalize_vfs_path(path)
        .map(|path| Value::String(format!("{path}{suffix}")))
        .map_err(|error| RpcError::invalid(error.to_string()))
}

fn split_url_suffix(value: &str) -> (&str, &str) {
    let suffix = value
        .char_indices()
        .find(|(_, character)| matches!(character, '?' | '#'))
        .map(|(index, _)| index)
        .unwrap_or(value.len());
    value.split_at(suffix)
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

fn default_true() -> bool {
    true
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
    let subscription = state.events.subscribe()?;
    write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
    )?;
    write_sse_event(
        stream,
        "ready",
        &json!({"protocolVersion": CONTROL_PROTOCOL_VERSION}),
    )?;
    loop {
        match subscription.receiver.recv_timeout(Duration::from_secs(10)) {
            Ok(event) => {
                if write_sse_event(stream, event.name, &event.data).is_err() {
                    return Ok(());
                }
                if event.name == "shutdown" {
                    return Ok(());
                }
            }
            Err(RecvTimeoutError::Timeout) => {
                if state.shutdown.load(Ordering::Acquire) {
                    break;
                }
                if stream.write_all(b": keepalive\n\n").is_err() || stream.flush().is_err() {
                    return Ok(());
                }
            }
            Err(RecvTimeoutError::Disconnected) => return Ok(()),
        }
    }
    let _ = write_sse_event(
        stream,
        "shutdown",
        &json!({"protocolVersion": CONTROL_PROTOCOL_VERSION}),
    );
    Ok(())
}

fn write_sse_event(stream: &mut impl Write, name: &str, data: &Value) -> Result<()> {
    if name.is_empty()
        || !name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
    {
        return Err(CliError::new("Invalid native control event name"));
    }
    let data = serde_json::to_string(data)
        .map_err(|error| CliError::new(format!("Failed to serialize control event: {error}")))?;
    write!(stream, "event: {name}\ndata: {data}\n\n")?;
    stream.flush()?;
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
    use std::{collections::BTreeMap, io::Cursor, sync::mpsc, time::Instant};

    fn backend(root: PathBuf) -> ControlBackend {
        let root_for_resolver = root.clone();
        ControlBackend {
            server_url: "http://127.0.0.1:9400".to_string(),
            native_server_url: "http://127.0.0.1:9401".to_string(),
            worker_count: 3,
            document_root: "/wordpress".to_string(),
            request: Arc::new(|request| {
                Ok(ControlHttpResponse {
                    exit_code: 0,
                    status: 200,
                    headers: vec![("X-Method".to_string(), request.method)],
                    body: request.body,
                    stderr: Vec::new(),
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
            stream: Arc::new(|request, emitter, _| {
                emitter(ControlStreamEvent::Headers {
                    status: 200,
                    headers: vec![("X-Method".to_string(), request.method)],
                })?;
                if !request.body.is_empty() {
                    emitter(ControlStreamEvent::Output {
                        channel: ControlStreamChannel::Stdout,
                        bytes: request.body,
                    })?;
                }
                Ok(ControlStreamResponse { exit_code: 0 })
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
            active_streams: Mutex::new(HashMap::new()),
            events: Arc::new(EventHub::default()),
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

    fn control_endpoint_request(
        control_url: &str,
        endpoint_path: &str,
        token: Option<&str>,
        body: &str,
    ) -> String {
        let endpoint = control_url.strip_prefix("http://").unwrap();
        let (address, _) = endpoint.split_once('/').unwrap();
        raw_http_request(
            address,
            &format!(
                "POST {endpoint_path} HTTP/1.1\r\nHost: {address}\r\n{}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                token
                    .map(|token| format!("Authorization: Bearer {token}\r\n"))
                    .unwrap_or_default(),
                body.len(),
            ),
        )
    }

    fn response_body(response: &str) -> &str {
        response.split_once("\r\n\r\n").unwrap().1
    }

    #[test]
    fn validates_exact_control_token_shape() {
        assert!(validate_control_token(&"a".repeat(64)).is_ok());
        assert!(validate_control_token(&"z".repeat(64)).is_err());
        assert!(validate_control_token(&"a".repeat(63)).is_err());
    }

    #[test]
    fn accepted_nonblocking_connection_is_normalized_before_request_reads() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-blocking-connection-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let mut client = TcpStream::connect(address).unwrap();
        let (server_stream, _) = listener.accept().unwrap();
        server_stream.set_nonblocking(true).unwrap();
        let token = "a".repeat(64);
        let handler_token = token.clone();
        let handler_root = root.clone();
        let handler = thread::spawn(move || {
            handle_control_stream(server_stream, &handler_token, &state(handler_root))
        });

        thread::sleep(Duration::from_millis(25));
        assert!(
            !handler.is_finished(),
            "the control handler treated a temporarily unreadable socket as a disconnect"
        );
        let body = r#"{"protocolVersion":2,"id":54,"method":"request","params":{"path":"/"}}"#;
        write!(
            client,
            "POST /rpc HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        client.flush().unwrap();
        let mut response = String::new();
        client.read_to_string(&mut response).unwrap();
        handler.join().unwrap().unwrap();
        assert!(response.contains("\"id\":54"), "{response}");
        assert!(response.contains("\"result\""), "{response}");
        let _ = fs::remove_dir_all(root);
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
    fn internal_urls_round_trip_site_relative_paths_with_query_and_fragment() {
        let state = state(std::env::temp_dir());
        let url = dispatch_method(
            "pathToInternalUrl",
            json!({"path":"/foo?view=edit#settings"}),
            &state,
        )
        .unwrap();
        assert_eq!(url, json!("http://127.0.0.1:9400/foo?view=edit#settings"));

        let absolute = dispatch_method(
            "internalUrlToPath",
            json!({"url":"http://127.0.0.1:9400/foo?view=edit#settings"}),
            &state,
        )
        .unwrap();
        assert_eq!(absolute, json!("/foo?view=edit#settings"));

        let relative = dispatch_method(
            "internalUrlToPath",
            json!({"url":"/bar?preview=1#content"}),
            &state,
        )
        .unwrap();
        assert_eq!(relative, json!("/bar?preview=1#content"));

        let error = dispatch_method(
            "internalUrlToPath",
            json!({"url":"https://example.com/escape"}),
            &state,
        )
        .unwrap_err();
        assert!(error.message.contains("Playground origin"));

        assert!(
            dispatch_method("pathToInternalUrl", json!({"path":"/../escape"}), &state,).is_err()
        );
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
    fn buffered_request_preserves_php_exit_code_and_binary_stderr() {
        let mut state = state(std::env::temp_dir());
        state.backend.request = Arc::new(|_| {
            Ok(ControlHttpResponse {
                exit_code: 7,
                status: 500,
                headers: vec![("Content-Type".to_string(), "text/plain".to_string())],
                body: b"failed".to_vec(),
                stderr: vec![0, 255, b'e', b'r', b'r'],
            })
        });

        let response = dispatch_method("request", json!({"path":"/failure.php"}), &state).unwrap();
        assert_eq!(response["exitCode"], 7);
        assert_eq!(response["httpStatusCode"], 500);
        assert_eq!(response["stderr"]["encoding"], "base64");
        assert_eq!(
            BASE64
                .decode(response["stderr"]["data"].as_str().unwrap())
                .unwrap(),
            vec![0, 255, b'e', b'r', b'r']
        );
    }

    #[test]
    fn streamed_response_header_metadata_is_bounded_before_enqueue() {
        let (sender, receiver) = sync_channel(1);
        let error = send_bounded_stream_event(
            &sender,
            ControlStreamEvent::Headers {
                status: 200,
                headers: vec![(
                    "X-Oversized".to_string(),
                    "x".repeat(MAX_STREAM_HEADER_BYTES),
                )],
            },
        )
        .unwrap_err();
        assert!(error.to_string().contains("headers exceed 64 KiB"));
        assert!(matches!(
            receiver.try_recv(),
            Err(mpsc::TryRecvError::Empty)
        ));

        let (sender, receiver) = sync_channel(1);
        let error = send_bounded_stream_event(
            &sender,
            ControlStreamEvent::Headers {
                status: 200,
                headers: (0..=MAX_STREAM_HEADER_COUNT)
                    .map(|index| (format!("X-{index}"), "x".to_string()))
                    .collect(),
            },
        )
        .unwrap_err();
        assert!(error.to_string().contains("more than 1024 headers"));
        assert!(matches!(
            receiver.try_recv(),
            Err(mpsc::TryRecvError::Empty)
        ));
    }

    #[test]
    fn filesystem_option_shapes_and_null_constants_match_the_worker_contract() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-shapes-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("nested/child")).unwrap();
        fs::write(root.join("nested/a.txt"), b"a").unwrap();
        fs::write(root.join("nested/b.txt"), b"b").unwrap();
        let mut state = state(root.clone());
        let constants = Arc::new(Mutex::new(Vec::new()));
        let captured_constants = Arc::clone(&constants);
        state.backend.define_constant = Arc::new(move |name, value| {
            captured_constants.lock().unwrap().push((name, value));
            Ok(())
        });

        let plain = dispatch_method(
            "listFiles",
            json!({"path":"nested","options":{"prependPath":false}}),
            &state,
        )
        .unwrap();
        assert_eq!(plain, json!(["a.txt", "b.txt", "child"]));
        let prepended = dispatch_method(
            "listFiles",
            json!({"path":"nested","options":{"prependPath":true}}),
            &state,
        )
        .unwrap();
        assert_eq!(
            prepended,
            json!(["nested/a.txt", "nested/b.txt", "nested/child"])
        );
        let absolute_prepended = dispatch_method(
            "listFiles",
            json!({"path":"/wordpress/nested/","options":{"prependPath":true}}),
            &state,
        )
        .unwrap();
        assert_eq!(
            absolute_prepended,
            json!([
                "/wordpress/nested/a.txt",
                "/wordpress/nested/b.txt",
                "/wordpress/nested/child"
            ])
        );
        assert!(dispatch_method(
            "listFiles",
            json!({"path":"nested","options":{"unexpected":true}}),
            &state,
        )
        .is_err());

        assert_eq!(
            dispatch_method("listFiles", json!({"path":"missing"}), &state).unwrap(),
            json!([])
        );
        assert_eq!(
            dispatch_method("listFiles", json!({"path":"nested/a.txt"}), &state).unwrap(),
            json!([])
        );
        fs::write(root.join("invalid.txt"), [b'a', 0xff, b'b']).unwrap();
        assert_eq!(
            dispatch_method("readFileAsText", json!({"path":"invalid.txt"}), &state).unwrap(),
            json!("a\u{fffd}b")
        );

        dispatch_method("chdir", json!({"path":"nested/child"}), &state).unwrap();

        dispatch_method("rmdir", json!({"path":"/wordpress/nested"}), &state).unwrap();
        assert!(!root.join("nested").exists());
        assert_eq!(
            dispatch_method("cwd", json!({}), &state).unwrap(),
            json!("/wordpress")
        );
        assert!(dispatch_method(
            "rmdir",
            json!({"path":"missing","options":{"recursive":false,"unexpected":true}}),
            &state,
        )
        .is_err());

        dispatch_method(
            "defineConstant",
            json!({"name":"NULL_VALUE","value":null}),
            &state,
        )
        .unwrap();
        assert_eq!(
            constants.lock().unwrap().as_slice(),
            &[("NULL_VALUE".to_string(), PhpConstantValue::Null)]
        );
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
                protocol_version: CONTROL_PROTOCOL_VERSION,
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
        assert_eq!(value["protocolVersion"], CONTROL_PROTOCOL_VERSION);
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
            r#"{"protocolVersion":2,"id":1,"method":"server.info","params":{}}"#,
        );
        assert!(unauthorized.starts_with("HTTP/1.1 401"));

        let authorized = rpc_http_request(
            control_url,
            Some(&token),
            r#"{"protocolVersion":2,"id":2,"method":"server.info","params":{}}"#,
        );
        assert!(authorized.starts_with("HTTP/1.1 200"));
        assert!(authorized.contains("\"nativeServerUrl\":\"http://127.0.0.1:9401\""));

        let disposed = rpc_http_request(
            control_url,
            Some(&token),
            r#"{"protocolVersion":2,"id":3,"method":"dispose","params":{}}"#,
        );
        assert!(disposed.contains("\"disposed\":true"));
        drop(server);
        assert!(!handshake_path.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn streamed_rpc_emits_headers_bounded_output_and_completion_in_order() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-stream-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "c".repeat(64);
        let mut backend = backend(root.clone());
        backend.stream = Arc::new(|_, emitter, _| {
            emitter(ControlStreamEvent::Headers {
                status: 201,
                headers: vec![("X-Stream".to_string(), "yes".to_string())],
            })?;
            emitter(ControlStreamEvent::Output {
                channel: ControlStreamChannel::Stdout,
                bytes: vec![7; MAX_STREAM_FRAME_BYTES + 1],
            })?;
            emitter(ControlStreamEvent::Output {
                channel: ControlStreamChannel::Stderr,
                bytes: b"warning".to_vec(),
            })?;
            Ok(ControlStreamResponse { exit_code: 7 })
        });
        let server = ControlServer::start(
            ControlOptions {
                handshake_path: handshake_path.clone(),
                token: token.clone(),
            },
            backend,
        )
        .unwrap();
        let handshake: Value = serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
        let response = control_endpoint_request(
            handshake["controlUrl"].as_str().unwrap(),
            "/rpc/stream",
            Some(&token),
            r#"{"protocolVersion":2,"id":41,"method":"requestStreamed","params":{"path":"/","method":"POST","body":{"encoding":"base64","data":""}}}"#,
        );
        assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(response.contains("Content-Type: application/x-ndjson\r\n"));
        let frames = response_body(&response)
            .lines()
            .map(|line| serde_json::from_str::<Value>(line).unwrap())
            .collect::<Vec<_>>();
        assert_eq!(frames.len(), 5);
        assert_eq!(frames[0]["type"], "headers");
        assert_eq!(frames[0]["httpStatusCode"], 201);
        assert_eq!(frames[1]["type"], "stdout");
        assert_eq!(frames[1]["sequence"], 0);
        assert_eq!(frames[2]["type"], "stdout");
        assert_eq!(frames[2]["sequence"], 1);
        assert_eq!(frames[3]["type"], "stderr");
        assert_eq!(frames[3]["sequence"], 2);
        assert_eq!(frames[4]["type"], "complete");
        assert_eq!(frames[4]["exitCode"], 7);
        assert_eq!(
            BASE64
                .decode(frames[1]["data"]["data"].as_str().unwrap())
                .unwrap()
                .len(),
            MAX_STREAM_FRAME_BYTES
        );
        assert_eq!(
            BASE64
                .decode(frames[2]["data"]["data"].as_str().unwrap())
                .unwrap(),
            vec![7]
        );
        drop(server);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cancellation_interrupts_an_active_stream_and_duplicate_ids_are_rejected() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-cancel-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "d".repeat(64);
        let (started_sender, started_receiver) = mpsc::channel();
        let mut backend = backend(root.clone());
        backend.stream = Arc::new(move |_, emitter, cancellation| {
            emitter(ControlStreamEvent::Headers {
                status: 200,
                headers: Vec::new(),
            })?;
            let _ = started_sender.send(());
            let deadline = Instant::now() + Duration::from_secs(2);
            while !cancellation.load(Ordering::Acquire) && Instant::now() < deadline {
                thread::sleep(Duration::from_millis(2));
            }
            Err(CliError::new("cancelled by test"))
        });
        let server = ControlServer::start(
            ControlOptions {
                handshake_path: handshake_path.clone(),
                token: token.clone(),
            },
            backend,
        )
        .unwrap();
        let handshake: Value = serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
        let control_url = handshake["controlUrl"].as_str().unwrap().to_string();
        let request_body =
            r#"{"protocolVersion":2,"id":51,"method":"requestStreamed","params":{"path":"/"}}"#;
        let stream_control_url = control_url.clone();
        let stream_token = token.clone();
        let active_stream = thread::spawn(move || {
            control_endpoint_request(
                &stream_control_url,
                "/rpc/stream",
                Some(&stream_token),
                request_body,
            )
        });
        started_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();

        let duplicate =
            control_endpoint_request(&control_url, "/rpc/stream", Some(&token), request_body);
        assert!(duplicate.contains("ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST"));
        assert!(duplicate.contains("already active"));

        let cancelled = control_endpoint_request(
            &control_url,
            "/rpc/cancel",
            Some(&token),
            r#"{"protocolVersion":2,"id":51}"#,
        );
        assert!(cancelled.contains("\"cancelled\":true"));
        let stream_response = active_stream.join().unwrap();
        assert!(stream_response.contains("\"type\":\"headers\""));
        assert!(stream_response.contains("ERR_WP_PLAYGROUND_NATIVE_ABORTED"));

        let already_finished = control_endpoint_request(
            &control_url,
            "/rpc/cancel",
            Some(&token),
            r#"{"protocolVersion":2,"id":51}"#,
        );
        assert!(already_finished.contains("\"cancelled\":false"));
        drop(server);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn disconnecting_a_stream_connection_cancels_execution_without_an_output_write() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-disconnect-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "f".repeat(64);
        let (started_sender, started_receiver) = mpsc::channel();
        let (observed_sender, observed_receiver) = mpsc::channel();
        let mut backend = backend(root.clone());
        backend.stream = Arc::new(move |_, _, cancellation| {
            let _ = started_sender.send(());
            let deadline = Instant::now() + Duration::from_secs(1);
            while !cancellation.load(Ordering::Acquire) && Instant::now() < deadline {
                thread::sleep(Duration::from_millis(2));
            }
            let _ = observed_sender.send(cancellation.load(Ordering::Acquire));
            Err(CliError::new("disconnected by test"))
        });
        let server = ControlServer::start(
            ControlOptions {
                handshake_path: handshake_path.clone(),
                token: token.clone(),
            },
            backend,
        )
        .unwrap();
        let handshake: Value = serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
        let endpoint = handshake["controlUrl"]
            .as_str()
            .unwrap()
            .strip_prefix("http://")
            .unwrap();
        let (address, _) = endpoint.split_once('/').unwrap();
        let body =
            r#"{"protocolVersion":2,"id":52,"method":"requestStreamed","params":{"path":"/"}}"#;
        let mut stream = TcpStream::connect(address).unwrap();
        write!(
            stream,
            "POST /rpc/stream HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        stream.flush().unwrap();
        started_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        drop(stream);
        assert!(observed_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap());
        drop(server);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn request_write_half_close_does_not_cancel_the_stream_response() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-half-close-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "e".repeat(64);
        let mut backend = backend(root.clone());
        backend.stream = Arc::new(move |_, emitter, cancellation| {
            emitter(ControlStreamEvent::Headers {
                status: 200,
                headers: Vec::new(),
            })?;
            thread::sleep(Duration::from_millis(50));
            if cancellation.load(Ordering::Acquire) {
                return Err(CliError::new("a request half-close cancelled the response"));
            }
            emitter(ControlStreamEvent::Output {
                channel: ControlStreamChannel::Stdout,
                bytes: b"still-reading".to_vec(),
            })?;
            Ok(ControlStreamResponse { exit_code: 0 })
        });
        let server = ControlServer::start(
            ControlOptions {
                handshake_path: handshake_path.clone(),
                token: token.clone(),
            },
            backend,
        )
        .unwrap();
        let handshake: Value = serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
        let endpoint = handshake["controlUrl"]
            .as_str()
            .unwrap()
            .strip_prefix("http://")
            .unwrap();
        let (address, _) = endpoint.split_once('/').unwrap();
        let body =
            r#"{"protocolVersion":2,"id":53,"method":"requestStreamed","params":{"path":"/"}}"#;
        let mut stream = TcpStream::connect(address).unwrap();
        write!(
            stream,
            "POST /rpc/stream HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        stream.flush().unwrap();
        stream.shutdown(Shutdown::Write).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        assert!(response.contains("\"type\":\"headers\""), "{response}");
        assert!(response.contains("c3RpbGwtcmVhZGluZw=="), "{response}");
        assert!(response.contains("\"type\":\"complete\""), "{response}");
        assert!(!response.contains("ERR_WP_PLAYGROUND_NATIVE_ABORTED"));
        drop(server);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn stream_endpoints_authenticate_before_dispatch_and_reject_unknown_fields() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-stream-auth-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let handshake_path = root.join("handshake.json");
        let token = "e".repeat(64);
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
        let unauthorized = control_endpoint_request(
            control_url,
            "/rpc/stream",
            None,
            r#"{"protocolVersion":2,"id":61,"method":"requestStreamed","params":{"path":"/"}}"#,
        );
        assert!(unauthorized.starts_with("HTTP/1.1 401 Unauthorized\r\n"));

        let malformed = control_endpoint_request(
            control_url,
            "/rpc/stream",
            Some(&token),
            r#"{"protocolVersion":2,"id":61,"method":"requestStreamed","params":{"path":"/","unexpected":true}}"#,
        );
        assert!(malformed.contains("ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST"));
        assert!(malformed.contains("unknown field"));
        drop(server);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn sse_serialization_escapes_data_and_rejects_event_name_injection() {
        let mut output = Vec::new();
        write_sse_event(
            &mut output,
            "request.error",
            &json!({"message": "first\n\ndata: injected"}),
        )
        .unwrap();
        let output = String::from_utf8(output).unwrap();
        assert!(output.starts_with("event: request.error\ndata: "));
        assert!(output.contains(r#"first\n\ndata: injected"#));
        assert_eq!(
            output
                .lines()
                .filter(|line| line.starts_with("data:"))
                .count(),
            1
        );

        let mut output = Vec::new();
        assert!(write_sse_event(&mut output, "ready\nevent: injected", &json!({})).is_err());
        assert!(output.is_empty());
    }

    #[test]
    fn filesystem_and_request_operations_publish_structured_events() {
        let root = std::env::temp_dir().join(format!(
            "wp-playground-control-event-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let mut state = state(root.clone());
        let subscription = state.events.subscribe().unwrap();

        dispatch_method(
            "writeFile",
            json!({"path":"event.txt","data":{"encoding":"base64","data":"eWVz"}}),
            &state,
        )
        .unwrap();
        let event = subscription
            .receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        assert_eq!(event.name, "filesystem.write");
        assert_eq!(event.data["protocolVersion"], CONTROL_PROTOCOL_VERSION);
        assert_eq!(event.data["method"], "writeFile");
        assert_eq!(event.data["path"], "event.txt");

        let response = dispatch_rpc(
            RpcRequest {
                protocol_version: CONTROL_PROTOCOL_VERSION,
                id: json!(71),
                method: "request".to_string(),
                params: json!({"path":"/","body":{"encoding":"base64","data":""}}),
            },
            &state,
        );
        assert!(response.error.is_none());
        let event = subscription
            .receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        assert_eq!(event.name, "request.end");
        assert_eq!(event.data["requestId"], 71);

        state.backend.request = Arc::new(|_| Err(CliError::new("test PHP failure")));
        let response = dispatch_rpc(
            RpcRequest {
                protocol_version: CONTROL_PROTOCOL_VERSION,
                id: json!(72),
                method: "request".to_string(),
                params: json!({"path":"/"}),
            },
            &state,
        );
        assert_eq!(
            response.error.unwrap().code,
            "ERR_WP_PLAYGROUND_NATIVE_RUNTIME"
        );
        let event = subscription
            .receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap();
        assert_eq!(event.name, "request.error");
        assert_eq!(event.data["requestId"], 72);
        assert_eq!(event.data["source"], "request");
        assert_eq!(
            event.data["error"]["code"],
            "ERR_WP_PLAYGROUND_NATIVE_RUNTIME"
        );
        let _ = fs::remove_dir_all(root);
    }
}
