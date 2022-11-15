import type { PHP, PHPOutput } from './php';

/**
 * A fake PHP server that handles HTTP requests but does not
 * bind to any port.
 *
 * @public
 * @example
 * ```js
 * import { createPHP, PHPServer } from 'php-wasm';
 *
 * const PHPLoaderModule = await import('/php.js');
 * const php = await createPHP(PHPLoaderModule);
 *
 * // Create a file to serve:
 * php.mkdirTree('/www');
 * php.writeFile('/www/index.php', '<?php echo "Hi from PHP!"; ');
 *
 * // Create a server instance:
 * const server = new PHPServer(php, {
 *     // PHP FS path to serve the files from:
 *     documentRoot: '/www',
 *
 *     // Used to populate $_SERVER['SERVER_NAME'] etc.:
 *     absoluteUrl: 'http://127.0.0.1'
 * });
 *
 * console.log(
 *    server.request({ path: '/index.php' }).body
 * );
 * // Output: "Hi from PHP!"
 * ```
 */
export class PHPServer {
	#DOCROOT: string;
	#PROTOCOL: string;
	#HOSTNAME: string;
	#PORT: number;
	#HOST: string;
	#PATHNAME: string;
	#ABSOLUTE_URL: string;

	/**
	 * The PHP instance
	 */
	php: PHP;
	#isStaticFilePath: (path: string) => boolean;

