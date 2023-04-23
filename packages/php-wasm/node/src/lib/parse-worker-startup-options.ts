export function parseWorkerStartupOptions(): Record<string, string> {
	return JSON.parse(process.env['WORKER_OPTIONS'] || '{}');
}
