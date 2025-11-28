import {
	findNodeAtLocation,
	findNodeAtOffset,
	getLocation,
	parseTree,
	type Location,
	type Node as JsonNode,
} from 'jsonc-parser';
import type { CodeMirrorDoc, JSONSchema, PathSegment } from './types';

interface ParsedJsonDocument {
	text: string;
	tree: JsonNode | undefined;
}

interface DocumentContext {
	parsed: ParsedJsonDocument;
	location: Location;
	node?: JsonNode;
	containerNode?: JsonNode;
	objectNode?: JsonNode;
}

let lastParsedDocument: ParsedJsonDocument | null = null;
let lastParsedText = '';

function getParsedJsonDocument(doc: CodeMirrorDoc): ParsedJsonDocument {
	const text = doc.toString();

	if (lastParsedDocument && lastParsedText === text) {
		return lastParsedDocument;
	}

	const tree = parseTree(text);
	lastParsedDocument = { text, tree };
	lastParsedText = text;

	return lastParsedDocument;
}

function clampOffset(text: string, pos: number): number {
	return Math.max(0, Math.min(pos, text.length));
}

function getContainerType(containerNode?: JsonNode): 'object' | 'array' | null {
	if (!containerNode) {
		return null;
	}
	if (containerNode.type === 'object') {
		return 'object';
	}
	if (containerNode.type === 'array') {
		return 'array';
	}
	return null;
}

function buildPathSegments(path: Array<string | number>): PathSegment[] {
	const segments: PathSegment[] = [];

	for (const segment of path) {
		if (typeof segment === 'string') {
			if (segment === '') {
				continue;
			}
			segments.push({
				type: 'key',
				key: segment,
				depth: segments.length + 1,
			});
		} else {
			segments.push({ type: 'array', depth: segments.length + 1 });
		}
	}

	return segments;
}

function collectObjectKeys(objectNode?: JsonNode): string[] {
	if (!objectNode || objectNode.type !== 'object' || !objectNode.children) {
		return [];
	}

	const keys: string[] = [];

	for (const child of objectNode.children) {
		if (
			child.type !== 'property' ||
			!child.children ||
			child.children.length === 0
		) {
			continue;
		}

		const keyNode = child.children[0];
		if (keyNode.type === 'string' && typeof keyNode.value === 'string') {
			keys.push(keyNode.value);
		}
	}

	return keys;
}

function getPropertyValueNode(
	objectNode: JsonNode | undefined,
	propertyName: string
): JsonNode | undefined {
	if (!objectNode || objectNode.type !== 'object' || !objectNode.children) {
		return undefined;
	}

	for (const child of objectNode.children) {
		if (
			child.type !== 'property' ||
			!child.children ||
			child.children.length < 2
		) {
			continue;
		}

		const keyNode = child.children[0];
		if (keyNode.type === 'string' && keyNode.value === propertyName) {
			return child.children[1];
		}
	}

	return undefined;
}

function getDocumentContext(doc: CodeMirrorDoc, pos: number): DocumentContext {
	const parsed = getParsedJsonDocument(doc);
	const text = parsed.text;
	const tree = parsed.tree;

	const offset = clampOffset(text, pos);
	const location = getLocation(text, offset);
	const node = tree ? findNodeAtOffset(tree, offset, true) : undefined;

	let containerNode: JsonNode | undefined;
	let objectNode: JsonNode | undefined;

	if (tree) {
		if (location.isAtPropertyKey) {
			const pathNode = findNodeAtLocation(tree, location.path);
			if (pathNode?.type === 'object') {
				containerNode = pathNode;
				objectNode = pathNode;
			}
		}

		if (!containerNode) {
			let current = node;
			while (current) {
				if (current.type === 'object') {
					containerNode = current;
					objectNode = current;
					break;
				}
				if (current.type === 'array') {
					containerNode = current;
					break;
				}
				current = current.parent;
			}
		}

		if (!containerNode && location.path.length > 0) {
			const pathNode = findNodeAtLocation(tree, location.path);
			let current = pathNode;
			while (current) {
				if (current.type === 'object' || current.type === 'array') {
					containerNode = current;
					if (current.type === 'object') {
						objectNode = current;
					}
					break;
				}
				current = current.parent;
			}
		}

		if (!objectNode && containerNode?.type !== 'object') {
			let current = node;
			while (current) {
				if (current.type === 'object') {
					objectNode = current;
					break;
				}
				current = current.parent;
			}
		}

		if (!containerNode && tree.type === 'object') {
			containerNode = tree;
		}
		if (!objectNode && containerNode?.type === 'object') {
			objectNode = containerNode;
		}
	}

	return { parsed, location, node, containerNode, objectNode };
}

