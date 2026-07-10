// @vitest-environment jsdom

import { forceLinting } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vi } from 'vitest';
import {
	createBlueprintLinter,
	validationStateField,
} from './blueprint-linter';

describe('Blueprint editor linting', () => {
	it.each([
		['v1', { steps: [] }],
		['v2', { version: 2, plugins: ['akismet'] }],
	])('accepts a valid %s declaration', async (_version, blueprint) => {
		const state = await lint(JSON.stringify(blueprint));

		expect(state).toEqual({
			hasErrors: false,
			result: { valid: true },
		});
	});

	it('reports malformed v2 declarations', async () => {
		const state = await lint(
			JSON.stringify({ version: 2, plugins: 'akismet' })
		);

		expect(state.hasErrors).toBe(true);
		expect(state.result).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ instancePath: '/plugins' }),
			]),
		});
	});

	it('reports one useful error for a malformed nested v2 union', async () => {
		const state = await lint(
			JSON.stringify({ version: 2, plugins: [{ source: 123 }] })
		);

		expect(state.hasErrors).toBe(true);
		expect(state.result).toMatchObject({ valid: false });
		const result = state.result;
		if (!result || result.valid) {
			throw new Error('Expected schema validation to fail.');
		}
		expect(result.errors).toEqual([
			expect.objectContaining({
				instancePath: '/plugins/0/source',
				keyword: 'anyOf',
			}),
		]);
	});
});

async function lint(doc: string) {
	const onValidationChange = vi.fn();
	const view = new EditorView({
		state: EditorState.create({
			doc,
			extensions: [createBlueprintLinter(onValidationChange)],
		}),
		parent: document.body,
	});
	forceLinting(view);
	await vi.waitFor(
		() => {
			expect(onValidationChange).toHaveBeenCalled();
		},
		{ timeout: 5000 }
	);
	const state = view.state.field(validationStateField);
	view.destroy();
	return state;
}
