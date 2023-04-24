import { WorkerStartupOptions } from '@php-wasm/abstract';

export function parseWorkerStartupOptions(): WorkerStartupOptions {
	return JSON.parse(process.env['WORKER_OPTIONS'] || '{}');
}
