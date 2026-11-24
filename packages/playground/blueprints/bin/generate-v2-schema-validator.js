import fs from 'fs';
import Ajv from 'ajv';
import { _ } from 'ajv/dist/compile/codegen/index.js';
import ajvStandaloneCode from 'ajv/dist/standalone/index.js';
import prettier from 'prettier';
import tsjV2 from 'ts-json-schema-generator-v2';

const v2Config = {
	path: 'packages/playground/blueprints/src/rollup.d.ts',
	tsconfig: './tsconfig.base.json',
	type: 'BlueprintV2Declaration',
	jsDoc: 'extended',
	skipTypeCheck: true,
};
const v2ValidatorOutputPath =
	'packages/playground/blueprints/public/blueprint-v2-schema-validator.js';
const whatwgHttpUrlFormat = 'whatwg-http-url';
// AJV cannot serialize custom format functions. Keep this standalone expression
// aligned with isWhatwgHttpUrl(), whose generated behavior is covered by tests.
const standaloneFormats = _`{
	"whatwg-http-url": (value) => {
		try {
			const url = new URL(value);
			return (
				(url.protocol === "http:" || url.protocol === "https:") &&
				url.hostname !== ""
			);
		} catch {
			return false;
		}
	}
}`;

/**
 * Generates the dedicated runtime validator for Blueprint v2 declarations.
 *
 * Returns the portable schema used in the published multi-version schema.
 *
 * @param retry The schema generator's existing CI retry wrapper.
 * @param prettierConfig The repository's Prettier configuration.
 */
export async function generateBlueprintV2SchemaValidator(
	retry,
	prettierConfig
) {
	// Version 1.2 of ts-json-schema-generator cannot parse the v2 declaration's
	// bigint template literal. Use 2.4 only for v2 so this cannot silently change
	// the stable v1 schema or validator.
	const schema = await retry(() =>
		tsjV2.createGenerator(v2Config).createSchema(v2Config.type)
	);
	schema.$schema = 'http://json-schema.org/schema';
	normalizeAnnotatedStringSchemas(schema);
	applyBlueprintV2DocumentInvariants(schema);
	optimizeBlueprintV2TaggedUnions(schema);

	const runtimeSchema = createRuntimeValidationSchema(schema);
	const ajv = createBlueprintV2Ajv();
	const validate = ajv.compile(runtimeSchema);
	const rawValidationCode = ajvStandaloneCode(ajv, validate);
	const formattedValidationCode = await prettier.format(rawValidationCode, {
		...prettierConfig,
		parser: 'babel',
	});
	fs.writeFileSync(v2ValidatorOutputPath, formattedValidationCode);

	return schema;
}

/**
 * Creates an AJV instance for the runtime-only schema with exact URL parsing.
 */
function createBlueprintV2Ajv() {
	const ajv = new Ajv({
		// Besides reporting independent failures, this produces smaller standalone
		// code for this schema: about 100 KB versus 170 KB gzip before bundling.
		allErrors: true,
		allowUnionTypes: true,
		discriminator: true,
		code: {
			source: true,
			esm: true,
			formats: standaloneFormats,
		},
	});
	ajv.addFormat(whatwgHttpUrlFormat, isWhatwgHttpUrl);
	return ajv;
}

/**
 * Honors `@asType string` when the generator also retains the inferred union.
 *
 * The adjacent `@pattern` is the complete runtime constraint. Keeping the
 * inferred union would expose TypeScript's implementation details as extra
 * public schema branches without changing which strings are valid.
 */
function normalizeAnnotatedStringSchemas(schema) {
	if (!schema || typeof schema !== 'object') {
		return;
	}
	if (
		schema.type === 'string' &&
		schema.pattern &&
		(schema.$ref || schema.anyOf)
	) {
		delete schema.$ref;
		delete schema.anyOf;
	}
	for (const value of Object.values(schema)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				normalizeAnnotatedStringSchemas(item);
			}
		} else {
			normalizeAnnotatedStringSchemas(value);
		}
	}
}

