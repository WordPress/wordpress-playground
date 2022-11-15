import type PHPServer from './php-server';
import type { PHPRequest, PHPResponse } from './php-server';

/**
 * A fake web browser that handles PHPServer's cookies and redirects
 * internally without exposing them to the consumer.
 *
 * @public
 */
export class PHPBrowser {
	#cookies;
	#config;

	server: PHPServer;

	/**
	 * @param  server - The PHP server to browse.
	 * @param  config - The browser configuration.
	 */
	constructor(server: PHPServer, config: PHPBrowserConfiguration = {}) {
		this.server = server;
		this.#cookies = {};
		this.#config = {
			handleRedirects: false,
			maxRedirects: 4,
			...config,
		};
	}

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
	async request(
		request: PHPRequest,
		redirects: number = 0
	): Promise<PHPResponse> {
		const response = await this.server.request({
			...request,
			_COOKIE: this.#cookies,
		});

		if (response.headers['set-cookie']) {
			this.#setCookies(response.headers['set-cookie']);
		}

		if (
			this.#config.handleRedirects &&
			response.headers.location &&
			redirects < this.#config.maxRedirects
		) {
			const parsedUrl = new URL(
				response.headers.location[0],
				this.server.absoluteUrl
			);
			return this.request(
				{
					path: parsedUrl.pathname,
					method: 'GET',
					queryString: parsedUrl.search,
					headers: {},
				},
				redirects + 1
			);
		}

		return response;
	}

	#setCookies(cookies) {
		for (const cookie of cookies) {
			try {
				const value = cookie.split('=')[1].split(';')[0];
				const name = cookie.split('=')[0];
				this.#cookies[name] = value;
			} catch (e) {
				console.error(e);
			}
		}
	}
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
