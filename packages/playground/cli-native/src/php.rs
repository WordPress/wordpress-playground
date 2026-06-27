use std::path::PathBuf;

use wasmtime::{Instance, Memory, Module, TypedFunc};

use crate::{
    host::{AsyncifyState, HostOptions, PhpConstantValue, PhpExitStatus, StubImportLinker},
    runtime::NativeRuntime,
    CliError, Result,
};

pub const PHP_INI_PATH: &str = "/internal/shared/php.ini";

type PhpExport2I32Slot = fn(&mut PhpExportCache) -> &mut Option<TypedFunc<(u32, u32), i32>>;
type PhpExport2VoidSlot = fn(&mut PhpExportCache) -> &mut Option<TypedFunc<(u32, u32), ()>>;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpResponse {
    pub exit_code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub headers: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhpMemoryStats {
    pub memory_size_bytes: u64,
    pub sbrk_end: Option<u32>,
    pub zend_memory_usage: Option<u32>,
    pub zend_memory_real_usage: Option<u32>,
}

pub struct PhpInstance {
    linker: StubImportLinker,
    instance: Instance,
    exports: PhpExportCache,
    php_initialized: bool,
    bulk_sapi_request_supported: bool,
}

#[derive(Default)]
struct PhpExportCache {
    memory: Option<Memory>,
    malloc: Option<TypedFunc<u32, u32>>,
    free: Option<TypedFunc<u32, ()>>,
    php_wasm_init: Option<TypedFunc<(), i32>>,
    wasm_set_phpini_path: Option<TypedFunc<u32, ()>>,
    wasm_set_sapi_name: Option<TypedFunc<u32, i32>>,
    wasm_add_cli_arg: Option<TypedFunc<u32, ()>>,
    wasm_set_query_string: Option<TypedFunc<u32, ()>>,
    wasm_set_path_translated: Option<TypedFunc<u32, ()>>,
    wasm_set_request_uri: Option<TypedFunc<u32, ()>>,
    wasm_set_request_method: Option<TypedFunc<u32, ()>>,
    wasm_set_request_host: Option<TypedFunc<u32, ()>>,
    wasm_set_request_port: Option<TypedFunc<u32, ()>>,
    wasm_set_content_type: Option<TypedFunc<u32, ()>>,
    wasm_set_content_length: Option<TypedFunc<u32, ()>>,
    wasm_set_request_body: Option<TypedFunc<u32, ()>>,
    wasm_set_cookies: Option<TypedFunc<u32, ()>>,
    wasm_add_server_entry: Option<TypedFunc<(u32, u32), ()>>,
    wasm_add_env_entry: Option<TypedFunc<(u32, u32), ()>>,
    wasm_sapi_set_request: Option<TypedFunc<(u32, u32), i32>>,
    wasm_sapi_handle_request: Option<TypedFunc<(), i32>>,
    run_cli: Option<TypedFunc<(), i32>>,
    asyncify_stop_unwind: Option<TypedFunc<(), ()>>,
    asyncify_start_rewind: Option<TypedFunc<u32, ()>>,
}

impl NativeRuntime {
    pub fn instantiate_php_with_stub_host(&self, php_version: &str) -> Result<PhpInstance> {
        self.instantiate_php_with_host_options(php_version, HostOptions::default())
    }

    pub fn instantiate_php_with_host_options(
        &self,
        php_version: &str,
        host_options: HostOptions,
    ) -> Result<PhpInstance> {
        let module = self.php_module(php_version)?;
        PhpInstance::from_module_with_host_options(module, host_options)
    }

    pub fn run_php_cli(&self, php_version: &str, argv: &[String]) -> Result<i32> {
        self.run_php_cli_with_host_options(php_version, argv, HostOptions::default())
    }

    pub fn run_php_cli_with_host_options(
        &self,
        php_version: &str,
        argv: &[String],
        mut host_options: HostOptions,
    ) -> Result<i32> {
        for arg in argv.iter().skip(1) {
            let path = PathBuf::from(arg);
            if path.exists() {
                host_options.allowed_host_paths.push(path.clone());
                if let Some(parent) = path.parent() {
                    host_options.allowed_host_paths.push(parent.to_path_buf());
                }
            }
        }
        let trace_phases = host_options.max_import_calls.is_some();
        let mut php = self.instantiate_php_with_host_options(php_version, host_options)?;
        php.run_cli_session_with_trace(argv, trace_phases)
    }

    pub fn run_php_request(&self, php_version: &str, request: PhpRequest) -> Result<PhpResponse> {
        let mut host_options = HostOptions {
            echo_output: false,
            ..HostOptions::default()
        };
        let script_path = PathBuf::from(&request.script_path);
        if script_path.exists() {
            host_options.allowed_host_paths.push(script_path.clone());
            if let Some(parent) = script_path.parent() {
                host_options.allowed_host_paths.push(parent.to_path_buf());
            }
        }
        let mut php = self.instantiate_php_with_host_options(php_version, host_options)?;
        php.run_sapi_request(&request)
    }
}

impl PhpInstance {
    pub fn from_module(module: Module) -> Result<Self> {
        Self::from_module_with_host_options(module, HostOptions::default())
    }

    pub fn from_module_with_host_options(
        module: Module,
        host_options: HostOptions,
    ) -> Result<Self> {
        let mut linker =
            crate::host::create_stub_import_linker_with_options(&module, host_options)?;
        let instance = linker.instantiate(&module)?;
        call_optional_wasm_ctors(&mut linker, &instance)?;
        let bulk_sapi_request_supported = instance
            .get_func(&mut linker.store, "wasm_sapi_set_request")
            .is_some();
        Ok(Self {
            linker,
            instance,
            exports: PhpExportCache::default(),
            php_initialized: false,
            bulk_sapi_request_supported,
        })
    }

    pub fn memory(&mut self) -> Result<Memory> {
        if let Some(memory) = self.exports.memory {
            return Ok(memory);
        }

        let memory = self
            .instance
            .get_memory(&mut self.linker.store, "memory")
            .ok_or_else(|| CliError::new("PHP wasm module does not export memory"))?;
        self.exports.memory = Some(memory);
        Ok(memory)
    }

    pub fn malloc(&mut self, len: usize) -> Result<u32> {
        let len = u32::try_from(len)
            .map_err(|_| CliError::new(format!("Allocation too large: {len} bytes")))?;
        let malloc = self.cached_export1_i32_to_i32("malloc", |exports| &mut exports.malloc)?;
        malloc
            .call(&mut self.linker.store, len)
            .map_err(|error| CliError::new(format!("malloc({len}) failed: {error}")))
    }

    pub fn free(&mut self, ptr: u32) -> Result<()> {
        let free = self.cached_free_export()?;
        free.call(&mut self.linker.store, ptr)
            .map_err(|error| CliError::new(format!("free({ptr}) failed: {error}")))
    }

    pub fn write_bytes(&mut self, ptr: u32, bytes: &[u8]) -> Result<()> {
        self.memory()?
            .write(&mut self.linker.store, ptr as usize, bytes)
            .map_err(|error| CliError::new(format!("Failed to write wasm memory: {error}")))
    }

    pub fn read_bytes(&mut self, ptr: u32, len: usize) -> Result<Vec<u8>> {
        let mut bytes = vec![0; len];
        self.memory()?
            .read(&mut self.linker.store, ptr as usize, &mut bytes)
            .map_err(|error| CliError::new(format!("Failed to read wasm memory: {error}")))?;
        Ok(bytes)
    }

    pub fn write_c_string(&mut self, value: &str) -> Result<WasmCString> {
        let bytes = value.as_bytes();
        if bytes.contains(&0) {
            return Err(CliError::new("Cannot write C string containing NUL byte"));
        }
        let ptr = self.malloc(bytes.len() + 1)?;
        let mut nul_terminated = Vec::with_capacity(bytes.len() + 1);
        nul_terminated.extend_from_slice(bytes);
        nul_terminated.push(0);
        self.write_bytes(ptr, &nul_terminated)?;
        Ok(WasmCString {
            ptr,
            len: bytes.len(),
        })
    }

    pub fn read_c_string(&mut self, ptr: u32, max_len: usize) -> Result<String> {
        let bytes = self.read_bytes(ptr, max_len)?;
        let nul_index = bytes
            .iter()
            .position(|byte| *byte == 0)
            .unwrap_or(bytes.len());
        String::from_utf8(bytes[..nul_index].to_vec())
            .map_err(|error| CliError::new(format!("Invalid UTF-8 in wasm string: {error}")))
    }

    pub fn memory_stats(&mut self) -> Result<PhpMemoryStats> {
        let memory_size_bytes = self.memory_size_bytes()?;
        Ok(PhpMemoryStats {
            memory_size_bytes,
            sbrk_end: self.emscripten_sbrk_end(),
            zend_memory_usage: self.zend_memory_usage(false),
            zend_memory_real_usage: self.zend_memory_usage(true),
        })
    }

    pub fn memory_size_bytes(&mut self) -> Result<u64> {
        Ok(self.memory()?.size(&mut self.linker.store) * 64 * 1024)
    }

    fn emscripten_sbrk_end(&mut self) -> Option<u32> {
        let func = self
            .instance
            .get_typed_func::<(), u32>(&mut self.linker.store, "emscripten_get_sbrk_ptr")
            .ok()?;
        let sbrk_ptr = func.call(&mut self.linker.store, ()).ok()?;
        let bytes = self.read_bytes(sbrk_ptr, 4).ok()?;
        Some(u32::from_le_bytes(bytes.try_into().ok()?))
    }

    fn zend_memory_usage(&mut self, real_usage: bool) -> Option<u32> {
        let func = self
            .instance
            .get_typed_func::<u32, u32>(&mut self.linker.store, "zend_memory_usage")
            .ok()?;
        func.call(&mut self.linker.store, u32::from(real_usage))
            .ok()
    }

    pub fn define_constants(&mut self, constants: &[(String, PhpConstantValue)]) {
        self.linker.store.data_mut().define_constants(constants);
    }

    pub fn php_wasm_init(&mut self) -> Result<i32> {
        self.call_cached_export0_i32("php_wasm_init", |exports| &mut exports.php_wasm_init)
    }

    pub fn wasm_set_phpini_path(&mut self, path_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_phpini_path", path_ptr, |exports| {
            &mut exports.wasm_set_phpini_path
        })
    }

    pub fn wasm_set_sapi_name(&mut self, name_ptr: u32) -> Result<i32> {
        self.call_cached_export1_i32("wasm_set_sapi_name", name_ptr, |exports| {
            &mut exports.wasm_set_sapi_name
        })
    }

    pub fn wasm_add_cli_arg(&mut self, arg_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_add_cli_arg", arg_ptr, |exports| {
            &mut exports.wasm_add_cli_arg
        })
    }

    pub fn wasm_set_query_string(&mut self, query_string_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_query_string", query_string_ptr, |exports| {
            &mut exports.wasm_set_query_string
        })
    }

    pub fn wasm_set_path_translated(&mut self, path_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_path_translated", path_ptr, |exports| {
            &mut exports.wasm_set_path_translated
        })
    }

    pub fn wasm_set_request_uri(&mut self, uri_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_request_uri", uri_ptr, |exports| {
            &mut exports.wasm_set_request_uri
        })
    }

    pub fn wasm_set_request_method(&mut self, method_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_request_method", method_ptr, |exports| {
            &mut exports.wasm_set_request_method
        })
    }

    pub fn wasm_set_request_host(&mut self, host_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_request_host", host_ptr, |exports| {
            &mut exports.wasm_set_request_host
        })
    }

    pub fn wasm_set_request_port(&mut self, port: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_request_port", port, |exports| {
            &mut exports.wasm_set_request_port
        })
    }

    pub fn wasm_set_content_type(&mut self, content_type_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_content_type", content_type_ptr, |exports| {
            &mut exports.wasm_set_content_type
        })
    }

    pub fn wasm_set_content_length(&mut self, len: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_content_length", len, |exports| {
            &mut exports.wasm_set_content_length
        })
    }

    pub fn wasm_set_request_body(&mut self, body_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_request_body", body_ptr, |exports| {
            &mut exports.wasm_set_request_body
        })
    }

    pub fn wasm_set_cookies(&mut self, cookies_ptr: u32) -> Result<()> {
        self.call_cached_export1_void("wasm_set_cookies", cookies_ptr, |exports| {
            &mut exports.wasm_set_cookies
        })
    }

    pub fn wasm_add_server_entry(&mut self, key_ptr: u32, value_ptr: u32) -> Result<()> {
        self.call_cached_export2_void("wasm_add_SERVER_entry", key_ptr, value_ptr, |exports| {
            &mut exports.wasm_add_server_entry
        })
    }

    pub fn wasm_add_env_entry(&mut self, key_ptr: u32, value_ptr: u32) -> Result<()> {
        self.call_cached_export2_void("wasm_add_ENV_entry", key_ptr, value_ptr, |exports| {
            &mut exports.wasm_add_env_entry
        })
    }

    pub fn wasm_sapi_set_request(&mut self, request_ptr: u32, request_len: u32) -> Result<i32> {
        self.call_cached_export2_i32(
            "wasm_sapi_set_request",
            request_ptr,
            request_len,
            |exports| &mut exports.wasm_sapi_set_request,
        )
    }

    pub fn wasm_sapi_handle_request(&mut self) -> Result<i32> {
        self.call_cached_export0_i32("wasm_sapi_handle_request", |exports| {
            &mut exports.wasm_sapi_handle_request
        })
    }

    pub fn run_cli(&mut self) -> Result<i32> {
        self.call_cached_export0_i32("run_cli", |exports| &mut exports.run_cli)
    }

    pub fn run_cli_session(&mut self, argv: &[String]) -> Result<i32> {
        self.run_cli_session_with_trace(argv, false)
    }

    pub fn run_cli_session_with_trace(&mut self, argv: &[String], trace: bool) -> Result<i32> {
        if argv.is_empty() {
            return Err(CliError::new("PHP CLI argv cannot be empty"));
        }

        if trace {
            eprintln!("debug: configuring PHP CLI exports");
        }

        let php_ini = self.write_c_string(PHP_INI_PATH)?;
        self.wasm_set_phpini_path(php_ini.ptr)?;
        self.free(php_ini.ptr)?;

        self.add_cli_arg(&argv[0])?;
        self.add_cli_arg("-c")?;
        self.add_cli_arg(PHP_INI_PATH)?;
        for arg in &argv[1..] {
            self.add_cli_arg(arg)?;
        }

        if trace {
            eprintln!(
                "debug: calling run_cli after {} host imports",
                self.host_import_count()
            );
        }
        self.run_cli()
    }

    pub fn run_sapi_request(&mut self, request: &PhpRequest) -> Result<PhpResponse> {
        let _ = self.take_captured_stdout();
        let _ = self.take_captured_stderr();
        let _ = self.take_captured_headers();

        if !self.php_initialized {
            let php_ini = self.write_c_string(PHP_INI_PATH)?;
            self.wasm_set_phpini_path(php_ini.ptr)?;
            self.free(php_ini.ptr)?;

            let sapi_name = self.write_c_string("cli")?;
            let sapi_result = self.wasm_set_sapi_name(sapi_name.ptr)?;
            self.free(sapi_name.ptr)?;
            if sapi_result != 0 {
                return Err(CliError::new(format!(
                    "wasm_set_sapi_name failed with code {sapi_result}"
                )));
            }

            let init_result = self.php_wasm_init()?;
            if init_result != 0 {
                return Err(CliError::new(format!(
                    "php_wasm_init failed with code {init_result}"
                )));
            }
            self.php_initialized = true;
        }

        let request_allocation = self.set_sapi_request(request)?;

        let handle_result = self.wasm_sapi_handle_request();
        request_allocation.free(self);
        let exit_code = handle_result?;
        Ok(PhpResponse {
            exit_code,
            stdout: self.take_captured_stdout(),
            stderr: self.take_captured_stderr(),
            headers: self.take_captured_headers(),
        })
    }

    pub fn called_host_imports(&self) -> &[String] {
        &self.linker.store.data().called_imports
    }

    pub fn host_import_count(&self) -> usize {
        self.linker.store.data().import_call_count()
    }

    pub fn recent_host_imports(&self, limit: usize) -> String {
        let imports = self.called_host_imports();
        let start = imports.len().saturating_sub(limit);
        imports[start..].join(", ")
    }

    pub fn take_captured_stdout(&mut self) -> Vec<u8> {
        self.linker.store.data_mut().take_captured_stdout()
    }

    pub fn take_captured_stderr(&mut self) -> Vec<u8> {
        self.linker.store.data_mut().take_captured_stderr()
    }

    pub fn take_captured_headers(&mut self) -> Vec<u8> {
        self.linker.store.data_mut().take_captured_headers()
    }

    fn add_cli_arg(&mut self, arg: &str) -> Result<()> {
        let wasm_arg = self.write_c_string(arg)?;
        self.wasm_add_cli_arg(wasm_arg.ptr)?;
        self.free(wasm_arg.ptr)
    }

    fn set_sapi_request(&mut self, request: &PhpRequest) -> Result<SapiRequestAllocation> {
        if self.bulk_sapi_request_supported {
            return self.set_sapi_request_bulk(request);
        }
        self.set_sapi_request_legacy(request)
    }

    fn set_sapi_request_bulk(&mut self, request: &PhpRequest) -> Result<SapiRequestAllocation> {
        let blob = build_sapi_request_blob(request)?;
        let blob_len = u32::try_from(blob.len()).map_err(|_| {
            CliError::new(format!(
                "Packed SAPI request too large: {} bytes",
                blob.len()
            ))
        })?;
        let blob_ptr = self.malloc(blob.len())?;
        if let Err(error) = self.write_bytes(blob_ptr, &blob) {
            let _ = self.free(blob_ptr);
            return Err(error);
        }
        match self.wasm_sapi_set_request(blob_ptr, blob_len) {
            Ok(0) => Ok(SapiRequestAllocation::Bulk(blob_ptr)),
            Ok(code) => {
                let _ = self.free(blob_ptr);
                Err(CliError::new(format!(
                    "wasm_sapi_set_request failed with code {code}"
                )))
            }
            Err(error) => {
                let _ = self.free(blob_ptr);
                Err(error)
            }
        }
    }

    fn set_sapi_request_legacy(&mut self, request: &PhpRequest) -> Result<SapiRequestAllocation> {
        self.set_string_with(request.request_uri.as_str(), Self::wasm_set_request_uri)?;
        let query_string = request
            .request_uri
            .split_once('?')
            .map(|(_, query)| query)
            .unwrap_or("");
        self.set_string_with(query_string, Self::wasm_set_query_string)?;
        self.set_string_with(request.method.as_str(), Self::wasm_set_request_method)?;
        self.set_string_with(request.host.as_str(), Self::wasm_set_request_host)?;
        self.wasm_set_request_port(request.port)?;
        self.set_string_with(request.script_path.as_str(), Self::wasm_set_path_translated)?;

        if let Some(content_type) = &request.content_type {
            self.set_string_with(content_type, Self::wasm_set_content_type)?;
        }
        if let Some(cookies) = &request.cookies {
            self.set_string_with(cookies, Self::wasm_set_cookies)?;
        }
        let body_ptr = if !request.body.is_empty() {
            let content_length = u32::try_from(request.body.len()).map_err(|_| {
                CliError::new(format!(
                    "Request body too large: {} bytes",
                    request.body.len()
                ))
            })?;
            let body_ptr = self.malloc(request.body.len())?;
            self.write_bytes(body_ptr, &request.body)?;
            self.wasm_set_request_body(body_ptr)?;
            self.wasm_set_content_length(content_length)?;
            Some(body_ptr)
        } else {
            self.wasm_set_content_length(0)?;
            None
        };

        for (key, value) in &request.server_entries {
            self.add_key_value(key, value, Self::wasm_add_server_entry)?;
        }
        for (key, value) in &request.env {
            self.add_key_value(key, value, Self::wasm_add_env_entry)?;
        }

        Ok(body_ptr
            .map(SapiRequestAllocation::LegacyBody)
            .unwrap_or(SapiRequestAllocation::None))
    }

    fn set_string_with(
        &mut self,
        value: &str,
        setter: fn(&mut Self, u32) -> Result<()>,
    ) -> Result<()> {
        let string = self.write_c_string(value)?;
        setter(self, string.ptr)?;
        self.free(string.ptr)
    }

    fn add_key_value(
        &mut self,
        key: &str,
        value: &str,
        setter: fn(&mut Self, u32, u32) -> Result<()>,
    ) -> Result<()> {
        let key = self.write_c_string(key)?;
        let value = self.write_c_string(value)?;
        setter(self, key.ptr, value.ptr)?;
        self.free(key.ptr)?;
        self.free(value.ptr)
    }

    fn cached_free_export(&mut self) -> Result<TypedFunc<u32, ()>> {
        if let Some(func) = self.exports.free.as_ref().cloned() {
            return Ok(func);
        }

        let free = self
            .instance
            .get_typed_func::<u32, ()>(&mut self.linker.store, "wasm_free")
            .or_else(|_| {
                self.instance
                    .get_typed_func::<u32, ()>(&mut self.linker.store, "free")
            })
            .map_err(|error| CliError::new(format!("Missing wasm_free/free export: {error}")))?;
        self.exports.free = Some(free.clone());
        Ok(free)
    }

    fn cached_export0_i32(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<(), i32>>,
    ) -> Result<TypedFunc<(), i32>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<(), i32>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn cached_export_void0(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<(), ()>>,
    ) -> Result<TypedFunc<(), ()>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<(), ()>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn cached_export1_i32(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<u32, i32>>,
    ) -> Result<TypedFunc<u32, i32>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<u32, i32>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn cached_export1_void(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<u32, ()>>,
    ) -> Result<TypedFunc<u32, ()>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<u32, ()>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn cached_export1_i32_to_i32(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<u32, u32>>,
    ) -> Result<TypedFunc<u32, u32>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<u32, u32>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn cached_export2_i32(
        &mut self,
        export: &str,
        slot: PhpExport2I32Slot,
    ) -> Result<TypedFunc<(u32, u32), i32>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<(u32, u32), i32>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn cached_export2_void(
        &mut self,
        export: &str,
        slot: PhpExport2VoidSlot,
    ) -> Result<TypedFunc<(u32, u32), ()>> {
        if let Some(func) = slot(&mut self.exports).as_ref().cloned() {
            return Ok(func);
        }

        let func = self
            .instance
            .get_typed_func::<(u32, u32), ()>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        *slot(&mut self.exports) = Some(func.clone());
        Ok(func)
    }

    fn call_cached_export0_i32(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<(), i32>>,
    ) -> Result<i32> {
        let func = self.cached_export0_i32(export, slot)?;
        self.call_typed_export0_i32(export, func)
    }

    fn call_cached_export_void0(
        &mut self,
        export: &str,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<(), ()>>,
    ) -> Result<()> {
        let func = self.cached_export_void0(export, slot)?;
        func.call(&mut self.linker.store, ())
            .map_err(|error| CliError::new(format!("{export} failed: {error}")))
    }

    fn call_cached_export1_i32(
        &mut self,
        export: &str,
        arg: u32,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<u32, i32>>,
    ) -> Result<i32> {
        let func = self.cached_export1_i32(export, slot)?;
        func.call(&mut self.linker.store, arg).map_err(|error| {
            CliError::new(format!(
                "{export} failed: {error}; host import count: {}; recent host imports: {}",
                self.host_import_count(),
                self.recent_host_imports(120)
            ))
        })
    }

    fn call_cached_export1_void(
        &mut self,
        export: &str,
        arg: u32,
        slot: fn(&mut PhpExportCache) -> &mut Option<TypedFunc<u32, ()>>,
    ) -> Result<()> {
        let func = self.cached_export1_void(export, slot)?;
        func.call(&mut self.linker.store, arg).map_err(|error| {
            CliError::new(format!(
                "{export} failed: {error}; host import count: {}; recent host imports: {}",
                self.host_import_count(),
                self.recent_host_imports(120)
            ))
        })
    }

    fn call_cached_export2_i32(
        &mut self,
        export: &str,
        arg1: u32,
        arg2: u32,
        slot: PhpExport2I32Slot,
    ) -> Result<i32> {
        let func = self.cached_export2_i32(export, slot)?;
        func.call(&mut self.linker.store, (arg1, arg2))
            .map_err(|error| {
                CliError::new(format!(
                    "{export} failed: {error}; host import count: {}; recent host imports: {}",
                    self.host_import_count(),
                    self.recent_host_imports(120)
                ))
            })
    }

    fn call_cached_export2_void(
        &mut self,
        export: &str,
        arg1: u32,
        arg2: u32,
        slot: PhpExport2VoidSlot,
    ) -> Result<()> {
        let func = self.cached_export2_void(export, slot)?;
        func.call(&mut self.linker.store, (arg1, arg2))
            .map_err(|error| {
                CliError::new(format!(
                    "{export} failed: {error}; host import count: {}; recent host imports: {}",
                    self.host_import_count(),
                    self.recent_host_imports(120)
                ))
            })
    }

    fn call_typed_export0_i32(&mut self, export: &str, func: TypedFunc<(), i32>) -> Result<i32> {
        loop {
            match func.call(&mut self.linker.store, ()) {
                Ok(value) => {
                    if self.linker.store.data().asyncify_state() == AsyncifyState::Unwinding {
                        self.call_cached_export_void0("asyncify_stop_unwind", |exports| {
                            &mut exports.asyncify_stop_unwind
                        })?;
                        let data = self.linker.store.data().asyncify_data().ok_or_else(|| {
                            CliError::new("Asyncify entered unwinding without a data pointer")
                        })?;
                        self.linker
                            .store
                            .data_mut()
                            .set_asyncify_state(AsyncifyState::Rewinding);
                        self.call_cached_export1_void("asyncify_start_rewind", data, |exports| {
                            &mut exports.asyncify_start_rewind
                        })?;
                        continue;
                    }
                    return Ok(value);
                }
                Err(error) => {
                    if let Some(exit_status) = error.downcast_ref::<PhpExitStatus>() {
                        return Ok(exit_status.0);
                    }
                    return Err(CliError::new(format!(
                        "{export} failed: {error}; host import count: {}; recent host imports: {}",
                        self.host_import_count(),
                        self.recent_host_imports(120)
                    )));
                }
            }
        }
    }

    #[cfg(test)]
    fn call_export0_i32(&mut self, export: &str) -> Result<i32> {
        let func = self
            .instance
            .get_typed_func::<(), i32>(&mut self.linker.store, export)
            .map_err(|error| CliError::new(format!("Missing {export} export: {error}")))?;
        self.call_typed_export0_i32(export, func)
    }
}

