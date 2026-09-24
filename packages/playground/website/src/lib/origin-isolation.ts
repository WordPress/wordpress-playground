import type { SitePersistence } from './state/redux/slice-sites';

export interface OriginSite {
	origin: string;
	name: string;
	storage: 'opfs' | 'local-fs';
	persistence?: SitePersistence;
}

export interface OriginSetup {
	url: string;
	name?: string;
	storage: 'temporary' | 'opfs';
	persistence?: SitePersistence;
	zip?: File;
}

export function isSiteOrigin(
	origin: string,
	base = window.location.origin
): boolean {
	try {
		const url = new URL(origin);
		const parent = new URL(base);
		return (
			url.origin === origin &&
			url.protocol === parent.protocol &&
			url.port === parent.port &&
			/^site-[a-f0-9-]+\.playground\.localhost$/.test(url.hostname)
		);
	} catch {
		return false;
	}
}

export function catalogueUrl(): URL {
	const url = new URL('/origin-isolation.html', window.location.href);
	url.hostname = 'playground.localhost';
	return url;
}

let catalogueFrame: Promise<HTMLIFrameElement> | undefined;

/** Only names, origins, and save state cross this boundary; never site files or credentials. */
export async function updateOriginCatalogue(
	site?: Omit<OriginSite, 'origin'> | null
) {
	catalogueFrame ??= loadBridge(catalogueUrl());
	const result = await requestBridge<OriginSite[]>(
		await catalogueFrame,
		'catalogue',
		site
	);
	if (site !== undefined)
		window.dispatchEvent(new Event('playground-catalogue-updated'));
	return result;
}

/** Stage file bytes on an empty origin before leaving the current document. */
export async function navigateToFreshOrigin(
	setup: OriginSetup
): Promise<never> {
	await updateOriginCatalogue();
	const destination = new URL(setup.url);
	destination.hostname = `site-${crypto.randomUUID()}.playground.localhost`;
	destination.searchParams.delete('site-slug');
	destination.searchParams.delete('random');
	const frame = await loadBridge(
		new URL('/origin-isolation.html', destination)
	);
	try {
		await requestBridge(frame, 'setup', {
			...setup,
			url: destination.href,
		});
	} finally {
		frame.remove();
	}
	window.location.assign(destination.href);
	// The destination has its own API and readiness promise. Callers in this
	// document must not continue mutating the old site after navigation starts.
	return new Promise<never>(() => {});
}

async function loadBridge(url: URL): Promise<HTMLIFrameElement> {
	const frame = document.createElement('iframe');
	frame.hidden = true;
	frame.src = url.href;
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			frame.remove();
			reject(new Error('Could not load the Playground origin bridge.'));
		}, 30000);
		frame.onload = () => {
			clearTimeout(timeout);
			resolve();
		};
		document.body.append(frame);
	});
	return frame;
}

async function requestBridge<T>(
	frame: HTMLIFrameElement,
	action: string,
	value: unknown
): Promise<T> {
	const id = crypto.randomUUID();
	const origin = new URL(frame.src).origin;
	return await new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(
			() =>
				finish(
					new Error('The Playground origin bridge did not respond.')
				),
			30000
		);
		const receive = (event: MessageEvent) => {
			if (
				event.source !== frame.contentWindow ||
				event.origin !== origin ||
				event.data?.id !== id
			)
				return;
			finish(
				event.data.error ? new Error(event.data.error) : undefined,
				event.data.value
			);
		};
		function finish(error?: Error, result?: T) {
			clearTimeout(timeout);
			window.removeEventListener('message', receive);
			if (error) reject(error);
			else resolve(result!);
		}
		window.addEventListener('message', receive);
		frame.contentWindow!.postMessage(
			{ type: 'playground-origin', id, action, value },
			origin
		);
	});
}

/**
 * Claim an origin once. A setup frame can only write before the app first runs.
 * Consuming a setup keeps the claim, including for temporary sites with no OPFS.
 * The IndexedDB transaction makes concurrent setup attempts mutually exclusive.
 */
export async function claimOriginSetup(
	setup?: OriginSetup
): Promise<{ setup?: OriginSetup; wasUsed: boolean }> {
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open('playground-origin-setup', 1);
		request.onupgradeneeded = () =>
			request.result.createObjectStore('setup');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	try {
		return await new Promise<{ setup?: OriginSetup; wasUsed: boolean }>(
			(resolve, reject) => {
				const transaction = db.transaction('setup', 'readwrite');
				const store = transaction.objectStore('setup');
				const request = store.get('claim');
				let previous: OriginSetup | undefined;
				let wasUsed = false;
				request.onsuccess = () => {
					if (setup && request.result) {
						transaction.abort();
						return;
					}
					previous = request.result?.setup;
					wasUsed = !!request.result && !previous;
					store.put(setup ? { setup } : {}, 'claim');
				};
				transaction.oncomplete = () =>
					resolve({ setup: previous, wasUsed });
				transaction.onabort = () =>
					reject(
						transaction.error ||
							new Error(
								'This Playground origin is already in use.'
							)
					);
				transaction.onerror = () => reject(transaction.error);
			}
		);
	} finally {
		db.close();
	}
}
