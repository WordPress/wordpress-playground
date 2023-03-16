import { WorkerStartupOptions } from '@wp-playground/php-wasm-common';

export function parseWorkerStartupOptions(): WorkerStartupOptions {
	return JSON.parse(process.env['WORKER_OPTIONS'] || '{}');
}
