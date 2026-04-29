// Smallest viable ext-php-rs extension. The integration test loads this
// .so under PHP.wasm and asserts that hello_rs() returns the expected
// string — that proves the Rust → wasm32-unknown-emscripten → SIDE_MODULE
// pipeline works end-to-end.

use ext_php_rs::prelude::*;

#[php_function]
pub fn hello_rs() -> String {
	"Hello from a Rust PHP extension running in PHP.wasm".to_string()
}

#[php_module]
pub fn module(module: ModuleBuilder) -> ModuleBuilder {
	module
}
