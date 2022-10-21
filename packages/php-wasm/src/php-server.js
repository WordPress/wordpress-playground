if (process.env.BUILD_PLATFORM === 'node') {
	// Polyfill missing node.js features
	import('xmlhttprequest').then(({ XMLHttpRequest }) => {
		global.XMLHttpRequest = XMLHttpRequest;
	});
	global.atob = function (data) {
		return Buffer.from(data).toString('base64');
	};
}

export default class PHPServer {
	DOCROOT;
	SCHEMA;
	HOSTNAME;
	PORT;
	HOST;
	PATHNAME;
    ABSOLUTE_URL;

    constructor(php, {
        documentRoot = '/var/www/',
        absoluteUrl,
        isStaticFile = () => false,
        beforeRequest = (request, server) => '',
    }) {
        this.php = php;
        this.DOCROOT = documentRoot;
        this.isStaticFile = isStaticFile;
        this.beforeRequest = beforeRequest;

        const url = new URL(absoluteUrl);
        this.HOSTNAME = url.hostname;
        this.PORT = url.port ? url.port : url.protocol === 'https:' ? 443 : 80;
        this.SCHEMA = (url.protocol || '').replace(':', '');
        this.HOST = `${this.HOSTNAME}:${this.PORT}`;
        this.PATHNAME = url.pathname.replace(/\/+$/, '');
        this.ABSOLUTE_URL = `${this.SCHEMA}://${this.HOSTNAME}:${this.PORT}${this.PATHNAME}`;
    }

	async request(request) {
		if(this.isStaticFile(request.path)) {
			return this.serveStaticFile(request.path);
		} else {
			return await this.dispatchToPHP(request);
		}
	}

	serveStaticFile(requestedPath) {
		const fsPath = `${this.DOCROOT}${requestedPath.substr(this.PATHNAME.length)}`;

		if(!this.php.pathExists(fsPath)){
			return {
				body: '404 File not found',
				headers: {},
				statusCode: 404,
				exitCode: 0,
				rawError: '',
			}
		}
		const arrayBuffer = this.php.readFile(fsPath);
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
			rawError: '',
		};
	}

	async dispatchToPHP(request) {
		const _FILES = await this.prepare_FILES(request.files);
        try {
			const output = await this.php.run( `<?php
			${ this._setupErrorReportingCode() }
			${ this._setupRequestCode( {
				...request,
				_FILES
            }) }
            ${ this._requireRequestHandler(request) }
		` );

			return this.parseResponse( output );
		} finally {
			this.cleanup_FILES( _FILES );
		}
    }

    _requireRequestHandler(request) {
		const phpFilePath = this.resolvePHPFilePath(request.path);
        return `
        // Ensure the resolved path points to an existing file. If not,
        // let's fall back to index.php
        $candidate_path = '${this.DOCROOT}/' . ltrim('${phpFilePath}', '/');
        if ( file_exists( $candidate_path ) ) {
            require_once $candidate_path;
        } else {
            require_once '${this.DOCROOT}/index.php';
        }
        `;        
    }
    
    resolvePHPFilePath(requestedPath) {
        let filePath = requestedPath;
		if (this.PATHNAME) {
			filePath = filePath.substr(this.PATHNAME.length);
        }
        
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
        return filePath;
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
	async prepare_FILES(files = {}) {
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
	 * Cleans up after prepare_FILES:
	 * * Frees the PHP's rfc1867_uploaded_files HashTable
	 * * Removes the temporary files from the filesystem
	 *
	 * @param _FILES $_FILES-compatible object.
	 */
	cleanup_FILES(_FILES={}) {
		if(Object.keys(_FILES).length) {
			this.php.destroyUploadedFilesHash();
		}
		for (const [, value] of Object.entries(_FILES)) {
			if(this.php.pathExists(value.tmp_name)){
				this.php.unlink(value.tmp_name);
			}
		}
	}

	parseResponse(result) {
		const response = {
			body: result.stdout,
			headers: {},
			exitCode: result.exitCode,
			rawError: result.stderr,
		};
		for (const row of result.stderr) {
			if (!row || !row.trim()) {
				continue;
			}
			try {
				const [name, value] = JSON.parse(row);
				if (name === 'headers') {
					response.headers = this.parseHeaders(value);
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

	parseHeaders(rawHeaders) {
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

	_setupErrorReportingCode() {
		return `
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
		`;
	}

	_setupRequestCode({
		path = '/',
		method = 'GET',
		headers,
		_GET = '',
		_POST = {},
		_FILES = {},
		_COOKIE = {},
		_SESSION = {},
	} = {}) {
		const request = {
			path,
			method,
			headers,
			_GET,
			_POST,
			_FILES,
			_COOKIE,
			_SESSION,
		};

		const https = this.ABSOLUTE_URL.startsWith('https://') ? 'on' : '';
        return `
            ${this.beforeRequest(request, this)}

			$request = (object) json_decode(<<<'REQUEST'
        ${JSON.stringify(request)}
REQUEST,
        JSON_OBJECT_AS_ARRAY
      );

			parse_str(substr($request->_GET, 1), $_GET);

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

			ini_set('session.save_path', '/home/web_user');
			session_id('fake-cookie');
			session_start();

			fwrite($stdErr, json_encode(['session' => $_SESSION]) . "\n");

			$docroot = '${this.DOCROOT}';

			$script  = ltrim($request->path, '/');

			$path = $request->path;
			$path = preg_replace('/^\\/php-wasm/', '', $path);

			$_SERVER['PATH']     = '/';
			$_SERVER['REQUEST_URI']     = $path . ($request->_GET ?: '');
			$_SERVER['HTTP_HOST']       = '${this.HOST}';
			$_SERVER['REMOTE_ADDR']     = '${this.HOSTNAME}';
			$_SERVER['SERVER_NAME']     = '${this.ABSOLUTE_URL}';
			$_SERVER['SERVER_PORT']     = ${this.PORT};
			$_SERVER['HTTP_USER_AGENT'] = ${JSON.stringify(navigator.userAgent)};
			$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
			$_SERVER['REQUEST_METHOD']  = $request->method;
			$_SERVER['SCRIPT_FILENAME'] = $docroot . '/' . $script;
			$_SERVER['SCRIPT_NAME']     = $docroot . '/' . $script;
			$_SERVER['PHP_SELF']        = $docroot . '/' . $script;
			$_SERVER['DOCUMENT_ROOT']   = '/';
			$_SERVER['HTTPS']           = '${https}';
			chdir($docroot);
		`;
	}

}

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
