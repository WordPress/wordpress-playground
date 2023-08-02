import tsj from 'ts-json-schema-generator';
import fs from 'fs';

/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
	path: 'dist/packages/playground/blueprints/index.d.ts',
	tsconfig: './tsconfig.base.json',
	type: 'Blueprint',
	skipTypeCheck: true,
};

const output_path =
	'packages/playground/blueprints/public/blueprint-schema.json';

const schema = tsj.createGenerator(config).createSchema(config.type);
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

const schemaString = JSON.stringify(schema, null, 2)
	// Naively remove TypeScript generics <T> from the schema:
	.replaceAll(/%3C[a-zA-Z]+%3E/g, '')
	.replaceAll(/<[a-zA-Z]+>/g, '');
fs.writeFile(output_path, schemaString, (err) => {
	if (err) throw err;
});
