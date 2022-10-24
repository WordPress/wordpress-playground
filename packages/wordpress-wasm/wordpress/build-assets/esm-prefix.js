// The number of bytes to download, which is just the size of the `wp.data` file.
// Populated by the Dockerfile.
export const dependenciesTotalSize = WP_DATA_SIZE;

// The final wp.data filename – populated by the Dockerfile.
export const dependencyFilename = WP_DATA_FILENAME;

// Prepending this to the built php.js file manually turns it
// into an ESM module.
// This replaces the Emscripten's MODULARIZE=1 which pollutes the
// global namespace and does not play well with import() mechanics.
export default function(PHPModule) {