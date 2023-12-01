import { signal } from '@preact/signals-react';

export interface GitHubOAuthState {
	token?: string;
	isAuthorizing: boolean;
}

export const TOKEN_KEY = 'github-token';

// Store the token in localStorage in development mode so that it persists
// across page reloads.
const shouldStoreToken = process.env.NODE_ENV === 'development';

export const oAuthState = signal<GitHubOAuthState>({
	isAuthorizing: false,
	token: shouldStoreToken ? localStorage.getItem(TOKEN_KEY) || '' : '',
});

export function setOAuthToken(token?: string) {
	if (shouldStoreToken) {
		localStorage.setItem(TOKEN_KEY, token || '');
	}
	oAuthState.value = {
		...oAuthState.value,
		token,
	};
}
