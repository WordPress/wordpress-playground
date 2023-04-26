import { Remote } from 'comlink';
import { PHPResponse } from './php-response';

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
	setPhpIniPath(path: string): void;
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
	 * @param  options - PHP run options.
	 */
	run(options: PHPRunOptions): Promise<PHPResponse>;
}

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
	 * Uploaded files
	 */
	files?: Record<string, File>;

	/**
	 * Request body without the files.
	 */
	body?: string;

	/**
	 * Form data. If set, the request body will be ignored and
	 * the content-type header will be set to `application/x-www-form-urlencoded`.
	 */
	formData?: Record<string, unknown>;
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

export interface FileInfo {
	key: string;
	name: string;
	type: string;
	data: Uint8Array;
}

export interface RmDirOptions {
	/**
	 * If true, recursively removes the directory and all its contents.
	 * Default: true.
	 */
	recursive?: boolean;
}
