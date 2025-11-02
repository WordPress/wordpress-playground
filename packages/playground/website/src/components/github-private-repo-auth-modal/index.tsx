import { Modal } from '../modal';
import { useAppDispatch } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon } from '@wordpress/components';
import { GitHubIcon } from '../../github/github';
import css from '../../github/github-oauth-guard/style.module.css';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';

export function GitHubPrivateRepoAuthModal() {
	const dispatch = useAppDispatch();

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
					repository.
				</p>
				<p>
					To continue, please connect your GitHub account with
					WordPress Playground.
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