enum SapiRequestAllocation {
    Bulk(u32),
    LegacyBody(u32),
    None,
}

impl SapiRequestAllocation {
    fn free(self, php: &mut PhpInstance) {
        match self {
            Self::Bulk(ptr) | Self::LegacyBody(ptr) => {
                let _ = php.free(ptr);
            }
            Self::None => {}
        }
    }
}

const SAPI_REQUEST_BLOB_HEADER_SIZE: usize = 68;
const SAPI_REQUEST_BLOB_VERSION: u32 = 1;

fn build_sapi_request_blob(request: &PhpRequest) -> Result<Vec<u8>> {
    let mut blob = vec![0; SAPI_REQUEST_BLOB_HEADER_SIZE];
    blob[0..4].copy_from_slice(b"WSRQ");

    let query_string = request
        .request_uri
        .split_once('?')
        .map(|(_, query)| query)
        .unwrap_or("");

    let request_uri_offset = push_sapi_blob_string(&mut blob, &request.request_uri, "request URI")?;
    let query_string_offset = push_sapi_blob_string(&mut blob, query_string, "query string")?;
    let request_method_offset =
        push_sapi_blob_string(&mut blob, &request.method, "request method")?;
    let request_host_offset = push_sapi_blob_string(&mut blob, &request.host, "request host")?;
    let path_translated_offset =
        push_sapi_blob_string(&mut blob, &request.script_path, "script path")?;
    let content_type_offset = request
        .content_type
        .as_deref()
        .map(|value| push_sapi_blob_string(&mut blob, value, "content type"))
        .transpose()?
        .unwrap_or(0);
    let cookies_offset = request
        .cookies
        .as_deref()
        .map(|value| push_sapi_blob_string(&mut blob, value, "cookies"))
        .transpose()?
        .unwrap_or(0);

    let content_length = u32::try_from(request.body.len()).map_err(|_| {
        CliError::new(format!(
            "Request body too large: {} bytes",
            request.body.len()
        ))
    })?;
    let body_offset = if request.body.is_empty() {
        0
    } else {
        let offset = sapi_blob_offset(blob.len(), "request body")?;
        blob.extend_from_slice(&request.body);
        offset
    };

    let server_entries_offset =
        push_sapi_blob_entries(&mut blob, &request.server_entries, "$_SERVER entries")?;
    let env_entries_offset = push_sapi_blob_entries(&mut blob, &request.env, "env entries")?;
    let server_entry_count = u32::try_from(request.server_entries.len()).map_err(|_| {
        CliError::new(format!(
            "Too many $_SERVER entries: {}",
            request.server_entries.len()
        ))
    })?;
    let env_entry_count = u32::try_from(request.env.len())
        .map_err(|_| CliError::new(format!("Too many env entries: {}", request.env.len())))?;

    write_sapi_blob_u32(&mut blob, 4, SAPI_REQUEST_BLOB_VERSION);
    write_sapi_blob_u32(&mut blob, 8, 0);
    write_sapi_blob_u32(&mut blob, 12, request.port);
    write_sapi_blob_u32(&mut blob, 16, content_length);
    write_sapi_blob_u32(&mut blob, 20, request_uri_offset);
    write_sapi_blob_u32(&mut blob, 24, query_string_offset);
    write_sapi_blob_u32(&mut blob, 28, request_method_offset);
    write_sapi_blob_u32(&mut blob, 32, request_host_offset);
    write_sapi_blob_u32(&mut blob, 36, path_translated_offset);
    write_sapi_blob_u32(&mut blob, 40, content_type_offset);
    write_sapi_blob_u32(&mut blob, 44, cookies_offset);
    write_sapi_blob_u32(&mut blob, 48, body_offset);
    write_sapi_blob_u32(&mut blob, 52, server_entries_offset);
    write_sapi_blob_u32(&mut blob, 56, server_entry_count);
    write_sapi_blob_u32(&mut blob, 60, env_entries_offset);
    write_sapi_blob_u32(&mut blob, 64, env_entry_count);

    Ok(blob)
}

