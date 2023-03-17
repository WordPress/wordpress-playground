import { WorkerStartupOptions } from '@php-wasm/common';

export function parseWorkerStartupOptions(): WorkerStartupOptions {
	return JSON.parse(process.env['WORKER_OPTIONS'] || '{}');
}
