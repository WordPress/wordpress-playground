import Ajv, { type ValidateFunction } from 'ajv';
import publicSchema from '../../../public/blueprint-schema.json';
import blueprintV2Validator from '../../../public/blueprint-v2-schema-validator';
import { compileBlueprintForExecution } from '../../lib/compile';
import { v2SchemaConformanceCases } from './schema-conformance-fixtures';

const wordpressMocks = vi.hoisted(() => ({
	getWordPressStableVersions: vi.fn(),
	resolveWordPressRelease: vi.fn(),
}));

vi.mock('@wp-playground/wordpress', () => ({
	getWordPressStableVersions: wordpressMocks.getWordPressStableVersions,
	resolveWordPressRelease: wordpressMocks.resolveWordPressRelease,
	versionStringToLoadedWordPressVersion: (version: string) =>
		version.includes('-alpha-') ? 'trunk' : version,
}));

describe('Blueprint v2 schema conformance', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		wordpressMocks.getWordPressStableVersions.mockResolvedValue([
			'6.7.5',
			'6.8',
			'6.8.1',
			'6.9',
		]);
		wordpressMocks.resolveWordPressRelease.mockResolvedValue({
			version: '7.0-beta1',
			releaseUrl: 'https://wordpress.org/wordpress-7.0-beta1.zip',
			source: 'api',
		});
	});

	it.each(v2SchemaConformanceCases)(
		'validates and lowers $name',
		async ({ declaration }) => {
			expect(
				blueprintV2Validator(declaration),
				formatValidationErrors(blueprintV2Validator.errors)
			).toBe(true);

			const compiled = await compileBlueprintForExecution(declaration);
			expect(compiled.version).toBe(2);
			if (compiled.version !== 2) {
				throw new Error('Expected a compiled Blueprint v2 result.');
			}
			expect(compiled.compiled.unsupportedPlan).toEqual([]);
		}
	);

	it('exercises every reachable property and nested schema variant', () => {
		const expected = collectExpectedCoverage();
		const actual = collectFixtureCoverage(
			v2SchemaConformanceCases.map(({ declaration }) => declaration)
		);
		const missing = [...expected].filter((entry) => !actual.has(entry));

		expect(
			missing,
			`Missing Blueprint v2 conformance fixtures:\n${missing.join('\n')}`
		).toEqual([]);
	});
});

type JsonSchema = Record<string, any> & {
	$ref?: string;
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
	allOf?: JsonSchema[];
	enum?: any[];
	const?: any;
	type?: string | string[];
	properties?: Record<string, JsonSchema | boolean>;
	items?: JsonSchema | boolean | Array<JsonSchema | boolean>;
	additionalProperties?: JsonSchema | boolean;
	propertyNames?: JsonSchema | boolean;
	definitions?: Record<string, JsonSchema>;
};
type JsonObject = Record<string, any>;

const schemaDocument = publicSchema as unknown as JsonSchema;
const rootSchemaRef = '#/definitions/V2Schema.BlueprintV2';
const branchValidators = new WeakMap<JsonSchema, ValidateFunction>();
const branchAjv = new Ajv({
	strict: false,
	allowUnionTypes: true,
});

/**
 * Builds occurrence-sensitive coverage keys from the published v2 schema.
 * A shared definition used in two fields is covered twice because the compiler
 * may support that definition in one context but not the other.
 */
function collectExpectedCoverage() {
	const coverage = new Set<string>();
	walkSchemaCoverage(
		resolveSchemaRef(rootSchemaRef),
		{ kind: 'expected' },
		'',
		new Set([rootSchemaRef]),
		coverage
	);
	return coverage;
}

function collectFixtureCoverage(declarations: JsonObject[]) {
	const coverage = new Set<string>();
	for (const declaration of declarations) {
		walkSchemaCoverage(
			resolveSchemaRef(rootSchemaRef),
			{ kind: 'fixture', data: declaration },
			'',
			new Set([rootSchemaRef]),
			coverage
		);
	}
	return coverage;
}

