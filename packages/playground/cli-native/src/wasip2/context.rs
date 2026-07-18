use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use tokio::sync::Notify;
use wasmtime::component::ResourceTable;
use wasmtime_wasi::sockets::SocketAddrUse;
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtx, WasiCtxBuilder, WasiCtxView, WasiView};

use super::php::{PhpOutputCapture, PhpWasiOutputStream, Wasip2PhpOutputChannel};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CapabilityPreopen {
    host_path: PathBuf,
    guest_path: String,
    dir_perms: DirPerms,
    file_perms: FilePerms,
}

impl CapabilityPreopen {
    pub fn read_only(host_path: impl Into<PathBuf>, guest_path: impl Into<String>) -> Self {
        Self::new(host_path, guest_path, DirPerms::READ, FilePerms::READ)
    }

    pub fn read_write(host_path: impl Into<PathBuf>, guest_path: impl Into<String>) -> Self {
        Self::new(
            host_path,
            guest_path,
            DirPerms::READ | DirPerms::MUTATE,
            FilePerms::READ | FilePerms::WRITE,
        )
    }

    pub fn new(
        host_path: impl Into<PathBuf>,
        guest_path: impl Into<String>,
        dir_perms: DirPerms,
        file_perms: FilePerms,
    ) -> Self {
        Self {
            host_path: host_path.into(),
            guest_path: guest_path.into(),
            dir_perms,
            file_perms,
        }
    }

    pub fn host_path(&self) -> &Path {
        &self.host_path
    }

    pub fn guest_path(&self) -> &str {
        &self.guest_path
    }

    pub fn dir_perms(&self) -> DirPerms {
        self.dir_perms
    }

    pub fn file_perms(&self) -> FilePerms {
        self.file_perms
    }
}

#[derive(Clone, Debug, Default)]
pub struct Wasip2ContextBuilder {
    preopens: Vec<CapabilityPreopen>,
    host_environment: Vec<(String, String)>,
}

impl Wasip2ContextBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn preopen(mut self, preopen: CapabilityPreopen) -> Self {
        self.preopens.push(preopen);
        self
    }

    /// Adds a host-controlled entry to the component's initial WASI
    /// environment.
    ///
    /// The component ABI requires non-empty names without `=` or NUL and
    /// values without NUL. Replacing an existing name also prevents ambiguous
    /// duplicate entries from reaching the guest.
    pub(crate) fn host_environment(
        mut self,
        name: impl Into<String>,
        value: impl Into<String>,
    ) -> wasmtime::Result<Self> {
        let name = name.into();
        let value = value.into();
        if name.is_empty() || name.contains(['=', '\0']) {
            return Err(wasmtime::Error::msg(
                "WASIp2 host environment names must be non-empty and contain neither '=' nor NUL",
            ));
        }
        if value.contains('\0') {
            return Err(wasmtime::Error::msg(
                "WASIp2 host environment values must not contain NUL",
            ));
        }
        if let Some((_, existing_value)) = self
            .host_environment
            .iter_mut()
            .find(|(existing_name, _)| existing_name == &name)
        {
            *existing_value = value;
        } else {
            self.host_environment.push((name, value));
        }
        Ok(self)
    }

    pub fn build(self) -> wasmtime::Result<Wasip2HostState> {
        let mut builder = WasiCtxBuilder::new();
        // Component requests already run synchronously on dedicated native
        // threads. Keep blocking filesystem calls on those threads instead of
        // bouncing every operation through Tokio's blocking pool and awaiting it.
        builder.allow_blocking_current_thread(true);
        // Match the Node Playground CLI's outbound PHP networking contract.
        // The guest may resolve names and connect TCP sockets, but it may not
        // bind a listener or use UDP. This is sufficient for PHP streams,
        // Redis, Memcached, and Xdebug without granting an ambient server
        // socket capability to code running inside the component.
        builder
            .allow_tcp(true)
            .allow_udp(false)
            .allow_ip_name_lookup(true);
        builder.socket_addr_check(|address, usage| {
            Box::pin(async move { outbound_tcp_address_allowed(address, usage) })
        });
        builder.envs(&self.host_environment);
        let cli_output = Arc::new(Mutex::new(PhpOutputCapture::default()));
        builder.stdout(PhpWasiOutputStream::new(
            Arc::clone(&cli_output),
            Wasip2PhpOutputChannel::Stdout,
        ));
        builder.stderr(PhpWasiOutputStream::new(
            Arc::clone(&cli_output),
            Wasip2PhpOutputChannel::Stderr,
        ));
        for preopen in self.preopens {
            builder.preopened_dir(
                preopen.host_path,
                preopen.guest_path,
                preopen.dir_perms,
                preopen.file_perms,
            )?;
        }
        Ok(Wasip2HostState {
            table: ResourceTable::new(),
            wasi: builder.build(),
            php_output: PhpOutputCapture::default(),
            cli_output,
            active_cancellation: None,
        })
    }
}

fn outbound_tcp_address_allowed(_address: SocketAddr, usage: SocketAddrUse) -> bool {
    matches!(usage, SocketAddrUse::TcpConnect)
}

/// Request-local cancellation state shared by synchronous WASI host waits and
/// the epoch-interruption watcher.
///
/// The public control boundary continues to own the atomic flag. The notifier
/// prevents every socket poll or flush from allocating a periodic Tokio timer
/// merely to observe that flag.
pub(crate) struct ActiveCancellation {
    requested: Arc<AtomicBool>,
    notification: Notify,
}

