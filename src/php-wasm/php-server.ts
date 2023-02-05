import {
	ensurePathPrefix,
	getPathQueryFragment,
	removePathPrefix,
} from './utils';
import type { FileInfo, PHP, PHPRequest, PHPResponse } from './php';

export type PHPServerRequest = Pick<
	PHPRequest,
	'method' | 'headers' | 'body'
> & {
	absoluteUrl: string;
	files?: Record<string, File>;
};

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
	async request(request: PHPServerRequest): Promise<PHPResponse> {
		const serverPath = removePathPrefix(
			new URL(request.absoluteUrl).pathname,
			this.#PATHNAME
		);
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
				httpStatusCode: 404,
				exitCode: 0,
				errors: '',
			};
		}
		const arrayBuffer = this.php.readFileAsBuffer(fsPath);
		return {
			body: arrayBuffer,
			headers: {
				'content-length': `${arrayBuffer.byteLength}`,
				// @TODO: Infer the content-type from the arrayBuffer instead of the file path.
				//        The code below won't return the correct mime-type if the extension
				//        was tampered with.
				'content-type': inferMimeType(fsPath),
				'accept-ranges': 'bytes',
				'cache-control': 'public, max-age=0',
			},
			httpStatusCode: 200,
			exitCode: 0,
			errors: '',
		};
	}

	/**
	 * Runs the requested PHP file with all the request and $_SERVER
	 * superglobals populated.
	 *
	 * @param  request - The request.
	 * @returns The response.
	 */
	async #dispatchToPHP(request: PHPServerRequest): Promise<PHPResponse> {
		this.php.addServerGlobalEntry('DOCUMENT_ROOT', this.#DOCROOT);
		this.php.addServerGlobalEntry(
			'HTTPS',
			this.#ABSOLUTE_URL.startsWith('https://') ? 'on' : ''
		);

		const fileInfos: FileInfo[] = [];
		if (request.files) {
			for (const key in request.files) {
				const file: File = request.files[key];
				fileInfos.push({
					key,
					name: file.name,
					type: file.type,
					data: new Uint8Array(await file.arrayBuffer()),
				});
			}
		}

		const requestedUrl = new URL(request.absoluteUrl);
		return this.php.run({
			relativeUri: ensurePathPrefix(
				getPathQueryFragment(requestedUrl),
				this.#PATHNAME
			),
			protocol: this.#PROTOCOL,
			method: request.method,
			body: request.body,
			fileInfos,
			scriptPath: this.#resolvePHPFilePath(requestedUrl.pathname),
			headers: {
				...(request.headers || {}),
				host: this.#HOST,
			},
		});
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
		let filePath = removePathPrefix(requestedPath, this.#PATHNAME);

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

export default PHPServer;
