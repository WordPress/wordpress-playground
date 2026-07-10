import Ajv from 'ajv';
import publicSchema from '../../../public/blueprint-schema.json';
import blueprintV2Validator from '../../../public/blueprint-v2-schema-validator';
import { validateBlueprintDeclaration } from '../../lib/validate-blueprint-declaration';
import { validateBlueprint } from '../../lib/v1/compile';

const publicBlueprintValidator = new Ajv({
	discriminator: true,
	allowUnionTypes: true,
}).compile(publicSchema);

describe('public Blueprint schema', () => {
	it('publishes both declaration versions from one root', () => {
		expect(publicSchema.$ref).toBe('#/definitions/BlueprintDeclaration');
		expect(publicSchema.definitions.BlueprintDeclaration).toEqual({
			oneOf: [
				{ $ref: '#/definitions/BlueprintV1Declaration' },
				{ $ref: '#/definitions/BlueprintV2Declaration' },
			],
		});
	});

	it('publishes a portable HTTP URL constraint', () => {
		const urlReference =
			publicSchema.definitions['DataSources.URLReference'];
		expect(urlReference).toMatchObject({
			type: 'string',
			pattern: '^[Hh][Tt][Tt][Pp][Ss]?://[^/?#]+',
		});
		expect(urlReference).not.toHaveProperty('format');
	});

	it.each([
		['v1', { landingPage: '/wp-admin/' }],
		['v2', { version: 2, plugins: ['akismet'] }],
		[
			'v2 with an uppercase HTTP scheme',
			{
				version: 2,
				blueprintMeta: { homepage: 'HTTPS://example.com' },
			},
		],
	])('accepts a valid %s declaration', (_version, blueprint) => {
		expect(publicBlueprintValidator(blueprint)).toBe(true);
	});

	it.each([
		['a malformed v2 declaration', { version: 2, pluginz: [] }],
		['a declaration mixing v1 and v2 fields', { version: 2, steps: [] }],
		[
			'a v2 declaration with a non-HTTP URL',
			{
				version: 2,
				blueprintMeta: { homepage: 'ftp://example.com' },
			},
		],
		[
			'a v2 declaration with no URL host',
			{ version: 2, blueprintMeta: { homepage: 'https://?' } },
		],
	])('rejects %s', (_description, blueprint) => {
		expect(publicBlueprintValidator(blueprint)).toBe(false);
	});

	it.each([
		{ version: 2 },
		{ version: 2, plugins: ['akismet'] },
		{
			version: 2,
			blueprintMeta: { homepage: 'https://example.com/plugin.zip' },
		},
		{ version: 2, blueprintMeta: { homepage: 'HTTPS://example.com' } },
		{ version: 2, blueprintMeta: { homepage: 'https://?' } },
		{ version: 2, blueprintMeta: { homepage: 'https://#' } },
		{ version: 2, pluginz: [] },
	])('agrees with the dedicated v2 validator', (blueprint) => {
		expect(publicBlueprintValidator(blueprint)).toBe(
			blueprintV2Validator(blueprint)
		);
	});
});

describe('version-aware Blueprint validation', () => {
	it.each([
		['v1', { landingPage: '/wp-admin/' }],
		['v2', { version: 2, plugins: ['akismet'] }],
	])('accepts a valid %s declaration', async (_version, blueprint) => {
		await expect(validateBlueprintDeclaration(blueprint)).resolves.toEqual({
			valid: true,
		});
	});

	it('returns actionable AJV failures for malformed v2 declarations', async () => {
		const result = await validateBlueprintDeclaration({
			version: 2,
			pluginz: [],
		});

		expect(result.valid).toBe(false);
		if (result.valid) {
			throw new Error('Expected schema validation to fail.');
		}
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					instancePath: '',
					keyword: 'additionalProperties',
				}),
			])
		);
	});

	it('keeps the synchronous validator scoped to v1', () => {
		expect(validateBlueprint({ version: 2 })).toMatchObject({
			valid: false,
		});
	});
});
