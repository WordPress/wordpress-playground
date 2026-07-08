import { opfsSiteStorage } from './opfs-site-storage';
import type { SiteInfo } from '../redux/slice-sites';

type SiteResetChanges = {
	loadedFromStorage?: SiteInfo['loadedFromStorage'];
	metadata: SiteInfo['metadata'];
	originalUrlParams: SiteInfo['originalUrlParams'];
};

/**
 * Deletes old WordPress files before an autosave boots from a different setup.
 *
 * Why the files need to be deleted:
 *
 * Autosaved Playgrounds keep the same sidebar entry and OPFS directory when the
 * user clicks "Apply Settings & Recreate Playground" or "Run Blueprint and
 * reset site". The metadata changes first: `wp-runtime.json` starts describing
 * the new setup or edited Blueprint. The WordPress files in that OPFS directory
 * still came from the previous setup, so they must be removed before the next
 * boot. Otherwise Playground would open the previous WordPress site while the
 * metadata says it should be using the new setup.
 *
 * How this makes that deletion safe across tab closes:
 *
 * 1. Write `opfsSiteRemovalPending: true` into `wp-runtime.json`.
 * 2. Delete the old WordPress files. `removeWordPressFilesKeepMetadata()`
 *    keeps `wp-runtime.json` and the editable Blueprint bundle directory.
 * 3. Clear `opfsSiteRemovalPending`.
 *
 * If the tab closes after step 1 or during step 2, the next boot sees
 * `opfsSiteRemovalPending` and repeats the deletion before it mounts or
 * installs anything. That leaves the OPFS directory ready for the new setup
 * instead of opening files from the previous autosave.
 *
 * Do not use this when the existing WordPress files can keep running, such as
 * changing PHP version or networking. Those should update metadata and reboot
 * the same files. Longer term, the Dock UI should create a new Playground for
 * setup changes instead of deleting files from the current autosave; this
 * helper only protects today's behavior of deleting and recreating files under
 * the same autosaved slug.
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
			opfsSiteRemovalPending: true,
		},
	};
	const completedChanges = {
		...changes,
		metadata: {
			...changes.metadata,
			opfsSiteRemovalPending: undefined,
		},
	};

	await opfsSiteStorage.update(
		siteSlug,
		pendingChanges.metadata,
		pendingChanges.originalUrlParams
	);
	await opfsSiteStorage.removeWordPressFilesKeepMetadata(siteSlug);
	await opfsSiteStorage.update(
		siteSlug,
		completedChanges.metadata,
		completedChanges.originalUrlParams
	);

	return completedChanges;
}
