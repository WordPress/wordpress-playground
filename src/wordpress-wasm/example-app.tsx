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

	const progressBarEl = document.querySelector(
		'.progress-bar.is-finite'
	) as any;
	const progress = new ProgressObserver((progress, mode) => {
		const infiniteWrapper = document.querySelector(
			'.progress-bar-wrapper.mode-infinite'
		);
		if (infiniteWrapper) {
			infiniteWrapper.classList.remove('mode-infinite');
			infiniteWrapper.classList.add('mode-finite');
		}
		if (mode === ProgressType.SLOWLY_INCREMENT) {
			progressBarEl.classList.add('slowly-incrementing');
		} else {
			progressBarEl.classList.remove('slowly-incrementing');
		}
		progressBarEl.style.width = `${progress}%`;
	});

	// Hide the progress bar when the page is first loaded.
	const HideProgressBar = () => {
		document
			.querySelector('body.is-loading')!
			.classList.remove('is-loading');
		wpFrame.removeEventListener('load', HideProgressBar);
	};
	wpFrame.addEventListener('load', HideProgressBar);

	const installPluginProgress = preinstallPlugin ? 20 : 0;
	const installThemeProgress = preinstallTheme ? 20 : 0;
	const bootProgress = 100 - installPluginProgress - installThemeProgress;

	const workerThread = await bootWordPress({
		onWasmDownloadProgress: progress.partialObserver(bootProgress),
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
		const response = cloneResponseMonitorProgress(
			await fetch('/plugin-proxy?plugin=' + preinstallPlugin),
			progress.partialObserver(installPluginProgress - 10)
		);
		const pluginFile = new File([await response.blob()], preinstallTheme);

		progress.slowlyIncrementBy(10);
		await installPlugin(workerThread, pluginFile);
	}

	if (preinstallTheme) {
		// Download the theme file
		const response = cloneResponseMonitorProgress(
			await fetch('/plugin-proxy?theme=' + preinstallTheme),
			progress.partialObserver(installThemeProgress - 10)
		);
		const themeFile = new File([await response.blob()], preinstallTheme);

		progress.slowlyIncrementBy(10);
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

const enum ProgressType {
	/**
	 * Real-time progress is used when we get real-time reports
	 * about the progress.
	 */
	REAL_TIME = 'REAL_TIME',
	/**
	 * Slowly increment progress is used when we don't know how long
	 * an operation will take and just want to keep slowly incrementing
	 * the progress bar.
	 */
	SLOWLY_INCREMENT = 'SLOWLY_INCREMENT',
}

class ProgressObserver {
	#observedProgresses: Record<number, number> = {};
	#lastObserverId = 0;
	#onProgress: (progress: number, mode: ProgressType) => void;

	constructor(onProgress) {
		this.#onProgress = onProgress;
	}

	partialObserver(progressBudget) {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = 0;
		return ({ loaded, total }) => {
			this.#observedProgresses[id] = (loaded / total) * progressBudget;
			this.#onProgress(this.totalProgress, ProgressType.REAL_TIME);
		};
	}

	slowlyIncrementBy(progress) {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] += progress;
		this.#onProgress(this.totalProgress, ProgressType.SLOWLY_INCREMENT);
	}

	get totalProgress() {
		return Object.values(this.#observedProgresses).reduce(
			(total, progress) => total + progress,
			0
		);
	}
}

main();
