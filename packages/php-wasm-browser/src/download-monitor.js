import { DEFAULT_BASE_URL } from "./urls";

/*
 * Let's use 5MB as an approximation when the total number
 * of bytes is missing.
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
 * Creates a proxy that observes updates to Emscripten's `dataFileDownloads`
 * property where the file download progress information is stored.
 *
 * Usage:
 * ```js
 *   const progressMonitor = new DownloadMonitor();
 * 	 const php = await PHP.create(PHPLoader, {
 *     dataFileDownloads: progressMonitor.dataFileDownloads
 *   });
 *   progressMonitor.addEventListener('progress', (e) => {
 *     console.log( e.detail.progress);
 *   })
 * ```
 */
export default class DownloadMonitor extends EventTarget {
	constructor(assetsSizes) {
		super();

		this.assetsSizes = assetsSizes;
		this.monitorWebAssemblyStreaming();
		this.phpArgs = {
			dataFileDownloads: this._createDataFileDownloadsProxy()
		};
	}

	_createDataFileDownloadsProxy() {
		const self = this;
		const dataFileDownloads = {};
		// Monitor assignments like dataFileDownloads[file] = progress
		return new Proxy(dataFileDownloads, {
			set(obj, file, progress) {
				self._notify(file, progress.loaded, progress.total);

				// Monitor assignments like dataFileDownloads[file].total += delta
				obj[file] = new Proxy(JSON.parse(JSON.stringify(progress)), {
					set(nestedObj, prop, value) {
						nestedObj[prop] = value;
						self._notify(file, nestedObj.loaded, nestedObj.total);
						return true;
					},
				});
				return true;
			},
		});
	}

	monitorWebAssemblyStreaming() {
		const self = this;
		const _instantiateStreaming = WebAssembly.instantiateStreaming;
		WebAssembly.instantiateStreaming = (response, ...args) => {
			const file = response.url.substring(
				new URL(response.url).origin.length + 1
			);

			const reportingResponse = cloneResponseMonitorProgress(
				response,
				({ loaded, total }) => self._notify(file, loaded, total)
			);

			return _instantiateStreaming(reportingResponse, ...args);
		};
	}

	 _notify(file, loaded, total) {
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

