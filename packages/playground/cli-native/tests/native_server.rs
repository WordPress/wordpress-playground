use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex, MutexGuard},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

const SERVER_START_TIMEOUT: Duration = Duration::from_secs(300);
const HTTP_RESPONSE_TIMEOUT: Duration = Duration::from_secs(180);

static SERVER_SMOKE_LOCK: Mutex<()> = Mutex::new(());

struct ChildGuard {
    child: Child,
    _serial_guard: MutexGuard<'static, ()>,
}

impl ChildGuard {
    fn new(child: Child, serial_guard: MutexGuard<'static, ()>) -> Self {
        Self {
            child,
            _serial_guard: serial_guard,
        }
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn temp_dir(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir =
        std::env::temp_dir().join(format!("wp-playground-native-integration-{name}-{unique}"));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn start_native_server(
    root: &Path,
    workers: usize,
) -> (String, ChildGuard, thread::JoinHandle<()>) {
    let serial_guard = SERVER_SMOKE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut child = Command::new(env!("CARGO_BIN_EXE_wp-playground-native"))
        .args([
            "server",
            "--skip-wordpress-install",
            "--skip-sqlite-setup",
            "--port=0",
            &format!("--workers={workers}"),
            "--mount-dir-before-install",
        ])
        .arg(root)
        .arg("/wordpress")
        .env_remove("FORCE_COLOR")
        .env("NO_COLOR", "1")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();

    let stderr = child.stderr.take().unwrap();
    let guard = ChildGuard::new(child, serial_guard);
    let (tx, rx) = mpsc::channel();
    let stderr_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            if tx.send(line.unwrap_or_default()).is_err() {
                break;
            }
        }
    });

    let mut stderr_lines = Vec::new();
    let listening_line = loop {
        match rx.recv_timeout(SERVER_START_TIMEOUT) {
            Ok(line) if line.contains("wp-playground-native listening on ") => break line,
            Ok(line) => stderr_lines.push(line),
            Err(error) => {
                panic!(
                    "server did not report a listening URL before timeout: {error}; stderr={stderr_lines:?}"
                );
            }
        }
    };
    let url = listening_line
        .split("wp-playground-native listening on ")
        .nth(1)
        .unwrap()
        .trim();
    let address = url.strip_prefix("http://").unwrap().to_string();
    (address, guard, stderr_thread)
}

fn start_native_control_server(
    root: &Path,
    workers: usize,
) -> (
    String,
    String,
    String,
    PathBuf,
    ChildGuard,
    thread::JoinHandle<()>,
) {
    let serial_guard = SERVER_SMOKE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let handshake_root = temp_dir("control-handshake");
    let handshake_path = handshake_root.join("handshake.json");
    let token = "a".repeat(64);
    let mut child = Command::new(env!("CARGO_BIN_EXE_wp-playground-native"))
        .args([
            "server",
            "--skip-wordpress-install",
            "--skip-sqlite-setup",
            "--port=0",
            &format!("--workers={workers}"),
            "--mount-dir-before-install",
        ])
        .arg(root)
        .arg("/wordpress")
        .arg("--experimental-control-handshake")
        .arg(&handshake_path)
        .env("WP_PLAYGROUND_NATIVE_CONTROL_TOKEN", &token)
        .env_remove("FORCE_COLOR")
        .env("NO_COLOR", "1")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let stderr = child.stderr.take().unwrap();
    let stderr_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            if line.is_err() {
                break;
            }
        }
    });
    let deadline = Instant::now() + SERVER_START_TIMEOUT;
    while !handshake_path.is_file() {
        if let Some(status) = child.try_wait().unwrap() {
            panic!("controlled native server exited before handshake: {status}");
        }
        assert!(
            Instant::now() < deadline,
            "controlled native server did not publish its handshake"
        );
        thread::sleep(Duration::from_millis(10));
    }
    let handshake: serde_json::Value =
        serde_json::from_slice(&fs::read(&handshake_path).unwrap()).unwrap();
    assert_eq!(handshake["protocolVersion"], 2);
    let control_url = handshake["controlUrl"].as_str().unwrap().to_string();
    let native_address = handshake["nativeServerUrl"]
        .as_str()
        .unwrap()
        .strip_prefix("http://")
        .unwrap()
        .to_string();
    (
        control_url,
        native_address,
        token,
        handshake_root,
        ChildGuard::new(child, serial_guard),
        stderr_thread,
    )
}

fn open_control_stream(control_url: &str, token: &str, body: &str) -> BufReader<TcpStream> {
    let endpoint = control_url.strip_prefix("http://").unwrap();
    let (address, _) = endpoint.split_once('/').unwrap();
    let mut stream = TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(HTTP_RESPONSE_TIMEOUT))
        .unwrap();
    stream
        .set_write_timeout(Some(Duration::from_secs(20)))
        .unwrap();
    write!(
        stream,
        "POST /rpc/stream HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
    .unwrap();
    stream.flush().unwrap();
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    assert!(line.starts_with("HTTP/1.1 200 OK"), "{line}");
    loop {
        line.clear();
        reader.read_line(&mut line).unwrap();
        if line == "\r\n" || line == "\n" {
            break;
        }
    }
    reader
}

fn read_control_stream_frame(reader: &mut impl BufRead) -> serde_json::Value {
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    assert!(!line.is_empty(), "native control stream ended unexpectedly");
    serde_json::from_str(line.trim_end()).unwrap()
}

