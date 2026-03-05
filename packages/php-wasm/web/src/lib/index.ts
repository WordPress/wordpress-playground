export type { LoaderOptions as PHPWebLoaderOptions } from './load-runtime';

export { loadWebRuntime } from './load-runtime';
export { getPHPLoaderModule } from './get-php-loader-module';
export { setupPostMessageRelay } from './setup-post-message-relay';

export { spawnPHPWorkerThread } from './worker-thread/spawn-php-worker-thread';
export { createDirectoryHandleMountHandler } from './directory-handle-mount';
export type {
	MountDevice,
	MountOptions,
	SyncProgress,
	SyncProgressCallback,
} from './directory-handle-mount';

export * from './tls/certificates';
export type { TCPOverFetchOptions } from './tcp-over-fetch-websocket';
// Re-export from web-service-worker to preserve previous exports of
// the same names from this package.
export {
	fetchWithCorsProxy,
	FirewallInterferenceError,
} from '@php-wasm/web-service-worker';
export {
	consumeAPI,
	exposeAPI,
	type RemoteAPI,
	type PublicAPI,
	type WithAPIState,
	type WithIsReady,
} from '@php-wasm/universal';
