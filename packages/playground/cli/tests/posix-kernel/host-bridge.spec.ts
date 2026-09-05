import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadHostBridge } from '../../src/posix-kernel/host-bridge';

async function freshLoadHostBridge() {
	vi.resetModules();
	const mod = await import('../../src/posix-kernel/host-bridge');
	return mod.loadHostBridge;
}

describe('loadHostBridge (env validation)', () => {
	let originalKandeloDir: string | undefined;
	let scratch: string;

	beforeEach(() => {
		originalKandeloDir = process.env['KANDELO_DIR'];
		scratch = mkdtempSync(join(tmpdir(), 'host-bridge-unit-'));
	});

	afterEach(() => {
		if (originalKandeloDir === undefined) {
			delete process.env['KANDELO_DIR'];
		} else {
			process.env['KANDELO_DIR'] = originalKandeloDir;
		}
		rmSync(scratch, { recursive: true, force: true });
	});

	it('throws a clear error when KANDELO_DIR is unset', async () => {
		delete process.env['KANDELO_DIR'];
		const fresh = await freshLoadHostBridge();
		await expect(fresh()).rejects.toThrow(/KANDELO_DIR is not set/);
	});

	it('throws when KANDELO_DIR points at a dir without host/', async () => {
		process.env['KANDELO_DIR'] = scratch;
		const fresh = await freshLoadHostBridge();
		await expect(fresh()).rejects.toThrow(/kandelo checkout not found at/);
	});

	it('returns the same promise on repeated calls (memoization)', () => {
		const first = loadHostBridge();
		const second = loadHostBridge();
		first.catch(() => undefined);
		second.catch(() => undefined);
		expect(first).toBe(second);
	});
});
