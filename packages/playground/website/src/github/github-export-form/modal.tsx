import { signal } from '@preact/signals-react';

import Modal, { defaultStyles } from '../../components/modal';
import GitHubExportForm, { GitHubExportFormProps } from './form';
import { getActiveClient, useAppSelector } from '../../lib/redux-store';

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
	const url = new URL(window.location.href);
	url.searchParams.delete('state');
	window.history.replaceState({}, '', url.href);
}
export function openModal() {
	isGitHubExportModalOpen.value = true;
	// Add a ?state=github-export to the URL so that the user can refresh the page
	// and still see the modal.
	const url = new URL(window.location.href);
	url.searchParams.set('state', 'github-export');
	window.history.replaceState({}, '', url.href);
}
export function GithubExportModal({
	onExported,
	allowZipExport,
	initialValues,
	initialFilesBeforeChanges,
}: GithubExportModalProps) {
	const playground = useAppSelector(getActiveClient)?.client;
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
