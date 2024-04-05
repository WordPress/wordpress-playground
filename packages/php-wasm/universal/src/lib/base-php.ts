import { PHPBrowser } from './php-browser';
import {
	PHPRequestHandler,
	PHPRequestHandlerConfiguration,
} from './php-request-handler';
import { PHPResponse } from './php-response';
import {
	getEmscriptenFsError,
	rethrowFileSystemError,
} from './rethrow-file-system-error';
import { getLoadedRuntime } from './load-php-runtime';
import type { PHPRuntimeId } from './load-php-runtime';
import {
	IsomorphicLocalPHP,
	MessageListener,
	PHPRequest,
	PHPRequestHeaders,
	PHPRunOptions,
	RmDirOptions,
	ListFilesOptions,
	SpawnHandler,
	PHPEventListener,
	PHPEvent,
} from './universal-php';
import {
	getFunctionsMaybeMissingFromAsyncify,
	improveWASMErrorReporting,
	UnhandledRejectionsTarget,
} from './wasm-error-reporting';
import { Semaphore, createSpawnHandler, joinPaths } from '@php-wasm/util';

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
	#phpIniPath?: string;
	#sapiName?: string;
	#webSapiInitialized = false;
	#wasmErrorsTarget: UnhandledRejectionsTarget | null = null;
	#serverEntries: Record<string, string> = {};
	#eventListeners: Map<string, Set<PHPEventListener>> = new Map();
	#messageListeners: MessageListener[] = [];
	requestHandler?: PHPBrowser;

	/**
	 * An exclusive lock that prevent multiple requests from running at
	 * the same time.
	 */
	semaphore: Semaphore;

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
		this.semaphore = new Semaphore({ concurrency: 1 });
		if (PHPRuntimeId !== undefined) {
			this.initializeRuntime(PHPRuntimeId);
		}
		if (serverOptions) {
			this.requestHandler = new PHPBrowser(
				new PHPRequestHandler(this, serverOptions)
			);
		}
	}

	addEventListener(eventType: PHPEvent['type'], listener: PHPEventListener) {
		if (!this.#eventListeners.has(eventType)) {
			this.#eventListeners.set(eventType, new Set());
		}
		this.#eventListeners.get(eventType)!.add(listener);
	}

	removeEventListener(
		eventType: PHPEvent['type'],
		listener: PHPEventListener
	) {
		this.#eventListeners.get(eventType)?.delete(listener);
	}

	dispatchEvent<Event extends PHPEvent>(event: Event) {
		const listeners = this.#eventListeners.get(event.type);
		if (!listeners) {
			return;
		}

		for (const listener of listeners) {
			listener(event);
		}
	}

	/** @inheritDoc */
	async onMessage(listener: MessageListener) {
		this.#messageListeners.push(listener);
	}

	/** @inheritDoc */
	async setSpawnHandler(handler: SpawnHandler | string) {
		if (typeof handler === 'string') {
			// This workaround is needed because the
			// Comlink messaging library used by Playground
			// has a hard time serializing a composite
			// handler object.
			// @TODO: Don't eval text-based functions here. Instead
			//        use a MessagePort to communicate with the
			//		  parent context.
			// Perhaps this library would be useful:
			// https://github.com/WebReflection/coincident/
			handler = createSpawnHandler(eval(handler));
		}
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
		runtime['onMessage'] = async (
			data: string
		): Promise<string | Uint8Array> => {
			for (const listener of this.#messageListeners) {
				const returnData = await listener(data);

				if (returnData) {
					return returnData;
				}
			}

			return '';
		};

		this.#wasmErrorsTarget = improveWASMErrorReporting(runtime);
		this.dispatchEvent({
			type: 'runtime.initialized',
		});
	}

	/** @inheritDoc */
	async setSapiName(newName: string) {
		const result = this[__private__dont__use].ccall(
			'wasm_set_sapi_name',
			NUMBER,
			[STRING],
			[newName]
		);
		if (result !== 0) {
			throw new Error(
				'Could not set SAPI name. This can only be done before the PHP WASM module is initialized.' +
					'Did you already dispatch any requests?'
			);
		}
		this.#sapiName = newName;
	}

	/** @inheritDoc */
	setPhpIniPath(path: string) {
		if (this.#webSapiInitialized) {
			throw new Error('Cannot set PHP ini path after calling run().');
		}
		this.#phpIniPath = path;
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
		/*
		 * Prevent multiple requests from running at the same time.
		 * For example, if a request is made to a PHP file that
		 * requests another PHP file, the second request may
		 * be dispatched before the first one is finished.
		 */
		const release = await this.semaphore.acquire();
		let heapBodyPointer;
		try {
			if (!this.#webSapiInitialized) {
				this.#initWebRuntime();
				this.#webSapiInitialized = true;
			}
			if (request.scriptPath && !this.fileExists(request.scriptPath)) {
				throw new Error(
					`The script path "${request.scriptPath}" does not exist.`
				);
			}
			this.#setScriptPath(request.scriptPath || '');
			this.#setRelativeRequestUri(request.relativeUri || '');
			this.#setRequestMethod(request.method || 'GET');
			const headers = normalizeHeaders(request.headers || {});
			const host = headers['host'] || 'example.com:443';

			this.#setRequestHostAndProtocol(host, request.protocol || 'http');
			this.#setRequestHeaders(headers);
			if (request.body) {
				heapBodyPointer = this.#setRequestBody(request.body);
			}
			if (typeof request.code === 'string') {
				this.#setPHPCode(' ?>' + request.code);
			}
			this.#addServerGlobalEntriesInWasm();

			const env = request.env || {};
			for (const key in env) {
				this.#setEnv(key, env[key]);
			}

			const response = await this.#handleRequest();
			if (response.exitCode !== 0) {
				const output = {
					stdout: response.text,
					stderr: response.errors,
				};
				console.warn(`PHP.run() output was:`, output);
				const error = new Error(
					`PHP.run() failed with exit code ${response.exitCode} and the following output: ` +
						response.errors
				);
				// @ts-ignore
				error.output = output;
				// @ts-ignore
				error.source = 'request';
				console.error(error);
				throw error;
			}
			return response;
		} catch (e) {
			this.dispatchEvent({
				type: 'request.error',
				error: e as Error,
				// Distinguish between PHP request and PHP-wasm errors
				source: (e as any).source ?? 'php-wasm',
			});
			throw e;
		} finally {
			try {
				if (heapBodyPointer) {
					this[__private__dont__use].free(heapBodyPointer);
				}
			} finally {
				release();
				this.dispatchEvent({
					type: 'request.end',
				});
			}
		}
	}

	#initWebRuntime() {
		/**
		 * This creates a consts.php file in an in-memory
		 * /internal directory and sets the auto_prepend_file PHP option
		 * to always load that file.
		 * @see https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file
		 *
		 * Technically, this is a workaround. In the future, let's implement a
		 * WASM SAPI method to pass consts directly.
		 * @see https://github.com/WordPress/wordpress-playground/issues/750
		 */
		this.setPhpIniEntry('auto_prepend_file', '/internal/consts.php');
		if (!this.fileExists('/internal/consts.php')) {
			this.writeFile(
				'/internal/consts.php',
				`<?php
				if(file_exists('/internal/consts.json')) {
					$consts = json_decode(file_get_contents('/internal/consts.json'), true);
					foreach ($consts as $const => $value) {
						if (!defined($const) && is_scalar($value)) {
							define($const, $value);
						}
					}
				}`
			);
		}

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
		const headersFilePath = '/internal/headers.json';
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

	#setRequestBody(body: string | Uint8Array) {
		let size, contentLength;
		if (typeof body === 'string') {
			console.warn(
				'Passing a string as the request body is deprecated. Please use a Uint8Array instead. See ' +
					'https://github.com/WordPress/wordpress-playground/issues/997 for more details'
			);
			contentLength = this[__private__dont__use].lengthBytesUTF8(body);
			size = contentLength + 1;
		} else {
			contentLength = body.byteLength;
			size = body.byteLength;
		}

		const heapBodyPointer = this[__private__dont__use].malloc(size);
		if (!heapBodyPointer) {
			throw new Error('Could not allocate memory for the request body.');
		}

		// Write the string to the WASM memory
		if (typeof body === 'string') {
			this[__private__dont__use].stringToUTF8(
				body,
				heapBodyPointer,
				size + 1
			);
		} else {
			this[__private__dont__use].HEAPU8.set(body, heapBodyPointer);
		}

		this[__private__dont__use].ccall(
			'wasm_set_request_body',
			null,
			[NUMBER],
			[heapBodyPointer]
		);
		this[__private__dont__use].ccall(
			'wasm_set_content_length',
			null,
			[NUMBER],
			[contentLength]
		);
		return heapBodyPointer;
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

	#setEnv(name: string, value: string) {
		this[__private__dont__use].ccall(
			'wasm_add_ENV_entry',
			null,
			[STRING, STRING],
			[name, value]
		);
	}

	defineConstant(key: string, value: string | boolean | number | null) {
		let consts = {};
		try {
			consts = JSON.parse(
				this.fileExists('/internal/consts.json')
					? this.readFileAsText('/internal/consts.json') || '{}'
					: '{}'
			);
		} catch (e) {
			// ignore
		}
		this.writeFile(
			'/internal/consts.json',
			JSON.stringify({
				...consts,
				[key]: value,
			})
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
					console.error(e);
					console.error(e.error);
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
					[],
					{ async: true }
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
			console.error(rethrown);
			throw rethrown;
		} finally {
			this.#wasmErrorsTarget?.removeEventListener('error', errorListener);
			this.#serverEntries = {};
		}

		const { headers, httpStatusCode } = this.#getResponseHeaders();
		return new PHPResponse(
			httpStatusCode,
			headers,
			this.readFileAsBuffer('/internal/stdout'),
			this.readFileAsText('/internal/stderr'),
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
	mv(fromPath: string, toPath: string) {
		try {
			this[__private__dont__use].FS.rename(fromPath, toPath);
		} catch (e) {
			const errmsg = getEmscriptenFsError(e);
			if (!errmsg) {
				throw e;
			}
			throw new Error(
				`Could not move ${fromPath} to ${toPath}: ${errmsg}`,
				{
					cause: e,
				}
			);
		}
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

	/**
	 * Hot-swaps the PHP runtime for a new one without
	 * interrupting the operations of this PHP instance.
	 *
	 * @param runtime
	 */
	hotSwapPHPRuntime(runtime: number) {
		// Once we secure the lock and have the new runtime ready,
		// the rest of the swap handler is synchronous to make sure
		// no other operations acts on the old runtime or FS.
		// If there was await anywhere here, we'd risk applyng
		// asynchronous changes to either the filesystem or the
		// old PHP runtime without propagating them to the new
		// runtime.
		const oldFS = this[__private__dont__use].FS;

		// Kill the current runtime
		try {
			this.exit();
		} catch (e) {
			// Ignore the exit-related exception
		}

		// Initialize the new runtime
		this.initializeRuntime(runtime);

		// Re-apply any set() methods that are not
		// request related and result in a one-off
		// C function call.
		if (this.#phpIniPath) {
			this.setPhpIniPath(this.#phpIniPath);
		}

		if (this.#sapiName) {
			this.setSapiName(this.#sapiName);
		}

		// Copy the MEMFS directory structure from the old FS to the new one
		if (this.requestHandler) {
			const docroot = this.documentRoot;
			copyFS(oldFS, this[__private__dont__use].FS, docroot);
		}
	}

	exit(code = 0) {
		this.dispatchEvent({
			type: 'runtime.beforedestroy',
		});
		try {
			this[__private__dont__use]._exit(code);
		} catch (e) {
			// ignore the exit error
		}

		// Clean up any initialized state
		this.#webSapiInitialized = false;

		// Delete any links between this PHP instance and the runtime
		this.#wasmErrorsTarget = null;
		delete this[__private__dont__use]['onMessage'];
		delete this[__private__dont__use];
	}
}

export function normalizeHeaders(
	headers: PHPRequestHeaders
): PHPRequestHeaders {
	const normalized: PHPRequestHeaders = {};
	for (const key in headers) {
		normalized[key.toLowerCase()] = headers[key];
	}
	return normalized;
}

type EmscriptenFS = any;

export function syncFSTo(
	source: BasePHP,
	target: BasePHP,
	path: string | null = null
) {
	copyFS(
		source[__private__dont__use].FS,
		target[__private__dont__use].FS,
		path ?? source.documentRoot
	);
}

/**
 * Copies the MEMFS directory structure from one FS in another FS.
 * Non-MEMFS nodes are ignored.
 */
export function copyFS(
	source: EmscriptenFS,
	target: EmscriptenFS,
	path: string
) {
	let oldNode;
	try {
		oldNode = source.lookupPath(path);
	} catch (e) {
		return;
	}
	// MEMFS nodes have a `contents` property. NODEFS nodes don't.
	// We only want to copy MEMFS nodes here.
	if (!('contents' in oldNode.node)) {
		return;
	}

	// Let's be extra careful and only proceed if newFs doesn't
	// already have a node at the given path.
	try {
		// @TODO: Figure out the right thing to do. In Parent -> child PHP case,
		//        we indeed want to synchronize the entire filesystem. However,
		//        this approach seems slow and inefficient. Instead of exhaustively
		//        iterating, could we just mark directories as dirty on write? And
		//        how do we sync in both directions?
		// target = target.lookupPath(path);
		// return;
	} catch (e) {
		// There's no such node in the new FS. Good,
		// we may proceed.
	}

	if (!source.isDir(oldNode.node.mode)) {
		target.writeFile(path, source.readFile(path));
		return;
	}

	target.mkdirTree(path);
	const filenames = source
		.readdir(path)
		.filter((name: string) => name !== '.' && name !== '..');
	for (const filename of filenames) {
		copyFS(source, target, joinPaths(path, filename));
	}
}
