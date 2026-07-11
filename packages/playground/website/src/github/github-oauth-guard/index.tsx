import { Icon, Spinner } from '@wordpress/components';
import { oAuthState } from '../state';
import { GitHubIcon } from '../github';
import css from './style.module.css';
import { useState } from 'react';
import classNames from 'classnames';
import { Modal } from '../../components/modal';
import { connectToGitHub } from '../connect-to-github';

export function GitHubOAuthGuardModal({ children }: GitHubOAuthGuardProps) {
	const [isModalOpen, setIsModalOpen] = useState(!oAuthState.value.token);

	if (oAuthState.value.token && !children) {
		return null;
	}

	if (!isModalOpen) {
		return null;
	}

	return (
		<Modal
			title="Connect to GitHub"
			onRequestClose={() => {
				setIsModalOpen(false);
			}}
		>
			<GitHubOAuthGuard mayLoseProgress={false}>
				{children}
			</GitHubOAuthGuard>
		</Modal>
	);
}

interface GitHubOAuthGuardProps {
	children?: React.ReactNode;
	mayLoseProgress?: boolean;
}
export default function GitHubOAuthGuard({
	children,
	mayLoseProgress,
}: GitHubOAuthGuardProps) {
	if (oAuthState.value.isAuthorizing) {
		return (
			<div>
				<Spinner />
				<p>
					Authorization popup opened. Continue in the popup to connect
					your GitHub account.
				</p>
			</div>
		);
	}

	if (oAuthState.value.token) {
		return <div>{children}</div>;
	}

	return <Authenticate mayLoseProgress={mayLoseProgress} />;
}

interface AuthenticateProps {
	mayLoseProgress?: boolean;
}

function Authenticate({ mayLoseProgress = undefined }: AuthenticateProps) {
	const [exported, setExported] = useState(false);
	const [error, setError] = useState<string>();
	const buttonClass = classNames(css.githubButton, {
		[css.disabled]: mayLoseProgress && !exported,
	});

	return (
		<div>
			<p>
				Importing plugins, themes, and wp-content directories directly
				from your public GitHub repositories.
			</p>
			<p>
				To enable this feature, connect your GitHub account with
				WordPress Playground.
			</p>
			{mayLoseProgress ? (
				<>
					<p>
						The authentication flow opens in a popup. Your running
						Playground will stay open.
					</p>
					<label style={{ cursor: 'pointer' }}>
						<input
							type="checkbox"
							checked={exported}
							onChange={() => setExported(!exported)}
						/>
						I understand, and I have exported my Playground as a zip
						if needed.
					</label>
				</>
			) : null}
			<p>
				<a
					aria-label="Connect your GitHub account"
					className={buttonClass}
					href={new URL('oauth.php', window.location.href).toString()}
					onClick={async (e) => {
						e.preventDefault();
						if (mayLoseProgress && !exported) {
							return;
						}
						await connectToGitHub({ setError });
					}}
				>
					<Icon icon={GitHubIcon} />
					Connect your GitHub account
				</a>
			</p>
			{error ? <p role="alert">{error}</p> : null}
			<p>
				Your access token is not stored anywhere, which means you'll
				have to re-authenticate after every page refresh.
			</p>
		</div>
	);
}
