use std::{
    env, fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};

use reqwest::{blocking::Client, redirect::Policy};

use crate::{sha1::sha1_hex, CliError, Result};

const USER_AGENT: &str = "wp-playground-native/0.1";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const DEFAULT_MAX_DOWNLOAD_BYTES: u64 = 256 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES_ENV_VAR: &str = "WP_PLAYGROUND_NATIVE_MAX_DOWNLOAD_BYTES";

pub fn playground_cache_dir() -> Result<PathBuf> {
    let home = home_dir().ok_or_else(|| CliError::new("Could not determine home directory"))?;
    Ok(home.join(".wordpress-playground"))
}

pub fn cached_download(url: &str, cache_key: &str) -> Result<PathBuf> {
    let cache_dir = playground_cache_dir()?;
    cached_download_in(url, cache_key, &cache_dir)
}

pub fn cached_download_with_validator<F>(url: &str, cache_key: &str, validate: F) -> Result<PathBuf>
where
    F: Fn(&Path) -> Result<()>,
{
    let cache_dir = playground_cache_dir()?;
    cached_download_in_with_validator(url, cache_key, &cache_dir, validate)
}

pub fn cached_download_in(url: &str, cache_key: &str, cache_dir: &Path) -> Result<PathBuf> {
    let cache_key = sanitize_cache_key(cache_key);
    let target = cache_dir.join(cache_key);
    if target.is_file() {
        return Ok(target);
    }

    fs::create_dir_all(cache_dir)?;
    download_to_path(url, &target)?;
    Ok(target)
}

pub fn cached_download_in_with_validator<F>(
    url: &str,
    cache_key: &str,
    cache_dir: &Path,
    validate: F,
) -> Result<PathBuf>
where
    F: Fn(&Path) -> Result<()>,
{
    let cache_key = sanitize_cache_key(cache_key);
    let target = cache_dir.join(cache_key);
    if target.is_file() {
        match validate(&target) {
            Ok(()) => return Ok(target),
            Err(_) => {
                fs::remove_file(&target).map_err(|error| {
                    CliError::new(format!(
                        "Cached download at {} failed validation and could not be removed: {error}",
                        target.display()
                    ))
                })?;
            }
        }
    }

    fs::create_dir_all(cache_dir)?;
    download_to_path(url, &target)?;
    if let Err(error) = validate(&target) {
        let _ = fs::remove_file(&target);
        return Err(CliError::new(format!(
            "Downloaded file from {url} failed validation: {error}"
        )));
    }
    Ok(target)
}

pub fn download_bytes(url: &str) -> Result<Vec<u8>> {
    download_bytes_with_limit(url, max_download_bytes())
}

fn download_bytes_with_limit(url: &str, max_bytes: u64) -> Result<Vec<u8>> {
    let client = http_client()?;
    let mut response = client
        .get(url)
        .send()
        .map_err(|error| CliError::new(format!("Failed to download {url}: {error}")))?;
    if !response.status().is_success() {
        return Err(CliError::new(format!(
            "Failed to download {url}: HTTP {}",
            response.status()
        )));
    }
    reject_oversized_content_length(url, response.content_length(), max_bytes)?;

    let mut bytes = Vec::new();
    copy_limited(&mut response, &mut bytes, max_bytes, url)?;
    Ok(bytes)
}

pub fn url_cache_key(prefix: &str, url: &str, extension: &str) -> String {
    let digest = sha1_hex(url.as_bytes());
    format!("{prefix}-{}{}", &digest[..8], extension)
}

fn download_to_path(url: &str, target: &Path) -> Result<()> {
    download_to_path_with_limit(url, target, max_download_bytes())
}

