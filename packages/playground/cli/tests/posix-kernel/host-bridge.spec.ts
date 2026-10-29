import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshLoadHostBridge() {
	vi.resetModules();
	const mod = await import('../../src/posix-kernel/host-bridge');
	return mod.loadHostBridge;
}

describe('loadHostBridge (env validation)', () => {
	const envKeys = [
		'KANDELO_DIR',
		'WASM_POSIX_RESOLUTION_POLICY',
		'WASM_POSIX_SOURCE_ONLY_BINARY_ROOT',
	];
	let originalEnv: Record<string, string | undefined>;
	let scratch: string;

	beforeEach(() => {
		originalEnv = Object.fromEntries(
			envKeys.map((key) => [key, process.env[key]])
		);
		scratch = mkdtempSync(join(tmpdir(), 'host-bridge-unit-'));
	});

	afterEach(() => {
		for (const key of envKeys) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
		rmSync(scratch, { recursive: true, force: true });
	});

	it('throws when KANDELO_DIR points at a dir without host/', async () => {
		process.env['KANDELO_DIR'] = scratch;
		const fresh = await freshLoadHostBridge();
		await expect(fresh()).rejects.toThrow(/kandelo checkout not found at/);
	});

	it('throws when the kandelo build output is missing', async () => {
		mkdirSync(join(scratch, 'host'));
		process.env['KANDELO_DIR'] = scratch;
		const fresh = await freshLoadHostBridge();
		await expect(fresh()).rejects.toThrow(
			/kandelo binaries not found at .*bundle-kandelo/
		);
	});

	it('throws when the host build does not export resolveBinary', async () => {
		mkdirSync(join(scratch, 'host', 'dist'), { recursive: true });
		mkdirSync(join(scratch, 'local-binaries', 'source-only-v1'), {
			recursive: true,
		});
		writeFileSync(
			join(scratch, 'host', 'dist', 'index.js'),
			'export class NodeKernelHost {}\n'
		);
		process.env['KANDELO_DIR'] = scratch;
		const fresh = await freshLoadHostBridge();
		await expect(fresh()).rejects.toThrow(/does not export resolveBinary/);
	});

	it('returns the same promise on repeated calls (memoization)', async () => {
		process.env['KANDELO_DIR'] = scratch;
		const fresh = await freshLoadHostBridge();
		const first = fresh();
		const second = fresh();
		first.catch(() => undefined);
		second.catch(() => undefined);
		expect(first).toBe(second);
	});

	it('retries the load after a failed one', async () => {
		process.env['KANDELO_DIR'] = scratch;
		const fresh = await freshLoadHostBridge();
		await expect(fresh()).rejects.toThrow(/kandelo checkout not found at/);
		mkdirSync(join(scratch, 'host'));
		await expect(fresh()).rejects.toThrow(/kandelo binaries not found at/);
	});
});
