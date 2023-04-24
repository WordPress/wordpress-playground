import type { WorkerStartupOptions } from '@php-wasm/abstract';

export function parseWorkerStartupOptions<
	T extends Record<string, string>
>(): WorkerStartupOptions<T> {
	const startupOptions: any = {};
	if (typeof self?.location?.href !== 'undefined') {
		const params = new URL(self.location.href).searchParams;
		params.forEach((value, key) => {
			startupOptions[key] = value;
		});
	}
	return startupOptions;
}
