use std::sync::Arc;

use crate::{mount::Mount, php_runtime_files::PhpConstantValue};

/// Configuration shared by every PHP component worker.
///
/// This deliberately contains only settings the component backend consumes.
/// Server routing, symlink policy, diagnostics, subprocesses, dynamic
/// extensions, and legacy runtime glue belong outside the worker boundary.
#[derive(Debug, Clone, Default)]
pub struct PhpWorkerOptions {
    pub mounts: Vec<Mount>,
    pub constants: Vec<(String, PhpConstantValue)>,
    pub php_ini_entries: Vec<String>,
    pub env_entries: Vec<(String, String)>,
    pub internal_files: Vec<(String, Arc<[u8]>)>,
}