/**
 * Resolve a $ref reference in a schema
 */
export function resolveRef(schema: JSONSchema, ref: string): JSONSchema | null {
	if (!ref || !ref.startsWith('#/')) {
		return null;
	}

	const path = ref.substring(2).split('/');
	let current: unknown = schema;

	for (const segment of path) {
		if (!current || typeof current !== 'object') {
			return null;
		}
		current = (current as Record<string, unknown>)[segment];
	}

	return current as JSONSchema;
}

/**
 * Resolve all $ref in a schema object (non-recursive, one level)
 */
export function resolveSchemaRefs(
	schema: JSONSchema,
	rootSchema: JSONSchema
): JSONSchema {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (schema.$ref) {
		const resolved = resolveRef(rootSchema, schema.$ref);
		if (resolved) {
			return { ...resolved, ...schema, $ref: undefined };
		}
	}

	return schema;
}

/**
 * Merge all schemas from anyOf/oneOf/allOf into a single schema with combined properties
 * This function recursively merges nested composite schemas
 */
export function mergeCompositeSchemas(
	schema: JSONSchema,
	rootSchema: JSONSchema
): JSONSchema {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	const merged: JSONSchema = { ...schema };

	if (schema.allOf && Array.isArray(schema.allOf)) {
		merged.properties = merged.properties || {};
		merged.required = merged.required || [];

		for (const subSchema of schema.allOf) {
			let resolved = resolveSchemaRefs(subSchema, rootSchema);
			resolved = mergeCompositeSchemas(resolved, rootSchema);
			if (resolved.properties) {
				merged.properties = {
					...merged.properties,
					...resolved.properties,
				};
			}
			if (resolved.required) {
				merged.required = [...merged.required, ...resolved.required];
			}
		}
	}

	if (schema.anyOf && Array.isArray(schema.anyOf)) {
		merged.properties = merged.properties || {};

		for (const subSchema of schema.anyOf) {
			let resolved = resolveSchemaRefs(subSchema, rootSchema);
			resolved = mergeCompositeSchemas(resolved, rootSchema);
			if (resolved.properties) {
				merged.properties = {
					...merged.properties,
					...resolved.properties,
				};
			}
		}
	}

	if (schema.oneOf && Array.isArray(schema.oneOf)) {
		merged.properties = merged.properties || {};

		for (const subSchema of schema.oneOf) {
			let resolved = resolveSchemaRefs(subSchema, rootSchema);
			resolved = mergeCompositeSchemas(resolved, rootSchema);
			if (resolved.properties) {
				merged.properties = {
					...merged.properties,
					...resolved.properties,
				};
			}
		}
	}

	return merged;
}

/**
 * Parse the current JSON path from the cursor position
 */
export function getJsonPath(doc: CodeMirrorDoc, pos: number): PathSegment[] {
	const context = getDocumentContext(doc, pos);
	const path =
		context.location.isAtPropertyKey && context.location.path.length > 0
			? context.location.path.slice(0, -1)
			: context.location.path;
	return buildPathSegments(path);
}

/**
 * Return the container type (object or array) at the cursor position
 */
export function getCurrentContainerType(
	doc: CodeMirrorDoc,
	pos: number
): 'object' | 'array' | null {
	const context = getDocumentContext(doc, pos);
	return getContainerType(context.containerNode);
}

/**
 * Extract all possible discriminator values from a schema with oneOf/anyOf
 */
