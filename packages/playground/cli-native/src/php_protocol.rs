/// A backend-neutral PHP request passed to the component handler.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpRequest {
    pub script_path: String,
    pub request_uri: String,
    pub method: String,
    pub host: String,
    pub port: u32,
    pub body: Vec<u8>,
    pub content_type: Option<String>,
    pub cookies: Option<String>,
    pub server_entries: Vec<(String, String)>,
    pub env: Vec<(String, String)>,
}

impl PhpRequest {
    pub fn for_script(script_path: impl Into<String>) -> Self {
        let script_path = script_path.into();
        Self {
            request_uri: script_path.clone(),
            script_path,
            method: "GET".to_string(),
            host: "127.0.0.1:9400".to_string(),
            port: 9400,
            body: Vec::new(),
            content_type: None,
            cookies: None,
            server_entries: Vec::new(),
            env: Vec::new(),
        }
    }
}

/// Response bytes captured from the component output interface.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpResponse {
    pub exit_code: i32,
    pub http_status: u16,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub headers: Vec<String>,
}
