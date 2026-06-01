import tsj from 'ts-json-schema-generator';
import fs from 'fs';
import Ajv from 'ajv';
import ajvStandaloneCode from 'ajv/dist/standalone/index.js';
import prettier from 'prettier';

const declarationPath = 'packages/playground/blueprints/src/rollup.d.ts';
const tsconfig = './tsconfig.base.json';
const publicSchemaPath =
	'packages/playground/blueprints/public/blueprint-schema.json';
const publicValidatorPath =
	'packages/playground/blueprints/public/blueprint-schema-validator.js';
const v1ValidatorPath =
	'packages/playground/blueprints/public/blueprint-v1-schema-validator.js';
const prettierConfig = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'));

const maxRetries = 2;
async function exponentialBackoff(callback, retries = 0, delay = 1000) {
	try {
		return await callback();
	} catch (e) {
		if (retries >= maxRetries) {
			throw e;
		}
		await new Promise((resolve) => setTimeout(resolve, delay));
		return exponentialBackoff(callback, retries + 1, delay * 2);
	}
}

async function createSchema(type) {
	/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
	const config = {
		path: declarationPath,
		tsconfig,
		type,
		skipTypeCheck: true,
	};

	/**
	 * Schema creation sometimes fails in CI, most likely
	 * due to a race condition. Let's retry a few times before
	 * giving up.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/issues/789
	 */
	const schema = await exponentialBackoff(() =>
		tsj.createGenerator(config).createSchema(config.type)
	);
	schema.$schema = 'http://json-schema.org/schema';
	patchSchema(schema);
	return schema;
}

function patchSchema(schema) {
	if (schema.definitions?.BlueprintV1Declaration?.properties) {
		schema.definitions.BlueprintV1Declaration.properties.$schema = {
			type: 'string',
		};
	}
	patchV2Schema(schema);
	if (schema.definitions?.BlueprintDeclaration?.anyOf) {
		schema.definitions.BlueprintDeclaration.oneOf =
			schema.definitions.BlueprintDeclaration.anyOf;
		delete schema.definitions.BlueprintDeclaration.anyOf;
	}
	if (schema.definitions?.StepDefinition?.anyOf) {
		Object.assign(schema.definitions.StepDefinition, {
			type: 'object',
			discriminator: { propertyName: 'step' },
			required: ['step'],
		});
		schema.definitions.StepDefinition.oneOf =
			schema.definitions.StepDefinition.anyOf;
		delete schema.definitions.StepDefinition.anyOf;
	}
}