type CoverageSubject = { kind: 'expected' } | { kind: 'fixture'; data: any };

function walkSchemaCoverage(
	schema: JsonSchema | boolean,
	subject: CoverageSubject,
	path: string,
	refStack: Set<string>,
	coverage: Set<string>
) {
	if (!isSchemaObject(schema)) {
		return;
	}
	if (typeof schema.$ref === 'string') {
		walkSchemaRef(schema.$ref, subject, path, refStack, coverage);
		return;
	}

	for (const keyword of ['anyOf', 'oneOf'] as const) {
		for (const [index, branch] of (schema[keyword] ?? []).entries()) {
			if (
				subject.kind === 'fixture' &&
				!matchesSchema(branch, subject.data)
			) {
				continue;
			}
			const branchPath = `${path}/${keyword}/${index}`;
			coverage.add(branchPath);
			walkSchemaCoverage(branch, subject, branchPath, refStack, coverage);
		}
	}
	for (const [index, branch] of (schema.allOf ?? []).entries()) {
		if (
			subject.kind === 'fixture' &&
			!matchesSchema(branch, subject.data)
		) {
			continue;
		}
		walkSchemaCoverage(
			branch,
			subject,
			`${path}/allOf/${index}`,
			refStack,
			coverage
		);
	}

	if (subject.kind === 'expected') {
		for (const value of schema.enum ?? []) {
			coverage.add(`${path}/enum/${JSON.stringify(value)}`);
		}
		if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
			coverage.add(`${path}/const/${JSON.stringify(schema.const)}`);
		}
		if (Array.isArray(schema.type)) {
			for (const type of schema.type) {
				coverage.add(`${path}/type/${type}`);
			}
		}
	} else {
		if ((schema.enum ?? []).some((value: any) => value === subject.data)) {
			coverage.add(`${path}/enum/${JSON.stringify(subject.data)}`);
		}
		if (
			Object.prototype.hasOwnProperty.call(schema, 'const') &&
			schema.const === subject.data
		) {
			coverage.add(`${path}/const/${JSON.stringify(subject.data)}`);
		}
		if (Array.isArray(schema.type)) {
			const type = getJsonType(subject.data);
			if (schema.type.includes(type)) {
				coverage.add(`${path}/type/${type}`);
			}
		}
	}

	const properties = schema.properties ?? {};
	for (const [name, propertySchema] of Object.entries(properties)) {
		if (
			propertySchema === false ||
			(subject.kind === 'fixture' &&
				(!isJsonObject(subject.data) ||
					!Object.prototype.hasOwnProperty.call(subject.data, name)))
		) {
			continue;
		}
		const propertyPath = `${path}/properties/${escapeJsonPointer(name)}`;
		coverage.add(`${propertyPath}:present`);
		walkSchemaCoverage(
			propertySchema,
			childCoverageSubject(
				subject,
				subject.kind === 'fixture' ? subject.data[name] : undefined
			),
			propertyPath,
			refStack,
			coverage
		);
	}

	if (Array.isArray(schema.items)) {
		for (const [index, itemSchema] of schema.items.entries()) {
			if (
				subject.kind === 'fixture' &&
				(!Array.isArray(subject.data) || index >= subject.data.length)
			) {
				continue;
			}
			const itemPath = `${path}/items/${index}`;
			coverage.add(`${itemPath}:present`);
			walkSchemaCoverage(
				itemSchema,
				childCoverageSubject(
					subject,
					subject.kind === 'fixture' ? subject.data[index] : undefined
				),
				itemPath,
				refStack,
				coverage
			);
		}
	} else if (isSchemaObject(schema.items)) {
		const itemsPath = `${path}/items`;
		if (subject.kind === 'expected') {
			coverage.add(`${itemsPath}:present`);
			walkSchemaCoverage(
				schema.items,
				subject,
				itemsPath,
				refStack,
				coverage
			);
		} else if (Array.isArray(subject.data)) {
			for (const item of subject.data) {
				coverage.add(`${itemsPath}:present`);
				walkSchemaCoverage(
					schema.items,
					{ kind: 'fixture', data: item },
					itemsPath,
					refStack,
					coverage
				);
			}
		}
	}

	if (isSchemaObject(schema.additionalProperties)) {
		const additionalPropertiesPath = `${path}/additionalProperties`;
		if (subject.kind === 'expected') {
			coverage.add(`${additionalPropertiesPath}:present`);
			walkSchemaCoverage(
				schema.additionalProperties,
				subject,
				additionalPropertiesPath,
				refStack,
				coverage
			);
		} else if (isJsonObject(subject.data)) {
			for (const [name, value] of Object.entries(subject.data)) {
				if (Object.prototype.hasOwnProperty.call(properties, name)) {
					continue;
				}
				coverage.add(`${additionalPropertiesPath}:present`);
				walkSchemaCoverage(
					schema.additionalProperties,
					{ kind: 'fixture', data: value },
					additionalPropertiesPath,
					refStack,
					coverage
				);
			}
		}
	}

	if (isSchemaObject(schema.propertyNames)) {
		const propertyNamesPath = `${path}/propertyNames`;
		if (subject.kind === 'expected') {
			coverage.add(`${propertyNamesPath}:present`);
			walkSchemaCoverage(
				schema.propertyNames,
				subject,
				propertyNamesPath,
				refStack,
				coverage
			);
		} else if (isJsonObject(subject.data)) {
			for (const name of Object.keys(subject.data)) {
				coverage.add(`${propertyNamesPath}:present`);
				walkSchemaCoverage(
					schema.propertyNames,
					{ kind: 'fixture', data: name },
					propertyNamesPath,
					refStack,
					coverage
				);
			}
		}
	}
}

