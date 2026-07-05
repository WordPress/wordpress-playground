import { opfsSiteStorage } from './opfs-site-storage';
import type { SiteInfo } from '../redux/slice-sites';

type SiteResetChanges = {
	metadata: SiteInfo['metadata'];
	originalUrlParams: SiteInfo['originalUrlParams'];
};

/**
 * Persists new autosave setup metadata and clears old WordPress files.
 *
 * The pending marker must be durable before files are removed. If the tab
 * crashes after the first metadata write, the next boot can finish the reset
 * before it decides whether the old WordPress files are still usable.
 */
export async function resetAutosavedSiteFilesWithPendingMarker(
	siteSlug: string,
	changes: SiteResetChanges
): Promise<SiteResetChanges> {
	if (!opfsSiteStorage) {
		throw new Error(
			'Cannot recreate autosaved Playground because browser storage is not available.'
		);
	}

	const pendingChanges = {
		...changes,
		metadata: {
			...changes.metadata,
			opfsResetPending: true,
		},
	};
	const completedChanges = {
		...changes,
		metadata: {
			...changes.metadata,
			opfsResetPending: undefined,
		},
	};

	await opfsSiteStorage.update(
		siteSlug,
		pendingChanges.metadata,
		pendingChanges.originalUrlParams
	);
	await opfsSiteStorage.resetSiteFiles(siteSlug);
	await opfsSiteStorage.update(
		siteSlug,
		completedChanges.metadata,
		completedChanges.originalUrlParams
	);

	return completedChanges;
}
