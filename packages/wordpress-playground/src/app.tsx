import { saveAs } from 'file-saver';
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
	cloneResponseMonitorProgress,
	registerServiceWorker,
	spawnPHPWorkerThread,
	consumeAPI,
} from '@wordpress/php-wasm';

import { login, installPlugin, installTheme } from './wp-client';
import { PromiseQueue } from './promise-queue';
import { DOCROOT } from './config';
// @ts-ignore
import migration from './migration.php?raw';
import type { InternalWorkerAPI } from './worker-thread';

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

// If onDownloadProgress is not explicitly re-exposed here,
// Comlink will throw an error and claim the callback
// cannot be cloned. Adding a transfer handler for functions
// doesn't help:
// https://github.com/GoogleChromeLabs/comlink/issues/426#issuecomment-578401454
// @TODO: Handle the callback conversion automatically and don't explicitly re-expose
//        the onDownloadProgress method
const [setAPIReady, playground] = exposeAPI({
	onDownloadProgress: fn => internalApi.onDownloadProgress(fn),
}, internalApi);

export type PlaygroundAPI = typeof playground;

const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;
const addressBar = document.querySelector('#url-bar')! as HTMLInputElement;

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

const databaseExportName = 'databaseExport.xml';
const databaseExportPath = '/' + databaseExportName;


async function main() {
	const preinstallPlugins = query.getAll('plugin').map(toZipName);
	// Don't preinstall the default theme
	const queryTheme =
		query.get('theme') === 'twentytwentythree' ? null : query.get('theme');
	const preinstallTheme = toZipName(queryTheme);
	const installPluginProgress = Math.min(preinstallPlugins.length * 15, 45);
	const installThemeProgress = preinstallTheme ? 20 : 0;
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
		preinstallPlugins.length ||
		query.get('theme')
	) {
		await login(playground, 'admin', 'password');
	}

	if (preinstallTheme) {
		// Download the theme file
		const response = cloneResponseMonitorProgress(
			await fetch('/plugin-proxy?theme=' + preinstallTheme),
			progress.partialObserver(
				installThemeProgress - 10,
				`Installing ${zipNameToHumanName(preinstallTheme)} theme...`
			)
		);
		progress.slowlyIncrementBy(10);

		if (response.status === 200) {
			const themeFile = new File(
				[await response.blob()],
				preinstallTheme
			);

			try {
				await installTheme(playground, themeFile);
			} catch (error) {
				console.error(
					`Proceeding without the ${preinstallTheme} theme. Could not install it in wp-admin. ` +
						`The original error was: ${error}`
				);
				console.error(error);
			}
		} else {
			console.error(
				`Proceeding without the ${preinstallTheme} theme. Could not download the zip bundle from https://downloads.wordpress.org/themes/${preinstallTheme} – ` +
					`Is the file name correct?`
			);
		}
	}

	if (preinstallPlugins.length) {
		const downloads = new PromiseQueue();
		const installations = new PromiseQueue();

		const progressBudgetPerPlugin =
			installPluginProgress / preinstallPlugins.length;

		/**
		 * Install multiple plugins to minimize the processing time.
		 *
		 * The downloads are done one after another to get installable
		 * zip files as soon as possible. Each completed download triggers
		 * plugin installation without waiting for the next download to
		 * complete.
		 */
		await new Promise((finish) => {
			for (const preinstallPlugin of preinstallPlugins) {
				downloads.enqueue(async () => {
					const response = cloneResponseMonitorProgress(
						await fetch('/plugin-proxy?plugin=' + preinstallPlugin),
						progress.partialObserver(
							progressBudgetPerPlugin * 0.66,
							`Installing ${zipNameToHumanName(
								preinstallPlugin
							)} plugin...`
						)
					);
					if (response.status !== 200) {
						console.error(
							`Proceeding without the ${preinstallPlugin} plugin. Could not download the zip bundle from https://downloads.wordpress.org/plugin/${preinstallPlugin} – ` +
								`Is the file name correct?`
						);
						return null;
					}
					return new File([await response.blob()], preinstallPlugin);
				});
			}
			downloads.addEventListener('resolved', (e: any) => {
				installations.enqueue(async () => {
					if (!e.detail) {
						return;
					}
					progress.slowlyIncrementBy(progressBudgetPerPlugin * 0.33);
					try {
						await installPlugin(playground, e.detail as File);
					} catch (error) {
						console.error(
							`Proceeding without the ${e.detail.name} plugin. Could not install it in wp-admin. ` +
								`The original error was: ${error}`
						);
						console.error(error);
					}
				});
			});
			installations.addEventListener('empty', () => {
				if (installations.resolved === preinstallPlugins.length) {
					finish(null);
				}
			});
		});
	}

	if (query.get('rpc')) {
		// Notify the parent window about any URL changes in the
		// WordPress iframe
		wpFrame.addEventListener('load', (e: any) => {
			window.parent.postMessage(
				{
					type: 'new_path',
					path: playground.internalUrlToPath(
						e.currentTarget!.contentWindow.location.href
					),
				},
				'*'
			);
		});
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
						wpFrame.src = await playground.pathToInternalUrl(
							query.get('url') || '/'
						);
					}
				}}
			/>,
			document.getElementById('test-snippets')!
		);
	} else {
		wpFrame.src = await playground.pathToInternalUrl(
			query.get('url') || '/'
		);
	}
}

