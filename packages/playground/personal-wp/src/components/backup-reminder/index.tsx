import { useState, useRef } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { importWordPressFiles } from '@wp-playground/client';
import { useActiveSite, useAppDispatch } from '../../lib/state/redux/store';
import { Icon } from '@wordpress/components';
import { check, backup, upload } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import css from './style.module.css';
import { useBackup } from '../../lib/hooks/use-backup';
import { isSameDay } from '../../lib/utils/date';
import { getRelativeDate } from '../../lib/utils/get-relative-date';
import { updateSiteMetadata } from '../../lib/state/redux/slice-sites';
import type { SiteMetadata } from '../../lib/state/redux/slice-sites';

type AutoBackupInterval = NonNullable<SiteMetadata['autoBackupInterval']>;

const autoBackupOptions: { value: AutoBackupInterval; label: string }[] = [
	{ value: 'none', label: 'No auto-download' },
	{ value: 'daily', label: 'Auto-download daily' },
	{ value: 'every-2-days', label: 'Auto-download every 2 days' },
	{ value: 'weekly', label: 'Auto-download weekly' },
	{ value: 'ignore', label: 'Ignore backups' },
];

export function BackupReminder() {
	const playground = usePlaygroundClient();
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const { performBackup, isBackingUp, isRequestingRemote } = useBackup();
	const [isImporting, setIsImporting] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const importInputRef = useRef<HTMLInputElement>(null);

	// TODO: Support local directory sites. With a directory handle, we could
	// automatically backup to the user's filesystem once a day or on site open.
	if (!activeSite || activeSite.metadata.storage === 'none') {
		return null;
	}

	const { backupHistory = [], autoBackupInterval = 'none' } =
		activeSite.metadata;
	const lastBackup = backupHistory[0];
	const lastBackupDate = lastBackup?.timestamp;

	const needsBackup =
		!lastBackupDate || !isSameDay(lastBackupDate, Date.now());

	const handleAutoBackupChange = (
		e: React.ChangeEvent<HTMLSelectElement>
	) => {
		const newInterval = e.target.value as AutoBackupInterval;
		dispatch(
			updateSiteMetadata({
				slug: activeSite.slug,
				changes: { autoBackupInterval: newInterval },
			})
		);
	};

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
		? `Downloaded ${getRelativeDate(new Date(lastBackup.timestamp))}`
		: whenCreated
			? `Created ${getRelativeDate(new Date(whenCreated))}`
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
						disabled={
							!playground ||
							isBackingUp ||
							isRequestingRemote ||
							isImporting
						}
						type="button"
					>
						{isRequestingRemote
							? 'Requesting...'
							: isBackingUp
								? 'Backing up...'
								: 'Download backup'}
					</button>
					<select
						className={css.autoBackupSelect}
						value={autoBackupInterval}
						onChange={handleAutoBackupChange}
					>
						{autoBackupOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<button
						className={css.importButton}
						onClick={handleImportClick}
						disabled={
							!playground ||
							isBackingUp ||
							isRequestingRemote ||
							isImporting
						}
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
								{getRelativeDate(new Date(entry.timestamp))}
							</span>
						</li>
					))}
				</ul>
			)}
			<p className={css.backupDescription}>
				Your Playground is stored in this browser. Browser data can be
				cleared unexpectedly, so regular backups keep your WordPress
				safe.
			</p>
		</div>
	);
}
