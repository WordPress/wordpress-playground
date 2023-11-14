export const TOKEN_KEY = 'github-token';

export function setOAuthToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function getOAuthToken() {
	return localStorage.getItem(TOKEN_KEY);
}
