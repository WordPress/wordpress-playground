export { PHP, loadPHPRuntime } from '@wp-playground/php-wasm-common';
export type {
  PHPOutput,
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
} from '@wp-playground/php-wasm-common';

export * from './php-client';

export { getPHPLoaderModule } from './get-php-loader-module';

export { parseWorkerStartupOptions } from './worker-thread/parse-startup-options';
export {
  spawnPHPWorkerThread,
  recommendedWorkerBackend,
} from './worker-thread/spawn-php-worker-thread';

export { registerServiceWorker } from './register-service-worker';

export { PHPClient } from './php-client';
