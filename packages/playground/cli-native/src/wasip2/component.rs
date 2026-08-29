use std::{future::Future, path::Path, sync::Arc, time::Duration};

use wasmtime::component::{Component, HasSelf, Linker, Resource, ResourceTable};
use wasmtime::{Config, Engine};
use wasmtime_wasi::filesystem::{Descriptor, File};
use wasmtime_wasi::p2::bindings::sync::io::{poll as sync_poll, streams as sync_streams};
use wasmtime_wasi::p2::{StreamError, StreamResult};
use wasmtime_wasi::WasiView;
use wasmtime_wasi_io::{
    bindings::wasi::io::{poll as async_poll, streams as async_streams},
    poll::DynPollable,
};

use super::context::{ActiveCancellation, Wasip2HostState};
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

const LOCK_RETRY_INTERVAL: Duration = Duration::from_millis(10);

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
        sync_streams::add_to_linker::<_, HasSelf<_>>(&mut linker, |state| state)?;
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

async fn cancellation_aware<T>(
    cancellation: Option<Arc<ActiveCancellation>>,
    operation: impl Future<Output = wasmtime::Result<T>>,
) -> wasmtime::Result<T> {
    let Some(cancellation) = cancellation else {
        return operation.await;
    };
    tokio::select! {
        biased;
        () = cancellation.cancelled() => {
            Err(wasmtime::Error::msg("native PHP stream was cancelled"))
        }
        result = operation => result,
    }
}

async fn cancellation_aware_stream<T>(
    cancellation: Option<Arc<ActiveCancellation>>,
    operation: impl Future<Output = StreamResult<T>>,
) -> StreamResult<T> {
    let Some(cancellation) = cancellation else {
        return operation.await;
    };
    tokio::select! {
        biased;
        () = cancellation.cancelled() => {
            Err(StreamError::Trap(wasmtime::Error::msg(
                "native PHP stream was cancelled",
            )))
        }
        result = operation => result,
    }
}

