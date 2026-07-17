use std::{
    future::Future,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

use wasmtime::component::{Component, HasSelf, Linker, Resource, ResourceTable};
use wasmtime::{Config, Engine};
use wasmtime_wasi::filesystem::{Descriptor, File};
use wasmtime_wasi::p2::bindings::sync::io::poll as sync_poll;
use wasmtime_wasi::WasiView;
use wasmtime_wasi_io::{bindings::wasi::io::poll as async_poll, poll::DynPollable};

use super::context::Wasip2HostState;
use super::locks::{self, ByteRange, LockKind, LockMode, LockState};

pub(crate) mod bindings {
    wasmtime::component::bindgen!({
        path: "wit",
        world: "filesystem-lock-host",
        imports: { default: trappable },
        with: {
            "wasi:filesystem/types.descriptor": wasmtime_wasi::filesystem::Descriptor,
            "wordpress-playground:filesystem-locks/sqlite-wal-shm.wal-shm": crate::wasip2::sqlite_shm::WalShmSession,
        },
        require_store_data_send: true,
    });
}

use bindings::wordpress_playground::filesystem_locks::filesystem_locks as wit_locks;
use bindings::wordpress_playground::filesystem_locks::sqlite_wal_shm as wit_shm;

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
        linker.allow_shadowing(true);
        sync_poll::add_to_linker::<_, HasSelf<_>>(&mut linker, |state| state)?;
        linker.allow_shadowing(false);
        wit_locks::add_to_linker::<_, HasSelf<_>>(&mut linker, |state| state)?;
        wit_shm::add_to_linker::<_, HasSelf<_>>(&mut linker, |state| state)?;
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

const CANCELLATION_POLL_INTERVAL: Duration = Duration::from_millis(10);

async fn cancellation_aware<T>(
    cancellation: Option<Arc<AtomicBool>>,
    operation: impl Future<Output = wasmtime::Result<T>>,
) -> wasmtime::Result<T> {
    let Some(cancellation) = cancellation else {
        return operation.await;
    };
    tokio::select! {
        result = operation => result,
        () = wait_for_cancellation(cancellation) => {
            Err(wasmtime::Error::msg("native PHP stream was cancelled"))
        }
    }
}

async fn wait_for_cancellation(cancellation: Arc<AtomicBool>) {
    while !cancellation.load(Ordering::Acquire) {
        tokio::time::sleep(CANCELLATION_POLL_INTERVAL).await;
    }
}

impl sync_poll::Host for Wasip2HostState {
    fn poll(&mut self, pollables: Vec<Resource<DynPollable>>) -> wasmtime::Result<Vec<u32>> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware(
            cancellation,
            <ResourceTable as async_poll::Host>::poll(table, pollables),
        ))
    }
}

