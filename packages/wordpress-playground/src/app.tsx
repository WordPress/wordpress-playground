import {
	assertNotInfiniteLoadingLoop,
	serviceWorkerUrl,
	workerBackend,
	workerUrl,
} from './boot';
import {
	exposeAPI,
	ProgressObserver,
	ProgressType,
	registerServiceWorker,
	spawnPHPWorkerThread,
	consumeAPI,
} from '@wordpress/php-wasm';

import type { InternalWorkerAPI } from './worker-thread';

import { login } from './features/login';
import { installPluginsFromDirectory } from './features/install-plugins-from-directory';
import { installThemeFromDirectory } from './features/install-theme-from-directory';
import { importFile, exportFile } from './features/import-export';
import { toZipName } from './features/common';

const query = new URL(document.location.href).searchParams as any;
assertNotInfiniteLoadingLoop();

const wpVersion = query.get('wp') ? query.get('wp') : '6.1';
const phpVersion = query.get('php') ? query.get('php') : '8.0';
const internalApi = consumeAPI<InternalWorkerAPI>(
	spawnPHPWorkerThread(workerUrl, workerBackend, {
		// Vite doesn't deal well with the dot in the parameters name,
		// passed to the worker via a query string, so we replace
		// it with an underscore
		wpVersion: wpVersion.replace('.', '_'),
		phpVersion: phpVersion.replace('.', '_'),
	})
);

const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;

// If onDownloadProgress is not explicitly re-exposed here,
// Comlink will throw an error and claim the callback
// cannot be cloned. Adding a transfer handler for functions
// doesn't help:
// https://github.com/GoogleChromeLabs/comlink/issues/426#issuecomment-578401454
// @TODO: Handle the callback conversion automatically and don't explicitly re-expose
//        the onDownloadProgress method
const [setAPIReady, playground] = exposeAPI({
	onDownloadProgress: fn => internalApi.onDownloadProgress(fn),
	onNavigation: fn => {
		// Manage the address bar
		wpFrame.addEventListener('load', async (e: any) => {
			const path = await playground.internalUrlToPath(
				e.currentTarget!.contentWindow.location.href
			);
			fn(path);
		});
	},
	goTo: async (requestedPath: string) => {
		wpFrame.src = await playground.pathToInternalUrl(
			requestedPath
		);
	},
	getCurrentURL: async () => {
		return await playground.internalUrlToPath(wpFrame.src);
	}
}, internalApi);

export type PlaygroundAPI = typeof playground;


async function main() {
	const pluginsZipNames = query.getAll('plugin').map(toZipName);
	// Don't preinstall the default theme
	const queryTheme =
		query.get('theme') === 'twentytwentythree' ? null : query.get('theme');
	const themeZipName = toZipName(queryTheme);
	const installPluginProgress = Math.min((pluginsZipNames.length || 0) * 15, 45);
	const installThemeProgress = themeZipName ? 20 : 0;
	const bootProgress = 100 - installPluginProgress - installThemeProgress;

	const progress = setupProgressBar();
	await playground.onDownloadProgress(
		progress.partialObserver(bootProgress, 'Preparing WordPress...')
	);
	await internalApi.isReady();
	await registerServiceWorker(
		internalApi,
		await internalApi.scope,
		serviceWorkerUrl + '',
		// @TODO: source the hash of the service worker file in here
		serviceWorkerUrl.pathname
	);

	setAPIReady();

	const appMode = query.get('mode') === 'seamless' ? 'seamless' : 'browser';
	if (appMode === 'browser') {
		setupAddressBar(playground);
	}

	if (
		// !query.get('disableImportExport') ||
		query.get('login') ||
		pluginsZipNames.length ||
		query.get('theme')
	) {
		await login(playground, 'admin', 'password');
	}

	if (themeZipName) {
		await installThemeFromDirectory(playground, themeZipName, 20, progress);
	}

	if (pluginsZipNames.length) {
		await installPluginsFromDirectory(playground, pluginsZipNames, installPluginProgress, progress);
	}

	if (query.has('ide')) {
		let doneFirstBoot = false;
		const { WordPressPluginIDE, createBlockPluginFixture } = await import(
			'@wordpress/plugin-ide'
		);
		const { default: React } = await import('react');
		const {
			default: { render },
		} = await import('react-dom');
		render(
			<WordPressPluginIDE
				plugin={createBlockPluginFixture}
				workerThread={playground}
				initialEditedFile="edit.js"
				reactDevUrl="/assets/react.development.js"
				reactDomDevUrl="/assets/react-dom.development.js"
				fastRefreshScriptUrl="/assets/setup-react-refresh-runtime.js"
				onBundleReady={async (bundleContents: string) => {
					if (doneFirstBoot) {
						(wpFrame.contentWindow as any).eval(bundleContents);
					} else {
						doneFirstBoot = true;
						await playground.goTo(query.get('url') || '/');
					}
				}}
			/>,
			document.getElementById('test-snippets')!
		);
	} else {
		await playground.goTo(query.get('url') || '/');
	}
}

