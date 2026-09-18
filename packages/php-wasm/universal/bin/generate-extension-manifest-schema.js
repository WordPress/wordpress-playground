import tsj from 'ts-json-schema-generator';
import fs from 'fs';
import Ajv from 'ajv';
import ajvStandaloneCode from 'ajv/dist/standalone/index.js';
import prettier from 'prettier';

/** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
const config = {
	path: 'packages/php-wasm/universal/src/lib/load-extension.ts',
	tsconfig: './tsconfig.base.json',
	type: 'PHPExtensionManifest',
	skipTypeCheck: true,
};

const schemaOutputPath =
	'packages/php-wasm/universal/public/php-extension-manifest-schema.json';
const validatorOutputPath =
	'packages/php-wasm/universal/public/php-extension-manifest-schema-validator.js';

/**
 * Builds the JSON schema and standalone AJV validator for extension manifests.
 *
 * The manifest type lives with the extension-loading API. Regenerating from
 * that type keeps the runtime validator aligned with the public TypeScript
 * contract without duplicating object-shape checks in handwritten code.
 */
const schema = tsj.createGenerator(config).createSchema(config.type);
schema.$schema = 'http://json-schema.org/schema';

const prettierConfig = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'));
const formattedSchemaString = await prettier.format(
	JSON.stringify(schema, null, 2),
	{
		...prettierConfig,
		parser: 'json',
	}
);

fs.mkdirSync('packages/php-wasm/universal/public', { recursive: true });
fs.writeFileSync(schemaOutputPath, formattedSchemaString);

const ajv = new Ajv({
	code: {
		source: true,
		esm: true,
	},
});
const validate = ajv.compile(schema);
const rawValidationCode = ajvStandaloneCode(ajv, validate);

const formattedValidationCode = await prettier.format(rawValidationCode, {
	...prettierConfig,
	parser: 'babel',
});
fs.writeFileSync(validatorOutputPath, formattedValidationCode);
