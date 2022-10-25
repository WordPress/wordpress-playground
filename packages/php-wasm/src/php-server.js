
/**
 * @typedef {Object} PHPServerConfigation
 * @property {string} documentRoot The directory in the PHP filesystem where the server will look 
 *                                 for the files to serve. Default: `/var/www`.
 * @property {string} absoluteUrl Server URL. Used to populate $_SERVER details like HTTP_HOST.
 * @property {(path: string) => boolean} isStaticFilePath Optional. Callback used by the PHPServer to decide whether
 *                                                        the requested path refers to a PHP file or a static file.
 */

/**
 * @typedef {Object.<string, string>} Headers
 */
/**
 * @typedef {Object} Request
 * @property {string} path Request path without the query string.
 * @property {string} queryString Optional. Request query string.
 * @property {"GET"|"POST"|"HEAD"|"OPTIONS"|"PATCH"|"PUT"|"DELETE"} method Optional. Request method. Default: `GET`.
 * @property {Headers} headers Optional. Request headers.
 * @property {Object.<string, File>} files Optional. Request files in the {"filename": File} format.
 * @property {Object.<string, any>} _POST Optional. POST data.
 * @property {Object.<string, string>} _COOKIE Optional. Request cookies.
 */

/**
 * @typedef {Object} Response
 * @property {string|ArrayBuffer} body Response body.
 * @property {Headers} headers Response headers.
 * @property {number} exitCode PHP exit code. Always 0 for static file responses.
 * @property {string[]} rawError Lines logged to stderr. Always [''] for static file responses.
 */

/**
 * A fake PHP server that handles HTTP requests but does not
 * bind to any port.
 */
export default class PHPServer {
	#DOCROOT;
	#PROTOCOL;
	#HOSTNAME;
	#PORT;
	#HOST;
	#PATHNAME;
    #ABSOLUTE_URL;

	/**
	 * @param {PHP} php PHP instance.
	 * @param {PHPServerConfigation} config Server configuration.
	 */
    constructor(php, {
        documentRoot = '/var/www/',
        absoluteUrl,
        isStaticFilePath = () => false
    }) {
        this.php = php;
        this.#DOCROOT = documentRoot;
        this.isStaticFilePath = isStaticFilePath;

        const url = new URL(absoluteUrl);
        this.#HOSTNAME = url.hostname;
        this.#PORT = url.port ? url.port : url.protocol === 'https:' ? 443 : 80;
        this.#PROTOCOL = (url.protocol || '').replace(':', '');
        this.#HOST = `${this.#HOSTNAME}:${this.#PORT}`;
        this.#PATHNAME = url.pathname.replace(/\/+$/, '');
        this.#ABSOLUTE_URL = `${this.#PROTOCOL}://${this.#HOSTNAME}:${this.#PORT}${this.#PATHNAME}`;
    }

	/**
	 * Serves the request – either by serving a static file, or by
	 * dispatching it to the PHP runtime.
	 * 
	 * @param {Request} request The request.
	 * @returns {Response} The response.
	 */
	async request(request) {
		const serverPath = this.#withoutServerPathname(request.path);
		if(this.isStaticFilePath(serverPath)) {
			return this.#serveStaticFile(serverPath);
		} else {
			return await this.#dispatchToPHP(request);
		}
	}

	/**
	 * Serves a static file from the PHP filesystem.
	 * 
	 * @param {string} path The requested static file path.
	 * @returns {Response} The response.
	 */
	#serveStaticFile(path) {
		const fsPath = `${this.#DOCROOT}${path}`;

		if(!this.php.fileExists(fsPath)){
			return {
				body: '404 File not found',
				headers: {},
				statusCode: 404,
				exitCode: 0,
				rawError: [''],
			}
		}
		const arrayBuffer = this.php.readFileAsBuffer(fsPath);
		return {
			body: arrayBuffer,
			headers: {
				'Content-length': arrayBuffer.byteLength,
				// @TODO: Infer the content-type from the arrayBuffer instead of the file path.
				//        The code below won't return the correct mime-type if the extension
				//        was tampered with.
				'Content-type': inferMimeType(fsPath),
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=0'
			},
			exitCode: 0,
			rawError: [''],
		};
	}

	/**
	 * Runs the requested PHP file with all the request and $_SERVER
	 * superglobals populated.
	 * 
	 * @see #prepare_FILES for details on how JavaScript `files` are converted to $_FILES.
	 * @param {Request} request The request.
	 * @returns {Response} The response.
	 */
	async #dispatchToPHP(request) {
		const _FILES = await this.#prepare_FILES(request.files);

        try {
			const output = await this.php.run( `<?php
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
					_SESSION: {}
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
			$_SERVER['HTTPS']           = ${JSON.stringify(this.#ABSOLUTE_URL.startsWith('https://') ? 'on' : '')};
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
		` );

			return parseResponse( output );
		} finally {
			this.#cleanup_FILES( _FILES );
		}
    }
    
	/**
	 * Resolve the requested path to the filesystem path of the requested PHP file.
	 * 
	 * Fall back to index.php as if there was a url rewriting rule in place.
	 * 
	 * @param {string} requestedPath The requested pathname.
	 * @returns {string} The resolved filesystem path.
	 */
    #resolvePHPFilePath(requestedPath) {
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
		} else {
			return `${this.#DOCROOT}/index.php`;
		}
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
	 * @param {string} requestedPath The requested path.
	 * @returns {string} A path with the server prefix removed.
	 */
	#withoutServerPathname(requestedPath) {
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
	 * @param {Object} files JavaScript files keyed by their HTTP upload name.
	 * @return $_FILES-compatible object.
	 */
	async #prepare_FILES(files = {}) {
		if(Object.keys(files).length) {
			this.php.initUploadedFilesHash();
		}

		const _FILES = {};
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
	 * @param _FILES $_FILES-compatible object.
	 */
	#cleanup_FILES(_FILES={}) {
		if(Object.keys(_FILES).length) {
			this.php.destroyUploadedFilesHash();
		}
		for (const [, value] of Object.entries(_FILES)) {
			if(this.php.fileExists(value.tmp_name)){
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
 * @param {import("./php").Output} result Raw output of PHP.run().
 * @returns {Response} Parsed response
 */
function parseResponse(result) {
	const response = {
		body: result.stdout,
		headers: {},
		exitCode: result.exitCode,
		rawError: result.stderr || [''],
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
 * @param {string[]} rawHeaders Raw HTTP header lines.
 * @returns {Headers} Parsed headers.
 */
function parseHeaders(rawHeaders) {
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
 * @param {string} path The file path
 * @returns {string} The inferred mime type.
 */
function inferMimeType(path) {
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
