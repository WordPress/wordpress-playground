import { Remote } from 'comlink';
import { PHPResponse } from './php-response';

/**
 * Represents an event related to the PHP request.
 */
export interface PHPRequestEndEvent {
	type: 'request.end';
}

/**
 * Represents an error event related to the PHP request.
 */
export interface PHPRequestErrorEvent {
	type: 'request.error';
	error: Error;
	source?: 'request' | 'php-wasm';
}

/**
 * Represents a PHP runtime initialization event.
 */
export interface PHPRuntimeInitializedEvent {
	type: 'runtime.initialized';
}

/**
 * Represents a PHP runtime destruction event.
 */
export interface PHPRuntimeBeforeDestroyEvent {
	type: 'runtime.beforedestroy';
}

/**
 * Represents an event related to the PHP instance.
 * This is intentionally not an extension of CustomEvent
 * to make it isomorphic between different JavaScript runtimes.
 */
export type PHPEvent =
	| PHPRequestEndEvent
	| PHPRequestErrorEvent
	| PHPRuntimeInitializedEvent
	| PHPRuntimeBeforeDestroyEvent;

/**
 * A callback function that handles PHP events.
 */
export type PHPEventListener = (event: PHPEvent) => void;

/**
 * Handles HTTP requests using PHP runtime as a backend.
 *
 * @public
 * @example Use PHPRequestHandler implicitly with a new PHP instance:
 * ```js
 * import { PHP } from '@php-wasm/web';
 *
 * const php = await PHP.load( '7.4', {
 *     requestHandler: {
 *         // PHP FS path to serve the files from:
 *         documentRoot: '/www',
 *
 *         // Used to populate $_SERVER['SERVER_NAME'] etc.:
 *         absoluteUrl: 'http://127.0.0.1'
 *     }
 * } );
 *
 * php.mkdirTree('/www');
 * php.writeFile('/www/index.php', '<?php echo "Hi from PHP!"; ');
 *
 * const response = await php.request({ path: '/index.php' });
 * console.log(response.text);
 * // "Hi from PHP!"
 * ```
 *
 * @example Explicitly create a PHPRequestHandler instance and run a PHP script:
 * ```js
 * import {
 *   loadPHPRuntime,
 *   PHP,
 *   PHPRequestHandler,
 *   getPHPLoaderModule,
 * } from '@php-wasm/web';
 *
 * const runtime = await loadPHPRuntime( await getPHPLoaderModule('7.4') );
 * const php = new PHP( runtime );
 *
 * php.mkdirTree('/www');
 * php.writeFile('/www/index.php', '<?php echo "Hi from PHP!"; ');
 *
 * const server = new PHPRequestHandler(php, {
 *     // PHP FS path to serve the files from:
 *     documentRoot: '/www',
 *
 *     // Used to populate $_SERVER['SERVER_NAME'] etc.:
 *     absoluteUrl: 'http://127.0.0.1'
 * });
 *
 * const response = server.request({ path: '/index.php' });
 * console.log(response.text);
 * // "Hi from PHP!"
 * ```
 */
export interface RequestHandler {
	/**
	 * Serves the request – either by serving a static file, or by
	 * dispatching it to the PHP runtime.
	 *
	 * The request() method mode behaves like a web server and only works if
	 * the PHP was initialized with a `requestHandler` option (which the online version
	 * of WordPress Playground does by default).
	 *
	 * In the request mode, you pass an object containing the request information
	 * (method, headers, body, etc.) and the path to the PHP file to run:
	 *
	 * ```ts
	 * const php = PHP.load('7.4', {
	 * 	requestHandler: {
	 * 		documentRoot: "/www"
	 * 	}
	 * })
	 * php.writeFile("/www/index.php", `<?php echo file_get_contents("php://input");`);
	 * const result = await php.request({
	 * 	method: "GET",
	 * 	headers: {
	 * 		"Content-Type": "text/plain"
	 * 	},
	 * 	body: "Hello world!",
	 * 	path: "/www/index.php"
	 * });
	 * // result.text === "Hello world!"
	 * ```
	 *
	 * The `request()` method cannot be used in conjunction with `cli()`.
	 *
	 * @example
	 * ```js
	 * const output = await php.request({
	 * 	method: 'GET',
	 * 	url: '/index.php',
	 * 	headers: {
	 * 		'X-foo': 'bar',
	 * 	},
	 * 	body: {
	 * 		foo: 'bar',
	 * 	},
	 * });
	 * console.log(output.stdout); // "Hello world!"
	 * ```
	 *
	 * @param  request - PHP Request data.
	 */
	request(request: PHPRequest, maxRedirects?: number): Promise<PHPResponse>;

	/**
	 * Converts a path to an absolute URL based at the PHPRequestHandler
	 * root.
	 *
	 * @param  path The server path to convert to an absolute URL.
	 * @returns The absolute URL.
	 */
	pathToInternalUrl(path: string): string;