	/**
	 * @param  php    - The PHP instance.
	 * @param  config - Server configuration.
	 */
	constructor(php: PHP, config: PHPServerConfigation) {
		const {
			documentRoot = '/var/www/',
			absoluteUrl,
			isStaticFilePath = () => false,
		} = config;
		this.php = php;
		this.#DOCROOT = documentRoot;
		this.#isStaticFilePath = isStaticFilePath;

		const url = new URL(absoluteUrl);
		this.#HOSTNAME = url.hostname;
		this.#PORT = url.port
			? Number(url.port)
			: url.protocol === 'https:'
			? 443
			: 80;
		this.#PROTOCOL = (url.protocol || '').replace(':', '');
		const isNonStandardPort = this.#PORT !== 443 && this.#PORT !== 80;
		this.#HOST = [
			this.#HOSTNAME,
			isNonStandardPort ? `:${this.#PORT}` : '',
		].join('\n');
		this.#PATHNAME = url.pathname.replace(/\/+$/, '');
		this.#ABSOLUTE_URL = [
			`${this.#PROTOCOL}://`,
			this.#HOST,
			this.#PATHNAME,
		].join('');
	}

	/**
	 * The absolute URL of this PHPServer instance.
	 */
	get absoluteUrl() {
		return this.#ABSOLUTE_URL;
	}

	/**
	 * Serves the request – either by serving a static file, or by
	 * dispatching it to the PHP runtime.
	 *
	 * @param  request - The request.
	 * @returns The response.
	 */
	async request(request: PHPRequest): Promise<PHPResponse> {
		const serverPath = this.#withoutServerPathname(request.path);
		if (this.#isStaticFilePath(serverPath)) {
			return this.#serveStaticFile(serverPath);
		}
		return await this.#dispatchToPHP(request);
	}

	/**
	 * Serves a static file from the PHP filesystem.
	 *
	 * @param  path - The requested static file path.
	 * @returns The response.
	 */
	#serveStaticFile(path: string): PHPResponse {
		const fsPath = `${this.#DOCROOT}${path}`;

		if (!this.php.fileExists(fsPath)) {
			return {
				body: '404 File not found',
				headers: {},
				statusCode: 404,
				exitCode: 0,
				rawError: [''],
			};
		}
		const arrayBuffer = this.php.readFileAsBuffer(fsPath);
		return {
			body: arrayBuffer,
			headers: {
				'Content-length': `${arrayBuffer.byteLength}`,
				// @TODO: Infer the content-type from the arrayBuffer instead of the file path.
				//        The code below won't return the correct mime-type if the extension
				//        was tampered with.
				'Content-type': inferMimeType(fsPath),
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=0',
			},
			statusCode: 200,
			exitCode: 0,
			rawError: [''],
		};
	}

	/**
	 * Runs the requested PHP file with all the request and $_SERVER
	 * superglobals populated.
	 *
	 * @see #prepare_FILES for details on how JavaScript `files` are converted to $_FILES.
	 * @param  request - The request.
	 * @returns The response.
	 */
	async #dispatchToPHP(request: PHPRequest): Promise<PHPResponse> {
		const _FILES = await this.#prepare_FILES(request.files);

		try {
			const output = await this.php.run(`<?php
			/**
			 * Logs response headers, status code etc to stderr for parseResponse()
			 * to process.
			 * 
			 * This may seem like a weird way of capturing that data, however
			 * php.run() method only outputs information to either stdout or stderr.
			 * Stdout is already reserved for the regular output information, which makes
			 * stderr as the only available output.
			 */
			$stdErr = fopen('php://stderr', 'w');
			$errors = [];
			register_shutdown_function(function() use($stdErr){
				fwrite($stdErr, json_encode(['status_code', http_response_code()]) . "\n");
				fwrite($stdErr, json_encode(['session_id', session_id()]) . "\n");
				fwrite($stdErr, json_encode(['headers', headers_list()]) . "\n");
				fwrite($stdErr, json_encode(['errors', error_get_last()]) . "\n");
				if(isset($_SESSION)) {
                    fwrite($stdErr, json_encode(['session', $_SESSION]) . "\n");
                }
			});

			set_error_handler(function(...$args) use($stdErr){
				fwrite($stdErr, print_r($args,1));
			});
			error_reporting(E_ALL);

			/**
			 * Populate the superglobal variables so the requested file
			 * can read them.
			 */
			$request = (object) json_decode(<<<'REQUEST'
				${JSON.stringify({
					path: request.path,
					method: request.method || 'GET',
					headers: request.headers || {},
					queryString: request.queryString || '',
					_POST: request._POST || {},
					_FILES,
					_COOKIE: request._COOKIE || {},
					_SESSION: {},
				})}
REQUEST,
        JSON_OBJECT_AS_ARRAY
      );

			parse_str(substr($request->queryString, 1), $_GET);

			$_POST = $request->_POST;
			$_FILES = $request->_FILES;

			if ( !is_null($request->_COOKIE) ) {
				foreach ($request->_COOKIE as $key => $value) {
					fwrite($stdErr, 'Setting Cookie: ' . $key . " => " . $value . "\n");
					$_COOKIE[$key] = urldecode($value);
				}
			}

			$_SESSION = $request->_SESSION;

			foreach( $request->headers as $name => $value ) {
				$server_key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
				$_SERVER[$server_key] = $value;
			}

			fwrite($stdErr, json_encode(['session' => $_SESSION]) . "\n");

			$script  = ltrim($request->path, '/');

			$path = $request->path;
			$path = preg_replace('/^\\/php-wasm/', '', $path);

			$_SERVER['PATH']     = '/';
			$_SERVER['REQUEST_URI']     = $path . ($request->_GET ?: '');
			$_SERVER['REQUEST_METHOD']  = $request->method;
			$_SERVER['REMOTE_ADDR']     = ${JSON.stringify(this.#HOSTNAME)};
			$_SERVER['SERVER_NAME']     = ${JSON.stringify(this.#ABSOLUTE_URL)};
			$_SERVER['SERVER_PORT']     = ${JSON.stringify(this.#PORT)};
			$_SERVER['HTTPS']           = ${JSON.stringify(
				this.#ABSOLUTE_URL.startsWith('https://') ? 'on' : ''
			)};
			$_SERVER['HTTP_HOST']       = ${JSON.stringify(this.#HOST)};
			$_SERVER['HTTP_USER_AGENT'] = ${JSON.stringify(navigator.userAgent)};
			$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
			$_SERVER['DOCUMENT_ROOT']   = '/';
			$docroot = ${JSON.stringify(this.#DOCROOT)};
			$_SERVER['SCRIPT_FILENAME'] = $docroot . '/' . $script;
			$_SERVER['SCRIPT_NAME']     = $docroot . '/' . $script;
			$_SERVER['PHP_SELF']        = $docroot . '/' . $script;
			chdir($docroot);
			
			require_once ${JSON.stringify(this.#resolvePHPFilePath(request.path))};
		`);

			return parseResponse(output);
		} finally {
			this.#cleanup_FILES(_FILES);
		}
	}

	/**
	 * Resolve the requested path to the filesystem path of the requested PHP file.
	 *
	 * Fall back to index.php as if there was a url rewriting rule in place.
	 *
	 * @param  requestedPath - The requested pathname.
	 * @returns The resolved filesystem path.
	 */
	#resolvePHPFilePath(requestedPath: string): string {
		let filePath = this.#withoutServerPathname(requestedPath);

		// If the path mentions a .php extension, that's our file's path.
		if (filePath.includes('.php')) {
			filePath = filePath.split('.php')[0] + '.php';
		} else {
			// Otherwise, let's assume the file is $request_path/index.php
			if (!filePath.endsWith('/')) {
				filePath += '/';
			}
			if (!filePath.endsWith('index.php')) {
				filePath += 'index.php';
			}
		}

		const resolvedFsPath = `${this.#DOCROOT}${filePath}`;
		if (this.php.fileExists(resolvedFsPath)) {
			return resolvedFsPath;
		}
		return `${this.#DOCROOT}/index.php`;
	}

	/**
	 * Remove the server pathname from the requested path.
	 *
	 * This method enables including an arbitrary pathname
	 * in the server's absolute URL.
	 *
	 * For example, say the requestedPath is `/subdirectory/index.php`
	 *
	 * If the server's absolute URL is something like
	 * `http://localhost/`, this method returns the unchanged
	 * requestedPath.
	 *
	 * However, if the server's absolute URL is
	 * `http://localhost/subdirectory`, this method will return
	 * just `/index.php`.
	 *
	 * This way, PHPSerer can resolve just the `/index.php` instead
	 * of `/subdirectory/index.php` which is likely undesirable.
	 *
	 * @param  requestedPath - The requested path.
	 * @returns A path with the server prefix removed.
	 */
	#withoutServerPathname(requestedPath: string): string {
		if (!this.#PATHNAME) {
			return requestedPath;
		}
		return requestedPath.substr(this.#PATHNAME.length);
	}

	/**
	 * Prepares an object like { file1_name: File, ... } for
	 * being processed as $_FILES in PHP.
	 *
	 * In particular:
	 * * Creates the files in the filesystem
	 * * Allocates a global PHP rfc1867_uploaded_files HashTable
	 * * Registers the files in PHP's rfc1867_uploaded_files
	 * * Converts the JavaScript files object to the $_FILES data format like below
	 *
	 * Array(
	 *    [file1_name] => Array (
	 *       [name] => file_name.jpg
	 *       [type] => text/plain
	 *       [tmp_name] => /tmp/php/php1h4j1o (some path in the filesystem where the tmp file is kept for processing)
	 *       [error] => UPLOAD_ERR_OK  (= 0)
	 *       [size] => 123   (the size in bytes)
	 *    )
	 *    // ...
	 * )
	 *
	 * @param  files - JavaScript files keyed by their HTTP upload name.
	 * @returns $_FILES-compatible object.
	 */
	async #prepare_FILES(files: Record<string, File> = {}): Promise<_FILES> {
		if (Object.keys(files).length) {
			this.php.initUploadedFilesHash();
		}

		const _FILES: _FILES = {};
		for (const [key, value] of Object.entries(files)) {
			const tmpName = Math.random().toFixed(20);
			const tmpPath = `/tmp/${tmpName}`;
			// Need to read the blob and store it in the filesystem
			this.php.writeFile(
				tmpPath,
				new Uint8Array(await value.arrayBuffer())
			);
			_FILES[key] = {
				name: value.name,
				type: value.type,
				tmp_name: tmpPath,
				error: 0,
				size: value.size,
			};
			this.php.registerUploadedFile(tmpPath);
		}
		return _FILES;
	}

	/**
	 * Cleans up after #prepare_FILES:
	 * * Frees the PHP's rfc1867_uploaded_files HashTable
	 * * Removes the temporary files from the filesystem
	 *
	 * @param  _FILES - $_FILES-compatible object.
	 */
	#cleanup_FILES(_FILES: _FILES = {}) {
		if (Object.keys(_FILES).length) {
			this.php.destroyUploadedFilesHash();
		}
		for (const value of Object.values(_FILES)) {
			if (this.php.fileExists(value.tmp_name)) {
				this.php.unlink(value.tmp_name);
			}
		}
	}
}

