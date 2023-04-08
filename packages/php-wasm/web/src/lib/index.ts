export { PHP, loadPHPRuntime } from '@php-wasm/common';
export type {
	PHPOutput,
	PHPServer,
	PHPServerRequest,
	PHPRequest,
	PHPResponse,
	JavascriptRuntime,
	ErrnoError,
	DataModule,
	PHPLoaderModule,
	PHPRuntime,
	PHPRuntimeId,
	EmscriptenOptions,
	MountSettings,
} from '@php-wasm/common';

export * from './php-client';

export { PHP_VERSIONS, getPHPLoaderModule } from './get-php-loader-module';

export { parseWorkerStartupOptions } from './worker-thread/parse-startup-options';
export {
	spawnPHPWorkerThread,
	recommendedWorkerBackend,
} from './worker-thread/spawn-php-worker-thread';

export { registerServiceWorker } from './register-service-worker';

export { PHPClient } from './php-client';
