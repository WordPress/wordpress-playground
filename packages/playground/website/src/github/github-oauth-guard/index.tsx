import { Spinner } from '@wordpress/components';
import { oAuthState } from '../token';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';
const urlParams = new URLSearchParams(window.location.search);
export const oauthCode = urlParams.get('code');
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
	if (oAuthState.value.isAuthorizing) {
		return (
			<div>
				<Spinner />
				Authorizing...
			</div>
		);
	}

	if (oAuthState.value.token) {
		return <div>{children}</div>;
	}

	return <AuthRequest authenticateUrl={OAUTH_FLOW_URL} />;
}
