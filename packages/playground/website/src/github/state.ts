import { signal } from '@preact/signals-react';

export interface GitHubOAuthState {
	token?: string;
	isAuthorizing: boolean;
}

export const TOKEN_KEY = 'github-token';
export const oAuthState = signal<GitHubOAuthState>({
	isAuthorizing: false,
});

export function setOAuthToken(token?: string) {
	oAuthState.value = {
		...oAuthState.value,
		token,
	};
}
