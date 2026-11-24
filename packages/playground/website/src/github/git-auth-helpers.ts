import { oAuthState } from './state';

/** Whether the URL uses a recognized GitHub hostname. */
export function isGitHubUrl(url: string): boolean {
	try {
		return /^(?:www\.|api\.)?github\.com$/.test(new URL(url).hostname);
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
	return (url: string): Record<string, string> => {
		// Get token at call time, not at creation time, so that we pick up
		// the token after it's acquired via the OAuth flow.
		const token = oAuthState.value.token;

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
