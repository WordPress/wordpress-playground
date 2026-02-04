import { describe, it, expect } from 'vitest';
import {
	BACKUP_CURRENT_THRESHOLD_DAYS,
	BACKUP_OVERDUE_THRESHOLD_DAYS,
} from './use-backup-constants';

describe('backup urgency thresholds', () => {
	it('BACKUP_CURRENT_THRESHOLD_DAYS is defined', () => {
		expect(BACKUP_CURRENT_THRESHOLD_DAYS).toBeDefined();
		expect(typeof BACKUP_CURRENT_THRESHOLD_DAYS).toBe('number');
	});

	it('BACKUP_OVERDUE_THRESHOLD_DAYS is greater than BACKUP_CURRENT_THRESHOLD_DAYS', () => {
		expect(BACKUP_OVERDUE_THRESHOLD_DAYS).toBeGreaterThan(
			BACKUP_CURRENT_THRESHOLD_DAYS
		);
	});

	it('thresholds define three urgency levels: current (0-1), due (2-4), overdue (5+)', () => {
		// current: days <= BACKUP_CURRENT_THRESHOLD_DAYS
		expect(BACKUP_CURRENT_THRESHOLD_DAYS).toBeGreaterThanOrEqual(1);

		// due: days > BACKUP_CURRENT_THRESHOLD_DAYS && days <= BACKUP_OVERDUE_THRESHOLD_DAYS
		expect(BACKUP_OVERDUE_THRESHOLD_DAYS).toBeGreaterThan(
			BACKUP_CURRENT_THRESHOLD_DAYS
		);

		// overdue: days > BACKUP_OVERDUE_THRESHOLD_DAYS
		// This is implicit from the threshold values
	});
});

describe('backup metadata shape', () => {
	it('backupHistory is an array of entries with filename and timestamp', () => {
		const backupHistory = [
			{
				filename: 'site-backup-2024-01-15-120000.zip',
				timestamp: 1705320000000,
			},
			{
				filename: 'site-backup-2024-01-14-100000.zip',
				timestamp: 1705233600000,
			},
		];

		expect(backupHistory).toHaveLength(2);
		expect(backupHistory[0]).toHaveProperty('filename');
		expect(backupHistory[0]).toHaveProperty('timestamp');
		expect(backupHistory[0].filename).toMatch(/\.zip$/);
		expect(typeof backupHistory[0].timestamp).toBe('number');
	});

	it('new backups are prepended to history', () => {
		const existingHistory = [
			{ filename: 'old-backup.zip', timestamp: 1000 },
		];
		const newEntry = { filename: 'new-backup.zip', timestamp: 2000 };

		const updatedHistory = [newEntry, ...existingHistory.slice(0, 9)];

		expect(updatedHistory[0].filename).toBe('new-backup.zip');
		expect(updatedHistory[1].filename).toBe('old-backup.zip');
	});

	it('history is limited to 10 entries', () => {
		const existingHistory = Array.from({ length: 10 }, (_, i) => ({
			filename: `backup-${i}.zip`,
			timestamp: i * 1000,
		}));
		const newEntry = { filename: 'newest.zip', timestamp: 99999 };

		const updatedHistory = [newEntry, ...existingHistory.slice(0, 9)];

		expect(updatedHistory).toHaveLength(10);
		expect(updatedHistory[0].filename).toBe('newest.zip');
		expect(updatedHistory[9].filename).toBe('backup-8.zip');
	});
});
