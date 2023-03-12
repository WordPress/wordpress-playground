/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
declare const window: any; // For the web backend
/* eslint-disable no-inner-declarations */

export * from '../../php-library/scope';
import { setupTransferHandlers } from '../../php-library/transfer-handlers';

setupTransferHandlers();

// Read the query string startup options
export const startupOptions: Record<string, string> = {};
const params = new URL(self.location.href).searchParams;
params.forEach((value, key) => {
	startupOptions[key] = value;
});

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
