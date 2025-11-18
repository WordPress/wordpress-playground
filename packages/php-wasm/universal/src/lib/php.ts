import { logger } from '@php-wasm/logger';
import {
	Semaphore,
	basename,
	createSpawnHandler,
	joinPaths,
} from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';
import type { ListFilesOptions, RmDirOptions } from './fs-helpers';
import { FSHelpers } from './fs-helpers';
import { isExitCode } from './is-exit-code';
import type { PHPRuntimeId } from './load-php-runtime';
import { getLoadedRuntime } from './load-php-runtime';
import type { PHPRequestHandler } from './php-request-handler';
import { PHPResponse, StreamedPHPResponse } from './php-response';
import type {
	ChildProcess,
	MessageListener,
	PHPEvent,
	PHPEventListener,
	PHPRequest,
	PHPRequestHeaders,
	PHPRunOptions,
	SpawnHandler,
} from './universal-php';
import type { UnhandledRejectionsTarget } from './wasm-error-reporting';
import {
	getFunctionsMaybeMissingFromAsyncify,
	improveWASMErrorReporting,
} from './wasm-error-reporting';

const STRING = 'string';
const NUMBER = 'number';

export const __private__dont__use = Symbol('__private__dont__use');

type ErrorSource = 'request' | 'php-wasm';
export class PHPExecutionFailureError extends Error {
	response: PHPResponse;
	source: ErrorSource;

	constructor(message: string, response: PHPResponse, source: ErrorSource) {
		super(message);
		this.response = response;
		this.source = source;
	}
}

export type UnmountFunction = (() => Promise<any>) | (() => any);
export type MountHandler = (
	php: PHP,
	FS: Emscripten.RootFS,
	vfsMountPoint: string
) => UnmountFunction | Promise<UnmountFunction>;

export const PHP_INI_PATH = '/internal/shared/php.ini';
const AUTO_PREPEND_SCRIPT = '/internal/shared/auto_prepend_file.php';

export const USE_OPCACHE = true;
const OPCACHE_FILE_FOLDER = '/internal/shared/opcache';

type MountObject = {
	mountHandler: MountHandler;
	unmount: () => Promise<any>;
};

/**
 * An environment-agnostic wrapper around the Emscripten PHP runtime
 * that universals the super low-level API and provides a more convenient
 * higher-level API.
 *
 * It exposes a minimal set of methods to run PHP scripts and to
 * interact with the PHP filesystem.
 */
