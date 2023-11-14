import { signal } from '@preact/signals-react';

export interface GitHubOAuthState {
	token?: string;
	isAuthorizing: boolean;
}

export const TOKEN_KEY = 'github-token';
export const oAuthState = signal<GitHubOAuthState>({
	token: localStorage.getItem(TOKEN_KEY) || undefined,
	isAuthorizing: false,
});

export function setOAuthToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token);
	oAuthState.value = {
		...oAuthState.value,
		token,
	};
}
