import { setOAuthToken, oAuthState } from './state';
import { oauthCode } from './github-oauth-guard';

export async function acquireOAuthTokenIfNeeded() {
	if (!oauthCode) {
		return;
	}

	oAuthState.value = {
		...oAuthState.value,
		isAuthorizing: true,
	};

	try {
		const response = await fetch('/oauth.php?code=' + oauthCode, {
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});
		const body = await response.json();
		setOAuthToken(body.access_token);

		const url = new URL(window.location.href);
		url.searchParams.delete('code');
		window.history.replaceState({}, '', url.toString());
	} finally {
		oAuthState.value = {
			...oAuthState.value,
			isAuthorizing: false,
		};
	}
}
