mod component;
mod context;
pub mod locks;
mod php;
// Canonical SQLite WAL-index state shared by independent component workers.
mod sqlite_shm;

pub use component::Wasip2ComponentRuntime;
pub use context::{CapabilityPreopen, Wasip2ContextBuilder, Wasip2HostState};
pub use php::{
    Wasip2PhpInstance, Wasip2PhpOutput, Wasip2PhpOutputChannel, Wasip2PhpResponse,
    Wasip2PhpStreamEvent, Wasip2PhpStreamSink, PHP_STREAM_FRAME_BYTES,
};
