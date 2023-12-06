/*
 * An approximate total file size to use when the actual
 * total number of bytes is missing.
 *
 * This may happen when the files are compressed before transmission
 * and no content-length header is being sent.
 *
 * The approximation isn't accurate, but it's better than nothing.
 * It's not about being exact but about giving the user a rough sense
 * of #progress.
 */
const FALLBACK_FILE_SIZE = 5 * 1024 * 1024;

const CustomEvent =
	globalThis.CustomEvent ??
	class extends globalThis.Event {
		detail = null;
		constructor(
			name: string,
			options: {
				detail?: any;
				bubbles?: boolean;
				cancellable?: boolean;
				composed?: boolean;
			} = {}
		) {
			super(name, options);
			this.detail = options.detail;
		}
	};

export interface MonitoredModule {
	dependencyFilename: string;
	dependenciesTotalSize: number;
}

/**
 * Monitors the download #progress of Emscripten modules
 *
 * Usage:
 *
 * ```js
 *   const downloadMonitor = new EmscriptenDownloadMonitor();
 * 	 const php = await startPHP(
 *       phpLoaderModule,
 *       'web',
 *       downloadMonitor.phpArgs
 *   );
 *   downloadMonitor.addEventListener('#progress', (e) => {
 *     console.log( e.detail.#progress);
 *   })
 * ```
 */
export class EmscriptenDownloadMonitor extends EventTarget {
	#assetsSizes: Record<string, number> = {};
	#progress: Record<string, number> = {};

	constructor(modules: MonitoredModule[] = []) {
		super();

		this.setModules(modules);
		this.#monitorWebAssemblyStreaming();
	}

	getEmscriptenOptions() {
		return {
			dataFileDownloads: this.#createDataFileDownloadsProxy(),
		};
	}

	setModules(modules: MonitoredModule[]) {
		this.#assetsSizes = modules.reduce((acc, module) => {
			if (module.dependenciesTotalSize > 0) {
				// Required to create a valid URL object
				const dummyBaseUrl = 'http://example.com/';
				const url = new URL(module.dependencyFilename, dummyBaseUrl)
					.pathname;
				const filename = url.split('/').pop()!;
				acc[filename] = Math.max(
					filename in acc ? acc[filename] : 0,
					module.dependenciesTotalSize
				);
			}
			return acc;
		}, {} as Record<string, number>);
		this.#progress = Object.fromEntries(
			Object.entries(this.#assetsSizes).map(([name]) => [name, 0])
		);
	}

	/**
	 * Replaces the default WebAssembly.instantiateStreaming with a version
	 * that monitors the download #progress.
	 */
	#monitorWebAssemblyStreaming() {
		const instantiateStreaming = WebAssembly.instantiateStreaming;
		WebAssembly.instantiateStreaming = async (
			responseOrPromise,
			...args
		) => {
			const response = await responseOrPromise;
			const file = response.url.substring(
				new URL(response.url).origin.length + 1
			);

			const reportingResponse = cloneResponseMonitorProgress(
				response,
				({ detail: { loaded, total } }) =>
					this.#notify(file, loaded, total)
			);

			return instantiateStreaming(reportingResponse, ...args);
		};
	}

	/**
	 * Creates a `dataFileDownloads` Proxy object that can be passed
	 * to `startPHP` to monitor the download #progress of the data
	 * dependencies.
	 */
	#createDataFileDownloadsProxy() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		const dataFileDownloads: Record<string, any> = {};
		// Monitor assignments like dataFileDownloads[file] = #progress
		return new Proxy(dataFileDownloads, {
			set(obj, file: string, progress) {
				self.#notify(file, progress.loaded, progress.total);

				// Monitor assignments like dataFileDownloads[file].total += delta
				obj[file] = new Proxy(JSON.parse(JSON.stringify(progress)), {
					set(nestedObj, prop, value) {
						nestedObj[prop] = value;
						self.#notify(file, nestedObj.loaded, nestedObj.total);
						return true;
					},
				});
				return true;
			},
		});
	}

	/**
	 * Notifies about the download #progress of a file.
	 *
	 * @param  file   The file name.
	 * @param  loaded The number of bytes of that file loaded so far.
	 * @param  fileSize  The total number of bytes in the loaded file.
	 */
	#notify(file: string, loaded: number, fileSize: number) {
		const fileName = new URL(file, 'http://example.com').pathname
			.split('/')
			.pop()!;
		if (!fileSize) {
			fileSize = this.#assetsSizes[fileName];
		}
		if (!(fileName in this.#progress)) {
			console.warn(
				`Registered a download #progress of an unregistered file "${fileName}". ` +
					`This may cause a sudden **decrease** in the #progress percentage as the ` +
					`total number of bytes increases during the download.`
			);
		}

		this.#progress[fileName] = loaded;
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					loaded: sumValues(this.#progress),
					total: sumValues(this.#assetsSizes),
				},
			})
		);
	}
}

function sumValues(obj: Record<string, number>) {
	return Object.values(obj).reduce((total, value) => total + value, 0);
}

export default EmscriptenDownloadMonitor;

export interface DownloadProgress {
	/**
	 * The number of bytes loaded so far.
	 */
	loaded: number;
	/**
	 * The total number of bytes to load.
	 */
	total: number;
}

/**
 * Clones a fetch Response object and returns a version
 * that calls the `onProgress` callback as the #progress
 * changes.
 *
 * @param  response   The fetch Response object to clone.
 * @param  onProgress The callback to call when the download #progress changes.
 * @returns The cloned response
 */
export function cloneResponseMonitorProgress(
	response: Response,
	onProgress: (event: CustomEvent<DownloadProgress>) => void
): Response {
	const contentLength = response.headers.get('content-length') || '';
	const total = parseInt(contentLength, 10) || FALLBACK_FILE_SIZE;

	function notify(loaded: number, total: number) {
		onProgress(
			new CustomEvent('progress', {
				detail: {
					loaded,
					total,
				},
			})
		);
	}

	return new Response(
		new ReadableStream({
			async start(controller) {
				if (!response.body) {
					controller.close();
					return;
				}
				const reader = response.body.getReader();
				let loaded = 0;
				for (;;) {
					try {
						const { done, value } = await reader.read();
						if (value) {
							loaded += value.byteLength;
						}
						if (done) {
							notify(loaded, loaded);
							controller.close();
							break;
						} else {
							notify(loaded, total);
							controller.enqueue(value);
						}
					} catch (e) {
						console.error({ e });
						controller.error(e);
						break;
					}
				}
			},
		}),
		{
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		}
	);
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;
