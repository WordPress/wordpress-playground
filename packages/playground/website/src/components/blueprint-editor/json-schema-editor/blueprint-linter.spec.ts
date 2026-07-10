// @vitest-environment jsdom

import {
	diagnosticCount,
	forceLinting,
	forEachDiagnostic,
} from '@codemirror/lint';
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
		const { validationState } = await lint(JSON.stringify(blueprint));

		expect(validationState).toEqual({
			hasErrors: false,
			result: { valid: true },
		});
	});

	it('reports malformed v2 declarations', async () => {
		const { validationState } = await lint(
			JSON.stringify({ version: 2, plugins: 'akismet' })
		);

		expect(validationState.hasErrors).toBe(true);
		expect(validationState.result).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ instancePath: '/plugins' }),
			]),
		});
	});

	it('reports one useful error for a malformed nested v2 union', async () => {
		const doc = JSON.stringify({
			version: 2,
			plugins: [{ source: 123 }],
		});
		const { validationState, diagnostics, count } = await lint(doc);

		expect(validationState.hasErrors).toBe(true);
		expect(validationState.result).toMatchObject({ valid: false });
		const result = validationState.result;
		if (!result || result.valid) {
			throw new Error('Expected schema validation to fail.');
		}
		expect(result.errors).toEqual([
			expect.objectContaining({
				instancePath: '/plugins/0/source',
				keyword: 'anyOf',
			}),
		]);
		expect(count).toBe(1);
		expect(diagnostics).toHaveLength(1);
		expect(doc.slice(diagnostics[0].from, diagnostics[0].to)).toBe('123');
	});

	it('treats a multi-digit JSON Pointer segment as one array index', async () => {
		const doc = JSON.stringify({
			version: 2,
			plugins: [
				...Array.from({ length: 10 }, () => 'akismet'),
				{ source: 123 },
			],
		});
		const { validationState, diagnostics, count } = await lint(doc);

		expect(validationState.result).toMatchObject({
			valid: false,
			errors: [
				expect.objectContaining({ instancePath: '/plugins/10/source' }),
			],
		});
		expect(count).toBe(1);
		expect(diagnostics).toHaveLength(1);
		expect(doc.slice(diagnostics[0].from, diagnostics[0].to)).toBe('123');
	});

	it.each([
		['a numeric object key', { version: 2, postTypes: { '10': null } }],
		[
			'an RFC 6901-escaped slash',
			{ version: 2, siteOptions: { 'slash/key': null } },
		],
		[
			'an RFC 6901-escaped tilde',
			{ version: 2, siteOptions: { 'tilde~key': null } },
		],
		[
			'an escaped tilde before a literal 1',
			{ version: 2, siteOptions: { 'tilde~1key': null } },
		],
		['an empty object key', { version: 2, siteOptions: { '': null } }],
	])('highlights the value under %s', async (_description, blueprint) => {
		const doc = JSON.stringify(blueprint);
		const { diagnostics, count } = await lint(doc);

		expect(count).toBe(1);
		expect(diagnostics).toHaveLength(1);
		expect(doc.slice(diagnostics[0].from, diagnostics[0].to)).toBe('null');
	});

	it('highlights an unknown property and its value', async () => {
		const doc = JSON.stringify({ version: 2, pluginz: [] });
		const { diagnostics, count } = await lint(doc);

		expect(count).toBe(1);
		expect(diagnostics).toHaveLength(1);
		expect(doc.slice(diagnostics[0].from, diagnostics[0].to)).toBe(
			'"pluginz":[]'
		);
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
			const validationState = view.state.field(validationStateField);
			if (validationState.hasErrors) {
				expect(diagnosticCount(view.state)).toBeGreaterThan(0);
			}
		},
		{ timeout: 5000 }
	);
	const validationState = view.state.field(validationStateField);
	const diagnostics: Array<{ from: number; to: number }> = [];
	forEachDiagnostic(view.state, (_diagnostic, from, to) => {
		diagnostics.push({ from, to });
	});
	const count = diagnosticCount(view.state);
	view.destroy();
	return { validationState, diagnostics, count };
}
