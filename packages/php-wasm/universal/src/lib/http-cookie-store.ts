/**
 * @public
 */
export class HttpCookieStore {
	cookies: Record<string, string> = {};

	rememberCookiesFromResponseHeaders(headers: Record<string, string[]>) {
		if (!headers?.['set-cookie']) {
			return;
		}
		for (const setCookie of headers['set-cookie']) {
			try {
				if (!setCookie.includes('=')) {
					continue;
				}
				const equalsIndex = setCookie.indexOf('=');
				const name = setCookie.substring(0, equalsIndex);
				const value = setCookie
					.substring(equalsIndex + 1)
					.split(';')[0];
				this.cookies[name] = value;
			} catch (e) {
				console.error(e);
			}
		}
	}

	getCookieRequestHeader() {
		const cookiesArray: string[] = [];
		for (const name in this.cookies) {
			cookiesArray.push(`${name}=${this.cookies[name]}`);
		}
		return cookiesArray.join('; ');
	}
}
