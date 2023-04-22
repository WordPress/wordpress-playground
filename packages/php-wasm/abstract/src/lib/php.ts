import PHPBrowser from './php-browser';
import PHPRequestHandler, {
	HTTPMethod,
	PHPRequest,
	PHPRequestHandlerConfiguration,
	PHPRequestHeaders,
} from './php-request-handler';
import { PHPResponse } from './php-response';
import { rethrowFileSystemError } from './rethrow-file-system-error';

const STR = 'string';
const NUM = 'number';

export type RuntimeType = 'NODE' | 'WEB' | 'WORKER';

declare const self: WindowOrWorkerGlobalScope;
declare const WorkerGlobalScope: object | undefined;

export interface FileInfo {
	key: string;
	name: string;
	type: string;
	data: Uint8Array;
}
export interface PHPRunOptions {
	/**
	 * Request path following the domain:port part.
	 */
	relativeUri?: string;

	/**
	 * Path of the .php file to execute.
	 */
	scriptPath?: string;

	/**
	 * Request protocol.
	 */
	protocol?: string;

	/**
	 * Request method. Default: `GET`.
	 */
	method?: HTTPMethod;

	/**
	 * Request headers.
	 */
	headers?: PHPRequestHeaders;

	/**
	 * Request body without the files.
	 */
	body?: string;

	/**
	 * Uploaded files.
	 */
	fileInfos?: FileInfo[];

	/**
	 * The code snippet to eval instead of a php file.
	 */
	code?: string;
}

export type PHPRuntimeId = number;
const loadedRuntimes: PHPRuntime[] = [];

export const currentJsRuntime = (function () {
	// @ts-ignore
	if (typeof window !== 'undefined' && !import.meta.env.TEST) {
		return 'WEB';
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof (WorkerGlobalScope as any)
	) {
		return 'WORKER';
	} else {
		return 'NODE';
	}
})();

export interface WithPHPIniBindings {
	setPhpIniPath(path: string): void;
	setPhpIniEntry(key: string, value: string): void;
}

export interface WithCLI {
	/**
	 * Starts a PHP CLI session with given arguments.
	 *
	 * Can only be used when PHP was compiled with the CLI SAPI.
	 * Cannot be used in conjunction with `run()`.
	 *
	 * @param  argv - The arguments to pass to the CLI.
	 * @returns The exit code of the CLI session.
	 */
	cli(argv: string[]): Promise<number>;
}

export interface WithNodeFilesystem {
	/**
	 * Mounts a Node.js filesystem to a given path in the PHP filesystem.
	 *
	 * @param  localPath - The path of a real local directory you want to mount.
	 * @param  virtualFSPath - Where to mount it in the virtual filesystem.
	 * @see {@link https://emscripten.org/docs/api_reference/Filesystem-API.html#FS.mount}
	 */
	mount(localPath: string | MountSettings, virtualFSPath: string): void;
}

export interface RmDirOptions {
	/**
	 * If true, recursively removes the directory and all its contents.
	 * Default: true.
	 */
	recursive?: boolean;
}

export interface WithFilesystem {
	/**
	 * Recursively creates a directory with the given path in the PHP filesystem.
	 * For example, if the path is `/root/php/data`, and `/root` already exists,
	 * it will create the directories `/root/php` and `/root/php/data`.
	 *
	 * @param  path - The directory path to create.
	 */
	mkdir(path: string): void;

	/**
	 * @deprecated Use mkdir instead.
	 */
	mkdirTree(path: string): void;

	/**
	 * Reads a file from the PHP filesystem and returns it as a string.
	 *
	 * @throws {@link ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	readFileAsText(path: string): string;

	/**
	 * Reads a file from the PHP filesystem and returns it as an array buffer.
	 *
	 * @throws {@link ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	readFileAsBuffer(path: string): Uint8Array;

	/**
	 * Overwrites data in a file in the PHP filesystem.
	 * Creates a new file if one doesn't exist yet.
	 *
	 * @param  path - The file path to write to.
	 * @param  data - The data to write to the file.
	 */
	writeFile(path: string, data: string | Uint8Array): void;