	/**
	 * Converts an absolute URL based at the PHPRequestHandler to a relative path
	 * without the server pathname and scope.
	 *
	 * @param  internalUrl An absolute URL based at the PHPRequestHandler root.
	 * @returns The relative path.
	 */
	internalUrlToPath(internalUrl: string): string;

	/**
	 * The absolute URL of this PHPRequestHandler instance.
	 */
	absoluteUrl: string;

	/**
	 * The directory in the PHP filesystem where the server will look
	 * for the files to serve. Default: `/var/www`.
	 */
	documentRoot: string;
}

export interface IsomorphicLocalPHP extends RequestHandler {
	/**
	 * Sets the SAPI name exposed by the PHP module.
	 * @param newName - The new SAPI name.
	 */
	setSapiName(newName: string): void;

	/**
	 * Defines a constant in the PHP runtime.
	 * @param key - The name of the constant.
	 * @param value - The value of the constant.
	 */
	defineConstant(key: string, value: boolean | string | number | null): void;

	/**
	 * Adds an event listener for a PHP event.
	 * @param eventType - The type of event to listen for.
	 * @param listener - The listener function to be called when the event is triggered.
	 */
	addEventListener(
		eventType: PHPEvent['type'],
		listener: PHPEventListener
	): void;

	/**
	 * Removes an event listener for a PHP event.
	 * @param eventType - The type of event to remove the listener from.
	 * @param listener - The listener function to be removed.
	 */
	removeEventListener(
		eventType: PHPEvent['type'],
		listener: PHPEventListener
	): void;

	/**
	 * Sets the path to the php.ini file to use for the PHP instance.
	 *
	 * @param path - The path to the php.ini file.
	 */
	setPhpIniPath(path: string): void;

	/**
	 * Sets a value for a specific key in the php.ini file for the PHP instance.
	 *
	 * @param key - The key to set the value for.
	 * @param value - The value to set for the key.
	 */
	setPhpIniEntry(key: string, value: string): void;

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
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	readFileAsText(path: string): string;

	/**
	 * Reads a file from the PHP filesystem and returns it as an array buffer.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
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
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
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
	 * @param  options - Options for the listing.
	 * @returns The list of files and directories in the given directory.
	 */
	listFiles(path: string, options?: ListFilesOptions): string[];

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
	 * const result = await php.run(`<?php
	 *  $fp = fopen('php://stderr', 'w');
	 *  fwrite($fp, "Hello, world!");
	 * `);
	 * // result.errors === "Hello, world!"
	 * ```
	 *
	 * @param  options - PHP runtime options.
	 */
	run(options: PHPRunOptions): Promise<PHPResponse>;

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
	onMessage(listener: MessageListener): void;

	/**
	 * Registers a handler to spawns a child process when
	 * `proc_open()`, `popen()`, `exec()`, `system()`, or `passthru()`
	 * is called.
	 *
	 * @param handler Callback function to spawn a process.
	 */
	setSpawnHandler(handler: SpawnHandler | string): void;
}

export type MessageListener = (
	data: string
) => Promise<string | Uint8Array | void> | string | void;
interface EventEmitter {
	on(event: string, listener: (...args: any[]) => void): this;
	emit(event: string, ...args: any[]): boolean;
}
type ChildProcess = EventEmitter & {
	stdout: EventEmitter;
	stderr: EventEmitter;
};
export type SpawnHandler = (command: string, args: string[]) => ChildProcess;

export type IsomorphicRemotePHP = Remote<IsomorphicLocalPHP>;
export type UniversalPHP = IsomorphicLocalPHP | IsomorphicRemotePHP;

export type HTTPMethod =
	| 'GET'
	| 'POST'
	| 'HEAD'
	| 'OPTIONS'
	| 'PATCH'
	| 'PUT'
	| 'DELETE';
export type PHPRequestHeaders = Record<string, string>;
export interface PHPRequest {
	/**
	 * Request method. Default: `GET`.
	 */
	method?: HTTPMethod;

	/**
	 * Request path or absolute URL.
	 */
	url: string;

	/**
	 * Request headers.
	 */
	headers?: PHPRequestHeaders;

	/**
	 * Request body.
	 * If an object is given, the request will be encoded as multipart
	 * and sent with a `multipart/form-data` header.
	 */
	body?: string | Uint8Array | Record<string, string | Uint8Array | File>;
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
	 * Request body.
	 */
	body?: string | Uint8Array;

	/**
	 * Environment variables to set for this run.
	 */
	env?: Record<string, string>;

	/**
	 * The code snippet to eval instead of a php file.
	 */
	code?: string;
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

export interface RmDirOptions {
	/**
	 * If true, recursively removes the directory and all its contents.
	 * Default: true.
	 */
	recursive?: boolean;
}

export interface ListFilesOptions {
	/**
	 * If true, prepend given folder path to all file names.
	 * Default: false.
	 */
	prependPath: boolean;
}
