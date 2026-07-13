import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	areAutosaveRestoreNotificationsDisabled,
	disableAutosaveRestoreNotifications,
} from './autosave-restore-preference';

describe('autosave restore notification preference', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('persists the opt-out across readers', () => {
		const values = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		});

		expect(areAutosaveRestoreNotificationsDisabled()).toBe(false);
		disableAutosaveRestoreNotifications();
		expect(areAutosaveRestoreNotificationsDisabled()).toBe(true);
	});

	it('degrades to a session dismissal when storage is unavailable', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('unavailable');
			},
			setItem: () => {
				throw new Error('unavailable');
			},
		});

		expect(areAutosaveRestoreNotificationsDisabled()).toBe(false);
		expect(() => disableAutosaveRestoreNotifications()).not.toThrow();
	});
});
