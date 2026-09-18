// @vitest-environment jsdom

import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, vi } from 'vitest';
// eslint-disable-next-line @nx/enforce-module-boundaries
import publicBlueprintSchema from '../../../../../blueprints/public/blueprint-schema.json';
import { jsonSchemaCompletion } from './jsonSchemaCompletion';
import type { JSONSchema } from './types';

const schema: JSONSchema = {
	$ref: '#/definitions/BlueprintDeclaration',
	definitions: {
		BlueprintDeclaration: {
			oneOf: [
				{ $ref: '#/definitions/BlueprintV1Declaration' },
				{ $ref: '#/definitions/BlueprintV2Declaration' },
			],
		},
		BlueprintV1Declaration: {
			type: 'object',
			properties: {
				$schema: { type: 'string' },
				steps: {
					type: 'array',
					items: { $ref: '#/definitions/V1StepAlias' },
				},
			},
		},
		V1StepAlias: { $ref: '#/definitions/V1Step' },
		V1Step: {
			type: 'object',
			properties: {
				step: { type: 'string' },
				path: { type: 'string' },
			},
		},
		BlueprintV2Declaration: { $ref: '#/definitions/BlueprintV2' },
		BlueprintV2: {
			type: 'object',
			properties: {
				version: { type: 'number', const: 2 },
				plugins: {
					type: 'array',
					items: { $ref: '#/definitions/V2PluginAlias' },
				},
			},
		},
		V2PluginAlias: { $ref: '#/definitions/V2Plugin' },
		V2Plugin: {
			type: 'object',
			properties: {
				source: { type: 'string' },
				active: { type: 'boolean' },
			},
		},
	},
};

const schemaWithImplicitDiscriminator: JSONSchema = {
	type: 'object',
	properties: {
		entries: {
			type: 'array',
			items: {
				type: 'object',
				discriminator: { propertyName: 'kind' },
				required: ['kind'],
				oneOf: [
					{
						type: 'object',
						properties: { kind: { const: 'first' } },
					},
					{
						type: 'object',
						properties: { kind: { const: 'second' } },
					},
				],
			},
		},
	},
};