impl ActiveCancellation {
    pub(crate) fn new(requested: Arc<AtomicBool>) -> Self {
        Self {
            requested,
            notification: Notify::new(),
        }
    }

    pub(crate) fn is_requested(&self) -> bool {
        self.requested.load(Ordering::Acquire)
    }

    pub(crate) fn notify(&self) {
        // There can be only one synchronous host call in flight for a Store.
        // `notify_one` retains a permit if cancellation wins the race before
        // the host future begins waiting.
        self.notification.notify_one();
    }

    pub(crate) async fn cancelled(&self) {
        loop {
            let notified = self.notification.notified();
            if self.is_requested() {
                return;
            }
            notified.await;
        }
    }
}

pub struct Wasip2HostState {
    table: ResourceTable,
    wasi: WasiCtx,
    pub(crate) php_output: PhpOutputCapture,
    pub(crate) cli_output: Arc<Mutex<PhpOutputCapture>>,
    pub(crate) active_cancellation: Option<Arc<ActiveCancellation>>,
}

impl WasiView for Wasip2HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.wasi,
            table: &mut self.table,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        net::{IpAddr, Ipv4Addr, SocketAddr},
        sync::atomic::{AtomicU64, Ordering},
    };

    use wasmtime_wasi::cli::WasiCliView;
    use wasmtime_wasi::p2::bindings::cli::environment::Host as WasiEnvironmentHost;
    use wasmtime_wasi::sockets::SocketAddrUse;
    use wasmtime_wasi::{DirPerms, FilePerms, WasiView};

    use super::{outbound_tcp_address_allowed, CapabilityPreopen, Wasip2ContextBuilder};

    static NEXT_TEMP_DIR_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn host_state_exposes_a_wasi_view() {
        let mut state = Wasip2ContextBuilder::new().build().unwrap();

        let _view = WasiView::ctx(&mut state);
    }

    #[test]
    fn preopen_constructors_apply_capability_permissions() {
        let read_only = CapabilityPreopen::read_only("/host/readonly", "/readonly");
        assert_eq!(
            read_only.host_path(),
            std::path::Path::new("/host/readonly")
        );
        assert_eq!(read_only.guest_path(), "/readonly");
        assert_eq!(read_only.dir_perms(), DirPerms::READ);
        assert_eq!(read_only.file_perms(), FilePerms::READ);

        let read_write = CapabilityPreopen::read_write("/host/readwrite", "/readwrite");
        assert_eq!(read_write.dir_perms(), DirPerms::READ | DirPerms::MUTATE);
        assert_eq!(read_write.file_perms(), FilePerms::READ | FilePerms::WRITE);
    }

    #[test]
    fn context_builds_with_an_explicit_preopen() {
        let host_path = create_temp_dir("preopen");
        let preopen = CapabilityPreopen::read_write(&host_path, "/workspace");

        let result = Wasip2ContextBuilder::new().preopen(preopen).build();

        assert!(result.is_ok());
        drop(result);
        fs::remove_dir_all(host_path).unwrap();
    }

    #[test]
    fn context_rejects_a_missing_preopen() {
        let host_path = unused_temp_path("missing-preopen");
        let preopen = CapabilityPreopen::read_only(host_path, "/missing");

        let result = Wasip2ContextBuilder::new().preopen(preopen).build();

        assert!(result.is_err());
    }

    #[test]
    fn host_environment_is_validated_deduplicated_and_copied_into_state() {
        for (name, value) in [
            ("", "value"),
            ("BAD=NAME", "value"),
            ("BAD\0NAME", "value"),
            ("NAME", "bad\0value"),
        ] {
            assert!(Wasip2ContextBuilder::new()
                .host_environment(name, value)
                .is_err());
        }

        let builder = Wasip2ContextBuilder::new()
            .host_environment("HOST_ONLY", "first")
            .unwrap()
            .host_environment("HOST_ONLY", "selected")
            .unwrap();
        let mut first = builder.clone().build().unwrap();
        let mut second = builder.build().unwrap();

        for state in [&mut first, &mut second] {
            let mut cli = WasiCliView::cli(state);
            assert_eq!(
                WasiEnvironmentHost::get_environment(&mut cli).unwrap(),
                vec![("HOST_ONLY".to_string(), "selected".to_string())]
            );
        }
    }

    #[test]
    fn network_policy_allows_only_outbound_tcp_connections() {
        let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 6379);

        assert!(outbound_tcp_address_allowed(
            address,
            SocketAddrUse::TcpConnect
        ));
        assert!(!outbound_tcp_address_allowed(
            address,
            SocketAddrUse::TcpBind
        ));
        assert!(!outbound_tcp_address_allowed(
            address,
            SocketAddrUse::UdpBind
        ));
        assert!(!outbound_tcp_address_allowed(
            address,
            SocketAddrUse::UdpConnect
        ));
        assert!(!outbound_tcp_address_allowed(
            address,
            SocketAddrUse::UdpOutgoingDatagram
        ));
    }

    fn create_temp_dir(label: &str) -> std::path::PathBuf {
        let path = unused_temp_path(label);
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn unused_temp_path(label: &str) -> std::path::PathBuf {
        let id = NEXT_TEMP_DIR_ID.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "wp-playground-wasip2-{label}-{}-{id}",
            std::process::id()
        ))
    }
}
