import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import * as url from 'url';

import setup from './node-php-web.js';
import { fileURLToPath } from 'node:url';

const STR = 'string';
const NUM = 'number';

export class PHP {
	_initPromise;
	call;

	stdout = [];
	stderr = [];

	async init() {
		if ( this._initPromise ) {
			return this._initPromise;
		}

		this._initPromise = setup( {
		  locateFile( name ) {
				return fileURLToPath( new URL( `./node-php-web.wasm`, import.meta.url ) );
			},
			onAbort( reason ) {
				console.error( 'WASM aborted: ' );
				console.error( reason );
			},
			print: ( ...chunks ) => {
				this.stdout.push( ...chunks );
			},
			printErr: ( ...chunks ) => {
				this.stderr.push( ...chunks );
			},
			onPreInit( FS, NODEFS ) {
				FS.mkdirTree( '/usr/local/etc' );
				FS.mount( NODEFS, { root: '../shared/etc' }, '/usr/local/etc' );
				FS.mkdirTree( '/preload/wordpress' );
				FS.mount( NODEFS, { root: '../wasm-build-pipeline/wordpress-data/preload/wordpress' }, '/preload/wordpress' );
			},
		} ).then( ( { ccall } ) => {
			ccall( 'pib_init', NUM, [ STR ], [] );
			this.call = ccall;
		} );
		return this._initPromise;
	}

	async run( code ) {
		if ( ! this.call ) {
			throw new Error( `Run init() first!` );
		}
		return new Promise( ( resolve ) => {
			const exitCode = this.call( 'pib_run', NUM, [ STR ], [ `?>${ code }` ] );
			const response = {
				exitCode,
				stdout: this.stdout.join( '\n' ),
				stderr: this.stderr,
			};
			this.clear();
			resolve( response );
		} );
	}

	clear() {
		if ( ! this.call ) {
			throw new Error( `Run init() first!` );
		}
		this.call( 'pib_refresh', NUM, [], [] );
		this.stdout = [];
		this.stderr = [];
	}
}

class WP {
	DOCROOT = '/preload/wordpress';
	SCHEMA = 'http';
	HOSTNAME = 'localhost';
	PORT = 8777;
	HOST = `${ this.HOSTNAME }:${ this.PORT }`;
	ABSOLUTE_URL = `${ this.SCHEMA }://${ this.HOSTNAME }:${ this.PORT }`;

	constructor( php ) {
		this.php = php;
	}

	async init( urlString ) {
		const url = new URL( urlString );
		this.HOSTNAME = url.hostname;
		this.PORT = url.port ? url.port : url.protocol === 'https:' ? 443 : 80;
		this.SCHEMA = ( url.protocol || '' ).replace( ':', '' );
		this.HOST = `${ this.HOSTNAME }:${ this.PORT }`;
		this.ABSOLUTE_URL = `${ this.SCHEMA }://${ this.HOSTNAME }:${ this.PORT }`;

		const result = await this.php.run( `<?php
			${ this._setupErrorReportingCode() }
			${ this._patchWordPressCode() }
		` );
		if ( result.exitCode !== 0 ) {
			throw new Error(
				{
					message: 'WordPress setup failed',
					result,
				},
				result.exitCode,
			);
		}
		this.initialized = true;
	}

	async request( request ) {
		if ( ! this.initialized ) {
			throw new Error( 'call init() first' );
		}
		const output = await this.php.run( `<?php	
			${ this._setupErrorReportingCode() }
			${ this._setupRequestCode( request ) }
			${ this._runWordPressCode( request.path ) }
		` );
		return this.parseResponse( output );
	}

	parseResponse( result ) {
		const response = {
			body: result.stdout,
			headers: {},
			exitCode: result.exitCode,
			rawError: result.stderr,
		};
		for ( const row of result.stderr ) {
			if ( ! row || ! row.trim() ) {
				continue;
			}
			try {
				const [ name, value ] = JSON.parse( row );
				if ( name === 'headers' ) {
					response.headers = this.parseHeaders( value );
					break;
				}
			} catch ( e ) {
				// console.error(e);
				// break;
			}
		}
		// console.log(response.headers);
		delete response.headers[ 'x-frame-options' ];
		return response;
	}

	parseHeaders( rawHeaders ) {
		const parsed = {};
		for ( const header of rawHeaders ) {
			const splitAt = header.indexOf( ':' );
			const [ name, value ] = [
				header.substring( 0, splitAt ).toLowerCase(),
				header.substring( splitAt + 2 ),
			];
			if ( ! ( name in parsed ) ) {
				parsed[ name ] = [];
			}
			parsed[ name ].push( value );
		}
		return parsed;
	}

