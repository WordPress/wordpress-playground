import { Icon, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { oAuthState } from '../state';
import { GitHubIcon } from '../github';
import css from './style.module.css';
import { useState } from 'react';
import classNames from 'classnames';
import { useActiveSite } from '../../lib/state/redux/store';
import { Modal } from '../../components/modal';

const OAUTH_FLOW_URL = 'oauth.php?redirect=1';
const urlParams = new URLSearchParams(window.location.search);
export const oauthCode = urlParams.get('code');

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
			title={__('Connect to GitHub', 'playground-website')}
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
				{__('Authorizing...', 'playground-website')}
			</div>
		);
	}

	if (oAuthState.value.token) {
		return <div>{children}</div>;
	}

	const urlParams = new URLSearchParams();
	const cleanUrl = new URL(window.location.href);
	cleanUrl.searchParams.delete('code');
	urlParams.set('redirect_uri', cleanUrl.toString());
	const oauthUrl = `${OAUTH_FLOW_URL}&${urlParams.toString()}`;
	return (
		<Authenticate
			authenticateUrl={oauthUrl}
			mayLoseProgress={mayLoseProgress}
		/>
	);
}

interface AuthenticateProps {
	authenticateUrl: string;
	mayLoseProgress?: boolean;
}

function Authenticate({
	authenticateUrl,
	mayLoseProgress = undefined,
}: AuthenticateProps) {
	const storage = useActiveSite()?.metadata?.storage;

	if (mayLoseProgress === undefined) {
		mayLoseProgress = storage === 'none';
	}
	const [exported, setExported] = useState(false);
	const buttonClass = classNames(css.githubButton, {
		[css.disabled]: mayLoseProgress && !exported,
	});
	return (
		<div>
			<p>
				{__(
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
						<b>
							{__(
								'You will lose your progress.',
								'playground-website'
							)}
						</b>{' '}
						{__(
							'Your Playground is temporary and the authentication flow will redirect you to GitHub and erase all your changes. Be sure to export your Playground to a zip file before proceeding.',
							'playground-website'
						)}
					</p>
					<label style={{ cursor: 'pointer' }}>
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
			<p>
				<a
					aria-label={__(
						'Connect your GitHub account',
						'playground-website'
					)}
					className={buttonClass}
					href={authenticateUrl}
					onClick={(e) => {
						if (mayLoseProgress && !exported) {
							e.preventDefault();
						}
					}}
				>
					<Icon icon={GitHubIcon} />
					{__('Connect your GitHub account', 'playground-website')}
				</a>
			</p>
			<p>
				{__(
					"Your access token is not stored anywhere, which means you'll have to re-authenticate after every page refresh.",
					'playground-website'
				)}
			</p>
		</div>
	);
}
