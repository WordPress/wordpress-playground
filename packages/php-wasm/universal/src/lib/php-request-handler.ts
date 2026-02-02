import { dirname, joinPaths } from '@php-wasm/util';
import {
	ensurePathPrefix,
	toRelativeUrl,
	removePathPrefix,
	DEFAULT_BASE_URL,
} from './urls';
import type { PHP, PHPExecutionFailureError } from './php';
import { normalizeHeaders } from './php';
import { PHPResponse } from './php-response';
import type { PHPRequest, PHPRunOptions } from './universal-php';
import { encodeAsMultipart } from './encode-as-multipart';
import type { PHPFactoryOptions } from './php-process-manager';
import { MaxPhpInstancesError, PHPProcessManager } from './php-process-manager';
import type { PHPInstanceManager, AcquiredPHP } from './php-instance-manager';
import { SinglePHPInstanceManager } from './single-php-instance-manager';
import { HttpCookieStore } from './http-cookie-store';
import mimeTypes from './mime-types.json';

export type RewriteRule = {
	match: RegExp;
	replacement: string;
};

export type FileNotFoundToResponse = {
	type: 'response';
	response: PHPResponse;
};
export type FileNotFoundToInternalRedirect = {
	type: 'internal-redirect';
	uri: string;
};
export type FileNotFoundTo404 = { type: '404' };

export type FileNotFoundAction =
	| FileNotFoundToResponse
	| FileNotFoundToInternalRedirect
	| FileNotFoundTo404;

export type FileNotFoundGetActionCallback = (
	relativePath: string
) => FileNotFoundAction;

/**
 * Interface for cookie storage implementations.
 * This allows different cookie handling strategies to be used with the PHP request handler.
 */
export interface CookieStore {
	/**
	 * Processes and stores cookies from response headers
	 * @param headers Response headers containing Set-Cookie directives
	 */
	rememberCookiesFromResponseHeaders(headers: Record<string, string[]>): void;

	/**
	 * Gets the cookie header string for the next request
	 * @returns Formatted cookie header string
	 */
	getCookieRequestHeader(): string;
}

interface BaseConfiguration {
	/**
	 * The directory in the PHP filesystem where the server will look
	 * for the files to serve. Default: `/var/www`.
	 */
	documentRoot?: string;
	/**
	 * Request Handler URL. Used to populate $_SERVER details like HTTP_HOST.
	 */
	absoluteUrl?: string;

	/**
	 * Rewrite rules
	 */
	rewriteRules?: RewriteRule[];

	/**
	 * A callback that decides how to handle a file-not-found condition for a
	 * given request URI.
	 */
	getFileNotFoundAction?: FileNotFoundGetActionCallback;
}

export type PHPRequestHandlerFactoryArgs = PHPFactoryOptions & {
	requestHandler: PHPRequestHandler;
};

export type PHPRequestHandlerConfiguration = BaseConfiguration & {
	cookieStore?: CookieStore | false;

	// One of the following must be provided:

	/**
	 * Provide a single PHP instance directly.
	 * PHPRequestHandler will create a SinglePHPInstanceManager internally.
	 * This is the simplest option for CLI contexts with a single PHP instance.
	 */
	php?: PHP;

	/**
	 * Provide a factory function to create PHP instances.
	 * PHPRequestHandler will create a PHPProcessManager internally.
	 */
	phpFactory?: (requestHandler: PHPRequestHandlerFactoryArgs) => Promise<PHP>;

	/**
	 * The maximum number of PHP instances that can exist at
	 * the same time. Only used when phpFactory is provided.
	 */
	maxPhpInstances?: number;
};

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
export class PHPRequestHandler implements AsyncDisposable {
	#DOCROOT: string;
	#PROTOCOL: string;
	#HOSTNAME: string;
	#PORT: number;
	#HOST: string;
	#PATHNAME: string;
	#ABSOLUTE_URL: string;
	#cookieStore: CookieStore | false;
	rewriteRules: RewriteRule[];
	/**
	 * The instance manager used for PHP instance lifecycle.
	 * This is either a provided instanceManager or a PHPProcessManager
	 * created from the phpFactory.
	 */
	instanceManager: PHPInstanceManager;
	getFileNotFoundAction: FileNotFoundGetActionCallback;

