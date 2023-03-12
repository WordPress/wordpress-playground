/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
/* eslint-disable no-inner-declarations */

export * from './php-library/scope';
import { setupTransferHandlers } from './php-library/comlink';

setupTransferHandlers();

// Read the query string startup options
export const startupOptions: Record<string, string> = {};
if (typeof self?.location?.href !== 'undefined') {
	// Web
	const params = new URL(self.location.href).searchParams;
	params.forEach((value, key) => {
		startupOptions[key] = value;
	});
} else {
	// Node.js
	Object.assign(
		startupOptions,
		JSON.parse(process.env.WORKER_OPTIONS || '{}')
	);
}

export function materializedProxy(object: any) {
	const proto = Object.getPrototypeOf(object);
	const props = Object.getOwnPropertyNames(proto);
	const proxy = {};
	for (const prop of props) {
		if (typeof object[prop] === 'function') {
			proxy[prop] = (...args) => object[prop](...args);
		} else {
			proxy[prop] = object[prop];
		}
	}
	return proxy;
}