fn push_sapi_blob_string(blob: &mut Vec<u8>, value: &str, field: &str) -> Result<u32> {
    if value.as_bytes().contains(&0) {
        return Err(CliError::new(format!(
            "Cannot pack SAPI {field} containing NUL byte"
        )));
    }
    let offset = sapi_blob_offset(blob.len(), field)?;
    blob.extend_from_slice(value.as_bytes());
    blob.push(0);
    Ok(offset)
}

fn push_sapi_blob_entries(
    blob: &mut Vec<u8>,
    entries: &[(String, String)],
    field: &str,
) -> Result<u32> {
    if entries.is_empty() {
        return Ok(0);
    }

    let mut offsets = Vec::with_capacity(entries.len());
    for (key, value) in entries {
        let key_offset = push_sapi_blob_string(blob, key, field)?;
        let value_offset = push_sapi_blob_string(blob, value, field)?;
        offsets.push((key_offset, value_offset));
    }

    let entries_offset = sapi_blob_offset(blob.len(), field)?;
    for (key_offset, value_offset) in offsets {
        blob.extend_from_slice(&key_offset.to_le_bytes());
        blob.extend_from_slice(&value_offset.to_le_bytes());
    }
    Ok(entries_offset)
}

fn sapi_blob_offset(offset: usize, field: &str) -> Result<u32> {
    u32::try_from(offset)
        .map_err(|_| CliError::new(format!("Packed SAPI {field} offset exceeds 32-bit memory")))
}