let schemaUrlIndex = 0;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Blueprint JSON schema completion', () => {
	it('keeps v1 fields and offers the version opt-in by default', async () => {
		const { completion, doc } = await complete(`{
	"$schema": "SCHEMA_URL",
	"CURSOR
}`);

		expect(completion?.options.map(({ label }) => label)).toEqual(
			expect.arrayContaining(['steps', 'version'])
		);
		expect(completion?.options.map(({ label }) => label)).not.toContain(
			'plugins'
		);

		const versionCompletion = completion?.options.find(
			({ label }) => label === 'version'
		);
		expect(typeof versionCompletion?.apply).toBe('function');
		const view = new EditorView({ doc, parent: document.body });
		if (typeof versionCompletion?.apply === 'function' && completion) {
			versionCompletion.apply(
				view,
				versionCompletion,
				completion.from,
				completion.to ?? completion.from
			);
		}
		expect(view.state.doc.toString()).toContain('"version": 2');
		view.destroy();
	});

	it('uses the v1 branch for nested versionless completion', async () => {
		const { completion } = await complete(`{
	"$schema": "SCHEMA_URL",
	"steps": [{ "CURSOR }]
}`);

		expect(completion?.options.map(({ label }) => label)).toEqual(
			expect.arrayContaining(['step', 'path'])
		);
		expect(completion?.options.map(({ label }) => label)).not.toContain(
			'source'
		);
	});

	it('uses the v2 branch for nested versioned completion', async () => {
		const { completion } = await complete(`{
	"$schema": "SCHEMA_URL",
	"version": 2,
	"plugins": [{ "CURSOR }]
}`);

		expect(completion?.options.map(({ label }) => label)).toEqual(
			expect.arrayContaining(['source', 'active'])
		);
		expect(completion?.options.map(({ label }) => label)).not.toContain(
			'step'
		);
	});

	it.each([
		{
			name: 'v1 step',
			source: `{
	"$schema": "SCHEMA_URL",
	"steps": [{ "CURSOR }]
}`,
			property: 'step',
			values: ['installPlugin', 'runPHP'],
			schema: publicBlueprintSchema as unknown as JSONSchema,
		},
		{
			name: 'v2 content type',
			source: `{
	"$schema": "SCHEMA_URL",
	"version": 2,
	"content": [{ "CURSOR }]
}`,
			property: 'type',
			values: ['mysql-dump', 'posts', 'wxr'],
			schema: publicBlueprintSchema as unknown as JSONSchema,
		},
		{
			name: 'implicitly typed string discriminator',
			source: `{
	"$schema": "SCHEMA_URL",
	"entries": [{ "CURSOR }]
}`,
			property: 'kind',
			values: ['first', 'second'],
			schema: schemaWithImplicitDiscriminator,
		},
	])(
		'inserts an empty $name discriminator and offers its values',
		async ({ source, property, values, schema: schemaToFetch }) => {
			const { completion, doc } = await complete(source, schemaToFetch);
			const propertyCompletion = completion?.options.find(
				({ label }) => label === property
			);
			expect(typeof propertyCompletion?.apply).toBe('function');

			const view = new EditorView({ doc, parent: document.body });
			if (typeof propertyCompletion?.apply === 'function' && completion) {
				propertyCompletion.apply(
					view,
					propertyCompletion,
					completion.from,
					completion.to ?? completion.from
				);
			}
			expect(view.state.doc.toString()).toContain(`"${property}": ""`);

			const valueCompletion = await jsonSchemaCompletion(
				new CompletionContext(
					view.state,
					view.state.selection.main.head,
					true
				)
			);
			expect(valueCompletion?.options.map(({ label }) => label)).toEqual(
				expect.arrayContaining(values)
			);
			view.destroy();
		}
	);

	it.each([
		['version 3', 3],
		['a null version', null],
		['a string version', '2'],
	])('does not use v2 completion for %s', async (_name, version) => {
		const { completion } = await complete(
			`{
	"$schema": "SCHEMA_URL",
	"version": ${JSON.stringify(version)},
	"CURSOR
}`,
			publicBlueprintSchema as unknown as JSONSchema
		);
		const labels = completion?.options.map(({ label }) => label);

		expect(labels).toContain('steps');
		for (const label of [
			'blueprintMeta',
			'applicationOptions',
			'additionalStepsAfterExecution',
		]) {
			expect(labels).not.toContain(label);
		}
	});

	it('completes v2 plugin fields from the published schema', async () => {
		const { completion } = await complete(
			`{
	"$schema": "SCHEMA_URL",
	"version": 2,
	"plugins": [{ "CURSOR }]
}`,
			publicBlueprintSchema as unknown as JSONSchema
		);

		expect(completion?.options.map(({ label }) => label)).toEqual(
			expect.arrayContaining(['source', 'active'])
		);
		expect(completion?.options.map(({ label }) => label)).not.toContain(
			'step'
		);
	});

	it('completes the selected v2 WXR content fields', async () => {
		const { completion } = await complete(
			`{
	"$schema": "SCHEMA_URL",
	"version": 2,
	"content": [{ "type": "wxr", "CURSOR }]
}`,
			publicBlueprintSchema as unknown as JSONSchema
		);

		expect(completion?.options.map(({ label }) => label)).toEqual(
			expect.arrayContaining([
				'source',
				'authorsMode',
				'urlsMode',
				'staticAssets',
			])
		);
	});
});

async function complete(source: string, schemaToFetch = schema) {
	const schemaUrl = `https://example.test/blueprint-schema-${schemaUrlIndex++}.json`;
	const withSchemaUrl = source.replace('SCHEMA_URL', schemaUrl);
	const cursor = withSchemaUrl.indexOf('CURSOR');
	const doc = withSchemaUrl.replace('CURSOR', '');
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({
			ok: true,
			statusText: 'OK',
			json: async () => schemaToFetch,
		}))
	);
	const state = EditorState.create({ doc });
	const completion = await jsonSchemaCompletion(
		new CompletionContext(state, cursor, true)
	);
	return { completion, doc };
}
