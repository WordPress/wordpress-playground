import { describe, expect, it } from 'vitest';
import { isValidBlueprintDraft } from './is-valid-blueprint-draft';

describe('isValidBlueprintDraft', () => {
	it('accepts JSON objects', () => {
		expect(isValidBlueprintDraft('{"steps":[]}')).toBe(true);
	});

	it('rejects valid JSON values that are not objects', () => {
		expect(isValidBlueprintDraft('[]')).toBe(false);
		expect(isValidBlueprintDraft('null')).toBe(false);
		expect(isValidBlueprintDraft('"blueprint"')).toBe(false);
		expect(isValidBlueprintDraft('42')).toBe(false);
	});

	it('rejects empty or invalid JSON', () => {
		expect(isValidBlueprintDraft('')).toBe(false);
		expect(isValidBlueprintDraft('{')).toBe(false);
	});
});
