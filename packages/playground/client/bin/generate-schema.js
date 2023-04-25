import tsj from 'ts-json-schema-generator';
import fs from 'fs';

/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
	path: 'dist/packages/playground/client/index.d.ts',
	tsconfig: './tsconfig.base.json',
	type: 'Blueprint',
};

const output_path = 'dist/packages/playground/client/blueprint-schema.json';

const schema = tsj.createGenerator(config).createSchema(config.type);
schema.$schema = 'http://json-schema.org/schema';
schema.definitions.Blueprint.properties.$schema = {
	type: 'string',
};
const schemaString = JSON.stringify(schema, null, 2)
	// Naively remove TypeScript generics <T> from the schema:
	.replaceAll(/%3C[a-zA-Z]+%3E/g, '')
	.replaceAll(/<[a-zA-Z]+>/g, '');
fs.writeFile(output_path, schemaString, (err) => {
	if (err) throw err;
});
