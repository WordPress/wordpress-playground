import { createClient } from '@wp-playground/storage';
import type { GithubClient } from '@wp-playground/storage';
import { oAuthState } from './state';

let octokitClient: GithubClient | undefined;
let octokitClientToken: string | undefined;

export function getAuthenticatedGitHubClient() {
	const token = oAuthState.value.token;
	// OAuth can replace the token while this module stays loaded. Reusing a
	// client across token changes would keep sending the stale Authorization
	// header until the next hard refresh.
	if (!octokitClient || octokitClientToken !== token) {
		octokitClient = createClient(token!);
		octokitClientToken = token;
	}
	return octokitClient;
}

export function resetAuthenticatedGitHubClient() {
	octokitClient = undefined;
	octokitClientToken = undefined;
}
