import { oAuthState } from './state';

const KNOWN_CORS_PROXY_URLS = [
	'https://playground.wordpress.net/cors-proxy.php?',
	'https://wordpress-playground-cors-proxy.net/?',
	'http://127.0.0.1:5263/cors-proxy.php?',
];

export function isGitHubUrl(url: string): boolean {
	if (url.includes('github.com')) {
		return true;
	}
	for (const corsProxyUrl of KNOWN_CORS_PROXY_URLS) {
		if (
			url.startsWith(corsProxyUrl) &&
			url.substring(corsProxyUrl.length).includes('github.com')
		) {
			return true;
		}
	}
	return false;
}

export function createGitHubAuthHeaders(): Record<string, string> {
	const token = oAuthState.value.token;
	if (!token) {
		return {};
	}

	return {
		Authorization: `Basic ${btoa(`${token}:`)}`,
		// Tell the CORS proxy to forward the Authorization header
		'X-Cors-Proxy-Allowed-Request-Headers': 'Authorization',
	};
}
