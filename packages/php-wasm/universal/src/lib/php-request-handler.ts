import { joinPaths } from '@php-wasm/util';
import {
	ensurePathPrefix,
	toRelativeUrl,
	removePathPrefix,
	DEFAULT_BASE_URL,
} from './urls';
import {
	BasePHP,
	PHPExecutionFailureError,
	normalizeHeaders,
} from './base-php';
import { PHPResponse } from './php-response';
import { PHPRequest, PHPRunOptions } from './universal-php';
import { encodeAsMultipart } from './encode-as-multipart';
import {
	MaxPhpInstancesError,
	PHPFactoryOptions,
	PHPProcessManager,
	SpawnedPHP,
} from './php-process-manager';
import { HttpCookieStore } from './http-cookie-store';
import mimeTypes from './mime-types.json';

export type RewriteRule = {
	match: RegExp;
	replacement: string;
};

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
}

export type PHPRequestHandlerFactoryArgs<PHP extends BasePHP> =
	PHPFactoryOptions & {
		requestHandler: PHPRequestHandler<PHP>;
	};

export type PHPRequestHandlerConfiguration<PHP extends BasePHP> =
	BaseConfiguration &
		(
			| {
					/**
					 * PHPProcessManager is required because the request handler needs
					 * to make a decision for each request.
					 *
					 * Static assets are served using the primary PHP's filesystem, even
					 * when serving 100 static files concurrently. No new PHP interpreter
					 * is ever created as there's no need for it.
					 *
					 * Dynamic PHP requests, however, require grabbing an available PHP
					 * interpreter, and that's where the PHPProcessManager comes in.
					 */
					processManager: PHPProcessManager<PHP>;
			  }
			| {
					phpFactory: (
						requestHandler: PHPRequestHandlerFactoryArgs<PHP>
					) => Promise<PHP>;
					/**
					 * The maximum number of PHP instances that can exist at
					 * the same time.
					 */
					maxPhpInstances?: number;
			  }
		);

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
export class PHPRequestHandler<PHP extends BasePHP> {
	#DOCROOT: string;
	#PROTOCOL: string;
	#HOSTNAME: string;
	#PORT: number;
	#HOST: string;
	#PATHNAME: string;
	#ABSOLUTE_URL: string;
	#cookieStore: HttpCookieStore;
	#remoteAssetPaths: Set<string>;
	rewriteRules: RewriteRule[];
	processManager: PHPProcessManager<PHP>;

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
	constructor(config: PHPRequestHandlerConfiguration<PHP>) {
		const {
			documentRoot = '/www/',
			absoluteUrl = typeof location === 'object' ? location?.href : '',
			rewriteRules = [],
		} = config;
		if ('processManager' in config) {
			this.processManager = config.processManager;
		} else {
			this.processManager = new PHPProcessManager({
				phpFactory: async (info) => {
					const php = await config.phpFactory!({
						...info,
						requestHandler: this,
					});
					// @TODO: Decouple PHP and request handler
					(php as any).requestHandler = this;
					return php;
				},
				maxPhpInstances: config.maxPhpInstances,
			});
		}
		this.#cookieStore = new HttpCookieStore();
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

		this.#remoteAssetPaths = new Set<string>();
	}

	async getPrimaryPhp() {
		return await this.processManager.getPrimaryPhp();
	}

