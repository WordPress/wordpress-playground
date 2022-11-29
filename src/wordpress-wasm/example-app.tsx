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
	const preinstallPlugins = query.getAll('plugin');
	const preinstallTheme = query.get('theme');

	const installPluginProgress = Math.min(preinstallPlugins.length * 15, 45);
	const installThemeProgress = preinstallTheme ? 20 : 0;
	const bootProgress = 100 - installPluginProgress - installThemeProgress;

	const progress = wireProgressBar();
	const workerThread = await bootWordPress({
		onWasmDownloadProgress: progress.partialObserver(bootProgress, 'Preparing WordPress...', ),
	});
	const appMode = query.get('mode') === 'seamless' ? 'seamless' : 'browser';
	if (appMode === 'browser') {
		setupAddressBar(workerThread);
	}

	if (query.get('login') || preinstallPlugins.length || preinstallTheme) {
		await login(workerThread, 'admin', 'password');
	}

	if (preinstallPlugins.length) {
		const progressBudgetPerPlugin =
			installPluginProgress / preinstallPlugins.length;
		const fetchPluginFile = async (preinstallPlugin) => {
			const response = cloneResponseMonitorProgress(
				await fetch('/plugin-proxy?plugin=' + preinstallPlugin),
				progress.partialObserver(progressBudgetPerPlugin * 0.66, 'Installing plugins...')
			);
			return new File([await response.blob()], preinstallPlugin);
		};

		/**
		 * Install multiple plugins to minimize the processing time.
		 *
		 * The downloads are done one after another to get installable
		 * zip files as soon as possible. Each completed download triggers
		 * plugin installation without waiting for the next download to
		 * complete.
		 */
		await new Promise((finish) => {
			const installations = new PromiseQueue();
			const downloads = new PromiseQueue();
			for (const preinstallPlugin of preinstallPlugins) {
				downloads.enqueue(() => fetchPluginFile(preinstallPlugin));
			}
			downloads.addEventListener('resolved', (e: any) => {
				installations.enqueue(async () => {
					progress.slowlyIncrementBy(progressBudgetPerPlugin * 0.33);
					await installPlugin(workerThread, e.detail as File);
				});
			});
			installations.addEventListener('empty', () => {
				if (installations.resolved === preinstallPlugins.length) {
					finish(null);
				}
			});
		});
	}

	if (preinstallTheme) {
		// Download the theme file
		const response = cloneResponseMonitorProgress(
			await fetch('/plugin-proxy?theme=' + preinstallTheme),
			progress.partialObserver(installThemeProgress - 10, `Installing theme...`)
		);
		const themeFile = new File([await response.blob()], preinstallTheme);

		progress.slowlyIncrementBy(10);
		await installTheme(workerThread, themeFile);
	}

	if (query.get('rpc')) {
		console.log('Registering an RPC handler');
		async function handleMessage(data) {
			if (data.type === 'rpc') {
				return await workerThread[data.method](...data.args);
			} else if (data.type === 'go_to') {
				wpFrame.src = workerThread.pathToInternalUrl(data.path);
			} else if (data.type === 'is_alive') {
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

class PromiseQueue extends EventTarget {
	#queue: Array<() => Promise<any>> = [];
	#running = false;
	#_resolved = 0;

	get resolved() {
		return this.#_resolved;
	}

	async enqueue(fn: () => Promise<any>) {
		this.#queue.push(fn);
		this.#run();
	}

	async #run() {
		if (this.#running) {
			return;
		}
		try {
			this.#running = true;
			while (this.#queue.length) {
				const next = this.#queue.shift();
				if (!next) {
					break;
				}
				const result = await next();
				++this.#_resolved;
				this.dispatchEvent(
					new CustomEvent('resolved', { detail: result })
				);
			}
		} finally {
			this.#running = false;
			this.dispatchEvent(new CustomEvent('empty'));
		}
	}
}

function wireProgressBar() {
	// Hide the progress bar when the page is first loaded.
	const HideProgressBar = () => {
		document
			.querySelector('body.is-loading')!
			.classList.remove('is-loading');
		wpFrame.removeEventListener('load', HideProgressBar);
	};
	wpFrame.addEventListener('load', HideProgressBar);

	const progress = new ProgressObserver((progress, mode, caption) => {
		const infiniteWrapper = document.querySelector(
			'.progress-bar-wrapper.mode-infinite'
		);
		if (infiniteWrapper) {
			infiniteWrapper.classList.remove('mode-infinite');
			infiniteWrapper.classList.add('mode-finite');
		}
		if (caption && caption.length)  {
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
		progressBarEl.style.width = `${progress}%`;
	});

	return progress;
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
	#onProgress: (progress: number, mode: ProgressType, caption?: string) => void;

	constructor(onProgress) {
		this.#onProgress = onProgress;
	}

	partialObserver(progressBudget, caption = '') {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = 0;
		return ({ loaded, total }) => {
			this.#observedProgresses[id] = (loaded / total) * progressBudget;
			this.#onProgress(this.totalProgress, ProgressType.REAL_TIME, caption);
		};
	}

	slowlyIncrementBy(progress) {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = progress;
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
