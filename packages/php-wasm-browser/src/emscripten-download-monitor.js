import { DEFAULT_BASE_URL } from "./urls";

/*
 * An approximate total file size to use when the actual
 * total number of bytes is missing.
 * 
 * This may happen when the files are compressed before transmission 
 * and no content-length header is being sent.
 * 
 * The approximation isn't accurate, but it's better than nothing.
 * It's not about being exact but about giving the user a rough sense
 * of progress.
 */
const FALLBACK_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Monitors the download progress of Emscripten modules
 *
 * Usage:
 * ```js
 *   const downloadMonitor = new EmscriptenDownloadMonitor();
 * 	 const php = await startPHP(
 *       phpLoaderModule,
 *       'web',
 *       downloadMonitor.phpArgs
 *   );
 *   downloadMonitor.addEventListener('progress', (e) => {
 *     console.log( e.detail.progress);
 *   })
 * ```
 */
export default class EmscriptenDownloadMonitor extends EventTarget {
	constructor(assetsSizes) {
		super();

		this.assetsSizes = assetsSizes;
		this.#monitorWebAssemblyStreaming();
		this.phpArgs = {
			dataFileDownloads: this.#createDataFileDownloadsProxy()
		};
	}

	/**
	 * Replaces the default WebAssembly.instantiateStreaming with a version
	 * that monitors the download progress.
	 */
	#monitorWebAssemblyStreaming() {
		const self = this;
		const instantiateStreaming = WebAssembly.instantiateStreaming;
		WebAssembly.instantiateStreaming = (response, ...args) => {
			const file = response.url.substring(
				new URL(response.url).origin.length + 1
			);

			const reportingResponse = cloneResponseMonitorProgress(
				response,
				({ loaded, total }) => self.#notify(file, loaded, total)
			);

			return instantiateStreaming(reportingResponse, ...args);
		};
	}

	/**
	 * Creates a `dataFileDownloads` Proxy object that can be passed
	 * to `startPHP` to monitor the download progress of the data
	 * dependencies.
	 * 
	 * @returns {Object}
	 */
	#createDataFileDownloadsProxy() {
		const self = this;
		const dataFileDownloads = {};
		// Monitor assignments like dataFileDownloads[file] = progress
		return new Proxy(dataFileDownloads, {
			set(obj, file, progress) {
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
	 * Notifies about the download progress of a file.
	 * 
	 * @param {string} file The file name.
	 * @param {number} loaded The number of bytes loaded so far.
	 * @param {number} total The total number of bytes to load.
	 */
	#notify(file, loaded, total) {
		if (!total) {
			const filename = new URL(file, DEFAULT_BASE_URL).pathname.split('/').pop();
			total = this.assetsSizes[filename];
		}
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					file,
					loaded,
					total: total || Math.min(loaded, FALLBACK_FILE_SIZE),
					fallbackUsed: !total,
				},
			})
		);
	}
}


/**
 * @typedef {Object} Progress
 * @property {number} loaded The number of bytes loaded so far.
 * @property {number} total The total number of bytes to load.
 */

/**
 * Clones a fetch Response object and returns a version 
 * that calls the `onProgress` callback as the progress
 * changes.
 * 
 * @param {Response} response The fetch Response object to clone.
 * @param {(Progress) => undefined)} onProgress The callback to call when the download progress changes.
 * @returns 
 */
export function cloneResponseMonitorProgress(response, onProgress) {
	const contentLength = response.headers.get('content-length');
	let total = parseInt(contentLength, 10) || FALLBACK_FILE_SIZE;

	return new Response(
		new ReadableStream(
			{
				async start(controller) {
					const reader = response.body.getReader();
					let loaded = 0;
					for (; ;) {
						try {
							const { done, value } = await reader.read();
							if (value) {
								loaded += value.byteLength;
							}
							if (done) {
								onProgress({ loaded, total: loaded, done });
								controller.close();
								break;
							} else {
								onProgress({ loaded, total, done });
								controller.enqueue(value);
							}
						} catch (e) {
							console.error({ e });
							controller.error(e);
							break;
						}
					}
				},
			}
		),
		{
			status: response.status,
			statusText: response.statusText,
			headers: response.headers
		}
	);
}

