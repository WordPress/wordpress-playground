import { signal } from '@preact/signals-react';
import { usePlaygroundContext } from '../../components/playground-viewport/context';
import Modal, { defaultStyles } from '../../components/modal';
import GitHubExportForm from './form';
import { GitHubPointer } from '../analyze-github-url';

const query = new URLSearchParams(window.location.search);
export const isGitHubExportModalOpen = signal(
	query.get('state') === 'github-export'
);

interface GithubExportModalProps {
	onExported?: (pointer: GitHubPointer) => void;
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
export function GithubExportModal({ onExported }: GithubExportModalProps) {
	const { playground } = usePlaygroundContext();
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
				playground={playground!}
				onClose={closeModal}
				onExported={(pointer) => {
					playground!.goTo('/');
					// eslint-disable-next-line no-alert
					alert(
						'Export finished! Your Playground site has been updated.'
					);
					closeModal();
					onExported?.(pointer);
				}}
			/>
		</Modal>
	);
}
