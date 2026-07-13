use std::path::{Path, PathBuf};

use wasmtime::component::ResourceTable;
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtx, WasiCtxBuilder, WasiCtxView, WasiView};

use super::php::PhpOutputCapture;

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
}

impl Wasip2ContextBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn preopen(mut self, preopen: CapabilityPreopen) -> Self {
        self.preopens.push(preopen);
        self
    }

    pub fn build(self) -> wasmtime::Result<Wasip2HostState> {
        let mut builder = WasiCtxBuilder::new();
        // Component requests already run synchronously on dedicated native
        // threads. Keep blocking filesystem calls on those threads instead of
        // bouncing every operation through Tokio's blocking pool and awaiting it.
        builder.allow_blocking_current_thread(true);
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
        })
    }
}

pub struct Wasip2HostState {
    table: ResourceTable,
    wasi: WasiCtx,
    pub(crate) php_output: PhpOutputCapture,
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
        sync::atomic::{AtomicU64, Ordering},
    };

    use wasmtime_wasi::{DirPerms, FilePerms, WasiView};

    use super::{CapabilityPreopen, Wasip2ContextBuilder};

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
