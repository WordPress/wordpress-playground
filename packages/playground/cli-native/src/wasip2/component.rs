use std::path::Path;

use wasmtime::component::{Component, HasSelf, Linker, Resource};
use wasmtime::{Config, Engine};
use wasmtime_wasi::filesystem::{Descriptor, File};
use wasmtime_wasi::WasiView;

use super::context::Wasip2HostState;
use super::locks::{self, ByteRange, LockKind, LockMode, LockState};

mod bindings {
    wasmtime::component::bindgen!({
        path: "wit",
        world: "filesystem-lock-host",
        imports: { default: trappable },
        with: {
            "wasi:filesystem/types.descriptor": wasmtime_wasi::filesystem::Descriptor,
        },
        require_store_data_send: true,
    });
}

use bindings::wordpress_playground::filesystem_locks::filesystem_locks as wit_locks;

/// A synchronous WASIp2 component runtime with capability-based WASI and the
/// Playground file-lock extension registered in one linker.
pub struct Wasip2ComponentRuntime {
    engine: Engine,
    linker: Linker<Wasip2HostState>,
}

impl Wasip2ComponentRuntime {
    pub fn new() -> wasmtime::Result<Self> {
        let mut config = Config::new();
        config.wasm_gc(false);
        config.wasm_component_model(true);
        config.wasm_exceptions(true);
        let engine = Engine::new(&config)?;
        Self::from_engine(engine)
    }

    /// Builds the host linker around an existing engine, preserving cached or
    /// precompiled components' engine identity.
    pub fn from_engine(engine: Engine) -> wasmtime::Result<Self> {
        let mut linker = Linker::new(&engine);
        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;
        wit_locks::add_to_linker::<_, HasSelf<_>>(&mut linker, |state| state)?;
        super::php::add_to_linker(&mut linker)?;

        Ok(Self { engine, linker })
    }

    pub fn engine(&self) -> &Engine {
        &self.engine
    }

    pub fn linker(&self) -> &Linker<Wasip2HostState> {
        &self.linker
    }

    pub fn load_component(&self, path: impl AsRef<Path>) -> wasmtime::Result<Component> {
        Component::from_file(&self.engine, path)
    }
}

impl Wasip2HostState {
    fn lockable_file(&mut self, resource: Resource<Descriptor>) -> Result<File, locks::LockError> {
        let view = WasiView::ctx(self);
        let descriptor = view
            .table
            .get(&resource)
            .map_err(|_| locks::LockError::BadDescriptor)?;
        match descriptor {
            Descriptor::File(file) => Ok(file.clone()),
            Descriptor::Dir(_) => Err(locks::LockError::BadDescriptor),
        }
    }
}

impl wit_locks::Host for Wasip2HostState {
    fn lock_whole(
        &mut self,
        file: Resource<Descriptor>,
        kind: wit_locks::LockKind,
        mode: wit_locks::LockMode,
    ) -> wasmtime::Result<Result<(), wit_locks::LockError>> {
        let file = match self.lockable_file(file) {
            Ok(file) => file,
            Err(error) => return Ok(Err(error.into())),
        };
        Ok(locks::lock_whole(file.file.as_ref(), kind.into(), mode.into()).map_err(Into::into))
    }

    fn unlock_whole(
        &mut self,
        file: Resource<Descriptor>,
    ) -> wasmtime::Result<Result<(), wit_locks::LockError>> {
        let file = match self.lockable_file(file) {
            Ok(file) => file,
            Err(error) => return Ok(Err(error.into())),
        };
        Ok(locks::unlock_whole(file.file.as_ref()).map_err(Into::into))
    }

    fn lock_range(
        &mut self,
        file: Resource<Descriptor>,
        range: wit_locks::ByteRange,
        kind: wit_locks::LockKind,
        mode: wit_locks::LockMode,
    ) -> wasmtime::Result<Result<(), wit_locks::LockError>> {
        let file = match self.lockable_file(file) {
            Ok(file) => file,
            Err(error) => return Ok(Err(error.into())),
        };
        Ok(
            locks::lock_range(file.file.as_ref(), range.into(), kind.into(), mode.into())
                .map_err(Into::into),
        )
    }

    fn query_range(
        &mut self,
        file: Resource<Descriptor>,
        range: wit_locks::ByteRange,
        kind: wit_locks::LockKind,
    ) -> wasmtime::Result<Result<wit_locks::LockState, wit_locks::LockError>> {
        let file = match self.lockable_file(file) {
            Ok(file) => file,
            Err(error) => return Ok(Err(error.into())),
        };
        Ok(
            locks::query_range(file.file.as_ref(), range.into(), kind.into())
                .map(Into::into)
                .map_err(Into::into),
        )
    }

    fn unlock_range(
        &mut self,
        file: Resource<Descriptor>,
        range: wit_locks::ByteRange,
    ) -> wasmtime::Result<Result<(), wit_locks::LockError>> {
        let file = match self.lockable_file(file) {
            Ok(file) => file,
            Err(error) => return Ok(Err(error.into())),
        };
        Ok(locks::unlock_range(file.file.as_ref(), range.into()).map_err(Into::into))
    }
}

impl From<wit_locks::LockKind> for LockKind {
    fn from(kind: wit_locks::LockKind) -> Self {
        match kind {
            wit_locks::LockKind::Shared => Self::Shared,
            wit_locks::LockKind::Exclusive => Self::Exclusive,
        }
    }
}

