import { logger } from '@php-wasm/logger';
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

	expectAssets(assets: Record<string, number>) {
		for (const [urlLike, size] of Object.entries(assets)) {
			const dummyBaseUrl = 'http://example.com/';
			const pathname = new URL(urlLike, dummyBaseUrl).pathname;
			const filename = pathname.split('/').pop()!;
			if (!(filename in this.#assetsSizes)) {
				this.#assetsSizes[filename] = size;
			}
			if (!(filename in this.#progress)) {
				this.#progress[filename] = 0;
			}
		}
	}

	async monitorFetch(fetchPromise: Promise<Response>): Promise<Response> {
		const response = await fetchPromise;
		const onProgress = (event: CustomEvent<DownloadProgress>) => {
			this.#notify(response.url, event.detail.loaded, event.detail.total);
		};
		return cloneResponseMonitorProgress(response, onProgress);
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
		} else if (!(fileName in this.#assetsSizes)) {
			this.#assetsSizes[fileName] = fileSize;
			this.#progress[fileName] = loaded;
		}
		if (!(fileName in this.#progress)) {
			logger.warn(
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
						logger.error({ e });
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
