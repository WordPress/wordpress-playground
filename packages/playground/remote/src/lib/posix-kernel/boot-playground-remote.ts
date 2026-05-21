/**
 * Bootstrap for the `--experimental-posix-kernel` browser mode.
 *
 * Parallel to `boot-playground-remote.ts`, but loaded by
 * `remote-posix-kernel.html`. Differences:
 *
 *   - Spawns the kernel-mode Comlink worker
 *     (`playground-worker-endpoint.ts?worker&url`) instead of the
 *     v1/v2 PHP workers.
 *   - Skips the `mountOpfs` / journal / `cli` plumbing that the
 *     classic worker exposes; the kernel-mode handler delivers
 *     WordPress via nginx + php-fpm, so those APIs aren't relevant
 *     for the first cut.
 *   - Service worker reuse: still registers
 *     `packages/playground/remote/service-worker.ts` so scoped URL
 *     routing, COOP/COEP headers and the existing dispatch keep
 *     working. The `request` message the service worker sends is
 *     answered by the kernel-mode worker's `requestStreamed`
 *     implementation.
 *
 * Everything that doesn't differ from the classic boot is documented
 * inline in `../boot-playground-remote.ts`; refer there before
 * extending behaviour here.
 */
import type { MessageListener } from '@php-wasm/universal';
import { streamToPort } from '@php-wasm/universal';
import {
	spawnPHPWorkerThread,
	exposeAPI,
	consumeAPI,
	setupPostMessageRelay,
} from '@php-wasm/web';
import { logger } from '@php-wasm/logger';
import { PhpWasmError } from '@php-wasm/util';
import { responseTo } from '@php-wasm/web-service-worker';

import serviceWorkerPath from '../../../service-worker.ts?worker&url';
import kernelWorkerUrl from './playground-worker-endpoint.ts?worker&url';

import type { KernelPlaygroundWorkerEndpoint } from './playground-worker-endpoint';

const origin = new URL('/', (import.meta || {}).url).origin;
const serviceWorkerUrl = new URL(serviceWorkerPath, origin);

// @ts-ignore
if (import.meta.hot) {
	// @ts-ignore
	import.meta.hot.accept(() => {});
}

