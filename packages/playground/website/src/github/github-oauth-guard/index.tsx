import { Icon, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { oAuthState } from '../state';
import { GitHubIcon } from '../github';
import css from './style.module.css';
import { useState } from 'react';
import classNames from 'classnames';
import { Modal } from '../../components/modal';
import { connectToGitHub } from '../connect-to-github';

export function GitHubOAuthGuardModal({
	children,
	intro,
}: GitHubOAuthGuardProps) {
	const [isModalOpen, setIsModalOpen] = useState(!oAuthState.value.token);

	if (oAuthState.value.token && !children) {
		return null;
	}

	if (!isModalOpen) {
		return null;
	}

	return (
		<Modal
			title={__('Connect to GitHub', 'playground-website')}
			onRequestClose={() => {
				setIsModalOpen(false);
			}}
		>
			<GitHubOAuthGuard mayLoseProgress={false} intro={intro}>
				{children}
			</GitHubOAuthGuard>
		</Modal>
	);
}

interface GitHubOAuthGuardProps {
	children?: React.ReactNode;
	mayLoseProgress?: boolean;
	intro?: React.ReactNode;
}
export default function GitHubOAuthGuard({
	children,
	mayLoseProgress,
	intro,
}: GitHubOAuthGuardProps) {
	if (oAuthState.value.isAuthorizing) {
		return (
			<div className={css.authorizing}>
				<Spinner />
				<p>
					{__(
						'Authorization popup opened. Continue in the popup to connect your GitHub account.',
						'playground-website'
					)}
				</p>
			</div>
		);
	}

	if (oAuthState.value.token) {
		return <div>{children}</div>;
	}

	return <Authenticate mayLoseProgress={mayLoseProgress} intro={intro} />;
}

interface AuthenticateProps {
	mayLoseProgress?: boolean;
	intro?: React.ReactNode;
}

function Authenticate({
	mayLoseProgress = undefined,
	intro,
}: AuthenticateProps) {
	const [exported, setExported] = useState(false);
	const [error, setError] = useState<string>();
	const buttonClass = classNames(css.githubButton, {
		[css.disabled]: mayLoseProgress && !exported,
	});

	return (
		<div className={css.authenticate}>
			<p>
				{intro ??
					__(
						'Importing plugins, themes, and wp-content directories directly from your public GitHub repositories.',
						'playground-website'
					)}
			</p>
			<p>
				{__(
					'To enable this feature, connect your GitHub account with WordPress Playground.',
					'playground-website'
				)}
			</p>
			{mayLoseProgress ? (
				<>
					<p>
						{__(
							'The authentication flow opens in a popup. Your running Playground will stay open.',
							'playground-website'
						)}
					</p>
					<label className={css.confirm}>
						<input
							type="checkbox"
							checked={exported}
							onChange={() => setExported(!exported)}
						/>
						{__(
							'I understand, and I have exported my Playground as a zip if needed.',
							'playground-website'
						)}
					</label>
				</>
			) : null}
			<a
				aria-label={__(
					'Connect your GitHub account',
					'playground-website'
				)}
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
				{__('Connect your GitHub account', 'playground-website')}
			</a>
			{error ? (
				<p className={css.error} role="alert">
					{error}
				</p>
			) : null}
			<p className={css.note}>
				{__(
					"Your access token is not stored anywhere, which means you'll have to re-authenticate after every page refresh.",
					'playground-website'
				)}
			</p>
		</div>
	);
}
