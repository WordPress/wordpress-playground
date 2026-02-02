import { Modal } from '../modal';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon } from '@wordpress/components';
import { GitHubIcon } from '../../github/github';
import css from '../../github/github-oauth-guard/style.module.css';
import { staticAnalyzeGitHubURL } from '../../github/analyze-github-url';
import { buildOAuthRedirectUrl } from '../../github/git-auth-helpers';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';

export function GitHubPrivateRepoAuthModal() {
	const dispatch = useAppDispatch();
	const repoUrl = useAppSelector((state) => state.ui.githubAuthRepoUrl);

	if (!repoUrl) {
		return null;
	}

	const { owner, repo } = staticAnalyzeGitHubURL(repoUrl);
	const displayRepoName = owner && repo ? `${owner}/${repo}` : repoUrl;

	const urlParams = new URLSearchParams();
	urlParams.set('redirect_uri', buildOAuthRedirectUrl());
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
