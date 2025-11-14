import { oAuthState } from './state';
import { corsProxyUrl } from 'virtual:cors-proxy-url';

function isGitHubUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const corsProxyOrigin = new URL(corsProxyUrl).origin;

		if (urlObj.origin === corsProxyOrigin && urlObj.search) {
			const queryWithoutQuestion = urlObj.search.substring(1);
			// Check if the query string starts with http:// or https://
			if (queryWithoutQuestion.match(/^https?:\/\//)) {
				const decodedUrl = decodeURIComponent(queryWithoutQuestion);
				try {
					const targetUrlObj = new URL(decodedUrl);
					const hostname = targetUrlObj.hostname;
					return (
						hostname === 'github.com' ||
						hostname === 'api.github.com'
					);
				} catch {
					// If parsing the target URL fails, fall through to direct check
				}
			}
		}

		// Direct URL check
		const hostname = urlObj.hostname;
		return hostname === 'github.com' || hostname === 'api.github.com';
	} catch {
		return false;
	}
}

export function createGitHubAuthHeaders(): (
	url: string
) => Record<string, string> {
	const token = oAuthState.value.token;

	return (url: string): Record<string, string> => {
		if (!token || !isGitHubUrl(url)) {
			return {};
		}

		const encoder = new TextEncoder();
		const data = encoder.encode(`${token}:`);
		const binary = [];
		for (let i = 0; i < data.length; i++) {
			binary.push(String.fromCharCode(data[i]));
		}
		const encodedToken = btoa(binary.join(''));

		return {
			Authorization: `Basic ${encodedToken}`,
			// Tell the CORS proxy to forward the Authorization header
			'X-Cors-Proxy-Allowed-Request-Headers': 'Authorization',
		};
	};
}