function patchV2Schema(schema) {
	const definitions = schema.definitions;
	if (!definitions) {
		return;
	}
	const noParentPathPattern =
		'^(?!.*(?:^|[/\\\\]|:)\\.\\.(?:[/\\\\]|$)).*$';
	const executionContextPathPattern =
		'^(?:\\./|/)(?!.*(?:^|[/\\\\]|:)\\.\\.(?:[/\\\\]|$)).*$';
	const pathSegmentPattern = '^(?!\\.\\.$)[^/\\\\]*$';
	const directorySlugPattern =
		'^[a-zA-Z0-9_-]+(?:@(latest|\\d+\\.\\d+(?:\\.\\d+)?))?$';
	const fontFilePattern = '\\.(?:woff2|woff|ttf|otf)(?:[?#]\\S*)?$';
	if (definitions['DataSources.URLReference']) {
		Object.assign(definitions['DataSources.URLReference'], {
			type: 'string',
			pattern: '^https?://\\S+$',
		});
	}
	if (definitions['DataSources.ExecutionContextPath']) {
		Object.assign(definitions['DataSources.ExecutionContextPath'], {
			type: 'string',
			pattern: executionContextPathPattern,
		});
	}
	if (definitions['DataSources.SimpleVersionExpression']) {
		Object.assign(definitions['DataSources.SimpleVersionExpression'], {
			type: 'string',
			pattern: '^(?:latest|\\d+\\.\\d+(?:\\.\\d+)?)$',
		});
	}
	if (definitions['DataSources.PHPVersion']) {
		Object.assign(definitions['DataSources.PHPVersion'], {
			type: 'string',
			pattern: '^(?:latest|next|\\d+\\.\\d+(?:\\.\\d+)?)$',
		});
		delete definitions['DataSources.PHPVersion'].$ref;
	}
	if (definitions['DataSources.WordPressVersion']) {
		Object.assign(definitions['DataSources.WordPressVersion'], {
			type: 'string',
			pattern:
				'^(?:latest|beta|trunk|nightly|\\d+\\.\\d+(?:\\.\\d+)?(?:-(?:beta\\d+|[Rr][Cc]\\d+))?)$',
		});
		delete definitions['DataSources.WordPressVersion'].anyOf;
	}
	for (const definitionName of [
		'DataSources.PluginDirectoryReference',
		'DataSources.ThemeDirectoryReference',
	]) {
		if (definitions[definitionName]) {
			Object.assign(definitions[definitionName], {
				type: 'string',
				pattern: directorySlugPattern,
			});
			delete definitions[definitionName].anyOf;
		}
	}
	definitions['DataSources.FontFileDataReference'] = {
		anyOf: [
			{
				allOf: [
					{ $ref: '#/definitions/DataSources.URLReference' },
					{ type: 'string', pattern: fontFilePattern },
				],
			},
			{
				allOf: [
					{
						$ref: '#/definitions/DataSources.ExecutionContextPath',
					},
					{ type: 'string', pattern: fontFilePattern },
				],
			},
			{
				allOf: [
					{ $ref: '#/definitions/DataSources.InlineFile' },
					{
						type: 'object',
						properties: {
							filename: {
								type: 'string',
								pattern: fontFilePattern,
							},
						},
					},
				],
			},
		],
	};
	patchV2TopLevelBlueprint(definitions['V2Schema.BlueprintV2']);
	patchFontSourceReferences(definitions['V2Schema.BlueprintV2']);
	for (const definitionName of [
		'DataSources.InlineFile',
		'DataSources.InlineDirectory',
	]) {
		const definition = definitions[definitionName];
		const propertyName =
			definitionName === 'DataSources.InlineFile'
				? 'filename'
				: 'directoryName';
		if (definition?.properties?.[propertyName]) {
			Object.assign(definition.properties[propertyName], {
				type: 'string',
				pattern: pathSegmentPattern,
			});
		}
	}
	for (const definition of Object.values(definitions)) {
		patchTargetDirectoryNames(definition, pathSegmentPattern);
		patchNoParentPathProperties(definition, noParentPathPattern);
		patchFileMapPropertyNames(definition, noParentPathPattern);
		patchUrlMaps(definition);
	}
}

function patchV2TopLevelBlueprint(blueprint) {
	if (!blueprint?.properties) {
		return;
	}
	if (blueprint.properties.siteOptions) {
		blueprint.properties.siteOptions.not = {
			required: ['siteUrl'],
		};
	}
	if (blueprint.properties.wordpressVersion) {
		blueprint.properties.wordpressVersion.anyOf = [
			{ $ref: '#/definitions/DataSources.WordPressVersion' },
			{
				$ref: '#/definitions/DataSources.URLReference',
			},
			{
				allOf: [
					{ $ref: '#/definitions/DataSources.ExecutionContextPath' },
					{ type: 'string', pattern: '\\.zip$' },
				],
			},
			{
				allOf: [
					{ $ref: '#/definitions/DataSources.InlineFile' },
					{
						type: 'object',
						properties: {
							filename: {
								type: 'string',
								pattern: '\\.zip$',
							},
						},
					},
				],
			},
			{ $ref: '#/definitions/DataSources.InlineDirectory' },
			{ $ref: '#/definitions/DataSources.GitPath' },
			{
				type: 'object',
				properties: {
					min: { $ref: '#/definitions/DataSources.WordPressVersion' },
					max: { $ref: '#/definitions/DataSources.WordPressVersion' },
					preferred: {
						$ref: '#/definitions/DataSources.WordPressVersion',
						default: 'latest',
					},
					recommended: {
						$ref: '#/definitions/DataSources.WordPressVersion',
						default: 'latest',
					},
				},
				required: ['min'],
				additionalProperties: false,
			},
		];
	}
}