impl From<wit_locks::LockMode> for LockMode {
    fn from(mode: wit_locks::LockMode) -> Self {
        match mode {
            wit_locks::LockMode::Blocking => Self::Blocking,
            wit_locks::LockMode::NonBlocking => Self::NonBlocking,
        }
    }
}

impl From<wit_locks::ByteRange> for ByteRange {
    fn from(range: wit_locks::ByteRange) -> Self {
        Self::new(range.start, range.length)
    }
}

impl From<LockState> for wit_locks::LockState {
    fn from(state: LockState) -> Self {
        match state {
            LockState::Unlocked => Self::Unlocked,
            LockState::Locked {
                kind,
                range,
                owner_process_id,
            } => Self::Locked(wit_locks::LockConflict {
                kind: match kind {
                    LockKind::Shared => wit_locks::LockKind::Shared,
                    LockKind::Exclusive => wit_locks::LockKind::Exclusive,
                },
                range: wit_locks::ByteRange {
                    start: range.start,
                    length: range.length,
                },
                owner_process_id,
            }),
        }
    }
}

impl From<locks::LockError> for wit_locks::LockError {
    fn from(error: locks::LockError) -> Self {
        match error {
            locks::LockError::WouldBlock => Self::WouldBlock,
            locks::LockError::BadDescriptor => Self::BadDescriptor,
            locks::LockError::Interrupted => Self::Interrupted,
            locks::LockError::InvalidRange => Self::InvalidRange,
            locks::LockError::Overflow => Self::Overflow,
            locks::LockError::Deadlock => Self::Deadlock,
            locks::LockError::Unsupported => Self::Unsupported,
            locks::LockError::PermissionDenied => Self::PermissionDenied,
            locks::LockError::ResourceExhausted => Self::ResourceExhausted,
            locks::LockError::Io(error) => Self::IoError(
                error
                    .raw_os_error()
                    .and_then(|code| u32::try_from(code).ok()),
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        sync::atomic::{AtomicU64, Ordering},
    };

    use wasmtime::component::Resource;
    use wasmtime_wasi::filesystem::{Descriptor, WasiFilesystemView};
    use wasmtime_wasi::p2::bindings::{filesystem::preopens, sync::filesystem::types};

    use super::{wit_locks, Wasip2ComponentRuntime};
    use crate::wasip2::{CapabilityPreopen, Wasip2ContextBuilder};

    static NEXT_TEMP_DIR_ID: AtomicU64 = AtomicU64::new(1);

    #[test]
    fn creates_sync_runtime_with_wasi_and_lock_imports() {
        Wasip2ComponentRuntime::new().unwrap();
    }

    #[test]
    fn lock_imports_operate_on_a_borrowed_wasi_descriptor() {
        let host_path = temp_dir("lock-imports");
        fs::write(host_path.join("lock-target"), b"lock me").unwrap();
        let mut state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&host_path, "/workspace"))
            .build()
            .unwrap();

        let directory = {
            let mut filesystem = state.filesystem();
            preopens::Host::get_directories(&mut filesystem)
                .unwrap()
                .pop()
                .unwrap()
                .0
        };
        let directory_rep = directory.rep();
        let file = {
            let mut filesystem = state.filesystem();
            types::HostDescriptor::open_at(
                &mut filesystem,
                directory,
                types::PathFlags::empty(),
                "lock-target".into(),
                types::OpenFlags::empty(),
                types::DescriptorFlags::READ | types::DescriptorFlags::WRITE,
            )
            .unwrap()
        };
        let contender = {
            let mut filesystem = state.filesystem();
            types::HostDescriptor::open_at(
                &mut filesystem,
                Resource::new_borrow(directory_rep),
                types::PathFlags::empty(),
                "lock-target".into(),
                types::OpenFlags::empty(),
                types::DescriptorFlags::READ | types::DescriptorFlags::WRITE,
            )
            .unwrap()
        };
        let borrowed_file = || Resource::<Descriptor>::new_borrow(file.rep());
        let borrowed_contender = || Resource::<Descriptor>::new_borrow(contender.rep());

        wit_locks::Host::lock_whole(
            &mut state,
            borrowed_file(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap();
        wit_locks::Host::unlock_whole(&mut state, borrowed_file())
            .unwrap()
            .unwrap();

        let range = || wit_locks::ByteRange {
            start: 1,
            length: Some(3),
        };
        wit_locks::Host::lock_range(
            &mut state,
            borrowed_file(),
            range(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap();
        let conflict = wit_locks::Host::query_range(
            &mut state,
            borrowed_contender(),
            range(),
            wit_locks::LockKind::Exclusive,
        )
        .unwrap()
        .unwrap();
        assert!(matches!(
            conflict,
            wit_locks::LockState::Locked(wit_locks::LockConflict {
                kind: wit_locks::LockKind::Exclusive,
                range: wit_locks::ByteRange {
                    start: 1,
                    length: Some(3),
                },
                ..
            })
        ));
        wit_locks::Host::unlock_range(&mut state, borrowed_file(), range())
            .unwrap()
            .unwrap();

        drop(state);
        fs::remove_dir_all(host_path).unwrap();
    }

    fn temp_dir(label: &str) -> std::path::PathBuf {
        let id = NEXT_TEMP_DIR_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "wp-playground-wasip2-{label}-{}-{id}",
            std::process::id()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
