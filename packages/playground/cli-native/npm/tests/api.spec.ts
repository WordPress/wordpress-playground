import { describe, expect, it } from 'vitest';
import { mergeDefinedConstants, resolveWorkerCount } from '../src/api.js';

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
});
