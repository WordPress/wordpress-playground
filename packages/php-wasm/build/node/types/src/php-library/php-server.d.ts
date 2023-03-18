import type { PHP, PHPRequest, PHPResponse } from './php';
export type PHPServerRequest = Pick<PHPRequest, 'method' | 'headers'> & {
    files?: Record<string, File>;
} & ({
    absoluteUrl: string;
    relativeUrl?: never;
} | {
    absoluteUrl?: never;
    relativeUrl: string;
}) & (Pick<PHPRequest, 'body'> & {
    formData?: never;
} | {
    body?: never;
    formData: Record<string, unknown>;
});
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
    constructor(php: PHP, config?: PHPServerConfigation);
    /**
     * Converts a path to an absolute URL based at the PHPServer
     * root.
     *
     * @param  path The server path to convert to an absolute URL.
     * @returns The absolute URL.
     */
    pathToInternalUrl(path: string): string;
    /**
     * Converts an absolute URL based at the PHPServer to a relative path
     * without the server pathname and scope.
     *
     * @param  internalUrl An absolute URL based at the PHPServer root.
     * @returns The relative path.
     */
    internalUrlToPath(internalUrl: string): string;
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
    request(request: PHPServerRequest): Promise<PHPResponse>;
}
export interface PHPServerConfigation {
    /**
     * The directory in the PHP filesystem where the server will look
     * for the files to serve. Default: `/var/www`.
     */
    documentRoot?: string;
    /**
     * Server URL. Used to populate $_SERVER details like HTTP_HOST.
     */
    absoluteUrl?: string;
    /**
     * Callback used by the PHPServer to decide whether
     * the requested path refers to a PHP file or a static file.
     */
    isStaticFilePath?: (path: string) => boolean;
}
export default PHPServer;
