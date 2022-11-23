import { bootWordPress } from './index';
import { login, installPlugin, installTheme } from './macros';
import {
	cloneResponseMonitorProgress,
	responseTo,
} from '../php-wasm-browser/index';

const query = new URL(document.location.href).searchParams as any;

const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;

function setupAddressBar(wasmWorker) {
	// Manage the address bar
	const addressBar = document.querySelector('#url-bar')! as HTMLInputElement;
	wpFrame.addEventListener('load', (e: any) => {
		addressBar.value = wasmWorker.internalUrlToPath(
			e.currentTarget!.contentWindow.location.href
		);
	});

	document.querySelector('#url-bar-form')!.addEventListener('submit', (e) => {
		e.preventDefault();
		let requestedPath = addressBar.value;
		// Ensure a trailing slash when requesting directory paths
		const isDirectory = !requestedPath.split('/').pop()!.includes('.');
		if (isDirectory && !requestedPath.endsWith('/')) {
			requestedPath += '/';
		}
		wpFrame.src = wasmWorker.pathToInternalUrl(requestedPath);
		(
			document.querySelector('#url-bar-form input[type="text"]')! as any
		).blur();
	});
}

async function main() {
	const preinstallPlugin = query.get('plugin');
	const preinstallTheme = query.get('theme');

	const progressBar = new FetchProgressBar({
		expectedRequests:
			2 + (preinstallPlugin ? 1 : 0) + (preinstallTheme ? 1 : 0),
		max: preinstallPlugin || preinstallTheme ? 80 : 100,
	});

	const workerThread = await bootWordPress({
		onWasmDownloadProgress: progressBar.onDataChunk as any,
	});
	const appMode = query.get('mode') === 'seamless' ? 'seamless' : 'browser';
	if (appMode === 'browser') {
		setupAddressBar(workerThread);
	}

	if (query.get('login') || preinstallPlugin || preinstallTheme) {
		await login(workerThread, 'admin', 'password');
	}

	if (preinstallPlugin) {
		// Download the plugin file
		const pluginFile = await downloadFileWithProgress(
			'/plugin-proxy?plugin=' + preinstallTheme,
			preinstallTheme,
			progressBar
		);

		// We can't tell how long the operations below
		// will take. Let's slow down the CSS width transition
		// to at least give some impression of progress.
		progressBar.el.classList.add('indeterminate');
		progressBar.setProgress(80);
		progressBar.setProgress(90);
		await installPlugin(workerThread, pluginFile);
	}

	if (preinstallTheme) {
		// Download the plugin file
		const themeFile = await downloadFileWithProgress(
			'/plugin-proxy?theme=' + preinstallTheme,
			preinstallTheme,
			progressBar
		);

		// We can't tell how long the operations below
		// will take. Let's slow down the CSS width transition
		// to at least give some impression of progress.
		progressBar.el.classList.add('indeterminate');
		progressBar.setProgress(90);
		progressBar.setProgress(100);
		await installTheme(workerThread, themeFile);
	}

	if (query.get('rpc')) {
		console.log('Registering an RPC handler');
		async function handleMessage(event) {
			if (event.data.type === 'rpc') {
				return await workerThread[event.data.method](
					...event.data.args
				);
			} else if (event.data.type === 'go_to') {
				wpFrame.src = workerThread.pathToInternalUrl(event.data.path);
			} else if (event.data.type === 'is_alive') {
				return true;
			}
		}
		window.addEventListener('message', async (event) => {
			const result = await handleMessage(event.data);

			// When `requestId` is present, the other thread expects a response:
			if (event.data.requestId) {
				const response = responseTo(event.data.requestId, result);
				window.parent.postMessage(response, '*');
			}
		});
	}

	if (query.has('ide')) {
		let doneFirstBoot = false;
		const { WordPressPluginIDE, createBlockPluginFixture } = await import(
			'../wordpress-plugin-ide/index.js'
		);
		const { default: React } = await import('react');
		const {
			default: { render },
		} = await import('react-dom');
		render(
			<WordPressPluginIDE
				plugin={createBlockPluginFixture}
				workerThread={workerThread}
				initialEditedFile="edit.js"
				onBundleReady={(bundleContents: string) => {
					if (doneFirstBoot) {
						(wpFrame.contentWindow as any).eval(bundleContents);
					} else {
						doneFirstBoot = true;
						wpFrame.src = workerThread.pathToInternalUrl(
							query.get('url') || '/'
						);
					}
				}}
			/>,
			document.getElementById('test-snippets')!
		);
	} else {
		wpFrame.src = workerThread.pathToInternalUrl(query.get('url') || '/');
	}
}

async function downloadFileWithProgress(url, fileName, progressBar) {
	const response = cloneResponseMonitorProgress(
		await fetch(url),
		(progress) => progressBar.onDataChunk({ file: fileName, ...progress })
	);
	const blob = await response.blob();
	return new File([blob], fileName);
}

class FetchProgressBar {
	expectedRequests;
	progress;
	min;
	max;
	el;
	constructor({ expectedRequests, min = 0, max = 100 }) {
		this.expectedRequests = expectedRequests;
		this.progress = {};
		this.min = min;
		this.max = max;
		this.el = document.querySelector('.progress-bar.is-finite');

		// Hide the progress bar when the page is first loaded.
		const HideProgressBar = () => {
			document
				.querySelector('body.is-loading')!
				.classList.remove('is-loading');
			wpFrame.removeEventListener('load', HideProgressBar);
		};
		wpFrame.addEventListener('load', HideProgressBar);
	}

	onDataChunk = ({ file, loaded, total }) => {
		if (Object.keys(this.progress).length === 0) {
			this.setFinite();
		}

		this.progress[file] = loaded / total;
		const progressSum = Object.entries(this.progress).reduce(
			(acc, [_, percentFinished]) => acc + (percentFinished as number),
			0
		);
		const totalProgress = Math.min(1, progressSum / this.expectedRequests);
		const scaledProgressPercentage =
			this.min + (this.max - this.min) * totalProgress;

		this.setProgress(scaledProgressPercentage);
	};

	setProgress(percent) {
		this.el.style.width = `${percent}%`;
	}

	setFinite() {
		const classList = document.querySelector(
			'.progress-bar-wrapper.mode-infinite'
		)!.classList;
		classList.remove('mode-infinite');
		classList.add('mode-finite');
	}
}

main();
