import { Icon, Spinner } from '@wordpress/components';
import { oAuthState } from '../state';
import { GitHubIcon } from '../github-icon';
import css from './style.module.css';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';
const urlParams = new URLSearchParams(window.location.search);
export const oauthCode = urlParams.get('code');
interface GitHubOAuthGuardProps {
	children: React.ReactNode;
	AuthRequest?: React.FunctionComponent<{
		authenticateUrl: string;
	}>;
}
export default function GitHubOAuthGuard({
	children,
	AuthRequest: AuthComponent = Authenticate,
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

	return <AuthComponent authenticateUrl={OAUTH_FLOW_URL} />;
}

export function Authenticate({ authenticateUrl }: { authenticateUrl: string }) {
	return (
		<div>
			<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
				Connect to GitHub
			</h2>
			<p>
				Importing plugins, themes, and wp-content directories directly
				from your public GitHub repositories.
			</p>
			<p>
				To enable this feature, connect your GitHub account with
				WordPress Playground:
			</p>
			<p>
				<a
					aria-label="Connect your GitHub account"
					className={css.githubButton}
					href={authenticateUrl}
				>
					<Icon icon={GitHubIcon} />
					Connect your GitHub account
				</a>
			</p>
			<p>
				The access token will be stored in your browser's local storage.
				WordPress Playground will utilize it solely when you actively
				engage with GitHub repositories.
			</p>
		</div>
	);
}