/**
 * Turns the PHP output into a Response object.
 *
 * The response body is sourced from stdout, and
 * the headers and status code are sourced from stderr.
 *
 * @param  result - Raw output of PHP.run().
 * @returns Parsed response
 */
function parseResponse(result: PHPOutput): PHPResponse {
	const response = {
		body: result.stdout,
		headers: {},
		exitCode: result.exitCode,
		rawError: result.stderr || [''],
		statusCode: -1,
	};
	// Try to parse each line of stderr as JSON and
	// look for familiar data structurs.
	for (const row of result.stderr) {
		if (!row || !row.trim()) {
			continue;
		}
		try {
			const [name, value] = JSON.parse(row);
			if (name === 'headers') {
				response.headers = parseHeaders(value);
				break;
			}
			if (name === 'status_code') {
				response.statusCode = value;
			}
		} catch (e) {
			// console.error(e);
			// break;
		}
	}
	if (!response.statusCode) {
		response.statusCode = 200;
	}
	// X-frame-options gets in a way when PHP is
	// being displayed in an iframe.
	// @TODO: Make it configurable.
	delete response.headers['x-frame-options'];
	return response;
}

/**
 * Parse an array of raw HTTP header lines into
 * a key-value object.
 *
 * @example
 * ```js
 * parseHeaders(['Content-type: text/html', 'Content-length: 123'])
 * // { 'Content-type': ['text/html'], 'Content-length': [123] }
 * ```
 *
 * @param  rawHeaders - Raw HTTP header lines.
 * @returns Parsed headers.
 */
