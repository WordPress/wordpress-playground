import { oAuthState } from './state';

function isGitHubUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;
		return hostname === 'github.com' || hostname === 'api.github.com';
	} catch {
		return false;
	}
}

export function shouldShowGitHubAuthModal(url: string | undefined): boolean {
	return !!url && isGitHubUrl(url);
}

export function createGitAuthHeaders(): (
	url: string
) => Record<string, string> {
	const token = oAuthState.value.token;

	return (url: string): Record<string, string> => {
		if (!token || !isGitHubUrl(url)) {
			return {};
		}

		// Avoid InvalidCharacterError from btoa() with non-Latin1 characters
		const encoder = new TextEncoder();
		const data = encoder.encode(`${token}:`);
		const binary = [];
		for (let i = 0; i < data.length; i++) {
			binary.push(String.fromCharCode(data[i]));
		}
		const encodedToken = btoa(binary.join(''));

		return {
			Authorization: `Basic ${encodedToken}`,
			// Tell a CORS proxy to forward the Authorization header
			'X-Cors-Proxy-Allowed-Request-Headers': 'Authorization',
		};
	};
}
