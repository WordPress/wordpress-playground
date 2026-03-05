/**
 * Synchronous XHR channel for the JSPI polyfill.
 *
 * Sends a synchronous POST XMLHttpRequest to a `/_jspi/<path>`
 * endpoint handled by the service worker. The service worker
 * does async work in its fetch handler and responds. The XHR
 * blocks until the response arrives.
 *
 * This replaces the SharedArrayBuffer-based channel: no SAB,
 * no Atomics, no cross-origin isolation required.
 *
 * Must only be called from a Web Worker (synchronous XHR with
 * responseType='arraybuffer' is forbidden on the main thread).
 */

export interface SyncXhrResponse {
	ok: boolean;
	data: Uint8Array;
}

export function sendSyncXhr(
	path: string,
	params?: Record<string, string | number>,
	body?: Uint8Array
): SyncXhrResponse {
	let url = `/_jspi/${path}`;
	if (params) {
		const qs = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			qs.set(key, String(value));
		}
		url += '?' + qs.toString();
	}

	const xhr = new XMLHttpRequest();
	xhr.open('POST', url, false);
	xhr.responseType = 'arraybuffer';

	try {
		if (body) {
			xhr.send(body);
		} else {
			xhr.send();
		}
	} catch {
		// NetworkError when no service worker is intercepting
		// (e.g. SW not yet active, terminated, or missing).
		return { ok: false, data: new Uint8Array(0) };
	}

	if (xhr.status >= 200 && xhr.status < 300) {
		const buffer = xhr.response as ArrayBuffer;
		return {
			ok: true,
			data: new Uint8Array(buffer),
		};
	}

	return {
		ok: false,
		data: new Uint8Array(0),
	};
}
