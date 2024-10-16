import { signal } from '@preact/signals-react';

import Modal, { defaultStyles } from '../../components/modal';
import GitHubExportForm, { GitHubExportFormProps } from './form';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { addURLState, removeURLState } from '../utils';
import { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { setActiveModal } from '../../lib/state/redux/slice-ui';

const query = new URLSearchParams(window.location.search);
export const isGitHubExportModalOpen = signal(
	query.get('state') === 'github-export'
);

interface GithubExportModalProps {
	defaultOpen?: boolean;
	allowZipExport: GitHubExportFormProps['allowZipExport'];
	onExported?: GitHubExportFormProps['onExported'];
	initialFilesBeforeChanges?: GitHubExportFormProps['initialFilesBeforeChanges'];
	initialValues?: GitHubExportFormProps['initialValues'];
}
export function closeModal() {
	isGitHubExportModalOpen.value = false;
	// Remove ?state=github-export from the URL.
	removeURLState();
}
export function openModal() {
	isGitHubExportModalOpen.value = true;
	// Add a ?state=github-export to the URL so that the user can refresh the page
	// and still see the modal.
	addURLState('github-export');
}
export function GithubExportModal({
    defaultOpen,
	onExported,
	allowZipExport,
	initialValues,
	initialFilesBeforeChanges,
}: GithubExportModalProps) {
	const dispatch: PlaygroundDispatch = useDispatch();
	const playground = usePlaygroundClient();
	const [isOpen, toggleOpen] = useState(defaultOpen || isGitHubExportModalOpen.value);
	useEffect(() => {
		toggleOpen(defaultOpen || isGitHubExportModalOpen.value);
	}, [defaultOpen, isGitHubExportModalOpen.value]);
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
			<GitHubExportForm
				onClose={handleOnClose}
				onExported={onExported}
				playground={playground!}
				initialValues={initialValues}
				initialFilesBeforeChanges={initialFilesBeforeChanges}
				allowZipExport={allowZipExport}
			/>
		</Modal>
	);
}
