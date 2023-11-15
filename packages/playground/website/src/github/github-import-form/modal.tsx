import { signal } from '@preact/signals-react';
import { usePlaygroundContext } from '../../components/playground-viewport/context';
import Modal, { defaultStyles } from '../../components/modal';
import GitHubForm from './form';

export const isGitHubModalOpen = signal(false);

export function GithubImportModal() {
	const { playground } = usePlaygroundContext();
	function handleImported() {
		playground!.goTo('/');
		// eslint-disable-next-line no-alert
		alert('Import finished! Your Playground site has been updated.');
		isGitHubModalOpen.value = false;
	}
	return (
		<Modal
			style={{
				...defaultStyles,
				content: { ...defaultStyles.content, width: 600 },
			}}
			isOpen={isGitHubModalOpen.value}
			onRequestClose={() => {
				isGitHubModalOpen.value = false;
			}}
		>
			<GitHubForm
				playground={playground!}
				onClose={() => {
					isGitHubModalOpen.value = false;
				}}
				onImported={handleImported}
			/>
		</Modal>
	);
}