	/**
	 * Removes a file from the PHP filesystem.
	 *
	 * @throws {@link ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to remove.
	 */
	unlink(path: string): void;

	/**
	 * Moves a file or directory in the PHP filesystem to a
	 * new location.
	 *
	 * @param oldPath The path to rename.
	 * @param newPath The new path.
	 */
	mv(oldPath: string, newPath: string): void;

	/**
	 * Removes a directory from the PHP filesystem.
	 *
	 * @param path The directory path to remove.
	 * @param options Options for the removal.
	 */
	rmdir(path: string, options?: RmDirOptions): void;

	/**
	 * Lists the files and directories in the given directory.
	 *
	 * @param  path - The directory path to list.
	 * @returns The list of files and directories in the given directory.
	 */
	listFiles(path: string): string[];

	/**
	 * Checks if a directory exists in the PHP filesystem.
	 *
	 * @param  path – The path to check.
	 * @returns True if the path is a directory, false otherwise.
	 */
	isDir(path: string): boolean;

	/**
	 * Checks if a file (or a directory) exists in the PHP filesystem.
	 *
	 * @param  path - The file path to check.
	 * @returns True if the file exists, false otherwise.
	 */
	fileExists(path: string): boolean;

	/**
	 * Changes the current working directory in the PHP filesystem.
	 * This is the directory that will be used as the base for relative paths.
	 * For example, if the current working directory is `/root/php`, and the
	 * path is `data`, the absolute path will be `/root/php/data`.
	 *
	 * @param  path - The new working directory.
	 */
	chdir(path: string): void;
}

export interface WithRun {
	/**
	 * Runs PHP code.
	 * Cannot be used in conjunction with `cli()`.
	 *
	 * @example
	 * ```js
	 * const output = await php.run('<?php echo "Hello world!";');
	 * console.log(output.stdout); // "Hello world!"
	 * ```
	 *
	 * @example
	 * ```js
	 * console.log(await php.run(`<?php
	 *  $fp = fopen('php://stderr', 'w');
	 *  fwrite($fp, "Hello, world!");
	 * `));
	 * // {"exitCode":0,"stdout":"","stderr":["Hello, world!"]}
	 * ```
	 *
	 * @param  request - PHP Request data.
	 */
	run(request?: PHPRunOptions): Promise<PHPResponse>;
}

export interface WithRequestHandler {
	/**
	 * Dispatches a HTTP request using PHP as a backend.
	 * Cannot be used in conjunction with `cli()`.
	 *
	 * @example
	 * ```js
	 * const output = await php.request({
	 * 	method: 'GET',
	 * 	url: '/index.php',
	 * 	headers: {
	 * 		'X-foo': 'bar',
	 * 	},
	 * 	formData: {
	 * 		foo: 'bar',
	 * 	},
	 * });
	 * console.log(output.stdout); // "Hello world!"
	 * ```
	 *
	 * @param  request - PHP Request data.
	 */
	request(request?: PHPRequest): Promise<PHPResponse>;
	/** @inheritDoc @php-wasm/web!PHPRequestHandler.pathToInternalUrl */
	pathToInternalUrl(path: string): Promise<string>;

	/** @inheritDoc @php-wasm/web!PHPRequestHandler.internalUrlToPath */
	internalUrlToPath(internalUrl: string): Promise<string>;

	/** @inheritDoc @php-wasm/web!PHPRequestHandler.absoluteUrl */
	absoluteUrl: Promise<string>;

	/** @inheritDoc @php-wasm/web!PHPRequestHandler.documentRoot */
	documentRoot: Promise<string>;
}

export type PHPRuntime = any;

export type PHPLoaderModule = {
	dependencyFilename: string;
	dependenciesTotalSize: number;
	init: (jsRuntime: string, options: EmscriptenOptions) => PHPRuntime;
};

export type DataModule = {
	dependencyFilename: string;
	dependenciesTotalSize: number;
	default: (phpRuntime: PHPRuntime) => void;
};

