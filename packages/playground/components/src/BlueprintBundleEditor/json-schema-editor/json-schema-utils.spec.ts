import { EditorState } from '@codemirror/state';
import {
	getRootObjectPropertyValue,
	resolveSchemaRefs,
} from './json-schema-utils';
import type { JSONSchema } from './types';

describe('JSON schema utilities', () => {
	it('resolves chained schema references', () => {
		const rootSchema: JSONSchema = {
			definitions: {
				BlueprintV2Declaration: {
					$ref: '#/definitions/BlueprintV2',
				},
				BlueprintV2: {
					type: 'object',
					properties: {
						version: { type: 'number', const: 2 },
					},
				},
			},
		};

		expect(
			resolveSchemaRefs(
				{ $ref: '#/definitions/BlueprintV2Declaration' },
				rootSchema
			)
		).toMatchObject({
			type: 'object',
			properties: {
				version: { type: 'number', const: 2 },
			},
		});
	});

	it('reads a root property from incomplete JSON', () => {
		const doc = EditorState.create({
			doc: '{ "version": 2, "plugins": [',
		}).doc;

		expect(getRootObjectPropertyValue(doc, 'version')).toBe(2);
	});
});
