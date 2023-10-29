import { PHPBrowser } from './php-browser';
import {
	PHPRequestHandler,
	PHPRequestHandlerConfiguration,
} from './php-request-handler';
import { PHPResponse } from './php-response';
import { rethrowFileSystemError } from './rethrow-file-system-error';
import { getLoadedRuntime } from './load-php-runtime';
import type { PHPRuntimeId } from './load-php-runtime';
import {
	FileInfo,
	IsomorphicLocalPHP,
	MessageListener,
	PHPRequest,
	PHPRequestHeaders,
	PHPRunOptions,
	RmDirOptions,
	ListFilesOptions,
	SpawnHandler,
	PHPEventListener,
} from './universal-php';
import {
	getFunctionsMaybeMissingFromAsyncify,
	improveWASMErrorReporting,
	UnhandledRejectionsTarget,
} from './wasm-error-reporting';

const STRING = 'string';
const NUMBER = 'number';

export const __private__dont__use = Symbol('__private__dont__use');
/**
 * An environment-agnostic wrapper around the Emscripten PHP runtime
 * that universals the super low-level API and provides a more convenient
 * higher-level API.
 *
 * It exposes a minimal set of methods to run PHP scripts and to
 * interact with the PHP filesystem.
 */
export abstract class BasePHP implements IsomorphicLocalPHP {
	protected [__private__dont__use]: any;
	#phpIniOverrides: [string, string][] = [];
	#webSapiInitialized = false;
	#wasmErrorsTarget: UnhandledRejectionsTarget | null = null;
	#serverEntries: Record<string, string> = {};
	#eventListeners: Record<string, PHPEventListener<any>[]> = {};
	#messageListeners: MessageListener[] = [];
	#unbindMemfsEvents: () => void = () => {};
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
	async onMessage(listener: MessageListener) {
		this.#messageListeners.push(listener);
	}

	/** @inheritDoc */
	async setSpawnHandler(handler: SpawnHandler) {
		this[__private__dont__use].spawnProcess = handler;
	}

	/** @inheritDoc */
	get absoluteUrl() {
		return this.requestHandler!.requestHandler.absoluteUrl;
	}

	/** @inheritDoc */
	get documentRoot() {
		return this.requestHandler!.requestHandler.documentRoot;
	}

	/** @inheritDoc */
	pathToInternalUrl(path: string): string {
		return this.requestHandler!.requestHandler.pathToInternalUrl(path);
	}

	/** @inheritDoc */
	internalUrlToPath(internalUrl: string): string {
		return this.requestHandler!.requestHandler.internalUrlToPath(
			internalUrl
		);
	}

	initializeRuntime(runtimeId: PHPRuntimeId) {
		if (this[__private__dont__use]) {
			throw new Error('PHP runtime already initialized.');
		}
		const runtime = getLoadedRuntime(runtimeId);
		if (!runtime) {
			throw new Error('Invalid PHP runtime id.');
		}
		this[__private__dont__use] = runtime;
		runtime['onMessage'] = async (data: string): Promise<string> => {
			for (const listener of this.#messageListeners) {
				const returnData = await listener(data);

				if (returnData) {
					return returnData;
				}
			}

			return '';
		};

		this.#wasmErrorsTarget = improveWASMErrorReporting(runtime);
	}

	/** @inheritDoc */
	setPhpIniPath(path: string) {
		if (this.#webSapiInitialized) {
			throw new Error('Cannot set PHP ini path after calling run().');
		}
		this[__private__dont__use].ccall(
			'wasm_set_phpini_path',
			null,
			['string'],
			[path]
		);
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
		this[__private__dont__use].FS.chdir(path);
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
	async run(request: PHPRunOptions): Promise<PHPResponse> {
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
		this.#addServerGlobalEntriesInWasm();
		return await this.#handleRequest();
	}

	#initWebRuntime() {
		if (this.#phpIniOverrides.length > 0) {
			const overridesAsIni =
				this.#phpIniOverrides
					.map(([key, value]) => `${key}=${value}`)
					.join('\n') + '\n\n';
			this[__private__dont__use].ccall(
				'wasm_set_phpini_entries',
				null,
				[STRING],
				[overridesAsIni]
			);
		}
		this[__private__dont__use].ccall('php_wasm_init', null, [], []);
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
		this[__private__dont__use].ccall(
			'wasm_set_request_uri',
			null,
			[STRING],
			[uri]
		);
		if (uri.includes('?')) {
			const queryString = uri.substring(uri.indexOf('?') + 1);
			this[__private__dont__use].ccall(
				'wasm_set_query_string',
				null,
				[STRING],
				[queryString]
			);
		}
	}

	#setRequestHostAndProtocol(host: string, protocol: string) {
		this[__private__dont__use].ccall(
			'wasm_set_request_host',
			null,
			[STRING],
			[host]
		);

		let port;
		try {
			port = parseInt(new URL(host).port, 10);
		} catch (e) {
			// ignore
		}

		if (!port || isNaN(port) || port === 80) {
			port = protocol === 'https' ? 443 : 80;
		}
		this[__private__dont__use].ccall(
			'wasm_set_request_port',
			null,
			[NUMBER],
			[port]
		);

