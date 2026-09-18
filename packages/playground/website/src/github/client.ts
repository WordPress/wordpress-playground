import { createClient } from '@wp-playground/storage';
import type { GithubClient } from '@wp-playground/storage';
import { oAuthState } from './state';

let octokitClient: GithubClient | undefined;
let octokitClientToken: string | undefined;

/**
 * Returns an authenticated GitHub client for the current OAuth token.
 */
export function getAuthenticatedGitHubClient() {
	const token = oAuthState.value.token;
	if (!token) {
		throw new Error('GitHub authentication is required.');
	}
	// OAuth can replace the token while this module stays loaded. Reusing a
	// client across token changes would keep sending the stale Authorization
	// header until the next hard refresh.
	if (!octokitClient || octokitClientToken !== token) {
		octokitClient = createClient(token!);
		octokitClientToken = token;
	}
	return octokitClient;
}

/**
 * Clears the cached GitHub client after auth failures or token changes.
 */
export function resetAuthenticatedGitHubClient() {
	octokitClient = undefined;
	octokitClientToken = undefined;
}