fn download_to_path_with_limit(url: &str, target: &Path, max_bytes: u64) -> Result<()> {
    let client = http_client()?;
    let mut response = client
        .get(url)
        .send()
        .map_err(|error| CliError::new(format!("Failed to download {url}: {error}")))?;
    if !response.status().is_success() {
        return Err(CliError::new(format!(
            "Failed to download {url}: HTTP {}",
            response.status()
        )));
    }
    reject_oversized_content_length(url, response.content_length(), max_bytes)?;

    let partial = partial_path(target);
    let _ = fs::remove_file(&partial);
    let mut output = fs::File::create(&partial)?;
    if let Err(error) = copy_limited(&mut response, &mut output, max_bytes, url) {
        let _ = fs::remove_file(&partial);
        return Err(error);
    }
    output.flush()?;
    drop(output);

    fs::rename(&partial, target).map_err(|error| {
        let _ = fs::remove_file(&partial);
        CliError::new(format!(
            "Failed to move downloaded file into place at {}: {error}",
            target.display()
        ))
    })
}

fn max_download_bytes() -> u64 {
    env::var(MAX_DOWNLOAD_BYTES_ENV_VAR)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_MAX_DOWNLOAD_BYTES)
}

fn reject_oversized_content_length(
    url: &str,
    content_length: Option<u64>,
    max_bytes: u64,
) -> Result<()> {
    if content_length.is_some_and(|length| length > max_bytes) {
        return Err(download_too_large_error(url, max_bytes));
    }
    Ok(())
}

fn copy_limited<R, W>(reader: &mut R, writer: &mut W, max_bytes: u64, url: &str) -> Result<u64>
where
    R: Read,
    W: Write,
{
    let mut total = 0_u64;
    let mut buffer = [0_u8; 16 * 1024];
    loop {
        let read = reader.read(&mut buffer).map_err(|error| {
            CliError::new(format!("Failed to read response from {url}: {error}"))
        })?;
        if read == 0 {
            break;
        }
        total = total.saturating_add(read as u64);
        if total > max_bytes {
            return Err(download_too_large_error(url, max_bytes));
        }
        writer.write_all(&buffer[..read]).map_err(|error| {
            CliError::new(format!("Failed to write download from {url}: {error}"))
        })?;
    }
    Ok(total)
}

fn download_too_large_error(url: &str, max_bytes: u64) -> CliError {
    CliError::new(format!(
        "Download from {url} exceeds the configured limit of {max_bytes} bytes; set {MAX_DOWNLOAD_BYTES_ENV_VAR} to raise the limit"
    ))
}

fn http_client() -> Result<Client> {
    Client::builder()
        .redirect(Policy::limited(10))
        .timeout(REQUEST_TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| CliError::new(format!("Failed to initialize HTTP client: {error}")))
}

fn partial_path(target: &Path) -> PathBuf {
    let mut name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download")
        .to_string();
    name.push_str(".partial");
    target.with_file_name(name)
}

fn sanitize_cache_key(cache_key: &str) -> String {
    cache_key
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect()
}

