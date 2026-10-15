import type { Plugin } from 'vite';

/** Inline recovery so it remains available when application assets cannot load. */
export function serviceWorkerRecoveryPlugin(): Plugin {
	return {
		name: 'service-worker-recovery',
		transformIndexHtml() {
			return [
				{
					tag: 'script',
					children: `window.retryPlaygroundStartup = ${retryPlaygroundStartup.toString()};`,
					injectTo: 'head',
				},
			];
		},
	};
}

/** This function is serialized into HTML. Keep its dependencies inside the function. */
export async function retryPlaygroundStartup(
	button: HTMLButtonElement,
	errorMessage: HTMLElement
) {
	if (button.disabled) return;
	const originalLabel = button.textContent;
	button.disabled = true;
	button.textContent = 'Updating Playground…';
	errorMessage.textContent = '';
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let finished = false;
	const cleanups: (() => void)[] = [];
	try {
		await Promise.race([
			updateWorker(),
			new Promise((_, reject) => {
				timeout = setTimeout(
					() =>
						reject(
							new Error(
								'Updating Playground timed out. Please try again.'
							)
						),
					15000
				);
			}),
		]);
		window.location.reload();
	} catch (error) {
		// The bundled logger may be unavailable on this error screen.
		// eslint-disable-next-line no-console
		console.error('Failed to recover Playground startup.', error);
		errorMessage.textContent =
			'Could not update Playground. ' +
			(error instanceof Error ? error.message : String(error));
	} finally {
		finished = true;
		clearTimeout(timeout);
		for (const cleanup of cleanups) cleanup();
		button.disabled = false;
		button.textContent = originalLabel;
	}

	async function updateWorker() {
		const serviceWorker = navigator.serviceWorker;
		if (!serviceWorker) return;
		const registration = await serviceWorker.getRegistration(
			window.location.href
		);
		if (finished || !registration) return;
		await registration.update();
		if (finished) return;
		// The update promise does not wait for installation, activation, or clients.claim().
		const replacement =
			registration.installing ??
			registration.waiting ??
			registration.active;
		if (!replacement) throw new Error('No service worker is available.');
		await new Promise<void>((resolve, reject) => {
			const check = () => {
				if (replacement.state === 'redundant') {
					reject(
						new Error('The Playground update failed to install.')
					);
				} else if (
					replacement.state === 'activated' &&
					serviceWorker.controller === replacement
				) {
					resolve();
				}
			};
			replacement.addEventListener('statechange', check);
			serviceWorker.addEventListener('controllerchange', check);
			cleanups.push(() => {
				replacement.removeEventListener('statechange', check);
				serviceWorker.removeEventListener('controllerchange', check);
			});
			check();
		});
	}
}
