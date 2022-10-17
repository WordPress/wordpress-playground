import { getPathQueryFragment, removeURLScope } from "../web/library.js";

if (typeof XMLHttpRequest === 'undefined') {
	// Polyfill missing node.js features
	import('xmlhttprequest').then(({ XMLHttpRequest }) => {
		global.XMLHttpRequest = XMLHttpRequest;
	});
	global.atob = function (data) {
		return Buffer.from(data).toString('base64');
	};
}
export default class WordPress {
	DOCROOT = '/preload/wordpress';
	SCHEMA = 'http';
	HOSTNAME = 'localhost';
	PORT = 80;
	HOST = '';
	PATHNAME = '';
	ABSOLUTE_URL = ``;

	constructor(php) {
		this.php = php;
	}

	async init(urlString, options = {}) {
		this.options = {
			useFetchForRequests: false,
			...options,
		};
		const url = new URL(urlString);
		this.HOSTNAME = url.hostname;
		this.PORT = url.port ? url.port : url.protocol === 'https:' ? 443 : 80;
		this.SCHEMA = (url.protocol || '').replace(':', '');
		this.HOST = `${this.HOSTNAME}:${this.PORT}`;
		this.PATHNAME = url.pathname.replace(/\/+$/, '');
		this.ABSOLUTE_URL = `${this.SCHEMA}://${this.HOSTNAME}:${this.PORT}${this.PATHNAME}`;

		await this.php.refresh();

		const result = await this.php.run(`<?php
			${this._setupErrorReportingCode()}
			${this._patchWordPressCode()}
		`);
		this.initialized = true;
		if (result.exitCode !== 0) {
			throw new Error(
				{
					message: 'WordPress setup failed',
					result,
				},
				result.exitCode
			);
		}
	}

	async request(request) {
		if (!this.initialized) {
			throw new Error('call init() first');
		}

		const unscopedPath = getPathQueryFragment(
			removeURLScope(new URL(request.path, this.ABSOLUTE_URL))
		);

		// @TODO: Don't assume the uploads only live in /wp-content/uploads
		const isUploadsRequest = unscopedPath.startsWith('/wp-content/uploads');

		if(isUploadsRequest) {
			return await this.serveStaticFile(unscopedPath);
		} else {
			return await this.PHPRequest(request);
		}
	}

