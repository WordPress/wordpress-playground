import { oAuthState } from './state';
import { encodeStringAsBase64 } from '@php-wasm/util';

const OAUTH_RETURN_URL_KEY_PREFIX = 'github-oauth-return-url:';

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
	return (url: string): Record<string, string> => {
		// Get token at call time, not at creation time
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

/**
 * Build the OAuth redirect URL, converting any URL fragment blueprint to a
 * data URI query parameter so it survives the OAuth round-trip.
 *
 * URL fragments are not sent to servers in HTTP requests, so they would be
 * lost during the OAuth redirect flow.
 */
export function buildOAuthRedirectUrl(): string {
	const redirectUrl = new URL(window.location.href);
	redirectUrl.searchParams.delete('code');
	redirectUrl.searchParams.delete('state');
	redirectUrl.searchParams.delete('modal');

	if (redirectUrl.hash && !redirectUrl.searchParams.has('blueprint-url')) {
		const fragment = decodeURIComponent(redirectUrl.hash.substring(1));
		if (fragment.startsWith('{')) {
			const dataUri =
				'data:application/json;base64,' +
				encodeStringAsBase64(fragment);
			redirectUrl.searchParams.set('blueprint-url', dataUri);
			redirectUrl.hash = '';
		}
	}

	return redirectUrl.toString();
}

export function startGitHubOAuth(): string {
	const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	sessionStorage.setItem(
		OAUTH_RETURN_URL_KEY_PREFIX + state,
		buildOAuthRedirectUrl()
	);

	const oauthUrl = new URL('/oauth.php', window.location.origin);
	oauthUrl.searchParams.set('redirect', '1');
	oauthUrl.searchParams.set('state', state);
	return oauthUrl.toString();
}

export function consumeGitHubOAuthReturnUrl(state: string | null): string | null {
	if (!state) {
		return null;
	}

	const key = OAUTH_RETURN_URL_KEY_PREFIX + state;
	const storedUrl = sessionStorage.getItem(key);
	sessionStorage.removeItem(key);
	if (!storedUrl) {
		return null;
	}

	try {
		const returnUrl = new URL(storedUrl);
		return returnUrl.origin === window.location.origin
			? returnUrl.toString()
			: null;
	} catch {
		return null;
	}
}
