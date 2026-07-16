import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cpuCount: 8 }));

vi.mock('node:os', async () => {
	const actual = await vi.importActual<typeof import('node:os')>('node:os');
	return {
		...actual,
		cpus: () => Array.from({ length: mocks.cpuCount }, () => ({})),
	};
});

import { mergeDefinedConstants, resolveWorkerCount } from '../src/api.js';

beforeEach(() => {
	mocks.cpuCount = 8;
});

describe('public helpers', () => {
	it('merges typed definitions', () => {
		expect(
			mergeDefinedConstants({
				define: { STRING: 'value' },
				'define-bool': { BOOL: true },
				'define-number': { NUMBER: 3 },
			})
		).toEqual({ STRING: 'value', BOOL: true, NUMBER: 3 });
	});

	it('rejects duplicate typed definitions', () => {
		expect(() =>
			mergeDefinedConstants({
				define: { DUP: 'x' },
				'define-bool': { DUP: true },
			})
		).toThrow(/DUP/);
	});

	it('always resolves at least one worker', () => {
		expect(resolveWorkerCount(undefined)).toBeGreaterThanOrEqual(1);
	});

	it('caps automatic worker resolution at the native ceiling', () => {
		mocks.cpuCount = 1_000;
		expect(resolveWorkerCount('auto')).toBe(256);
		expect(resolveWorkerCount(undefined)).toBe(6);
	});
});
