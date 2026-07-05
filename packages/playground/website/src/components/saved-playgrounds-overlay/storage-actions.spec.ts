import { describe, expect, it } from 'vitest';
import { getPlaygroundStorageActions } from './storage-actions';

describe('getPlaygroundStorageActions', () => {
	it('allows local-directory saves even when OPFS is unavailable', () => {
		expect(
			getPlaygroundStorageActions({
				isTemporary: true,
				isAutosave: false,
				isOpfsAvailable: false,
				localFsAvailability: 'available',
			})
		).toEqual({
			canStoreInBrowser: false,
			canSaveToLocal: true,
		});
	});

	it('hides save actions for already-stored Playgrounds', () => {
		expect(
			getPlaygroundStorageActions({
				isTemporary: false,
				isAutosave: false,
				isOpfsAvailable: true,
				localFsAvailability: 'available',
			})
		).toEqual({
			canStoreInBrowser: false,
			canSaveToLocal: false,
		});
	});

	it('requires OPFS only for storing in browser storage', () => {
		expect(
			getPlaygroundStorageActions({
				isTemporary: false,
				isAutosave: true,
				isOpfsAvailable: true,
				localFsAvailability: 'not-available',
			})
		).toEqual({
			canStoreInBrowser: true,
			canSaveToLocal: false,
		});
	});
});
