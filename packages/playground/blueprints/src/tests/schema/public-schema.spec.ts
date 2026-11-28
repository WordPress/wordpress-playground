import Ajv from 'ajv';
import { makePortableSchema } from '../../../bin/make-portable-schema';
import publicSchema from '../../../public/blueprint-schema.json';
import blueprintV2Validator from '../../../public/blueprint-v2-schema-validator';
import { validateBlueprintDeclaration } from '../../lib/validate-blueprint-declaration';
import { validateBlueprint } from '../../lib/v1/compile';

const publicBlueprintValidator = new Ajv({
	strict: true,
	allErrors: true,
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
		[
			'v1 with $schema, plugins, and login',
			{
				$schema:
					'https://playground.wordpress.net/blueprint-schema.json',
				landingPage: '/wp-admin/admin.php?page=perflab-modules',
				plugins: ['performance-lab'],
				login: true,
			},
		],
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
		[
			'inline directory without resource',
			{ name: 'plugin', files: { 'plugin.php': '<?php' } },
		],
		[
			'explicit literal directory',
			{
				resource: 'literal:directory',
				name: 'plugin',
				files: { 'plugin.php': '<?php' },
			},
		],
		[
			'git directory',
			{
				resource: 'git:directory',
				url: 'https://github.com/example/plugin.git',
				ref: 'main',
			},
		],
	])('accepts writeFiles with %s', (_description, filesTree) => {
		const blueprint = {
			steps: [{ step: 'writeFiles', writeToPath: '/plugin', filesTree }],
		};
		expect(publicBlueprintValidator(blueprint)).toBe(true);
		expect(validateBlueprint(blueprint)).toEqual({ valid: true });
	});

	it.each([
		['missing name', { files: { 'plugin.php': '<?php' } }],
		['missing files', { name: 'plugin' }],
		[
			'unknown resource',
			{
				resource: 'unknown',
				name: 'plugin',
				files: { 'plugin.php': '<?php' },
			},
		],
	])('rejects writeFiles with %s', (_description, filesTree) => {
		const blueprint = {
			steps: [{ step: 'writeFiles', writeToPath: '/plugin', filesTree }],
		};
		expect(publicBlueprintValidator(blueprint)).toBe(false);
		expect(validateBlueprint(blueprint).valid).toBe(false);
	});

	it('still requires a resource for installPlugin directory data', () => {
		const blueprint = {
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						name: 'plugin',
						files: { 'plugin.php': '<?php' },
					},
				},
			],
		};
		expect(publicBlueprintValidator(blueprint)).toBe(false);
		expect(validateBlueprint(blueprint).valid).toBe(false);
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
		['string', 'value', true],
		['boolean', false, true],
		['number', 42, true],
		['null', null, false],
		['array', [], false],
		['object', {}, false],
	])('preserves constant validation for %s values', (_type, value, valid) => {
		const v1Blueprint = { constants: { EXAMPLE: value } };
		const v2Blueprint = { version: 2, constants: { EXAMPLE: value } };
		expect(publicBlueprintValidator(v1Blueprint)).toBe(valid);
		expect(validateBlueprint(v1Blueprint).valid).toBe(valid);
		expect(publicBlueprintValidator(v2Blueprint)).toBe(valid);
		expect(blueprintV2Validator(v2Blueprint)).toBe(valid);
	});

	it.each([
		['all', true],
		['insert', true],
		[false, true],
		[true, false],
		['unknown', false],
	])('preserves enum constraints for template_lock=%s', (value, valid) => {
		const blueprint = {
			version: 2,
			postTypes: { book: { template_lock: value } },
		};
		expect(publicBlueprintValidator(blueprint)).toBe(valid);
		expect(blueprintV2Validator(blueprint)).toBe(valid);
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
		{
			version: 2,
			content: [
				{
					type: 'wxr',
					source: 'https://example.com/content.wxr',
				},
			],
		},
		{
			version: 2,
			content: [
				{
					type: 'wxr',
					source: 'https://example.com/content.wxr',
					authorsMode: 'map',
					authorsMap: { oldAuthor: 'admin' },
				},
			],
		},
		{
			version: 2,
			content: [
				{
					type: 'wxr',
					source: 'https://example.com/content.wxr',
					authorsMode: 'map',
				},
			],
		},
		{
			version: 2,
			content: [
				{
					type: 'unknown',
					source: 'https://example.com/content.wxr',
				},
			],
		},
		{
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'activatePlugin',
					pluginPath: 'akismet/akismet.php',
				},
			],
		},
		{
			version: 2,
			additionalStepsAfterExecution: [{ step: 'unknownStep' }],
		},
	])('agrees with the dedicated v2 validator', (blueprint) => {
		expect(publicBlueprintValidator(blueprint)).toBe(
			blueprintV2Validator(blueprint)
		);
	});
});

