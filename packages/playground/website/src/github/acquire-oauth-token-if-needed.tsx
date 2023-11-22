import { setOAuthToken, oAuthState } from './state';
import { oauthCode } from './github-oauth-guard';

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
	} finally {
		oAuthState.value = {
			...oAuthState.value,
			isAuthorizing: false,
		};
	}

	// Remove the ?code=... from the URL
	const url = new URL(window.location.href);
	url.searchParams.delete('code');
	window.history.replaceState(null, '', url.toString());
}