	async serveStaticFile(requestedPath) {
		const fsPath = `${this.DOCROOT}${requestedPath}`;

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

	async PHPRequest(request) {
		const _FILES = await this.prepare_FILES(request.files);
		try {
			const output = await this.php.run( `<?php
			${ this._setupErrorReportingCode() }
			${ this._setupRequestCode( {
				...request,
				_FILES
			} ) }
			${ this._runWordPressCode( request.path ) }
		` );

			return this.parseResponse( output );
		} finally {
			this.cleanup_FILES( _FILES );
		}
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

	_patchWordPressCode() {
		return `
			file_put_contents( "${this.DOCROOT}/.absolute-url", "${this.ABSOLUTE_URL}" );
			if ( ! file_exists( "${this.DOCROOT}/.wordpress-patched" ) ) {
				// Patching WordPress in the worker provides a faster feedback loop than
				// rebuilding it every time. Follow the example below to patch WordPress
				// before the first request is dispatched:
				//
				// file_put_contents(
				// 	'${this.DOCROOT}/wp-content/db.php',
				// 	str_replace(
				// 		'$exploded_parts = $values_data;',
				// 		'$exploded_parts = array( $values_data );',
				// 		file_get_contents('${this.DOCROOT}/wp-content/db.php')
				// 	)
				// );

				// WORKAROUND:
				// For some reason, the in-browser WordPress doesn't respect the site
				// URL preset during the installation. Also, it disables the block editing
				// experience by default.
				file_put_contents(
					'${this.DOCROOT}/wp-includes/plugin.php',
					file_get_contents('${this.DOCROOT}/wp-includes/plugin.php') . "\n"
					.'add_filter( "option_home", function($url) { return getenv("HOST") ?: file_get_contents(__DIR__ . "/../.absolute-url"); }, 10000 );' . "\n"
					.'add_filter( "option_siteurl", function($url) { return getenv("HOST") ?: file_get_contents(__DIR__."/../.absolute-url"); }, 10000 );' . "\n"
				);

				// DISABLE SITE HEALTH:
				file_put_contents(
					'${this.DOCROOT}/wp-includes/default-filters.php',
					preg_replace(
						'!add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;!i',
						'',
						file_get_contents('${this.DOCROOT}/wp-includes/default-filters.php')
					)
				);

				// WORKAROUND:
				// The fsockopen transport erroneously reports itself as a working transport. Let's force
				// it to report it won't work.
				file_put_contents(
					'${this.DOCROOT}/wp-includes/Requests/Transport/fsockopen.php',
					str_replace(
						'public static function test',
						'public static function test( $capabilities = array() ) { return false; } public static function test2',
						file_get_contents( '${this.DOCROOT}/wp-includes/Requests/Transport/fsockopen.php' )
					)
				);
				file_put_contents(
					'${this.DOCROOT}/wp-includes/Requests/Transport/cURL.php',
					str_replace(
						'public static function test',
						'public static function test( $capabilities = array() ) { return false; } public static function test2',
						file_get_contents( '${this.DOCROOT}/wp-includes/Requests/Transport/cURL.php' )
					)
				);
				
				mkdir( '${this.DOCROOT}/wp-content/mu-plugins' );
				file_put_contents(
					'${this.DOCROOT}/wp-content/mu-plugins/requests_transport_fetch.php',
<<<'PATCH'
<?php
class Requests_Transport_Fetch implements Requests_Transport { public $headers = ''; public function __construct() { } public function __destruct() { } public function request( $url, $headers = array(), $data = array(), $options = array() ) { if ( str_contains( $url, '/wp-cron.php' ) ) { return false; } $headers = Requests::flatten( $headers ); if ( ! empty( $data ) ) { $data_format = $options['data_format']; if ( $data_format === 'query' ) { $url = self::format_get( $url, $data ); $data = ''; } elseif ( ! is_string( $data ) ) { $data = http_build_query( $data, null, '&' ); } } $request = json_encode( json_encode( array( 'headers' => $headers, 'data' => $data, 'url' => $url, 'method' => $options['type'], ) ) );
$js = <<<JAVASCRIPT
const request = JSON.parse({$request});
console.log("Requesting " + request.url);
const xhr = new XMLHttpRequest();
xhr.open(
	request.method,
	request.url,
	false // false makes the xhr synchronous
);
xhr.withCredentials = false;
for ( var name in request.headers ) {
	if(name.toLowerCase() !== "content-type") {
		// xhr.setRequestHeader(name, request.headers[name]);
	}
}
xhr.send(request.data);

[
	"HTTP/1.1 " + xhr.status + " " + xhr.statusText,
	xhr.getAllResponseHeaders(),
	"",
	xhr.responseText
].join("\\\\r\\\\n");
JAVASCRIPT;
$this->headers = vrzno_eval( $js ); return $this->headers; } public function request_multiple( $requests, $options ) { $responses = array(); $class = get_class( $this ); foreach ( $requests as $id => $request ) { try { $handler = new $class(); $responses[ $id ] = $handler->request( $request['url'], $request['headers'], $request['data'], $request['options'] ); $request['options']['hooks']->dispatch( 'transport.internal.parse_response', array( &$responses[ $id ], $request ) ); } catch ( Requests_Exception $e ) { $responses[ $id ] = $e; } if ( ! is_string( $responses[ $id ] ) ) { $request['options']['hooks']->dispatch( 'multiple.request.complete', array( &$responses[ $id ], $id ) ); } } return $responses; } protected static function format_get( $url, $data ) { if ( ! empty( $data ) ) { $query = ''; $url_parts = parse_url( $url ); if ( empty( $url_parts['query'] ) ) { $url_parts['query'] = ''; } else { $query = $url_parts['query']; } $query .= '&' . http_build_query( $data, null, '&' ); $query = trim( $query, '&' ); if ( empty( $url_parts['query'] ) ) { $url .= '?' . $query; } else { $url = str_replace( $url_parts['query'], $query, $url ); } } return $url; } public static function test( $capabilities = array() ) { if ( ! function_exists( 'vrzno_eval' ) ) { return false; } if ( vrzno_eval( "typeof XMLHttpRequest;" ) !== 'function' ) {  return false; } return true; } }

if(defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	Requests::add_transport( 'Requests_Transport_Fetch' );
}
PATCH
				);

                if ( false ) {
                    // Activate the development plugin.
                    $file_php_path = '${this.DOCROOT}/wp-includes/functions.php';
                    $file_php = file_get_contents($file_php_path);

                    if (strpos($file_php, "start-test-snippet") !== false) {
                        $file_php = substr($file_php, 0, strpos($file_php, "// start-test-snippet"));
                    }

                    $file_php .= <<<'ADMIN'
                        // start-test-snippet
                        add_action('init', function() {
                            require_once '${this.DOCROOT}/wp-admin/includes/plugin.php';
                            $plugin = 'my-plugin/my-plugin.php';
                            if(!is_plugin_active($plugin)) {
                                $result = activate_plugin( $plugin, '', is_network_admin() );
                                if ( is_wp_error( $result ) ) {
                                    if ( 'unexpected_output' === $result->get_error_code() ) {
                                        var_dump($result->get_error_data());
                                        die();
                                    } else {
                                        wp_die( $result );
                                    }
                                }
                            }
                        });
                        // end-test-snippet
ADMIN;

                    file_put_contents(
                        $file_php_path,
                        $file_php
                    );
                }
				touch("${this.DOCROOT}/.wordpress-patched");
			}
		`;
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
		path = '/wp-login.php',
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
		console.log('Incoming request: ', request.path);

		const https = this.ABSOLUTE_URL.startsWith('https://') ? 'on' : '';
		return `
			define('USE_FETCH_FOR_REQUESTS', ${
				this.options.useFetchForRequests ? 'true' : 'false'
			});
			define('WP_HOME', '${this.DOCROOT}');
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

	_runWordPressCode(requestPath) {
		// Resolve the .php file the request should target.
		let filePath = requestPath;
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

		return `
		// The original version of this function crashes WASM WordPress, let's define an empty one instead.
		function wp_new_blog_notification(...$args){} 

		// Ensure the resolved path points to an existing file. If not,
		// let's fall back to index.php
		$candidate_path = '${this.DOCROOT}/' . ltrim('${filePath}', '/');
		if ( file_exists( $candidate_path ) ) {
			require_once $candidate_path;
		} else {
			require_once '${this.DOCROOT}/index.php';
		}
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
