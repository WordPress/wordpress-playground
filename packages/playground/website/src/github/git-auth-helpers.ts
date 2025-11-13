import { oAuthState } from './state';

const KNOWN_CORS_PROXY_URLS = [
	'https://playground.wordpress.net/cors-proxy.php?',
	'https://wordpress-playground-cors-proxy.net/?',
	'http://127.0.0.1:5263/cors-proxy.php?',
];

export function isGitHubUrl(url: string): boolean {
	for (const corsProxyUrl of KNOWN_CORS_PROXY_URLS) {
		if (url.startsWith(corsProxyUrl)) {
			url = url.substring(corsProxyUrl.length);
			break;
		}
	}

	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;
		return hostname === 'github.com';
	} catch {
		return false;
	}
}

export function createGitHubAuthHeaders(): (
	url: string
) => Record<string, string> {
	const token = oAuthState.value.token;

	return (url: string) => {
		if (!token || !isGitHubUrl(url)) {
			return {};
		}

		const headers = {
			Authorization: `Basic ${btoa(`${token}:`)}`,
			// Tell the CORS proxy to forward the Authorization header
			'X-Cors-Proxy-Allowed-Request-Headers': 'Authorization',
		};
		return headers;
	};
}
