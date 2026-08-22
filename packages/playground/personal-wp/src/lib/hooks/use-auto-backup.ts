import { useEffect, useRef } from 'react';
import { useActiveSite, useAppDispatch } from '../state/redux/store';
import { setAutoBackupDue } from '../state/redux/slice-ui';
import { shouldAutoBackup } from './use-auto-backup-utils';

/**
 * Flags the active site as due for a backup once its interval has elapsed.
 * The download itself only happens when the user clicks the prompt that the
 * viewport shows on the Site Tools latch, so no file leaves the device
 * without being asked.
 */
export function useAutoBackup() {
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const promptedSiteSlugRef = useRef<string | null>(null);

	useEffect(() => {
		if (!activeSite) {
			return;
		}

		// Prompt at most once per site visit. Switching sites hides the
		// prompt for the previous site and re-evaluates the new one.
		if (promptedSiteSlugRef.current === activeSite.slug) {
			return;
		}
		promptedSiteSlugRef.current = activeSite.slug;
		dispatch(setAutoBackupDue(false));

		if (activeSite.metadata.storage === 'none') {
			return;
		}

		const {
			autoBackupInterval = 'daily',
			backupHistory = [],
			whenCreated,
		} = activeSite.metadata;
		// When no backup has happened yet, measure the interval against the
		// site's creation time so a brand-new site doesn't prompt at boot.
		const referenceTimestamp = backupHistory[0]?.timestamp ?? whenCreated;

		if (shouldAutoBackup(autoBackupInterval, referenceTimestamp)) {
			dispatch(setAutoBackupDue(true));
		}
	}, [activeSite, dispatch]);
}
