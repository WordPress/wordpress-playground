use wasmtime::component::{Component, HasSelf, Linker};
use wasmtime::Store;

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
use bindings::exports::wordpress::php_wasi::handler;
use bindings::wordpress::php_wasi::output;

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

#[derive(Debug, Default)]
pub(crate) struct PhpOutputCapture {
    output: Wasip2PhpOutput,
}

impl PhpOutputCapture {
    fn reset(&mut self) {
        self.output.stdout.clear();
        self.output.stderr.clear();
    }

    fn take(&mut self) -> Wasip2PhpOutput {
        std::mem::take(&mut self.output)
    }

    fn write(&mut self, destination: output::Channel, bytes: &[u8]) {
        match destination {
            output::Channel::Stdout => self.output.stdout.extend_from_slice(bytes),
            output::Channel::Stderr => self.output.stderr.extend_from_slice(bytes),
        }
    }
}

impl output::Host for Wasip2HostState {
    fn write(&mut self, destination: output::Channel, bytes: Vec<u8>) -> wasmtime::Result<()> {
        self.php_output.write(destination, &bytes);
        Ok(())
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

pub struct Wasip2PhpInstance {
    store: Store<Wasip2HostState>,
    bindings: bindings::Php,
}

impl Wasip2PhpInstance {
    pub fn instantiate(component: &Component, state: Wasip2HostState) -> wasmtime::Result<Self> {
        let runtime = Wasip2ComponentRuntime::from_engine(component.engine().clone())?;
        let mut store = Store::new(runtime.engine(), state);
        let bindings = bindings::Php::instantiate(&mut store, component, runtime.linker())?;
        Ok(Self { store, bindings })
    }

    pub fn initialize(&mut self, php_ini_path: &str) -> wasmtime::Result<()> {
        self.reset_output();
        self.bindings
            .wordpress_php_wasi_handler()
            .call_initialize(&mut self.store, php_ini_path)?
            .map_err(wasmtime::Error::msg)
    }

    pub fn handle_request(&mut self, request: &PhpRequest) -> wasmtime::Result<Wasip2PhpResponse> {
        let server_entries = component_entries(&request.server_entries);
        let env = component_entries(&request.env);
        let request = handler::Request {
            script_path: &request.script_path,
            request_uri: &request.request_uri,
            method: &request.method,
            host: &request.host,
            port: request.port,
            body: &request.body,
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

    pub fn store_mut(&mut self) -> &mut Store<Wasip2HostState> {
        &mut self.store
    }
}

fn component_entries(entries: &[(String, String)]) -> Vec<handler::Entry<'_>> {
    entries
        .iter()
        .map(|(key, value)| handler::Entry { key, value })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File, FileTimes, OpenOptions},
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{Duration, UNIX_EPOCH},
    };

    use super::{output, PhpOutputCapture, Wasip2PhpInstance};
    use crate::php_protocol::PhpRequest;
    use crate::wasip2::{CapabilityPreopen, Wasip2ComponentRuntime, Wasip2ContextBuilder};

    static NEXT_TEMP_DIR_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn output_capture_resets_and_takes_binary_channels_independently() {
        let mut capture = PhpOutputCapture::default();
        capture.write(output::Channel::Stdout, &[0, 255]);
        capture.write(output::Channel::Stderr, b"warning");

        let output = capture.take();
        assert_eq!(output.stdout(), &[0, 255]);
        assert_eq!(output.stderr(), b"warning");
        assert_eq!(capture.take(), Default::default());

        capture.write(output::Channel::Stderr, b"discard me");
        capture.reset();
        assert_eq!(capture.take(), Default::default());
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
