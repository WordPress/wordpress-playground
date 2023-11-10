import { useState } from 'react';
import css from './style.module.css';
import Modal from '../../components/modal';
import { usePlaygroundContext } from '../../components/playground-viewport/context';
import GitHubForm from '../github-form';
import GitHubOAuthGuard from '../github-oauth-guard';

export default function GitHubButton() {
	const [isOpen, setOpen] = useState(true);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	const { playground } = usePlaygroundContext();
	function handleImported() {
		// eslint-disable-next-line no-alert
		alert(
			'File imported! This Playground instance has been updated. Refreshing now.'
		);
		closeModal();
		playground!.goTo('/');
	}
	if (!playground) {
		return null;
	}
	return (
		<>
			<button
				id="import-open-modal--btn"
				className={css.btn}
				aria-label="Import from GitHub"
				onClick={openModal}
			>
				GitHub
			</button>

			<Modal isOpen={isOpen} onRequestClose={closeModal}>
				<GitHubOAuthGuard AuthRequest={Authenticate}>
					<GitHubForm
						playground={playground!}
						onClose={closeModal}
						onImported={handleImported}
					/>
				</GitHubOAuthGuard>
			</Modal>
		</>
	);
}

function Authenticate({ authenticateUrl }: { authenticateUrl: string }) {
	return (
		<div>
			<p>
				You can connect your GitHub repositories it you authorize
				Playground to access your GitHub account
			</p>
			<p>
				<a href={authenticateUrl}>Authenticate with GitHub</a>
			</p>
		</div>
	);
}
