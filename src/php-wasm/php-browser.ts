import type PHPServer from './php-server';
import type { PHPServerRequest } from './php-server';
import type { PHPResponse } from './php';

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
		request: PHPServerRequest,
		redirects: number = 0
	): Promise<PHPResponse> {
		const response = await this.server.request({
			...request,
			headers: {
				...request.headers,
				cookie: this.#serializeCookies(),
			},
		});

		if (response.headers['set-cookie']) {
			this.#setCookies(response.headers['set-cookie']);
		}

		if (
			this.#config.handleRedirects &&
			response.headers.location &&
			redirects < this.#config.maxRedirects
		) {
			const redirectUrl = new URL(
				response.headers.location[0],
				this.server.absoluteUrl
			);
			return this.request(
				{
					absoluteUrl: redirectUrl.toString(),
					method: 'GET',
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
				if (!cookie.includes('=')) {
					continue;
				}
				const equalsIndex = cookie.indexOf('=');
				const name = cookie.substring(0, equalsIndex);
				const value = cookie.substring(equalsIndex + 1).split(';')[0];
				this.#cookies[name] = value;
			} catch (e) {
				console.error(e);
			}
		}
	}

	#serializeCookies() {
		const cookiesArray: string[] = [];
		for (const name in this.#cookies) {
			cookiesArray.push(`${name}=${this.#cookies[name]}`);
		}
		return cookiesArray.join('; ');
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