impl sync_poll::HostPollable for Wasip2HostState {
    fn ready(&mut self, pollable: Resource<DynPollable>) -> wasmtime::Result<bool> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware(
            cancellation,
            <ResourceTable as async_poll::HostPollable>::ready(table, pollable),
        ))
    }

    fn block(&mut self, pollable: Resource<DynPollable>) -> wasmtime::Result<()> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware(
            cancellation,
            <ResourceTable as async_poll::HostPollable>::block(table, pollable),
        ))
    }

    fn drop(&mut self, pollable: Resource<DynPollable>) -> wasmtime::Result<()> {
        <ResourceTable as async_poll::HostPollable>::drop(WasiView::ctx(self).table, pollable)
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

impl wit_shm::Host for Wasip2HostState {
    fn open(
        &mut self,
        file: Resource<Descriptor>,
    ) -> wasmtime::Result<Result<Resource<super::sqlite_shm::WalShmSession>, wit_shm::ShmError>>
    {
        let file = match self.lockable_file(file) {
            Ok(file) => file,
            Err(_) => return Ok(Err(wit_shm::ShmError::BadDescriptor)),
        };
        let session = match super::sqlite_shm::WalShmSession::open(file) {
            Ok(session) => session,
            Err(error) => return Ok(Err(error.into())),
        };
        let resource = WasiView::ctx(self).table.push(session)?;
        Ok(Ok(resource))
    }

    fn reset(
        &mut self,
        shm: Resource<super::sqlite_shm::WalShmSession>,
    ) -> wasmtime::Result<Result<(), wit_shm::ShmError>> {
        let view = WasiView::ctx(self);
        let session = view.table.get(&shm)?;
        Ok(session.reset().map_err(Into::into))
    }

    fn current_epoch(
        &mut self,
        shm: Resource<super::sqlite_shm::WalShmSession>,
    ) -> wasmtime::Result<Result<u64, wit_shm::ShmError>> {
        let view = WasiView::ctx(self);
        let session = view.table.get(&shm)?;
        Ok(Ok(session.current_epoch()))
    }

    fn exchange(
        &mut self,
        shm: Resource<super::sqlite_shm::WalShmSession>,
        region_size: u32,
        known_generations: Vec<u64>,
        dirty_ranges: Vec<wit_shm::ShmRange>,
        expected: Vec<u8>,
        replacement: Vec<u8>,
        force_refresh: bool,
    ) -> wasmtime::Result<Result<wit_shm::ExchangeResult, wit_shm::ShmError>> {
        let result = {
            let view = WasiView::ctx(self);
            let session = view.table.get(&shm)?;
            session.exchange(
                region_size,
                &known_generations,
                &dirty_ranges,
                &expected,
                &replacement,
                force_refresh,
            )
        };
        Ok(result.map_err(Into::into))
    }
}

impl wit_shm::HostWalShm for Wasip2HostState {
    fn drop(
        &mut self,
        resource: Resource<super::sqlite_shm::WalShmSession>,
    ) -> wasmtime::Result<()> {
        WasiView::ctx(self).table.delete(resource)?;
        Ok(())
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

impl From<super::sqlite_shm::ShmError> for wit_shm::ShmError {
    fn from(error: super::sqlite_shm::ShmError) -> Self {
        match error {
            super::sqlite_shm::ShmError::InvalidArgument => Self::InvalidArgument,
            super::sqlite_shm::ShmError::Conflict => Self::Conflict,
            super::sqlite_shm::ShmError::ResourceExhausted => Self::ResourceExhausted,
            super::sqlite_shm::ShmError::Io(error) => Self::IoError(
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

    use super::{wit_locks, wit_shm, Wasip2ComponentRuntime};
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

    #[test]
    fn wal_shm_import_shares_generations_across_host_states() {
        let host_path = temp_dir("wal-shm-import");
        fs::write(host_path.join("database-shm"), b"").unwrap();
        let mut first = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&host_path, "/workspace"))
            .build()
            .unwrap();
        let mut second = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&host_path, "/workspace"))
            .build()
            .unwrap();
        let first_file = open_test_file(&mut first, "database-shm");
        let second_file = open_test_file(&mut second, "database-shm");
        let first_shm = wit_shm::Host::open(
            &mut first,
            Resource::<Descriptor>::new_borrow(first_file.rep()),
        )
        .unwrap()
        .unwrap();
        let second_shm = wit_shm::Host::open(
            &mut second,
            Resource::<Descriptor>::new_borrow(second_file.rep()),
        )
        .unwrap()
        .unwrap();

        let initial = wit_shm::Host::exchange(
            &mut first,
            Resource::new_borrow(first_shm.rep()),
            32,
            vec![0],
            vec![],
            vec![],
            vec![],
            false,
        )
        .unwrap()
        .unwrap();
        let initial_epoch =
            wit_shm::Host::current_epoch(&mut second, Resource::new_borrow(second_shm.rep()))
                .unwrap()
                .unwrap();
        assert_eq!(initial_epoch, initial.epoch);
        let written = wit_shm::Host::exchange(
            &mut first,
            Resource::new_borrow(first_shm.rep()),
            32,
            initial.generations,
            vec![wit_shm::ShmRange {
                region: 0,
                offset: 0,
                data_offset: 0,
                length: 4,
            }],
            vec![0; 4],
            vec![7; 4],
            false,
        )
        .unwrap()
        .unwrap();
        let written_epoch =
            wit_shm::Host::current_epoch(&mut second, Resource::new_borrow(second_shm.rep()))
                .unwrap()
                .unwrap();
        assert_eq!(written_epoch, written.epoch);
        assert!(written_epoch > initial_epoch);

        let observed = wit_shm::Host::exchange(
            &mut second,
            Resource::new_borrow(second_shm.rep()),
            32,
            vec![0],
            vec![],
            vec![],
            vec![],
            false,
        )
        .unwrap()
        .unwrap();
        assert_eq!(&observed.data[0..4], &[7; 4]);
        assert_eq!(observed.epoch, written_epoch);

        wit_shm::Host::reset(&mut second, Resource::new_borrow(second_shm.rep()))
            .unwrap()
            .unwrap();
        let reset_epoch =
            wit_shm::Host::current_epoch(&mut first, Resource::new_borrow(first_shm.rep()))
                .unwrap()
                .unwrap();
        assert!(reset_epoch > written_epoch);
        let reset = wit_shm::Host::exchange(
            &mut first,
            Resource::new_borrow(first_shm.rep()),
            32,
            written.generations,
            vec![],
            vec![],
            vec![],
            false,
        )
        .unwrap()
        .unwrap();
        assert_eq!(reset.data, vec![0; 32]);
        assert!(reset.epoch >= reset_epoch);

        drop(first);
        drop(second);
        fs::remove_dir_all(host_path).unwrap();
    }

    #[test]
    fn wal_shm_drop_releases_canonical_state_and_reuses_the_resource_slot() {
        let host_path = temp_dir("wal-shm-drop");
        fs::write(host_path.join("database-shm"), b"").unwrap();
        let mut state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&host_path, "/workspace"))
            .build()
            .unwrap();
        let file = open_test_file(&mut state, "database-shm");
        let mut resource_rep = None;

        for marker in 1..=64_u8 {
            let shm =
                wit_shm::Host::open(&mut state, Resource::<Descriptor>::new_borrow(file.rep()))
                    .unwrap()
                    .unwrap();
            match resource_rep {
                Some(resource_rep) => assert_eq!(shm.rep(), resource_rep),
                None => resource_rep = Some(shm.rep()),
            }

            // The preceding resource was the only strong reference to this
            // file's canonical state, so every reopen must start empty.
            let initial = wit_shm::Host::exchange(
                &mut state,
                Resource::new_borrow(shm.rep()),
                32,
                vec![0],
                vec![],
                vec![],
                vec![],
                false,
            )
            .unwrap()
            .unwrap();
            assert_eq!(initial.data, vec![0; 32]);

            wit_shm::Host::exchange(
                &mut state,
                Resource::new_borrow(shm.rep()),
                32,
                initial.generations,
                vec![wit_shm::ShmRange {
                    region: 0,
                    offset: 0,
                    data_offset: 0,
                    length: 4,
                }],
                vec![0; 4],
                vec![marker; 4],
                false,
            )
            .unwrap()
            .unwrap();

            wit_shm::HostWalShm::drop(&mut state, shm).unwrap();
        }

        drop(state);
        fs::remove_dir_all(host_path).unwrap();
    }

    fn open_test_file(
        state: &mut crate::wasip2::Wasip2HostState,
        path: &str,
    ) -> Resource<Descriptor> {
        let directory = {
            let mut filesystem = state.filesystem();
            preopens::Host::get_directories(&mut filesystem)
                .unwrap()
                .pop()
                .unwrap()
                .0
        };
        let file = {
            let mut filesystem = state.filesystem();
            types::HostDescriptor::open_at(
                &mut filesystem,
                directory,
                types::PathFlags::empty(),
                path.into(),
                types::OpenFlags::empty(),
                types::DescriptorFlags::READ | types::DescriptorFlags::WRITE,
            )
            .unwrap()
        };
        file
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
