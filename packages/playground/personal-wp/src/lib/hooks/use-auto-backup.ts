import { useEffect, useRef } from 'react';
import { usePlaygroundClient } from '../use-playground-client';
import { useActiveSite, useAppDispatch } from '../state/redux/store';
import { setBackgroundNotice } from '../state/redux/slice-ui';
import { useBackup } from './use-backup';
import { shouldAutoBackup } from './use-auto-backup-utils';

const NOTICE_DURATION_MS = 6000;

export function useAutoBackup() {
	const playground = usePlaygroundClient();
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
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
		let noticeTimeoutId: ReturnType<typeof setTimeout> | undefined;
		const timeoutId = setTimeout(async () => {
			const succeeded = await performBackup();
			if (!succeeded) {
				return;
			}
			// This is the one moment the app moves data off the device without
			// being asked. Saying so is the difference between a private
			// product and one that merely claims to be.
			dispatch(
				setBackgroundNotice('Backup saved to your Downloads folder')
			);
			noticeTimeoutId = setTimeout(() => {
				dispatch(setBackgroundNotice(null));
			}, NOTICE_DURATION_MS);
		}, 3000);

		return () => {
			clearTimeout(timeoutId);
			clearTimeout(noticeTimeoutId);
		};
	}, [playground, activeSite, performBackup, dispatch]);
}
