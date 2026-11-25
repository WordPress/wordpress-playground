const SCHEMA_MAP_KEYS = new Set([
	'properties',
	'patternProperties',
	'definitions',
	'$defs',
	'dependentSchemas',
]);
const LITERAL_DATA_KEYS = new Set(['const', 'enum', 'default', 'examples']);

/**
 * Keeps AJV extensions in runtime validators, out of the published schema.
 *
 * Preserves user-defined map keys (such as a property named "discriminator")
 * and literal JSON data keywords (const, enum, default, examples) verbatim.
 */
export function makePortableSchema(schema) {
	if (schema === null || typeof schema !== 'object') {
		return schema;
	}
	if (Array.isArray(schema)) {
		return schema.map(makePortableSchema);
	}

	const result = {};
	for (const [key, value] of Object.entries(schema)) {
		const isAjvDiscriminator = key === 'discriminator';
		const isUnionTypeKeyword = key === 'type' && Array.isArray(value);
		if (isAjvDiscriminator || isUnionTypeKeyword) {
			continue;
		}
		if (LITERAL_DATA_KEYS.has(key)) {
			result[key] = structuredClone(value);
		} else if (SCHEMA_MAP_KEYS.has(key) && isPlainObject(value)) {
			result[key] = transformSchemaMap(value);
		} else if (key === 'dependencies' && isPlainObject(value)) {
			result[key] = transformDependencies(value);
		} else {
			result[key] = makePortableSchema(value);
		}
	}

	if (Array.isArray(schema.type)) {
		if (schema.type.length === 1) {
			result.type = schema.type[0];
		} else {
			const union = { anyOf: schema.type.map((type) => ({ type })) };
			if (result.anyOf) {
				result.allOf = [...(result.allOf ?? []), union];
			} else {
				result.anyOf = union.anyOf;
			}
		}
	}
	return result;
}

function transformSchemaMap(schemaMap) {
	return Object.fromEntries(
		Object.entries(schemaMap).map(([entryKey, entrySchema]) => [
			entryKey,
			makePortableSchema(entrySchema),
		])
	);
}

function transformDependencies(dependencies) {
	return Object.fromEntries(
		Object.entries(dependencies).map(([entryKey, entryValue]) => [
			entryKey,
			Array.isArray(entryValue)
				? [...entryValue]
				: makePortableSchema(entryValue),
		])
	);
}

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
