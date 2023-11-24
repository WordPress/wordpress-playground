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
const declarative_output_path =
	'packages/playground/blueprints/public/blueprint-declarative-schema.json';

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

// Create a declarative schema that is easier to use.
const declarativeSchema = tsj
	.createGenerator({
		...config,
		topRef: false,
		type: 'Blueprint',
	})
	.createSchema(config.type);
const allowedProps = ['landingPage', 'siteOptions', 'plugins', 'login'];
for (const prop in declarativeSchema.properties) {
	if (!allowedProps.includes(prop)) {
		delete declarativeSchema.properties[prop];
	}
}
// Simplify declarativeSchema:
// * Replace all references with the actual schema definition.
// * Remove deprecation notices
const walk = (obj, callback) => {
	for (const key in obj) {
		const value = obj[key];
		if (value && typeof value === 'object') {
			if (value.$ref) {
				const ref = value.$ref.replace('#/definitions/', '');
				obj[key] = callback(ref);
			} else {
				walk(value, callback);
			}

			if (value.deprecated) {
				delete value.deprecated;
			}
		}
	}
};
walk(declarativeSchema, (ref) => declarativeSchema.definitions[ref]);
delete declarativeSchema.definitions;

declarativeSchema.properties.plugins.items = { type: 'string' };

// Add an empty required list to each property
for (const prop in declarativeSchema.properties) {
	if (!declarativeSchema.properties[prop].required) {
		declarativeSchema.properties[prop].required = [];
	}
}
declarativeSchema.properties.siteOptions.additionalProperties = false;

const declarativeSchemaString = JSON.stringify(declarativeSchema, null, 2)
	// Naively remove TypeScript generics <T> from the schema:
	.replaceAll(/%3C[a-zA-Z]+%3E/g, '')
	.replaceAll(/<[a-zA-Z]+>/g, '');
fs.writeFile(declarative_output_path, declarativeSchemaString, (err) => {
	if (err) throw err;
});
