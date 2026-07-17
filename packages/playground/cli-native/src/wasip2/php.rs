use std::{
    io,
    panic::{catch_unwind, resume_unwind, AssertUnwindSafe},
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    task::{Context, Poll},
    thread,
    time::Duration,
};

use tokio::io::AsyncWrite;
use wasmtime::component::{Component, HasSelf, Linker};
use wasmtime::{Store, UpdateDeadline};
use wasmtime_wasi::cli::{IsTerminal, StdoutStream};
use wasmtime_wasi_io::{
    bytes::Bytes,
    poll::Pollable,
    streams::{OutputStream, StreamError},
};

use super::{Wasip2ComponentRuntime, Wasip2HostState};

mod bindings {
    wasmtime::component::bindgen!({
        path: "wit/php/php.wit",
        world: "php",
        imports: { default: trappable },
        ownership: Borrowing {
            duplicate_if_necessary: false
        },
        require_store_data_send: true,
    });
}

use crate::php_protocol::PhpRequest;
use bindings::exports::wordpress::php_wasi::{cli, handler};
use bindings::wordpress::php_wasi::output;

pub const PHP_STREAM_FRAME_BYTES: usize = 64 * 1024;
const PHP_PRE_HEADER_FRAME_LIMIT: usize = 8;
const INACTIVE_EPOCH_DEADLINE: u64 = 1 << 63;
const CANCELLATION_POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Wasip2PhpOutputChannel {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Wasip2PhpStreamEvent {
    Headers {
        http_status: u16,
        headers: Vec<String>,
    },
    Output {
        channel: Wasip2PhpOutputChannel,
        bytes: Vec<u8>,
    },
}

pub type Wasip2PhpStreamSink =
    Arc<dyn Fn(Wasip2PhpStreamEvent) -> wasmtime::Result<()> + Send + Sync>;

#[derive(Debug)]
struct PendingStreamOutput {
    channel: Wasip2PhpOutputChannel,
    bytes: Vec<u8>,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Wasip2PhpOutput {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

impl Wasip2PhpOutput {
    pub fn stdout(&self) -> &[u8] {
        &self.stdout
    }

    pub fn stderr(&self) -> &[u8] {
        &self.stderr
    }

    pub fn into_parts(self) -> (Vec<u8>, Vec<u8>) {
        (self.stdout, self.stderr)
    }
}

#[derive(Default)]
pub(crate) struct PhpOutputCapture {
    output: Wasip2PhpOutput,
    stream_sink: Option<Wasip2PhpStreamSink>,
    cancellation: Option<Arc<AtomicBool>>,
    stream_headers_sent: bool,
    pending_before_headers: Vec<PendingStreamOutput>,
}

#[derive(Clone)]
pub(crate) struct PhpWasiOutputStream {
    capture: Arc<Mutex<PhpOutputCapture>>,
    channel: Wasip2PhpOutputChannel,
}

impl PhpWasiOutputStream {
    pub(crate) fn new(
        capture: Arc<Mutex<PhpOutputCapture>>,
        channel: Wasip2PhpOutputChannel,
    ) -> Self {
        Self { capture, channel }
    }

    fn write_bytes(&self, bytes: Vec<u8>) -> wasmtime::Result<()> {
        self.capture
            .lock()
            .map_err(|_| wasmtime::Error::msg("native PHP output lock was poisoned"))?
            .write_channel(self.channel, bytes)
    }
}

impl IsTerminal for PhpWasiOutputStream {
    fn is_terminal(&self) -> bool {
        false
    }
}

impl StdoutStream for PhpWasiOutputStream {
    fn async_stream(&self) -> Box<dyn AsyncWrite + Send + Sync> {
        Box::new(self.clone())
    }

    fn p2_stream(&self) -> Box<dyn OutputStream> {
        Box::new(self.clone())
    }
}

impl AsyncWrite for PhpWasiOutputStream {
    fn poll_write(
        self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        bytes: &[u8],
    ) -> Poll<io::Result<usize>> {
        let len = bytes.len().min(PHP_STREAM_FRAME_BYTES);
        match self.write_bytes(bytes[..len].to_vec()) {
            Ok(()) => Poll::Ready(Ok(len)),
            Err(error) => Poll::Ready(Err(io::Error::other(error.to_string()))),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
}

#[wasmtime_wasi_io::async_trait]
impl Pollable for PhpWasiOutputStream {
    async fn ready(&mut self) {}
}

#[wasmtime_wasi_io::async_trait]
impl OutputStream for PhpWasiOutputStream {
    fn write(&mut self, bytes: Bytes) -> Result<(), StreamError> {
        self.write_bytes(bytes.to_vec()).map_err(StreamError::Trap)
    }

    fn flush(&mut self) -> Result<(), StreamError> {
        Ok(())
    }

    fn check_write(&mut self) -> Result<usize, StreamError> {
        if self
            .capture
            .lock()
            .map_err(|_| StreamError::trap("native PHP output lock was poisoned"))?
            .is_cancelled()
        {
            return Err(StreamError::trap("native PHP stream was cancelled"));
        }
        Ok(PHP_STREAM_FRAME_BYTES)
    }
}

impl PhpOutputCapture {
    fn reset(&mut self) {
        self.output.stdout.clear();
        self.output.stderr.clear();
    }

    fn start_streaming(&mut self, sink: Wasip2PhpStreamSink, cancellation: Arc<AtomicBool>) {
        self.reset();
        self.stream_sink = Some(sink);
        self.cancellation = Some(cancellation);
        self.stream_headers_sent = false;
        self.pending_before_headers.clear();
    }

    fn stop_streaming(&mut self) {
        self.stream_sink = None;
        self.cancellation = None;
        self.stream_headers_sent = false;
        self.pending_before_headers.clear();
    }

    fn is_cancelled(&self) -> bool {
        self.cancellation
            .as_ref()
            .is_some_and(|cancellation| cancellation.load(Ordering::Acquire))
    }

    fn take(&mut self) -> Wasip2PhpOutput {
        std::mem::take(&mut self.output)
    }

    fn write_owned(
        &mut self,
        destination: output::Channel,
        bytes: Vec<u8>,
    ) -> wasmtime::Result<()> {
        let channel = match destination {
            output::Channel::Stdout => Wasip2PhpOutputChannel::Stdout,
            output::Channel::Stderr => Wasip2PhpOutputChannel::Stderr,
        };
        self.write_channel(channel, bytes)
    }

    fn write_channel(
        &mut self,
        channel: Wasip2PhpOutputChannel,
        bytes: Vec<u8>,
    ) -> wasmtime::Result<()> {
        if self.stream_sink.is_none() {
            let output = match channel {
                Wasip2PhpOutputChannel::Stdout => &mut self.output.stdout,
                Wasip2PhpOutputChannel::Stderr => &mut self.output.stderr,
            };
            if output.is_empty() {
                *output = bytes;
            } else {
                output.extend_from_slice(&bytes);
            }
            return Ok(());
        }
        if self.is_cancelled() {
            return Err(wasmtime::Error::msg("native PHP stream was cancelled"));
        }
        if !self.stream_headers_sent {
            return self.buffer_before_headers(channel, bytes);
        }
        let sink = self
            .stream_sink
            .as_ref()
            .expect("stream sink remains present while streaming")
            .clone();
        for chunk in bytes.chunks(PHP_STREAM_FRAME_BYTES) {
            sink(Wasip2PhpStreamEvent::Output {
                channel,
                bytes: chunk.to_vec(),
            })?;
        }
        Ok(())
    }

    fn buffer_before_headers(
        &mut self,
        channel: Wasip2PhpOutputChannel,
        bytes: Vec<u8>,
    ) -> wasmtime::Result<()> {
        let mut remaining = bytes.as_slice();
        while !remaining.is_empty() {
            if let Some(last) = self.pending_before_headers.last_mut() {
                if last.channel == channel && last.bytes.len() < PHP_STREAM_FRAME_BYTES {
                    let append = remaining
                        .len()
                        .min(PHP_STREAM_FRAME_BYTES - last.bytes.len());
                    last.bytes.extend_from_slice(&remaining[..append]);
                    remaining = &remaining[append..];
                    continue;
                }
            }
            if self.pending_before_headers.len() == PHP_PRE_HEADER_FRAME_LIMIT {
                return Err(wasmtime::Error::msg(format!(
                    "native PHP emitted more than {} KiB before response headers",
                    PHP_PRE_HEADER_FRAME_LIMIT * PHP_STREAM_FRAME_BYTES / 1024
                )));
            }
            let take = remaining.len().min(PHP_STREAM_FRAME_BYTES);
            self.pending_before_headers.push(PendingStreamOutput {
                channel,
                bytes: remaining[..take].to_vec(),
            });
            remaining = &remaining[take..];
        }
        Ok(())
    }

    fn send_headers(&mut self, http_status: u16, headers: Vec<String>) -> wasmtime::Result<()> {
        let Some(sink) = self.stream_sink.clone() else {
            return Err(wasmtime::Error::msg(
                "PHP emitted streamed headers for a buffered request",
            ));
        };
        if self.is_cancelled() {
            return Err(wasmtime::Error::msg("native PHP stream was cancelled"));
        }
        if self.stream_headers_sent {
            return Err(wasmtime::Error::msg(
                "native PHP emitted response headers more than once",
            ));
        }
        sink(Wasip2PhpStreamEvent::Headers {
            http_status,
            headers,
        })?;
        self.stream_headers_sent = true;
        for pending in std::mem::take(&mut self.pending_before_headers) {
            sink(Wasip2PhpStreamEvent::Output {
                channel: pending.channel,
                bytes: pending.bytes,
            })?;
        }
        Ok(())
    }
}

impl output::Host for Wasip2HostState {
    fn headers(&mut self, status: u16, headers: Vec<String>) -> wasmtime::Result<()> {
        self.php_output.send_headers(status, headers)
    }

    fn write(&mut self, destination: output::Channel, bytes: Vec<u8>) -> wasmtime::Result<()> {
        self.php_output.write_owned(destination, bytes)
    }
}

pub(crate) fn add_to_linker(linker: &mut Linker<Wasip2HostState>) -> wasmtime::Result<()> {
    output::add_to_linker::<_, HasSelf<_>>(linker, |state| state)
}

#[derive(Debug, PartialEq, Eq)]
pub struct Wasip2PhpResponse {
    pub exit_status: i32,
    pub http_status: u16,
    pub headers: Vec<String>,
    pub output: Wasip2PhpOutput,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Wasip2PhpCliResponse {
    pub exit_status: i32,
    pub output: Wasip2PhpOutput,
}

pub struct Wasip2PhpInstance {
    store: Store<Wasip2HostState>,
    bindings: bindings::Php,
    interruptible: bool,
}

impl Wasip2PhpInstance {
    pub fn instantiate(component: &Component, state: Wasip2HostState) -> wasmtime::Result<Self> {
        Self::instantiate_with_interruption(component, state, false)
    }

    pub(crate) fn instantiate_interruptible(
        component: &Component,
        state: Wasip2HostState,
    ) -> wasmtime::Result<Self> {
        Self::instantiate_with_interruption(component, state, true)
    }

    fn instantiate_with_interruption(
        component: &Component,
        state: Wasip2HostState,
        interruptible: bool,
    ) -> wasmtime::Result<Self> {
        let runtime = Wasip2ComponentRuntime::from_engine(component.engine().clone())?;
        let mut store = Store::new(runtime.engine(), state);
        if interruptible {
            store.set_epoch_deadline(INACTIVE_EPOCH_DEADLINE);
            store.epoch_deadline_callback(|store| {
                let state = store.data();
                let cancelled = state
                    .active_cancellation
                    .as_ref()
                    .is_some_and(|cancellation| cancellation.load(Ordering::Acquire));
                Ok(if cancelled {
                    UpdateDeadline::Interrupt
                } else {
                    UpdateDeadline::Continue(1)
                })
            });
        }
        let bindings = bindings::Php::instantiate(&mut store, component, runtime.linker())?;
        Ok(Self {
            store,
            bindings,
            interruptible,
        })
    }

    pub fn initialize(&mut self, php_ini_path: &str) -> wasmtime::Result<()> {
        self.reset_output();
        self.bindings
            .wordpress_php_wasi_handler()
            .call_initialize(&mut self.store, php_ini_path)?
            .map_err(wasmtime::Error::msg)
    }

    pub fn handle_request(&mut self, request: &PhpRequest) -> wasmtime::Result<Wasip2PhpResponse> {
        self.handle_request_inner(request, false)
    }

    pub fn handle_request_streamed(
        &mut self,
        request: &PhpRequest,
        sink: Wasip2PhpStreamSink,
        cancellation: Arc<AtomicBool>,
    ) -> wasmtime::Result<Wasip2PhpResponse> {
        if !self.interruptible {
            return Err(wasmtime::Error::msg(
                "streamed PHP execution requires an interruptible component instance",
            ));
        }
        self.store
            .data_mut()
            .php_output
            .start_streaming(sink, Arc::clone(&cancellation));
        self.store.data_mut().active_cancellation = Some(Arc::clone(&cancellation));
        self.store.set_epoch_deadline(1);
        let watcher_finished = Arc::new(AtomicBool::new(false));
        let thread_finished = Arc::clone(&watcher_finished);
        let engine = self.store.engine().clone();
        let watcher = thread::Builder::new()
            .name("wp-playground-stream-cancellation".to_string())
            .spawn(move || loop {
                if cancellation.load(Ordering::Acquire) {
                    engine.increment_epoch();
                    return;
                }
                if thread_finished.load(Ordering::Acquire) {
                    return;
                }
                thread::park_timeout(CANCELLATION_POLL_INTERVAL);
            })
            .map_err(|error| {
                self.store.set_epoch_deadline(INACTIVE_EPOCH_DEADLINE);
                self.store.data_mut().php_output.stop_streaming();
                self.store.data_mut().active_cancellation = None;
                wasmtime::Error::msg(format!(
                    "failed to start native PHP cancellation watcher: {error}"
                ))
            })?;
        with_unwind_safe_cleanup(
            self,
            |instance| instance.handle_request_inner(request, true),
            move |instance| {
                watcher_finished.store(true, Ordering::Release);
                watcher.thread().unpark();
                let watcher_result = watcher.join();
                instance.store.set_epoch_deadline(INACTIVE_EPOCH_DEADLINE);
                instance.store.data_mut().php_output.stop_streaming();
                instance.store.data_mut().active_cancellation = None;
                if watcher_result.is_err() {
                    return Err(wasmtime::Error::msg(
                        "native PHP cancellation watcher panicked",
                    ));
                }
                Ok(())
            },
        )
    }

    pub fn run_cli_streamed(
        &mut self,
        argv: &[String],
        env: &[(String, String)],
        cwd: Option<&str>,
        sink: Wasip2PhpStreamSink,
        cancellation: Arc<AtomicBool>,
    ) -> wasmtime::Result<Wasip2PhpCliResponse> {
        if !self.interruptible {
            return Err(wasmtime::Error::msg(
                "streamed PHP CLI execution requires an interruptible component instance",
            ));
        }
        {
            let mut output = self
                .store
                .data()
                .cli_output
                .lock()
                .map_err(|_| wasmtime::Error::msg("native PHP CLI output lock was poisoned"))?;
            output.start_streaming(sink, Arc::clone(&cancellation));
            output.send_headers(200, Vec::new())?;
        }
        self.store.data_mut().active_cancellation = Some(Arc::clone(&cancellation));
        self.store.set_epoch_deadline(1);
        let watcher_finished = Arc::new(AtomicBool::new(false));
        let thread_finished = Arc::clone(&watcher_finished);
        let engine = self.store.engine().clone();
        let watcher = thread::Builder::new()
            .name("wp-playground-cli-cancellation".to_string())
            .spawn(move || loop {
                if cancellation.load(Ordering::Acquire) {
                    engine.increment_epoch();
                    return;
                }
                if thread_finished.load(Ordering::Acquire) {
                    return;
                }
                thread::park_timeout(CANCELLATION_POLL_INTERVAL);
            })
            .map_err(|error| {
                self.store.set_epoch_deadline(INACTIVE_EPOCH_DEADLINE);
                self.store
                    .data()
                    .cli_output
                    .lock()
                    .expect("native PHP CLI output lock remains usable")
                    .stop_streaming();
                self.store.data_mut().active_cancellation = None;
                wasmtime::Error::msg(format!(
                    "failed to start native PHP CLI cancellation watcher: {error}"
                ))
            })?;
        with_unwind_safe_cleanup(
            self,
            |instance| instance.run_cli_inner(argv, env, cwd),
            move |instance| {
                watcher_finished.store(true, Ordering::Release);
                watcher.thread().unpark();
                let watcher_result = watcher.join();
                instance.store.set_epoch_deadline(INACTIVE_EPOCH_DEADLINE);
                instance
                    .store
                    .data()
                    .cli_output
                    .lock()
                    .map_err(|_| wasmtime::Error::msg("native PHP CLI output lock was poisoned"))?
                    .stop_streaming();
                instance.store.data_mut().active_cancellation = None;
                if watcher_result.is_err() {
                    return Err(wasmtime::Error::msg(
                        "native PHP CLI cancellation watcher panicked",
                    ));
                }
                Ok(())
            },
        )
    }

    fn run_cli_inner(
        &mut self,
        argv: &[String],
        env: &[(String, String)],
        cwd: Option<&str>,
    ) -> wasmtime::Result<Wasip2PhpCliResponse> {
        let argv = argv.iter().map(String::as_str).collect::<Vec<_>>();
        let env = component_cli_entries(env);
        let request = cli::Request {
            argv: &argv,
            env: &env,
            cwd,
        };
        let exit_status = self
            .bindings
            .wordpress_php_wasi_cli()
            .call_run(&mut self.store, request)?
            .map_err(wasmtime::Error::msg)?;
        Ok(Wasip2PhpCliResponse {
            exit_status,
            output: self.take_cli_output()?,
        })
    }

    fn handle_request_inner(
        &mut self,
        request: &PhpRequest,
        stream_response: bool,
    ) -> wasmtime::Result<Wasip2PhpResponse> {
        let server_entries = component_entries(&request.server_entries);
        let env = component_entries(&request.env);
        let request = handler::Request {
            script_path: &request.script_path,
            request_uri: &request.request_uri,
            method: &request.method,
            host: &request.host,
            port: request.port,
            body: &request.body,
            stream_response,
            content_type: request.content_type.as_deref(),
            cookies: request.cookies.as_deref(),
            server_entries: &server_entries,
            env: &env,
        };
        self.reset_output();
        let response = self
            .bindings
            .wordpress_php_wasi_handler()
            .call_handle_request(&mut self.store, request)?
            .map_err(wasmtime::Error::msg)?;
        Ok(Wasip2PhpResponse {
            exit_status: response.exit_status,
            http_status: response.http_status,
            headers: response.headers,
            output: self.take_output(),
        })
    }

    pub fn reset_output(&mut self) {
        self.store.data_mut().php_output.reset();
    }

    pub fn take_output(&mut self) -> Wasip2PhpOutput {
        self.store.data_mut().php_output.take()
    }

    fn take_cli_output(&mut self) -> wasmtime::Result<Wasip2PhpOutput> {
        self.store
            .data()
            .cli_output
            .lock()
            .map_err(|_| wasmtime::Error::msg("native PHP CLI output lock was poisoned"))
            .map(|mut output| output.take())
    }

    pub fn store_mut(&mut self) -> &mut Store<Wasip2HostState> {
        &mut self.store
    }
}

fn with_unwind_safe_cleanup<State, Output>(
    state: &mut State,
    operation: impl FnOnce(&mut State) -> wasmtime::Result<Output>,
    cleanup: impl FnOnce(&mut State) -> wasmtime::Result<()>,
) -> wasmtime::Result<Output> {
    let operation_result = catch_unwind(AssertUnwindSafe(|| operation(state)));
    let cleanup_result = cleanup(state);
    match operation_result {
        Ok(result) => {
            cleanup_result?;
            result
        }
        Err(payload) => {
            let _ = cleanup_result;
            resume_unwind(payload)
        }
    }
}

fn component_entries(entries: &[(String, String)]) -> Vec<handler::Entry<'_>> {
    entries
        .iter()
        .map(|(key, value)| handler::Entry { key, value })
        .collect()
}

fn component_cli_entries(entries: &[(String, String)]) -> Vec<cli::Entry<'_>> {
    entries
        .iter()
        .map(|(key, value)| cli::Entry { key, value })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File, FileTimes, OpenOptions},
        path::PathBuf,
        sync::{
            atomic::{AtomicBool, AtomicU64, Ordering},
            Arc, Mutex,
        },
        time::{Duration, UNIX_EPOCH},
    };

    use super::{
        output, with_unwind_safe_cleanup, PhpOutputCapture, Wasip2PhpInstance,
        Wasip2PhpOutputChannel, Wasip2PhpStreamEvent, Wasip2PhpStreamSink,
        PHP_PRE_HEADER_FRAME_LIMIT, PHP_STREAM_FRAME_BYTES,
    };
    use crate::php_protocol::PhpRequest;
    use crate::wasip2::{CapabilityPreopen, Wasip2ComponentRuntime, Wasip2ContextBuilder};

    static NEXT_TEMP_DIR_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn streamed_request_cleanup_runs_before_resuming_a_host_panic() {
        let mut cleaned = false;
        let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = with_unwind_safe_cleanup(
                &mut cleaned,
                |_| -> wasmtime::Result<()> { panic!("injected streamed request panic") },
                |cleaned| {
                    *cleaned = true;
                    Ok(())
                },
            );
        }));

        assert!(panic.is_err());
        assert!(cleaned);
    }

    #[test]
    fn buffered_output_capture_skips_stream_cancellation_and_preserves_binary_channels() {
        let mut capture = PhpOutputCapture::default();
        assert!(capture.send_headers(200, Vec::new()).is_err());
        let stale_stream_cancellation = Arc::new(AtomicBool::new(true));
        capture.cancellation = Some(stale_stream_cancellation);
        capture
            .write_owned(output::Channel::Stdout, vec![0, 255])
            .unwrap();
        capture
            .write_owned(output::Channel::Stderr, b"warning".to_vec())
            .unwrap();

        let output = capture.take();
        assert_eq!(output.stdout(), &[0, 255]);
        assert_eq!(output.stderr(), b"warning");
        assert_eq!(capture.take(), Default::default());

        capture
            .write_owned(output::Channel::Stderr, b"discard me".to_vec())
            .unwrap();
        capture.reset();
        assert_eq!(capture.take(), Default::default());

        let owned = vec![1, 2, 3, 4];
        let owned_allocation = owned.as_ptr();
        capture.write_owned(output::Channel::Stdout, owned).unwrap();
        assert_eq!(capture.output.stdout.as_ptr(), owned_allocation);
        capture
            .write_owned(output::Channel::Stdout, vec![5, 6])
            .unwrap();
        assert_eq!(capture.take().stdout(), &[1, 2, 3, 4, 5, 6]);
        capture.cancellation = None;
    }

    #[test]
    fn streaming_output_emits_headers_first_bounded_binary_frames_and_cancellation() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink_events = Arc::clone(&events);
        let sink: Wasip2PhpStreamSink = Arc::new(move |event| {
            sink_events.lock().unwrap().push(event);
            Ok(())
        });
        let cancellation = Arc::new(AtomicBool::new(false));
        let mut capture = PhpOutputCapture::default();
        capture.start_streaming(sink, Arc::clone(&cancellation));
        capture
            .send_headers(202, vec!["X-Test: yes".to_string()])
            .unwrap();
        capture
            .write_owned(output::Channel::Stdout, vec![9; PHP_STREAM_FRAME_BYTES + 3])
            .unwrap();
        capture
            .write_owned(output::Channel::Stderr, vec![0, 255])
            .unwrap();

        let events = events.lock().unwrap();
        assert_eq!(
            events[0],
            Wasip2PhpStreamEvent::Headers {
                http_status: 202,
                headers: vec!["X-Test: yes".to_string()],
            }
        );
        assert!(matches!(
            &events[1],
            Wasip2PhpStreamEvent::Output {
                channel: Wasip2PhpOutputChannel::Stdout,
                bytes,
            } if bytes.len() == PHP_STREAM_FRAME_BYTES
        ));
        assert!(matches!(
            &events[2],
            Wasip2PhpStreamEvent::Output {
                channel: Wasip2PhpOutputChannel::Stdout,
                bytes,
            } if bytes == &[9, 9, 9]
        ));
        assert_eq!(
            events[3],
            Wasip2PhpStreamEvent::Output {
                channel: Wasip2PhpOutputChannel::Stderr,
                bytes: vec![0, 255],
            }
        );
        drop(events);

        cancellation.store(true, Ordering::Release);
        assert!(capture
            .write_owned(output::Channel::Stdout, b"late".to_vec())
            .is_err());
        capture.stop_streaming();
    }

    #[test]
    fn streaming_buffers_early_output_until_headers_and_caps_it_at_eight_frames() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink_events = Arc::clone(&events);
        let sink: Wasip2PhpStreamSink = Arc::new(move |event| {
            sink_events.lock().unwrap().push(event);
            Ok(())
        });
        let cancellation = Arc::new(AtomicBool::new(false));
        let mut capture = PhpOutputCapture::default();
        capture.start_streaming(sink, cancellation);
        capture
            .write_owned(output::Channel::Stderr, b"early warning".to_vec())
            .unwrap();
        assert!(events.lock().unwrap().is_empty());
        capture
            .send_headers(500, vec!["Content-Type: text/html".to_string()])
            .unwrap();
        let captured = events.lock().unwrap();
        assert!(matches!(
            &captured[0],
            Wasip2PhpStreamEvent::Headers {
                http_status: 500,
                ..
            }
        ));
        assert_eq!(
            captured[1],
            Wasip2PhpStreamEvent::Output {
                channel: Wasip2PhpOutputChannel::Stderr,
                bytes: b"early warning".to_vec(),
            }
        );
        drop(captured);
        capture.stop_streaming();

        let sink: Wasip2PhpStreamSink = Arc::new(|_| Ok(()));
        capture.start_streaming(sink, Arc::new(AtomicBool::new(false)));
        capture
            .write_owned(
                output::Channel::Stderr,
                vec![b'x'; PHP_PRE_HEADER_FRAME_LIMIT * PHP_STREAM_FRAME_BYTES],
            )
            .unwrap();
        let error = capture
            .write_owned(output::Channel::Stderr, vec![b'y'])
            .unwrap_err();
        assert!(error.to_string().contains("more than 512 KiB"));
        assert_eq!(
            capture.pending_before_headers.len(),
            PHP_PRE_HEADER_FRAME_LIMIT
        );
        capture.stop_streaming();
    }

    #[test]
    fn php_component_wit_matches_the_builder_definition() {
        let repo_root = crate::runtime::repo_root_from_manifest_dir();
        let host_wit =
            fs::read(repo_root.join("packages/playground/cli-native/wit/php/php.wit")).unwrap();
        let build_wit =
            fs::read(repo_root.join("packages/php-wasm/compile/php-wasi/wit/php/php.wit")).unwrap();
        assert_eq!(
            host_wit, build_wit,
            "the PHP component builder and Wasmtime host must bind the same WIT world"
        );
    }

    #[test]
    fn persistent_php_recovers_after_fatal_and_separates_binary_output() {
        let component_path = test_component_path();
        assert!(
            component_path.is_file(),
            "PHP WASIp2 component is missing: {}",
            component_path.display()
        );

        let site_path = temp_dir("persistent-php");
        fs::write(site_path.join("normal.php"), b"<?php echo 'normal';").unwrap();
        fs::write(
            site_path.join("fatal.php"),
            b"<?php undefined_component_function();",
        )
        .unwrap();
        fs::write(
            site_path.join("binary.php"),
            br#"<?php header('X-WP-Binary: yes'); echo "\x00\xffA";"#,
        )
        .unwrap();
        fs::write(
            site_path.join("typed.php"),
            br#"<?php echo $_SERVER['REQUEST_METHOD'], '|', $_GET['q'], '|', file_get_contents('php://input'), '|', $_SERVER['HTTP_X_TYPED'], '|', getenv('TYPED_ENV'), '|', $_COOKIE['session'];"#,
        )
        .unwrap();
        let runtime = Wasip2ComponentRuntime::new().unwrap();
        let component = runtime.load_component(&component_path).unwrap();
        // Match the writable /tmp capability supplied to production workers
        // so direct component tests exercise the same PHP temp-file boundary.
        let tmp_path = temp_dir("persistent-php-tmp");
        let state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&site_path, "/site"))
            .preopen(CapabilityPreopen::read_write(&tmp_path, "/tmp"))
            .build()
            .unwrap();
        let mut php = Wasip2PhpInstance::instantiate(&component, state).unwrap();
        php.initialize("").unwrap();

        let first = php
            .handle_request(&request("/normal.php", "/site/normal.php"))
            .unwrap();
        assert_eq!(first.exit_status, 0);
        assert_eq!(first.output.stdout(), b"normal");

        let fatal = php
            .handle_request(&request("/fatal.php", "/site/fatal.php"))
            .unwrap();
        assert_eq!(fatal.exit_status, 255);

        let recovered = php
            .handle_request(&request("/normal.php", "/site/normal.php"))
            .unwrap();
        assert_eq!(recovered.exit_status, 0);
        assert_eq!(recovered.output.stdout(), b"normal");
        assert!(recovered.output.stderr().is_empty());

        let binary = php
            .handle_request(&request("/binary.php", "/site/binary.php"))
            .unwrap();
        assert_eq!(binary.exit_status, 0);
        assert_eq!(binary.http_status, 200);
        assert_eq!(binary.output.stdout(), &[0, 255, b'A']);
        assert!(binary.output.stderr().is_empty());
        assert!(binary
            .headers
            .iter()
            .any(|header| header == "X-WP-Binary: yes"));
        assert!(binary.headers.iter().all(|header| !header.contains('\0')));

        let mut typed_request = request("/typed.php?q=yes", "/site/typed.php");
        typed_request.method = "POST".to_string();
        typed_request.body = b"body".to_vec();
        typed_request.content_type = Some("text/plain".to_string());
        typed_request.cookies = Some("session=cookie".to_string());
        typed_request.server_entries = vec![("HTTP_X_TYPED".to_string(), "server".to_string())];
        typed_request.env = vec![("TYPED_ENV".to_string(), "environment".to_string())];
        let typed = php.handle_request(&typed_request).unwrap();
        assert_eq!(typed.exit_status, 0);
        assert_eq!(
            typed.output.stdout(),
            b"POST|yes|body|server|environment|cookie"
        );

        drop(php);
        fs::remove_dir_all(site_path).unwrap();
        fs::remove_dir_all(tmp_path).unwrap();
    }

    #[test]
    fn persistent_php_opcache_hits_and_revalidates_modified_scripts() {
        let component_path = test_component_path();
        assert!(
            component_path.is_file(),
            "PHP WASIp2 component is missing: {}",
            component_path.display()
        );

        let site_path = temp_dir("persistent-php-opcache");
        let tmp_path = temp_dir("persistent-php-opcache-tmp");
        fs::write(
            site_path.join("php.ini"),
            concat!(
                "opcache.enable=1\n",
                "opcache.memory_consumption=16\n",
                "opcache.interned_strings_buffer=2\n",
                "opcache.max_accelerated_files=1000\n",
                "opcache.validate_timestamps=1\n",
                "opcache.revalidate_freq=0\n",
            ),
        )
        .unwrap();
        fs::write(
            site_path.join("status.php"),
            br#"<?php
$status = function_exists('opcache_get_status') ? opcache_get_status(false) : false;
$stats = is_array($status) ? $status['opcache_statistics'] : array();
echo extension_loaded('Zend OPcache') ? 'loaded' : 'missing';
echo '|', !empty($status['opcache_enabled']) ? 'enabled' : 'disabled';
echo '|', $stats['num_cached_scripts'] ?? -1;
echo '|', $stats['hits'] ?? -1;
"#,
        )
        .unwrap();
        fs::write(site_path.join("mutable.php"), b"<?php echo 'v1';").unwrap();
        fs::write(
            site_path.join("reset.php"),
            b"<?php echo opcache_reset() ? 'reset' : 'failed';",
        )
        .unwrap();

        // Keep the fixtures safely outside OPcache's default two-second
        // file-update protection window without making this test sleep.
        let initial_mtime =
            UNIX_EPOCH + Duration::from_secs(1_700_000_000) + Duration::from_millis(100);
        for script in ["status.php", "mutable.php", "reset.php"] {
            set_modified_time(&site_path.join(script), initial_mtime);
        }

        let runtime = Wasip2ComponentRuntime::new().unwrap();
        let component = runtime.load_component(&component_path).unwrap();
        let state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&site_path, "/site"))
            .preopen(CapabilityPreopen::read_write(&tmp_path, "/tmp"))
            .build()
            .unwrap();
        let mut php = Wasip2PhpInstance::instantiate(&component, state).unwrap();
        php.initialize("/site/php.ini").unwrap();

        let first_status = php
            .handle_request(&request("/status.php", "/site/status.php"))
            .unwrap();
        assert_eq!(first_status.exit_status, 0);
        let first_stats = opcache_stats(first_status.output.stdout());
        assert_eq!(&first_stats[..2], ["loaded", "enabled"]);
        assert!(
            first_stats[2].parse::<u64>().unwrap() >= 1,
            "the first request should populate the process-local cache"
        );

        let second_status = php
            .handle_request(&request("/status.php", "/site/status.php"))
            .unwrap();
        assert_eq!(second_status.exit_status, 0);
        let second_stats = opcache_stats(second_status.output.stdout());
        assert!(
            second_stats[3].parse::<u64>().unwrap() > first_stats[3].parse::<u64>().unwrap(),
            "a repeated request should hit the same worker's cache"
        );

        let mutable_v1 = php
            .handle_request(&request("/mutable.php", "/site/mutable.php"))
            .unwrap();
        assert_eq!(mutable_v1.output.stdout(), b"v1");
        fs::write(site_path.join("mutable.php"), b"<?php echo 'v2';").unwrap();
        let replacement_mtime =
            UNIX_EPOCH + Duration::from_secs(1_700_000_000) + Duration::from_millis(200);
        set_modified_time(&site_path.join("mutable.php"), replacement_mtime);
        assert_eq!(
            initial_mtime.duration_since(UNIX_EPOCH).unwrap().as_secs(),
            replacement_mtime
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            "the regression must replace the script within the same timestamp second"
        );
        let mutable_v2 = php
            .handle_request(&request("/mutable.php", "/site/mutable.php"))
            .unwrap();
        assert_eq!(
            mutable_v2.output.stdout(),
            b"v2",
            "timestamp validation must preserve edits on mounted sites"
        );

        let reset = php
            .handle_request(&request("/reset.php", "/site/reset.php"))
            .unwrap();
        assert_eq!(reset.exit_status, 0);
        assert_eq!(reset.output.stdout(), b"reset");
        let after_reset = php
            .handle_request(&request("/status.php", "/site/status.php"))
            .unwrap();
        assert_eq!(after_reset.exit_status, 0);
        assert_eq!(
            &opcache_stats(after_reset.output.stdout())[..2],
            ["loaded", "enabled"]
        );

        drop(php);
        fs::remove_dir_all(site_path).unwrap();
        fs::remove_dir_all(tmp_path).unwrap();
    }

    #[test]
    fn persistent_php_opcache_caches_epoch_zero_scripts_and_revalidates_them() {
        let component_path = test_component_path();
        assert!(
            component_path.is_file(),
            "PHP WASIp2 component is missing: {}",
            component_path.display()
        );

        let site_path = temp_dir("persistent-php-opcache-epoch-zero");
        let tmp_path = temp_dir("persistent-php-opcache-epoch-zero-tmp");
        fs::write(
            site_path.join("php.ini"),
            concat!(
                "opcache.enable=1\n",
                "opcache.memory_consumption=16\n",
                "opcache.interned_strings_buffer=2\n",
                "opcache.max_accelerated_files=1000\n",
                "opcache.validate_timestamps=1\n",
                "opcache.revalidate_freq=0\n",
                "opcache.file_update_protection=2\n",
            ),
        )
        .unwrap();
        fs::write(site_path.join("epoch.php"), b"<?php echo 'v1';").unwrap();
        fs::write(
            site_path.join("epoch-status.php"),
            br#"<?php
$status = function_exists('opcache_get_status') ? opcache_get_status(true) : false;
$script = is_array($status) ? ($status['scripts']['/site/epoch.php'] ?? null) : null;
echo is_array($script) ? 'cached' : 'missing';
echo '|', is_array($script) ? ($script['timestamp'] ?? -1) : -1;
"#,
        )
        .unwrap();
        set_modified_time(&site_path.join("epoch.php"), UNIX_EPOCH);
        set_modified_time(
            &site_path.join("epoch-status.php"),
            UNIX_EPOCH + Duration::from_secs(1_700_000_000),
        );

        let runtime = Wasip2ComponentRuntime::new().unwrap();
        let component = runtime.load_component(&component_path).unwrap();
        let state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&site_path, "/site"))
            .preopen(CapabilityPreopen::read_write(&tmp_path, "/tmp"))
            .build()
            .unwrap();
        let mut php = Wasip2PhpInstance::instantiate(&component, state).unwrap();
        php.initialize("/site/php.ini").unwrap();

        for _ in 0..2 {
            let response = php
                .handle_request(&request("/epoch.php", "/site/epoch.php"))
                .unwrap();
            assert_eq!(response.exit_status, 0);
            assert_eq!(response.output.stdout(), b"v1");
        }
        let status = php
            .handle_request(&request("/epoch-status.php", "/site/epoch-status.php"))
            .unwrap();
        assert_eq!(status.exit_status, 0);
        assert_eq!(
            status.output.stdout(),
            b"cached|0",
            "a real epoch-zero mtime must not collide with OPcache's unavailable sentinel"
        );

        fs::write(site_path.join("epoch.php"), b"<?php echo 'v2';").unwrap();
        set_modified_time(
            &site_path.join("epoch.php"),
            UNIX_EPOCH + Duration::from_secs(1),
        );
        let after_forward_edit = php
            .handle_request(&request("/epoch.php", "/site/epoch.php"))
            .unwrap();
        assert_eq!(after_forward_edit.output.stdout(), b"v2");

        fs::write(site_path.join("epoch.php"), b"<?php echo 'v3';").unwrap();
        set_modified_time(&site_path.join("epoch.php"), UNIX_EPOCH);
        let after_reverse_edit = php
            .handle_request(&request("/epoch.php", "/site/epoch.php"))
            .unwrap();
        assert_eq!(after_reverse_edit.output.stdout(), b"v3");

        drop(php);
        fs::remove_dir_all(site_path).unwrap();
        fs::remove_dir_all(tmp_path).unwrap();
    }

    fn opcache_stats(output: &[u8]) -> Vec<&str> {
        let output = std::str::from_utf8(output).unwrap();
        let fields: Vec<_> = output.trim().split('|').collect();
        assert_eq!(fields.len(), 4, "unexpected OPcache status: {output:?}");
        fields
    }

    fn test_component_path() -> PathBuf {
        std::env::var_os("PHP_WASI_COMPONENT_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                crate::runtime::repo_root_from_manifest_dir()
                    .join("packages/php-wasm/compile/php-wasi/dist/php-wasi-component.wasm")
            })
    }

    fn set_modified_time(path: &std::path::Path, modified: std::time::SystemTime) {
        let file: File = OpenOptions::new().write(true).open(path).unwrap();
        file.set_times(FileTimes::new().set_modified(modified))
            .unwrap();
    }

    fn request(request_uri: &str, script_path: &str) -> PhpRequest {
        let mut request = PhpRequest::for_script(script_path);
        request.request_uri = request_uri.to_string();
        request.host = "localhost".to_string();
        request.port = 80;
        request
    }

    fn temp_dir(label: &str) -> PathBuf {
        let id = NEXT_TEMP_DIR_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "wp-playground-wasip2-{label}-{}-{id}",
            std::process::id()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
