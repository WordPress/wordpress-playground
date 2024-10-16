import { signal } from '@preact/signals-react';
import Modal, { defaultStyles } from '../../components/modal';
import GitHubImportForm, { GitHubImportFormProps } from './form';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { addURLState, removeURLState } from '../utils';
import { useEffect, useState } from 'react';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';

const query = new URLSearchParams(window.location.search);
export const isGitHubModalOpen = signal(query.get('state') === 'github-import');

interface GithubImportModalProps {
	defaultOpen?: boolean;
	onImported?: GitHubImportFormProps['onImported'];
}
export function closeModal() {
	isGitHubModalOpen.value = false;
	// Remove ?state=github-import from the URL.
	removeURLState();
}
export function openModal() {
	isGitHubModalOpen.value = true;
	// Add a ?state=github-import to the URL so that the user can refresh the page
	// and still see the modal.
	addURLState('github-import');
}
export function GithubImportModal({ defaultOpen, onImported }: GithubImportModalProps) {
	const dispatch: PlaygroundDispatch = useDispatch();
	const playground = usePlaygroundClient();
	const [isOpen, toggleOpen] = useState(defaultOpen || isGitHubModalOpen.value);
	useEffect(() => {
		toggleOpen(defaultOpen || isGitHubModalOpen.value);
	}, [defaultOpen, isGitHubModalOpen.value]);
	const handleOnClose = () => {
		toggleOpen(false);
		closeModal();
		dispatch(setActiveModal(null));
	}
	return (
		<Modal
			style={{
				...defaultStyles,
				content: { ...defaultStyles.content, width: 600 },
			}}
			isOpen={isOpen}
			onRequestClose={handleOnClose}
		>
			<GitHubImportForm
				playground={playground!}
				onClose={handleOnClose}
				onImported={(details) => {
					playground!.goTo('/');
					// eslint-disable-next-line no-alert
					alert(
						'Import finished! Your Playground site has been updated.'
					);
					handleOnClose();
					onImported?.(details);
				}}
			/>
		</Modal>
	);
}
