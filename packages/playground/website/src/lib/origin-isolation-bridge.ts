import { resolvePathUnder } from '@php-wasm/util';
import { claimOriginSetup, isSiteOrigin } from './origin-isolation';
import type { OriginSetup, OriginSite } from './origin-isolation';

window.addEventListener('message', async (event) => {
	const request = event.data;
	if (
		event.source !== window.parent ||
		!isSiteOrigin(event.origin) ||
		request?.type !== 'playground-origin' ||
		typeof request.id !== 'string'
	)
		return;

	try {
		let value: unknown;
		if (
			window.location.hostname === 'playground.localhost' &&
			request.action === 'catalogue'
		) {
			value = updateCatalogue(event.origin, request.value);
		} else if (
			isSiteOrigin(window.location.origin) &&
			request.action === 'setup'
		) {
			const setup = request.value as OriginSetup;
			const target = new URL(setup.url);
			if (
				target.origin !== window.location.origin ||
				target.pathname !== '/' ||
				target.username !== '' ||
				target.password !== '' ||
				(setup.name !== undefined &&
					(typeof setup.name !== 'string' ||
						setup.name.length > 200)) ||
				(setup.persistence !== undefined &&
					!['autosave', 'explicit'].includes(setup.persistence)) ||
				!['temporary', 'opfs'].includes(setup.storage) ||
				(setup.zip !== undefined && !(setup.zip instanceof File)) ||
				(setup.blueprint !== undefined &&
					(setup.zip !== undefined ||
						!Array.isArray(setup.blueprint) ||
						!setup.blueprint.every(
							(entry) =>
								entry &&
								typeof entry.path === 'string' &&
								resolvePathUnder(entry.path, '/') ===
									entry.path &&
								(entry.bytes === null ||
									entry.bytes instanceof Uint8Array)
						)))
			) {
				throw new Error('Invalid Playground setup.');
			}
			// Older prototype sites may have files but no IndexedDB claim yet.
			// This endpoint never reads their contents and must not overwrite them.
			if (navigator.storage.getDirectory) {
				const root = await navigator.storage.getDirectory();
				if (!(await root.keys().next()).done) {
					throw new Error(
						'This Playground origin already has files.'
					);
				}
			}
			await claimOriginSetup({
				url: target.href,
				name: setup.name,
				storage: setup.storage,
				persistence: setup.persistence,
				zip: setup.zip,
				blueprint: setup.blueprint?.map(({ path, bytes }) => ({
					path,
					bytes,
				})),
			});
		} else {
			throw new Error('Unsupported Playground origin operation.');
		}
		window.parent.postMessage({ id: request.id, value }, event.origin);
	} catch (error) {
		window.parent.postMessage(
			{ id: request.id, error: String(error) },
			event.origin
		);
	}
});

function updateCatalogue(
	origin: string,
	site: Omit<OriginSite, 'origin'> | null | undefined
): OriginSite[] {
	const prefix = 'origin-isolation-site:';
	const key = prefix + origin;
	if (site === null) {
		localStorage.removeItem(key);
	} else if (site !== undefined) {
		if (
			typeof site.name !== 'string' ||
			site.name.length > 200 ||
			!['opfs', 'local-fs'].includes(site.storage) ||
			(site.persistence !== undefined &&
				!['autosave', 'explicit'].includes(site.persistence))
		) {
			throw new Error('Invalid Playground catalogue entry.');
		}
		// The caller cannot choose the key or change another site's entry.
		localStorage.setItem(
			key,
			JSON.stringify({
				origin,
				name: site.name,
				storage: site.storage,
				persistence: site.persistence,
			})
		);
	}
	// Separate keys keep concurrent tabs from replacing each other's entries.
	return Object.keys(localStorage)
		.filter((key) => key.startsWith(prefix))
		.map((key) => JSON.parse(localStorage.getItem(key)!));
}
