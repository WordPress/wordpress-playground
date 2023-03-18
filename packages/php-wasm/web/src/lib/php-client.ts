import type {
	WithFilesystem,
	PHP,
	PHPBrowser,
	PHPServer,
	PHPServerRequest,
	WithPHPIniBindings,
	PHPRequest,
	PHPResponse,
	WithRun,
	WithRequest,
} from '@php-wasm/common';
import type { Remote } from 'comlink';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';

/** @inheritdoc T */
type Promisify<T> = {
	[P in keyof T]: T[P] extends (...args: infer A) => infer R
		? R extends void | Promise<any>
			? T[P]
			: (...args: A) => Promise<ReturnType<T[P]>>
		: Promise<T[P]>;
};

interface WithPathConversion {
	pathToInternalUrl(path: string): Promise<string>;
	internalUrlToPath(internalUrl: string): Promise<string>;
}

interface WithProgress {
	onDownloadProgress(
		callback: (progress: CustomEvent<ProgressEvent>) => void
	): Promise<void>;
}

const _private = new WeakMap<
	PHPClient,
	{
		php: PHP;
		phpServer: PHPServer;
		phpBrowser: PHPBrowser;
		monitor?: EmscriptenDownloadMonitor;
	}
>();

/*
 * All the Promise<> wraping is to make this class interchangeable
 * for the Remote<PHPClient> type that will be typically consumed.
 * This way, all the code working with same-thread PHPClient can
 * also work with the remote PHPClient.
 */

/**
 * A PHP client that can be used to run PHP code in the browser.
 */
export class PHPClient
	implements
		Promisify<
			WithRequest &
				WithPHPIniBindings &
				WithFilesystem &
				WithRun &
				WithProgress &
				WithPathConversion
		>
{
	/** @inheritDoc @php-wasm/web!PHPServer.absoluteUrl */
	absoluteUrl: Promise<string>;
	/** @inheritDoc @php-wasm/web!PHPServer.documentRoot */
	documentRoot: Promise<string>;

	/** @inheritDoc */
	constructor(browser: PHPBrowser, monitor?: EmscriptenDownloadMonitor) {
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
			php: browser.server.php,
			phpServer: browser.server,
			phpBrowser: browser,
			monitor,
		});
		this.absoluteUrl = Promise.resolve(browser.server.absoluteUrl);
		this.documentRoot = Promise.resolve(browser.server.documentRoot);
	}

	/** @inheritDoc @php-wasm/web!PHPServer.pathToInternalUrl */
	async pathToInternalUrl(path: string): Promise<string> {
		return _private.get(this)!.phpServer.pathToInternalUrl(path);
	}

	/** @inheritDoc @php-wasm/web!PHPServer.internalUrlToPath */
	async internalUrlToPath(internalUrl: string): Promise<string> {
		return _private.get(this)!.phpServer.internalUrlToPath(internalUrl);
	}

	async onDownloadProgress(
		callback: (progress: CustomEvent<ProgressEvent>) => void
	): Promise<void> {
		_private
			.get(this)!
			.monitor?.addEventListener('progress', callback as any);
	}

	/** @inheritDoc @php-wasm/web!PHPServer.request */
	request(
		request: PHPServerRequest,
		redirects?: number
	): Promise<PHPResponse> {
		return _private.get(this)!.phpBrowser.request(request, redirects);
	}

	/** @inheritDoc @php-wasm/web!PHP.run */
	async run(request?: PHPRequest | undefined): Promise<PHPResponse> {
		return _private.get(this)!.php.run(request);
	}

	/** @inheritDoc @php-wasm/web!PHP.setPhpIniPath */
	setPhpIniPath(path: string): void {
		return _private.get(this)!.php.setPhpIniPath(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.setPhpIniEntry */
	setPhpIniEntry(key: string, value: string): void {
		_private.get(this)!.php.setPhpIniEntry(key, value);
	}

	/** @inheritDoc @php-wasm/web!PHP.mkdirTree */
	mkdirTree(path: string): void {
		_private.get(this)!.php.mkdirTree(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.readFileAsText */
	async readFileAsText(path: string): Promise<string> {
		return _private.get(this)!.php.readFileAsText(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.readFileAsBuffer */
	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		return _private.get(this)!.php.readFileAsBuffer(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.writeFile */
	writeFile(path: string, data: string | Uint8Array): void {
		_private.get(this)!.php.writeFile(path, data);
	}

	/** @inheritDoc @php-wasm/web!PHP.unlink */
	unlink(path: string): void {
		_private.get(this)!.php.unlink(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.listFiles */
	async listFiles(path: string): Promise<string[]> {
		return _private.get(this)!.php.listFiles(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.isDir */
	async isDir(path: string): Promise<boolean> {
		return _private.get(this)!.php.isDir(path);
	}

	/** @inheritDoc @php-wasm/web!PHP.fileExists */
	async fileExists(path: string): Promise<boolean> {
		return _private.get(this)!.php.fileExists(path);
	}

	async cli(command: string): Promise<number> {
		return _private.get(this)!.php.cli(['php', '-f', '/wp-cli.phar']);
	}
}

// An asssertion to make sure Playground Client is compatible
// with Remote<PlaygroundClient>
export const isAssignableToRemoteClient: PHPClient =
	{} as any as Remote<PHPClient>;