const addressBar = document.querySelector('#url-bar')! as HTMLInputElement;
function setupAddressBar(playground: PlaygroundAPI) {
	// Manage the address bar
	playground.onNavigation((path: string) => {
		addressBar.value = path
	});

	document
		.querySelector('#url-bar-form')!
		.addEventListener('submit', async (e) => {
			e.preventDefault();
			let requestedPath = addressBar.value;
			// Ensure a trailing slash when requesting directory paths
			const isDirectory = !requestedPath.split('/').pop()!.includes('.');
			if (isDirectory && !requestedPath.endsWith('/')) {
				requestedPath += '/';
			}
			await playground.goTo( requestedPath );
			(
				document.querySelector(
					'#url-bar-form input[type="text"]'
				)! as any
			).blur();
		});
}



// Migration Logic
const importWindow = document.querySelector('#import-window') as HTMLElement;
const overlay = document.querySelector('#overlay') as HTMLElement;
const exportButton = document.querySelector(
	'#export-playground--btn'
) as HTMLButtonElement;
const importOpenModalButton = document.querySelector(
	'#import-open-modal--btn'
) as HTMLButtonElement;
const importPlaygroundForm = document.querySelector(
	'#import-playground-form'
) as HTMLFormElement;
const importSelectFile = document.querySelector(
	'#import-select-file'
) as HTMLInputElement;
const importSelectFileText = document.querySelector(
	'#import-select-file--text'
) as HTMLElement;
const importSelectFileButton = document.querySelector(
	'#import-select-file--btn'
) as HTMLButtonElement;
const importSubmitButton = document.querySelector(
	'#import-submit--btn'
) as HTMLButtonElement;
const importCloseModalButton = document.querySelector(
	'#import-close-modal--btn'
) as HTMLButtonElement;

if (
	importWindow &&
	overlay &&
	exportButton &&
	importOpenModalButton &&
	importPlaygroundForm &&
	importSelectFileButton &&
	importSelectFileText &&
	importSelectFile &&
	importSubmitButton &&
	importCloseModalButton
) {
	const resetImportWindow = () => {
		overlay.style.display = 'none';
		importWindow.style.display = 'none';
		importPlaygroundForm.reset();
		importSelectFileText.innerHTML = 'No file selected';
		importSubmitButton.disabled = true;
	};

	exportButton.addEventListener('click', () => exportFile(playground, wpVersion, phpVersion));

	importOpenModalButton.addEventListener('click', () => {
		importWindow.style.display = 'block';
		overlay.style.display = 'block';
		importCloseModalButton.focus();
	});

	importSelectFile.addEventListener('change', (e) => {
		if (importSelectFile.files === null) return;
		importSubmitButton.disabled = false;
		importSelectFileText.innerHTML = importSelectFile.files[0].name;
	});

	importSelectFileButton.addEventListener('click', (e) => {
		e.preventDefault();
		importPlaygroundForm.reset();
		importSelectFile.click();
	});

	importSubmitButton.addEventListener('click', async (e) => {
		e.preventDefault();
		let uploadAttempt;
		try {
			const userUploadedFileInput = importSelectFile as HTMLInputElement;
			const userUploadedFile = userUploadedFileInput.files
				? userUploadedFileInput.files[0]
				: null;
			if (!userUploadedFile) return;
			uploadAttempt = await importFile(playground, userUploadedFile);
		} catch (error) {
			console.error(error);
			importSelectFileText.innerHTML =
				'<span class="error" style="color: red;">Unable to import file. <br/> Is it a valid WordPress Playground export?</span>';
		}

		if (uploadAttempt) {
			// eslint-disable-next-line no-alert
			alert(
				'File imported! This Playground instance has been updated. Refreshing now.'
			);
			resetImportWindow();
			wpFrame.src = await playground.pathToInternalUrl(
				addressBar.value
			);
			addressBar.focus();
		}
	});

	importCloseModalButton.addEventListener('click', (e) => {
		e.preventDefault();
		resetImportWindow();
		importOpenModalButton.focus();
	});

	overlay.addEventListener('click', (e) => {
		e.preventDefault();
		resetImportWindow();
	});
} else {
	console.error('Migration user interface elements not found.');
}

function setupProgressBar() {
	// Hide the progress bar when the page is first loaded.
	const HideProgressBar = () => {
		document
			.querySelector('body.is-loading')!
			.classList.remove('is-loading');
		wpFrame.removeEventListener('load', HideProgressBar);
	};
	wpFrame.addEventListener('load', HideProgressBar);

	const progress = new ProgressObserver(
		(progressPercentage, mode, caption) => {
			const infiniteWrapper = document.querySelector(
				'.progress-bar-wrapper.mode-infinite'
			);
			if (infiniteWrapper) {
				infiniteWrapper.classList.remove('mode-infinite');
				infiniteWrapper.classList.add('mode-finite');
			}
			if (caption && caption.length) {
				const captionElement = document.querySelector(
					'.progress-bar-overlay-caption'
				) as HTMLElement;

				if (captionElement) {
					captionElement.innerText = caption;
				}
			}

			const progressBarEl = document.querySelector(
				'.progress-bar.is-finite'
			) as any;
			if (mode === ProgressType.SLOWLY_INCREMENT) {
				progressBarEl.classList.add('slowly-incrementing');
			} else {
				progressBarEl.classList.remove('slowly-incrementing');
			}
			progressBarEl.style.width = `${progressPercentage}%`;
		}
	);

	return progress;
}

main();