	_patchWordPressCode() {
		return `
		  file_put_contents( "${ this.DOCROOT }/.absolute-url", "${ this.ABSOLUTE_URL }" );
			if ( ! file_exists( "${ this.DOCROOT }/.wordpress-patched" ) ) {
				touch("${ this.DOCROOT }/.wordpress-patched");
				
				// WORKAROUND:
				// For some reason, the in-browser WordPress is eager to redirect the
				// browser to http://127.0.0.1 when the site URL is http://127.0.0.1:8000.
				// file_put_contents(
				// 	'${ this.DOCROOT }/wp-includes/canonical.php',
				// 	str_replace(
				// 		'function redirect_canonical( $requested_url = null, $do_redirect = true ) {',
				// 		'function redirect_canonical( $requested_url = null, $do_redirect = true ) {return;',
				// 		file_get_contents('${ this.DOCROOT }/wp-includes/canonical.php')
				// 	)
				// );

				// WORKAROUND:
				// For some reason, the in-browser WordPress doesn't respect the site
				// URL preset during the installation. Also, it disables the block editing
				// experience by default.
				file_put_contents(
					'${ this.DOCROOT }/wp-includes/plugin.php',
					file_get_contents('${ this.DOCROOT }/wp-includes/plugin.php') . "\n"
					.'add_filter( "option_home", function($url) { return file_get_contents("${ this.DOCROOT }/.absolute-url"); }, 10000 );' . "\n"
					.'add_filter( "option_siteurl", function($url) { return file_get_contents("${ this.DOCROOT }/.absolute-url"); }, 10000 );' . "\n"
				);

				// Activate the development plugin.
				$file_php_path = '${ this.DOCROOT }/wp-includes/functions.php';
				$file_php = file_get_contents($file_php_path);

				if (strpos($file_php, "start-test-snippet") !== false) {
					$file_php = substr($file_php, 0, strpos($file_php, "// start-test-snippet"));
				}

				$file_php .= <<<'ADMIN'
					// start-test-snippet
					add_action('init', function() {
						require_once '${ this.DOCROOT }/wp-admin/includes/plugin.php';
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
		`;
	}

	_setupErrorReportingCode() {
		return `
			$stdErr = fopen('php://stderr', 'w');
			$errors = [];
			register_shutdown_function(function() use($stdErr){
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

	_setupRequestCode( {
		path = '/wp-login.php',
		method = 'GET',
		headers,
		_GET = '',
		_POST = {},
		_COOKIE = {},
		_SESSION = {},
	} = {} ) {
		const request = {
			path,
			method,
			headers,
			_GET,
			_POST,
			_COOKIE,
			_SESSION,
		};

		// console.log( 'WP request', request );

		const https = this.ABSOLUTE_URL.startsWith( 'https://' ) ? 'on' : '';
		return `
			$request = (object) json_decode(
				'${ JSON.stringify( request ) }'
				, JSON_OBJECT_AS_ARRAY
			);
			
			parse_str(substr($request->_GET, 1), $_GET);
			
			$_POST = $request->_POST;

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
			
			$docroot = '${ this.DOCROOT }';
			
			$script  = ltrim($request->path, '/');
			
			$path = $request->path;
			$path = preg_replace('/^\\/php-wasm/', '', $path);
			
			$_SERVER['PATH']	 = '/';
			$_SERVER['REQUEST_URI']	 = $path;
			$_SERVER['HTTP_HOST']	   = '${ this.HOST }';
			$_SERVER['REMOTE_ADDR']	 = '${ this.HOSTNAME }';
			$_SERVER['SERVER_NAME']	 = '${ this.ABSOLUTE_URL }';
			$_SERVER['SERVER_PORT']	 = ${ this.PORT };
			$_SERVER['REQUEST_METHOD']  = $request->method;
			$_SERVER['SCRIPT_FILENAME'] = $docroot . '/' . $script;
			$_SERVER['SCRIPT_NAME']	 = $docroot . '/' . $script;
			$_SERVER['PHP_SELF']		= $docroot . '/' . $script;
			$_SERVER['DOCUMENT_ROOT']   = '/';
			$_SERVER['HTTPS']		   = '${ https }';
			chdir($docroot);
		`;
	}

	_runWordPressCode( path ) {
		return `
		require_once '${ this.DOCROOT }/' . ltrim('${ path }', '/');
		`;
	}
}

class WPBrowser {
	constructor( wp ) {
		this.wp = wp;
	}

	async request( path, method, postData = {}, requestHeaders = {}, cookies = {} ) {
		const parsedUrl = new URL( path, this.wp.ABSOLUTE_URL );
		let pathname = parsedUrl.pathname;
		// Fix the URLs not ending with .php
		if ( pathname.endsWith( '/' ) ) {
			pathname += 'index.php';
		}

		return await this.wp.request( {
			path: pathname,
			method,
			headers: requestHeaders,
			_GET: parsedUrl.search,
			_POST: postData,
			_COOKIE: cookies,
		} );
	}
}

async function createBrowser() {
	const php = new PHP();
	await php.init();
	const wp = new WP( php );
	const browser = new WPBrowser( wp );
	return browser;
}

const __filename = url.fileURLToPath( import.meta.url );
const __dirname = url.fileURLToPath( new URL( '.', import.meta.url ) );

const app = express();
app.use( cookieParser() );
app.use( bodyParser.urlencoded( { extended: true } ) );
const port = 9876;

const browserPromise = createBrowser();
app.all( '*', async ( req, res ) => {
	const browser = await browserPromise;
	if ( ! browser.wp.initialized ) {
		await browser.wp.init(
		  url.format( {
				protocol: req.protocol,
				host: req.get( 'host' ),
				pathname: req.originalUrl,
		  } ),
		);
	}
	if ( req.path.endsWith( '.php' ) || req.path.endsWith( '/' ) ) {
		const response = await ( await browser ).request(
		  req.url,
		  req.method,
		  req.body || {},
		  req.headers || {},
		  req.cookies || {},
		);
		for ( const [ key, value ] of Object.entries( response.headers ) ) {
		  res.setHeader( key, value );
		}
		if ( 'location' in response.headers ) {
		  res.status( 302 );
		  res.end();
		} else {
		  res.send( response.body );
		}
	} else {
		res.sendFile( `${ __dirname }/../public/${ req.path }` );
	}
} );

app.listen( port, async () => {
	console.log( `Example app listening on port ${ port }` );
} );
