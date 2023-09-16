// The number of bytes to download, which is just the size of the `wp.data` file.
// Populated by Dockerfile.
export const dependenciesTotalSize = WP_DATA_SIZE;

// The final wp.data filename – populated by Dockerfile.
import dependencyFilename from './WP_DATA_FILENAME?url';
export { dependencyFilename };

// The default theme name – populated by Dockerfile.
export const defaultThemeName = WP_THEME_NAME;

// Prepending this to the built php.js file manually turns it
// into an ESM module.
// This replaces the Emscripten's MODULARIZE=1 which pollutes the
// global namespace and does not play well with import() mechanics.
export default function (PHPModule) {
	return new Promise(function(resolve, reject) {
        function onLoadingFailed(error) {
            const wrappingError = new Error(`Failed to load data dependency module "${dependencyFilename}"${typeof error === 'string' ? ` (${error})` : ''}`);
            wrappingError.cause = error instanceof Error ? error : null;
            reject(wrappingError);
        };