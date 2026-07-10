import type { AsyncWritableFilesystem } from '@wp-playground/storage';

export interface PlaygroundTarget {
	frameId: number;
	documentId: string;
	playgroundGeneration: string;
}

export interface MethodDispatcher {
	/** Sends one method call to the Playground instance that owns the proxy. */
	callMethod<T>(
		target: PlaygroundTarget,
		method: string,
		args: unknown[]
	): Promise<T>;
	/** Rejects calls whose document or Playground generation is no longer current. */
	invalidateTarget(target: PlaygroundTarget): void;
	/** Rejects pending calls and removes the dispatcher's port listener. */
	dispose(): void;
}

/**
 * Creates a filesystem pinned to one document and detected Playground generation.
 */
export function createPlaygroundFilesystem(
	dispatcher: MethodDispatcher,
	target: PlaygroundTarget
): AsyncWritableFilesystem {
	/** Sends one filesystem method through the shared port dispatcher. */
	function callMethod<T>(method: string, args: unknown[]): Promise<T> {
		return dispatcher.callMethod<T>(target, method, args);
	}

	// Create the filesystem proxy object that implements AsyncWritableFilesystem
	return {
		// EventTarget methods (no-op for now, could be implemented if needed)
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => true,

		// Filesystem methods
		isDir: (path: string) => callMethod<boolean>('isDir', [path]),

		fileExists: (path: string) => callMethod<boolean>('fileExists', [path]),

		listFiles: (path: string) => callMethod<string[]>('listFiles', [path]),

		read: async (path: string) => {
			const result = await callMethod<Uint8Array>('readFileAsBuffer', [
				path,
			]);
			return {
				arrayBuffer: async () => result.buffer,
			};
		},

		readFileAsText: (path: string) =>
			callMethod<string>('readFileAsText', [path]),

		writeFile: (path: string, data: string | Uint8Array) => {
			// Convert Uint8Array to array for JSON serialization
			const serializedData =
				data instanceof Uint8Array ? Array.from(data) : data;
			return callMethod<void>('writeFile', [path, serializedData]);
		},

		mkdir: (path: string, options?: { recursive?: boolean }) =>
			callMethod<void>('mkdir', [path, options]),

		rmdir: (path: string, options?: { recursive?: boolean }) =>
			callMethod<void>('rmdir', [path, options]),

		mv: (source: string, destination: string) =>
			callMethod<void>('mv', [source, destination]),

		unlink: (path: string) => callMethod<void>('unlink', [path]),
	};
}

/**
 * Routes all filesystem method responses for one DevTools port.
 *
 * A single dispatcher prevents filesystem proxies from installing permanent
 * listeners or resolving another proxy's request after an identity change.
 */
export function createMethodDispatcher(
	port: chrome.runtime.Port
): MethodDispatcher {
	const pendingRequests = new Map<
		string,
		{
			target: PlaygroundTarget;
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
		}
	>();
	let disposed = false;

	// Handle responses from the background script
	/** Resolves the pending call identified by a method result message. */
	const handleMessage = (message: {
		type?: string;
		requestId?: string;
		result?: unknown;
		error?: string;
	}) => {
		if (message.type !== 'METHOD_RESULT' || !message.requestId) {
			return;
		}

		const pending = pendingRequests.get(message.requestId);
		if (!pending) {
			return;
		}

		pendingRequests.delete(message.requestId);
		if (message.error) {
			pending.reject(new Error(message.error));
			return;
		}

		// Handle Uint8Array reconstruction
		let result = message.result;
		if (
			typeof result === 'object' &&
			result !== null &&
			'__type' in result &&
			result.__type === 'Uint8Array' &&
			'data' in result &&
			Array.isArray(result.data)
		) {
			result = new Uint8Array(result.data);
		}
		pending.resolve(result);
	};

	port.onMessage.addListener(handleMessage);

	return {
		callMethod<T>(
			target: PlaygroundTarget,
			method: string,
			args: unknown[]
		): Promise<T> {
			if (disposed) {
				return Promise.reject(
					new Error('The DevTools connection is no longer available.')
				);
			}
			return new Promise((resolve, reject) => {
				const requestId = crypto.randomUUID();
				pendingRequests.set(requestId, {
					target,
					resolve: resolve as (value: unknown) => void,
					reject,
				});
				try {
					port.postMessage({
						type: 'EXECUTE_METHOD',
						...target,
						method,
						args,
						requestId,
					});
				} catch (error) {
					pendingRequests.delete(requestId);
					reject(
						error instanceof Error
							? error
							: new Error(String(error))
					);
				}
			});
		},
		invalidateTarget(target: PlaygroundTarget) {
			for (const [requestId, pending] of pendingRequests) {
				if (
					pending.target.frameId !== target.frameId ||
					pending.target.documentId !== target.documentId ||
					pending.target.playgroundGeneration !==
						target.playgroundGeneration
				) {
					continue;
				}
				pendingRequests.delete(requestId);
				pending.reject(
					new Error(
						'The selected Playground instance is no longer available.'
					)
				);
			}
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			port.onMessage.removeListener(handleMessage);
			for (const pending of pendingRequests.values()) {
				pending.reject(
					new Error('The DevTools connection is no longer available.')
				);
			}
			pendingRequests.clear();
		},
	};
}
