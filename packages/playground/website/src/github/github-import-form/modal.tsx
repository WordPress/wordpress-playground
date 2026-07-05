import type { GitHubImportFormProps } from './form';
import GitHubImportForm from './form';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { type PlaygroundDispatch } from '../../lib/state/redux/store';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { useDispatch } from 'react-redux';
import { Modal } from '../../components/modal';
import { logger } from '@php-wasm/logger';
import {
	createGitHubImportBaselineForExport,
	rememberGitHubImportBaselineForExport,
} from '../github-export-form/import-baseline';

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

	const closeModal = () => {
		dispatch(setActiveModal(null));
	};

	const createSiteForImport = async () => {
		try {
			await sitesAPI.createNewTemporarySite();
			const temporaryClient = sitesAPI.getClient();
			await sitesAPI.saveInBrowser();
			// Saving a temporary Playground changes `whenCreated`, which remounts
			// the iframe. Import into the post-save client, not the temporary iframe
			// that React is about to remove.
			return await waitForSavedImportClient(sitesAPI, temporaryClient);
		} catch (error) {
			logger.error(
				'Error creating saved Playground for GitHub import; falling back to a temporary Playground.',
				error
			);
			await sitesAPI.createNewTemporarySite();
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
					const activeSiteSlug = sitesAPI
						.list()
						.find((site) => site.isActive)?.slug;
					if (activeSiteSlug) {
						rememberGitHubImportBaselineForExport(
							activeSiteSlug,
							createGitHubImportBaselineForExport(details)
						);
					}
					// eslint-disable-next-line no-alert
					alert(
						'Import finished! Your Playground site has been updated.'
					);
					onImported?.(details);
					closeModal();
				}}
			/>
		</Modal>
	);
}

async function waitForSavedImportClient(
	sitesAPI: ReturnType<typeof useSitesAPI>,
	temporaryClient: GitHubImportFormProps['playground'] | undefined
) {
	const timeoutAt = Date.now() + 30_000;
	while (Date.now() < timeoutAt) {
		await waitForNextFrame();
		const client = sitesAPI.getClient();
		if (client && client !== temporaryClient) {
			await client.isReady();
			return client;
		}
	}
	throw new Error(
		'Timed out waiting for the saved Playground to boot before GitHub import.'
	);
}

function waitForNextFrame() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}
