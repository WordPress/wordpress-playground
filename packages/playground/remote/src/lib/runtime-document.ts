import { logger } from '@php-wasm/logger';
import { assertDocumentOrigin, assertAppParent } from './deployment';

export async function startRuntimeDocument(access: 'public' | 'app') {
	if (window.top != window.self) {
		document.body.classList.add('is-embedded');
	}

	try {
		assertDocumentOrigin('app');
		if (access === 'app') assertAppParent();
		const { bootPlaygroundRemote } =
			await import('./boot-playground-remote');
		(window as Window & { playground?: unknown }).playground =
			await bootPlaygroundRemote(access);
	} catch (e) {
		logger.error(e);
		document.body.className = 'has-error';
		document.body.innerHTML = '';

		if (e instanceof Error && e.name === 'NotSupportedError') {
			document.body.append(await renderStorageErrorUI());
		} else {
			document.body.append(renderGenericErrorUI(e));
		}
	} finally {
		document.body.classList.remove('is-loading');
	}

	function renderGenericErrorUI(error: unknown) {
		const fragment = document.createDocumentFragment();

		const div = document.createElement('div');
		div.className = 'error-message';
		const userFriendlyMessage =
			typeof error === 'object' &&
			error !== null &&
			'userFriendlyMessage' in error &&
			typeof error.userFriendlyMessage === 'string'
				? error.userFriendlyMessage
				: 'See the developer tools for error details.';
		div.innerHTML =
			'Ooops! WordPress Playground had a hiccup! <br/><br/> ' +
			userFriendlyMessage;
		fragment.append(div);

		const button = document.createElement('button');
		button.innerText = 'Try again';
		button.onclick = () => {
			window.location.reload();
		};
		fragment.append(button);

		const reportIssues = document.createElement('p');
		reportIssues.innerHTML = `
			If the problem persists, please
			<a href="https://github.com/WordPress/wordpress-playground/issues/new"
				target="_blank"
				>report an issue on GitHub</a>.
		`;
		fragment.append(reportIssues);

		return fragment;
	}

	async function renderStorageErrorUI() {
		const fragment = document.createDocumentFragment();

		/**
		 * Chrome does not allow Service Workers to be registered from cross-origin iframes
		 * when third-party cookies are disabled unless `requestStorageAccess()` is called
		 * and the user grants storage access.
		 *
		 * Let's assess the situation and provide a helpful message.
		 */
		let hasStorageAccess = false;
		try {
			const { state } = await navigator.permissions.query({
				name: 'storage-access' as PermissionName,
			});
			hasStorageAccess = state === 'granted';
		} catch {
			// noop
		}

		if (hasStorageAccess || !('requestStorageAccess' in document)) {
			const div = document.createElement('div');

			// The user has granted storage access, but the error still persists.
			// Let's explain why.
			div.innerText =
				'It looks like you have disabled third-party cookies in your browser. This ' +
				'also disables the Service Worker API used by WordPress Playground. Please re-enable ' +
				'third-party cookies and try again.';
			fragment.append(div);

			const button = document.createElement('button');
			button.innerText = 'Try again';
			button.onclick = () => {
				window.location.reload();
			};
			fragment.append(button);
		} else {
			const div = document.createElement('div');

			// The user has not granted storage access.
			// There's a chance we can fix this by asking for storage access.
			div.innerText =
				'WordPress Playground needs to use storage in your browser.';
			fragment.append(div);

			const button = document.createElement('button');
			button.innerText = 'Allow storage access';
			fragment.append(button);

			button.onclick = async () => {
				try {
					await document.requestStorageAccess();
					window.location.reload();
				} catch {
					// Either the user denied storage access OR chrome is not allowing
					// storage access to be requested from an iframe for some reason.

					// The two errors are indistinguishable and just say "requestStorageAccess not allowed"
					// https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/dom/document.cc;drc=daf56cfa413f10dee6aa15b0b1e4572fcf5578df;l=462
					// It's confusing! But we can at least tell the user what to do.
					div.innerHTML = `
						<p>
							Oops! Playground failed to start. Here's what to do:
						</p>

						<h3>Did you disable third-party cookies?</h3>
						<p>
							It also disables the required Service Worker API. Please re-enable
							third-party cookies and try again.
						</p>

						<h3>Did you refuse to grant Playground storage access?</h3>
						<p>
							Click the button below and grant storage access. Note the button may
							not work if you have disabled third-party cookies in your browser.
						</p>
						<p>
							If neither method helped, please
							<a href="https://github.com/WordPress/wordpress-playground/issues/new"
								target="_blank">
								report an issue on GitHub
							</a>.
						</p>
						`;
				}
			};
		}

		return fragment;
	}
}
