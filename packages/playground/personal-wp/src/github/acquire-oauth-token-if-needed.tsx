import { setOAuthToken, oAuthState } from './state';
import { consumeGitHubOAuthReturnUrl } from './git-auth-helpers';

export async function acquireOAuthTokenIfNeeded() {
	const callbackUrl = new URL(window.location.href);
	const oauthCode = callbackUrl.searchParams.get('code');
	if (!oauthCode) {
		return;
	}
	const returnUrl = consumeGitHubOAuthReturnUrl(
		callbackUrl.searchParams.get('state')
	);
	if (!returnUrl) {
		throw new Error('GitHub OAuth returned without a valid state');
	}

	oAuthState.value = {
		...oAuthState.value,
		isAuthorizing: true,
	};

	try {
		const response = await fetch(
			'/oauth.php?code=' + encodeURIComponent(oauthCode),
			{
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
			}
		);
		const body = await response.json();
		if (!response.ok || !body.access_token) {
			throw new Error(body.error_description || body.error || 'GitHub OAuth failed');
		}
		setOAuthToken(body.access_token);
		window.history.replaceState({}, '', returnUrl);
	} finally {
		oAuthState.value = {
			...oAuthState.value,
			isAuthorizing: false,
		};
	}
}
