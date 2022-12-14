import type { PHPOutput, PHPRequest, PHPResponse } from '../../php-wasm';
import {
	postMessageExpectReply,
	awaitReply,
	MessageResponse,
	responseTo,
} from '../messaging';
import { removeURLScope } from '../scope';
import { getPathQueryFragment } from '..';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

interface WorkerThreadConfig {
	/**
	 * A function to call when a download progress event is received from the worker
	 */
	onDownloadProgress?: (event: DownloadProgressEvent) => void;
}

/**
 * Spawns a new Worker Thread.
 *
 * @param  backendName     The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @param  workerScriptUrl The absolute URL of the worker script.
 * @param  config
 * @returns  The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	backendName: string,
	workerScriptUrl: string,
	config: WorkerThreadConfig
): Promise<SpawnedWorkerThread> {
	const { onDownloadProgress = noop } = config;
	let messageChannel: WorkerThreadMessageTarget;
	if (backendName === 'webworker') {
		messageChannel = spawnWebWorker(workerScriptUrl);
	} else if (backendName === 'iframe') {
		messageChannel = spawnIframeWorker(workerScriptUrl);
	} else {
		throw new Error(`Unknown backendName: ${backendName}`);
	}

	messageChannel.setMessageListener((e) => {
		if (e.data.type === 'download_progress') {
			onDownloadProgress(e.data);
		}
	});

	// Keep asking if the worker is alive until we get a response
	while (true) {
		try {
			await messageChannel.sendMessage({ type: 'isAlive' }, 50);
			break;
		} catch (e) {
			// Ignore timeouts
		}
		await sleep(50);
	}

	// Proxy the service worker messages to the worker thread:
	const scope = await messageChannel.sendMessage({ type: 'getScope' }, 50);
	navigator.serviceWorker.addEventListener(
		'message',
		async function onMessage(event) {
			console.debug('Message from ServiceWorker', event);
			/**
			 * Ignore events meant for other PHP instances to
			 * avoid handling the same event twice.
			 *
			 * This is important because the service worker posts the
			 * same message to all application instances across all browser tabs.
			 */
			if (scope && event.data.scope !== scope) {
				return;
			}

			const result = await messageChannel.sendMessage(event.data);
			// The service worker expects a response when it includes a `requestId` in the message:
			if (event.data.requestId) {
				event.source.postMessage(
					responseTo(event.data.requestId, result)
				);
			}
		}
	);

	const absoluteUrl = await messageChannel.sendMessage({
		type: 'getAbsoluteUrl',
	});

	return new SpawnedWorkerThread(messageChannel, absoluteUrl);
}

export class SpawnedWorkerThread {
	messageChannel;
	serverUrl;

	constructor(messageChannel, serverUrl) {
		this.messageChannel = messageChannel;
		this.serverUrl = serverUrl;
	}

	/**
	 * Converts a path to an absolute URL based at the PHPServer
	 * root.
	 *
	 * @param  path The server path to convert to an absolute URL.
	 * @returns The absolute URL.
	 */
	pathToInternalUrl(path: string): string {
		return `${this.serverUrl}${path}`;
	}

	/**
	 * Converts an absolute URL based at the PHPServer to a relative path
	 * without the server pathname and scope.
	 *
	 * @param  internalUrl An absolute URL based at the PHPServer root.
	 * @returns The relative path.
	 */
	internalUrlToPath(internalUrl: string): string {
		return getPathQueryFragment(removeURLScope(new URL(internalUrl)));
	}

	/**
	 * @see {PHP.run}
	 */
	async run(code: string): Promise<PHPOutput> {
		return await this.#rpc('run', { code });
	}

	/**
	 * @see {PHP.request}
	 */
	async HTTPRequest(request: PHPRequest): Promise<PHPResponse & { text: string }> {
		const response = await this.#rpc('HTTPRequest', { request }) as PHPResponse;
		return {
			...response,
			get text() {
				return new TextDecoder().decode(response.body);
			}
		}
	}

	/**
	 * @see {PHP.readFile}
	 */
	async readFile(path: string): Promise<string> {
		return await this.#rpc('readFile', { path });
	}

	/**
	 * @see {PHP.writeFile}
	 */
	async writeFile(path: string, contents: string): Promise<void> {
		return await this.#rpc('writeFile', { path, contents });
	}

	/**
	 * @see {PHP.unlink}
	 */
	async unlink(path: string): Promise<void> {
		return await this.#rpc('unlink', { path });
	}

	/**
	 * @see {PHP.mkdirTree}
	 */
	async mkdirTree(path: string): Promise<void> {
		return await this.#rpc('mkdirTree', { path });
	}

	/**
	 * @see {PHP.listFiles}
	 */
	async listFiles(path: string): Promise<string[]> {
		return await this.#rpc('listFiles', { path });
	}

	/**
	 * @see {PHP.isDir}
	 */
	async isDir(path: string): Promise<boolean> {
		return await this.#rpc('isDir', { path });
	}

	async #rpc<T>(type: string, args?: Record<string, any>): Promise<T> {
		return await this.messageChannel.sendMessage({
			...args,
			type,
		});
	}
}

interface WorkerThreadMessageTarget {
	sendMessage(message: any, timeout?: number): Promise<MessageResponse<any>>;
	setMessageListener(listener: (message: any) => void): void;
}

function spawnWebWorker(workerURL: string): WorkerThreadMessageTarget {
	const worker = new Worker(workerURL);
	return {
		async sendMessage(message: any, timeout: number) {
			const requestId = postMessageExpectReply(worker, message);
			const response = await awaitReply(worker, requestId, timeout);
			return response;
		},
		setMessageListener(listener) {
			worker.onmessage = listener;
		},
	};
}

function spawnIframeWorker(
	workerDocumentURL: string
): WorkerThreadMessageTarget {
	const iframe = document.createElement('iframe');
	iframe.src = workerDocumentURL;
	iframe.style.display = 'none';
	document.body.appendChild(iframe);
	return {
		async sendMessage(message, timeout) {
			const requestId = postMessageExpectReply(
				iframe.contentWindow!,
				message,
				'*'
			);
			const response = await awaitReply(window, requestId, timeout);
			return response;
		},
		setMessageListener(listener) {
			window.addEventListener(
				'message',
				(e) => {
					if (e.source === iframe.contentWindow) {
						listener(e);
					}
				},
				false
			);
		},
	};
}