fn write_sapi_blob_u32(blob: &mut [u8], offset: usize, value: u32) {
    blob[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn call_optional_wasm_ctors(linker: &mut StubImportLinker, instance: &Instance) -> Result<()> {
    let Some(func) = instance.get_func(&mut linker.store, "__wasm_call_ctors") else {
        return Ok(());
    };
    let typed = func
        .typed::<(), ()>(&linker.store)
        .map_err(|error| CliError::new(format!("Invalid __wasm_call_ctors export: {error}")))?;
    typed
        .call(&mut linker.store, ())
        .map_err(|error| CliError::new(format!("__wasm_call_ctors failed: {error}")))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WasmCString {
    pub ptr: u32,
    pub len: usize,
}

pub fn repo_root_from_manifest_dir() -> PathBuf {
    crate::runtime::repo_root_from_manifest_dir()
}

#[cfg(test)]
mod tests {
    use wasmtime::{Engine, Module};

    use std::{
        fs,
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    use super::{build_sapi_request_blob, PhpInstance, PhpRequest, SAPI_REQUEST_BLOB_HEADER_SIZE};
    use crate::{
        host::{HostMount, HostOptions},
        runtime::{repo_root_from_manifest_dir, NativeRuntime},
    };

    fn fixture_php_module() -> Module {
        let engine = Engine::default();
        Module::new(
            &engine,
            r#"
            (module
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 1024))
                (global $argc (mut i32) (i32.const 0))
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func (export "free") (param i32))
                (func (export "php_wasm_init") (result i32)
                    i32.const 0
                )
                (func (export "wasm_set_phpini_path") (param i32))
                (func (export "wasm_set_sapi_name") (param i32) (result i32)
                    i32.const 0
                )
                (func (export "wasm_add_cli_arg") (param i32)
                    global.get $argc
                    i32.const 1
                    i32.add
                    global.set $argc
                )
                (func (export "wasm_set_query_string") (param i32))
                (func (export "wasm_set_path_translated") (param i32))
                (func (export "wasm_set_request_uri") (param i32))
                (func (export "wasm_set_request_method") (param i32))
                (func (export "wasm_set_request_host") (param i32))
                (func (export "wasm_set_request_port") (param i32))
                (func (export "wasm_set_content_type") (param i32))
                (func (export "wasm_set_content_length") (param i32))
                (func (export "wasm_set_request_body") (param i32))
                (func (export "wasm_set_cookies") (param i32))
                (func (export "wasm_add_SERVER_entry") (param i32 i32))
                (func (export "wasm_add_ENV_entry") (param i32 i32))
                (func (export "wasm_sapi_handle_request") (result i32)
                    i32.const 7
                )
                (func (export "run_cli") (result i32)
                    global.get $argc
                )
            )
            "#,
        )
        .unwrap()
    }

    fn bulk_sapi_fixture_module() -> Module {
        let engine = Engine::default();
        Module::new(
            &engine,
            r#"
            (module
                (memory (export "memory") 1)
                (global $heap (mut i32) (i32.const 1024))
                (global $bulk_len (mut i32) (i32.const 0))
                (func (export "malloc") (param $len i32) (result i32)
                    global.get $heap
                    global.get $heap
                    local.get $len
                    i32.add
                    global.set $heap
                )
                (func (export "free") (param i32))
                (func (export "php_wasm_init") (result i32)
                    i32.const 0
                )
                (func (export "wasm_set_phpini_path") (param i32))
                (func (export "wasm_set_sapi_name") (param i32) (result i32)
                    i32.const 0
                )
                (func (export "wasm_sapi_set_request") (param $ptr i32) (param $len i32) (result i32)
                    local.get $len
                    global.set $bulk_len
                    i32.const 0
                )
                (func (export "wasm_sapi_handle_request") (result i32)
                    i32.const 7
                )
                (func (export "bulk_len") (result i32)
                    global.get $bulk_len
                )
            )
            "#,
        )
        .unwrap()
    }

    fn ctor_fixture_module() -> Module {
        let engine = Engine::default();
        Module::new(
            &engine,
            r#"
            (module
                (memory (export "memory") 1)
                (global $ctor_count (mut i32) (i32.const 0))
                (func (export "__wasm_call_ctors")
                    global.get $ctor_count
                    i32.const 1
                    i32.add
                    global.set $ctor_count
                )
                (func (export "ctor_count") (result i32)
                    global.get $ctor_count
                )
                (func (export "malloc") (param $len i32) (result i32)
                    i32.const 1024
                )
                (func (export "free") (param i32))
            )
            "#,
        )
        .unwrap()
    }

    fn wasm_free_fixture_module() -> Module {
        let engine = Engine::default();
        Module::new(
            &engine,
            r#"
            (module
                (memory (export "memory") 1)
                (global $wasm_free_count (mut i32) (i32.const 0))
                (global $free_count (mut i32) (i32.const 0))
                (func (export "wasm_free") (param i32)
                    global.get $wasm_free_count
                    i32.const 1
                    i32.add
                    global.set $wasm_free_count
                )
                (func (export "free") (param i32)
                    global.get $free_count
                    i32.const 1
                    i32.add
                    global.set $free_count
                )
                (func (export "wasm_free_count") (result i32)
                    global.get $wasm_free_count
                )
                (func (export "free_count") (result i32)
                    global.get $free_count
                )
            )
            "#,
        )
        .unwrap()
    }

    #[test]
    fn writes_and_reads_c_strings_in_wasm_memory() {
        let mut php = PhpInstance::from_module(fixture_php_module()).unwrap();
        let string = php.write_c_string("/internal/shared/php.ini").unwrap();

        assert_eq!(string.len, "/internal/shared/php.ini".len());
        assert_eq!(
            php.read_c_string(string.ptr, string.len + 1).unwrap(),
            "/internal/shared/php.ini"
        );
        assert_eq!(
            php.read_bytes(string.ptr + string.len as u32, 1).unwrap(),
            [0]
        );
    }

    #[test]
    fn calls_wasm_constructors_after_instantiation() {
        let mut php = PhpInstance::from_module(ctor_fixture_module()).unwrap();

        assert_eq!(php.call_export0_i32("ctor_count").unwrap(), 1);
    }

    #[test]
    fn free_prefers_wasm_free_export_when_available() {
        let mut php = PhpInstance::from_module(wasm_free_fixture_module()).unwrap();

        php.free(1024).unwrap();

        assert_eq!(php.call_export0_i32("wasm_free_count").unwrap(), 1);
        assert_eq!(php.call_export0_i32("free_count").unwrap(), 0);
    }

    #[test]
    fn drives_cli_export_shape_against_fixture() {
        let mut php = PhpInstance::from_module(fixture_php_module()).unwrap();
        let ini = php.write_c_string("/internal/shared/php.ini").unwrap();
        let sapi = php.write_c_string("cli").unwrap();
        let php_binary = php.write_c_string("php").unwrap();
        let version_flag = php.write_c_string("-v").unwrap();

        assert_eq!(php.php_wasm_init().unwrap(), 0);
        php.wasm_set_phpini_path(ini.ptr).unwrap();
        assert_eq!(php.wasm_set_sapi_name(sapi.ptr).unwrap(), 0);
        php.wasm_add_cli_arg(php_binary.ptr).unwrap();
        php.wasm_add_cli_arg(version_flag.ptr).unwrap();

        assert_eq!(php.run_cli().unwrap(), 2);
    }

    #[test]
    fn run_cli_session_injects_internal_php_ini_flag() {
        let mut php = PhpInstance::from_module(fixture_php_module()).unwrap();
        let argv = vec!["php".to_string(), "/tmp/script.php".to_string()];

        assert_eq!(php.run_cli_session(&argv).unwrap(), 4);
    }

    #[test]
    fn drives_sapi_request_export_shape_against_fixture() {
        let mut php = PhpInstance::from_module(fixture_php_module()).unwrap();
        let mut request = PhpRequest::for_script("/tmp/index.php");
        request.request_uri = "/index.php?x=1".to_string();
        request
            .server_entries
            .push(("HTTPS".to_string(), "off".to_string()));
        request.env.push(("WP_ENV".to_string(), "test".to_string()));

        let response = php.run_sapi_request(&request).unwrap();

        assert_eq!(response.exit_code, 7);
        assert!(response.stdout.is_empty());
        assert!(response.stderr.is_empty());
        assert!(response.headers.is_empty());
    }

    #[test]
    fn drives_bulk_sapi_request_export_when_available() {
        let mut php = PhpInstance::from_module(bulk_sapi_fixture_module()).unwrap();
        let mut request = PhpRequest::for_script("/tmp/index.php");
        request.request_uri = "/index.php?x=1".to_string();
        request.method = "POST".to_string();
        request.content_type = Some("text/plain".to_string());
        request.cookies = Some("wordpress_test_cookie=WP Cookie check".to_string());
        request.body = b"payload".to_vec();
        request
            .server_entries
            .push(("HTTPS".to_string(), "off".to_string()));
        request.env.push(("WP_ENV".to_string(), "test".to_string()));

        let response = php.run_sapi_request(&request).unwrap();

        assert_eq!(response.exit_code, 7);
        assert!(php.call_export0_i32("bulk_len").unwrap() > SAPI_REQUEST_BLOB_HEADER_SIZE as i32);
    }

    #[test]
    fn packed_sapi_request_blob_contains_header_offsets_and_entries() {
        let mut request = PhpRequest::for_script("/tmp/index.php");
        request.request_uri = "/index.php?x=1".to_string();
        request.method = "POST".to_string();
        request.host = "example.test:9444".to_string();
        request.port = 9444;
        request.content_type = Some("text/plain".to_string());
        request.cookies = Some("a=b".to_string());
        request.body = b"payload".to_vec();
        request
            .server_entries
            .push(("DOCUMENT_ROOT".to_string(), "/wordpress".to_string()));
        request.env.push(("WP_ENV".to_string(), "test".to_string()));

        let blob = build_sapi_request_blob(&request).unwrap();

        assert_eq!(&blob[0..4], b"WSRQ");
        assert_eq!(blob_u32(&blob, 4), 1);
        assert_eq!(blob_u32(&blob, 12), 9444);
        assert_eq!(blob_u32(&blob, 16), 7);
        assert_eq!(blob_string(&blob, blob_u32(&blob, 20)), "/index.php?x=1");
        assert_eq!(blob_string(&blob, blob_u32(&blob, 24)), "x=1");
        assert_eq!(blob_string(&blob, blob_u32(&blob, 28)), "POST");
        assert_eq!(blob_string(&blob, blob_u32(&blob, 32)), "example.test:9444");
        assert_eq!(blob_string(&blob, blob_u32(&blob, 36)), "/tmp/index.php");
        assert_eq!(blob_string(&blob, blob_u32(&blob, 40)), "text/plain");
        assert_eq!(blob_string(&blob, blob_u32(&blob, 44)), "a=b");
        assert_eq!(
            &blob[blob_u32(&blob, 48) as usize..blob_u32(&blob, 48) as usize + 7],
            b"payload"
        );
        assert_eq!(blob_u32(&blob, 56), 1);
        assert_eq!(blob_u32(&blob, 64), 1);
    }

    fn blob_u32(blob: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes(blob[offset..offset + 4].try_into().unwrap())
    }

    fn blob_string(blob: &[u8], offset: u32) -> &str {
        let start = offset as usize;
        let end = blob[start..]
            .iter()
            .position(|byte| *byte == 0)
            .map(|relative| start + relative)
            .unwrap();
        std::str::from_utf8(&blob[start..end]).unwrap()
    }

    #[test]
    #[ignore = "Full PHP wasm instantiation is an explicit smoke test."]
    fn real_php83_exports_are_resolvable_with_stub_host() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let mut php = runtime.instantiate_php_with_stub_host("8.3").unwrap();

        let ini = php.write_c_string("/internal/shared/php.ini").unwrap();
        let sapi = php.write_c_string("cli").unwrap();

        php.wasm_set_phpini_path(ini.ptr).unwrap();
        let _ = php.wasm_set_sapi_name(sapi.ptr).unwrap();
    }

    #[test]
    #[ignore = "Full PHP wasm time execution is an explicit smoke test."]
    fn real_php83_cli_date_time_helpers_use_native_host_imports() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("wp-playground-native-time-{unique}"));
        fs::create_dir_all(&temp_dir).unwrap();
        let script_path = temp_dir.join("time.php");
        fs::write(
            &script_path,
            r#"<?php
date_default_timezone_set('UTC');
$local = localtime(0, true);
$parsed = @strptime('2024-06-24 13:45:59', '%Y-%m-%d %H:%M:%S');
echo json_encode(array(
    'gmdate' => gmdate('Y-m-d H:i:s', 951827696),
    'date' => date('Y-m-d H:i:s O', 0),
    'mktime' => mktime(0, 0, 0, 1, 32, 1970),
    'local_year' => $local['tm_year'],
    'local_mon' => $local['tm_mon'],
    'local_mday' => $local['tm_mday'],
    'local_wday' => $local['tm_wday'],
    'parsed_year' => $parsed['tm_year'],
    'parsed_mon' => $parsed['tm_mon'],
    'parsed_mday' => $parsed['tm_mday'],
    'parsed_hour' => $parsed['tm_hour'],
    'parsed_min' => $parsed['tm_min'],
    'parsed_sec' => $parsed['tm_sec'],
), JSON_UNESCAPED_SLASHES);
"#,
        )
        .unwrap();

        let mut host_options = HostOptions {
            echo_output: false,
            ..HostOptions::default()
        };
        host_options.allowed_host_paths.push(script_path.clone());
        host_options.allowed_host_paths.push(temp_dir.clone());
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let exit_code = php
            .run_cli_session(&["php".to_string(), script_path.to_string_lossy().to_string()])
            .unwrap();
        let imports = php.recent_host_imports(240);
        let stdout = php.take_captured_stdout();
        let stderr = php.take_captured_stderr();
        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(
            exit_code,
            0,
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert!(
            stderr.is_empty(),
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        let output: serde_json::Value = serde_json::from_slice(&stdout).unwrap_or_else(|error| {
            panic!(
                "invalid JSON output: {error}; stdout={}; stderr={}; imports={imports}",
                String::from_utf8_lossy(&stdout),
                String::from_utf8_lossy(&stderr)
            )
        });
        assert_eq!(output["gmdate"], "2000-02-29 12:34:56");
        assert_eq!(output["date"], "1970-01-01 00:00:00 +0000");
        assert_eq!(output["mktime"], 2678400);
        assert_eq!(output["local_year"], 70);
        assert_eq!(output["local_mon"], 0);
        assert_eq!(output["local_mday"], 1);
        assert_eq!(output["local_wday"], 4);
        assert_eq!(output["parsed_year"], 124);
        assert_eq!(output["parsed_mon"], 5);
        assert_eq!(output["parsed_mday"], 24);
        assert_eq!(output["parsed_hour"], 13);
        assert_eq!(output["parsed_min"], 45);
        assert_eq!(output["parsed_sec"], 59);
    }

    #[test]
    #[ignore = "Full PHP wasm SAPI execution is an explicit smoke test."]
    fn real_php83_sapi_request_captures_body_and_headers() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("wp-playground-native-sapi-{unique}"));
        fs::create_dir_all(&temp_dir).unwrap();
        let script_path = temp_dir.join("index.php");
        fs::write(
            &script_path,
            r#"<?php
header('Content-Type: text/plain');
header('X-Native-Smoke: yes');
echo $_SERVER['REQUEST_METHOD'] . "\n";
echo $_GET['x'] . "\n";
echo file_get_contents('php://input');
"#,
        )
        .unwrap();

        let mut request = PhpRequest::for_script(script_path.to_string_lossy());
        request.request_uri = "/index.php?x=1".to_string();
        request.method = "POST".to_string();
        request.content_type = Some("text/plain".to_string());
        request.body = b"payload".to_vec();

        let mut host_options = HostOptions {
            echo_output: false,
            ..HostOptions::default()
        };
        host_options.allowed_host_paths.push(script_path.clone());
        host_options.allowed_host_paths.push(temp_dir.clone());
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let response = php.run_sapi_request(&request).unwrap();
        let imports = php.recent_host_imports(120);
        let body = String::from_utf8_lossy(&response.stdout);
        let headers = String::from_utf8_lossy(&response.headers);
        let normalized_headers = headers.to_ascii_lowercase();
        let stderr = String::from_utf8_lossy(&response.stderr);

        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(response.exit_code, 0, "stderr={stderr}; imports={imports}");
        assert_eq!(
            body, "POST\n1\npayload",
            "stderr={stderr}; headers={headers}; imports={imports}"
        );
        assert!(
            response.stderr.is_empty(),
            "stderr={stderr}; imports={imports}"
        );
        assert!(
            normalized_headers.contains("content-type"),
            "headers={headers}; imports={imports}"
        );
        assert!(
            normalized_headers.contains("text/plain"),
            "headers={headers}; imports={imports}"
        );
        assert!(
            normalized_headers.contains("x-native-smoke"),
            "headers={headers}; imports={imports}"
        );
    }

    #[test]
    #[ignore = "Full PHP wasm outbound HTTP execution is an explicit smoke test."]
    fn real_php83_cli_fetches_loopback_http_url() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 2048];
            let bytes_read = stream.read(&mut request).unwrap();
            assert!(request[..bytes_read]
                .windows(b"GET /native-smoke".len())
                .any(|window| window == b"GET /native-smoke"));
            stream
                .write_all(b"HTTP/1.0 200 OK\r\nContent-Length: 14\r\n\r\nnative-http-ok")
                .unwrap();
        });

        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("wp-playground-native-http-{unique}"));
        fs::create_dir_all(&temp_dir).unwrap();
        let script_path = temp_dir.join("fetch.php");
        fs::write(
            &script_path,
            format!("<?php echo file_get_contents('http://127.0.0.1:{port}/native-smoke');"),
        )
        .unwrap();

        let mut host_options = HostOptions {
            echo_output: false,
            ..HostOptions::default()
        };
        host_options.allowed_host_paths.push(script_path.clone());
        host_options.allowed_host_paths.push(temp_dir.clone());
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let exit_code = php
            .run_cli_session(&["php".to_string(), script_path.to_string_lossy().to_string()])
            .unwrap();
        let imports = php.recent_host_imports(160);
        let stdout = php.take_captured_stdout();
        let stderr = php.take_captured_stderr();

        let _ = fs::remove_dir_all(&temp_dir);
        server.join().unwrap();

        assert_eq!(
            exit_code,
            0,
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert_eq!(
            String::from_utf8_lossy(&stdout),
            "native-http-ok",
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
    }

    #[test]
    #[ignore = "Full PHP wasm outbound HTTPS execution is an explicit smoke test."]
    fn real_php83_cli_fetches_https_url_with_streams_and_curl() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("wp-playground-native-https-{unique}"));
        fs::create_dir_all(&temp_dir).unwrap();
        let script_path = temp_dir.join("fetch-https.php");
        fs::write(
            &script_path,
            r#"<?php
function fail($message) {
    fwrite(STDERR, $message . "\n");
    exit(1);
}

$streamBody = @file_get_contents('https://example.com/');
if ($streamBody === false || strpos($streamBody, 'Example Domain') === false) {
    fail('https stream fetch failed');
}

$ch = curl_init('https://example.com/');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
$curlBody = curl_exec($ch);
$curlErrno = curl_errno($ch);
$curlError = curl_error($ch);
curl_close($ch);
if ($curlErrno !== 0 || !is_string($curlBody) || strpos($curlBody, 'Example Domain') === false) {
    fail("https curl fetch failed: $curlErrno $curlError");
}

echo 'native-https-ok';
"#,
        )
        .unwrap();

        let mut host_options = HostOptions {
            echo_output: false,
            ..HostOptions::default()
        };
        host_options.allowed_host_paths.push(script_path.clone());
        host_options.allowed_host_paths.push(temp_dir.clone());
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let exit_code = php
            .run_cli_session(&["php".to_string(), script_path.to_string_lossy().to_string()])
            .unwrap();
        let imports = php.recent_host_imports(240);
        let stdout = php.take_captured_stdout();
        let stderr = php.take_captured_stderr();

        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(
            exit_code,
            0,
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert_eq!(
            String::from_utf8_lossy(&stdout),
            "native-https-ok",
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
    }

    #[test]
    #[ignore = "Full PHP wasm nonblocking networking execution is an explicit smoke test."]
    fn real_php83_cli_nonblocking_stream_select_and_curl_multi_select() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            for (path, body) in [
                ("/async", "async-ok"),
                ("/stream", "stream-ok"),
                ("/curl", "curl-ok"),
            ] {
                let deadline = Instant::now() + Duration::from_secs(5);
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(error)
                            if error.kind() == std::io::ErrorKind::WouldBlock
                                && Instant::now() < deadline =>
                        {
                            std::thread::sleep(Duration::from_millis(10));
                        }
                        Err(error) => panic!("accept failed for {path}: {error}"),
                    }
                };
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(2)))
                    .unwrap();
                let mut request = [0; 2048];
                let bytes_read = stream.read(&mut request).unwrap();
                let expected_request = format!("GET {path}");
                assert!(request[..bytes_read]
                    .windows(expected_request.len())
                    .any(|window| window == expected_request.as_bytes()));
                std::thread::sleep(Duration::from_millis(200));
                let response = format!(
                    "HTTP/1.0 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                stream.write_all(response.as_bytes()).unwrap();
            }
        });

        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir =
            std::env::temp_dir().join(format!("wp-playground-native-nonblocking-{unique}"));
        fs::create_dir_all(&temp_dir).unwrap();
        let script_path = temp_dir.join("nonblocking.php");
        fs::write(
            &script_path,
            r#"<?php
function fail($message) {
    fwrite(STDERR, $message . "\n");
    exit(1);
}

$port = (int)$argv[1];

$async = stream_socket_client(
    "tcp://127.0.0.1:$port",
    $errno,
    $errstr,
    1,
    STREAM_CLIENT_CONNECT | STREAM_CLIENT_ASYNC_CONNECT
);
if (!$async) {
    fail("async stream_socket_client failed: $errno $errstr");
}
stream_set_blocking($async, false);
$deadline = microtime(true) + 5;
$connected = false;
while (microtime(true) < $deadline) {
    $read = [];
    $write = [$async];
    $except = [];
    $ready = stream_select($read, $write, $except, 1);
    if ($ready === false) {
        fail('async stream_select failed');
    }
    if ($ready > 0) {
        $connected = true;
        break;
    }
}
if (!$connected) {
    fail('async stream never became writable');
}
fwrite($async, "GET /async HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
$asyncResponse = '';
$deadline = microtime(true) + 5;
while (microtime(true) < $deadline && strpos($asyncResponse, 'async-ok') === false) {
    $read = [$async];
    $write = [];
    $except = [];
    $ready = stream_select($read, $write, $except, 1);
    if ($ready === false) {
        fail('async read stream_select failed');
    }
    if ($ready > 0) {
        $chunk = fread($async, 8192);
        if ($chunk === '' && feof($async)) {
            break;
        }
        $asyncResponse .= $chunk;
    }
}
fclose($async);
if (strpos($asyncResponse, 'async-ok') === false) {
    fail("missing async body: $asyncResponse");
}

$fp = stream_socket_client("tcp://127.0.0.1:$port", $errno, $errstr, 1);
if (!$fp) {
    fail("stream_socket_client failed: $errno $errstr");
}
stream_set_blocking($fp, false);
fwrite($fp, "GET /stream HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
$early = fread($fp, 8192);
if ($early !== '') {
    fail("early nonblocking fread returned " . var_export($early, true));
}

$streamResponse = '';
$deadline = microtime(true) + 5;
while (microtime(true) < $deadline && strpos($streamResponse, 'stream-ok') === false) {
    $read = [$fp];
    $write = [];
    $except = [];
    $ready = stream_select($read, $write, $except, 1);
    if ($ready === false) {
        fail('stream_select failed');
    }
    if ($ready > 0) {
        $chunk = fread($fp, 8192);
        if ($chunk === '' && feof($fp)) {
            break;
        }
        $streamResponse .= $chunk;
    }
}
fclose($fp);
if (strpos($streamResponse, 'stream-ok') === false) {
    fail("missing stream body: $streamResponse");
}

$mh = curl_multi_init();
$ch = curl_init("http://127.0.0.1:$port/curl");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_multi_add_handle($mh, $ch);
$active = null;
$deadline = microtime(true) + 5;
do {
    $status = curl_multi_exec($mh, $active);
    if ($active) {
        $selected = curl_multi_select($mh, 1.0);
        if ($selected === -1) {
            usleep(10000);
        }
    }
} while (($active || $status === CURLM_CALL_MULTI_PERFORM) && microtime(true) < $deadline);

$curlResponse = curl_multi_getcontent($ch);
$curlErrno = curl_errno($ch);
$curlError = curl_error($ch);
curl_multi_remove_handle($mh, $ch);
curl_multi_close($mh);
if ($curlErrno !== 0 || strpos($curlResponse, 'curl-ok') === false) {
    fail("curl failed: $curlErrno $curlError body=$curlResponse");
}
echo 'native-nonblocking-ok';
"#,
        )
        .unwrap();

        let mut host_options = HostOptions {
            echo_output: false,
            ..HostOptions::default()
        };
        host_options.allowed_host_paths.push(script_path.clone());
        host_options.allowed_host_paths.push(temp_dir.clone());
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let exit_code = php
            .run_cli_session(&[
                "php".to_string(),
                script_path.to_string_lossy().to_string(),
                port.to_string(),
            ])
            .unwrap();
        let imports = php.recent_host_imports(240);
        let stdout = php.take_captured_stdout();
        let stderr = php.take_captured_stderr();

        let _ = fs::remove_dir_all(&temp_dir);
        let server_result = server.join();

        assert_eq!(
            exit_code,
            0,
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert_eq!(
            String::from_utf8_lossy(&stdout),
            "native-nonblocking-ok",
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert!(
            server_result.is_ok(),
            "server failed; stdout={}; stderr={}; imports={imports}",
            String::from_utf8_lossy(&stdout),
            String::from_utf8_lossy(&stderr)
        );
    }

    #[test]
    #[ignore = "Full PHP wasm TCP server socket execution is an explicit smoke test."]
    fn real_php83_cli_stream_socket_server_accepts_loopback_client() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("wp-playground-native-server-{unique}"));
        fs::create_dir_all(&temp_dir).unwrap();
        let script_path = temp_dir.join("server.php");
        let address_path = temp_dir.join("server-address.txt");
        fs::write(
            &script_path,
            r#"<?php
function fail($message) {
    fwrite(STDERR, $message . "\n");
    exit(1);
}

$addressPath = $argv[1];
$server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
if (!$server) {
    fail("stream_socket_server failed: $errno $errstr");
}
$address = stream_socket_get_name($server, false);
if (!$address || file_put_contents($addressPath, $address) === false) {
    fail('failed to publish server address');
}
$client = stream_socket_accept($server, 5);
if (!$client) {
    fail('stream_socket_accept timed out');
}
$request = fread($client, 4);
fwrite($client, 'pong');
fclose($client);
fclose($server);
echo "native-server-ok:$request";
"#,
        )
        .unwrap();

        let client_address_path = address_path.clone();
        let client = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(10);
            let address = loop {
                match fs::read_to_string(&client_address_path) {
                    Ok(address) if !address.trim().is_empty() => break address,
                    _ if Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    _ => panic!("PHP server did not publish address"),
                }
            };
            let mut stream = TcpStream::connect(address.trim()).unwrap();
            stream.write_all(b"ping").unwrap();
            let mut response = [0; 4];
            stream.read_exact(&mut response).unwrap();
            assert_eq!(&response, b"pong");
        });

        let mut host_options = HostOptions {
            echo_output: false,
            mounts: vec![HostMount {
                host_path: temp_dir.clone(),
                vfs_path: "/tmp".to_string(),
            }],
            ..HostOptions::default()
        };
        host_options.allowed_host_paths.push(script_path.clone());
        host_options.allowed_host_paths.push(temp_dir.clone());
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let exit_code = php
            .run_cli_session(&[
                "php".to_string(),
                script_path.to_string_lossy().to_string(),
                "/tmp/server-address.txt".to_string(),
            ])
            .unwrap();
        let imports = php.recent_host_imports(240);
        let stdout = php.take_captured_stdout();
        let stderr = php.take_captured_stderr();
        let client_result = client.join();

        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(
            exit_code,
            0,
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert_eq!(
            String::from_utf8_lossy(&stdout),
            "native-server-ok:ping",
            "stderr={}; imports={imports}",
            String::from_utf8_lossy(&stderr)
        );
        assert!(
            client_result.is_ok(),
            "client failed; stdout={}; stderr={}; imports={imports}",
            String::from_utf8_lossy(&stdout),
            String::from_utf8_lossy(&stderr)
        );
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "Full PHP wasm symlink execution is an explicit smoke test."]
    fn real_php83_cli_readlink_target_is_usable_with_follow_symlinks() {
        let runtime = NativeRuntime::from_repo_root(repo_root_from_manifest_dir()).unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let host_root =
            std::env::temp_dir().join(format!("wp-playground-native-symlink-root-{unique}"));
        let external_root =
            std::env::temp_dir().join(format!("wp-playground-native-symlink-target-{unique}"));
        fs::create_dir_all(&host_root).unwrap();
        fs::create_dir_all(&external_root).unwrap();
        fs::write(external_root.join("document.txt"), b"symlink-ok").unwrap();
        std::os::unix::fs::symlink(&external_root, host_root.join("linked-dir")).unwrap();

        let host_options = HostOptions {
            echo_output: false,
            follow_symlinks: true,
            mounts: vec![HostMount {
                host_path: host_root.clone(),
                vfs_path: "/wordpress".to_string(),
            }],
            ..HostOptions::default()
        };
        let mut php = runtime
            .instantiate_php_with_host_options("8.3", host_options)
            .unwrap();
        let exit_code = php
            .run_cli_session(&[
                "php".to_string(),
                "-r".to_string(),
                "echo file_get_contents(readlink('/wordpress/linked-dir') . '/document.txt');"
                    .to_string(),
            ])
            .unwrap();
        let stdout = php.take_captured_stdout();
        let stderr = php.take_captured_stderr();

        let _ = fs::remove_dir_all(&host_root);
        let _ = fs::remove_dir_all(&external_root);

        assert_eq!(exit_code, 0, "stderr={}", String::from_utf8_lossy(&stderr));
        assert_eq!(String::from_utf8_lossy(&stdout), "symlink-ok");
    }
}
