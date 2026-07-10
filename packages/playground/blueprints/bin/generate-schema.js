import tsj from 'ts-json-schema-generator';
import fs from 'fs';
import Ajv from 'ajv';
import ajvStandaloneCode from 'ajv/dist/standalone/index.js';
import prettier from 'prettier';
import { generateBlueprintV2SchemaValidator } from './generate-v2-schema-validator.js';

/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
	path: 'packages/playground/blueprints/src/rollup.d.ts',
	tsconfig: './tsconfig.base.json',
	type: 'BlueprintV1Declaration',
	skipTypeCheck: true,
};

const output_path =
	'packages/playground/blueprints/public/blueprint-schema.json';
const v1ValidatorOutputPath =
	'packages/playground/blueprints/public/blueprint-schema-validator.js';

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

/**
 * Schema creation sometimes fails in CI, most likely
 * due to a race condition. Let's retry a few times before
 * giving up.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/789
 */
const v1Schema = await exponentialBackoff(() =>
	tsj.createGenerator(config).createSchema(config.type)
);

v1Schema.$schema = 'http://json-schema.org/schema';
v1Schema.definitions.BlueprintV1Declaration.properties.$schema = {
	type: 'string',
};

// Use a discriminator to help the Ajv JSON schema validator
// provide more useful error messages with respect to StepDefinition.
// Without a discriminator, it will validate each invalid step
// against all possible `anyOf` entries, which is not helpful.
Object.assign(v1Schema.definitions.StepDefinition, {
	type: 'object',
	discriminator: { propertyName: 'step' },
	required: ['step'],
});
v1Schema.definitions.StepDefinition.oneOf =
	v1Schema.definitions.StepDefinition.anyOf;
delete v1Schema.definitions.StepDefinition.anyOf;

// Use prettier to make the generated text more readable
// and to avoid differing with the files formatted by pre-commit hook.
const prettierConfig = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'));

const v1Ajv = new Ajv({
	discriminator: true,
	code: {
		source: true,
		esm: true,
	},
});
await writeValidator(v1Ajv, v1Schema, v1ValidatorOutputPath, prettierConfig);

const v2Schema = await generateBlueprintV2SchemaValidator(
	exponentialBackoff,
	prettierConfig
);
const publicSchema = createPublicSchema(v1Schema, v2Schema);
const rawSchemaString = JSON.stringify(publicSchema, null, 2);
const formattedSchemaString = await prettier.format(rawSchemaString, {
	...prettierConfig,
	parser: 'json',
});
fs.writeFileSync(output_path, formattedSchemaString);

/** Combines the independently generated schemas without shadowing definitions. */
function createPublicSchema(v1Schema, v2Schema) {
	const conflictingDefinitions = new Set(
		Object.keys(v1Schema.definitions).filter(
			(name) => name in v2Schema.definitions
		)
	);
	if (
		'BlueprintDeclaration' in v1Schema.definitions ||
		'BlueprintDeclaration' in v2Schema.definitions
	) {
		conflictingDefinitions.add('BlueprintDeclaration');
	}
	if (conflictingDefinitions.size > 0) {
		throw new Error(
			`Blueprint schema definitions collide: ${Array.from(conflictingDefinitions).join(', ')}`
		);
	}

	return {
		$schema: 'http://json-schema.org/schema',
		$ref: '#/definitions/BlueprintDeclaration',
		definitions: {
			BlueprintDeclaration: {
				oneOf: [
					{ $ref: '#/definitions/BlueprintV1Declaration' },
					{ $ref: '#/definitions/BlueprintV2Declaration' },
				],
			},
			...v1Schema.definitions,
			...v2Schema.definitions,
		},
	};
}

/** Compiles, formats, and writes one generated standalone schema validator. */
async function writeValidator(ajv, schema, outputPath, prettierConfig) {
	const validate = ajv.compile(schema);
	const rawValidationCode = ajvStandaloneCode(ajv, validate);
	const formattedValidationCode = await prettier.format(rawValidationCode, {
		...prettierConfig,
		parser: 'babel',
	});
	fs.writeFileSync(outputPath, formattedValidationCode);
}
