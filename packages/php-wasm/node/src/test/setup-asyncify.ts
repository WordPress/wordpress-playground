// Node 24 exposes JSPI by default; hide it so the Asyncify targets load that runtime.
if (process.env['PHP_WASM_TEST_ASYNCIFY'] === 'true') {
	Reflect.deleteProperty(WebAssembly, 'Suspending');
}
