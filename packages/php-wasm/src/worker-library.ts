/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
/* eslint-disable no-inner-declarations */

export * from './php-library/scope';

export type StartupOptions = Record<string, string>;
export function parseStartupOptions(): StartupOptions {
	// Read the query string startup options
	if (typeof self?.location?.href !== 'undefined') {
		// Web
		const startupOptions: StartupOptions = {};
		const params = new URL(self.location.href).searchParams;
		params.forEach((value, key) => {
			startupOptions[key] = value;
		});
		return startupOptions;
	} else {
		// Node.js
		return JSON.parse(process.env.WORKER_OPTIONS || '{}');
	}
}