describe('makePortableSchema', () => {
	it('preserves property and definition names named discriminator', () => {
		const schema = {
			type: 'object',
			discriminator: { propertyName: 'kind' },
			properties: {
				discriminator: {
					type: ['string', 'number'],
				},
			},
			required: ['discriminator'],
			additionalProperties: false,
			definitions: {
				discriminator: {
					type: ['boolean'],
				},
			},
		};

		const portable = makePortableSchema(schema);
		expect(portable).not.toHaveProperty('discriminator');
		expect(portable).toMatchObject({
			properties: {
				discriminator: {
					anyOf: [{ type: 'string' }, { type: 'number' }],
				},
			},
			definitions: {
				discriminator: {
					type: 'boolean',
				},
			},
		});

		const validate = new Ajv({ strict: true }).compile(portable);
		expect(validate({ discriminator: 'ok' })).toBe(true);
		expect(validate({ discriminator: 42 })).toBe(true);
		expect(validate({ discriminator: true })).toBe(false);
	});

	it('preserves literal data keywords without rewriting nested keys', () => {
		const schema = {
			type: 'object',
			default: {
				discriminator: { propertyName: 'step' },
				type: ['string', 'number'],
			},
			const: {
				discriminator: 'keep-me',
				type: ['a', 'b'],
			},
			enum: [{ discriminator: 'x', type: ['string'] }],
			examples: [{ discriminator: 'y', type: ['boolean'] }],
		};

		const portable = makePortableSchema(schema);
		expect(portable['default']).toEqual(schema.default);
		expect(portable['const']).toEqual(schema.const);
		expect(portable['enum']).toEqual(schema.enum);
		expect(portable['examples']).toEqual(schema.examples);
	});

	it('merges union types into allOf when anyOf already exists', () => {
		const withoutAllOf = makePortableSchema({
			type: ['string', 'number'],
			anyOf: [{ enum: ['ok', 1] }, { enum: ['also-ok', 2] }],
		});
		const withAllOf = makePortableSchema({
			type: ['string', 'number'],
			anyOf: [{ enum: ['ok', 1] }, { enum: ['also-ok', 2] }],
			allOf: [{ not: { const: 2 } }],
		});

		const validateWithoutAllOf = new Ajv({ strict: true }).compile(
			withoutAllOf
		);
		expect(validateWithoutAllOf('ok')).toBe(true);
		expect(validateWithoutAllOf(2)).toBe(true);
		expect(validateWithoutAllOf(false)).toBe(false);

		const validateWithAllOf = new Ajv({ strict: true }).compile(withAllOf);
		expect(validateWithAllOf('also-ok')).toBe(true);
		expect(validateWithAllOf(1)).toBe(true);
		expect(validateWithAllOf(2)).toBe(false);
	});

	it('preserves array dependencies and transforms schema dependencies', () => {
		const portable = makePortableSchema({
			type: 'object',
			dependencies: {
				a: ['b'],
				c: {
					discriminator: { propertyName: 'step' },
					type: ['object'],
				},
			},
		});

		expect(portable).toEqual({
			type: 'object',
			dependencies: {
				a: ['b'],
				c: {
					type: 'object',
				},
			},
		});
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
