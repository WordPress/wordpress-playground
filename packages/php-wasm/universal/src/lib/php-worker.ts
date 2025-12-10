import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type { ListFilesOptions, RmDirOptions } from './fs-helpers';
import type { PHP } from './php';
import type { PHPRequestHandler } from './php-request-handler';
import type { PHPResponse, StreamedPHPResponse } from './php-response';
import type {
	MessageListener,
	PHPEvent,
	PHPRequest,
	PHPRunOptions,
} from './universal-php';

const _private = new WeakMap<
	PHPWorker,
	{
		requestHandler?: PHPRequestHandler;
		php?: PHP;
		monitor?: EmscriptenDownloadMonitor;
	}
>();

export type LimitedPHPApi = Pick<
	PHP,
	| 'request'
	| 'defineConstant'
	| 'mkdir'
	| 'mkdirTree'
	| 'readFileAsText'
	| 'readFileAsBuffer'
	| 'writeFile'
	| 'unlink'
	| 'mv'
	| 'rmdir'
	| 'listFiles'
	| 'isDir'
	| 'fileExists'
	| 'chdir'
	| 'run'
	| 'onMessage'
> & {
	documentRoot: PHP['documentRoot'];
	absoluteUrl: PHP['absoluteUrl'];
	addEventListener:
		| PHP['addEventListener']
		| ((event: string, listener: (event: any) => any) => void);
	removeEventListener:
		| PHP['removeEventListener']
		| ((event: string, listener: (event: any) => any) => void);
};

export type PHPWorkerEvent = PHPEvent | { type: string };
export type PHPWorkerEventListener = (event: PHPWorkerEvent) => void;
/**
 * A PHP client that can be used to run PHP code in the browser.
 */
export class PHPWorker implements LimitedPHPApi, AsyncDisposable {
	/** @inheritDoc @php-wasm/universal!RequestHandler.absoluteUrl  */
	absoluteUrl = '';
	/** @inheritDoc @php-wasm/universal!RequestHandler.documentRoot  */
	documentRoot = '';

	private chroot: string | null = null;

	#eventListeners: Map<string, Set<PHPWorkerEventListener>> = new Map();

	onMessageListeners: MessageListener[] = [];
	/** @inheritDoc */
	constructor(
		requestHandler?: PHPRequestHandler,
		monitor?: EmscriptenDownloadMonitor
	) {
		/**
		 * Workaround for TypeScript limitation.
		 * Declaring a private field using the EcmaScript syntax like this:
		 *
		 *     #php: PHP
		 *
		 * Makes that field a part of the public API of the class. This means
		 * you can no longer assign seemingly compatible objects:
		 *
		 * ```ts
		 *     class PrivateEcma {
		 *       #privateProp: string = '';
		 *       callback() { }
		 *     }
		 *     interface CompatibleInterface {
		 *       callback(): void;
		 *     }
		 *     const compatObj: CompatibleInterface = {} as any;
		 *     const tsObj: PrivateEcma = compatObj;
		 *     // Property '#privateProp' is missing in type 'CompatibleInterface' but
		 *     // required in type 'PrivateEcma'
		 * ```
		 */
		_private.set(this, {
			monitor,
		});
		if (requestHandler) {
			this.__internal_setRequestHandler(requestHandler);
		}
	}

	public __internal_setRequestHandler(requestHandler: PHPRequestHandler) {
		this.absoluteUrl = requestHandler.absoluteUrl;
		this.documentRoot = requestHandler.documentRoot;
		this.chroot = this.documentRoot;
		_private.set(this, {
			..._private.get(this),
			requestHandler,
		});
	}

	/**
	 * @internal
	 * @deprecated
	 * Do not use this method directly in the code consuming
	 * the web API. It will change or even be removed without
	 * a warning.
	 */
	protected __internal_getPHP() {
		return _private.get(this)!.php;
	}

	/**
	 * @internal
	 * @deprecated
	 * Do not use this method directly in the code consuming
	 * the web API. It will change or even be removed without
	 * a warning.
	 */
	protected __internal_getRequestHandler() {
		return _private.get(this)!.requestHandler;
	}

	async setPrimaryPHP(php: PHP) {
		_private.set(this, {
			..._private.get(this)!,
			php,
		});
	}

	/** @inheritDoc @php-wasm/universal!PHPRequestHandler.pathToInternalUrl  */
	pathToInternalUrl(path: string): string {
		return _private.get(this)!.requestHandler!.pathToInternalUrl(path);
	}

	/** @inheritDoc @php-wasm/universal!PHPRequestHandler.internalUrlToPath  */
	internalUrlToPath(internalUrl: string): string {
		return _private
			.get(this)!
			.requestHandler!.internalUrlToPath(internalUrl);
	}

	/**
	 * The onDownloadProgress event listener.
	 */
	async onDownloadProgress(
		callback: (progress: CustomEvent<ProgressEvent>) => void
	): Promise<void> {
		return _private
			.get(this)!
			.monitor?.addEventListener('progress', callback as any);
	}

	/** @inheritDoc @php-wasm/universal!PHP.mv  */
	async mv(fromPath: string, toPath: string) {
		return _private.get(this)!.php!.mv(fromPath, toPath);
	}

