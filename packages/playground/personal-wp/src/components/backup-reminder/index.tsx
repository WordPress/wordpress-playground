import { useState, useRef } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { importWordPressFiles } from '@wp-playground/client';
import { useActiveSite } from '../../lib/state/redux/store';
import { Icon } from '@wordpress/components';
import { check, backup, upload } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import css from './style.module.css';
import { useBackup } from '../../lib/hooks/use-backup';
import { isSameDay } from '../../lib/utils/date';

function formatRelativeDate(timestamp: number): string {
	const now = new Date();
	const date = new Date(timestamp);
	const diffMs = now.getTime() - timestamp;
	const diffHours = diffMs / (1000 * 60 * 60);

	if (diffHours < 6) {
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		if (diffMinutes < 1) {
			return 'just now';
		} else if (diffMinutes < 60) {
			return diffMinutes === 1
				? '1 minute ago'
				: `${diffMinutes} minutes ago`;
		} else {
			const hours = Math.floor(diffHours);
			return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
		}
	}

	const todayStart = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate()
	);
	const dateStart = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate()
	);
	const diffDays = Math.round(
		(todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
	);

	if (diffDays === 0) {
		return 'today';
	} else if (diffDays === 1) {
		return 'yesterday';
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else {
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
}

export function BackupReminder() {
	const playground = usePlaygroundClient();
	const activeSite = useActiveSite();
	const { performBackup, isBackingUp } = useBackup();
	const [isImporting, setIsImporting] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const importInputRef = useRef<HTMLInputElement>(null);

	if (!activeSite || activeSite.metadata.storage === 'none') {
		return null;
	}

	const { backupHistory = [], lastAccessDate } = activeSite.metadata;
	const lastBackup = backupHistory[0];
	const lastBackupDate = lastBackup?.timestamp;

	const needsBackup =
		!lastBackupDate ||
		(lastAccessDate && !isSameDay(lastBackupDate, lastAccessDate));

	const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !playground) return;

		const proceed = window.confirm(
			'Importing a backup will replace all current content. Are you sure you want to continue?'
		);
		if (!proceed) {
			if (importInputRef.current) {
				importInputRef.current.value = '';
			}
			return;
		}

		setIsImporting(true);
		try {
			await importWordPressFiles(playground, { wordPressFilesZip: file });
			await playground.goTo('/');
			alert('Backup imported successfully! The page will now refresh.');
			window.location.reload();
		} catch (error) {
			logger.error(error);
			alert(
				'Unable to import backup. Is it a valid WordPress Playground export?'
			);
		} finally {
			setIsImporting(false);
			if (importInputRef.current) {
				importInputRef.current.value = '';
			}
		}
	};

	const handleImportClick = () => {
		importInputRef.current?.click();
	};

	const hasHistory = backupHistory.length > 0;
	const { whenCreated } = activeSite.metadata;
	const lastBackupText = lastBackup
		? `Downloaded ${formatRelativeDate(lastBackup.timestamp)}`
		: whenCreated
			? `Created ${formatRelativeDate(whenCreated)}`
			: 'Never backed up';

	const renderLastBackupDate = () => {
		if (!hasHistory) {
			return <span className={css.lastBackupDate}>{lastBackupText}</span>;
		}
		return (
			<button
				className={css.lastBackupDateButton}
				onClick={() => setShowHistory(!showHistory)}
				type="button"
			>
				{lastBackupText}
				<span className={css.historyIndicator}>
					{showHistory ? '▲' : '▼'}
				</span>
			</button>
		);
	};

	return (
		<div className={css.backupReminder}>
			<input
				type="file"
				ref={importInputRef}
				onChange={handleImport}
				accept=".zip,application/zip"
				style={{ display: 'none' }}
			/>
			<div className={css.backupContent}>
				<div className={css.backupStatus}>
					{needsBackup ? (
						<>
							<Icon icon={backup} className={css.backupIcon} />
							<div className={css.statusInfo}>
								<span className={css.statusText}>
									Backup recommended
								</span>
								{renderLastBackupDate()}
							</div>
						</>
					) : (
						<>
							<Icon icon={check} className={css.checkIcon} />
							<div className={css.statusInfo}>
								<span className={css.statusText}>
									Up to date
								</span>
								{renderLastBackupDate()}
							</div>
						</>
					)}
				</div>
				<div className={css.backupActions}>
					<button
						className={css.backupButton}
						onClick={performBackup}
						disabled={!playground || isBackingUp || isImporting}
						type="button"
					>
						{isBackingUp ? 'Backing up...' : 'Download backup'}
					</button>
					<button
						className={css.importButton}
						onClick={handleImportClick}
						disabled={!playground || isBackingUp || isImporting}
						type="button"
					>
						<Icon icon={upload} size={16} />
						{isImporting ? 'Importing...' : 'Import backup'}
					</button>
				</div>
			</div>
			{showHistory && (
				<ul className={css.backupHistoryList}>
					{backupHistory.map((entry, index) => (
						<li key={index} className={css.backupHistoryItem}>
							<span className={css.backupFilename}>
								{entry.filename}
							</span>
							<span className={css.backupDate}>
								{formatRelativeDate(entry.timestamp)}
							</span>
						</li>
					))}
				</ul>
			)}
			<p className={css.backupDescription}>
				Your Playground is stored in this browser. Browser data can be
				cleared unexpectedly, so regular backups keep your work safe.
			</p>
		</div>
	);
}