function walkSchemaRef(
	ref: string,
	subject: CoverageSubject,
	path: string,
	refStack: Set<string>,
	coverage: Set<string>
) {
	// Recursive JSON values and inline directories have no finite maximum depth.
	// Cover one expansion at each use site, then stop only the active ref cycle.
	if (refStack.has(ref)) {
		return;
	}
	const nextRefStack = new Set(refStack);
	nextRefStack.add(ref);
	walkSchemaCoverage(
		resolveSchemaRef(ref),
		subject,
		`${path}/$ref`,
		nextRefStack,
		coverage
	);
}

function childCoverageSubject(
	subject: CoverageSubject,
	data: any
): CoverageSubject {
	return subject.kind === 'expected' ? subject : { kind: 'fixture', data };
}

function resolveSchemaRef(ref: string): JsonSchema {
	if (!ref.startsWith('#/')) {
		throw new Error(`Unsupported external schema reference: ${ref}`);
	}
	let value: any = schemaDocument;
	for (const segment of ref.slice(2).split('/')) {
		value = value[unescapeJsonPointer(segment)];
	}
	if (!isSchemaObject(value)) {
		throw new Error(
			`Schema reference does not resolve to an object: ${ref}`
		);
	}
	return value;
}

function matchesSchema(schema: JsonSchema, data: any) {
	let validator = branchValidators.get(schema);
	if (!validator) {
		validator = branchAjv.compile({
			...schema,
			definitions: schemaDocument.definitions,
		});
		branchValidators.set(schema, validator);
	}
	return validator(data) as boolean;
}

function getJsonType(value: any) {
	if (Array.isArray(value)) {
		return 'array';
	}
	if (value !== null && typeof value === 'object') {
		return 'object';
	}
	return typeof value;
}

function isJsonObject(value: any): value is JsonObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSchemaObject(value: any): value is JsonSchema {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeJsonPointer(value: string) {
	return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function unescapeJsonPointer(value: string) {
	return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

function formatValidationErrors(errors: any) {
	return errors
		? JSON.stringify(errors, null, 2)
		: 'Expected a valid Blueprint';
}
