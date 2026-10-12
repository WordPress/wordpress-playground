import { logger } from '@php-wasm/logger';
import { isInOriginShell } from './origin-isolation';
import {
	getIndexedDB,
	loadDirectoryHandle,
} from './state/opfs/opfs-directory-handle-storage';

/** Keep native handles on the runtime's origin, including when its app is framed. */
export function chooseLocalDirectory(): Promise<FileSystemDirectoryHandle> {
	if (isInOriginShell()) {
		return requestDirectoryPopup();
	}
	return (window as any).showDirectoryPicker({
		// A stable picker ID remembers the last selected directory on this origin.
		id: 'playground-directory',
		mode: 'readwrite',
	});
}

/** A saved site's handle is loaded by its own popup; it never crosses the root. */
export function reconnectLocalDirectory(siteSlug: string) {
	return requestDirectoryPopup(siteSlug);
}

/** Wait for the same-origin check before loading a handle into the running app. */
function requestDirectoryPopup(
	siteSlug?: string
): Promise<FileSystemDirectoryHandle> {
	const id = crypto.randomUUID();
	const channel = new BroadcastChannel('playground-directory-' + id);
	const url = new URL('/local-directory.html', window.location.href);
	url.searchParams.set('request', id);
	if (siteSlug) url.searchParams.set('site-slug', siteSlug);
	// noopener intentionally makes window.open return null even on success.
	// The same-origin ready message distinguishes an opened popup from a blocker.
	window.open(url, '_blank', 'popup,width=560,height=620,noopener');
	return new Promise((resolve, reject) => {
		let finished = false;
		let timer = setTimeout(
			() =>
				finish(
					new Error(
						'Allow popups for Playground, then choose the directory again.'
					)
				),
			15000
		);
		channel.onmessage = async ({ data }) => {
			if (data === 'ready') {
				clearTimeout(timer);
				timer = setTimeout(
					() =>
						finish(
							new Error(
								'Directory setup timed out. Please try again.'
							)
						),
					10 * 60 * 1000
				);
			} else if (data === 'cancelled') {
				finish(
					new DOMException('Directory setup cancelled.', 'AbortError')
				);
			} else if (data === 'complete') {
				try {
					const handle = await loadDirectoryHandle(
						directorySetupKey(id)
					);
					// Completion comes from a framed check after the popup has left the
					// site origin. With no other top-level window on that origin, a
					// one-time grant has expired. Chrome can still revoke access later.
					if (
						(await handle.queryPermission({
							mode: 'readwrite',
						})) !== 'granted'
					) {
						throw new Error(
							'Choose “Allow on every visit” to keep this directory connected.'
						);
					}
					finish(undefined, handle);
				} catch (error) {
					finish(error);
				}
			}
		};
		/** Settle once and discard the temporary record without revoking the user’s grant. */
		function finish(error?: unknown, handle?: FileSystemDirectoryHandle) {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			channel.close();
			void removeDirectorySetup(id).catch((error) => logger.error(error));
			if (error) reject(error);
			else resolve(handle!);
		}
	});
}

/** Keep pending selections separate from saved-site handle records. */
export function directorySetupKey(id: string) {
	return 'directory-setup:' + id;
}

/** Delete only the pending selection; saved-site handles remain available. */
export async function removeDirectorySetup(id: string) {
	const db = await getIndexedDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction('fileSystemStore', 'readwrite');
		tx.objectStore('fileSystemStore').delete(directorySetupKey(id));
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** The root helper sees only an origin, request ID, and next step, never a handle. */
export function directoryPopupUrl(origin: string, id: string, phase: string) {
	const url = new URL('/local-directory.html', origin);
	url.searchParams.set('request', id);
	url.searchParams.set('phase', phase);
	return url;
}