export function getDiscriminatorValues(
	schema: JSONSchema,
	discriminatorProp: string
): string[] {
	if (!schema || !discriminatorProp) {
		return [];
	}

	const values: string[] = [];
	const checkSchema = (subSchema: JSONSchema): void => {
		if (subSchema.properties && subSchema.properties[discriminatorProp]) {
			const prop = subSchema.properties[discriminatorProp];
			if (prop.const !== undefined) {
				values.push(String(prop.const));
			} else if (prop.enum) {
				values.push(...prop.enum.map(String));
			}
		}
	};

	if (schema.oneOf) {
		schema.oneOf.forEach(checkSchema);
	}
	if (schema.anyOf) {
		schema.anyOf.forEach(checkSchema);
	}

	return [...new Set(values)];
}

/**
 * Find the discriminator value in the current object being edited
 */
export function getCurrentDiscriminatorValue(
	doc: CodeMirrorDoc,
	pos: number,
	discriminatorProp: string | undefined
): string | null {
	if (!discriminatorProp) {
		return null;
	}

	const context = getDocumentContext(doc, pos);
	const valueNode = getPropertyValueNode(
		context.objectNode,
		discriminatorProp
	);

	if (
		valueNode &&
		valueNode.type === 'string' &&
		typeof valueNode.value === 'string'
	) {
		return valueNode.value;
	}

	return null;
}

/**
 * Get all existing keys in the current object being edited
 * Returns a Set of key names that are already present
 */
export function getExistingKeysInCurrentObject(
	doc: CodeMirrorDoc,
	pos: number
): Set<string> {
	const context = getDocumentContext(doc, pos);
	return new Set(collectObjectKeys(context.objectNode));
}

/**
 * Determine the property name for which a value is being completed
 */
export function getPropertyNameForValueCompletion(
	doc: CodeMirrorDoc,
	pos: number
): string | null {
	const context = getDocumentContext(doc, pos);

	if (context.location.isAtPropertyKey) {
		return null;
	}

	const path = context.location.path;
	if (path.length === 0) {
		return null;
	}

	const lastSegment = path[path.length - 1];
	return typeof lastSegment === 'string' ? lastSegment : null;
}

/**
 * Filter a schema to only include properties valid for a specific discriminator value
 */
export function filterSchemaByDiscriminator(
	schema: JSONSchema,
	rootSchema: JSONSchema,
	discriminatorProp: string,
	discriminatorValue: string
): JSONSchema {
	if (!schema || !discriminatorProp || !discriminatorValue) {
		return schema;
	}

	const resolved = resolveSchemaRefs(schema, rootSchema);

	const findMatchingSchema = (
		schemas: JSONSchema[] | undefined
	): JSONSchema | null => {
		if (!schemas) return null;

		for (const subSchema of schemas) {
			const subResolved = resolveSchemaRefs(subSchema, rootSchema);
			const prop = subResolved.properties?.[discriminatorProp];

			if (
				prop?.const === discriminatorValue ||
				prop?.enum?.includes(discriminatorValue)
			) {
				return subResolved;
			}

			if (subResolved.oneOf || subResolved.anyOf) {
				const nested = filterSchemaByDiscriminator(
					subResolved,
					rootSchema,
					discriminatorProp,
					discriminatorValue
				);
				if (
					nested &&
					nested.properties &&
					Object.keys(nested.properties).length > 0
				) {
					return nested;
				}
			}
		}
		return null;
	};

	const matchingSchema =
		findMatchingSchema(resolved.oneOf) ||
		findMatchingSchema(resolved.anyOf);

	return matchingSchema || resolved;
}

/**
 * Get schema properties for the current JSON path
 */
export function getSchemaForPath(
	schema: JSONSchema,
	path: PathSegment[]
): JSONSchema | null {
	let current: JSONSchema = schema;

	current = resolveSchemaRefs(current, schema);

	for (const segment of path) {
		if (segment.type === 'key' && current.properties) {
			const next = current.properties[segment.key!];
			if (!next) return null;
			current = resolveSchemaRefs(next, schema);
		} else if (segment.type === 'array') {
			if (current.type === 'array' && current.items) {
				current = resolveSchemaRefs(current.items, schema);
			} else if (current.items) {
				current = resolveSchemaRefs(current.items, schema);
			}
		} else if (segment.type === 'object') {
			continue;
		}
	}

	return current;
}