fn cancel_control_stream(control_url: &str, token: &str, id: u64) -> serde_json::Value {
    let endpoint = control_url.strip_prefix("http://").unwrap();
    let (address, _) = endpoint.split_once('/').unwrap();
    let body = format!(r#"{{"protocolVersion":2,"id":{id}}}"#);
    let response = send_raw_http(
        address,
        &format!(
            "POST /rpc/cancel HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        ),
    );
    serde_json::from_str(response.split_once("\r\n\r\n").unwrap().1).unwrap()
}

fn control_rpc(control_url: &str, token: &str, body: &str) -> serde_json::Value {
    let endpoint = control_url.strip_prefix("http://").unwrap();
    let (address, path) = endpoint.split_once('/').unwrap();
    let response = send_raw_http(
        address,
        &format!(
            "POST /{path} HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        ),
    );
    serde_json::from_str(response.split_once("\r\n\r\n").unwrap().1).unwrap()
}

fn read_control_stream_to_terminal(reader: &mut impl BufRead) -> Vec<serde_json::Value> {
    let mut frames = Vec::new();
    loop {
        let frame = read_control_stream_frame(reader);
        let terminal = matches!(frame["type"].as_str(), Some("complete" | "error"));
        frames.push(frame);
        assert!(frames.len() <= 64, "native stream emitted too many frames");
        if terminal {
            return frames;
        }
    }
}

fn decoded_stream_channel(frames: &[serde_json::Value], channel: &str) -> Vec<u8> {
    frames
        .iter()
        .filter(|frame| frame["type"] == channel)
        .flat_map(|frame| {
            assert_eq!(frame["data"]["encoding"], "base64");
            BASE64
                .decode(frame["data"]["data"].as_str().unwrap())
                .unwrap()
        })
        .collect()
}

fn run_control_cli(
    control_url: &str,
    token: &str,
    id: u64,
    argv: &[&str],
) -> Vec<serde_json::Value> {
    let body = serde_json::json!({
        "protocolVersion": 2,
        "id": id,
        "method": "cli",
        "params": {
            "argv": argv,
            "env": {},
            "cwd": "/wordpress"
        }
    })
    .to_string();
    let mut stream = open_control_stream(control_url, token, &body);
    read_control_stream_to_terminal(&mut stream)
}

fn write_script(root: &Path, name: &str, content: &str) {
    fs::write(root.join(name), content).unwrap();
}

struct HttpResponse {
    status_line: String,
    headers: String,
    body: String,
}

fn send_get(address: &str, path: &str) -> HttpResponse {
    send_get_with_cookie_header(address, path, None)
}

fn send_get_with_cookie_header(
    address: &str,
    path: &str,
    cookie_header: Option<&str>,
) -> HttpResponse {
    let cookie_line = cookie_header
        .filter(|value| !value.is_empty())
        .map(|value| format!("Cookie: {value}\r\n"))
        .unwrap_or_default();
    let response = send_raw_http(
        address,
        &format!(
            "GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n{cookie_line}Connection: close\r\n\r\n"
        ),
    );
    parse_http_response(response)
}

fn parse_http_response(response: String) -> HttpResponse {
    let (head, body) = response
        .split_once("\r\n\r\n")
        .unwrap_or_else(|| panic!("malformed response: {response}"));
    let mut head_lines = head.lines();
    let status_line = head_lines.next().unwrap_or_default().to_string();
    HttpResponse {
        status_line,
        headers: head_lines.collect::<Vec<_>>().join("\n"),
        body: body.to_string(),
    }
}

fn assert_ok(response: &HttpResponse) {
    assert!(
        response.status_line.starts_with("HTTP/1.1 200 OK"),
        "{}\n{}\n{}",
        response.status_line,
        response.headers,
        response.body
    );
}

fn response_set_cookie_header(response: &HttpResponse) -> String {
    response
        .headers
        .lines()
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("set-cookie").then(|| {
                value
                    .trim()
                    .split_once(';')
                    .map(|(cookie, _)| cookie)
                    .unwrap_or_else(|| value.trim())
                    .to_string()
            })
        })
        .collect::<Vec<_>>()
        .join("; ")
}

fn response_json(response: &HttpResponse) -> serde_json::Value {
    assert_ok(response);
    serde_json::from_str(response.body.trim()).unwrap_or_else(|error| {
        panic!(
            "response body was not JSON: {error}; body={:?}; headers={}",
            response.body, response.headers
        )
    })
}

#[test]
#[ignore = "Real native PHP CLI component execution is an explicit smoke test."]
fn native_control_runs_real_php_cli_sapi_with_phar_loaded() {
    let root = temp_dir("control-real-cli");
    write_script(
        &root,
        "index.php",
        "<?php usleep(100000); echo ini_get('precision');",
    );
    write_script(
        &root,
        "runtime-guard.php",
        r#"<?php
$write = @file_put_contents('/internal/shared/php.ini', "precision=99\n");
$link = function_exists('symlink')
    ? @symlink('/wordpress', '/internal/shared/guest-link')
    : false;
$contents = @file_get_contents('/internal/shared/php.ini');
echo json_encode([
    'write' => $write,
    'link' => $link,
    'linkExists' => file_exists('/internal/shared/guest-link'),
    'unchanged' => $contents !== false && !str_contains($contents, 'precision=99'),
]);"#,
    );
    let (control_url, _address, token, handshake_root, guard, stderr_thread) =
        start_native_control_server(&root, 3);
    let native_address = _address;
    let mut old_ini_requests = Vec::new();
    for _ in 0..3 {
        let address = native_address.clone();
        old_ini_requests.push(thread::spawn(move || send_get(&address, "/")));
    }
    for request in old_ini_requests {
        let response = request.join().unwrap();
        assert_ok(&response);
        assert_eq!(response.body, "14");
    }
    let runtime_guard = response_json(&send_get(&native_address, "/runtime-guard.php"));
    assert_eq!(runtime_guard["write"], false, "{runtime_guard:?}");
    assert_eq!(runtime_guard["link"], false, "{runtime_guard:?}");
    assert_eq!(runtime_guard["linkExists"], false, "{runtime_guard:?}");
    assert_eq!(runtime_guard["unchanged"], true, "{runtime_guard:?}");
    let frames = run_control_cli(
        &control_url,
        &token,
        301,
        &[
            "php",
            "-r",
            "echo PHP_SAPI, '|', ini_get('precision'), '|', extension_loaded('Phar') ? '1' : '0';",
        ],
    );
    assert_eq!(frames.last().unwrap()["type"], "complete", "{frames:?}");
    assert_eq!(frames.last().unwrap()["exitCode"], 0, "{frames:?}");
    let stdout = String::from_utf8(decoded_stream_channel(&frames, "stdout")).unwrap();
    let parts = stdout.split('|').collect::<Vec<_>>();
    assert_eq!(parts.first().copied(), Some("cli"), "{frames:?}");
    assert_eq!(parts.last().copied(), Some("1"), "{frames:?}");

    let help = run_control_cli(&control_url, &token, 302, &["php", "--help"]);
    assert_eq!(help.last().unwrap()["type"], "complete", "{help:?}");
    assert_eq!(help.last().unwrap()["exitCode"], 0, "{help:?}");
    let help_stdout = String::from_utf8(decoded_stream_channel(&help, "stdout")).unwrap();
    assert!(help_stdout.contains("Usage:"), "{help:?}");

    let invalid = run_control_cli(
        &control_url,
        &token,
        303,
        &["php", "--definitely-invalid-option"],
    );
    assert_eq!(invalid.last().unwrap()["type"], "complete", "{invalid:?}");
    assert_eq!(invalid.last().unwrap()["exitCode"], 1, "{invalid:?}");
    let invalid_stdout = String::from_utf8(decoded_stream_channel(&invalid, "stdout")).unwrap();
    assert!(invalid_stdout.contains("Usage:"), "{invalid:?}");

    let wp_cli_fixture =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../cli/tests/fixtures/wp-cli.phar");
    let wp_cli_data = BASE64.encode(fs::read(&wp_cli_fixture).unwrap());
    let write_wp_cli = serde_json::json!({
        "protocolVersion": 2,
        "id": 304,
        "method": "writeFile",
        "params": {
            "path": "/tmp/wp-cli.phar",
            "data": { "encoding": "base64", "data": wp_cli_data }
        }
    })
    .to_string();
    let write_result = control_rpc(&control_url, &token, &write_wp_cli);
    assert!(write_result.get("error").is_none(), "{write_result:?}");

    let wp_cli = run_control_cli(
        &control_url,
        &token,
        305,
        &["php", "/tmp/wp-cli.phar", "--version", "--allow-root"],
    );
    assert_eq!(wp_cli.last().unwrap()["type"], "complete", "{wp_cli:?}");
    assert_eq!(wp_cli.last().unwrap()["exitCode"], 0, "{wp_cli:?}");
    let wp_cli_stdout = String::from_utf8(decoded_stream_channel(&wp_cli, "stdout")).unwrap();
    assert!(wp_cli_stdout.contains("WP-CLI "), "{wp_cli:?}");

    let replacement_ini = BASE64.encode(b"precision=17\n");
    let write_ini = serde_json::json!({
        "protocolVersion": 2,
        "id": 306,
        "method": "writeFile",
        "params": {
            "path": "/internal/shared/php.ini",
            "data": { "encoding": "base64", "data": replacement_ini }
        }
    })
    .to_string();
    let write_result = control_rpc(&control_url, &token, &write_ini);
    assert!(write_result.get("error").is_none(), "{write_result:?}");

    let mut fresh_ini_requests = Vec::new();
    for _ in 0..6 {
        let address = native_address.clone();
        fresh_ini_requests.push(thread::spawn(move || send_get(&address, "/")));
    }
    for request in fresh_ini_requests {
        let response = request.join().unwrap();
        assert_ok(&response);
        assert_eq!(response.body, "17");
    }
    let fresh_cli = run_control_cli(
        &control_url,
        &token,
        307,
        &["php", "-r", "echo ini_get('precision');"],
    );
    assert_eq!(
        fresh_cli.last().unwrap()["type"],
        "complete",
        "{fresh_cli:?}"
    );
    assert_eq!(fresh_cli.last().unwrap()["exitCode"], 0, "{fresh_cli:?}");
    assert_eq!(decoded_stream_channel(&fresh_cli, "stdout"), b"17");

    let cancellation_body = serde_json::json!({
        "protocolVersion": 2,
        "id": 308,
        "method": "cli",
        "params": {
            "argv": ["php", "-r", "echo 'cli-started'; while (true) {}"],
            "env": {},
            "cwd": "/wordpress"
        }
    })
    .to_string();
    let mut cancelled_cli = open_control_stream(&control_url, &token, &cancellation_body);
    assert_eq!(
        read_control_stream_frame(&mut cancelled_cli)["type"],
        "headers"
    );
    let started = read_control_stream_frame(&mut cancelled_cli);
    assert_eq!(started["type"], "stdout", "{started:?}");
    assert_eq!(started["data"]["data"], BASE64.encode(b"cli-started"));
    let cancelled_at = Instant::now();
    assert_eq!(
        cancel_control_stream(&control_url, &token, 308)["result"]["cancelled"],
        true
    );
    let terminal = read_control_stream_frame(&mut cancelled_cli);
    assert_eq!(terminal["type"], "error", "{terminal:?}");
    assert!(
        cancelled_at.elapsed() < Duration::from_secs(2),
        "CPU-bound CLI cancellation was not prompt"
    );

    let sleep_cancellation_body = serde_json::json!({
        "protocolVersion": 2,
        "id": 309,
        "method": "cli",
        "params": {
            "argv": ["php", "-r", "echo 'sleep-started'; sleep(30); echo 'sleep-finished';"],
            "env": {},
            "cwd": "/wordpress"
        }
    })
    .to_string();
    let mut sleeping_cli = open_control_stream(&control_url, &token, &sleep_cancellation_body);
    assert_eq!(
        read_control_stream_frame(&mut sleeping_cli)["type"],
        "headers"
    );
    let sleep_started = read_control_stream_frame(&mut sleeping_cli);
    assert_eq!(sleep_started["type"], "stdout", "{sleep_started:?}");
    assert_eq!(
        sleep_started["data"]["data"],
        BASE64.encode(b"sleep-started")
    );
    sleeping_cli
        .get_mut()
        .set_read_timeout(Some(Duration::from_secs(2)))
        .unwrap();
    let sleep_cancelled_at = Instant::now();
    assert_eq!(
        cancel_control_stream(&control_url, &token, 309)["result"]["cancelled"],
        true
    );
    let sleep_terminal = read_control_stream_frame(&mut sleeping_cli);
    assert_eq!(sleep_terminal["type"], "error", "{sleep_terminal:?}");
    assert!(
        sleep_cancelled_at.elapsed() < Duration::from_secs(2),
        "WASI sleep cancellation was not prompt"
    );

    let recovered_cli = run_control_cli(
        &control_url,
        &token,
        310,
        &["php", "-r", "echo 'cli-recovered';"],
    );
    assert_eq!(
        recovered_cli.last().unwrap()["type"],
        "complete",
        "{recovered_cli:?}"
    );
    assert_eq!(recovered_cli.last().unwrap()["exitCode"], 0);
    assert_eq!(
        decoded_stream_channel(&recovered_cli, "stdout"),
        b"cli-recovered"
    );

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(handshake_root);
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native start command execution is an explicit smoke test."]
fn native_start_command_serves_admin_editor_page_with_auto_login() {
    let home = temp_dir("start-editor-home");
    let cwd = temp_dir("start-editor-cwd");
    let serial_guard = SERVER_SMOKE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut child = Command::new(env!("CARGO_BIN_EXE_wp-playground-native"))
        .args([
            "start",
            "--skip-browser",
            "--port=0",
            "--reset",
            "--php=8.2",
            "--wp=6.9",
            "--login",
        ])
        .current_dir(&cwd)
        .env("HOME", &home)
        .env("WP_PLAYGROUND_NATIVE_LAZY_WORKERS", "1")
        .env_remove("FORCE_COLOR")
        .env("NO_COLOR", "1")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();

    let stderr = child.stderr.take().unwrap();
    let guard = ChildGuard::new(child, serial_guard);
    let (tx, rx) = mpsc::channel();
    let stderr_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            if tx.send(line.unwrap_or_default()).is_err() {
                break;
            }
        }
    });

    let mut stderr_lines = Vec::new();
    let listening_line = loop {
        match rx.recv_timeout(SERVER_START_TIMEOUT) {
            Ok(line) if line.contains("wp-playground-native listening on ") => break line,
            Ok(line) => stderr_lines.push(line),
            Err(error) => {
                panic!(
                    "start did not report a listening URL before timeout: {error}; stderr={stderr_lines:?}"
                );
            }
        }
    };
    let url = listening_line
        .split("wp-playground-native listening on ")
        .nth(1)
        .unwrap()
        .trim();
    let address = url.strip_prefix("http://").unwrap().to_string();
    let editor_path = "/wp-admin/post-new.php?post_type=page";

    let login_redirect = send_get(&address, editor_path);
    assert!(
        login_redirect.status_line.starts_with("HTTP/1.1 302 Found"),
        "{}\n{}\n{}",
        login_redirect.status_line,
        login_redirect.headers,
        login_redirect.body
    );
    let cookies = response_set_cookie_header(&login_redirect);
    assert!(cookies.contains("wordpress_"), "{cookies}");

    let editor = send_get_with_cookie_header(&address, editor_path, Some(&cookies));
    assert_ok(&editor);
    assert!(editor.body.contains("Add Page"), "{}", editor.body);
    assert!(editor.body.contains("wp-admin-bar"), "{}", editor.body);
    assert!(
        !editor.body.contains("Internal Server Error"),
        "{}",
        editor.body
    );
    let mut concurrent = Vec::new();
    for index in 0..12 {
        let address = address.clone();
        let cookies = cookies.clone();
        concurrent.push(thread::spawn(move || {
            let path = if index % 2 == 0 { "/favicon.ico/" } else { "/" };
            (
                path,
                send_get_with_cookie_header(&address, path, Some(&cookies)),
            )
        }));
    }
    for thread in concurrent {
        let (path, response) = thread.join().unwrap();
        assert!(
            response.status_line.starts_with("HTTP/1.1 200 ")
                || response.status_line.starts_with("HTTP/1.1 301 ")
                || response.status_line.starts_with("HTTP/1.1 302 ")
                || response.status_line.starts_with("HTTP/1.1 404 "),
            "{path}\n{}\n{}\n{}",
            response.status_line,
            response.headers,
            response.body
        );
        assert!(
            !response.body.contains("Internal Server Error"),
            "{}",
            response.body
        );
    }
    let editor_after_lazy_workers =
        send_get_with_cookie_header(&address, editor_path, Some(&cookies));
    assert_ok(&editor_after_lazy_workers);
    assert!(
        editor_after_lazy_workers.body.contains("Add Page"),
        "{}",
        editor_after_lazy_workers.body
    );
    assert!(
        editor_after_lazy_workers.body.contains("wp-admin-bar"),
        "{}",
        editor_after_lazy_workers.body
    );
    assert!(
        !editor_after_lazy_workers
            .body
            .contains("Internal Server Error"),
        "{}",
        editor_after_lazy_workers.body
    );

    let recent_stderr = rx.try_iter().collect::<Vec<_>>().join("\n");
    assert!(
        !recent_stderr.contains("wasm_sapi_handle_request failed"),
        "{recent_stderr}"
    );

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(home);
    let _ = fs::remove_dir_all(cwd);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_binary_serves_mounted_php_index() {
    let root = temp_dir("server-php-index");
    fs::write(
        root.join("index.php"),
        "<?php header('X-Native-Server: ok'); $hash = password_hash('playground', PASSWORD_DEFAULT); $random = random_int(100, 200); $email = filter_var('wordpress@example.com', FILTER_VALIDATE_EMAIL); echo 'native-server-ok:', strlen(random_bytes(513)), ':', (int) ($random >= 100 && $random <= 200), ':', (int) password_verify('playground', $hash), ':', (int) ($email === 'wordpress@example.com');",
    )
    .unwrap();

    let (address, guard, stderr_thread) = start_native_server(&root, 1);
    let response = send_raw_http(
        &address,
        "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
    );

    assert!(response.starts_with("HTTP/1.1 200 OK\r\n"), "{response}");
    assert!(response.contains("X-Native-Server: ok\r\n"), "{response}");
    assert!(
        response.ends_with("native-server-ok:513:1:1:1"),
        "{response}"
    );

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
#[test]
#[ignore = "Full packaged WASIp2 execution is an explicit smoke test."]
fn packaged_wasip2_runs_full_wordpress_smokes() {
    let _serial_guard = SERVER_SMOKE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let out_dir = temp_dir("packaged-wasip2");
    let package_name = "wp-playground-native-wasip2-smoke";
    let output = Command::new(env!("CARGO_BIN_EXE_package-native-cli"))
        .arg("--binary")
        .arg(env!("CARGO_BIN_EXE_wp-playground-native"))
        .arg("--out-dir")
        .arg(&out_dir)
        .arg("--name")
        .arg(package_name)
        .arg("--skip-archive")
        .arg("--smoke-wordpress-server")
        .arg("--smoke-run-blueprint")
        .arg("--smoke-build-snapshot")
        .output()
        .unwrap();

    assert!(
        output.status.success(),
        "package-native-cli failed with status {}\nstdout:\n{}\nstderr:\n{}",
        output.status,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let package_root = out_dir.join(package_name);
    assert!(package_root.join("bin/wp-playground-native").is_file());
    assert!(package_root.join("package-manifest.json").is_file());

    let _ = fs::remove_dir_all(out_dir);
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
#[test]
#[ignore = "Full packaged WASIp2 start command execution is an explicit smoke test."]
fn packaged_start_command_serves_wasip2_wordpress() {
    let serial_guard = SERVER_SMOKE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let out_dir = temp_dir("packaged-start");
    let package_name = "wp-playground-native-start-smoke";
    let output = Command::new(env!("CARGO_BIN_EXE_package-native-cli"))
        .arg("--binary")
        .arg(env!("CARGO_BIN_EXE_wp-playground-native"))
        .arg("--out-dir")
        .arg(&out_dir)
        .arg("--name")
        .arg(package_name)
        .arg("--include-wordpress-assets")
        .arg("--skip-archive")
        .arg("--no-precompile-wasmtime")
        .output()
        .unwrap();

    assert!(
        output.status.success(),
        "package-native-cli failed with status {}\nstdout:\n{}\nstderr:\n{}",
        output.status,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let package_root = out_dir.join(package_name);
    let home = temp_dir("packaged-start-home");
    let cwd = temp_dir("packaged-start-cwd");
    let mut child = Command::new(package_root.join("bin/wp-playground-native"))
        .args(["start", "--skip-browser", "--port=0", "--php=8.2"])
        .current_dir(&cwd)
        .env("HOME", &home)
        .env_remove("WP_PLAYGROUND_NATIVE_ASSET_ROOT")
        .env_remove("FORCE_COLOR")
        .env("NO_COLOR", "1")
        .env("WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK", "1")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();

    let stderr = child.stderr.take().unwrap();
    let guard = ChildGuard::new(child, serial_guard);
    let (tx, rx) = mpsc::channel();
    let stderr_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            if tx.send(line.unwrap_or_default()).is_err() {
                break;
            }
        }
    });

    let mut stderr_lines = Vec::new();
    let listening_line = loop {
        match rx.recv_timeout(SERVER_START_TIMEOUT) {
            Ok(line) if line.contains("wp-playground-native listening on ") => break line,
            Ok(line) => stderr_lines.push(line),
            Err(error) => {
                panic!(
                    "packaged start did not report a listening URL before timeout: {error}; stderr={stderr_lines:?}"
                );
            }
        }
    };
    let url = listening_line
        .split("wp-playground-native listening on ")
        .nth(1)
        .unwrap()
        .trim();
    let address = url.strip_prefix("http://").unwrap();
    let redirect = send_get(address, "/");
    assert!(
        redirect.status_line.starts_with("HTTP/1.1 302 Found"),
        "{}\n{}\n{}",
        redirect.status_line,
        redirect.headers,
        redirect.body
    );
    assert!(redirect
        .headers
        .contains("playground_auto_login_already_happened=1"));
    let response = parse_http_response(send_raw_http(
        address,
        &format!(
            "GET / HTTP/1.1\r\nHost: {address}\r\nCookie: playground_auto_login_already_happened=1\r\nConnection: close\r\n\r\n"
        ),
    ));
    assert_ok(&response);
    assert!(response.body.contains("My WordPress Website"));

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(out_dir);
    let _ = fs::remove_dir_all(home);
    let _ = fs::remove_dir_all(cwd);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_reused_worker_does_not_leak_sapi_request_state() {
    let root = temp_dir("server-request-state");
    fs::write(
        root.join("index.php"),
        r#"<?php
header('Content-Type: text/plain');
echo "method=" . ($_SERVER['REQUEST_METHOD'] ?? '') . "\n";
echo "cookie=" . ($_COOKIE['leak'] ?? '') . "\n";
echo "body=" . file_get_contents('php://input') . "\n";
"#,
    )
    .unwrap();

    let (address, guard, stderr_thread) = start_native_server(&root, 1);

    let post_response = send_raw_http(
        &address,
        "POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: text/plain\r\nCookie: leak=first\r\nContent-Length: 10\r\nConnection: close\r\n\r\nfirst-body",
    );
    assert!(post_response.contains("method=POST\n"), "{post_response}");
    assert!(post_response.contains("cookie=first\n"), "{post_response}");
    assert!(
        post_response.contains("body=first-body\n"),
        "{post_response}"
    );

    let get_response = send_raw_http(
        &address,
        "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
    );
    assert!(get_response.contains("method=GET\n"), "{get_response}");
    assert!(get_response.contains("cookie=\n"), "{get_response}");
    assert!(get_response.contains("body=\n"), "{get_response}");
    assert!(!get_response.contains("first"), "{get_response}");

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_sqlite_fcntl_shared_readers_overlap() {
    if skip_macos_lock_smoke("sqlite fcntl shared-reader smoke") {
        return;
    }

    let root = temp_dir("server-sqlite-fcntl-readers");
    write_script(
        &root,
        "seed.php",
        r#"<?php
ob_start();
$db = new SQLite3('/wordpress/sqlite-readers.db');
$ok = $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
$ok = $ok && $db->exec('INSERT INTO test (name) VALUES ("seed")');
if (!$ok) {
    ob_clean();
    echo json_encode(['error' => $db->lastErrorMsg()]);
    exit(1);
}
$db->close();
ob_clean();
echo json_encode(['ok' => true]);
"#,
    );
    fs::write(root.join("coordination.txt"), b"initial").unwrap();
    write_script(
        &root,
        "sqlite-reader-one.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
$db = new SQLite3('/wordpress/sqlite-readers.db');
$db->busyTimeout(1);
$db->exec('BEGIN DEFERRED;');
$value = $db->querySingle('SELECT name FROM test WHERE id = 1');
$read_error = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
file_put_contents($coordination, 'reader-one-active');
wait_for_stage($coordination, 'reader-two-finished');
$db->exec('COMMIT;');
$db->close();
ob_clean();
echo json_encode(['value' => $value, 'read_error' => $read_error]);
"#,
    );
    write_script(
        &root,
        "sqlite-reader-two.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
wait_for_stage($coordination, 'reader-one-active');
$db = new SQLite3('/wordpress/sqlite-readers.db');
$db->busyTimeout(1);
$db->exec('BEGIN DEFERRED;');
$value = @$db->querySingle('SELECT name FROM test WHERE id = 1');
$read_error = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
if ($read_error['last_error_code'] === 0) {
    $db->exec('COMMIT;');
} else {
    $db->exec('ROLLBACK;');
}
$db->close();
file_put_contents($coordination, 'reader-two-finished');
ob_clean();
echo json_encode(['value' => $value, 'read_error' => $read_error]);
"#,
    );

    let (address, guard, stderr_thread) = start_native_server(&root, 2);
    assert_eq!(response_json(&send_get(&address, "/seed.php"))["ok"], true);

    let first_address = address.clone();
    let first = thread::spawn(move || send_get(&first_address, "/sqlite-reader-one.php"));
    let second_address = address.clone();
    let second = thread::spawn(move || send_get(&second_address, "/sqlite-reader-two.php"));

    let first_json = response_json(&first.join().unwrap());
    let second_json = response_json(&second.join().unwrap());
    assert_eq!(first_json["value"], "seed", "{first_json}");
    assert_eq!(
        first_json["read_error"]["last_error_code"], 0,
        "{first_json}"
    );
    assert_eq!(second_json["value"], "seed", "{second_json}");
    assert_eq!(
        second_json["read_error"]["last_error_code"], 0,
        "{second_json}"
    );

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_sqlite_fcntl_reserved_writer_allows_concurrent_reader() {
    if skip_macos_lock_smoke("sqlite fcntl reserved-writer smoke") {
        return;
    }

    let root = temp_dir("server-sqlite-fcntl-writer-reader");
    write_script(
        &root,
        "seed.php",
        r#"<?php
ob_start();
$db = new SQLite3('/wordpress/sqlite-writer-reader.db');
$ok = $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
$ok = $ok && $db->exec('INSERT INTO test (name) VALUES ("before")');
$journal_mode = $db->querySingle('PRAGMA journal_mode=WAL');
if (!$ok) {
    ob_clean();
    echo json_encode(['error' => $db->lastErrorMsg()]);
    exit(1);
}
$db->close();
ob_clean();
echo json_encode(['ok' => true, 'journal_mode' => $journal_mode]);
"#,
    );
    fs::write(root.join("coordination.txt"), b"initial").unwrap();
    write_script(
        &root,
        "sqlite-writer.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
$db = new SQLite3('/wordpress/sqlite-writer-reader.db');
$db->busyTimeout(1);
$begin_ok = $db->exec('BEGIN IMMEDIATE;');
$update_ok = $begin_ok && $db->exec('UPDATE test SET name = "after" WHERE id = 1');
$write_error = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
file_put_contents($coordination, 'writer-ready');
wait_for_stage($coordination, 'reader-finished');
$commit_ok = $db->exec('COMMIT;');
$commit_error = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
$db->close();
ob_clean();
echo json_encode([
    'ok' => $begin_ok && $update_ok && $commit_ok,
    'write_error' => $write_error,
    'commit_error' => $commit_error,
]);
"#,
    );
    write_script(
        &root,
        "sqlite-reader.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
wait_for_stage($coordination, 'writer-ready');
$db = new SQLite3('/wordpress/sqlite-writer-reader.db');
$db->busyTimeout(1);
$db->exec('BEGIN DEFERRED;');
$value = @$db->querySingle('SELECT name FROM test WHERE id = 1');
$read_error = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
if ($read_error['last_error_code'] === 0) {
    $db->exec('COMMIT;');
} else {
    $db->exec('ROLLBACK;');
}
$db->close();
file_put_contents($coordination, 'reader-finished');
ob_clean();
echo json_encode(['value' => $value, 'read_error' => $read_error]);
"#,
    );
    write_script(
        &root,
        "sqlite-final.php",
        r#"<?php
ob_start();
$db = new SQLite3('/wordpress/sqlite-writer-reader.db');
$value = @$db->querySingle('SELECT name FROM test WHERE id = 1');
$read_error = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
$db->close();
ob_clean();
echo json_encode(['value' => $value, 'read_error' => $read_error]);
"#,
    );

    let (address, guard, stderr_thread) = start_native_server(&root, 2);
    let seed_json = response_json(&send_get(&address, "/seed.php"));
    assert_eq!(seed_json["ok"], true, "{seed_json}");
    assert_eq!(seed_json["journal_mode"], "wal", "{seed_json}");

    let writer_address = address.clone();
    let writer = thread::spawn(move || send_get(&writer_address, "/sqlite-writer.php"));
    let reader_address = address.clone();
    let reader = thread::spawn(move || send_get(&reader_address, "/sqlite-reader.php"));

    let writer_json = response_json(&writer.join().unwrap());
    let reader_json = response_json(&reader.join().unwrap());
    assert_eq!(writer_json["ok"], true, "{writer_json}");
    assert_eq!(reader_json["value"], "before", "{reader_json}");
    assert_eq!(
        reader_json["read_error"]["last_error_code"], 0,
        "{reader_json}"
    );
    let final_json = response_json(&send_get(&address, "/sqlite-final.php"));
    assert_eq!(final_json["value"], "after", "{final_json}");
    assert_eq!(
        final_json["read_error"]["last_error_code"], 0,
        "{final_json}"
    );

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_sqlite_fcntl_exclusive_lock_blocks_concurrent_writer() {
    if skip_macos_lock_smoke("sqlite fcntl lock smoke") {
        return;
    }

    let root = temp_dir("server-sqlite-fcntl-locks");
    write_script(
        &root,
        "seed.php",
        r#"<?php
ob_start();
$db = new SQLite3('/wordpress/sqlite-lock.db');
$ok = $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
if (!$ok) {
    ob_clean();
    echo json_encode(['error' => $db->lastErrorMsg()]);
    exit(1);
}
$db->close();
ob_clean();
echo json_encode(['ok' => true]);
"#,
    );
    fs::write(root.join("coordination.txt"), b"initial").unwrap();
    write_script(
        &root,
        "sqlite-holder.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
$db = new SQLite3('/wordpress/sqlite-lock.db');
$db->busyTimeout(1);
$db->exec('BEGIN EXCLUSIVE;');
file_put_contents($coordination, 'holder-locked');
wait_for_stage($coordination, 'contender-ready-for-unlock');
$db->exec('INSERT INTO test (name) VALUES ("holder")');
$db->exec('COMMIT;');
$db->close();
file_put_contents($coordination, 'holder-unlocked');
ob_clean();
echo json_encode(['pid' => getmypid()]);
"#,
    );
    write_script(
        &root,
        "sqlite-contender.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
wait_for_stage($coordination, 'holder-locked');
$db = new SQLite3('/wordpress/sqlite-lock.db');
$db->busyTimeout(1);
@$db->exec('INSERT INTO test (name) VALUES ("while-locked")');
$attempt_while_locked = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
file_put_contents($coordination, 'contender-ready-for-unlock');
wait_for_stage($coordination, 'holder-unlocked');
@$db->exec('INSERT INTO test (name) VALUES ("after-unlock")');
$attempt_after_unlock = [
    'last_error_code' => $db->lastErrorCode(),
    'last_error_msg' => $db->lastErrorMsg(),
];
$db->close();
ob_clean();
echo json_encode([
    'pid' => getmypid(),
    'attempt_while_locked' => $attempt_while_locked,
    'attempt_after_unlock' => $attempt_after_unlock,
]);
"#,
    );

    let (address, guard, stderr_thread) = start_native_server(&root, 2);
    assert_eq!(response_json(&send_get(&address, "/seed.php"))["ok"], true);

    let holder_address = address.clone();
    let holder = thread::spawn(move || send_get(&holder_address, "/sqlite-holder.php"));
    let contender_address = address.clone();
    let contender = thread::spawn(move || send_get(&contender_address, "/sqlite-contender.php"));

    let _holder_json = response_json(&holder.join().unwrap());
    let contender_json = response_json(&contender.join().unwrap());

    // The coordination handshake itself requires two workers to make progress.
    // WASI exposes a process-wide synthetic PID, so getmypid() is not a worker ID.
    assert_eq!(contender_json["attempt_while_locked"]["last_error_code"], 5);
    assert!(
        contender_json["attempt_while_locked"]["last_error_msg"]
            .as_str()
            .unwrap()
            .contains("database is locked"),
        "{contender_json}"
    );
    assert_eq!(contender_json["attempt_after_unlock"]["last_error_code"], 0);

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_sqlite_wal_exclusive_mode_flushes_before_switching_to_normal() {
    if skip_macos_lock_smoke("sqlite WAL exclusive-mode transition smoke") {
        return;
    }

    let root = temp_dir("server-sqlite-wal-exclusive-normal");
    write_script(
        &root,
        "seed.php",
        r#"<?php
ob_start();
$db = new SQLite3('/wordpress/sqlite-wal-exclusive-normal.db');
$journal_mode = $db->querySingle('PRAGMA journal_mode=WAL');
$ok = $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
$ok = $ok && $db->exec('INSERT INTO test VALUES (1, "before")');
$error = ['code' => $db->lastErrorCode(), 'message' => $db->lastErrorMsg()];
$db->close();
ob_clean();
echo json_encode(['ok' => $ok, 'journal_mode' => $journal_mode, 'error' => $error]);
"#,
    );
    fs::write(root.join("coordination.txt"), b"initial").unwrap();
    write_script(
        &root,
        "exclusive-writer.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) return true;
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
$db = new SQLite3('/wordpress/sqlite-wal-exclusive-normal.db');
$db->busyTimeout(1000);
$journal_mode = $db->querySingle('PRAGMA journal_mode');
$exclusive_mode = $db->querySingle('PRAGMA locking_mode=EXCLUSIVE');
$ok = $db->exec('BEGIN IMMEDIATE');
$ok = $ok && $db->exec('UPDATE test SET name = "after" WHERE id = 1');
$ok = $ok && $db->exec('COMMIT');
$normal_mode = $db->querySingle('PRAGMA locking_mode=NORMAL');
$transition_ok = $db->exec('BEGIN IMMEDIATE');
$transition_ok = $transition_ok && $db->exec('COMMIT');
$error = ['code' => $db->lastErrorCode(), 'message' => $db->lastErrorMsg()];
// NORMAL updates the pager setting immediately. The empty write transaction
// drives pager_end_transaction(), which performs WAL mode 1->0 and releases
// the main-database EXCLUSIVE lock while this mirror session remains open.
file_put_contents($coordination, 'writer-normal');
wait_for_stage($coordination, 'reader-finished');
$db->close();
ob_clean();
echo json_encode([
    'ok' => $ok,
    'journal_mode' => $journal_mode,
    'exclusive_mode' => $exclusive_mode,
    'normal_mode' => $normal_mode,
    'transition_ok' => $transition_ok,
    'error' => $error,
]);
"#,
    );
    write_script(
        &root,
        "normal-reader.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) return true;
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
wait_for_stage($coordination, 'writer-normal');
$db = new SQLite3('/wordpress/sqlite-wal-exclusive-normal.db');
$db->busyTimeout(1000);
$journal_mode = $db->querySingle('PRAGMA journal_mode');
$value = @$db->querySingle('SELECT name FROM test WHERE id = 1');
$error = ['code' => $db->lastErrorCode(), 'message' => $db->lastErrorMsg()];
$db->close();
file_put_contents($coordination, 'reader-finished');
ob_clean();
echo json_encode([
    'journal_mode' => $journal_mode,
    'value' => $value,
    'error' => $error,
]);
"#,
    );

    let (address, guard, stderr_thread) = start_native_server(&root, 2);
    let seed = response_json(&send_get(&address, "/seed.php"));
    assert_eq!(seed["ok"], true, "{seed}");
    assert_eq!(seed["journal_mode"], "wal", "{seed}");

    let writer_address = address.clone();
    let writer = thread::spawn(move || send_get(&writer_address, "/exclusive-writer.php"));
    let reader_address = address.clone();
    let reader = thread::spawn(move || send_get(&reader_address, "/normal-reader.php"));
    let writer_json = response_json(&writer.join().unwrap());
    let reader_json = response_json(&reader.join().unwrap());

    assert_eq!(writer_json["ok"], true, "{writer_json}");
    assert_eq!(writer_json["journal_mode"], "wal", "{writer_json}");
    assert_eq!(writer_json["exclusive_mode"], "exclusive", "{writer_json}");
    assert_eq!(writer_json["normal_mode"], "normal", "{writer_json}");
    assert_eq!(writer_json["transition_ok"], true, "{writer_json}");
    assert_eq!(writer_json["error"]["code"], 0, "{writer_json}");
    assert_eq!(reader_json["journal_mode"], "wal", "{reader_json}");
    assert_eq!(reader_json["value"], "after", "{reader_json}");
    assert_eq!(reader_json["error"]["code"], 0, "{reader_json}");

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_sqlite_wal_mode_persists_across_exclusive_close_and_reopen() {
    if skip_macos_lock_smoke("sqlite persisted journal-mode reopen smoke") {
        return;
    }

    let root = temp_dir("server-sqlite-wal-exclusive-reopen");
    fs::write(root.join("coordination.txt"), b"initial").unwrap();
    write_script(
        &root,
        "exclusive-close.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) return true;
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
$db = new SQLite3('/wordpress/sqlite-wal-exclusive-reopen.db');
$journal_mode = $db->querySingle('PRAGMA journal_mode=WAL');
$locking_mode = $db->querySingle('PRAGMA locking_mode=EXCLUSIVE');
$ok = $db->exec('BEGIN IMMEDIATE');
$ok = $ok && $db->exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
$ok = $ok && $db->exec('INSERT INTO test VALUES (1, "persisted")');
$ok = $ok && $db->exec('COMMIT');
$error = ['code' => $db->lastErrorCode(), 'message' => $db->lastErrorMsg()];
$db->close();
file_put_contents($coordination, 'writer-closed');
wait_for_stage($coordination, 'reader-finished');
ob_clean();
echo json_encode([
    'ok' => $ok,
    'journal_mode' => $journal_mode,
    'locking_mode' => $locking_mode,
    'error' => $error,
]);
"#,
    );
    write_script(
        &root,
        "reopen-reader.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) return true;
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
wait_for_stage($coordination, 'writer-closed');
$db = new SQLite3('/wordpress/sqlite-wal-exclusive-reopen.db');
$db->busyTimeout(1000);
$journal_mode = $db->querySingle('PRAGMA journal_mode');
$value = @$db->querySingle('SELECT name FROM test WHERE id = 1');
$error = ['code' => $db->lastErrorCode(), 'message' => $db->lastErrorMsg()];
$db->close();
file_put_contents($coordination, 'reader-finished');
ob_clean();
echo json_encode([
    'journal_mode' => $journal_mode,
    'value' => $value,
    'error' => $error,
]);
"#,
    );

    let (address, guard, stderr_thread) = start_native_server(&root, 2);
    let writer_address = address.clone();
    let writer = thread::spawn(move || send_get(&writer_address, "/exclusive-close.php"));
    let reader_address = address.clone();
    let reader = thread::spawn(move || send_get(&reader_address, "/reopen-reader.php"));
    let writer_json = response_json(&writer.join().unwrap());
    let reader_json = response_json(&reader.join().unwrap());

    assert_eq!(writer_json["ok"], true, "{writer_json}");
    assert_eq!(writer_json["journal_mode"], "wal", "{writer_json}");
    assert_eq!(writer_json["locking_mode"], "exclusive", "{writer_json}");
    assert_eq!(writer_json["error"]["code"], 0, "{writer_json}");
    assert_eq!(reader_json["journal_mode"], "wal", "{reader_json}");
    assert_eq!(reader_json["value"], "persisted", "{reader_json}");
    assert_eq!(reader_json["error"]["code"], 0, "{reader_json}");

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native server process execution is an explicit smoke test."]
fn native_server_flock_shared_lock_blocks_concurrent_exclusive_lock() {
    if skip_macos_lock_smoke("flock lock smoke") {
        return;
    }

    let root = temp_dir("server-flock-locks");
    fs::write(root.join("locked.txt"), b"test content").unwrap();
    fs::write(root.join("coordination.txt"), b"initial").unwrap();
    write_script(
        &root,
        "flock-shared-holder.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
$fp = fopen('/wordpress/locked.txt', 'r+');
$lock_acquired = flock($fp, LOCK_SH | LOCK_NB);
file_put_contents($coordination, 'shared-locked');
wait_for_stage($coordination, 'exclusive-ready-for-unlock');
if ($lock_acquired) {
    flock($fp, LOCK_UN);
}
fclose($fp);
file_put_contents($coordination, 'shared-unlocked');
ob_clean();
echo json_encode(['pid' => getmypid(), 'lock_acquired' => $lock_acquired]);
"#,
    );
    write_script(
        &root,
        "flock-exclusive-contender.php",
        r#"<?php
ob_start();
function wait_for_stage($path, $stage) {
    for ($i = 0; $i < 1200; $i++) {
        if (trim((string) @file_get_contents($path)) === $stage) {
            return true;
        }
        usleep(100 * 1000);
    }
    ob_clean();
    echo json_encode(['error' => 'timeout', 'waiting_for' => $stage]);
    exit(2);
}
$coordination = '/wordpress/coordination.txt';
wait_for_stage($coordination, 'shared-locked');
$fp = fopen('/wordpress/locked.txt', 'r+');
$lock_result = flock($fp, LOCK_EX | LOCK_NB);
$attempt_while_shared_locked = ['lock_acquired' => $lock_result];
if ($lock_result) {
    flock($fp, LOCK_UN);
}
fclose($fp);
file_put_contents($coordination, 'exclusive-ready-for-unlock');
wait_for_stage($coordination, 'shared-unlocked');
$fp = fopen('/wordpress/locked.txt', 'r+');
$lock_result = flock($fp, LOCK_EX | LOCK_NB);
$attempt_after_unlock = ['lock_acquired' => $lock_result];
if ($lock_result) {
    flock($fp, LOCK_UN);
}
fclose($fp);
ob_clean();
echo json_encode([
    'pid' => getmypid(),
    'attempt_while_shared_locked' => $attempt_while_shared_locked,
    'attempt_after_unlock' => $attempt_after_unlock,
]);
"#,
    );

    let (address, guard, stderr_thread) = start_native_server(&root, 2);
    let holder_address = address.clone();
    let holder = thread::spawn(move || send_get(&holder_address, "/flock-shared-holder.php"));
    let contender_address = address.clone();
    let contender =
        thread::spawn(move || send_get(&contender_address, "/flock-exclusive-contender.php"));

    let holder_json = response_json(&holder.join().unwrap());
    let contender_json = response_json(&contender.join().unwrap());

    // The coordination handshake itself requires two workers to make progress.
    // WASI exposes a process-wide synthetic PID, so getmypid() is not a worker ID.
    assert_eq!(holder_json["lock_acquired"], true);
    assert_eq!(
        contender_json["attempt_while_shared_locked"]["lock_acquired"],
        false
    );
    assert_eq!(
        contender_json["attempt_after_unlock"]["lock_acquired"],
        true
    );

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native control streaming execution is an explicit smoke test."]
fn native_control_streams_incrementally_cancels_cpu_bound_php_and_recovers_worker() {
    let root = temp_dir("control-streaming");
    write_script(
        &root,
        "flush.php",
        r#"<?php
header('X-Native-Stream: yes');
while (ob_get_level() > 0) {
    ob_end_flush();
}
echo 'first';
flush();
usleep(900000);
echo 'second';
"#,
    );
    write_script(
        &root,
        "loop.php",
        r#"<?php
while (ob_get_level() > 0) {
    ob_end_flush();
}
echo 'started';
flush();
while (true) {}
"#,
    );
    write_script(
        &root,
        "hold.php",
        r#"<?php
while (ob_get_level() > 0) {
    ob_end_flush();
}
echo 'holder-started';
flush();
usleep(2000000);
echo 'holder-finished';
"#,
    );
    write_script(&root, "queued.php", "<?php echo 'queued';");
    write_script(
        &root,
        "buffered-failure.php",
        "<?php error_log('buffered-stderr-marker'); exit(7);",
    );
    write_script(
        &root,
        "early-errors.php",
        r#"<?php
error_log('early-log-marker');
trigger_error('early-warning-marker', E_USER_WARNING);
header('X-Early-Errors: yes');
echo 'after-early-errors';
"#,
    );
    write_script(
        &root,
        "fatal-before-output.php",
        "<?php native_control_missing_function_for_fatal_test();",
    );
    write_script(
        &root,
        "oversized-headers.php",
        r#"<?php
for ($index = 0; $index < 400; $index++) {
    header('X-Oversized-' . $index . ': ' . str_repeat('x', 256));
}
echo 'must-not-cross-the-control-boundary';
"#,
    );
    write_script(&root, "recover.php", "<?php echo 'recovered';");
    let (control_url, native_address, token, handshake_root, guard, stderr_thread) =
        start_native_control_server(&root, 1);

    let buffered = control_rpc(
        &control_url,
        &token,
        r#"{"protocolVersion":2,"id":100,"method":"request","params":{"path":"/buffered-failure.php"}}"#,
    );
    assert_eq!(buffered["result"]["exitCode"], 7);
    assert_eq!(buffered["result"]["httpStatusCode"], 500);
    assert_eq!(buffered["result"]["stderr"]["encoding"], "base64");
    let buffered_stderr = BASE64
        .decode(buffered["result"]["stderr"]["data"].as_str().unwrap())
        .unwrap();
    assert!(
        String::from_utf8_lossy(&buffered_stderr).contains("buffered-stderr-marker"),
        "{}",
        String::from_utf8_lossy(&buffered_stderr)
    );

    let early_body = r#"{"protocolVersion":2,"id":105,"method":"requestStreamed","params":{"path":"/early-errors.php"}}"#;
    let mut early_stream = open_control_stream(&control_url, &token, early_body);
    let early_frames = read_control_stream_to_terminal(&mut early_stream);
    assert_eq!(early_frames[0]["type"], "headers");
    assert_eq!(early_frames.last().unwrap()["type"], "complete");
    let early_stdout = decoded_stream_channel(&early_frames, "stdout");
    assert!(
        String::from_utf8_lossy(&early_stdout).contains("after-early-errors"),
        "{}",
        String::from_utf8_lossy(&early_stdout)
    );
    let early_stderr = decoded_stream_channel(&early_frames, "stderr");
    let early_stderr = String::from_utf8_lossy(&early_stderr);
    assert!(early_stderr.contains("early-log-marker"), "{early_stderr}");
    assert!(
        early_stderr.contains("early-warning-marker"),
        "{early_stderr}"
    );

    let fatal_body = r#"{"protocolVersion":2,"id":106,"method":"requestStreamed","params":{"path":"/fatal-before-output.php"}}"#;
    let mut fatal_stream = open_control_stream(&control_url, &token, fatal_body);
    let fatal_frames = read_control_stream_to_terminal(&mut fatal_stream);
    assert_eq!(fatal_frames[0]["type"], "headers");
    let fatal_stderr = decoded_stream_channel(&fatal_frames, "stderr");
    assert!(
        String::from_utf8_lossy(&fatal_stderr)
            .contains("native_control_missing_function_for_fatal_test"),
        "{}",
        String::from_utf8_lossy(&fatal_stderr)
    );

    let oversized_body = r#"{"protocolVersion":2,"id":107,"method":"requestStreamed","params":{"path":"/oversized-headers.php"}}"#;
    let mut oversized_stream = open_control_stream(&control_url, &token, oversized_body);
    let oversized = read_control_stream_frame(&mut oversized_stream);
    assert_eq!(oversized["type"], "error");
    assert_eq!(
        oversized["error"]["code"],
        "ERR_WP_PLAYGROUND_NATIVE_RUNTIME"
    );
    assert!(
        oversized["error"]["message"]
            .as_str()
            .unwrap()
            .contains("64 KiB"),
        "{oversized}"
    );
    let recovered_after_header_rejection = send_get(&native_address, "/recover.php");
    assert_ok(&recovered_after_header_rejection);
    assert_eq!(recovered_after_header_rejection.body, "recovered");

    let holder_body = r#"{"protocolVersion":2,"id":108,"method":"requestStreamed","params":{"path":"/hold.php"}}"#;
    let mut holder_stream = open_control_stream(&control_url, &token, holder_body);
    assert_eq!(
        read_control_stream_frame(&mut holder_stream)["type"],
        "headers"
    );
    assert_eq!(
        read_control_stream_frame(&mut holder_stream)["data"]["data"],
        "aG9sZGVyLXN0YXJ0ZWQ="
    );
    let queued_body = r#"{"protocolVersion":2,"id":109,"method":"requestStreamed","params":{"path":"/queued.php"}}"#;
    let mut queued_stream = open_control_stream(&control_url, &token, queued_body);
    let queued_cancelled_at = Instant::now();
    assert_eq!(
        cancel_control_stream(&control_url, &token, 109)["result"]["cancelled"],
        true
    );
    let queued_error = read_control_stream_frame(&mut queued_stream);
    assert_eq!(queued_error["type"], "error");
    assert_eq!(
        queued_error["error"]["code"],
        "ERR_WP_PLAYGROUND_NATIVE_ABORTED"
    );
    assert!(
        queued_cancelled_at.elapsed() < Duration::from_millis(500),
        "a cancelled request waited for the busy PHP worker"
    );
    assert_eq!(
        read_control_stream_frame(&mut holder_stream)["data"]["data"],
        "aG9sZGVyLWZpbmlzaGVk"
    );
    assert_eq!(
        read_control_stream_frame(&mut holder_stream)["type"],
        "complete"
    );

    let flush_body = r#"{"protocolVersion":2,"id":101,"method":"requestStreamed","params":{"path":"/flush.php"}}"#;
    let mut flush_stream = open_control_stream(&control_url, &token, flush_body);
    let headers = read_control_stream_frame(&mut flush_stream);
    assert_eq!(headers["type"], "headers");
    assert_eq!(headers["httpStatusCode"], 200);
    assert!(
        headers["headers"].as_array().unwrap().iter().any(|header| {
            header["name"]
                .as_str()
                .is_some_and(|name| name.eq_ignore_ascii_case("X-Native-Stream"))
                && header["value"] == "yes"
        }),
        "the streamed headers did not include X-Native-Stream: yes"
    );
    let headers_received_at = Instant::now();
    let first = read_control_stream_frame(&mut flush_stream);
    assert_eq!(first["type"], "stdout");
    assert_eq!(first["data"]["data"], "Zmlyc3Q=");
    assert!(
        headers_received_at.elapsed() < Duration::from_millis(300),
        "the first PHP flush did not follow its headers promptly"
    );
    let first_received_at = Instant::now();
    let second = read_control_stream_frame(&mut flush_stream);
    assert_eq!(second["type"], "stdout");
    assert_eq!(second["data"]["data"], "c2Vjb25k");
    assert!(
        first_received_at.elapsed() >= Duration::from_millis(650),
        "the first and second PHP writes were buffered together"
    );
    let complete = read_control_stream_frame(&mut flush_stream);
    assert_eq!(complete["type"], "complete");

    let loop_body = r#"{"protocolVersion":2,"id":102,"method":"requestStreamed","params":{"path":"/loop.php"}}"#;
    let mut loop_stream = open_control_stream(&control_url, &token, loop_body);
    assert_eq!(
        read_control_stream_frame(&mut loop_stream)["type"],
        "headers"
    );
    assert_eq!(
        read_control_stream_frame(&mut loop_stream)["type"],
        "stdout"
    );
    let cancelled_at = Instant::now();
    let cancel = cancel_control_stream(&control_url, &token, 102);
    assert_eq!(cancel["result"]["cancelled"], true);
    let error = read_control_stream_frame(&mut loop_stream);
    assert_eq!(error["type"], "error");
    assert_eq!(error["error"]["code"], "ERR_WP_PLAYGROUND_NATIVE_ABORTED");
    assert!(
        cancelled_at.elapsed() < Duration::from_secs(2),
        "CPU-bound PHP did not observe epoch cancellation promptly"
    );

    let recovered = send_get(&native_address, "/recover.php");
    assert_ok(&recovered);
    assert_eq!(recovered.body, "recovered");

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(handshake_root);
    let _ = fs::remove_dir_all(root);
}

#[test]
#[ignore = "Full native control streaming execution is an explicit smoke test."]
fn native_control_cancellation_is_isolated_between_two_active_php_stores() {
    let root = temp_dir("control-cancellation-isolation");
    write_script(
        &root,
        "survivor.php",
        r#"<?php
while (ob_get_level() > 0) {
    ob_end_flush();
}
echo 'survivor-started';
flush();
$finishAt = microtime(true) + 1.5;
while (microtime(true) < $finishAt) {}
echo 'survivor-finished';
"#,
    );
    write_script(
        &root,
        "cancelled.php",
        r#"<?php
while (ob_get_level() > 0) {
    ob_end_flush();
}
echo 'cancelled-started';
flush();
while (true) {}
"#,
    );
    write_script(&root, "isolation-recover.php", "<?php echo 'recovered';");
    let (control_url, native_address, token, handshake_root, guard, stderr_thread) =
        start_native_control_server(&root, 2);

    let survivor_body = r#"{"protocolVersion":2,"id":201,"method":"requestStreamed","params":{"path":"/survivor.php"}}"#;
    let mut survivor = open_control_stream(&control_url, &token, survivor_body);
    assert_eq!(read_control_stream_frame(&mut survivor)["type"], "headers");
    assert_eq!(
        read_control_stream_frame(&mut survivor)["data"]["data"],
        "c3Vydml2b3Itc3RhcnRlZA=="
    );

    let cancelled_body = r#"{"protocolVersion":2,"id":202,"method":"requestStreamed","params":{"path":"/cancelled.php"}}"#;
    let mut cancelled = open_control_stream(&control_url, &token, cancelled_body);
    assert_eq!(read_control_stream_frame(&mut cancelled)["type"], "headers");
    assert_eq!(
        read_control_stream_frame(&mut cancelled)["data"]["data"],
        "Y2FuY2VsbGVkLXN0YXJ0ZWQ="
    );

    let cancelled_at = Instant::now();
    assert_eq!(
        cancel_control_stream(&control_url, &token, 202)["result"]["cancelled"],
        true
    );
    let cancelled_terminal = read_control_stream_frame(&mut cancelled);
    assert_eq!(cancelled_terminal["type"], "error");
    assert_eq!(
        cancelled_terminal["error"]["code"],
        "ERR_WP_PLAYGROUND_NATIVE_ABORTED"
    );
    assert!(
        cancelled_at.elapsed() < Duration::from_secs(2),
        "the selected Store did not observe cancellation promptly"
    );

    let survivor_output = read_control_stream_frame(&mut survivor);
    assert_eq!(survivor_output["type"], "stdout");
    assert_eq!(survivor_output["data"]["data"], "c3Vydml2b3ItZmluaXNoZWQ=");
    let survivor_terminal = read_control_stream_frame(&mut survivor);
    assert_eq!(survivor_terminal["type"], "complete");
    assert_eq!(survivor_terminal["exitCode"], 0);

    let recovered = send_get(&native_address, "/isolation-recover.php");
    assert_ok(&recovered);
    assert_eq!(recovered.body, "recovered");

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(handshake_root);
    let _ = fs::remove_dir_all(root);
}

fn send_raw_http(address: &str, request: &str) -> String {
    let mut stream = TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(HTTP_RESPONSE_TIMEOUT))
        .unwrap();
    stream
        .set_write_timeout(Some(Duration::from_secs(20)))
        .unwrap();
    stream.write_all(request.as_bytes()).unwrap();

    let mut response = Vec::new();
    let mut buffer = [0u8; 8192];
    let deadline = Instant::now() + HTTP_RESPONSE_TIMEOUT;
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => response.extend_from_slice(&buffer[..count]),
            Err(error) if is_retryable_response_read_error(&error) && !response.is_empty() => {
                break;
            }
            Err(error) if is_retryable_response_read_error(&error) && Instant::now() < deadline => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => panic!("failed reading HTTP response from {address}: {error}"),
        }
    }
    assert!(
        !response.is_empty(),
        "server at {address} returned no HTTP response"
    );
    String::from_utf8_lossy(&response).to_string()
}

fn is_retryable_response_read_error(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::TimedOut
            | std::io::ErrorKind::WouldBlock
            | std::io::ErrorKind::Interrupted
    ) || matches!(error.raw_os_error(), Some(11 | 35))
}

fn skip_macos_lock_smoke(name: &str) -> bool {
    if cfg!(target_os = "macos") {
        eprintln!("skipping {name} on macOS CI; covered by dedicated file-locking jobs");
        return true;
    }
    false
}