fn cancellation_aware_lock(
    cancellation: Option<Arc<ActiveCancellation>>,
    mode: LockMode,
    mut attempt: impl FnMut(LockMode) -> Result<(), locks::LockError>,
    mut rollback: impl FnMut() -> Result<(), locks::LockError>,
) -> wasmtime::Result<Result<(), wit_locks::LockError>> {
    let Some(cancellation) = cancellation else {
        return Ok(attempt(mode).map_err(Into::into));
    };
    if mode == LockMode::NonBlocking {
        return Ok(attempt(mode).map_err(Into::into));
    }

    wasmtime_wasi::runtime::in_tokio(async move {
        loop {
            if cancellation.is_requested() {
                return Err(wasmtime::Error::msg("native PHP stream was cancelled"));
            }

            match attempt(LockMode::NonBlocking) {
                Ok(()) if cancellation.is_requested() => {
                    // Cancellation won while the native acquisition was in
                    // flight. Release the acquired extent before trapping; the
                    // failed streamed worker is then discarded, so a lock
                    // conversion does not need to restore its prior mode.
                    rollback().map_err(|error| {
                        wasmtime::Error::msg(format!(
                            "native PHP stream was cancelled and its acquired file lock could not be released: {error}"
                        ))
                    })?;
                    return Err(wasmtime::Error::msg("native PHP stream was cancelled"));
                }
                Ok(()) => return Ok(Ok(())),
                Err(locks::LockError::WouldBlock) => {}
                Err(error) => return Ok(Err(error.into())),
            }

            tokio::select! {
                biased;
                () = cancellation.cancelled() => {
                    return Err(wasmtime::Error::msg("native PHP stream was cancelled"));
                }
                () = tokio::time::sleep(LOCK_RETRY_INTERVAL) => {}
            }
        }
    })
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

impl sync_streams::Host for Wasip2HostState {
    fn convert_stream_error(
        &mut self,
        error: StreamError,
    ) -> wasmtime::Result<sync_streams::StreamError> {
        <ResourceTable as sync_streams::Host>::convert_stream_error(
            WasiView::ctx(self).table,
            error,
        )
    }
}

impl sync_streams::HostOutputStream for Wasip2HostState {
    fn drop(&mut self, stream: Resource<sync_streams::OutputStream>) -> wasmtime::Result<()> {
        // Resource cleanup is itself the cancellation path for background
        // stream work. It must run to completion even when request cancellation
        // is already active, otherwise the ResourceTable entry survives in a
        // Store that a low-level caller may reuse.
        <ResourceTable as sync_streams::HostOutputStream>::drop(WasiView::ctx(self).table, stream)
    }

    fn check_write(&mut self, stream: Resource<sync_streams::OutputStream>) -> StreamResult<u64> {
        <ResourceTable as sync_streams::HostOutputStream>::check_write(
            WasiView::ctx(self).table,
            stream,
        )
    }

    fn write(
        &mut self,
        stream: Resource<sync_streams::OutputStream>,
        bytes: Vec<u8>,
    ) -> StreamResult<()> {
        <ResourceTable as sync_streams::HostOutputStream>::write(
            WasiView::ctx(self).table,
            stream,
            bytes,
        )
    }

    fn blocking_write_and_flush(
        &mut self,
        stream: Resource<sync_streams::OutputStream>,
        bytes: Vec<u8>,
    ) -> StreamResult<()> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware_stream(
            cancellation,
            <ResourceTable as async_streams::HostOutputStream>::blocking_write_and_flush(
                table, stream, bytes,
            ),
        ))
    }

    fn blocking_write_zeroes_and_flush(
        &mut self,
        stream: Resource<sync_streams::OutputStream>,
        len: u64,
    ) -> StreamResult<()> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware_stream(
            cancellation,
            <ResourceTable as async_streams::HostOutputStream>::blocking_write_zeroes_and_flush(
                table, stream, len,
            ),
        ))
    }

    fn subscribe(
        &mut self,
        stream: Resource<sync_streams::OutputStream>,
    ) -> wasmtime::Result<Resource<sync_poll::Pollable>> {
        <ResourceTable as sync_streams::HostOutputStream>::subscribe(
            WasiView::ctx(self).table,
            stream,
        )
    }

    fn write_zeroes(
        &mut self,
        stream: Resource<sync_streams::OutputStream>,
        len: u64,
    ) -> StreamResult<()> {
        <ResourceTable as sync_streams::HostOutputStream>::write_zeroes(
            WasiView::ctx(self).table,
            stream,
            len,
        )
    }

    fn flush(&mut self, stream: Resource<sync_streams::OutputStream>) -> StreamResult<()> {
        <ResourceTable as sync_streams::HostOutputStream>::flush(WasiView::ctx(self).table, stream)
    }

    fn blocking_flush(&mut self, stream: Resource<sync_streams::OutputStream>) -> StreamResult<()> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware_stream(
            cancellation,
            <ResourceTable as async_streams::HostOutputStream>::blocking_flush(table, stream),
        ))
    }

    fn splice(
        &mut self,
        destination: Resource<sync_streams::OutputStream>,
        source: Resource<sync_streams::InputStream>,
        len: u64,
    ) -> StreamResult<u64> {
        <ResourceTable as sync_streams::HostOutputStream>::splice(
            WasiView::ctx(self).table,
            destination,
            source,
            len,
        )
    }

    fn blocking_splice(
        &mut self,
        destination: Resource<sync_streams::OutputStream>,
        source: Resource<sync_streams::InputStream>,
        len: u64,
    ) -> StreamResult<u64> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware_stream(
            cancellation,
            <ResourceTable as async_streams::HostOutputStream>::blocking_splice(
                table,
                destination,
                source,
                len,
            ),
        ))
    }
}

impl sync_streams::HostInputStream for Wasip2HostState {
    fn drop(&mut self, stream: Resource<sync_streams::InputStream>) -> wasmtime::Result<()> {
        <ResourceTable as sync_streams::HostInputStream>::drop(WasiView::ctx(self).table, stream)
    }

    fn read(
        &mut self,
        stream: Resource<sync_streams::InputStream>,
        len: u64,
    ) -> StreamResult<Vec<u8>> {
        <ResourceTable as sync_streams::HostInputStream>::read(
            WasiView::ctx(self).table,
            stream,
            len,
        )
    }

