import type { GitHubImportFormProps } from './form';
import GitHubImportForm from './form';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import {
	setActiveModal,
	setDockOperationNotice,
} from '../../lib/state/redux/slice-ui';
import { selectTemporarySite } from '../../lib/state/redux/slice-sites';
import {
	type PlaygroundDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { useDispatch } from 'react-redux';
import { Modal } from '../../components/modal';
import { getGitHubImportSuccessTitle } from './import-labels';

interface GithubImportModalProps {
	defaultOpen?: boolean;
	createNewSiteBeforeImport?: boolean;
	onImported?: GitHubImportFormProps['onImported'];
}
export function GithubImportModal({
	defaultOpen,
	createNewSiteBeforeImport,
	onImported,
}: GithubImportModalProps) {
	const dispatch: PlaygroundDispatch = useDispatch();
	const playground = usePlaygroundClient();
	const sitesAPI = useSitesAPI();
	const temporarySite = useAppSelector(selectTemporarySite);

	const closeModal = () => {
		dispatch(setActiveModal(null));
	};

	const createSiteForImport = async () => {
		try {
			await sitesAPI.createNewTemporarySite();
			await sitesAPI.saveInBrowser();
		} catch {
			if (temporarySite) {
				await sitesAPI.setActiveSite(temporarySite.slug);
			} else {
				await sitesAPI.createNewTemporarySite();
			}
		}
		const client = sitesAPI.getClient();
		if (!client) {
			throw new Error('No active Playground to import into.');
		}
		return client;
	};

	return (
		<Modal title="Import from GitHub" onRequestClose={closeModal}>
			<GitHubImportForm
				playground={playground!}
				getPlaygroundBeforeImport={
					createNewSiteBeforeImport ? createSiteForImport : undefined
				}
				onClose={closeModal}
				onImported={(details) => {
					onImported?.(details);
					closeModal();
					dispatch(
						setDockOperationNotice({
							status: 'success',
							title: getGitHubImportSuccessTitle(
								details.pluginOrThemeName,
								details.contentType
							),
						})
					);
				}}
			/>
		</Modal>
	);
}