function toZipName(rawInput) {
	if (!rawInput) {
		return rawInput;
	}
	if (rawInput.endsWith('.zip')) {
		return rawInput;
	}
	return rawInput + '.latest-stable.zip';
}

function setupAddressBar(playground: PlaygroundAPI) {
	// Manage the address bar
	wpFrame.addEventListener('load', async (e: any) => {
		addressBar.value = await playground.internalUrlToPath(
			e.currentTarget!.contentWindow.location.href
		);
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
			wpFrame.src = await playground.pathToInternalUrl(
				requestedPath
			);
			(
				document.querySelector(
					'#url-bar-form input[type="text"]'
				)! as any
			).blur();
		});
}

async function generateZip() {
	const databaseExportResponse = await playground.request({
		relativeUrl: '/wp-admin/export.php?download=true&&content=all'
	});
	const databaseExportContent = new TextDecoder().decode(
		databaseExportResponse.body
	);
	await playground.writeFile(databaseExportPath, databaseExportContent);
	const exportName = `wordpress-playground--wp${wpVersion}--php${phpVersion}.zip`;
	const exportPath = `/${exportName}`;
	const exportWriteRequest = await playground.run({
		code:
			migration +
			` generateZipFile('${exportPath}', '${databaseExportPath}', '${DOCROOT}');`,
	});
	if (exportWriteRequest.exitCode !== 0) {
		throw exportWriteRequest.errors;
	}

	const fileBuffer = await playground.readFileAsBuffer(exportName);
	const file = new File([fileBuffer], exportName);
	saveAs(file);
}

async function importFile() {
	if (
		// eslint-disable-next-line no-alert
		!confirm(
			'Are you sure you want to import this file? Previous data will be lost.'
		)
	) {
		return false;
	}

	// Write uploaded file to filesystem for processing with PHP
	const userUploadedFileInput = importSelectFile as HTMLInputElement;
	const userUploadedFile = userUploadedFileInput.files
		? userUploadedFileInput.files[0]
		: null;
	if (!userUploadedFile) return;

	const fileArrayBuffer = await userUploadedFile.arrayBuffer();
	const fileContent = new Uint8Array(fileArrayBuffer);
	const importPath = '/import.zip';

	await playground.writeFile(importPath, fileContent);

	// Import the database
	const databaseFromZipFileReadRequest = await playground.run({
		code:
			migration +
			` readFileFromZipArchive('${importPath}', '${databaseExportPath}');`,
	});
	if (databaseFromZipFileReadRequest.exitCode !== 0) {
		throw databaseFromZipFileReadRequest.errors;
	}

	const databaseFromZipFileContent = new TextDecoder().decode(
		databaseFromZipFileReadRequest.body
	);

	const databaseFile = new File(
		[databaseFromZipFileContent],
		databaseExportName
	);

	const importerPageOneResponse = await playground.request({
		relativeUrl: '/wp-admin/admin.php?import=wordpress',
	});

	const importerPageOneContent = new DOMParser().parseFromString(
		new TextDecoder().decode(importerPageOneResponse.body),
		'text/html'
	);

	const firstUrlAction = importerPageOneContent
		.getElementById('import-upload-form')
		?.getAttribute('action');

	const stepOneResponse = await playground.request({
		relativeUrl: `/wp-admin/${firstUrlAction}`,
		method: 'POST',
		files: { import: databaseFile },
	});

	const importerPageTwoContent = new DOMParser().parseFromString(
		new TextDecoder().decode(stepOneResponse.body),
		'text/html'
	);

	const importerPageTwoForm = importerPageTwoContent.querySelector(
		'#wpbody-content form'
	);
	const secondUrlAction = importerPageTwoForm?.getAttribute('action') as string;

	const nonce = (
		importerPageTwoForm?.querySelector(
			"input[name='_wpnonce']"
		) as HTMLInputElement
	).value;

	const referrer = (
		importerPageTwoForm?.querySelector(
			"input[name='_wp_http_referer']"
		) as HTMLInputElement
	).value;

	const importId = (
		importerPageTwoForm?.querySelector(
			"input[name='import_id']"
		) as HTMLInputElement
	).value;

	await playground.request({
		relativeUrl: secondUrlAction,
		method: 'POST',
		formData: {
			_wpnonce: nonce,
			_wp_http_referer: referrer,
			import_id: importId,
		}
	});

	// Import the file system
	const importFileSystemRequest = await playground.run({
		code: migration + ` importZipFile('${importPath}');`,
	});
	if (importFileSystemRequest.exitCode !== 0) {
		throw importFileSystemRequest.errors;
	}

	return true;
}

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

	exportButton.addEventListener('click', generateZip);

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
			uploadAttempt = await importFile();
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

function zipNameToHumanName(zipName) {
	const mixedCaseName = zipName.split('.').shift()!.replace('-', ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}

main();
