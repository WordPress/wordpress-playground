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
            "--workers=4",
            "--reset",
            "--php=8.5",
            "--wp=6.9",
            "--login",
            "--redis",
            "--memcached",
            "--xdebug",
            "--verbosity=debug",
        ])
        .current_dir(&cwd)
        .env("HOME", &home)
        .env("WP_PLAYGROUND_NATIVE_LAZY_WORKERS", "1")
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
    assert!(
        !editor.body.contains("asyncify_stop_unwind"),
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
            !response.body.contains("asyncify_stop_unwind"),
            "{}",
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
            .contains("asyncify_stop_unwind"),
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
        !recent_stderr.contains("asyncify_stop_unwind"),
        "{recent_stderr}"
    );
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
        "<?php header('X-Native-Server: ok'); echo 'native-server-ok';",
    )
    .unwrap();

    let (address, guard, stderr_thread) = start_native_server(&root, 1);
    let response = send_raw_http(
        &address,
        "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
    );

    assert!(response.starts_with("HTTP/1.1 200 OK\r\n"), "{response}");
    assert!(response.contains("X-Native-Server: ok\r\n"), "{response}");
    assert!(response.ends_with("native-server-ok"), "{response}");

    drop(guard);
    let _ = stderr_thread.join();
    let _ = fs::remove_dir_all(root);
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
#[test]
#[ignore = "Full packaged Wasmtime async execution is an explicit smoke test."]
fn packaged_wasmtime_async_runs_full_wordpress_smokes() {
    let _serial_guard = SERVER_SMOKE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let out_dir = temp_dir("packaged-wasmtime-async");
    let package_name = "wp-playground-native-wasmtime-async-smoke";
    let output = Command::new(env!("CARGO_BIN_EXE_package-native-cli"))
        .arg("--binary")
        .arg(env!("CARGO_BIN_EXE_wp-playground-native"))
        .arg("--out-dir")
        .arg(&out_dir)
        .arg("--name")
        .arg(package_name)
        .arg("--skip-archive")
        .arg("--smoke-wordpress-server=8.3")
        .arg("--smoke-run-blueprint=8.3")
        .arg("--smoke-build-snapshot=8.3")
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
#[ignore = "Full packaged start command execution is an explicit smoke test."]
fn packaged_start_command_serves_default_wordpress() {
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
        .args(["start", "--skip-browser", "--port=0"])
        .current_dir(&cwd)
        .env("HOME", &home)
        .env_remove("WP_PLAYGROUND_NATIVE_ASSET_ROOT")
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

    let holder_json = response_json(&holder.join().unwrap());
    let contender_json = response_json(&contender.join().unwrap());

    assert_ne!(
        holder_json["pid"].as_i64().unwrap(),
        contender_json["pid"].as_i64().unwrap()
    );
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

    assert_ne!(
        holder_json["pid"].as_i64().unwrap(),
        contender_json["pid"].as_i64().unwrap()
    );
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
