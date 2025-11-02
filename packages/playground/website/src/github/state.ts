import { signal } from '@preact/signals-react';
import { setGitHubAuthToken } from '@wp-playground/storage';

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

// Initialize the git-sparse-checkout module with the token if it exists
if (oAuthState.value.token) {
	setGitHubAuthToken(oAuthState.value.token);
}

export function setOAuthToken(token?: string) {
	if (shouldStoreToken) {
		localStorage.setItem(TOKEN_KEY, token || '');
	}
	oAuthState.value = {
		...oAuthState.value,
		token,
	};
	// Also update the token in the git-sparse-checkout module
	setGitHubAuthToken(token);
}
