import { Modal } from '../modal';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon } from '@wordpress/components';
import { GitHubIcon } from '../../github/github';
import css from '../../github/github-oauth-guard/style.module.css';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';

function extractRepoName(url: string): string {
	try {
		// Handle CORS-proxied URLs - extract the actual GitHub URL
		const corsProxyPrefixes = [
			'https://wordpress-playground-cors-proxy.net/?',
			'http://127.0.0.1:5263/cors-proxy.php?',
		];
		let githubUrl = url;
		for (const prefix of corsProxyPrefixes) {
			if (url.startsWith(prefix)) {
				githubUrl = url.substring(prefix.length);
				break;
			}
		}

		// Extract owner/repo from GitHub URL
		const match = githubUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
		return match ? match[1] : url;
	} catch {
		return url;
	}
}

export function GitHubPrivateRepoAuthModal() {
	const dispatch = useAppDispatch();
	const repoUrl = useAppSelector((state) => state.ui.githubAuthRepoUrl);

	const displayRepoName = repoUrl ? extractRepoName(repoUrl) : '';

	// Remove the modal parameter from the redirect URI
	// so it doesn't persist after OAuth completes
	const redirectUrl = new URL(window.location.href);
	redirectUrl.searchParams.delete('modal');

	const urlParams = new URLSearchParams();
	urlParams.set('redirect_uri', redirectUrl.toString());
	const oauthUrl = `${OAUTH_FLOW_URL}&${urlParams.toString()}`;

	return (
		<Modal
			title="Connect to GitHub"
			onRequestClose={() => dispatch(setActiveModal(null))}
		>
			<div>
				<p>
					This blueprint requires access to a private GitHub
					repository:
				</p>
				<p>
					<strong>
						<code>github.com/{displayRepoName}</code>
					</strong>
				</p>
				<p>
					If you have a GitHub account with access to this repository,
					you can connect it to continue.
				</p>

				<p>
					<a
						aria-label="Connect your GitHub account"
						className={css.githubButton}
						href={oauthUrl}
					>
						<Icon icon={GitHubIcon} />
						Connect your GitHub account
					</a>
				</p>
				<p>
					<small>
						Your access token is stored only in memory and will be
						cleared when you close this tab.
					</small>
				</p>
			</div>
		</Modal>
	);
}