	/**
	 * Converts a path to an absolute URL based at the PHPRequestHandler
	 * root.
	 *
	 * @param  path The server path to convert to an absolute URL.
	 * @returns The absolute URL.
	 */
	pathToInternalUrl(path: string): string {
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
		const url = new URL(internalUrl);
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
	async request(request: PHPRequest): Promise<PHPResponse> {
		const isAbsolute =
			request.url.startsWith('http://') ||
			request.url.startsWith('https://');
		const requestedUrl = new URL(
			// Remove the hash part of the URL as it's not meant for the server.
			request.url.split('#')[0],
			isAbsolute ? undefined : DEFAULT_BASE_URL
		);

		const normalizedRequestedPath = applyRewriteRules(
			removePathPrefix(
				decodeURIComponent(requestedUrl.pathname),
				this.#PATHNAME
			),
			this.rewriteRules
		);

		const primaryPhp = await this.getPrimaryPhp();

		// TODO: Convert default path conditional to helper function
		let fsPath = joinPaths(this.#DOCROOT, normalizedRequestedPath);

		// We can only satisfy requests for directories with a default file
		// so let's first resolve to a default path when available.
		if (primaryPhp.isDir(fsPath)) {
			if (!fsPath.endsWith('/')) {
				// TODO: Test redirect dir to trailing slash
				return new PHPResponse(
					301,
					{ Location: [`${requestedUrl.pathname}/`] },
					// TODO: Can we skip the body completely?
					new TextEncoder().encode('Moved Permanently')
				);
			}
			const localDefaultPath = joinPaths(fsPath, 'index.php');
			if (primaryPhp.isFile(localDefaultPath)) {
				fsPath = localDefaultPath;
			}
		}

		if (fsPath.endsWith('.php')) {
			if (primaryPhp.isFile(fsPath)) {
				// TODO: Test PHP file
				const effectiveRequest: PHPRequest = {
					...request,
					url: joinPaths(this.#ABSOLUTE_URL, fsPath),
				};
				return this.#spawnPHPAndDispatchRequest(
					effectiveRequest,
					requestedUrl
				);
			}
		} else {
			if (primaryPhp.isFile(fsPath)) {
				// TODO: Test serving static file
				return this.#serveStaticFile(primaryPhp, fsPath);
			} else if (
				// Make sure fsPath doesn't describe any other entity on the filesystem
				!primaryPhp.fileExists(fsPath) &&
				this.#remoteAssetPaths.has(fsPath)
			) {
				// TODO: Test known remote asset
				// This path is listed as a remote asset. Mark it as a static file
				// so the service worker knows it can issue a real fetch() to the server.
				return new PHPResponse(
					404,
					{ 'x-file-type': ['static'] },
					new TextEncoder().encode('404 File not found')
				);
			}
		}

		// TODO: Test delegate non-existent PHP file to WordPress
		// TODO: Test delegate non-existent other file to WordPress
		// Delegate unresolved requests to WordPress. This makes WP magic possible,
		// like pretty permalinks and dynamically generated sitemaps.
		const wpDefaultPath = joinPaths(this.#DOCROOT, 'index.php');
		const effectiveRequest: PHPRequest = {
			...request,
			url: joinPaths(this.#ABSOLUTE_URL, wpDefaultPath),
		};
		return this.#spawnPHPAndDispatchRequest(effectiveRequest, requestedUrl);
	}

	/**
	 * Serves a static file from the PHP filesystem.
	 *
	 * @param  fsPath - Absolute path of the static file to serve.
	 * @returns The response.
	 */
	#serveStaticFile(php: BasePHP, fsPath: string): PHPResponse {
		const arrayBuffer = php.readFileAsBuffer(fsPath);
		return new PHPResponse(
			200,
			{
				'content-length': [`${arrayBuffer.byteLength}`],
				// @TODO: Infer the content-type from the arrayBuffer instead of the file path.
				//        The code below won't return the correct mime-type if the extension
				//        was tampered with.
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
		requestedUrl: URL
	): Promise<PHPResponse> {
		let spawnedPHP: SpawnedPHP<PHP> | undefined = undefined;
		try {
			spawnedPHP = await this.processManager!.acquirePHPInstance();
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
				requestedUrl
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
		php: BasePHP,
		request: PHPRequest,
		requestedUrl: URL
	): Promise<PHPResponse> {
		let preferredMethod: PHPRunOptions['method'] = 'GET';

		const headers: Record<string, string> = {
			host: this.#HOST,
			...normalizeHeaders(request.headers || {}),
			cookie: this.#cookieStore.getCookieRequestHeader(),
		};

		let body = request.body;
		if (typeof body === 'object' && !(body instanceof Uint8Array)) {
			preferredMethod = 'POST';
			const { bytes, contentType } = await encodeAsMultipart(body);
			body = bytes;
			headers['content-type'] = contentType;
		}

		let scriptPath;
		try {
			scriptPath = this.#resolvePHPFilePath(
				php,
				decodeURIComponent(requestedUrl.pathname)
			);
		} catch (error) {
			return PHPResponse.forHttpCode(404);
		}

		try {
			const response = await php.run({
				relativeUri: ensurePathPrefix(
					toRelativeUrl(requestedUrl),
					this.#PATHNAME
				),
				protocol: this.#PROTOCOL,
				method: request.method || preferredMethod,
				$_SERVER: {
					REMOTE_ADDR: '127.0.0.1',
					DOCUMENT_ROOT: this.#DOCROOT,
					HTTPS: this.#ABSOLUTE_URL.startsWith('https://')
						? 'on'
						: '',
				},
				body,
				scriptPath,
				headers,
			});
			this.#cookieStore.rememberCookiesFromResponseHeaders(
				response.headers
			);
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
	 * Resolve the requested path to the filesystem path of the requested PHP file.
	 *
	 * Fall back to index.php as if there was a url rewriting rule in place.
	 *
	 * @param  requestedPath - The requested pathname.
	 * @throws {Error} If the requested path doesn't exist.
	 * @returns The resolved filesystem path.
	 */
	#resolvePHPFilePath(php: BasePHP, requestedPath: string): string {
		let filePath = removePathPrefix(requestedPath, this.#PATHNAME);
		filePath = applyRewriteRules(filePath, this.rewriteRules);

		if (filePath.includes('.php')) {
			// If the path mentions a .php extension, that's our file's path.
			filePath = filePath.split('.php')[0] + '.php';
		} else if (php.isDir(`${this.#DOCROOT}${filePath}`)) {
			if (!filePath.endsWith('/')) {
				filePath = `${filePath}/`;
			}
			// If the path is a directory, let's assume the file is index.php
			filePath = `${filePath}index.php`;
		} else {
			// Otherwise, let's assume the file is /index.php
			filePath = '/index.php';
		}

		let resolvedFsPath = `${this.#DOCROOT}${filePath}`;
		// If the requested PHP file doesn't exist, let's fall back to /index.php
		// as the request may need to be rewritten.
		if (!php.fileExists(resolvedFsPath)) {
			resolvedFsPath = `${this.#DOCROOT}/index.php`;
		}
		if (php.fileExists(resolvedFsPath)) {
			return resolvedFsPath;
		}
		throw new Error(`File not found: ${resolvedFsPath}`);
	}

	/**
	 * Add paths to static files we can assume exist remotely.
	 *
	 * @param relativePaths A list of paths to remote assets, relative to the document root.
	 */
	addRemoteAssetPaths(relativePaths: string[]) {
		const separator = this.#DOCROOT.endsWith('/') ? '' : '/';
		relativePaths.forEach((relativePath) => {
			const fsPath = `${this.#DOCROOT}${separator}${relativePath}`;
			this.#remoteAssetPaths.add(fsPath);
		});
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
	const extension = path.split('.').pop() as keyof typeof mimeTypes;
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
			return path.replace(rule.match, rule.replacement);
		}
	}
	return path;
}