export async function bootPlaygroundRemote() {
	assertNotInfiniteLoadingLoop();

	const sw = navigator.serviceWorker;
	if (!sw) {
		if (window.isSecureContext) {
			throw new PhpWasmError(
				'Service workers are not supported in your browser.'
			);
		}
		throw new PhpWasmError(
			'WordPress Playground uses service workers and may only work on HTTPS and http://localhost/ sites, but the current site is neither.'
		);
	}

	const registration = await sw.register(serviceWorkerUrl + '', {
		type: 'module',
		updateViaCache: 'none',
	});

	try {
		await registration.update();
	} catch (e) {
		logger.error('Failed to update service worker.', e);
	}

	const workerUrl = new URL(kernelWorkerUrl, origin) + '';
	const kernelWorkerApi = consumeAPI<KernelPlaygroundWorkerEndpoint>(
		await spawnPHPWorkerThread(workerUrl)
	);

	const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;

	const playgroundApi = {
		async onDownloadProgress(fn: (event: any) => void) {
			return kernelWorkerApi.onDownloadProgress(fn);
		},
		async onNavigation(fn: (path: string) => void) {
			let lastPath: string | undefined;
			wpFrame.addEventListener('load', async (e: any) => {
				try {
					const contentWindow = e.currentTarget!.contentWindow;
					await new Promise((resolve) => setTimeout(resolve, 0));
					const path = await playground.internalUrlToPath(
						contentWindow.location.href
					);
					if (path !== lastPath) {
						lastPath = path;
						fn(path);
					}
				} catch {
					/* ignore */
				}
			});
			setInterval(async () => {
				try {
					let href = '';
					if (wpFrame.contentWindow) {
						href = wpFrame.contentWindow.location.href;
					} else {
						href = wpFrame.src;
					}
					const path = await playground.internalUrlToPath(href);
					if (path !== lastPath) {
						lastPath = path;
						fn(path);
					}
				} catch {
					/* ignore */
				}
			}, 500);
		},
		async goTo(requestedPath: string) {
			if (!requestedPath.startsWith('/')) {
				requestedPath = '/' + requestedPath;
			}
			if (requestedPath === '/wp-admin') {
				requestedPath = '/wp-admin/';
			}
			const newUrl = await playground.pathToInternalUrl(requestedPath);
			const oldUrl = wpFrame.src;
			const navigationComplete = new Promise<void>((resolve) => {
				wpFrame.addEventListener('load', () => resolve(), {
					once: true,
				});
			});
			if (newUrl === oldUrl && wpFrame.contentWindow) {
				try {
					wpFrame.contentWindow.location.href = newUrl;
					await navigationComplete;
					return;
				} catch {
					/* ignore */
				}
			}
			wpFrame.src = newUrl;
			await navigationComplete;
		},
		async getCurrentURL() {
			let url = '';
			try {
				url = wpFrame.contentWindow!.location.href;
			} catch {
				/* ignore */
			}
			if (!url) {
				url = wpFrame.src;
			}
			return await playground.internalUrlToPath(url);
		},
		async setIframeSandboxFlags(flags: string[]) {
			wpFrame.setAttribute('sandbox', flags.join(' '));
		},
		// The website's `progressTracker.pipe(playground)` calls
		// `setProgress` / `setLoaded` on the iframe-side `playgroundApi`
		// (see `packages/php-wasm/progress/src/lib/progress-tracker.ts`
		// `pipe()`). The classic boot wires these to its in-iframe
		// progress bar; kernel mode has no progress bar yet, so these
		// are no-ops. Without them, Comlink's worker-side dispatch hits
		// `undefined.apply(...)` and the whole boot promise rejects
		// before our kernel logic gets a chance to run.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async setProgress(_options: unknown) {
			/* no-op for the first cut */
		},
		async setLoaded() {
			/* no-op for the first cut */
		},
		async onMessage(callback: MessageListener) {
			return await kernelWorkerApi.onMessage(callback);
		},
		async addEventListener(event: any, listener: any) {
			return await kernelWorkerApi.addEventListener(event, listener);
		},
		async removeEventListener(event: any, listener: any) {
			return await kernelWorkerApi.removeEventListener(event, listener);
		},
		async boot(options: any) {
			await kernelWorkerApi.boot(options);

			// Same shape as the classic boot: pipe service-worker `request`
			// messages to the worker's request handler. The kernel worker
			// implements `requestStreamed` so the existing service-worker
			// dispatch needs no changes.
			navigator.serviceWorker.addEventListener(
				'message',
				async function onMessage(event) {
					if (options.scope && event.data.scope !== options.scope) {
						return;
					}

					const args = event.data.args || [];
					const method = event.data.method as string;

					if (method === 'request') {
						const streamedResponse = await (
							kernelWorkerApi.requestStreamed as any
						)(...args);
						const httpStatusCode =
							await streamedResponse.httpStatusCode;
						const headers = await streamedResponse.headers;
						const bodyPort = streamToPort(streamedResponse.stdout);
						(event.source! as ServiceWorker).postMessage(
							responseTo(event.data.requestId, {
								httpStatusCode,
								headers,
								bodyPort,
							}),
							[bodyPort]
						);
					} else {
						const result = await (kernelWorkerApi as any)[method](
							...args
						);
						event.source!.postMessage(
							responseTo(event.data.requestId, result)
						);
					}
				}
			);
			sw.startMessages();

			try {
				await kernelWorkerApi.isReady();
				setupPostMessageRelay(
					wpFrame,
					getOrigin((await playground.absoluteUrl)!)
				);
				setAPIReady();
			} catch (e) {
				setAPIError(e as Error);
				throw e;
			}
		},
	};

	await kernelWorkerApi.isConnected();

	const [setAPIReady, setAPIError, playground] = exposeAPI(
		playgroundApi,
		kernelWorkerApi
	);

	return playground;
}

function getOrigin(url: string) {
	return new URL(url, 'https://example.com').origin;
}

function assertNotInfiniteLoadingLoop() {
	let isBrowserInABrowser = false;
	try {
		isBrowserInABrowser =
			window.parent !== window &&
			(window as any).parent.IS_WASM_WORDPRESS;
	} catch {
		/* ignore */
	}
	if (isBrowserInABrowser) {
		throw new Error(
			`The service worker did not load correctly. This is a bug, ` +
				`please report it on https://github.com/WordPress/wordpress-playground/issues`
		);
	}
	(window as any).IS_WASM_WORDPRESS = true;
}
