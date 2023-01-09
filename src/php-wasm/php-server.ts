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
		].join('');
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
				body: new TextEncoder().encode('404 File not found'),
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

	async #dispatchToPHP2(
		request: PHPRequest,
		middlewares: (php: PHP, request: PHPRequest, next: () => {}) => Promise<PHPResponse | void>[
	): Promise<PHPResponse> {
		// Run all the middlewares
		let i = 0;
		const next = () => {
			const middleware = middlewares[i++];
			if (middleware) {
				return middleware(this.php, request, next);
			}
		};
		const response = await next();
		return response;
	}

	/**
	 * Runs the requested PHP file with all the request and $_SERVER
	 * superglobals populated.
	 *
	 * @param  request - The request.
	 * @returns The response.
	 */
	async #dispatchToPHP(request: PHPRequest): Promise<PHPResponse> {
		const hasUploadedFiles = Object.keys(request.files || {}).length > 0;

		const normalizedHeaders = {};
		if (request.headers) {
			for (const [name, value] of Object.entries(request.headers)) {
				normalizedHeaders[name.toLowerCase()] = value;
			}
		}

		let uploadedFiles: string[] = [];
		const isPostJson =
			normalizedHeaders?.['content-type'] === 'application/json';

		try {
			const requestBody = isPostJson
				? JSON.stringify(request._POST) || ''
				: new URLSearchParams(request._POST || {}).toString();
			this.php.initContext(requestBody);
			if (hasUploadedFiles) {
				this.php.initUploadedFilesHash();
			}
			this.php.run(`<?php
			/**
			 * Logs response headers, status code etc to stderr for parseResponse()
			 * to process.
			 * 
			 * This may seem like a weird way of capturing that data, however
			 * php.run() method only outputs information to either stdout or stderr.
			 * Stdout is already reserved for the regular output information, which makes
			 * stderr as the only available output.
			 */
			register_shutdown_function(function() use($stdErr){
				$headers = array();
				$headers_assoc = array();
				foreach($headers as $line) {
					$array = explode(':', $line);
					$headers_assoc[$array[0]] = trim($array[1]);
				}
				file_put_contents('/tmp/response.meta.json', json_encode([
					'statusCode' => http_response_code(),
					'sessionId' => session_id(),
					'headers' => $headers_assoc,
					'session' => $_SESSION
				]));
			});
			`);

			this.php.populateArrayFromRequestData('$_POST', request._POST);
			this.php.populateArrayFromRequestData(
				'$_GET',
				(request.queryString || '').substring(1)
			);
			if (hasUploadedFiles) {
				uploadedFiles = await this.php.preUploadFiles(request.files);
			}
			if (request._COOKIE) {
				const normalizedCookies = {};
				for (const [name, value] of Object.entries(request._COOKIE)) {
					normalizedCookies[name] = decodeURI(value);
				}
				this.php.populateArrayFromRequestData(
					'$_COOKIE',
					normalizedCookies
				);
			}

			const requestScript = request.path.replace(/^\/+/, '');
			const phpSelf = `${this.#DOCROOT}/${requestScript}`;
			const requestPath = requestScript.replace(/^\/php-wasm/, '');

			const phpServerData = {
				PATH: '/',
				REQUEST_URI: requestPath + (request.queryString || ''),
				REQUEST_METHOD: request.method,
				REMOTE_ADDR: this.#HOSTNAME,
				SERVER_NAME: this.#ABSOLUTE_URL,
				SERVER_PORT: this.#PORT,
				HTTPS: this.#ABSOLUTE_URL.startsWith('https://') ? 'on' : '',
				HTTP_HOST: this.#HOST,
				HTTP_USER_AGENT: navigator?.userAgent || '',
				SERVER_PROTOCOL: 'HTTP/1.1',
				DOCUMENT_ROOT: this.#DOCROOT,
				SCRIPT_FILENAME: phpSelf,
				SCRIPT_NAME: phpSelf,
				PHP_SELF: phpSelf,
			};
			for (const [name, value] of Object.entries(normalizedHeaders)) {
				phpServerData[`HTTP_${name.replace('-', '_').toUpperCase()}`] =
					value;
			}
			this.php.populateArray('$_SERVER', phpServerData);

			this.php.run(`<?php
				chdir($_SERVER['DOCUMENT_ROOT']);
				require_once ${JSON.stringify(this.#resolvePHPFilePath(request.path))};
			`);
			this.php.destroyContext();

			const output = this.php.getOutput() as any;
			const responseMetaText = this.php.readFileAsText(
				'/tmp/response.meta.json'
			);
			const responseMeta = responseMetaText
				? JSON.parse(responseMetaText)
				: {};
			const response = {
				body: output.stdout,
				headers: responseMeta.headers,
				exitCode: output.exitCode,
				rawError: output.stderr || [''],
				statusCode: responseMeta.statusCode,
			};

			// X-frame-options gets in a way when PHP is
			// being displayed in an iframe.
			// @TODO: Make it configurable.
			delete response.headers['x-frame-options'];
			return response;
		} finally {
			if (hasUploadedFiles) {
				this.php.destroyUploadedFilesHash();
				for (const filePath of uploadedFiles) {
					if (this.php.fileExists(filePath)) {
						this.php.unlink(filePath);
					}
				}
			}
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

async function PHPContextMiddleware(php: PHP, request: PHPRequest, next) {
	let isPostJson = false;
	if (request.headers) {
		for (const [name, value] of Object.entries(request.headers)) {
			if (name.toLowerCase() === 'content-type') {
				isPostJson = value === 'application/json';
				break;
			}
		}
	}
	const requestBody = isPostJson
		? JSON.stringify(request._POST) || ''
		: new URLSearchParams(request._POST || {}).toString();
	php.initContext(requestBody);

	await next();

	php.destroyContext();
}

async function fileUploadMiddleware(php: PHP, request: PHPRequest, next) {
	const hasUploadedFiles = Object.keys(request.files || {}).length > 0;
	if (!hasUploadedFiles) {
		return next();
	}

	let uploadedFiles: string[] = [];
	try {
		php.initUploadedFilesHash();
		uploadedFiles = await php.preUploadFiles(request.files!);
		await next();
	} finally {
		php.destroyUploadedFilesHash();
		for (const filePath of uploadedFiles) {
			if (php.fileExists(filePath)) {
				php.unlink(filePath);
			}
		}
	}
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
	body: ArrayBuffer;
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
