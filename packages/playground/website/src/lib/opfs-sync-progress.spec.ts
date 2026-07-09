import { describe, expect, it } from 'vitest';
import { getOpfsSyncProgressPercent } from './opfs-sync-progress';

describe('getOpfsSyncProgressPercent', () => {
	it('returns 0 when progress is missing or total is not positive', () => {
		expect(getOpfsSyncProgressPercent(undefined)).toBe(0);
		expect(getOpfsSyncProgressPercent({ files: 10, total: 0 })).toBe(0);
		expect(getOpfsSyncProgressPercent({ files: 10, total: -1 })).toBe(0);
	});

	it('rounds progress and clamps it into the visible progressbar range', () => {
		expect(getOpfsSyncProgressPercent({ files: 1, total: 3 })).toBe(33);
		expect(getOpfsSyncProgressPercent({ files: -1, total: 3 })).toBe(0);
		expect(getOpfsSyncProgressPercent({ files: 4, total: 3 })).toBe(100);
	});
});
