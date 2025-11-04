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
export { fetchWithCorsProxy } from './fetch-with-cors-proxy';

// Network connectors
export { createHttpConnector } from './connectors/http-fetch-connector';
export type { HttpFetchConnectorOptions } from './connectors/http-fetch-connector';
export { withNetworkConnectors } from './network-websocket';
export {
	createSmtpConnector,
	createMysqlConnector,
	type SmtpConnectorOptions,
	type SmtpEmail,
	type MysqlConnectorOptions,
	createPortConnector,
	createCustomConnector,
	createFindConnector,
	type NetworkConnector,
	type NetworkConnection,
	type ConnectionInfo,
	type ConnectToFunction,
} from '@php-wasm/util';
export {
	consumeAPI,
	exposeAPI,
	type RemoteAPI,
	type PublicAPI,
	type WithAPIState,
	type WithIsReady,
} from '@php-wasm/universal';
