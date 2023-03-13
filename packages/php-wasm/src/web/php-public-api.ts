import type {
	Filesystem,
	PHPIni,
	PHPRequest,
	PHPResponse,
	HandlesRun,
} from '../php-library/php';
import type { HandlesRequest } from '../php-library/php-browser';
import type {
	PHP,
	PHPBrowser,
	PHPServer,
	PHPServerRequest,
} from '../php-library/index';
import { EmscriptenDownloadMonitor } from '.';

type Promisify<T> = {
	[P in keyof T]: T[P] extends (...args: infer A) => infer R
		? R extends void | Promise<any>
			? T[P]
			: (...args: A) => Promise<ReturnType<T[P]>>
		: Promise<T[P]>;
};

type PublicAPI = Promisify<HandlesRequest & PHPIni & Filesystem & HandlesRun>;

export class PHPPublicAPI implements PublicAPI
{
	#php: PHP;
	#phpServer: PHPServer;
	#phpBrowser: PHPBrowser;
	#monitor?: EmscriptenDownloadMonitor;

	absoluteUrl: string;

	constructor(browser: PHPBrowser, monitor?: EmscriptenDownloadMonitor) {
		this.#phpBrowser = browser;
		this.#phpServer = browser.server;
		this.#php = browser.server.php;
		this.absoluteUrl = this.#phpServer.absoluteUrl;
		this.#monitor = monitor;
	}

	pathToInternalUrl(path: string): string {
		return this.#phpServer.pathToInternalUrl(path);
	}

	internalUrlToPath(internalUrl: string): string {
		return this.#phpServer.internalUrlToPath(internalUrl);
	}

	onDownloadProgress(
		callback: (progress: CustomEvent<ProgressEvent>) => void
	) {
		this.#monitor?.addEventListener('progress', callback as any);
	}

	request(
		request: PHPServerRequest,
		redirects?: number
	): Promise<PHPResponse> {
		return this.#phpBrowser.request(request, redirects);
	}

	async run(request?: PHPRequest | undefined): Promise<PHPResponse> {
		return this.#php.run(request);
	}

	setPhpIniPath(path: string): void {
		return this.#php.setPhpIniPath(path);
	}

	setPhpIniEntry(key: string, value: string): void {
		this.#php.setPhpIniEntry(key, value);
	}

	mkdirTree(path: string): void {
		this.#php.mkdirTree(path);
	}

	async readFileAsText(path: string): Promise<string> {
		return this.#php.readFileAsText(path);
	}

	async readFileAsBuffer(path: string): Promise<Uint8Array> {
		return this.#php.readFileAsBuffer(path);
	}

	writeFile(path: string, data: string | Uint8Array): void {
		this.#php.writeFile(path, data);
	}

	unlink(path: string): void {
		this.#php.unlink(path);
	}

	async listFiles(path: string): Promise<string[]> {
		return this.#php.listFiles(path);
	}

	async isDir(path: string): Promise<boolean> {
		return this.#php.isDir(path);
	}

    async fileExists(path: string): Promise<boolean> {
		return this.#php.fileExists(path);
	}
}
