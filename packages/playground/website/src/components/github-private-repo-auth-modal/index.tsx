import { Modal } from '../modal';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { GitHubIcon } from '../../github/github';
import css from '../../github/github-oauth-guard/style.module.css';
import { staticAnalyzeGitHubURL } from '../../github/analyze-github-url';
import { oAuthState } from '../../github/state';
import { connectToGitHub } from '../../github/connect-to-github';
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
	const isAuthorizing = oAuthState.value.isAuthorizing;

	return (
		<Modal
			title={__('Connect to GitHub', 'playground-website')}
			onRequestClose={() => dispatch(setActiveModal(null))}
		>
			<div>
				<p>
					{__(
						'This blueprint requires access to a private GitHub repository:',
						'playground-website'
					)}
				</p>
				<p>
					<strong>
						<code>github.com/{displayRepoName}</code>
					</strong>
				</p>
				<p>
					{__(
						'If you have a GitHub account with access to this repository, you can connect it to continue.',
						'playground-website'
					)}
				</p>

				{isAuthorizing ? (
					<div>
						<Spinner />
						<p>
							{__(
								'Authorization popup opened. Continue in the popup to connect your GitHub account.',
								'playground-website'
							)}
						</p>
					</div>
				) : (
					<p>
						<a
							aria-label={__(
								'Connect your GitHub account',
								'playground-website'
							)}
							className={css.githubButton}
							href={new URL(
								'oauth.php',
								window.location.href
							).toString()}
							onClick={async (event) => {
								event.preventDefault();
								await connectToGitHub({
									setError,
									onSuccess: () => {
										dispatch(setActiveModal(null));
									},
								});
							}}
						>
							<Icon icon={GitHubIcon} />
							{__(
								'Connect your GitHub account',
								'playground-website'
							)}
						</a>
					</p>
				)}
				{error ? <p role="alert">{error}</p> : null}
				<p>
					<small>
						{__(
							'Your access token is stored only in memory and will be cleared when you close this tab.',
							'playground-website'
						)}
					</small>
				</p>
			</div>
		</Modal>
	);
}
