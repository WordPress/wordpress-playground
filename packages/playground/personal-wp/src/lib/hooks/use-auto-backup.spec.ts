import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldAutoBackup } from './use-auto-backup-utils';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('shouldAutoBackup', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-06T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('waits one interval before backing up a recently created site', () => {
		const recentWhenCreated = Date.now() - DAY_IN_MS / 2;

		expect(shouldAutoBackup('daily', recentWhenCreated)).toBe(false);
	});

	it('backs up a site with no history after the creation interval passes', () => {
		const oldWhenCreated = Date.now() - DAY_IN_MS - 1;

		expect(shouldAutoBackup('daily', oldWhenCreated)).toBe(true);
	});

	it('uses the selected interval for existing backup history', () => {
		expect(shouldAutoBackup('weekly', Date.now() - 6 * DAY_IN_MS)).toBe(
			false
		);
		expect(shouldAutoBackup('weekly', Date.now() - 7 * DAY_IN_MS)).toBe(
			true
		);
		expect(shouldAutoBackup('every-2-days', Date.now() - DAY_IN_MS)).toBe(
			false
		);
	});

	it('falls back to backing up when older sites have no creation time', () => {
		expect(shouldAutoBackup('daily')).toBe(true);
		expect(shouldAutoBackup('none')).toBe(false);
		expect(shouldAutoBackup('ignore')).toBe(false);
	});
});
