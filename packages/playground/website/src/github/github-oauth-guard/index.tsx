import { useEffect } from 'react';
import { getOAuthToken, setOAuthToken } from '../token';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';
const urlParams = new URLSearchParams(window.location.search);
const oauthCode = urlParams.get('code');
interface GitHubOAuthGuardProps {
	children: React.ReactNode;
	AuthRequest: React.FunctionComponent<{
		authenticateUrl: string;
	}>;
}
export default function GitHubOAuthGuard({
	children,
	AuthRequest,
}: GitHubOAuthGuardProps) {
	useEffect(() => {
		async function acquireOAuthToken() {
			// OAUTH FLOW {{{
			// If there is a code in the URL, store it in localStorage
			if (oauthCode) {
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
				// Redirect to the same page but without "code" in the URL
				const url = new URL(window.location.href);
				url.searchParams.delete('code');
				(window as any).location = url;
			}
		}
		acquireOAuthToken();
		// }}} /OAUTH FLOW
	}, []);

	if (oauthCode) {
		return <div>Loading...</div>;
	}

	if (getOAuthToken()) {
		return <div>{children}</div>;
	}

	return <AuthRequest authenticateUrl={OAUTH_FLOW_URL} />;
}