    fn blocking_read(
        &mut self,
        stream: Resource<sync_streams::InputStream>,
        len: u64,
    ) -> StreamResult<Vec<u8>> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware_stream(
            cancellation,
            <ResourceTable as async_streams::HostInputStream>::blocking_read(table, stream, len),
        ))
    }

    fn skip(&mut self, stream: Resource<sync_streams::InputStream>, len: u64) -> StreamResult<u64> {
        <ResourceTable as sync_streams::HostInputStream>::skip(
            WasiView::ctx(self).table,
            stream,
            len,
        )
    }

    fn blocking_skip(
        &mut self,
        stream: Resource<sync_streams::InputStream>,
        len: u64,
    ) -> StreamResult<u64> {
        let cancellation = self.active_cancellation.clone();
        let table = WasiView::ctx(self).table;
        wasmtime_wasi::runtime::in_tokio(cancellation_aware_stream(
            cancellation,
            <ResourceTable as async_streams::HostInputStream>::blocking_skip(table, stream, len),
        ))
    }

    fn subscribe(
        &mut self,
        stream: Resource<sync_streams::InputStream>,
    ) -> wasmtime::Result<Resource<sync_poll::Pollable>> {
        <ResourceTable as sync_streams::HostInputStream>::subscribe(
            WasiView::ctx(self).table,
            stream,
        )
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
        let cancellation = self.active_cancellation.clone();
        let kind = kind.into();
        cancellation_aware_lock(
            cancellation,
            mode.into(),
            |mode| locks::lock_whole(file.file.as_ref(), kind, mode),
            || locks::unlock_whole(file.file.as_ref()),
        )
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
        let cancellation = self.active_cancellation.clone();
        let range = range.into();
        let kind = kind.into();
        cancellation_aware_lock(
            cancellation,
            mode.into(),
            |mode| locks::lock_range(file.file.as_ref(), range, kind, mode),
            || locks::unlock_range(file.file.as_ref(), range),
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
        sync::{
            atomic::{AtomicBool, AtomicU64, Ordering},
            Arc,
        },
        thread,
        time::{Duration, Instant},
    };

    use wasmtime::component::Resource;
    use wasmtime_wasi::filesystem::{Descriptor, WasiFilesystemView};
    use wasmtime_wasi::p2::bindings::{filesystem::preopens, sync::filesystem::types};
    use wasmtime_wasi::WasiView;
    use wasmtime_wasi_io::{
        bytes::Bytes,
        poll::{subscribe, Pollable},
        streams::{DynInputStream, DynOutputStream, InputStream, OutputStream, StreamError},
    };

    use super::{
        cancellation_aware_lock, locks, sync_poll, sync_streams, wit_locks, wit_shm,
        Wasip2ComponentRuntime,
    };
    use crate::wasip2::context::ActiveCancellation;
    use crate::wasip2::{CapabilityPreopen, Wasip2ContextBuilder};

    static NEXT_TEMP_DIR_ID: AtomicU64 = AtomicU64::new(1);
    const SYNTHETIC_HOST_WAIT: Duration = Duration::from_secs(2);
    const MAX_CANCELLATION_LATENCY: Duration = Duration::from_secs(1);

    struct SlowPollable;

    #[wasmtime_wasi_io::async_trait]
    impl Pollable for SlowPollable {
        async fn ready(&mut self) {
            tokio::time::sleep(SYNTHETIC_HOST_WAIT).await;
        }
    }

    struct SlowOutputStream {
        writable: bool,
    }

    struct TrackedStream {
        dropped: Arc<AtomicU64>,
    }

    impl Drop for TrackedStream {
        fn drop(&mut self) {
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
    }

    #[wasmtime_wasi_io::async_trait]
    impl Pollable for TrackedStream {
        async fn ready(&mut self) {}
    }

    #[wasmtime_wasi_io::async_trait]
    impl InputStream for TrackedStream {
        fn read(&mut self, _size: usize) -> Result<Bytes, StreamError> {
            Ok(Bytes::new())
        }
    }

    #[wasmtime_wasi_io::async_trait]
    impl OutputStream for TrackedStream {
        fn write(&mut self, _bytes: Bytes) -> Result<(), StreamError> {
            Ok(())
        }

        fn flush(&mut self) -> Result<(), StreamError> {
            Ok(())
        }

        fn check_write(&mut self) -> Result<usize, StreamError> {
            Ok(1)
        }
    }

    #[wasmtime_wasi_io::async_trait]
    impl Pollable for SlowOutputStream {
        async fn ready(&mut self) {
            tokio::time::sleep(SYNTHETIC_HOST_WAIT).await;
            self.writable = true;
        }
    }

    #[wasmtime_wasi_io::async_trait]
    impl OutputStream for SlowOutputStream {
        fn write(&mut self, _bytes: Bytes) -> Result<(), StreamError> {
            Ok(())
        }

        fn flush(&mut self) -> Result<(), StreamError> {
            Ok(())
        }

        fn check_write(&mut self) -> Result<usize, StreamError> {
            Ok(usize::from(self.writable))
        }
    }

    #[test]
    fn creates_sync_runtime_with_wasi_and_lock_imports() {
        Wasip2ComponentRuntime::new().unwrap();
    }

    #[test]
    fn cancellation_interrupts_a_blocked_wasi_pollable() {
        let (mut state, requested, active) = cancellable_state();
        let pollable = {
            let table = WasiView::ctx(&mut state).table;
            let slow = table.push(SlowPollable).unwrap();
            subscribe(table, slow).unwrap()
        };
        let cancellation = request_cancellation(requested, active);

        let started = Instant::now();
        let error = sync_poll::HostPollable::block(&mut state, pollable).unwrap_err();
        let elapsed = started.elapsed();
        cancellation.join().unwrap();

        assert!(
            error
                .to_string()
                .contains("native PHP stream was cancelled"),
            "{error:#}"
        );
        assert!(
            elapsed < MAX_CANCELLATION_LATENCY,
            "blocked WASI poll cancellation took {elapsed:?}"
        );
    }

    #[test]
    fn cancellation_interrupts_a_blocked_output_stream_flush() {
        let (mut state, requested, active) = cancellable_state();
        let stream = WasiView::ctx(&mut state)
            .table
            .push(Box::new(SlowOutputStream { writable: false }) as DynOutputStream)
            .unwrap();
        let cancellation = request_cancellation(requested, active);

        let started = Instant::now();
        let error = sync_streams::HostOutputStream::blocking_flush(&mut state, stream).unwrap_err();
        let elapsed = started.elapsed();
        cancellation.join().unwrap();

        assert!(
            error
                .to_string()
                .contains("native PHP stream was cancelled"),
            "{error}"
        );
        assert!(
            elapsed < MAX_CANCELLATION_LATENCY,
            "blocked output flush cancellation took {elapsed:?}"
        );
    }

    #[test]
    fn cancelled_stream_drops_clean_resources_before_reusing_host_state() {
        const ITERATIONS: u64 = 128;

        let mut state = Wasip2ContextBuilder::new().build().unwrap();
        let dropped = Arc::new(AtomicU64::new(0));

        for iteration in 0..ITERATIONS {
            let requested = Arc::new(AtomicBool::new(true));
            let active = Arc::new(ActiveCancellation::new(requested));
            active.notify();
            state.active_cancellation = Some(active);

            let output = WasiView::ctx(&mut state)
                .table
                .push(Box::new(TrackedStream {
                    dropped: Arc::clone(&dropped),
                }) as DynOutputStream)
                .unwrap();
            sync_streams::HostOutputStream::drop(&mut state, output).unwrap();
            assert_eq!(dropped.load(Ordering::Relaxed), iteration * 2 + 1);

            let input = WasiView::ctx(&mut state)
                .table
                .push(Box::new(TrackedStream {
                    dropped: Arc::clone(&dropped),
                }) as DynInputStream)
                .unwrap();
            sync_streams::HostInputStream::drop(&mut state, input).unwrap();
            assert_eq!(dropped.load(Ordering::Relaxed), iteration * 2 + 2);
        }

        state.active_cancellation = None;
        assert_eq!(dropped.load(Ordering::Relaxed), ITERATIONS * 2);
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
    fn cancellation_interrupts_a_blocked_whole_file_lock_and_allows_recovery() {
        let host_path = temp_dir("cancel-whole-file-lock");
        fs::write(host_path.join("lock-target"), b"lock me").unwrap();
        let mut state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&host_path, "/workspace"))
            .build()
            .unwrap();
        let holder = open_test_file(&mut state, "lock-target");
        let contender = open_test_file(&mut state, "lock-target");
        let borrowed_holder = || Resource::<Descriptor>::new_borrow(holder.rep());
        let borrowed_contender = || Resource::<Descriptor>::new_borrow(contender.rep());

        wit_locks::Host::lock_whole(
            &mut state,
            borrowed_holder(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap();
        let conflict = wit_locks::Host::lock_whole(
            &mut state,
            borrowed_contender(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap_err();
        assert!(matches!(conflict, wit_locks::LockError::WouldBlock));

        let (requested, active) = install_cancellation(&mut state);
        let cancellation = request_cancellation(requested, active);
        let started = Instant::now();
        let error = wit_locks::Host::lock_whole(
            &mut state,
            borrowed_contender(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::Blocking,
        )
        .unwrap_err();
        let elapsed = started.elapsed();
        cancellation.join().unwrap();
        assert!(
            error
                .to_string()
                .contains("native PHP stream was cancelled"),
            "{error:#}"
        );
        assert!(
            elapsed < MAX_CANCELLATION_LATENCY,
            "blocked whole-file lock cancellation took {elapsed:?}"
        );

        state.active_cancellation = None;
        wit_locks::Host::unlock_whole(&mut state, borrowed_holder())
            .unwrap()
            .unwrap();
        wit_locks::Host::lock_whole(
            &mut state,
            borrowed_contender(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap();
        wit_locks::Host::unlock_whole(&mut state, borrowed_contender())
            .unwrap()
            .unwrap();

        drop(state);
        fs::remove_dir_all(host_path).unwrap();
    }

    #[test]
    fn cancellation_during_whole_file_lock_acquisition_rolls_the_lock_back() {
        let host_path = temp_dir("cancel-whole-file-lock-success-race");
        let target = host_path.join("lock-target");
        fs::write(&target, b"lock me").unwrap();
        let acquired = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&target)
            .unwrap();
        let contender = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&target)
            .unwrap();
        let requested = Arc::new(AtomicBool::new(false));
        let active = Arc::new(ActiveCancellation::new(Arc::clone(&requested)));
        let signal_requested = Arc::clone(&requested);
        let signal_active = Arc::clone(&active);

        let error = cancellation_aware_lock(
            Some(active),
            locks::LockMode::Blocking,
            |mode| {
                locks::lock_whole(&acquired, locks::LockKind::Exclusive, mode)?;
                signal_requested.store(true, Ordering::Release);
                signal_active.notify();
                Ok(())
            },
            || locks::unlock_whole(&acquired),
        )
        .unwrap_err();
        assert!(
            error
                .to_string()
                .contains("native PHP stream was cancelled"),
            "{error:#}"
        );

        locks::lock_whole(
            &contender,
            locks::LockKind::Exclusive,
            locks::LockMode::NonBlocking,
        )
        .unwrap();
        locks::unlock_whole(&contender).unwrap();
        drop((acquired, contender));
        fs::remove_dir_all(host_path).unwrap();
    }

    #[test]
    #[cfg(any(
        target_os = "linux",
        target_os = "android",
        target_vendor = "apple",
        windows
    ))]
    fn cancellation_interrupts_a_blocked_range_lock_and_allows_recovery() {
        let host_path = temp_dir("cancel-range-lock");
        fs::write(host_path.join("lock-target"), b"lock me").unwrap();
        let mut state = Wasip2ContextBuilder::new()
            .preopen(CapabilityPreopen::read_write(&host_path, "/workspace"))
            .build()
            .unwrap();
        let holder = open_test_file(&mut state, "lock-target");
        let contender = open_test_file(&mut state, "lock-target");
        let borrowed_holder = || Resource::<Descriptor>::new_borrow(holder.rep());
        let borrowed_contender = || Resource::<Descriptor>::new_borrow(contender.rep());
        let range = || wit_locks::ByteRange {
            start: 1,
            length: Some(3),
        };

        wit_locks::Host::lock_range(
            &mut state,
            borrowed_holder(),
            range(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap();
        let conflict = wit_locks::Host::lock_range(
            &mut state,
            borrowed_contender(),
            range(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap_err();
        assert!(matches!(conflict, wit_locks::LockError::WouldBlock));

        let (requested, active) = install_cancellation(&mut state);
        let cancellation = request_cancellation(requested, active);
        let started = Instant::now();
        let error = wit_locks::Host::lock_range(
            &mut state,
            borrowed_contender(),
            range(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::Blocking,
        )
        .unwrap_err();
        let elapsed = started.elapsed();
        cancellation.join().unwrap();
        assert!(
            error
                .to_string()
                .contains("native PHP stream was cancelled"),
            "{error:#}"
        );
        assert!(
            elapsed < MAX_CANCELLATION_LATENCY,
            "blocked range lock cancellation took {elapsed:?}"
        );

        state.active_cancellation = None;
        wit_locks::Host::unlock_range(&mut state, borrowed_holder(), range())
            .unwrap()
            .unwrap();
        wit_locks::Host::lock_range(
            &mut state,
            borrowed_contender(),
            range(),
            wit_locks::LockKind::Exclusive,
            wit_locks::LockMode::NonBlocking,
        )
        .unwrap()
        .unwrap();
        wit_locks::Host::unlock_range(&mut state, borrowed_contender(), range())
            .unwrap()
            .unwrap();

        drop(state);
        fs::remove_dir_all(host_path).unwrap();
    }

    #[test]
    #[cfg(any(
        target_os = "linux",
        target_os = "android",
        target_vendor = "apple",
        windows
    ))]
    fn cancellation_during_range_lock_acquisition_rolls_the_lock_back() {
        let host_path = temp_dir("cancel-range-lock-success-race");
        let target = host_path.join("lock-target");
        fs::write(&target, b"lock me").unwrap();
        let acquired = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&target)
            .unwrap();
        let contender = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&target)
            .unwrap();
        let requested = Arc::new(AtomicBool::new(false));
        let active = Arc::new(ActiveCancellation::new(Arc::clone(&requested)));
        let signal_requested = Arc::clone(&requested);
        let signal_active = Arc::clone(&active);
        let range = locks::ByteRange::new(1, Some(3));

        let error = cancellation_aware_lock(
            Some(active),
            locks::LockMode::Blocking,
            |mode| {
                locks::lock_range(&acquired, range, locks::LockKind::Exclusive, mode)?;
                signal_requested.store(true, Ordering::Release);
                signal_active.notify();
                Ok(())
            },
            || locks::unlock_range(&acquired, range),
        )
        .unwrap_err();
        assert!(
            error
                .to_string()
                .contains("native PHP stream was cancelled"),
            "{error:#}"
        );

        locks::lock_range(
            &contender,
            range,
            locks::LockKind::Exclusive,
            locks::LockMode::NonBlocking,
        )
        .unwrap();
        locks::unlock_range(&contender, range).unwrap();
        drop((acquired, contender));
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

    fn cancellable_state() -> (
        crate::wasip2::Wasip2HostState,
        Arc<AtomicBool>,
        Arc<ActiveCancellation>,
    ) {
        let mut state = Wasip2ContextBuilder::new().build().unwrap();
        let (requested, active) = install_cancellation(&mut state);
        (state, requested, active)
    }

    fn install_cancellation(
        state: &mut crate::wasip2::Wasip2HostState,
    ) -> (Arc<AtomicBool>, Arc<ActiveCancellation>) {
        let requested = Arc::new(AtomicBool::new(false));
        let active = Arc::new(ActiveCancellation::new(Arc::clone(&requested)));
        state.active_cancellation = Some(Arc::clone(&active));
        (requested, active)
    }

    fn request_cancellation(
        requested: Arc<AtomicBool>,
        active: Arc<ActiveCancellation>,
    ) -> thread::JoinHandle<()> {
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(20));
            requested.store(true, Ordering::Release);
            active.notify();
        })
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