fn home_dir() -> Option<PathBuf> {
    if cfg!(windows) {
        env::var_os("USERPROFILE").map(PathBuf::from).or_else(|| {
            let drive = env::var_os("HOMEDRIVE")?;
            let path = env::var_os("HOMEPATH")?;
            let mut home = PathBuf::from(drive);
            home.push(path);
            Some(home)
        })
    } else {
        env::var_os("HOME").map(PathBuf::from)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        io::{Read, Write},
        net::TcpListener,
        path::PathBuf,
        thread::{self, JoinHandle},
    };

    use super::{
        cached_download_in, cached_download_in_with_validator, download_bytes,
        download_bytes_with_limit, download_to_path_with_limit, partial_path, sanitize_cache_key,
        url_cache_key,
    };

    #[test]
    fn sanitizes_cache_keys_for_paths() {
        assert_eq!(
            sanitize_cache_key("custom:https://example.com/a?b=c.zip"),
            "custom-https---example.com-a-b-c.zip"
        );
    }

    #[test]
    fn url_cache_keys_are_stable_and_short() {
        let key = url_cache_key("custom", "https://example.com/wordpress.zip", ".zip");

        assert!(key.starts_with("custom-"));
        assert!(key.ends_with(".zip"));
        assert_eq!(key.len(), "custom-".len() + 8 + ".zip".len());
    }

    #[test]
    fn keeps_existing_cached_file_without_network() {
        let dir = temp_dir("cached");
        let cached = dir.join("wordpress.zip");
        fs::write(&cached, b"cached").unwrap();

        let path =
            cached_download_in("https://example.invalid/file.zip", "wordpress.zip", &dir).unwrap();

        assert_eq!(path, cached);
        assert_eq!(fs::read(path).unwrap(), b"cached");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn downloads_bytes_from_http_server() {
        let (url, handle) = spawn_http_server(b"payload".to_vec());

        let bytes = download_bytes(&url).unwrap();

        assert_eq!(bytes, b"payload");
        handle.join().unwrap();
    }

    #[test]
    fn rejects_oversized_byte_downloads() {
        let (url, handle) = spawn_http_server(b"payload".to_vec());

        let error = download_bytes_with_limit(&url, 3).unwrap_err().to_string();

        assert!(error.contains("configured limit"), "{error}");
        handle.join().unwrap();
    }

    #[test]
    fn rejects_oversized_file_downloads_and_removes_partial() {
        let dir = temp_dir("oversized-file");
        let target = dir.join("remote.zip");
        let (url, handle) = spawn_http_server(b"payload".to_vec());

        let error = download_to_path_with_limit(&url, &target, 3)
            .unwrap_err()
            .to_string();

        assert!(error.contains("configured limit"), "{error}");
        assert!(!target.exists());
        assert!(!partial_path(&target).exists());
        handle.join().unwrap();
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn cached_download_writes_and_reuses_http_response() {
        let dir = temp_dir("download");
        let (url, handle) = spawn_http_server(b"remote zip".to_vec());

        let path = cached_download_in(&url, "remote.zip", &dir).unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"remote zip");
        handle.join().unwrap();

        let cached =
            cached_download_in("https://example.invalid/remote.zip", "remote.zip", &dir).unwrap();
        assert_eq!(cached, path);
        assert_eq!(fs::read(cached).unwrap(), b"remote zip");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn cached_download_with_validator_replaces_invalid_cached_file() {
        let dir = temp_dir("validated-download");
        let cached = dir.join("remote.zip");
        fs::write(&cached, b"bad").unwrap();
        let (url, handle) = spawn_http_server(b"valid zip".to_vec());

        let path = cached_download_in_with_validator(&url, "remote.zip", &dir, |path| {
            let bytes = fs::read(path)?;
            if bytes == b"valid zip" {
                Ok(())
            } else {
                Err(crate::CliError::new("invalid cached payload"))
            }
        })
        .unwrap();

        assert_eq!(path, cached);
        assert_eq!(fs::read(path).unwrap(), b"valid zip");
        handle.join().unwrap();
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn cached_download_with_validator_removes_invalid_download() {
        let dir = temp_dir("invalid-download");
        let (url, handle) = spawn_http_server(b"bad".to_vec());

        let error = cached_download_in_with_validator(&url, "remote.zip", &dir, |path| {
            let bytes = fs::read(path)?;
            if bytes == b"valid zip" {
                Ok(())
            } else {
                Err(crate::CliError::new("invalid downloaded payload"))
            }
        })
        .unwrap_err();

        assert!(error.to_string().contains("failed validation"));
        assert!(!dir.join("remote.zip").exists());
        handle.join().unwrap();
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn partial_path_keeps_target_directory() {
        let target = PathBuf::from("/tmp/wp.zip");

        assert_eq!(partial_path(&target), PathBuf::from("/tmp/wp.zip.partial"));
    }

    fn temp_dir(name: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir =
            std::env::temp_dir().join(format!("wp-playground-native-download-{name}-{unique}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn spawn_http_server(body: Vec<u8>) -> (String, JoinHandle<()>) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 1024];
            let _ = stream.read(&mut request).unwrap();
            let headers = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(headers.as_bytes());
            let _ = stream.write_all(&body);
        });
        (url, handle)
    }
}