		if (protocol === 'https' || (!protocol && port === 443)) {
			this.addServerGlobalEntry('HTTPS', 'on');
		}
	}

	#setRequestMethod(method: string) {
		this[__private__dont__use].ccall(
			'wasm_set_request_method',
			null,
			[STRING],
			[method]
		);
	}

	#setRequestHeaders(headers: PHPRequestHeaders) {
		if (headers['cookie']) {
			this[__private__dont__use].ccall(
				'wasm_set_cookies',
				null,
				[STRING],
				[headers['cookie']]
			);
		}
		if (headers['content-type']) {
			this[__private__dont__use].ccall(
				'wasm_set_content_type',
				null,
				[STRING],
				[headers['content-type']]
			);
		}
		if (headers['content-length']) {
			this[__private__dont__use].ccall(
				'wasm_set_content_length',
				null,
				[NUMBER],
				[parseInt(headers['content-length'], 10)]
			);
		}
		for (const name in headers) {
			let HTTP_prefix = 'HTTP_';
			/**
			 * Some headers are special and don't have the HTTP_ prefix.
			 */
			if (
				['content-type', 'content-length'].includes(name.toLowerCase())
			) {
				HTTP_prefix = '';
			}
			this.addServerGlobalEntry(
				`${HTTP_prefix}${name.toUpperCase().replace(/-/g, '_')}`,
				headers[name]
			);
		}
	}

	#setRequestBody(body: string) {
		this[__private__dont__use].ccall(
			'wasm_set_request_body',
			null,
			[STRING],
			[body]
		);
		this[__private__dont__use].ccall(
			'wasm_set_content_length',
			null,
			[NUMBER],
			[new TextEncoder().encode(body).length]
		);
	}

	#setScriptPath(path: string) {
		this[__private__dont__use].ccall(
			'wasm_set_path_translated',
			null,
			[STRING],
			[path]
		);
	}

	addServerGlobalEntry(key: string, value: string) {
		this.#serverEntries[key] = value;
	}

	#addServerGlobalEntriesInWasm() {
		for (const key in this.#serverEntries) {
			this[__private__dont__use].ccall(
				'wasm_add_SERVER_entry',
				null,
				[STRING, STRING],
				[key, this.#serverEntries[key]]
			);
		}
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
		this[__private__dont__use].ccall(
			'wasm_add_uploaded_file',
			null,
			[STRING, STRING, STRING, STRING, NUMBER, NUMBER],
			[key, name, type, tmpPath, error, data.byteLength]
		);
	}

	#setPHPCode(code: string) {
		this[__private__dont__use].ccall(
			'wasm_set_php_code',
			null,
			[STRING],
			[code]
		);
	}

	async #handleRequest(): Promise<PHPResponse> {
		let exitCode: number;

		/*
		 * Emscripten throws WASM failures outside of the promise chain so we need
		 * to listen for them here and rethrow in the correct context. Otherwise we
		 * get crashes and unhandled promise rejections without any useful error messages
		 * or stack traces.
		 */
		let errorListener: any;
		try {
			// eslint-disable-next-line no-async-promise-executor
			exitCode = await new Promise<number>((resolve, reject) => {
				errorListener = (e: ErrorEvent) => {
					const rethrown = new Error('Rethrown');
					rethrown.cause = e.error;
					(rethrown as any).betterMessage = e.message;
					reject(rethrown);
				};
				this.#wasmErrorsTarget?.addEventListener(
					'error',
					errorListener
				);
				const response = this[__private__dont__use].ccall(
					'wasm_sapi_handle_request',
					NUMBER,
					[],
					[]
				);
				if (response instanceof Promise) {
					return response.then(resolve, reject);
				}
				return resolve(response);
			});
		} catch (e) {
			/**
			 * An exception here means an irrecoverable crash. Let's make
			 * it very clear to the consumers of this API – every method
			 * call on this PHP instance will throw an error from now on.
			 */
			for (const name in this) {
				if (typeof this[name] === 'function') {
					(this as any)[name] = () => {
						throw new Error(
							`PHP runtime has crashed – see the earlier error for details.`
						);
					};
				}
			}
			(this as any).functionsMaybeMissingFromAsyncify =
				getFunctionsMaybeMissingFromAsyncify();

			const err = e as Error;
			const message = (
				'betterMessage' in err ? err.betterMessage : err.message
			) as string;
			const rethrown = new Error(message);
			rethrown.cause = err;
			throw rethrown;
		} finally {
			this.#wasmErrorsTarget?.removeEventListener('error', errorListener);
			this.#serverEntries = {};
		}

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
		this[__private__dont__use].FS.mkdirTree(path);
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
		return this[__private__dont__use].FS.readFile(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not write to "{path}"')
	writeFile(path: string, data: string | Uint8Array) {
		this[__private__dont__use].FS.writeFile(path, data);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not unlink "{path}"')
	unlink(path: string) {
		this[__private__dont__use].FS.unlink(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not move "{path}"')
	mv(fromPath: string, toPath: string) {
		this[__private__dont__use].FS.rename(fromPath, toPath);
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
		this[__private__dont__use].FS.rmdir(path);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not list files in "{path}"')
	listFiles(
		path: string,
		options: ListFilesOptions = { prependPath: false }
	): string[] {
		if (!this.fileExists(path)) {
			return [];
		}
		try {
			const files = this[__private__dont__use].FS.readdir(path).filter(
				(name: string) => name !== '.' && name !== '..'
			);
			if (options.prependPath) {
				const prepend = path.replace(/\/$/, '');
				return files.map((name: string) => `${prepend}/${name}`);
			}
			return files;
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
		return this[__private__dont__use].FS.isDir(
			this[__private__dont__use].FS.lookupPath(path).node.mode
		);
	}

	/** @inheritDoc */
	@rethrowFileSystemError('Could not stat "{path}"')
	fileExists(path: string): boolean {
		try {
			this[__private__dont__use].FS.lookupPath(path);
			return true;
		} catch (e) {
			return false;
		}
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
