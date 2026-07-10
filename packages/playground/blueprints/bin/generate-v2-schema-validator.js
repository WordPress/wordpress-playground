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
	skipTypeCheck: true,
};
const v2ValidatorOutputPath =
	'packages/playground/blueprints/public/blueprint-v2-schema-validator.js';
const pathSegmentPattern = '^(?!(?:\\.|\\.\\.)$)[^/]+$';
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
	patchSchema(schema);

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

/** Restores constraints the TypeScript schema generator cannot represent. */
function patchSchema(schema) {
	const definitions = schema.definitions;
	const urlReference = definitions['DataSources.URLReference'];
	// Published schemas cannot carry the runtime's private WHATWG format.
	// Keep this constraint simple enough for any JSON Schema implementation.
	Object.assign(urlReference, {
		type: 'string',
		pattern: '^[Hh][Tt][Tt][Pp][Ss]?://[^/?#]+',
	});
	delete urlReference.$ref;
	delete urlReference.anyOf;
	patchStringDefinition(
		definitions,
		'DataSources.ExecutionContextPath',
		'^(?!.*(?:^|/)\\.\\.(?:/|$))(?:\\./|/).*$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.SimpleVersionExpression',
		'^(?:latest|\\d+\\.\\d+(?:\\.\\d+)?)$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.ComparableVersionExpression',
		'^\\d+\\.\\d+(?:\\.\\d+)?$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.PHPVersion',
		'^(?:latest|next|\\d+\\.\\d+(?:\\.\\d+)?)$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.PHPVersionConstraintVersion',
		'^(?:latest|\\d+\\.\\d+(?:\\.\\d+)?)$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.WordPressVersion',
		'^(?:latest|beta|trunk|nightly|\\d+\\.\\d+(?:\\.\\d+)?(?:-(?:beta\\d+|[Rr][Cc]\\d+))?)$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.WordPressVersionConstraintVersion',
		'^\\d+\\.\\d+(?:\\.\\d+)?(?:-(?:beta\\d+|[Rr][Cc]\\d+))?$'
	);
	patchStringDefinition(
		definitions,
		'DataSources.WordPressVersionPreferredVersion',
		'^(?:latest|\\d+\\.\\d+(?:\\.\\d+)?(?:-(?:beta\\d+|[Rr][Cc]\\d+))?)$'
	);

	const inlineFile = definitions['DataSources.InlineFile'];
	inlineFile.properties.filename.pattern = pathSegmentPattern;
	const inlineDirectory = definitions['DataSources.InlineDirectory'];
	inlineDirectory.properties.directoryName.pattern = pathSegmentPattern;
	inlineDirectory.properties.files.propertyNames = {
		pattern: pathSegmentPattern,
	};
	const nestedInlineDirectory =
		definitions['DataSources.NestedInlineDirectory'];
	nestedInlineDirectory.properties.files.propertyNames = {
		pattern: pathSegmentPattern,
	};
	definitions['DataSources.GitPath'].properties.pathInRepository.pattern =
		'^(?!.*(?:^|/)\\.\\.(?:/|$)).*$';

	const blueprint = definitions['V2Schema.BlueprintV2'];
	const siteOptions = blueprint.properties.siteOptions;
	const permalinkStructure = siteOptions.properties.permalink_structure;
	siteOptions.properties.permalink_structure = {
		anyOf: [{ type: 'string' }, { type: 'boolean', const: false }],
		description: permalinkStructure.description,
		default: permalinkStructure.default,
	};
	// TypeScript cannot express `Record<Exclude<string, 'siteUrl'>, ...>`.
	siteOptions.properties.siteUrl = false;
	blueprint.properties.postTypes.propertyNames = {
		pattern: '^[a-z0-9_-]{1,20}$',
	};

	// JSON Schema can constrain record keys and directory-name fields more
	// precisely than the TypeScript declaration can.
	visitSchema(schema, (nestedSchema) => {
		if (nestedSchema.properties?.urlsMap) {
			nestedSchema.properties.urlsMap.propertyNames = {
				$ref: '#/definitions/DataSources.URLReference',
			};
		}
		if (nestedSchema.properties?.targetDirectoryName) {
			nestedSchema.properties.targetDirectoryName.pattern =
				pathSegmentPattern;
		}
	});

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

/** Adds exact URL validation to a copy used only by the runtime validator. */
function createRuntimeValidationSchema(schema) {
	const runtimeSchema = structuredClone(schema);
	const urlReference = runtimeSchema.definitions['DataSources.URLReference'];
	delete urlReference.pattern;
	urlReference.format = whatwgHttpUrlFormat;
	return runtimeSchema;
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

/**
 * Replaces a template-literal definition with the JSON Schema pattern that
 * preserves its runtime constraints.
 */
function patchStringDefinition(definitions, name, pattern) {
	const definition = definitions[name];
	Object.assign(definition, { type: 'string', pattern });
	delete definition.$ref;
	delete definition.anyOf;
}

/** Walks every nested schema object so cross-cutting constraints stay aligned. */
function visitSchema(schema, visitor) {
	if (!schema || typeof schema !== 'object') {
		return;
	}
	visitor(schema);
	for (const value of Object.values(schema)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				visitSchema(item, visitor);
			}
		} else {
			visitSchema(value, visitor);
		}
	}
}
