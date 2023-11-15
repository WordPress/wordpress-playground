import { Icon, Spinner } from '@wordpress/components';
import { oAuthState } from '../state';
import { GitHubIcon } from '../github';
import css from './style.module.css';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';
const urlParams = new URLSearchParams(window.location.search);
export const oauthCode = urlParams.get('code');
interface GitHubOAuthGuardProps {
	children: React.ReactNode;
}
export default function GitHubOAuthGuard({ children }: GitHubOAuthGuardProps) {
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

	return <Authenticate authenticateUrl={OAUTH_FLOW_URL} />;
}

function Authenticate({ authenticateUrl }: { authenticateUrl: string }) {
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
				Your access token is not stored anywhere, which means you'll
				have to re-authenticate after every page refresh.
			</p>
		</div>
	);
}
