import { useEffect, useRef } from 'react';
import { usePlaygroundClient } from '../use-playground-client';
import { useActiveSite } from '../state/redux/store';
import { useBackup } from './use-backup';
import { shouldAutoBackup } from './use-auto-backup-utils';

export function useAutoBackup() {
	const playground = usePlaygroundClient();
	const activeSite = useActiveSite();
	const { performBackup } = useBackup();
	const hasTriggeredRef = useRef(false);
	const siteSlugRef = useRef<string | null>(null);

	useEffect(() => {
		if (!playground || !activeSite) {
			return;
		}

		// Reset trigger flag when switching to a different site
		if (siteSlugRef.current !== activeSite.slug) {
			siteSlugRef.current = activeSite.slug;
			hasTriggeredRef.current = false;
		}

		if (hasTriggeredRef.current) {
			return;
		}

		if (activeSite.metadata.storage === 'none') {
			return;
		}

		const {
			autoBackupInterval = 'daily',
			backupHistory = [],
			whenCreated,
		} = activeSite.metadata;
		// When no backup has happened yet, measure the interval against the
		// site's creation time so a brand-new site doesn't auto-backup at boot.
		const referenceTimestamp = backupHistory[0]?.timestamp ?? whenCreated;

		if (!shouldAutoBackup(autoBackupInterval, referenceTimestamp)) {
			return;
		}

		hasTriggeredRef.current = true;

		// Delay the backup slightly to let the UI settle after WordPress boots
		const timeoutId = setTimeout(() => {
			performBackup();
		}, 3000);

		return () => {
			clearTimeout(timeoutId);
		};
	}, [playground, activeSite, performBackup]);
}
