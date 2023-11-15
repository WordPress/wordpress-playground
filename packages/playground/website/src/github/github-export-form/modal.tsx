import { signal } from '@preact/signals-react';
import { usePlaygroundContext } from '../../components/playground-viewport/context';
import Modal, { defaultStyles } from '../../components/modal';
import GitHubExportForm from './form';
import { GitHubPointer } from '../analyze-github-url';

export const isGitHubExportModalOpen = signal(false);

interface GithubExportModalProps {
	onExported?: (pointer: GitHubPointer) => void;
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
			onRequestClose={() => {
				isGitHubExportModalOpen.value = false;
			}}
		>
			<GitHubExportForm
				playground={playground!}
				onClose={() => {
					isGitHubExportModalOpen.value = false;
				}}
				onExported={(pointer) => {
					playground!.goTo('/');
					// eslint-disable-next-line no-alert
					alert(
						'Export finished! Your Playground site has been updated.'
					);
					isGitHubExportModalOpen.value = false;
					onExported?.(pointer);
				}}
			/>
		</Modal>
	);
}
