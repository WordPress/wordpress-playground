import PHPServer from "./php-server";

/**
 * A fake web browser that handles PHPServer's cookies and redirects
 * internally without exposing them to the consumer.
 */
export default class PHPBrowser {
  #cookies;
  #config;

  /**
   * @param {PHPServer} server The PHP server to browse.
   * @param {PHPBrowserConfiguration} config The browser configuration. 
   */
  constructor(server, config = {}) {
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
   * @param {import('./php-server').Request} request The request.
   * @param {number} redirects Optional. The number of redirects handled so far.
   * @returns {import('./php-server').Response}
   */
  async request(request, redirects = 0) {
    const response = await this.server.request({
      ...request,
      _COOKIE: this.#cookies,
    });

    if (response.headers["set-cookie"]) {
      this.#setCookies(response.headers["set-cookie"]);
    }

    if (
      this.#config.handleRedirects &&
      response.headers.location &&
      redirects < this.#config.maxRedirects
    ) {
      const parsedUrl = new URL(
        response.headers.location[0],
        this.server.ABSOLUTE_URL
      );
      return this.request(
        {
          path: parsedUrl.pathname,
          method: "GET",
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
        const value = cookie.split("=")[1].split(";")[0];
        const name = cookie.split("=")[0];
        this.#cookies[name] = value;
      } catch (e) {
        console.error(e);
      }
    }
  }
}

/**
 * @typedef {Object} PHPBrowserConfiguration
 * @property {boolean} handleRedirects Should handle redirects internally?
 * @property {number} maxRedirects The maximum number of redirects to follow internally. Once
 *                                 exceeded, request() will return the redirecting response.
 */