	/** @inheritDoc @php-wasm/universal!PHP.rmdir  */
	async rmdir(path: string, options?: RmDirOptions) {
		return _private.get(this)!.php!.rmdir(path, options);
	}

	/** @inheritDoc @php-wasm/universal!PHPRequestHandler.request */
	async request(request: PHPRequest): Promise<PHPResponse> {
		const requestHandler = _private.get(this)!.requestHandler!;
		return await requestHandler.request(request);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.run */
	async run(request: PHPRunOptions): Promise<PHPResponse> {
		const { php, reap } = await this.acquirePHPInstance();
		try {
			return await php.run(request);
		} finally {
			reap();
		}
	}

	/** @inheritDoc @php-wasm/universal!/PHP.cli */
	async cli(
		argv: string[],
		options?: { env?: Record<string, string> }
	): Promise<StreamedPHPResponse> {
		const { php, reap } = await this.acquirePHPInstance();
		let response: StreamedPHPResponse;
		try {
			response = await php.cli(argv, options);
		} catch (error) {
			reap();
			throw error;
		}
		/**
		 * Register the reap() callback to run asynchronously once
		 * the response is finished.
		 *
		 * We don't await for response.finished here. It is a
		 * `StreamedPHPResponse` instance and the caller may want
		 * to start processing the streamed data immediately.
		 */
		response.finished.finally(reap);
		return response;
	}

	/** @inheritDoc @php-wasm/universal!/PHP.chdir */
	chdir(path: string): void {
		// Remember the new chroot for all PHP instances yet to be acquired.
		this.chroot = path;
		return _private.get(this)!.php!.chdir(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.chdir */
	cwd(): string {
		return _private.get(this)!.php!.cwd();
	}

	/**
	 * @returns A PHP instance with a consistent chroot.
	 */
	private async acquirePHPInstance() {
		const { php, reap } = await _private
			.get(this)!
			.requestHandler!.instanceManager.acquirePHPInstance();
		if (this.chroot !== null) {
			php.chdir(this.chroot);
		}
		this.registerWorkerListeners(php);
		return { php, reap };
	}

	/** @inheritDoc @php-wasm/universal!/PHP.setSapiName */
	setSapiName(newName: string): void {
		_private.get(this)!.php!.setSapiName(newName);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.mkdir */
	mkdir(path: string): void {
		return _private.get(this)!.php!.mkdir(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.mkdirTree */
	mkdirTree(path: string): void {
		return _private.get(this)!.php!.mkdirTree(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.readFileAsText */
	readFileAsText(path: string): string {
		return _private.get(this)!.php!.readFileAsText(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.readFileAsBuffer */
	readFileAsBuffer(path: string): Uint8Array {
		return _private.get(this)!.php!.readFileAsBuffer(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.writeFile */
	writeFile(path: string, data: string | Uint8Array): void {
		return _private.get(this)!.php!.writeFile(path, data);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.unlink */
	unlink(path: string): void {
		return _private.get(this)!.php!.unlink(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.listFiles */
	listFiles(path: string, options?: ListFilesOptions): string[] {
		return _private.get(this)!.php!.listFiles(path, options);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.isDir */
	isDir(path: string): boolean {
		return _private.get(this)!.php!.isDir(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.isFile */
	isFile(path: string): boolean {
		return _private.get(this)!.php!.isFile(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.fileExists */
	fileExists(path: string): boolean {
		return _private.get(this)!.php!.fileExists(path);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.onMessage */
	onMessage(listener: MessageListener) {
		this.onMessageListeners.push(listener);
		return async () => {
			this.onMessageListeners = this.onMessageListeners.filter(
				(l) => l !== listener
			);
		};
	}

	/** @inheritDoc @php-wasm/universal!/PHP.defineConstant */
	defineConstant(key: string, value: string | boolean | number | null): void {
		_private.get(this)!.php!.defineConstant(key, value);
	}

	/** @inheritDoc @php-wasm/universal!/PHP.addEventListener */
	addEventListener(
		eventType: PHPWorkerEvent['type'],
		listener: PHPWorkerEventListener
	): void {
		if (!this.#eventListeners.has(eventType)) {
			this.#eventListeners.set(eventType, new Set());
		}
		this.#eventListeners.get(eventType)!.add(listener);
	}

	/**
	 * Removes an event listener for a PHP event.
	 * @param eventType - The type of event to remove the listener from.
	 * @param listener - The listener function to be removed.
	 */
	removeEventListener(
		eventType: PHPWorkerEvent['type'],
		listener: PHPWorkerEventListener
	) {
		this.#eventListeners.get(eventType)?.delete(listener);
	}

	protected dispatchEvent<Event extends PHPWorkerEvent>(event: Event) {
		const listeners = this.#eventListeners.get(event.type);
		if (!listeners) {
			return;
		}
		for (const listener of listeners) {
			listener(event);
		}
	}

	protected registerWorkerListeners(php: PHP) {
		php.addEventListener('*', async (event) => {
			this.dispatchEvent(event);
		});
		php.onMessage(async (message) => {
			for (const listener of this.onMessageListeners) {
				const returnData = await listener(message);
				if (returnData) {
					return returnData;
				}
			}
			return '';
		});
	}

	async [Symbol.asyncDispose]() {
		await _private.get(this)!.requestHandler?.[Symbol.asyncDispose]();
	}
}
