import { signal } from '@preact/signals-react';
import { isSiteOrigin } from '../lib/origin-isolation';

export const originIsolationAuthMessage =
	'GitHub sign-in is disabled in this prototype. WordPress code can read this site’s app and tokens. Sign-in needs a separate trusted origin.';

export interface GitHubOAuthState {
	token?: string;
	isAuthorizing: boolean;
}

export const TOKEN_KEY = 'github-token';

// Store the token in localStorage in development mode so that it persists
// across page reloads.
const shouldStoreToken =
	process.env.NODE_ENV === 'development' &&
	!isSiteOrigin(window.location.origin);

export const oAuthState = signal<GitHubOAuthState>({
	isAuthorizing: false,
	token: shouldStoreToken ? localStorage.getItem(TOKEN_KEY) || '' : '',
});

export function setOAuthToken(token?: string) {
	if (
		token &&
		typeof window !== 'undefined' &&
		isSiteOrigin(window.location.origin)
	) {
		throw new Error(originIsolationAuthMessage);
	}
	if (shouldStoreToken) {
		localStorage.setItem(TOKEN_KEY, token || '');
	}
	oAuthState.value = {
		...oAuthState.value,
		token,
	};
}