export class PHP implements Disposable {
	protected [__private__dont__use]: any;
	#sapiName?: string;
	#phpWasmInitCalled = false;
	#wasmErrorsTarget: UnhandledRejectionsTarget | null = null;
	#eventListeners: Map<string, Set<PHPEventListener>> = new Map([
		// Listen to all events
		['*', new Set()],
	]);
	#messageListeners: MessageListener[] = [];
	#mounts: Record<string, MountObject> = {};
	#rotationOptions: {
		enabled: boolean;
		recreateRuntime: () => Promise<number> | number;
		needsRotating: boolean;
		maxRequests: number;
		requestsMade: number;
	} = {
		enabled: false,
		recreateRuntime: () => 0,
		needsRotating: false,
		maxRequests: 400,
		requestsMade: 0,
	};

	requestHandler?: PHPRequestHandler;

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
	 * @param  requestHandlerOptions - Optional. Options for the PHPRequestHandler. If undefined, no request handler will be initialized.
	 */
	constructor(PHPRuntimeId?: PHPRuntimeId) {
		this.semaphore = new Semaphore({ concurrency: 1 });
		if (PHPRuntimeId !== undefined) {
			this.initializeRuntime(PHPRuntimeId);
		}
		/**
		 * Listen to PHP runtime crashes.
		 *
		 * Registering an actual event listener helps with testing. The
		 * test cases can dispatch synthetic error events and confirm the
		 * PHP runtime is properly rotated.
		 */
		this.addEventListener('request.error', (event: any) => {
			if (event.source === 'php-wasm') {
				this.#rotationOptions.needsRotating = true;
			}
		});
	}
	/**
	 * Adds an event listener for a PHP event.
	 * @param eventType - The type of event to listen for.
	 * @param listener - The listener function to be called when the event is triggered.
	 */
	addEventListener(
		eventType: PHPEvent['type'] | '*',
		listener: PHPEventListener
	) {
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
		eventType: PHPEvent['type'] | '*',
		listener: PHPEventListener
	) {
		this.#eventListeners.get(eventType)?.delete(listener);
	}

	dispatchEvent<Event extends PHPEvent>(event: Event) {
		const listeners = [
			...(this.#eventListeners.get(event.type) || []),
			...(this.#eventListeners.get('*') || []),
		];
		if (!listeners) {
			return;
		}
		for (const listener of listeners) {
			listener(event);
		}
	}

	/**
	 * Listens to message sent by the PHP code.
	 *
	 * To dispatch messages, call:
	 *
	 *     post_message_to_js(string $data)
	 *
	 *     Arguments:
	 *         $data (string) – Data to pass to JavaScript.
	 *
	 * @example
	 *
	 * ```ts
	 * const php = await PHP.load('8.0');
	 *
	 * php.onMessage(
	 *     // The data is always passed as a string
	 *     function (data: string) {
	 *         // Let's decode and log the data:
	 *         console.log(JSON.parse(data));
	 *     }
	 * );
	 *
	 * // Now that we have a listener in place, let's
	 * // dispatch a message:
	 * await php.run({
	 *     code: `<?php
	 *         post_message_to_js(
	 *             json_encode([
	 *                 'post_id' => '15',
	 *                 'post_title' => 'This is a blog post!'
	 *             ])
	 *         ));
	 *     `,
	 * });
	 * ```
	 *
	 * @param listener Callback function to handle the message.
	 */
	onMessage(listener: MessageListener) {
		this.#messageListeners.push(listener);
		return async () => {
			this.#messageListeners = this.#messageListeners.filter(
				(l) => l !== listener
			);
		};
	}

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

	/** @deprecated Use PHPRequestHandler instead. */
	get absoluteUrl() {
		return this.requestHandler!.absoluteUrl;
	}

	/** @deprecated Use PHPRequestHandler instead. */
	get documentRoot() {
		return this.requestHandler!.documentRoot;
	}

	/** @deprecated Use PHPRequestHandler instead. */
	pathToInternalUrl(path: string): string {
		return this.requestHandler!.pathToInternalUrl(path);
	}

	/** @deprecated Use PHPRequestHandler instead. */
	internalUrlToPath(internalUrl: string): string {
		return this.requestHandler!.internalUrlToPath(internalUrl);
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
		this[__private__dont__use].ccall(
			'wasm_set_phpini_path',
			null,
			['string'],
			[PHP_INI_PATH]
		);

		if (!this.fileExists(PHP_INI_PATH)) {
			const opcacheConfig = USE_OPCACHE
				? [
						// OPCache
						'opcache.enable = 1',
						'opcache.enable_cli = 1',
						'opcache.jit = 0',
						'opcache.interned_strings_buffer = 8',
						'opcache.max_accelerated_files = 1000',
						'opcache.memory_consumption = 64',
						'opcache.max_wasted_percentage = 5',
						'opcache.file_cache = ' + OPCACHE_FILE_FOLDER,
						// Always enable the file cache.
						'opcache.file_cache_only = 1',
						'opcache.file_cache_consistency_checks = 1',
				  ]
				: [];

			/*if (
				USE_OPCACHE &&
				!(
					runtime.phpVersion.major === 8 &&
					runtime.phpVersion.minor === 4
				)
			) {
				// Old versions of PHP are RAM hungry. By using the file cache, we can reduce
				// the RAM usage during the first caching.
				opcacheConfig.push(
					'opcache.file_cache_only = 1',
					'opcache.file_cache_consistency_checks = 1'
				);
			}*/

			if (!this.fileExists(OPCACHE_FILE_FOLDER)) {
				this.mkdir(OPCACHE_FILE_FOLDER);
			}

			this.writeFile(
				PHP_INI_PATH,
				[
					'auto_prepend_file=' + AUTO_PREPEND_SCRIPT,
					'memory_limit=256M',
					'ignore_repeated_errors = 1',
					'error_reporting = E_ALL',
					'display_errors = 1',
					'html_errors = 1',
					'display_startup_errors = On',
					'log_errors = 1',
					'always_populate_raw_post_data = -1',
					'upload_max_filesize = 2000M',
					'post_max_size = 2000M',
					'allow_url_fopen = On',
					'allow_url_include = Off',
					'session.save_path = /home/web_user',
					'implicit_flush = 1',
					'output_buffering = 0',
					'max_execution_time = 0',
					'max_input_time = -1',
					...opcacheConfig,
				].join('\n')
			);
		}
		if (!this.fileExists(AUTO_PREPEND_SCRIPT)) {
			this.writeFile(
				AUTO_PREPEND_SCRIPT,
				`<?php
				// Define constants set via defineConstant() calls
				if(file_exists('/internal/shared/consts.json')) {
					$consts = json_decode(file_get_contents('/internal/shared/consts.json'), true);
					foreach ($consts as $const => $value) {
						if (!defined($const) && is_scalar($value)) {
							define($const, $value);
						}
					}
				}
				// Preload all the files from /internal/shared/preload
				foreach (glob('/internal/shared/preload/*.php') as $file) {
					require_once $file;
				}
				`
			);
		}

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

	/**
	 * Changes the current working directory in the PHP filesystem.
	 * This is the directory that will be used as the base for relative paths.
	 * For example, if the current working directory is `/root/php`, and the
	 * path is `data`, the absolute path will be `/root/php/data`.
	 *
	 * @param  path - The new working directory.
	 */
	chdir(path: string) {
		this[__private__dont__use].FS.chdir(path);
	}

	/**
	 * Gets the current working directory in the PHP filesystem.
	 *
	 * @returns The current working directory.
	 */
	cwd() {
		return this[__private__dont__use].FS.cwd();
	}

	/**
	 * Changes the permissions of a file or directory.
	 * @param path - The path to the file or directory.
	 * @param mode - The new permissions.
	 */
	chmod(path: string, mode: number) {
		this[__private__dont__use].FS.chmod(path, mode);
	}

	/**
	 * Do not use. Use new PHPRequestHandler() instead.
	 * @deprecated
	 */
	async request(request: PHPRequest): Promise<PHPResponse> {
		logger.warn(
			'PHP.request() is deprecated. Please use new PHPRequestHandler() instead.'
		);
		if (!this.requestHandler) {
			throw new Error('No request handler available.');
		}
		return this.requestHandler.request(request);
	}

	/**
	 * Runs PHP code.
	 *
	 * This low-level method directly interacts with the WebAssembly
	 * PHP interpreter.
	 *
	 * Every time you call run(), it prepares the PHP
	 * environment and:
	 *
	 * * Resets the internal PHP state
	 * * Populates superglobals ($_SERVER, $_GET, etc.)
	 * * Handles file uploads
	 * * Populates input streams (stdin, argv, etc.)
	 * * Sets the current working directory
	 *
	 * You can use run() in two primary modes:
	 *
	 * ### Code snippet mode
	 *
	 * In this mode, you pass a string containing PHP code to run.
	 *
	 * ```ts
	 * const result = await php.run({
	 * 	code: `<?php echo "Hello world!";`
	 * });
	 * // result.text === "Hello world!"
	 * ```
	 *
	 * In this mode, information like __DIR__ or __FILE__ isn't very
	 * useful because the code is not associated with any file.
	 *
	 * Under the hood, the PHP snippet is passed to the `zend_eval_string`
	 * C function.
	 *
	 * ### File mode
	 *
	 * In the file mode, you pass a scriptPath and PHP executes a file
	 * found at a that path:
	 *
	 * ```ts
	 * php.writeFile(
	 * 	"/www/index.php",
	 * 	`<?php echo "Hello world!";"`
	 * );
	 * const result = await php.run({
	 * 	scriptPath: "/www/index.php"
	 * });
	 * // result.text === "Hello world!"
	 * ```
	 *
	 * In this mode, you can rely on path-related information like __DIR__
	 * or __FILE__.
	 *
	 * Under the hood, the PHP file is executed with the `php_execute_script`
	 * C function.
	 *
	 * The `run()` method cannot be used in conjunction with `cli()`.
	 *
	 * @example
	 * ```js
	 * const result = await php.run({
	 * 	code: `<?php
	 * 		$fp = fopen('php://stderr', 'w');
	 * 		fwrite($fp, "Hello, world!");
	 * 	`
	 * });
	 * // result.errors === "Hello, world!"
	 * ```
	 *
	 * @deprecated Use stream() instead.
	 * @param  request - PHP runtime options.
	 */
	async run(request: PHPRunOptions): Promise<PHPResponse> {
		const streamedResponse = await this.runStream(request);
		const syncResponse = await PHPResponse.fromStreamedResponse(
			streamedResponse
		);

		if (syncResponse.exitCode !== 0) {
			// Legacy run() behavior: throw if PHP exited with a non-zero exit code.
			// It could be a WASM crash, but it could be a PHP userland error such
			// as "Fatal error: Uncaught Error: Call to undefined function no_such_function()".
			//
			// runStream() does not throw just because an exitCode is non-zero.
			throw new PHPExecutionFailureError(
				`PHP.run() failed with exit code ${syncResponse.exitCode}. \n\n=== Stdout ===\n ${syncResponse.text}\n\n=== Stderr ===\n ${syncResponse.errors}`,
				syncResponse,
				'request'
			) as PHPExecutionFailureError;
		}

		return syncResponse;
	}
	/**
	 * Runs PHP code and returns a StreamedPHPResponse object that can be used to
	 * process the output incrementally.
	 *
	 * This low-level method directly interacts with the WebAssembly
	 * PHP interpreter and provides streaming capabilities for processing
	 * PHP output as it becomes available.
	 *
	 * Every time you call stream(), it prepares the PHP
	 * environment and:
	 *
	 * * Resets the internal PHP state
	 * * Populates superglobals ($_SERVER, $_GET, etc.)
	 * * Handles file uploads
	 * * Populates input streams (stdin, argv, etc.)
	 * * Sets the current working directory
	 *
	 * You can use stream() in two primary modes:
	 *
	 * ### Code snippet mode
	 *
	 * In this mode, you pass a string containing PHP code to run.
	 *
	 * ```ts
	 * const streamedResponse = await php.stream({
	 * 	code: `<?php echo "Hello world!";`
	 * });
	 * // Process output incrementally
	 * for await (const chunk of streamedResponse.text) {
	 * 	console.log(chunk);
	 * }
	 * ```
	 *
	 * In this mode, information like __DIR__ or __FILE__ isn't very
	 * useful because the code is not associated with any file.
	 *
	 * Under the hood, the PHP snippet is passed to the `zend_eval_string`
	 * C function.
	 *
	 * ### File mode
	 *
	 * In the file mode, you pass a scriptPath and PHP executes a file
	 * found at that path:
	 *
	 * ```ts
	 * php.writeFile(
	 * 	"/www/index.php",
	 * 	`<?php echo "Hello world!";"`
	 * );
	 * const streamedResponse = await php.stream({
	 * 	scriptPath: "/www/index.php"
	 * });
	 * // Process output incrementally
	 * for await (const chunk of streamedResponse.text) {
	 * 	console.log(chunk);
	 * }
	 * ```
	 *
	 * In this mode, you can rely on path-related information like __DIR__
	 * or __FILE__.
	 *
	 * Under the hood, the PHP file is executed with the `php_execute_script`
	 * C function.
	 *
	 * The `stream()` method cannot be used in conjunction with `cli()`.
	 *
	 * @example
	 * ```js
	 * const streamedResponse = await php.stream({
	 * 	code: `<?php
	 * 		for ($i = 0; $i < 5; $i++) {
	 * 			echo "Line $i\n";
	 * 			flush();
	 * 		}
	 * 	`
	 * });
	 *
	 * // Process output as it becomes available
	 * for await (const chunk of streamedResponse.text) {
	 * 	console.log('Received:', chunk);
	 * }
	 *
	 * // Get the final exit code
	 * const exitCode = await streamedResponse.exitCode;
	 * console.log('Exit code:', exitCode);
	 * ```
	 *
	 * @see run() – a synchronous version of this method.
	 * @param request - PHP runtime options.
	 * @returns A StreamedPHPResponse object.
	 */
	async runStream(request: PHPRunOptions): Promise<StreamedPHPResponse> {
		/*
		 * Prevent multiple requests from running at the same time.
		 * For example, if a request is made to a PHP file that
		 * requests another PHP file, the second request may
		 * be dispatched before the first one is finished.
		 */
		const release = await this.semaphore.acquire();
		let heapBodyPointer: number | undefined;
		const streamedResponsePromise = this.#executeWithErrorHandling(
			async () => {
				if (!this.#phpWasmInitCalled) {
					await this[__private__dont__use].ccall(
						'php_wasm_init',
						null,
						[],
						[],
						{
							isAsync: true,
						}
					);
					this.#phpWasmInitCalled = true;
				}
				if (
					request.scriptPath &&
					!this.fileExists(request.scriptPath)
				) {
					throw new Error(
						`The script path "${request.scriptPath}" does not exist.`
					);
				}
				this.#setRelativeRequestUri(request.relativeUri || '');
				this.#setRequestMethod(request.method || 'GET');
				const requestHeaders = normalizeHeaders(request.headers || {});
				const host = requestHeaders['host'] || 'example.com:443';

				const port = this.#inferPortFromHostAndProtocol(
					host,
					request.protocol || 'http'
				);
				this.#setRequestHost(host);
				this.#setRequestPort(port);
				this.#setRequestHeaders(requestHeaders);
				if (request.body) {
					heapBodyPointer = this.#setRequestBody(request.body);
				}
				if (typeof request.code === 'string') {
					this.writeFile('/internal/eval.php', request.code);
					this.#setScriptPath('/internal/eval.php');
				} else if (typeof request.scriptPath === 'string') {
					this.#setScriptPath(request.scriptPath || '');
				} else {
					throw new TypeError(
						'The request object must have either a `code` or a ' +
							'`scriptPath` property.'
					);
				}

				const $_SERVER = this.#prepareServerEntries(
					request.$_SERVER,
					requestHeaders,
					port
				);

				for (const key in $_SERVER) {
					this.#setServerGlobalEntry(key, $_SERVER[key]);
				}

				const env = request.env || {};
				for (const key in env) {
					this.#setEnv(key, env[key]);
				}

				return await this[__private__dont__use].ccall(
					'wasm_sapi_handle_request',
					NUMBER,
					[],
					[],
					{ async: true }
				);
			}
		);

		const cleanup = () => {
			if (heapBodyPointer) {
				try {
					this[__private__dont__use].free(heapBodyPointer);
				} catch (e) {
					logger.error(e);
				}
			}

			// Release the "request in progress" semaphore.
			release();

			/**
			 * Notify the filesystem journal (and any other listeners) that the request has ended.
			 */
			this.dispatchEvent({
				type: 'request.end',
			});
		};

		// Free up resources once the request is fully handled.
		return streamedResponsePromise.then(
			(streamedResponse) => {
				streamedResponse.finished.finally(cleanup);
				return streamedResponse;
			},
			(error) => {
				try {
					cleanup();
				} catch {
					// ... do nothing, just rethrow the original error in the finally section belos ...
				} finally {
					// eslint-disable-next-line no-unsafe-finally
					throw error;
				}
			}
		);
	}

	/**
	 * Prepares the $_SERVER entries for the PHP runtime.
	 *
	 * @param defaults Default entries to include in $_SERVER.
	 * @param headers HTTP headers to include in $_SERVER (as HTTP_ prefixed entries).
	 * @param port HTTP port, used to determine infer $_SERVER['HTTPS'] value if none
	 *             was provided.
	 * @returns Computed $_SERVER entries.
	 */
	#prepareServerEntries(
		defaults: Record<string, string> | undefined,
		headers: PHPRequestHeaders,
		port: number
	): Record<string, string> {
		const $_SERVER = {
			...(defaults || {}),
		};
		$_SERVER['HTTPS'] = $_SERVER['HTTPS'] || port === 443 ? 'on' : 'off';
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
			$_SERVER[`${HTTP_prefix}${name.toUpperCase().replace(/-/g, '_')}`] =
				headers[name];
		}
		return $_SERVER;
	}

	#setRelativeRequestUri(uri: string) {
		this[__private__dont__use].ccall(
			'wasm_set_request_uri',
			null,
			[STRING],
			[uri]
		);
		let queryString = '';
		if (uri.includes('?')) {
			queryString = uri.substring(uri.indexOf('?') + 1);
		}
		this[__private__dont__use].ccall(
			'wasm_set_query_string',
			null,
			[STRING],
			[queryString]
		);
	}

	#setRequestHost(host: string) {
		this[__private__dont__use].ccall(
			'wasm_set_request_host',
			null,
			[STRING],
			[host]
		);
	}

	#setRequestPort(port: number) {
		this[__private__dont__use].ccall(
			'wasm_set_request_port',
			null,
			[NUMBER],
			[port]
		);
	}

	#inferPortFromHostAndProtocol(host: string, protocol: string) {
		let port;
		try {
			port = parseInt(new URL(host).port, 10);
		} catch {
			// ignore
		}

		if (!port || isNaN(port) || port === 80) {
			port = protocol === 'https' ? 443 : 80;
		}
		return port;
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
	}

	#setRequestBody(body: string | Uint8Array) {
		let size, contentLength;
		if (typeof body === 'string') {
			logger.warn(
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

	#setServerGlobalEntry(key: string, value: string) {
		this[__private__dont__use].ccall(
			'wasm_add_SERVER_entry',
			null,
			[STRING, STRING],
			[key, value]
		);
	}

	#setEnv(name: string, value: string) {
		this[__private__dont__use].ccall(
			'wasm_add_ENV_entry',
			null,
			[STRING, STRING],
			[name, value]
		);
	}

	/**
	 * Defines a constant in the PHP runtime.
	 * @param key - The name of the constant.
	 * @param value - The value of the constant.
	 */
	defineConstant(key: string, value: string | boolean | number | null) {
		let consts = {};
		try {
			consts = JSON.parse(
				this.fileExists('/internal/shared/consts.json')
					? this.readFileAsText('/internal/shared/consts.json') ||
							'{}'
					: '{}'
			);
		} catch {
			// ignore
		}
		this.writeFile(
			'/internal/shared/consts.json',
			JSON.stringify({
				...consts,
				[key]: value,
			})
		);
	}

	/**
	 * Executes a PHP runtime function with proper error handling and streaming setup.
	 * Sets up streaming infrastructure and returns a StreamedPHPResponse.
	 *
	 * @param executionFn - Function that returns the exit code or a promise of exit code
	 * @returns Promise that resolves to a StreamedPHPResponse
	 */
	async #executeWithErrorHandling(
		executionFn: () => any
	): Promise<StreamedPHPResponse> {
		if (
			this.#rotationOptions.enabled &&
			this.#rotationOptions.needsRotating
		) {
			await this.rotateRuntime();
		}
		++this.#rotationOptions.requestsMade;
		if (
			this.#rotationOptions.requestsMade >=
			this.#rotationOptions.maxRequests
		) {
			this.#rotationOptions.needsRotating = true;
		}

		const emscriptenModule = this[__private__dont__use];

		const headers = await createInvertedReadableStream<Uint8Array>();
		emscriptenModule.onHeaders = (chunk: Uint8Array) => {
			if (streamsClosed || headersClosed) {
				return;
			}
			// slice() chunk to clone the data and preserve it for the reader later on.
			// We need that because the ArrayBuffer underlying `chunk` may change
			// after this callback return. Without cloning, the reader would read
			// whatever bytes are available in the ArrayBuffer at the time of the read.
			headers.controller.enqueue(chunk.slice());
		};
		let headersClosed = false;
		const closeHeadersStream = () => {
			if (!headersClosed) {
				headersClosed = true;
				headers.controller.close();
			}
		};

		const stdout = await createInvertedReadableStream<Uint8Array>();
		emscriptenModule.onStdout = (chunk: Uint8Array) => {
			closeHeadersStream();
			if (streamsClosed) {
				return;
			}
			stdout.controller.enqueue(chunk.slice());
		};

		const stderr = await createInvertedReadableStream<Uint8Array>();
		emscriptenModule.onStderr = (chunk: Uint8Array) => {
			if (streamsClosed) {
				return;
			}
			stderr.controller.enqueue(chunk.slice());
		};

		let streamsClosed = false;

		let errorListener: any;

		const runExecutionFunction = async () => {
			try {
				/*
				 * Emscripten throws WASM failures outside of the promise chain so we need
				 * to listen for them here and rethrow in the correct context. Otherwise we
				 * get crashes and unhandled promise rejections without any useful error
				 * messages or meaningful stack traces.
				 */
				const exitCode = await Promise.race([
					executionFn(),
					new Promise((_, reject) => {
						errorListener = (e: ErrorEvent) => {
							if (!isExitCode(e.error)) {
								reject(e.error);
							}
						};
						this.#wasmErrorsTarget?.addEventListener(
							'error',
							errorListener,
							{ once: true }
						);
					}),
				]);
				return exitCode;
			} catch (e) {
				/**
				 * Emscripten sometimes communicates program exit as an error. Let's
				 * turn exit code errors into integers again.
				 */
				if (isExitCode(e)) {
					return e.status;
				}

				// Non-exit-code errors indicate a WASM runtime crash. Let's clean up and throw.
				stdout.controller.error(e);
				stderr.controller.error(e);
				headers.controller.error(e);
				streamsClosed = true;

				/**
				 * A non-exit-code error means an irrecoverable crash. Let's make
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

				throw e;
			} finally {
				if (!streamsClosed) {
					stdout.controller.close();
					stderr.controller.close();
					closeHeadersStream();
					streamsClosed = true;
				}
				this.#wasmErrorsTarget?.removeEventListener(
					'error',
					errorListener
				);
			}
		};

		/**
		 * Dispatch a request.error event for any global crash handlers. For example,
		 * Playground web uses this to automatically display a "Report crash" modal.
		 */
		const exitCodePromise = runExecutionFunction().then(
			(exitCode) => {
				/**
				 * Emit errors related to PHP script failures (exit code other than 0)
				 */
				if (exitCode !== 0) {
					this.dispatchEvent({
						type: 'request.error',
						error: new Error(
							`PHP.run() failed with exit code ${exitCode}.`
						),
						// Distinguish between PHP request and PHP-wasm errors
						source: 'php-wasm',
					});
				}
				return exitCode;
			},
			(error) => {
				/**
				 * Emit all other errors.
				 */
				// Distinguish between PHP request and PHP-wasm errors
				const source = (error as any).source ?? 'php-wasm';
				this.dispatchEvent({
					type: 'request.error',
					error: error as any as Error,
					source,
				});
				throw error;
			}
		);

		return new StreamedPHPResponse(
			headers.stream,
			stdout.stream,
			stderr.stream,
			exitCodePromise
		);
	}

	/**
	 * Recursively creates a directory with the given path in the PHP filesystem.
	 * For example, if the path is `/root/php/data`, and `/root` already exists,
	 * it will create the directories `/root/php` and `/root/php/data`.
	 *
	 * @param  path - The directory path to create.
	 */
	mkdir(path: string) {
		const result = FSHelpers.mkdir(this[__private__dont__use].FS, path);
		this.dispatchEvent({ type: 'filesystem.write' });
		return result;
	}

	/**
	 * @deprecated Use mkdir instead.
	 */
	mkdirTree(path: string) {
		return FSHelpers.mkdir(this[__private__dont__use].FS, path);
	}

	/**
	 * Reads a file from the PHP filesystem and returns it as a string.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	readFileAsText(path: string) {
		return FSHelpers.readFileAsText(this[__private__dont__use].FS, path);
	}

	/**
	 * Reads a file from the PHP filesystem and returns it as an array buffer.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	readFileAsBuffer(path: string): Uint8Array {
		return FSHelpers.readFileAsBuffer(this[__private__dont__use].FS, path);
	}

	/**
	 * Overwrites data in a file in the PHP filesystem.
	 * Creates a new file if one doesn't exist yet.
	 *
	 * @param  path - The file path to write to.
	 * @param  data - The data to write to the file.
	 */
	writeFile(path: string, data: string | Uint8Array) {
		const result = FSHelpers.writeFile(
			this[__private__dont__use].FS,
			path,
			data
		);
		this.dispatchEvent({ type: 'filesystem.write' });
		return result;
	}

	/**
	 * Removes a file from the PHP filesystem.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to remove.
	 */
	unlink(path: string) {
		const result = FSHelpers.unlink(this[__private__dont__use].FS, path);
		this.dispatchEvent({ type: 'filesystem.write' });
		return result;
	}

	/**
	 * Moves a file or directory in the PHP filesystem to a
	 * new location.
	 *
	 * @param oldPath The path to rename.
	 * @param newPath The new path.
	 */
	mv(fromPath: string, toPath: string) {
		const result = FSHelpers.mv(
			this[__private__dont__use].FS,
			fromPath,
			toPath
		);
		this.dispatchEvent({ type: 'filesystem.write' });
		return result;
	}

	/**
	 * Removes a directory from the PHP filesystem.
	 *
	 * @param path The directory path to remove.
	 * @param options Options for the removal.
	 */
	rmdir(path: string, options: RmDirOptions = { recursive: true }) {
		const result = FSHelpers.rmdir(
			this[__private__dont__use].FS,
			path,
			options
		);
		this.dispatchEvent({ type: 'filesystem.write' });
		return result;
	}

	/**
	 * Lists the files and directories in the given directory.
	 *
	 * @param  path - The directory path to list.
	 * @param  options - Options for the listing.
	 * @returns The list of files and directories in the given directory.
	 */
	listFiles(
		path: string,
		options: ListFilesOptions = { prependPath: false }
	) {
		return FSHelpers.listFiles(
			this[__private__dont__use].FS,
			path,
			options
		);
	}

	/**
	 * Checks if a directory exists in the PHP filesystem.
	 *
	 * @param  path – The path to check.
	 * @returns True if the path is a directory, false otherwise.
	 */
	isDir(path: string) {
		return FSHelpers.isDir(this[__private__dont__use].FS, path);
	}

	/**
	 * Checks if a file exists in the PHP filesystem.
	 *
	 * @param  path – The path to check.
	 * @returns True if the path is a file, false otherwise.
	 */
	isFile(path: string) {
		return FSHelpers.isFile(this[__private__dont__use].FS, path);
	}

	/**
	 * Creates a symlink in the PHP filesystem.
	 * @param target
	 * @param path
	 */
	symlink(target: string, path: string) {
		return FSHelpers.symlink(this[__private__dont__use].FS, target, path);
	}

	/**
	 * Checks if a path is a symlink in the PHP filesystem.
	 *
	 * @param path
	 * @returns True if the path is a symlink, false otherwise.
	 */
	isSymlink(path: string) {
		return FSHelpers.isSymlink(this[__private__dont__use].FS, path);
	}

	/**
	 * Reads the target of a symlink in the PHP filesystem.
	 *
	 * @param path
	 * @returns The target of the symlink.
	 */
	readlink(path: string) {
		return FSHelpers.readlink(this[__private__dont__use].FS, path);
	}

	/**
	 * Resolves the real path of a file in the PHP filesystem.
	 * @param path
	 * @returns The real path of the file.
	 */
	realpath(path: string) {
		return FSHelpers.realpath(this[__private__dont__use].FS, path);
	}

	/**
	 * Checks if a file (or a directory) exists in the PHP filesystem.
	 *
	 * @param  path - The file path to check.
	 * @returns True if the file exists, false otherwise.
	 */
	fileExists(path: string) {
		return FSHelpers.fileExists(this[__private__dont__use].FS, path);
	}

	/**
	 * Enables inline PHP runtime rotation after a certain number of requests
	 * or an internal crash.
	 */
	enableRuntimeRotation(options: {
		recreateRuntime: () => Promise<number> | number;
		maxRequests?: number;
	}) {
		this.#rotationOptions = {
			...this.#rotationOptions,
			enabled: true,
			recreateRuntime: options.recreateRuntime,
			maxRequests: options.maxRequests ?? 400,
		};
	}

	private async rotateRuntime() {
		if (!this.#rotationOptions.enabled) {
			throw new Error(
				'Runtime rotation is not enabled. Call enableRuntimeRotation() first.'
			);
		}
		await this.hotSwapPHPRuntime(
			await this.#rotationOptions.recreateRuntime()
		);
		this.#rotationOptions.requestsMade = 0;
		this.#rotationOptions.needsRotating = false;
	}

	/**
	 * Hot-swaps the PHP runtime for a new one without
	 * interrupting the operations of this PHP instance.
	 *
	 * @param runtime
	 */
	async hotSwapPHPRuntime(runtime: number) {
		// Once we secure the lock and have the new runtime ready,
		// the rest of the swap handler is synchronous to make sure
		// no other operations acts on the old runtime or FS.
		// If there was await anywhere here, we'd risk applyng
		// asynchronous changes to either the filesystem or the
		// old PHP runtime without propagating them to the new
		// runtime.

		const oldFS = this[__private__dont__use].FS;
		const oldRootLevelPaths = this.listFiles('/').map((file) => `/${file}`);
		const oldSpawnProcess = this[__private__dont__use].spawnProcess;

		// Temporarily set CWD to / and restore it at the end of this method.
		//
		// There's a chance cleaning up old mounts via mount.unmount()
		// will attempt removing the CWD. Normally, this would throw
		// FS.ErrnoError(10) EBUSY and interrupt the PHP runtime rotation,
		// leaving us in a broken state.
		//
		// Even though removing the CWD directory is not allowed by the
		// filesystem, we don't care that much here – we're merely freeing
		// all the resources allocated by the old filesystem before it's
		// garbage collected. We are about to recreate the same filesystem
		// structure and mounts in another PHP runtime.
		//
		// Therefore, let's suspend the strict EBUSY check by setting the CWD
		// to / for the cleanup purposes. We'll attempt to restore the original
		// CWD on the new runtime once we re-apply all the mounts there. We'll
		// only have a real reason to throw an error if the CWD path does not
		// exist in the new filesystem after the rotation.
		const oldCWD = oldFS.cwd();
		oldFS.chdir('/');

		// Remember mounts to apply to new runtime
		const mountHandlersToReapplyInOrder = Object.entries(this.#mounts).map(
			([vfsPath, mount]) => ({
				mountHandler: mount.mountHandler,
				vfsPath,
			})
		);

		// Unmount all the mount handlers in reverse order because each nested
		// mount depends upon the parent mount which preceded it.
		const mountsToUnmountInReverseOrder = Object.values(
			this.#mounts
		).reverse();
		for (const mount of mountsToUnmountInReverseOrder) {
			await mount.unmount();
		}

		// Kill the current runtime
		try {
			this.exit();
		} catch {
			// Ignore the exit-related exception
		}

		// Initialize the new runtime
		this.initializeRuntime(runtime);

		if (oldSpawnProcess) {
			this[__private__dont__use].spawnProcess = oldSpawnProcess;
		}

		if (this.#sapiName) {
			this.setSapiName(this.#sapiName);
		}

		/**
		 * Ensure the new PHP instance has the same file structure as the old one.
		 *
		 * Catch: The underlying filesystems may be completely separate but they may be
		 * partially shared via NODEFS or PROXYFS mounts. We need to be careful and only
		 * recreate the MEMFS directories that aren't already shared – otherwise we'll
		 * write data to shared paths that other, concurrent workers may be using.
		 */
		const newFs = this[__private__dont__use].FS;
		for (const path of oldRootLevelPaths) {
			// The /request directory holds per-request state that is isolated to a
			// single PHP instance. Let's not copy it.
			if (path && path !== '/request') {
				copyMEMFSNodes(oldFS, newFs, path);
			}
		}

		// Re-mount all the mount handlers in order
		for (const { mountHandler, vfsPath } of mountHandlersToReapplyInOrder) {
			this.mkdir(vfsPath);
			await this.mount(vfsPath, mountHandler);
		}
		try {
			newFs.chdir(oldCWD);
		} catch (e) {
			throw new Error(
				`Failed to restore CWD to ${oldCWD} after PHP runtime rotation.`,
				{
					cause: e,
				}
			);
		}
	}

	/**
	 * Mounts a filesystem to a given path in the PHP filesystem.
	 *
	 * @param  virtualFSPath - Where to mount it in the PHP virtual filesystem.
	 * @param  mountHandler - The mount handler to use.
	 * @return Unmount function to unmount the filesystem.
	 */
	async mount(
		virtualFSPath: string,
		mountHandler: MountHandler
	): Promise<UnmountFunction> {
		const unmountCallback = await mountHandler(
			this,
			this[__private__dont__use].FS,
			virtualFSPath
		);
		const mountObject = {
			mountHandler,
			unmount: async () => {
				await unmountCallback();
				delete this.#mounts[virtualFSPath];
			},
		};
		this.#mounts[virtualFSPath] = mountObject;
		return () => {
			mountObject.unmount();
		};
	}

	/**
	 * Starts a PHP CLI session with given arguments.
	 *
	 * This method can only be used when PHP was compiled with the CLI SAPI
	 * and it cannot be used in conjunction with `run()`.
	 *
	 * Once this method finishes running, the PHP instance is no
	 * longer usable and should be discarded. This is because PHP
	 * internally cleans up all the resources and calls exit().
	 *
	 * @param  argv - The arguments to pass to the CLI.
	 * @returns The exit code of the CLI session.
	 */
	async cli(
		argv: string[],
		options: { env?: Record<string, string>; cwd?: string } = {}
	): Promise<StreamedPHPResponse> {
		if (basename(argv[0] ?? '') !== 'php') {
			return this.subProcess(argv, options);
		}

		if (this.#phpWasmInitCalled) {
			this.#rotationOptions.needsRotating = true;
		}

		const release = await this.semaphore.acquire();

		return await this.#executeWithErrorHandling(() => {
			const env = options.env || {};
			for (const [key, value] of Object.entries(env)) {
				this.#setEnv(key, value);
			}
			// Enforce the use of the internal php.ini file.
			argv = [argv[0], '-c', PHP_INI_PATH, ...argv.slice(1)];
			for (const arg of argv) {
				this[__private__dont__use].ccall(
					'wasm_add_cli_arg',
					null,
					[STRING],
					[arg]
				);
			}

			return this[__private__dont__use].ccall('run_cli', null, [], [], {
				async: true,
			});
		})
			.then((response) => {
				response.exitCode.finally(release);
				return response;
			})
			.finally(() => {
				this.#rotationOptions.needsRotating = true;
			});
	}

	/**
	 * Runs an arbitrary CLI command using the spawn handler associated
	 * with this PHP instance.
	 *
	 * @param argv
	 * @param options
	 * @returns StreamedPHPResponse.
	 */
	private async subProcess(
		argv: string[],
		options: { env?: Record<string, string>; cwd?: string } = {}
	): Promise<StreamedPHPResponse> {
		const process = this[__private__dont__use].spawnProcess(
			argv[0],
			argv.slice(1),
			{
				env: options.env,
				cwd: options.cwd ?? this.cwd(),
			}
		) as ChildProcess;

		const stderrStream = await createInvertedReadableStream<Uint8Array>();
		process.on('error', (error) => {
			stderrStream.controller.error(error);
		});
		process.stderr.on('data', (data) => {
			stderrStream.controller.enqueue(data);
		});

		const stdoutStream = await createInvertedReadableStream<Uint8Array>();
		process.stdout.on('data', (data) => {
			stdoutStream.controller.enqueue(data);
		});

		process.on('exit', () => {
			// Delay until next tick to ensure we don't close the streams before
			// emitting the error event on the stderrStream.
			setTimeout(() => {
				/**
				 * Ignore any close() errors, e.g. "stream already closed". We just
				 * need to try to call close() and forget about this subprocess.
				 */
				try {
					stderrStream.controller.close();
				} catch {
					// Ignore error
				}
				try {
					stdoutStream.controller.close();
				} catch {
					// Ignore error
				}
			}, 0);
		});

		return new StreamedPHPResponse(
			// Headers stream
			new ReadableStream({
				start(controller) {
					controller.close();
				},
			}),
			stdoutStream.stream,
			stderrStream.stream,
			// Exit code
			new Promise((resolve) => {
				process.on('exit', (code) => {
					resolve(code);
				});
			})
		);
	}

	setSkipShebang(shouldSkip: boolean) {
		this[__private__dont__use].ccall(
			'wasm_set_skip_shebang',
			null,
			[NUMBER],
			[shouldSkip ? 1 : 0]
		);
	}

	exit(code = 0) {
		this.dispatchEvent({
			type: 'runtime.beforeExit',
		});
		try {
			this[__private__dont__use]._exit(code);
		} catch {
			// ignore the exit error
		}

		// Clean up any initialized state
		this.#phpWasmInitCalled = false;

		// Delete any links between this PHP instance and the runtime
		this.#wasmErrorsTarget = null;

		if (this[__private__dont__use]) {
			delete this[__private__dont__use]['onMessage'];
			delete this[__private__dont__use];
		}
	}

	[Symbol.dispose]() {
		this.exit(0);
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

/**
 * Copies the MEMFS directory structure from one FS in another FS.
 * Non-MEMFS nodes are ignored.
 */
function copyMEMFSNodes(
	source: Emscripten.FileSystemInstance,
	target: Emscripten.FileSystemInstance,
	path: string
) {
	if (
		getNodeType(source, path) !== 'memfs' ||
		!['memfs', 'missing'].includes(getNodeType(target, path))
	) {
		return;
	}

	const oldNode = source.lookupPath(path);
	if (!source.isDir(oldNode.node.mode)) {
		target.writeFile(path, source.readFile(path));
		return;
	}

	target.mkdirTree(path);
	const filenames = source
		.readdir(path)
		.filter((name: string) => name !== '.' && name !== '..');
	for (const filename of filenames) {
		copyMEMFSNodes(source, target, joinPaths(path, filename));
	}
}

/**
 * Creates a readable stream with inverted control flow,
 * based on the specified underlying source.
 *
 * In this case, inverting control flow means exposing the controller
 * so the consumer can insert data into the stream.
 *
 * @param source - The underlying source to use.
 * @returns The resulting stream and its associated controller.
 */
async function createInvertedReadableStream<T = BufferSource>(
	source: UnderlyingSource<T> = {}
): Promise<{
	stream: ReadableStream<T>;
	controller: ReadableStreamDefaultController<T>;
}> {
	let controllerResolve: (
		controller: ReadableStreamDefaultController<T>
	) => void;
	const controllerPromise = new Promise<ReadableStreamDefaultController<T>>(
		(resolve) => {
			controllerResolve = resolve;
		}
	);

	const stream = new ReadableStream<T>({
		...source,
		start(controller) {
			// Type assertion to handle the controller type mismatch
			controllerResolve(controller as ReadableStreamDefaultController<T>);
			if (source.start) {
				return source.start(controller);
			}
			return undefined;
		},
	});

	const controller = await controllerPromise;

	return {
		stream,
		controller,
	};
}

const getNodeType = (fs: Emscripten.FileSystemInstance, path: string) => {
	try {
		const target = fs.lookupPath(path, { follow: true });
		return 'contents' in target.node
			? 'memfs'
			: /**
			   * Could be NODEFS, PROXYFS, etc.
			   */
			  'not-memfs';
	} catch {
		return 'missing';
	}
};
