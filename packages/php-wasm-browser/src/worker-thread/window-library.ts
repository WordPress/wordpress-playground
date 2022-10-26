import type { PHPOutput, PHPRequest, PHPResponse } from 'php-wasm';
import {
	postMessageExpectReply,
	awaitReply,
	MessageResponse,
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
			await messageChannel.sendMessage({ type: 'is_alive' }, 50);
			break;
		} catch (e) {
			// Ignore timeouts
		}
		await sleep(50);
	}

	const absoluteUrl = await messageChannel.sendMessage({
		type: 'get_absolute_url',
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
	 * Runs PHP code.
	 *
	 * @param  code The PHP code to run.
	 * @returns The result of the PHP code.
	 */
	async eval(code: string): Promise<PHPOutput> {
		return await this.messageChannel.sendMessage({
			type: 'run_php',
			code,
		});
	}

	/**
	 * Dispatches a request to the PHPServer.
	 *
	 * @param  request - The request to dispatch.
	 * @returns  The response from the PHPServer.
	 */
	async HTTPRequest(request: PHPRequest): Promise<PHPResponse> {
		return await this.messageChannel.sendMessage({
			type: 'request',
			request,
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
