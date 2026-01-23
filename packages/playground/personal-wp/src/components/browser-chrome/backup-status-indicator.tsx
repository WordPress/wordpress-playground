import { useEffect, useRef } from 'react';
import css from './style.module.css';
import classNames from 'classnames';
import { useActiveSite, useAppDispatch } from '../../lib/state/redux/store';
import { Icon, Spinner } from '@wordpress/components';
import { backup } from '@wordpress/icons';
import { updateSiteMetadata } from '../../lib/state/redux/slice-sites';
import { useBackup } from '../../lib/hooks/use-backup';
import {
	BACKUP_CURRENT_THRESHOLD_DAYS,
	BACKUP_OVERDUE_THRESHOLD_DAYS,
} from '../../lib/hooks/use-backup-constants';
import { isSameDay } from '../../lib/utils/date';

function formatUsageDays(days: number): string {
	if (days === 1) return '1 day since backup';
	return `${days} days since backup`;
}

type BackupUrgency = 'current' | 'due' | 'overdue';

function getBackupUrgency(daysUsed: number): BackupUrgency {
	if (daysUsed <= BACKUP_CURRENT_THRESHOLD_DAYS) return 'current';
	if (daysUsed <= BACKUP_OVERDUE_THRESHOLD_DAYS) return 'due';
	return 'overdue';
}

export function BackupStatusIndicator() {
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const { performBackup, isBackingUp } = useBackup();
	const lastCheckedDateRef = useRef<string>(new Date().toDateString());
	const daysUsedRef = useRef<number>(0);

	const {
		lastAccessDate,
		whenCreated,
		daysUsedSinceLastBackup = 0,
	} = activeSite?.metadata || {};

	// Keep ref in sync with current value
	daysUsedRef.current = daysUsedSinceLastBackup;

	const siteSlug = activeSite?.slug;
	const isTemporarySite = activeSite?.metadata.storage === 'none';

	// Check for day change when tab becomes visible or periodically
	useEffect(() => {
		if (!siteSlug || isTemporarySite) {
			return;
		}

		const checkForNewDay = () => {
			const today = new Date().toDateString();
			if (today !== lastCheckedDateRef.current) {
				lastCheckedDateRef.current = today;
				// It's a new day - increment the counter
				dispatch(
					updateSiteMetadata({
						slug: siteSlug,
						changes: {
							lastAccessDate: Date.now(),
							daysUsedSinceLastBackup: daysUsedRef.current + 1,
						},
					})
				);
			}
		};

		// Check when tab becomes visible
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				checkForNewDay();
			}
		};

		// Also check periodically (every minute) in case tab stays visible overnight
		const interval = setInterval(checkForNewDay, 60000);

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			document.removeEventListener(
				'visibilitychange',
				handleVisibilityChange
			);
			clearInterval(interval);
		};
	}, [siteSlug, isTemporarySite, dispatch]);

	// Only show backup indicator if user has returned after creation day
	const hasReturnedAfterCreation =
		whenCreated &&
		lastAccessDate &&
		!isSameDay(whenCreated, lastAccessDate);

	// Hide on first day - no need to prompt for backup yet
	if (!hasReturnedAfterCreation) {
		return null;
	}

	// Hide if no usage since last backup (or site is new with 0 days tracked)
	if (daysUsedSinceLastBackup === 0) {
		return null;
	}

	const urgency = getBackupUrgency(daysUsedSinceLastBackup);
	const isWorking = isBackingUp;
	const buttonText = isBackingUp
		? 'Backing up...'
		: formatUsageDays(daysUsedSinceLastBackup);
	const tooltipText =
		'Your Playground is stored in this browser. Browser data can be cleared unexpectedly. Click to download a backup.';
	const handleClick = performBackup;

	return (
		<div className={classNames(css.indicator, css[urgency])}>
			<button
				className={classNames(
					css.backupButton,
					css[`${urgency}Button`]
				)}
				onClick={handleClick}
				disabled={isWorking}
				type="button"
				title={tooltipText}
			>
				{isWorking ? <Spinner /> : <Icon icon={backup} size={16} />}
				{buttonText}
			</button>
		</div>
	);
}