	/**
	 * The request handler needs to decide whether to serve a static asset or
	 * run the PHP interpreter. For static assets it should just reuse the primary
	 * PHP even if there's 50 concurrent requests to serve. However, for
	 * dynamic PHP requests, it needs to grab an available interpreter.
	 * Therefore, it cannot just accept PHP as an argument as serving requests
	 * requires access to ProcessManager.
	 *
	 * @param  php    - The PHP instance.
	 * @param  config - Request Handler configuration.
	 */
	constructor(config: PHPRequestHandlerConfiguration) {
		const {
			documentRoot = '/www/',
			absoluteUrl = typeof location === 'object'
				? location.href
				: DEFAULT_BASE_URL,
			rewriteRules = [],
			getFileNotFoundAction = () => ({ type: '404' }),
		} = config;

		const setChroot = (php: PHP) => {
			// Always set managed PHP's cwd to the document root.
			if (!php.isDir(documentRoot)) {
				php.mkdir(documentRoot);
			}
			php.chdir(documentRoot);

			// @TODO: Decouple PHP and request handler
			(php as any).requestHandler = this;
		};

		if (config.php) {
			setChroot(config.php);
			this.instanceManager = new SinglePHPInstanceManager({
				php: config.php,
			});
		} else if (config.phpFactory) {
			this.instanceManager = new PHPProcessManager({
				phpFactory: async (info) => {
					const php = await config.phpFactory!({
						...info,
						requestHandler: this,
					});
					setChroot(php);
					return php;
				},
				maxPhpInstances: config.maxPhpInstances,
			});
		} else {
			throw new Error(
				'Either php or phpFactory must be provided in the configuration.'
			);
		}

		/**
		 * By default, config.cookieStore is undefined, so we use the
		 * HttpCookieStore implementation, otherwise we use the one
		 * provided in the config.
		 *
		 * By explicitly checking for `undefined` we allow the user to pass
		 * `null` as config.cookieStore and disable the cookie store.
		 */
		this.#cookieStore =
			config.cookieStore === undefined
				? new HttpCookieStore()
				: config.cookieStore;
		this.#DOCROOT = documentRoot;

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
		this.rewriteRules = rewriteRules;
		this.getFileNotFoundAction = getFileNotFoundAction;
	}

	async getPrimaryPhp() {
		return await this.instanceManager.getPrimaryPhp();
	}

	/**
	 * Converts a path to an absolute URL based at the PHPRequestHandler
	 * root.
	 *
	 * @param  path The server path to convert to an absolute URL.
	 * @returns The absolute URL.
	 */
	pathToInternalUrl(path: string): string {
		if (!path.startsWith('/')) {
			path = `/${path}`;
		}
		return `${this.absoluteUrl}${path}`;
	}

