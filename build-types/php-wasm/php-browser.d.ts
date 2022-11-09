import type PHPServer from './php-server';
import type { PHPRequest, PHPResponse } from './php-server';
/**
 * A fake web browser that handles PHPServer's cookies and redirects
 * internally without exposing them to the consumer.
 *
 * @public
 */
export declare class PHPBrowser {
    #private;
    server: PHPServer;
    /**
     * @param  server - The PHP server to browse.
     * @param  config - The browser configuration.
     */
    constructor(server: PHPServer, config?: PHPBrowserConfiguration);
    /**
     * Sends the request to the server.
     *
     * When cookies are present in the response, this method stores
     * them and sends them with any subsequent requests.
     *
     * When a redirection is present in the response, this method
     * follows it by discarding a response and sending a subsequent
     * request.
     *
     * @param  request   - The request.
     * @param  redirects - Internal. The number of redirects handled so far.
     * @returns PHPServer response.
     */
    request(request: PHPRequest, redirects?: number): Promise<PHPResponse>;
}
interface PHPBrowserConfiguration {
    /**
     * Should handle redirects internally?
     */
    handleRedirects?: boolean;
    /**
     * The maximum number of redirects to follow internally. Once
     * exceeded, request() will return the redirecting response.
     */
    maxRedirects?: number;
}
export default PHPBrowser;
