import { signal } from '@preact/signals-react';

import Modal, { defaultStyles } from '../../components/modal';
import GitHubExportForm, { GitHubExportFormProps } from './form';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { addURLState, removeURLState } from '../utils';

const query = new URLSearchParams(window.location.search);
export const isGitHubExportModalOpen = signal(
	query.get('state') === 'github-export'
);

interface GithubExportModalProps {
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
	onExported,
	allowZipExport,
	initialValues,
	initialFilesBeforeChanges,
}: GithubExportModalProps) {
	const playground = usePlaygroundClient();
	return (
		<Modal
			style={{
				...defaultStyles,
				content: { ...defaultStyles.content, width: 600 },
			}}
			isOpen={isGitHubExportModalOpen.value}
			onRequestClose={closeModal}
		>
			<GitHubExportForm
				onClose={closeModal}
				onExported={onExported}
				playground={playground!}
				initialValues={initialValues}
				initialFilesBeforeChanges={initialFilesBeforeChanges}
				allowZipExport={allowZipExport}
			/>
		</Modal>
	);
}