	/**
	 * Converts an absolute URL based at the PHPRequestHandler to a relative path
	 * without the server pathname and scope.
	 *
	 * @param  internalUrl An absolute URL based at the PHPRequestHandler root.
	 * @returns The relative path.
	 */
	internalUrlToPath(internalUrl: string): string {
		const url = new URL(internalUrl, 'https://playground.internal');
		if (url.pathname.startsWith(this.#PATHNAME)) {
			url.pathname = url.pathname.slice(this.#PATHNAME.length);
		}
		return toRelativeUrl(url);
	}

	/**
	 * The absolute URL of this PHPRequestHandler instance.
	 */
	get absoluteUrl() {
		return this.#ABSOLUTE_URL;
	}

	/**
	 * The directory in the PHP filesystem where the server will look
	 * for the files to serve. Default: `/var/www`.
	 */
	get documentRoot() {
		return this.#DOCROOT;
	}

	/**
	 * Serves the request – either by serving a static file, or by
	 * dispatching it to the PHP runtime.
	 *
	 * The request() method mode behaves like a web server and only works if
	 * the PHP was initialized with a `requestHandler` option (which the online
	 * version of WordPress Playground does by default).
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
	async request(request: PHPRequest): Promise<PHPResponse> {
		const isAbsolute = looksLikeAbsoluteUrl(request.url);
		const originalRequestUrl = new URL(
			// Remove the hash part of the URL as it's not meant for the server.
			request.url.split('#')[0],
			isAbsolute ? undefined : DEFAULT_BASE_URL
		);

		const rewrittenRequestUrl = this.#applyRewriteRules(originalRequestUrl);
		const primaryPhp = await this.getPrimaryPhp();
		let fsPath = joinPaths(
			this.#DOCROOT,
			/**
			 * Turn a URL such as `https://playground/scope:my-site/wp-admin/index.php`
			 * into a site-relative path, such as `/wp-admin/index.php`.
			 */
			removePathPrefix(
				/**
				 * URL.pathname returns a URL-encoded path. We need to decode it
				 * before using it as a filesystem path.
				 */
				decodeURIComponent(rewrittenRequestUrl.pathname),
				this.#PATHNAME
			)
		);
		if (primaryPhp.isDir(fsPath)) {
			// Ensure directory URIs have a trailing slash. Otherwise,
			// relative URIs in index.php or index.html files are relative
			// to the next directory up.
			//
			// Example:
			// For an index page served for URI "/settings", we naturally expect
			// links to be relative to "/settings", but without the trailing
			// slash, a relative link "edit.php" resolves to "/edit.php"
			// rather than "/settings/edit.php".
			//
			// This treatment of relative links is correct behavior for the browser:
			// https://www.rfc-editor.org/rfc/rfc3986#section-5.2.3
			//
			// But user intent for `/settings/index.php` is that its relative
			// URIs are relative to `/settings/`. So we redirect to add a
			// trailing slash to directory URIs to meet this expecatation.
			//
			// This behavior is also necessary for WordPress to function properly.
			// Otherwise, when viewing the WP admin dashboard at `/wp-admin`,
			// links to other admin pages like `edit.php` will incorrectly
			// resolve to `/edit.php` rather than `/wp-admin/edit.php`.
			if (!fsPath.endsWith('/')) {
				return new PHPResponse(
					301,
					{ Location: [`${rewrittenRequestUrl.pathname}/`] },
					new Uint8Array(0)
				);
			}

			// We can only satisfy requests for directories with a default file
			// so let's first resolve to a default path when available.
			for (const possibleIndexFile of ['index.php', 'index.html']) {
				const possibleIndexPath = joinPaths(fsPath, possibleIndexFile);
				if (primaryPhp.isFile(possibleIndexPath)) {
					fsPath = possibleIndexPath;

					// Include the resolved index file in the final rewritten request URL.
					rewrittenRequestUrl.pathname = joinPaths(
						rewrittenRequestUrl.pathname,
						possibleIndexFile
					);
					break;
				}
			}
		}

		if (!primaryPhp.isFile(fsPath)) {
			/**
			 * Try resolving a partial path.
			 *
			 * Example:
			 *
			 * – Request URL: /file.php/index.php
			 * – Document Root: /var/www
			 *
			 * If /var/www/file.php/index.php does not exist, but /var/www/file.php does,
			 * use /var/www/file.php. This is also what Apache and PHP Dev Server do.
			 */
			let pathToTry = rewrittenRequestUrl.pathname;
			while (
				pathToTry.startsWith('/') &&
				pathToTry !== dirname(pathToTry)
			) {
				pathToTry = dirname(pathToTry);
				const resolvedPathToTry = joinPaths(this.#DOCROOT, pathToTry);
				if (
					primaryPhp.isFile(resolvedPathToTry) &&
					// Only run partial path resolution for PHP files.
					resolvedPathToTry.endsWith('.php')
				) {
					fsPath = joinPaths(this.#DOCROOT, pathToTry);
					break;
				}
			}
		}

		if (!primaryPhp.isFile(fsPath)) {
			const fileNotFoundAction = this.getFileNotFoundAction(
				rewrittenRequestUrl.pathname
			);
			switch (fileNotFoundAction.type) {
				case 'response':
					return fileNotFoundAction.response;
				case 'internal-redirect':
					fsPath = joinPaths(this.#DOCROOT, fileNotFoundAction.uri);
					break;
				case '404':
					return PHPResponse.forHttpCode(404);
				default:
					throw new Error(
						'Unsupported file-not-found action type: ' +
							// Cast because TS asserts the remaining possibility is `never`
							`'${
								(fileNotFoundAction as FileNotFoundAction).type
							}'`
					);
			}
		}

		// We need to confirm that the current target file exists because
		// file-not-found fallback actions may redirect to non-existent files.
		if (primaryPhp.isFile(fsPath)) {
			if (fsPath.endsWith('.php')) {
				const response = await this.#spawnPHPAndDispatchRequest(
					request,
					originalRequestUrl,
					rewrittenRequestUrl,
					fsPath
				);

				/**
				 * If the response is but the exit code is non-zero, let's rewrite the
				 * HTTP status code as 500. We're acting as a HTTP server here and
				 * this behavior is in line with what Nginx and Apache do.
				 */
				if (response.ok() && response.exitCode !== 0) {
					return new PHPResponse(
						500,
						response.headers,
						response.bytes,
						response.errors,
						response.exitCode
					);
				}
				return response;
			} else {
				return this.#serveStaticFile(primaryPhp, fsPath);
			}
		} else {
			return PHPResponse.forHttpCode(404);
		}
	}

	/**
	 * Apply the rewrite rules to the original request URL.
	 *
	 * @param originalRequestUrl - The original request URL.
	 * @returns The rewritten request URL.
	 */
	#applyRewriteRules(originalRequestUrl: URL): URL {
		const siteRelativePath = removePathPrefix(
			decodeURIComponent(originalRequestUrl.pathname),
			this.#PATHNAME
		);
		const rewrittenRequestPath = applyRewriteRules(
			siteRelativePath,
			this.rewriteRules
		);
		const rewrittenRequestUrl = new URL(
			joinPaths(this.#PATHNAME, rewrittenRequestPath),
			originalRequestUrl.toString()
		);
		// Merge the query string parameters from the original request URL.
		for (const [key, value] of originalRequestUrl.searchParams.entries()) {
			rewrittenRequestUrl.searchParams.append(key, value);
		}
		return rewrittenRequestUrl;
	}

	/**
	 * Serves a static file from the PHP filesystem.
	 *
	 * @param  fsPath - Absolute path of the static file to serve.
	 * @returns The response.
	 */
	#serveStaticFile(php: PHP, fsPath: string): PHPResponse {
		const arrayBuffer = php.readFileAsBuffer(fsPath);
		return new PHPResponse(
			200,
			{
				'content-length': [`${arrayBuffer.byteLength}`],
				// @TODO: Infer the content-type from the arrayBuffer instead of the
				// file path. The code below won't return the correct mime-type if the
				// extension was tampered with.
				'content-type': [inferMimeType(fsPath)],
				'accept-ranges': ['bytes'],
				'cache-control': ['public, max-age=0'],
			},
			arrayBuffer
		);
	}

	/**
	 * Spawns a new PHP instance and dispatches a request to it.
	 */
	async #spawnPHPAndDispatchRequest(
		request: PHPRequest,
		originalRequestUrl: URL,
		rewrittenRequestUrl: URL,
		scriptPath: string
	): Promise<PHPResponse> {
		let spawnedPHP: AcquiredPHP | undefined = undefined;
		try {
			spawnedPHP = await this.instanceManager!.acquirePHPInstance();
		} catch (e) {
			if (e instanceof MaxPhpInstancesError) {
				return PHPResponse.forHttpCode(502);
			} else {
				return PHPResponse.forHttpCode(500);
			}
		}
		try {
			return await this.#dispatchToPHP(
				spawnedPHP.php,
				request,
				originalRequestUrl,
				rewrittenRequestUrl,
				scriptPath
			);
		} finally {
			spawnedPHP.reap();
		}
	}

	/**
	 * Runs the requested PHP file with all the request and $_SERVER
	 * superglobals populated.
	 *
	 * @param  request - The request.
	 * @returns The response.
	 */
	async #dispatchToPHP(
		php: PHP,
		request: PHPRequest,
		originalRequestUrl: URL,
		rewrittenRequestUrl: URL,
		scriptPath: string
	): Promise<PHPResponse> {
		let preferredMethod: PHPRunOptions['method'] = 'GET';

		const headers: Record<string, string> = {
			host: this.#HOST,
			...normalizeHeaders(request.headers || {}),
		};
		if (this.#cookieStore) {
			headers['cookie'] = this.#cookieStore.getCookieRequestHeader();
		}

		let body = request.body;
		if (typeof body === 'object' && !(body instanceof Uint8Array)) {
			preferredMethod = 'POST';
			const { bytes, contentType } = await encodeAsMultipart(body);
			body = bytes;
			headers['content-type'] = contentType;
		}

		try {
			const response = await php.run({
				relativeUri: ensurePathPrefix(
					toRelativeUrl(new URL(rewrittenRequestUrl.toString())),
					this.#PATHNAME
				),
				protocol: this.#PROTOCOL,
				method: request.method || preferredMethod,
				$_SERVER: this.prepare_$_SERVER_superglobal(
					originalRequestUrl,
					rewrittenRequestUrl,
					scriptPath
				),
				body,
				scriptPath,
				headers,
			});
			if (this.#cookieStore) {
				this.#cookieStore.rememberCookiesFromResponseHeaders(
					response.headers
				);
			}

			return response;
		} catch (error) {
			const executionError = error as PHPExecutionFailureError;
			if (executionError?.response) {
				return executionError.response;
			}
			throw error;
		}
	}

	/**
	 * Computes the essential $_SERVER entries for a request.
	 *
	 * php_wasm.c sets some defaults, assuming it runs as a CLI script.
	 * This function overrides them with the values correct in the request
	 * context.
	 *
	 * @TODO: Consolidate the $_SERVER setting logic into a single place instead
	 *        of splitting it between the C SAPI and the TypeScript code. The PHP
	 *        class has a `.cli()` method that could take care of the CLI-specific
	 *        $_SERVER values.
	 *
	 * Path and URL-related $_SERVER entries are theoretically documented
	 * at https://www.php.net/manual/en/reserved.variables.server.php,
	 * but that page is not very helpful in practice. Here are tables derived
	 * by interacting with PHP servers:
	 *
	 * ## PHP Dev Server
	 *
	 * Setup:
	 *   – `/home/adam/subdir/script.php` file contains `<?php phpinfo(); ?>`
	 *   – `php -S 127.0.0.1:8041` running in `/home/adam` directory
	 *   – A request is sent to `http://127.0.0.1:8041/subdir/script.php/b.php/c.php`
	 *
	 * Results:
	 *
	 * $_SERVER['REQUEST_URI']    | `/subdir/script.php/b.php/c.php`
	 * $_SERVER['SCRIPT_NAME']    | `/subdir/script.php`
	 * $_SERVER['SCRIPT_FILENAME']| `/home/adam/subdir/script.php`
	 * $_SERVER['PATH_INFO']      | `/b.php/c.php`
	 * $_SERVER['PHP_SELF']       | `/subdir/script.php/b.php/c.php`
	 *
	 * ## Apache – rewriting rules
	 *
	 * Setup:
	 *   – `/var/www/html/subdir/script.php` file contains `<?php phpinfo(); ?>`
	 *   – Apache is listening on port 8041
	 *   – The document root is `/var/www/html`
	 *   – A request is sent to `http://127.0.0.1:8041/api/v1/user/123`
	 *
	 * .htaccess file:
	 *
	 * ```apache
	 * RewriteEngine On
	 * RewriteRule ^api/v1/user/([0-9]+)$ /subdir/script.php?endpoint=user&id=$1 [L,QSA]
	 * ```
	 *
	 * Results:
	 *
	 * ```
	 * $_SERVER['REQUEST_URI']             | /api/v1/user/123
	 * $_SERVER['SCRIPT_NAME']             | /subdir/script.php
	 * $_SERVER['SCRIPT_FILENAME']         | /var/www/html/subdir/script.php
	 * $_SERVER['PATH_INFO']               | (key not set)
	 * $_SERVER['PHP_SELF']                | /subdir/script.php
	 * $_SERVER['QUERY_STRING']            | endpoint=user&id=123
	 * $_SERVER['REDIRECT_STATUS']         | 200
	 * $_SERVER['REDIRECT_URL']            | /api/v1/user/123
	 * $_SERVER['REDIRECT_QUERY_STRING']   | endpoint=user&id=123
	 * === $_GET Variables ===
	 * $_GET['endpoint']                   | user
	 * $_GET['id']                         | 123
	 * ```
	 *
	 * ## Apache – vanilla request
	 *
	 * Setup:
	 *    – The same as above.
	 *    – A request sent http://localhost:8041/subdir/script.php?param=value
	 *
	 * Results:
	 *
	 * ```
	 * $_SERVER['REQUEST_URI']     | /subdir/script.php?param=value
	 * $_SERVER['SCRIPT_NAME']     | /subdir/script.php
	 * $_SERVER['SCRIPT_FILENAME'] | /var/www/html/subdir/script.php
	 * $_SERVER['PATH_INFO']       | (key not set)
	 * $_SERVER['PHP_SELF']        | /subdir/script.php
	 * $_SERVER['REDIRECT_URL']    | (key not set)
	 * $_SERVER['REDIRECT_STATUS'] | (key not set)
	 * $_SERVER['QUERY_STRING']    | param=value
	 * $_SERVER['REQUEST_METHOD']  | GET
	 * $_SERVER['DOCUMENT_ROOT']   | /var/www/html
	 *
	 * === $_GET Variables ===
	 * $_GET['param']              | value
	 * ```
	 */
	private prepare_$_SERVER_superglobal(
		originalRequestUrl: URL,
		rewrittenRequestUrl: URL,
		resolvedScriptPath: string
	): Record<string, string> {
		const $_SERVER: Record<string, string> = {
			REMOTE_ADDR: '127.0.0.1',
			DOCUMENT_ROOT: this.#DOCROOT,
			HTTPS: this.#ABSOLUTE_URL.startsWith('https://') ? 'on' : '',
		};

		/**
		 * REQUEST_URI
		 *
		 * The original path + query string extracted from the requested URL
		 * **before** applying any URL rewriting.
		 */
		$_SERVER['REQUEST_URI'] =
			originalRequestUrl.pathname + originalRequestUrl.search;

		if (resolvedScriptPath.startsWith(this.#DOCROOT)) {
			/**
			 * SCRIPT_NAME
			 *
			 * > Contains the current script's path. This is useful for pages
			 * > which need to point to themselves.
			 *
			 * Filesystem path of the script relative to the document root.
			 * Note this is a filesystem path so URL rewriting is not applicable here.
			 */
			$_SERVER['SCRIPT_NAME'] = resolvedScriptPath.substring(
				this.#DOCROOT.length
			);

			/**
			 * PHP_SELF – the path sourced from the final **request URL** after the
			 * rewrite rules have been applied.
			 *
			 * php.net documentation is very misleading on this one:
			 *
			 * > The filename of the currently executing script, relative
			 * > to the document root. For instance, $_SERVER['PHP_SELF']
			 * > in a script at the address http://example.com/foo/bar.php
			 * > would be /foo/bar.php.
			 *
			 * @see https://www.php.net/manual/en/reserved.variables.server.php#:~:text=PHP_SELF
			 *
			 * This is not what Apache, nor what the PHP dev server do:
			 *
			 * – Document Root: /var/www
			 * – Script file:   /var/www/subdir/script.php
			 * – Requesting     /subdir/script.php/b.php/c.php
			 *
			 *   $_SERVER['PHP_SELF'] = "/subdir/script.php/b.php/c.php"
			 *
			 * So, in that regard, it is a URL path, not a filesystem path.
			 *
			 * When URL rewriting is involved, it's the same.
			 *
			 * Consider this Apache example from above:
			 *
			 * – Document Root: /var/www/html
			 * – Script file:   /var/www/html/subdir/script.php
			 * – Rewrite rule:  ^api/v1/user/([0-9]+)$ /subdir/script.php?endpoint=user&id=$1 [L,QSA]
			 * – Requesting     /api/v1/user/123
			 *
			 *   $_SERVER['PHP_SELF'] = "/subdir/script.php"
			 *
			 * So, on the face value, this is a filesystem path. However, see
			 * what happens if we slightly modify that rewrite rule to:
			 *
			 * – Rewrite rule:  ^api/v1/user/([0-9]+)$ /subdir/script.php/next.php
			 *                                                           ^^^^^^^^^
			 * – Requesting     /api/v1/user/123
			 *
			 *   $_SERVER['PHP_SELF'] = "/subdir/script.php/next.php"
			 *
			 * So:
			 * * PHP_SELF is not sourced from the filesystem path.
			 * * PHP_SELF is sourced from the final request URL after the
			 *   rewrite rules have been applied.
			 */
			$_SERVER['PHP_SELF'] = rewrittenRequestUrl.pathname;

			/**
			 * PATH_INFO
			 *
			 * > Contains any client-provided pathname information trailing the actual
			 * > script filename but preceding the query string, if available. For instance,
			 * > if the current script was accessed via the URI http://www.example.com/php/path_info.php/some/stuff?foo=bar,
			 * > then $_SERVER['PATH_INFO'] would contain /some/stuff.
			 *
			 * This **does not** include the query string.
			 *
			 * @see https://www.php.net/manual/en/reserved.variables.server.php#:~:text=PATH_INFO
			 */
			if ($_SERVER['REQUEST_URI'].startsWith($_SERVER['SCRIPT_NAME'])) {
				$_SERVER['PATH_INFO'] = $_SERVER['REQUEST_URI'].substring(
					$_SERVER['SCRIPT_NAME'].length
				);
				// Remove the query string if present.
				if ($_SERVER['PATH_INFO'].includes('?')) {
					$_SERVER['PATH_INFO'] = $_SERVER['PATH_INFO'].substring(
						0,
						$_SERVER['PATH_INFO'].indexOf('?')
					);
				}
			}
		}

		/**
		 * QUERY_STRING
		 *
		 * The query string from the original and rewritten request URLs.
		 * Does not include the leading question mark.
		 *
		 * Note it contains all the query parameters from the original
		 * URL merged with the new parameters from the rewritten request URLs.
		 *
		 * Example:
		 *    – Original request URL: /pretty/url?foo=bar&page=different-value
		 *    – Rewritten request URL: /pretty/url?page=pretty
		 *    – QUERY_STRING: page=pretty&foo=bar&page=different-value
		 */
		$_SERVER['QUERY_STRING'] = rewrittenRequestUrl.search.substring(1);

		/**
		 * There's a few relevant entries we are NOT setting here:
		 *
		 *    – SCRIPT_FILENAME: Absolute path to the script file. It is set by
		 *      php_wasm.c.
		 *    – REDIRECT_STATUS: Apache sets it, but it's optional so we skip it.
		 *    – REDIRECT_URL: Apache sets it, but it's optional so we skip it.
		 *    – REDIRECT_QUERY_STRING: Apache sets it, but it's optional so we skip it.
		 */
		return $_SERVER;
	}

	async [Symbol.asyncDispose]() {
		await this.instanceManager[Symbol.asyncDispose]();
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
export function inferMimeType(path: string): string {
	const extension = path.split('.').pop() as keyof typeof mimeTypes;
	// @TODO: Consider not sending a default mime type to let the browser guess
	return mimeTypes[extension] || mimeTypes['_default'];
}

/**
 * Applies the given rewrite rules to the given path.
 *
 * @param  path  The path to apply the rules to.
 * @param  rules The rules to apply.
 * @returns The path with the rules applied.
 */
export function applyRewriteRules(path: string, rules: RewriteRule[]): string {
	for (const rule of rules) {
		if (new RegExp(rule.match).test(path)) {
			path = path.replace(rule.match, rule.replacement);
			break;
		}
	}
	return path;
}

/**
 * Checks if the given URL looks like an absolute URL.
 *
 * @param url - The URL to check.
 * @returns `true` if the URL looks like an absolute URL, `false` otherwise.
 */
function looksLikeAbsoluteUrl(url: string): boolean {
	try {
		// NOTE: We could just use URL.canParse() but are avoiding it here
		// because we've seen users with older Safari versions that don't support it.
		// Maybe Playground will break in other ways for them,
		// but since this is an easy, low-risk change, let's give it a try.
		new URL(url);
		return true;
	} catch {
		return false;
	}
}
