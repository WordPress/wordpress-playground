import tsj from 'ts-json-schema-generator';
import fs from 'fs';
import Ajv from 'ajv';
import ajvStandaloneCode from 'ajv/dist/standalone/index.js';
import prettier from 'prettier';

/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
	path: 'packages/playground/blueprints/src/rollup.d.ts',
	tsconfig: './tsconfig.base.json',
	type: 'Blueprint',
	skipTypeCheck: true,
};

const output_path =
	'packages/playground/blueprints/public/blueprint-schema.json';
const validator_output_path =
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
const schema = await exponentialBackoff(() =>
	tsj.createGenerator(config).createSchema(config.type)
);

schema.$schema = 'http://json-schema.org/schema';
schema.definitions.Blueprint.properties.$schema = {
	type: 'string',
};

// Use a discriminator to help the Ajv JSON schema validator
// provide more useful error messages with respect to StepDefinition.
// Without a discriminator, it will validate each invalid step
// against all possible `anyOf` entries, which is not helpful.
Object.assign(schema.definitions.StepDefinition, {
	type: 'object',
	discriminator: { propertyName: 'step' },
	required: ['step'],
});
schema.definitions.StepDefinition.oneOf =
	schema.definitions.StepDefinition.anyOf;
delete schema.definitions.StepDefinition.anyOf;

const rawSchemaString = JSON.stringify(schema, null, 2)
	// Naively remove TypeScript generics <T> from the schema:
	.replaceAll(/%3C[a-zA-Z]+%3E/g, '')
	.replaceAll(/<[a-zA-Z]+>/g, '');

// Use prettier to make the generated text more readable
// and to avoid differing with the files formatted by pre-commit hook.
const prettierConfig = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'));
const formattedSchemaString = prettier.format(rawSchemaString, {
	...prettierConfig,
	parser: 'json',
});

fs.writeFileSync(output_path, formattedSchemaString);

const ajv = new Ajv({
	discriminator: true,
	code: {
		source: true,
		esm: true,
	},
});
const validate = ajv.compile(schema);
const rawValidationCode = ajvStandaloneCode(ajv, validate);

const formattedValidationCode = prettier.format(
	rawValidationCode,
	prettierConfig
);
fs.writeFileSync(validator_output_path, formattedValidationCode);