function parseHeaders(rawHeaders: string[]): PHPHeaders {
	const parsed = {};
	for (const header of rawHeaders) {
		const splitAt = header.indexOf(':');
		const [name, value] = [
			header.substring(0, splitAt).toLowerCase(),
			header.substring(splitAt + 2),
		];
		if (!(name in parsed)) {
			parsed[name] = [];
		}
		parsed[name].push(value);
	}
	return parsed;
}

/**
 * Naively infer a file mime type from its path.
 *
 * @todo Infer the mime type based on the file contents.
 *       A naive function like this one can be inaccurate
 *       and potentially have negative security consequences.
 *
 * @param  path - The file path
 * @returns The inferred mime type.
 */
function inferMimeType(path: string): string {
	const extension = path.split('.').pop();
	switch (extension) {
		case 'css':
			return 'text/css';
		case 'js':
			return 'application/javascript';
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'svg':
			return 'image/svg+xml';
		case 'woff':
			return 'font/woff';
		case 'woff2':
			return 'font/woff2';
		case 'ttf':
			return 'font/ttf';
		case 'otf':
			return 'font/otf';
		case 'eot':
			return 'font/eot';
		case 'ico':
			return 'image/x-icon';
		case 'html':
			return 'text/html';
		case 'json':
			return 'application/json';
		case 'xml':
			return 'application/xml';
		case 'txt':
		case 'md':
			return 'text/plain';
		default:
			return 'application-octet-stream';
	}
}

export interface PHPServerConfigation {
	/**
	 * The directory in the PHP filesystem where the server will look
	 * for the files to serve. Default: `/var/www`.
	 */
	documentRoot: string;
	/**
	 * Server URL. Used to populate $_SERVER details like HTTP_HOST.
	 */
	absoluteUrl: string;
	/**
	 * Callback used by the PHPServer to decide whether
	 * the requested path refers to a PHP file or a static file.
	 */
	isStaticFilePath?: (path: string) => boolean;
}

type PHPHeaders = Record<string, string>;

export interface PHPRequest {
	/**
	 * Request path without the query string.
	 */
	path: string;
	/**
	 * Request query string.
	 */
	queryString?: string;
	/**
	 * Request method. Default: `GET`.
	 */
	method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'PUT' | 'DELETE';
	/**
	 * Request headers.
	 */
	headers?: PHPHeaders;
	/**
	 * Request files in the `{"filename": File}` format.
	 */
	files?: Record<string, File>;
	/**
	 * POST data.
	 */
	_POST?: Record<string, any>;
	/**
	 * Request cookies.
	 */
	_COOKIE?: Record<string, string>;
}

export interface PHPResponse {
	/**
	 * Response body.
	 */
	body: string | ArrayBuffer;
	/**
	 * Response headers.
	 */
	headers: PHPHeaders;
	/**
	 * Response HTTP status code, e.g. 200.
	 */
	statusCode: number;
	/**
	 * PHP exit code. Always 0 for static file responses.
	 */
	exitCode: number;
	/**
	 * Lines logged to stderr. Always [''] for static file responses.
	 */
	rawError: string[];
}

type _FILES = Record<string, _FILE>;

interface _FILE {
	name: string;
	type: string;
	tmp_name: string;
	error: number;
	size: number;
}

export default PHPServer;