/** Adds declaration-wide constraints that TypeScript cannot express. */
function applyBlueprintV2DocumentInvariants(schema) {
	const blueprint = getDefinition(schema, 'V2Schema.BlueprintV2');
	// TypeScript expresses the non-empty tuple and excludes comments from the
	// scalar form, but not uniqueness or the relationship between comments and
	// the content that may own them in an array.
	const contentBaseline = blueprint.properties.contentBaseline;
	const retainedContentTypes = contentBaseline.anyOf.find(
		(variant) => variant.type === 'array'
	);
	retainedContentTypes.uniqueItems = true;
	retainedContentTypes.allOf = [
		{
			if: { contains: { const: 'comments' } },
			then: {
				allOf: [
					{ contains: { const: 'posts' } },
					{ contains: { const: 'pages' } },
				],
			},
		},
	];
	// These declaration-wide invariants cannot be represented by the field
	// types: removing the installer account must leave a manageable WordPress
	// site, and PHP-only Blueprints have no WordPress baseline to adjust.
	blueprint.allOf = [
		{
			if: {
				properties: { usersBaseline: { const: 'empty' } },
				required: ['usersBaseline'],
			},
			then: {
				properties: {
					contentBaseline: { const: 'empty' },
					users: {
						type: 'array',
						contains: {
							type: 'object',
							properties: {
								role: { const: 'administrator' },
							},
							required: ['role'],
						},
					},
				},
				required: ['contentBaseline', 'users'],
			},
		},
		{
			if: {
				properties: { wordpressVersion: { const: 'none' } },
				required: ['wordpressVersion'],
			},
			then: {
				properties: {
					contentBaseline: false,
					usersBaseline: false,
				},
			},
		},
	];
	const siteOptions = blueprint.properties.siteOptions;
	const permalinkStructure = siteOptions.properties.permalink_structure;
	siteOptions.properties.permalink_structure = {
		anyOf: [{ type: 'string' }, { type: 'boolean', const: false }],
		description: permalinkStructure.description,
		default: permalinkStructure.default,
	};
	// TypeScript cannot express `Record<Exclude<string, 'siteUrl'>, ...>`.
	siteOptions.properties.siteUrl = false;
}

/** Adds AJV discriminators without changing which declarations are valid. */
function optimizeBlueprintV2TaggedUnions(schema) {
	const blueprint = getDefinition(schema, 'V2Schema.BlueprintV2');
	// A discriminator keeps errors for invalid trailing v1 steps focused on the
	// selected step instead of reporting failures from every possible step type.
	const steps = blueprint.properties.additionalStepsAfterExecution.items;
	Object.assign(steps, {
		type: 'object',
		discriminator: { propertyName: 'step' },
		required: ['step'],
		oneOf: steps.anyOf,
	});
	delete steps.anyOf;

	// Content is also a tagged union. Without a discriminator, one bad source
	// can produce errors for every unrelated content type in the schema.
	const content = blueprint.properties.content.items;
	const contentVariantsByType = new Map();
	for (const variant of content.anyOf) {
		const type = variant.properties.type.const;
		const variants = contentVariantsByType.get(type) ?? [];
		variants.push(variant);
		contentVariantsByType.set(type, variants);
	}
	Object.assign(content, {
		type: 'object',
		discriminator: { propertyName: 'type' },
		required: ['type'],
		oneOf: Array.from(contentVariantsByType, ([type, variants]) =>
			variants.length === 1
				? variants[0]
				: {
						type: 'object',
						properties: { type: { type: 'string', const: type } },
						required: ['type'],
						oneOf: variants,
					}
		),
	});
	delete content.anyOf;
}

/**
 * Adds exact URL validation to a copy used only by the runtime validator.
 *
 * Published schemas cannot carry the runtime's private WHATWG format, so the
 * source declaration keeps a portable pattern for other schema consumers.
 */
function createRuntimeValidationSchema(schema) {
	const runtimeSchema = structuredClone(schema);
	const urlReference = getDefinition(
		runtimeSchema,
		'DataSources.URLReference'
	);
	delete urlReference.pattern;
	urlReference.format = whatwgHttpUrlFormat;
	return runtimeSchema;
}

/** Gets a required generated definition or fails schema generation clearly. */
function getDefinition(schema, name) {
	const definition = schema.definitions?.[name];
	if (!definition) {
		throw new Error(`Missing generated Blueprint v2 definition: ${name}`);
	}
	return definition;
}

/** Validates HTTP(S) references with the same URL parser used by Playground. */
function isWhatwgHttpUrl(value) {
	try {
		const url = new URL(value);
		return (
			(url.protocol === 'http:' || url.protocol === 'https:') &&
			url.hostname !== ''
		);
	} catch {
		return false;
	}
}
