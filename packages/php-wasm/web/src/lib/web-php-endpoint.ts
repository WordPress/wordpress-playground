import {
	type MessageListener,
	type IsomorphicLocalPHP,
	type ListFilesOptions,
	type PHPRequest,
	PHPResponse,
	type PHPRunOptions,
	type RmDirOptions,
	type PHPEventListener,
	type PHPEvent,
	PHPRequestHandler,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { WebPHP } from './web-php';

const _private = new WeakMap<
	WebPHPEndpoint,
	{
		requestHandler?: PHPRequestHandler<WebPHP>;
		php?: WebPHP;
		monitor?: EmscriptenDownloadMonitor;
	}
>();

/**
 * A PHP client that can be used to run PHP code in the browser.
 */
export class WebPHPEndpoint implements Omit<IsomorphicLocalPHP, 'setSapiName'> {
	/** @inheritDoc @php-wasm/universal!RequestHandler.absoluteUrl  */
	absoluteUrl = '';
	/** @inheritDoc @php-wasm/universal!RequestHandler.documentRoot  */
	documentRoot = '';

	/** @inheritDoc */
	constructor(
		requestHandler?: PHPRequestHandler<WebPHP>,
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

	public __internal_setRequestHandler(
		requestHandler: PHPRequestHandler<WebPHP>
	) {
		this.absoluteUrl = requestHandler.absoluteUrl;
		this.documentRoot = requestHandler.documentRoot;
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

	async setPrimaryPHP(php: WebPHP) {
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

	/** @inheritDoc @php-wasm/universal!IsomorphicLocalPHP.mv  */
	async mv(fromPath: string, toPath: string) {
		return _private.get(this)!.php!.mv(fromPath, toPath);
	}

	/** @inheritDoc @php-wasm/universal!IsomorphicLocalPHP.rmdir  */
	async rmdir(path: string, options?: RmDirOptions) {
		return _private.get(this)!.php!.rmdir(path, options);
	}

	/** @inheritDoc @php-wasm/universal!PHPRequestHandler.request */
	async request(request: PHPRequest): Promise<PHPResponse> {
		const requestHandler = _private.get(this)!.requestHandler!;
		return await requestHandler.request(request);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.run */
	async run(request: PHPRunOptions): Promise<PHPResponse> {
		const { php, reap } = await _private
			.get(this)!
			.requestHandler!.processManager.acquirePHPInstance();
		try {
			return await php.run(request);
		} finally {
			reap();
		}
	}

	/** @inheritDoc @php-wasm/web!WebPHP.chdir */
	chdir(path: string): void {
		return _private.get(this)!.php!.chdir(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.setSapiName */
	setSapiName(newName: string): void {
		_private.get(this)!.php!.setSapiName(newName);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.mkdir */
	mkdir(path: string): void {
		return _private.get(this)!.php!.mkdir(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.mkdirTree */
	mkdirTree(path: string): void {
		return _private.get(this)!.php!.mkdirTree(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.readFileAsText */
	readFileAsText(path: string): string {
		return _private.get(this)!.php!.readFileAsText(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.readFileAsBuffer */
	readFileAsBuffer(path: string): Uint8Array {
		return _private.get(this)!.php!.readFileAsBuffer(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.writeFile */
	writeFile(path: string, data: string | Uint8Array): void {
		return _private.get(this)!.php!.writeFile(path, data);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.unlink */
	unlink(path: string): void {
		return _private.get(this)!.php!.unlink(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.listFiles */
	listFiles(path: string, options?: ListFilesOptions): string[] {
		return _private.get(this)!.php!.listFiles(path, options);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.isDir */
	isDir(path: string): boolean {
		return _private.get(this)!.php!.isDir(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.fileExists */
	fileExists(path: string): boolean {
		return _private.get(this)!.php!.fileExists(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.onMessage */
	onMessage(listener: MessageListener): void {
		_private.get(this)!.php!.onMessage(listener);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.defineConstant */
	defineConstant(key: string, value: string | boolean | number | null): void {
		_private.get(this)!.php!.defineConstant(key, value);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.addEventListener */
	addEventListener(
		eventType: PHPEvent['type'],
		listener: PHPEventListener
	): void {
		_private.get(this)!.php!.addEventListener(eventType, listener);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.removeEventListener */
	removeEventListener(
		eventType: PHPEvent['type'],
		listener: PHPEventListener
	): void {
		_private.get(this)!.php!.removeEventListener(eventType, listener);
	}
}
