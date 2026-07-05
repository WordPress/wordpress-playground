import type { GitHubExportFormProps } from './form';
import GitHubExportForm from './form';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import { useDispatch } from 'react-redux';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { Modal } from '../../components/modal';

interface GithubExportModalProps {
	allowZipExport: GitHubExportFormProps['allowZipExport'];
	onExported?: GitHubExportFormProps['onExported'];
	initialFilesBeforeChanges?: GitHubExportFormProps['initialFilesBeforeChanges'];
	initialFilesBeforeChangesCommitSha?: GitHubExportFormProps['initialFilesBeforeChangesCommitSha'];
	initialValues?: GitHubExportFormProps['initialValues'];
}
export function GithubExportModal({
	onExported,
	allowZipExport,
	initialValues,
	initialFilesBeforeChanges,
	initialFilesBeforeChangesCommitSha,
}: GithubExportModalProps) {
	const dispatch: PlaygroundDispatch = useDispatch();
	const playground = usePlaygroundClient();

	const closeModal = () => {
		dispatch(setActiveModal(null));
	};

	return (
		<Modal title="Export to GitHub" onRequestClose={closeModal}>
			<GitHubExportForm
				onClose={closeModal}
				onExported={onExported}
				playground={playground!}
				initialValues={initialValues}
				initialFilesBeforeChanges={initialFilesBeforeChanges}
				initialFilesBeforeChangesCommitSha={
					initialFilesBeforeChangesCommitSha
				}
				allowZipExport={allowZipExport}
			/>
		</Modal>
	);
}
