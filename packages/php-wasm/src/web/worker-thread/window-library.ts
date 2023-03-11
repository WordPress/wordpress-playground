import type { PHPOutput, PHPServerRequest, PHPResponse } from '../../php-library/index';
import {
	postMessageExpectReply,
	awaitReply,
	MessageResponse,
	responseTo,
} from '../../php-library/messaging';
import { removeURLScope } from '../../php-library/scope';
import { getPathQueryFragment } from '../../php-library/urls';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
import { PHPProtocolClient } from '../../php-library/php-protocol-client';

const noop = () => null;

interface WorkerThreadConfig {
	/**
	 * A function to call when a download progress event is received from the worker
	 */
	onDownloadProgress?: (event: DownloadProgressEvent) => void;

	/**
	 * A record of options to pass to the worker thread.
	 */
	options?: Record<string, string>;
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
	backendName: 'webworker' | 'iframe',
	workerScriptUrl: string,
	config: WorkerThreadConfig
): Promise<PHPProtocolClient> {
	const { onDownloadProgress = noop } = config;
	let messageChannel: WorkerThreadMessageTarget;

	// Pass worker options via the query string
	if (config.options) {
		const urlWithOptions = new URL(workerScriptUrl);
		for (const [key, value] of Object.entries(config.options)) {
			urlWithOptions.searchParams.set(key, value);
		}
		workerScriptUrl = urlWithOptions.toString();
	}

	if (backendName === 'webworker') {
		messageChannel = spawnWebWorker(workerScriptUrl, { type: 'module' });
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

	const client = new PHPProtocolClient(
		(method, args:any, timeout) => messageChannel.sendMessage({ method, args: args ? Object.values(args):[] }, timeout),		
	);
	
	// Keep asking if the worker is alive until we get a response
	await client.init();

	// Proxy the service worker messages to the worker thread:
	const scope = await client.getScope();
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
				event.source!.postMessage(
					responseTo(event.data.requestId, result)
				);
			}
		}
	);
	
	return client;
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
	 * @param  code
	 * @see {PHP.run}
	 */
	async run(code: string): Promise<PHPOutput> {
		return await this.rpc('run', { code });
	}

	/**
	 * @param  request
	 * @see {PHP.request}
	 */
	async HTTPRequest(
		request: PHPServerRequest
	): Promise<PHPResponse & { text: string }> {
		const response = (await this.rpc('HTTPRequest', {
			request,
		})) as PHPResponse;
		return {
			...response,
			get text() {
				return new TextDecoder().decode(response.body);
			},
		};
	}

	/**
	 * @param  path
	 * @see {PHP.readFile}
	 */
	async readFile(path: string): Promise<string> {
		return await this.rpc('readFile', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.readFile}
	 */
	async readFileAsBuffer(path: string): Promise<string> {
		return await this.rpc('readFileAsBuffer', { path });
	}
	
	/**
	 * @param  path
	 * @param  contents
	 * @see {PHP.writeFile}
	 */
	async writeFile(path: string, contents: string): Promise<void> {
		return await this.rpc('writeFile', { path, contents });
	}

	/**
	 * @param  path
	 * @see {PHP.unlink}
	 */
	async unlink(path: string): Promise<void> {
		return await this.rpc('unlink', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.mkdirTree}
	 */
	async mkdirTree(path: string): Promise<void> {
		return await this.rpc('mkdirTree', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.listFiles}
	 */
	async listFiles(path: string): Promise<string[]> {
		return await this.rpc('listFiles', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.isDir}
	 */
	async isDir(path: string): Promise<boolean> {
		return await this.rpc('isDir', { path });
	}

	/**
	 * @param  path
	 * @see {PHP.fileExists}
	 */
	async fileExists(path: string): Promise<boolean> {
		return await this.rpc('fileExists', { path });
	}

	async rpc<T>(type: string, args?: Record<string, any>): Promise<T> {
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

function spawnWebWorker(workerURL: string, options: WorkerOptions = {}): WorkerThreadMessageTarget {
	console.log("Spawning Web Worker", workerURL);
	const worker = new Worker(workerURL, options);
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
