import { Modal } from '../modal';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon } from '@wordpress/components';
import { GitHubIcon } from '../../github/github';
import css from '../../github/github-oauth-guard/style.module.css';
import { staticAnalyzeGitHubURL } from '../../github/analyze-github-url';
import { oAuthState, setOAuthToken } from '../../github/state';
import { startGitHubOAuthFlow } from '../../github/oauth-popup';
import { useState } from 'react';

export function GitHubPrivateRepoAuthModal() {
	const dispatch = useAppDispatch();
	const repoUrl = useAppSelector((state) => state.ui.githubAuthRepoUrl);
	const [error, setError] = useState<string>();

	if (!repoUrl) {
		return null;
	}

	const { owner, repo } = staticAnalyzeGitHubURL(repoUrl);
	const displayRepoName = owner && repo ? `${owner}/${repo}` : repoUrl;

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
						href={new URL(
							'oauth.php',
							window.location.href
						).toString()}
						onClick={async (event) => {
							event.preventDefault();
							setError(undefined);
							oAuthState.value = {
								...oAuthState.value,
								isAuthorizing: true,
							};
							try {
								setOAuthToken(await startGitHubOAuthFlow());
								dispatch(setActiveModal(null));
							} catch (oauthError) {
								setError((oauthError as Error).message);
							} finally {
								oAuthState.value = {
									...oAuthState.value,
									isAuthorizing: false,
								};
							}
						}}
					>
						<Icon icon={GitHubIcon} />
						Connect your GitHub account
					</a>
				</p>
				{error ? <p role="alert">{error}</p> : null}
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
