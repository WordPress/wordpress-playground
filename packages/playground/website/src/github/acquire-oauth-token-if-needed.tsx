import { setOAuthToken, oAuthState } from './state';
import { oauthCode } from './github-oauth-guard';
import { setGitHubAuthToken } from '@wp-playground/storage';

export async function acquireOAuthTokenIfNeeded() {
	if (!oauthCode) {
		return;
	}

	// If there is a code in the URL, exchange it for an access token.

	oAuthState.value = {
		...oAuthState.value,
		isAuthorizing: true,
	};

	try {
		// Fetch https://github.com/login/oauth/access_token
		// with clientId, clientSecret and code
		// to get the access token
		const response = await fetch('/oauth.php?code=' + oauthCode, {
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});
		const body = await response.json();
		setOAuthToken(body.access_token);
		setGitHubAuthToken(body.access_token);

		// Remove the ?code=... from the URL and clean up any modal state
		const url = new URL(window.location.href);
		url.searchParams.delete('code');
		url.searchParams.delete('modal');
		// Keep the hash (it contains the blueprint)

		// Reload the page to retry the blueprint with the new token
		// This is necessary because the blueprint failed before we had the token
		window.location.href = url.toString();
	} finally {
		oAuthState.value = {
			...oAuthState.value,
			isAuthorizing: false,
		};
	}
}