export type EmscriptenOptions = {
	onAbort?: (message: string) => void;
	ENV?: Record<string, string>;
	locateFile?: (path: string) => string;
	noInitialRun?: boolean;
	dataFileDownloads?: Record<string, number>;
	print?: (message: string) => void;
	printErr?: (message: string) => void;
	onRuntimeInitialized?: () => void;
	monitorRunDependencies?: (left: number) => void;
} & Record<string, any>;

export type MountSettings = {
	root: string;
};

/** @inheritdoc T */
type Promisify<T> = {
	[P in keyof T]: T[P] extends (...args: infer A) => infer R
		? R extends void | Promise<any>
			? T[P]
			: (...args: A) => ReturnType<T[P]> | Promise<ReturnType<T[P]>>
		: T[P] | Promise<T[P]>;
};

type _UniversalPHP = WithPHPIniBindings &
	WithFilesystem &
	WithRequestHandler &
	WithRun;
export type UniversalPHP = Promisify<_UniversalPHP>;

/**
 * An environment-agnostic wrapper around the Emscripten PHP runtime
 * that abstracts the super low-level API and provides a more convenient
 * higher-level API.
 *
 * It exposes a minimal set of methods to run PHP scripts and to
 * interact with the PHP filesystem.
 */
export abstract class BasePHP
	implements _UniversalPHP, WithNodeFilesystem, WithCLI
{
	#Runtime: any;
	#phpIniOverrides: [string, string][] = [];
	#webSapiInitialized = false;
	requestHandler?: PHPBrowser;

	/**
	 * Initializes a PHP runtime.
	 *
	 * @internal
	 * @param  PHPRuntime - Optional. PHP Runtime ID as initialized by loadPHPRuntime.
	 * @param  serverOptions - Optional. Options for the PHPRequestHandler. If undefined, no request handler will be initialized.
	 */
	constructor(
		PHPRuntimeId?: PHPRuntimeId,
		serverOptions?: PHPRequestHandlerConfiguration
	) {
		if (PHPRuntimeId !== undefined) {
			this.initializeRuntime(PHPRuntimeId);
		}
		if (serverOptions) {
			this.requestHandler = new PHPBrowser(
				new PHPRequestHandler(this, serverOptions)
			);
		}
	}

	/** @inheritDoc */
	get absoluteUrl() {
		return Promise.resolve(this.requestHandler!.server.absoluteUrl);
	}

	/** @inheritDoc */
	get documentRoot() {
		return Promise.resolve(this.requestHandler!.server.absoluteUrl);
	}

	/** @inheritDoc */
	async pathToInternalUrl(path: string): Promise<string> {
		return this.requestHandler!.server.pathToInternalUrl(path);
	}

	/** @inheritDoc */
	async internalUrlToPath(internalUrl: string): Promise<string> {
		return this.requestHandler!.server.internalUrlToPath(internalUrl);
	}

	initializeRuntime(runtimeId: PHPRuntimeId) {
		if (this.#Runtime) {
			throw new Error('PHP runtime already initialized.');
		}
		if (!loadedRuntimes[runtimeId]) {
			throw new Error('Invalid PHP runtime id.');
		}
		this.#Runtime = loadedRuntimes[runtimeId];
	}

	/** @inheritDoc */
	setPhpIniPath(path: string) {
		if (this.#webSapiInitialized) {
			throw new Error('Cannot set PHP ini path after calling run().');
		}
		this.#Runtime.ccall('wasm_set_phpini_path', null, ['string'], [path]);
	}

	/** @inheritDoc */
	setPhpIniEntry(key: string, value: string) {
		if (this.#webSapiInitialized) {
			throw new Error('Cannot set PHP ini entries after calling run().');
		}
		this.#phpIniOverrides.push([key, value]);
	}

	/** @inheritDoc */
	chdir(path: string) {
		this.#Runtime.FS.chdir(path);
	}

	/** @inheritDoc */
	async request(
		request: PHPRequest,
		maxRedirects?: number
	): Promise<PHPResponse> {
		if (!this.requestHandler) {
			throw new Error('No request handler available.');
		}
		return this.requestHandler.request(request, maxRedirects);
	}

	/** @inheritDoc */
	async run(request: PHPRunOptions = {}): Promise<PHPResponse> {
		if (!this.#webSapiInitialized) {
			this.#initWebRuntime();
			this.#webSapiInitialized = true;
		}
		this.#setScriptPath(request.scriptPath || '');
		this.#setRelativeRequestUri(request.relativeUri || '');
		this.#setRequestMethod(request.method || 'GET');
		const { host, ...headers } = {
			host: 'example.com:443',
			...normalizeHeaders(request.headers || {}),
		};
		this.#setRequestHostAndProtocol(host, request.protocol || 'http');
		this.#setRequestHeaders(headers);
		if (request.body) {
			this.#setRequestBody(request.body);
		}
		if (request.fileInfos) {
			for (const file of request.fileInfos) {
				this.#addUploadedFile(file);
			}
		}
		if (request.code) {
			this.#setPHPCode(' ?>' + request.code);
		}
		return await this.#handleRequest();
	}

	#initWebRuntime() {
		if (this.#phpIniOverrides.length > 0) {
			const overridesAsIni =
				this.#phpIniOverrides
					.map(([key, value]) => `${key}=${value}`)
					.join('\n') + '\n\n';
			this.#Runtime.ccall(
				'wasm_set_phpini_entries',
				null,
				[STR],
				[overridesAsIni]
			);
		}
		this.#Runtime.ccall('php_wasm_init', null, [], []);
	}

	cli(argv: string[]): Promise<number> {
		for (const arg of argv) {
			this.#Runtime.ccall('wasm_add_cli_arg', null, [STR], [arg]);
		}
		return this.#Runtime.ccall('run_cli', null, [], [], { async: true });
	}

	#getResponseHeaders(): {
		headers: PHPResponse['headers'];
		httpStatusCode: number;
	} {
		const headersFilePath = '/tmp/headers.json';
		if (!this.fileExists(headersFilePath)) {
			throw new Error(
				'SAPI Error: Could not find response headers file.'
			);
		}

		const headersData = JSON.parse(this.readFileAsText(headersFilePath));
		const headers: PHPResponse['headers'] = {};
		for (const line of headersData.headers) {
			if (!line.includes(': ')) {
				continue;
			}
			const colonIndex = line.indexOf(': ');
			const headerName = line.substring(0, colonIndex).toLowerCase();
			const headerValue = line.substring(colonIndex + 2);
			if (!(headerName in headers)) {
				headers[headerName] = [] as string[];
			}
			headers[headerName].push(headerValue);
		}
		return {
			headers,
			httpStatusCode: headersData.status,
		};
	}

	#setRelativeRequestUri(uri: string) {
		this.#Runtime.ccall('wasm_set_request_uri', null, [STR], [uri]);
		if (uri.includes('?')) {
			const queryString = uri.substring(uri.indexOf('?') + 1);
			this.#Runtime.ccall(
				'wasm_set_query_string',
				null,
				[STR],
				[queryString]
			);
		}
	}

	#setRequestHostAndProtocol(host: string, protocol: string) {
		this.#Runtime.ccall('wasm_set_request_host', null, [STR], [host]);

		let port;
		try {
			port = parseInt(new URL(host).port, 10);
		} catch (e) {
			// ignore
		}

		if (!port || isNaN(port) || port === 80) {
			port = protocol === 'https' ? 443 : 80;
		}
		this.#Runtime.ccall('wasm_set_request_port', null, [NUM], [port]);

		if (protocol === 'https' || (!protocol && port === 443)) {
			this.addServerGlobalEntry('HTTPS', 'on');
		}
	}

	#setRequestMethod(method: string) {
		this.#Runtime.ccall('wasm_set_request_method', null, [STR], [method]);
	}

	setSkipShebang(shouldSkip: boolean) {
		this.#Runtime.ccall(
			'wasm_set_skip_shebang',
			null,
			[NUM],
			[shouldSkip ? 1 : 0]
		);
	}

	#setRequestHeaders(headers: PHPRequestHeaders) {
		if (headers['cookie']) {
			this.#Runtime.ccall(
				'wasm_set_cookies',
				null,
				[STR],
				[headers['cookie']]
			);
		}
		if (headers['content-type']) {
			this.#Runtime.ccall(
				'wasm_set_content_type',
				null,
				[STR],
				[headers['content-type']]
			);
		}
		if (headers['content-length']) {
			this.#Runtime.ccall(
				'wasm_set_content_length',
				null,
				[NUM],
				[parseInt(headers['content-length'], 10)]
			);
		}
		for (const name in headers) {
			this.addServerGlobalEntry(
				`HTTP_${name.toUpperCase().replace(/-/g, '_')}`,
				headers[name]
			);
		}
	}

	#setRequestBody(body: string) {
		this.#Runtime.ccall('wasm_set_request_body', null, [STR], [body]);
		this.#Runtime.ccall(
			'wasm_set_content_length',
			null,
			[NUM],
			[body.length]
		);
	}

	#setScriptPath(path: string) {
		this.#Runtime.ccall('wasm_set_path_translated', null, [STR], [path]);
	}

	addServerGlobalEntry(key: string, value: string) {
		this.#Runtime.ccall(
			'wasm_add_SERVER_entry',
			null,
			[STR, STR],
			[key, value]
		);
	}

	/**
	 * Adds file information to $_FILES superglobal in PHP.
	 *
	 * In particular:
	 * * Creates the file data in the filesystem
	 * * Registers the file details in PHP
	 *
	 * @param  fileInfo - File details
	 */
	#addUploadedFile(fileInfo: FileInfo) {
		const { key, name, type, data } = fileInfo;

		const tmpPath = `/tmp/${Math.random().toFixed(20)}`;
		this.writeFile(tmpPath, data);

		const error = 0;
		this.#Runtime.ccall(
			'wasm_add_uploaded_file',
			null,
			[STR, STR, STR, STR, NUM, NUM],
			[key, name, type, tmpPath, error, data.byteLength]
		);
	}

	#setPHPCode(code: string) {
		this.#Runtime.ccall('wasm_set_php_code', null, [STR], [code]);
	}

	async #handleRequest(): Promise<PHPResponse> {
		/**
		 * This is awkward, but Asyncify makes wasm_sapi_handle_request return
		 * Promise<Promise<number>>.
		 *
		 * @TODO: Determine if this is a bug in emscripten.
		 */
		const exitCode = await await this.#Runtime.ccall(
			'wasm_sapi_handle_request',
			NUM,
			[],
			[]
		);

		const { headers, httpStatusCode } = this.#getResponseHeaders();
		return new PHPResponse(
			httpStatusCode,
			headers,
			this.readFileAsBuffer('/tmp/stdout'),
			this.readFileAsText('/tmp/stderr'),
			exitCode
		);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not create directory "{path}"')
	mkdir(path: string) {
		this.#Runtime.FS.mkdirTree(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not create directory "{path}"')
	mkdirTree(path: string) {
		this.mkdir(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not read "{path}"')
	readFileAsText(path: string) {
		return new TextDecoder().decode(this.readFileAsBuffer(path));
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not read "{path}"')
	readFileAsBuffer(path: string): Uint8Array {
		return this.#Runtime.FS.readFile(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not write to "{path}"')
	writeFile(path: string, data: string | Uint8Array) {
		this.#Runtime.FS.writeFile(path, data);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not unlink "{path}"')
	unlink(path: string) {
		this.#Runtime.FS.unlink(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not move "{path}"')
	mv(fromPath: string, toPath: string) {
		this.#Runtime.FS.mv(fromPath, toPath);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not remove directory "{path}"')
	rmdir(path: string, options: RmDirOptions = { recursive: true }) {
		if (options?.recursive) {
			this.listFiles(path).forEach((file) => {
				const filePath = `${path}/${file}`;
				if (this.isDir(filePath)) {
					this.rmdir(filePath, options);
				} else {
					this.unlink(filePath);
				}
			});
		}
		this.#Runtime.FS.rmdir(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not list files in "{path}"')
	listFiles(path: string): string[] {
		if (!this.fileExists(path)) {
			return [];
		}
		try {
			return this.#Runtime.FS.readdir(path).filter(
				(name: string) => name !== '.' && name !== '..'
			);
		} catch (e) {
			console.error(e, { path });
			return [];
		}
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not stat "{path}"')
	isDir(path: string): boolean {
		if (!this.fileExists(path)) {
			return false;
		}
		return this.#Runtime.FS.isDir(
			this.#Runtime.FS.lookupPath(path).node.mode
		);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not stat "{path}"')
	fileExists(path: string): boolean {
		try {
			this.#Runtime.FS.lookupPath(path);
			return true;
		} catch (e) {
			return false;
		}
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not mount a directory')
	mount(localPath: string | MountSettings, virtualFSPath: string) {
		this.#Runtime.FS.mount(
			this.#Runtime.FS.filesystems.NODEFS,
			typeof localPath === 'object' ? localPath : { root: localPath },
			virtualFSPath
		);
	}
}

export function normalizeHeaders(
	headers: PHPRunOptions['headers']
): PHPRunOptions['headers'] {
	const normalized: PHPRunOptions['headers'] = {};
	for (const key in headers) {
		normalized[key.toLowerCase()] = headers[key];
	}
	return normalized;
}

/**
 * Output of the PHP.wasm runtime.
 */
export interface PHPOutput {
	/** Exit code of the PHP process. 0 means success, 1 and 2 mean error. */
	exitCode: number;

	/** Stdout data */
	stdout: ArrayBuffer;

	/** Stderr lines */
	stderr: string[];
}

/**
 * Loads the PHP runtime with the given arguments and data dependencies.
 *
 * This function handles the entire PHP initialization pipeline. In particular, it:
 *
 * * Instantiates the Emscripten PHP module
 * * Wires it together with the data dependencies and loads them
 * * Ensures is all happens in a correct order
 * * Waits until the entire loading sequence is finished
 *
 * Basic usage:
 *
 * ```js
 *  const phpLoaderModule = await getPHPLoaderModule("7.4");
 *  const php = await loadPHPRuntime( phpLoaderModule );
 *  console.log(php.run(`<?php echo "Hello, world!"; `));
 *  // { stdout: ArrayBuffer containing the string "Hello, world!", stderr: [''], exitCode: 0 }
 * ```
 *
 * **The PHP loader module:**
 *
 * In the basic usage example, `phpLoaderModule` is **not** a vanilla Emscripten module. Instead,
 * it's an ESM module that wraps the regular Emscripten output and adds some
 * extra functionality. It's generated by the Dockerfile shipped with this repo.
 * Here's the API it provides:
 *
 * ```js
 * // php.wasm size in bytes:
 * export const dependenciesTotalSize = 5644199;
 *
 * // php.wasm filename:
 * export const dependencyFilename = 'php.wasm';
 *
 * // Run Emscripten's generated module:
 * export default function(jsEnv, emscriptenModuleArgs) {}
 * ```
 *
 * **PHP Filesystem:**
 *
 * Once initialized, the PHP has its own filesystem separate from the project
 * files. It's provided by [Emscripten and uses its FS library](https://emscripten.org/docs/api_reference/Filesystem-API.html).
 *
 * The API exposed to you via the PHP class is succinct and abstracts
 * await certain unintuitive parts of low-level FS interactions.
 *
 * Here's how to use it:
 *
 * ```js
 * // Recursively create a /var/www directory
 * php.mkdirTree('/var/www');
 *
 * console.log(php.fileExists('/var/www/file.txt'));
 * // false
 *
 * php.writeFile('/var/www/file.txt', 'Hello from the filesystem!');
 *
 * console.log(php.fileExists('/var/www/file.txt'));
 * // true
 *
 * console.log(php.readFile('/var/www/file.txt'));
 * // "Hello from the filesystem!
 *
 * // Delete the file:
 * php.unlink('/var/www/file.txt');
 * ```
 *
 * For more details consult the PHP class directly.
 *
 * **Data dependencies:**
 *
 * Using existing PHP packages by manually recreating them file-by-file would
 * be quite inconvenient. Fortunately, Emscripten provides a "data dependencies"
 * feature.
 *
 * Data dependencies consist of a `dependency.data` file and a `dependency.js` loader and
 * can be packaged with the [file_packager.py tool]( https://emscripten.org/docs/porting/files/packaging_files.html#packaging-using-the-file-packager-tool).
 * This project requires wrapping the Emscripten-generated `dependency.js` file in an ES
 * module as follows:
 *
 * 1. Prepend `export default function(emscriptenPHPModule) {'; `
 * 2. Prepend `export const dependencyFilename = '<DATA FILE NAME>'; `
 * 3. Prepend `export const dependenciesTotalSize = <DATA FILE SIZE>;`
 * 4. Append `}`
 *
 * Be sure to use the `--export-name="emscriptenPHPModule"` file_packager.py option.
 *
 * You want the final output to look as follows:
 *
 * ```js
 * export const dependenciesTotalSize = 5644199;
 * export const dependencyFilename = 'dependency.data';
 * export default function(emscriptenPHPModule) {
 *    // Emscripten-generated code:
 *    var Module = typeof emscriptenPHPModule !== 'undefined' ? emscriptenPHPModule : {};
 *    // ... the rest of it ...
 * }
 * ```
 *
 * Such a constructions enables loading the `dependency.js` as an ES Module using
 * `import("/dependency.js")`.
 *
 * Once it's ready, you can load PHP and your data dependencies as follows:
 *
 * ```js
 *  const [phpLoaderModule, wordPressLoaderModule] = await Promise.all([
 *    getPHPLoaderModule("7.4"),
 *    import("/wp.js")
 *  ]);
 *  const php = await loadPHPRuntime(phpLoaderModule, {}, [wordPressLoaderModule]);
 * ```
 *
 * @public
 * @param  phpLoaderModule         - The ESM-wrapped Emscripten module. Consult the Dockerfile for the build process.
 * @param  phpModuleArgs           - The Emscripten module arguments, see https://emscripten.org/docs/api_reference/module.html#affecting-execution.
 * @param  dataDependenciesModules - A list of the ESM-wrapped Emscripten data dependency modules.
 * @returns Loaded runtime id.
 */

export async function loadPHPRuntime(
	phpLoaderModule: PHPLoaderModule,
	phpModuleArgs: EmscriptenOptions = {},
	dataDependenciesModules: DataModule[] = []
): Promise<number> {
	let resolvePhpReady: any, resolveDepsReady: any;
	const depsReady = new Promise((resolve) => {
		resolveDepsReady = resolve;
	});
	const phpReady = new Promise((resolve) => {
		resolvePhpReady = resolve;
	});

	const PHPRuntime = phpLoaderModule.init(currentJsRuntime, {
		onAbort(reason) {
			console.error('WASM aborted: ');
			console.error(reason);
		},
		ENV: {},
		// Emscripten sometimes prepends a '/' to the path, which
		// breaks vite dev mode. An identity `locateFile` function
		// fixes it.
		locateFile: (path) => path,
		...phpModuleArgs,
		noInitialRun: true,
		onRuntimeInitialized() {
			if (phpModuleArgs.onRuntimeInitialized) {
				phpModuleArgs.onRuntimeInitialized();
			}
			resolvePhpReady();
		},
		monitorRunDependencies(nbLeft) {
			if (nbLeft === 0) {
				delete PHPRuntime.monitorRunDependencies;
				resolveDepsReady();
			}
		},
	});
	for (const { default: loadDataModule } of dataDependenciesModules) {
		loadDataModule(PHPRuntime);
	}
	if (!dataDependenciesModules.length) {
		resolveDepsReady();
	}

	await depsReady;
	await phpReady;

	loadedRuntimes.push(PHPRuntime);
	return loadedRuntimes.length - 1;
}
