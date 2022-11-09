import type { PHP } from './php';
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
export declare class PHPServer {
    #private;
    /**
     * The PHP instance
     */
    php: PHP;
    /**
     * @param  php    - The PHP instance.
     * @param  config - Server configuration.
     */
    constructor(php: PHP, config: PHPServerConfigation);
    /**
     * The absolute URL of this PHPServer instance.
     */
    get absoluteUrl(): string;
    /**
     * Serves the request – either by serving a static file, or by
     * dispatching it to the PHP runtime.
     *
     * @param  request - The request.
     * @returns The response.
     */
    request(request: PHPRequest): Promise<PHPResponse>;
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
declare type PHPHeaders = Record<string, string>;
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
export default PHPServer;
