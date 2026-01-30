import css from './style.module.css';
import classNames from 'classnames';
import { useActiveSite } from '../../lib/state/redux/store';
import { Icon, Spinner } from '@wordpress/components';
import { backup } from '@wordpress/icons';
import { useBackup } from '../../lib/hooks/use-backup';
import {
	BACKUP_CURRENT_THRESHOLD_DAYS,
	BACKUP_OVERDUE_THRESHOLD_DAYS,
} from '../../lib/hooks/use-backup-constants';
import { isSameDay } from '../../lib/utils/date';

function getDaysSinceBackup(lastBackupTimestamp: number): number {
	const now = Date.now();
	return Math.floor((now - lastBackupTimestamp) / (1000 * 60 * 60 * 24));
}

function formatDaysSinceBackup(days: number): string {
	if (days === 0) return 'Backed up today';
	if (days === 1) return '1 day since backup';
	return `${days} days since backup`;
}

type BackupUrgency = 'current' | 'due' | 'overdue';

function getBackupUrgency(days: number): BackupUrgency {
	if (days <= BACKUP_CURRENT_THRESHOLD_DAYS) return 'current';
	if (days <= BACKUP_OVERDUE_THRESHOLD_DAYS) return 'due';
	return 'overdue';
}

export function BackupStatusIndicator() {
	const activeSite = useActiveSite();
	const { performBackup, isBackingUp, isRequestingRemote, isDependentMode } =
		useBackup();

	const {
		whenCreated,
		backupHistory = [],
		autoBackupInterval,
	} = activeSite?.metadata || {};

	const isTemporarySite = activeSite?.metadata.storage === 'none';
	const lastBackupTimestamp = backupHistory[0]?.timestamp;

	// Hide for temporary sites
	if (isTemporarySite) {
		return null;
	}

	// Hide when auto-backup is configured (any value other than 'none' or undefined)
	if (autoBackupInterval && autoBackupInterval !== 'none') {
		return null;
	}

	// Hide on first day of site creation - no need to prompt for backup yet
	if (whenCreated && isSameDay(whenCreated, Date.now())) {
		return null;
	}

	// Hide if never backed up
	if (!lastBackupTimestamp) {
		return null;
	}

	// Hide if backed up today
	if (isSameDay(lastBackupTimestamp, Date.now())) {
		return null;
	}

	const daysSinceBackup = getDaysSinceBackup(lastBackupTimestamp);

	const urgency = getBackupUrgency(daysSinceBackup);
	const isWorking = isBackingUp || isRequestingRemote;
	const buttonText = isRequestingRemote
		? 'Requesting...'
		: isBackingUp
			? 'Backing up...'
			: formatDaysSinceBackup(daysSinceBackup);
	const tooltipText = isDependentMode
		? 'Click to request a backup from the main tab. Your Playground is stored in this browser and may be cleared unexpectedly.'
		: 'Your Playground is stored in this browser. Browser data can be cleared unexpectedly. Click to download a backup.';

	return (
		<div className={classNames(css.indicator, css[urgency])}>
			<button
				className={classNames(
					css.backupButton,
					css[`${urgency}Button`]
				)}
				onClick={performBackup}
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
