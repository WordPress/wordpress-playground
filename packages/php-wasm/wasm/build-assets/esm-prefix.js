// The number of bytes to download, which is just the size of the `php.wasm` file.
// Populated by the Dockerfile.
export const dependenciesTotalSize = PHP_WASM_SIZE;

// The final php.wasm filename – populated by the Dockerfile.
export const dependencyFilename = PHP_WASM_FILENAME;

// Prepending this to the built php.js file manually turns it
// into an ESM module.
// This replaces the Emscripten's MODULARIZE=1 which pollutes the
// global namespace and does not play well with import() mechanics.
export default function(Env, PHPLoader) {