function patchFontSourceReferences(node) {
	if (!node || typeof node !== 'object') {
		return;
	}
	if (node.properties?.fonts?.additionalProperties?.anyOf) {
		node.properties.fonts.additionalProperties.anyOf[0] = {
			$ref: '#/definitions/DataSources.FontFileDataReference',
		};
	}
	if (node.properties?.src?.anyOf) {
		node.properties.src.anyOf = [
			{
				$ref: '#/definitions/DataSources.FontFileDataReference',
			},
			{
				type: 'array',
				items: {
					$ref: '#/definitions/DataSources.FontFileDataReference',
				},
			},
		];
	}
	for (const value of Object.values(node)) {
		if (value && typeof value === 'object') {
			patchFontSourceReferences(value);
		}
	}
}

function patchTargetDirectoryNames(node, pathSegmentPattern) {
	if (!node || typeof node !== 'object') {
		return;
	}
	if (node.properties?.targetDirectoryName) {
		Object.assign(node.properties.targetDirectoryName, {
			type: 'string',
			pattern: pathSegmentPattern,
		});
	}
	for (const value of Object.values(node)) {
		if (value && typeof value === 'object') {
			patchTargetDirectoryNames(value, pathSegmentPattern);
		}
	}
}

function patchNoParentPathProperties(node, noParentPathPattern) {
	if (!node || typeof node !== 'object') {
		return;
	}
	for (const propertyName of [
		'path',
		'fromPath',
		'toPath',
		'extractToPath',
		'pathInRepository',
	]) {
		if (node.properties?.[propertyName]) {
			Object.assign(node.properties[propertyName], {
				type: 'string',
				pattern: noParentPathPattern,
			});
		}
	}
	for (const value of Object.values(node)) {
		if (value && typeof value === 'object') {
			patchNoParentPathProperties(value, noParentPathPattern);
		}
	}
}

function patchFileMapPropertyNames(node, noParentPathPattern) {
	if (!node || typeof node !== 'object') {
		return;
	}
	if (node.properties?.files?.additionalProperties) {
		node.properties.files.propertyNames = {
			pattern: noParentPathPattern,
		};
	}
	for (const value of Object.values(node)) {
		if (value && typeof value === 'object') {
			patchFileMapPropertyNames(value, noParentPathPattern);
		}
	}
}

function patchUrlMaps(node) {
	if (!node || typeof node !== 'object') {
		return;
	}
	if (node.properties?.urlsMap) {
		node.properties.urlsMap.propertyNames = {
			$ref: '#/definitions/DataSources.URLReference',
		};
	}
	for (const value of Object.values(node)) {
		if (value && typeof value === 'object') {
			patchUrlMaps(value);
		}
	}
}

async function writeFormattedJson(path, schema) {
	const rawSchemaString = JSON.stringify(schema, null, 2)
		// Naively remove TypeScript generics <T> from the schema:
		.replaceAll(/%3C[a-zA-Z]+%3E/g, '')
		.replaceAll(/<[a-zA-Z]+>/g, '');

	fs.writeFileSync(
		path,
		await prettier.format(rawSchemaString, {
			...prettierConfig,
			parser: 'json',
		})
	);
}

async function writeStandaloneValidator(path, schema) {
	const ajv = new Ajv({
		discriminator: true,
		allowUnionTypes: true,
		code: {
			source: true,
			esm: true,
		},
	});
	const validate = ajv.compile(schema);
	const rawValidationCode = ajvStandaloneCode(ajv, validate);

	fs.writeFileSync(
		path,
		await prettier.format(rawValidationCode, {
			...prettierConfig,
			parser: 'babel',
		})
	);
}

const publicSchema = await createSchema('BlueprintDeclaration');
await writeFormattedJson(publicSchemaPath, publicSchema);
await writeStandaloneValidator(publicValidatorPath, publicSchema);

const v1Schema = await createSchema('BlueprintV1Declaration');
await writeStandaloneValidator(v1ValidatorPath, v1Schema);
