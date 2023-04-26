import type {
	BasePHP,
	IsomorphicLocalPHP,
	PHPRequest,
	PHPResponse,
	PHPRunOptions,
	RmDirOptions,
} from '@php-wasm/universal';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';

const _private = new WeakMap<
	WebPHPEndpoint,
	{
		php: BasePHP;
		monitor?: EmscriptenDownloadMonitor;
	}
>();

/**
 * A PHP client that can be used to run PHP code in the browser.
 */
export class WebPHPEndpoint implements IsomorphicLocalPHP {
	/** @inheritDoc */
	absoluteUrl: string;
	/** @inheritDoc */
	documentRoot: string;

	/** @inheritDoc */
	constructor(php: BasePHP, monitor?: EmscriptenDownloadMonitor) {
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
			php,
			monitor,
		});
		this.absoluteUrl = php.absoluteUrl;
		this.documentRoot = php.documentRoot;
	}

	/** @inheritDoc */
	pathToInternalUrl(path: string): string {
		return _private.get(this)!.php.pathToInternalUrl(path);
	}

	/** @inheritDoc */
	internalUrlToPath(internalUrl: string): string {
		return _private.get(this)!.php.internalUrlToPath(internalUrl);
	}

	async onDownloadProgress(
		callback: (progress: CustomEvent<ProgressEvent>) => void
	): Promise<void> {
		return _private
			.get(this)!
			.monitor?.addEventListener('progress', callback as any);
	}

	/** @inheritDoc */
	mv(fromPath: string, toPath: string) {
		return _private.get(this)!.php.mv(fromPath, toPath);
	}

	/** @inheritDoc */
	rmdir(path: string, options?: RmDirOptions) {
		return _private.get(this)!.php.rmdir(path, options);
	}

	/** @inheritDoc @php-wasm/universal!RequestHandler.request */
	request(request: PHPRequest, redirects?: number): Promise<PHPResponse> {
		return _private.get(this)!.php.request(request, redirects);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.run */
	async run(request: PHPRunOptions): Promise<PHPResponse> {
		return _private.get(this)!.php.run(request);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.chdir */
	chdir(path: string): void {
		return _private.get(this)!.php.chdir(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.setPhpIniPath */
	setPhpIniPath(path: string): void {
		return _private.get(this)!.php.setPhpIniPath(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.setPhpIniEntry */
	setPhpIniEntry(key: string, value: string): void {
		return _private.get(this)!.php.setPhpIniEntry(key, value);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.mkdir */
	mkdir(path: string): void {
		return _private.get(this)!.php.mkdir(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.mkdirTree */
	mkdirTree(path: string): void {
		return _private.get(this)!.php.mkdirTree(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.readFileAsText */
	readFileAsText(path: string): string {
		return _private.get(this)!.php.readFileAsText(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.readFileAsBuffer */
	readFileAsBuffer(path: string): Uint8Array {
		return _private.get(this)!.php.readFileAsBuffer(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.writeFile */
	writeFile(path: string, data: string | Uint8Array): void {
		return _private.get(this)!.php.writeFile(path, data);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.unlink */
	unlink(path: string): void {
		return _private.get(this)!.php.unlink(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.listFiles */
	listFiles(path: string): string[] {
		return _private.get(this)!.php.listFiles(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.isDir */
	isDir(path: string): boolean {
		return _private.get(this)!.php.isDir(path);
	}

	/** @inheritDoc @php-wasm/web!WebPHP.fileExists */
	fileExists(path: string): boolean {
		return _private.get(this)!.php.fileExists(path);
	}
}
