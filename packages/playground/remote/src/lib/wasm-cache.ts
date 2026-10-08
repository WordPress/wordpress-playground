// @ts-ignore
import { buildVersion } from 'virtual:remote-config';

const CACHE_DIRECTORY = 'playground-wasm-cache';

/**
 * Reads a complete Wasm download from this release's OPFS cache.
 * These are the original bytes, not a serialized WebAssembly.Module.
 */
export async function getCachedWasm(
	url: string
): Promise<Response | undefined> {
	try {
		const handle = await getWasmFileHandle(url, false);
		const file = await handle.getFile();
		// Creating a handle leaves an empty file if the first download is interrupted.
		if (!file.size) {
			return;
		}
		return new Response(file, {
			headers: {
				'Content-Type': 'application/wasm',
				'Content-Length': String(file.size),
			},
		});
	} catch {
		// OPFS can be unavailable, denied, evicted, or missing this download.
		return;
	}
}

/**
 * Streams a download into OPFS. A failed write leaves the response readable
 * so the caller can fall back to CacheStorage.
 */
export async function putCachedWasm(
	url: string,
	response: Response
): Promise<boolean> {
	try {
		const handle = await getWasmFileHandle(url, true);
		// Asset URLs are immutable within a release. The PHP worker and service worker
		// can both cache the same download; do not rewrite a file that is already complete.
		if ((await handle.getFile()).size) {
			return true;
		}
		const writable = await handle.createWritable();
		const download = response.clone().body!;
		// pipeTo closes on success and aborts on a broken download. createWritable
		// publishes the new bytes only on close, so readers never see a partial file.
		try {
			// Cancelling a tee waits for the other branch. That branch is the fallback
			// response, which cannot be consumed until this write returns after an error.
			await download.pipeTo(writable, { preventCancel: true });
		} finally {
			void download.cancel().catch(() => undefined);
		}
		return true;
	} catch {
		return false;
	}
}

/** Removes only obsolete releases from the Wasm cache, leaving saved sites alone. */
export async function purgePreviousWasmReleases(): Promise<void> {
	try {
		const root = await navigator.storage.getDirectory();
		const cache = await root.getDirectoryHandle(CACHE_DIRECTORY);
		for await (const name of cache.keys()) {
			if (name !== buildVersion) {
				await cache.removeEntry(name, { recursive: true });
			}
		}
	} catch {
		// A missing or inaccessible optional cache must not prevent activation.
	}
}

/** Resolves a URL to a bounded filename inside this release's cache directory. */
async function getWasmFileHandle(
	url: string,
	create: boolean
): Promise<FileSystemFileHandle> {
	const root = await navigator.storage.getDirectory();
	const cache = await root.getDirectoryHandle(CACHE_DIRECTORY, { create });
	const release = await cache.getDirectoryHandle(buildVersion, { create });
	const key = new URL(url, self.location.href);
	key.hash = '';
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(key.href)
	);
	const filename = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	return release.getFileHandle(`${filename}.wasm`, { create });
}
