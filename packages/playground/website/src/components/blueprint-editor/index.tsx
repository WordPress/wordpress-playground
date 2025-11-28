import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	type CompletionContext,
	completionKeymap,
	type CompletionResult,
	startCompletion,
} from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension, StateField } from '@codemirror/state';
import {
	crosshairCursor,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection,
	showTooltip,
	type Tooltip,
	type ViewUpdate,
} from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import { detectLanguage, type SupportedLanguage } from './language-detection';
import {
	filterSchemaByDiscriminator,
	getCurrentContainerType,
	getCurrentDiscriminatorValue,
	getDiscriminatorValues,
	getExistingKeysInCurrentObject,
	getJsonPath,
	getPropertyNameForValueCompletion,
	getStringNodeAtPosition,
	mergeCompositeSchemas,
	resolveSchemaRefs,
} from './schema-utils';
import { StringEditorModal } from './string-editor-modal';
import type { JSONSchema, JSONSchemaCompletionConfig } from './types';

/**
 * Try to parse a JSON string value. Returns the parsed string or null if invalid.
 */
function tryParseJsonString(rawValue: string): string | null {
	try {
		return JSON.parse(`"${rawValue}"`);
	} catch {
		return null;
	}
}

interface JSONSchemaEditorProps {
	config?: JSONSchemaCompletionConfig;
	className?: string;
}

const schemaCache = new Map<string, JSONSchema>();

export function clearSchemaCache(): void {
	schemaCache.clear();
}

function schemaHasProperty(
	schema: JSONSchema | undefined,
	property: string,
	rootSchema: JSONSchema,
	seen = new WeakSet<object>()
): boolean {
	if (!schema || typeof schema !== 'object') {
		return false;
	}

	if (seen.has(schema)) {
		return false;
	}

	seen.add(schema);

	const resolved = resolveSchemaRefs(schema, rootSchema);

	if (resolved.properties && resolved.properties[property] !== undefined) {
		return true;
	}

	if (
		resolved.allOf &&
		resolved.allOf.some((sub) =>
			schemaHasProperty(sub, property, rootSchema, seen)
		)
	) {
		return true;
	}

	if (
		resolved.anyOf &&
		resolved.anyOf.some((sub) =>
			schemaHasProperty(sub, property, rootSchema, seen)
		)
	) {
		return true;
	}

	if (
		resolved.oneOf &&
		resolved.oneOf.some((sub) =>
			schemaHasProperty(sub, property, rootSchema, seen)
		)
	) {
		return true;
	}

	return false;
}

function collectConstValuesFromSchema(
	schema: JSONSchema | undefined,
	rootSchema: JSONSchema,
	values: Set<string>,
	seen = new WeakSet<object>()
): void {
	if (!schema || typeof schema !== 'object') {
		return;
	}

	if (seen.has(schema as object)) {
		return;
	}
	seen.add(schema as object);

	const resolved = resolveSchemaRefs(schema, rootSchema);
	if (resolved !== schema) {
		collectConstValuesFromSchema(resolved, rootSchema, values, seen);
		return;
	}

	if (resolved.const !== undefined) {
		values.add(String(resolved.const));
	}

	if (resolved.enum) {
		for (const entry of resolved.enum) {
			values.add(String(entry));
		}
	}

	if (Array.isArray(resolved.allOf)) {
		for (const subSchema of resolved.allOf) {
			collectConstValuesFromSchema(subSchema, rootSchema, values, seen);
		}
	}

	if (Array.isArray(resolved.anyOf)) {
		for (const subSchema of resolved.anyOf) {
			collectConstValuesFromSchema(subSchema, rootSchema, values, seen);
		}
	}

	if (Array.isArray(resolved.oneOf)) {
		for (const subSchema of resolved.oneOf) {
			collectConstValuesFromSchema(subSchema, rootSchema, values, seen);
		}
	}
}

function collectPropertyValuesFromSchema(
	schema: JSONSchema | undefined,
	property: string,
	rootSchema: JSONSchema,
	values: Set<string>,
	seen = new WeakSet<object>()
): void {
	if (!schema || typeof schema !== 'object') {
		return;
	}

	if (seen.has(schema as object)) {
		return;
	}
	seen.add(schema as object);

	const resolved = resolveSchemaRefs(schema, rootSchema);
	if (resolved !== schema) {
		collectPropertyValuesFromSchema(
			resolved,
			property,
			rootSchema,
			values,
			seen
		);
		return;
	}

	if (resolved.properties && resolved.properties[property]) {
		collectConstValuesFromSchema(
			resolved.properties[property],
			rootSchema,
			values
		);
	}

	if (Array.isArray(resolved.allOf)) {
		for (const subSchema of resolved.allOf) {
			collectPropertyValuesFromSchema(
				subSchema,
				property,
				rootSchema,
				values,
				seen
			);
		}
	}

	if (Array.isArray(resolved.anyOf)) {
		for (const subSchema of resolved.anyOf) {
			collectPropertyValuesFromSchema(
				subSchema,
				property,
				rootSchema,
				values,
				seen
			);
		}
	}

	if (Array.isArray(resolved.oneOf)) {
		for (const subSchema of resolved.oneOf) {
			collectPropertyValuesFromSchema(
				subSchema,
				property,
				rootSchema,
				values,
				seen
			);
		}
	}
}

function filterSchemaByConstProperty(
	schema: JSONSchema,
	rootSchema: JSONSchema,
	propertyName: string,
	propertyValue: string,
	seen = new WeakSet<object>()
): JSONSchema | null {
	if (!schema || typeof schema !== 'object') {
		return null;
	}

	if (seen.has(schema as object)) {
		return null;
	}
	seen.add(schema as object);

	const resolved = resolveSchemaRefs(schema, rootSchema);
	if (resolved !== schema) {
		return filterSchemaByConstProperty(
			resolved,
			rootSchema,
			propertyName,
			propertyValue,
			seen
		);
	}

	const propertySchema = resolved.properties?.[propertyName];
	if (propertySchema) {
		const constants = new Set<string>();
		collectConstValuesFromSchema(propertySchema, rootSchema, constants);
		if (constants.has(propertyValue)) {
			return mergeCompositeSchemas(resolved, rootSchema);
		}
	}

	if (Array.isArray(resolved.anyOf)) {
		for (const option of resolved.anyOf) {
			const filtered = filterSchemaByConstProperty(
				option,
				rootSchema,
				propertyName,
				propertyValue,
				seen
			);
			if (filtered) {
				return filtered;
			}
		}
	}

	if (Array.isArray(resolved.oneOf)) {
		for (const option of resolved.oneOf) {
			const filtered = filterSchemaByConstProperty(
				option,
				rootSchema,
				propertyName,
				propertyValue,
				seen
			);
			if (filtered) {
				return filtered;
			}
		}
	}

	if (Array.isArray(resolved.allOf)) {
		let matched = false;
		for (const option of resolved.allOf) {
			const filtered = filterSchemaByConstProperty(
				option,
				rootSchema,
				propertyName,
				propertyValue,
				seen
			);
			if (filtered) {
				matched = true;
				break;
			}
		}
		if (matched) {
			return mergeCompositeSchemas(resolved, rootSchema);
		}
	}

	return null;
}

/**
 * Format JSON document while preserving cursor position
 * Returns the formatted text and new cursor position
 */
function formatJSON(
	doc: EditorState['doc'],
	cursorPos: number
): { formatted: string; newPos: number } {
	const text = doc.toString();

	try {
		const parsed = JSON.parse(text);
		const formatted = JSON.stringify(parsed, null, '\t');

		let nonWhitespaceCount = 0;
		for (let i = 0; i < cursorPos && i < text.length; i++) {
			if (!/\s/.test(text[i])) {
				nonWhitespaceCount++;
			}
		}

		let newPos = 0;
		let count = 0;
		for (let i = 0; i < formatted.length; i++) {
			if (!/\s/.test(formatted[i])) {
				count++;
				if (count >= nonWhitespaceCount) {
					newPos = i + 1;
					break;
				}
			}
		}

		return { formatted, newPos };
	} catch {
		return { formatted: text, newPos: cursorPos };
	}
}

/**
 * Format the editor content and update cursor position
 */
export function formatEditor(view: EditorView): void {
	const doc = view.state.doc;
	const cursorPos = view.state.selection.main.head;

	const { formatted, newPos } = formatJSON(doc, cursorPos);

	if (formatted !== doc.toString()) {
		view.dispatch({
			changes: { from: 0, to: doc.length, insert: formatted },
			selection: { anchor: newPos },
		});
	}
}

/**
 * Fetch a JSON schema from a URL
 */
async function fetchSchema(url: string): Promise<JSONSchema | null> {
	if (schemaCache.has(url)) {
		return schemaCache.get(url)!;
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch schema: ${response.statusText}`);
		}
		const schema = await response.json();
		schemaCache.set(url, schema);
		return schema;
	} catch {
		return null;
	}
}

/**
 * Extract the $schema URL from the JSON document
 */
function getSchemaUrl(doc: string): string | null {
	try {
		const parsed = JSON.parse(doc);
		return parsed.$schema || null;
	} catch {
		const match = doc.match(/"?\$schema"?\s*:\s*"([^"]+)"/);
		return match ? match[1] : null;
	}
}

/**
 * Check if cursor is in a position to suggest property keys
 */
function isInPropertyKeyPosition(
	doc: EditorState['doc'],
	pos: number
): boolean {
	const textBefore = doc.sliceString(0, pos);
	const trimmed = textBefore.trim();

	if (trimmed.endsWith('{') || trimmed.endsWith(',')) {
		return true;
	}

	const lastChars = textBefore.slice(-20);
	if (lastChars.match(/[{,]\s*"\w*$/)) {
		return true;
	}

	if (lastChars.match(/[{,]\s*"$/)) {
		return true;
	}

	return false;
}

/**
 * JSON Schema-based autocompletion source
 */
export async function jsonSchemaCompletion(
	context: CompletionContext
): Promise<CompletionResult | null> {
	const doc = context.state.doc;
	const pos = context.pos;
	const docText = doc.toString();
	const currentContainerType = getCurrentContainerType(doc, pos);

	const schemaUrl = getSchemaUrl(docText);
	if (!schemaUrl) {
		return null;
	}

	const schema = await fetchSchema(schemaUrl);
	if (!schema) {
		return null;
	}

	const valuePropertyName = getPropertyNameForValueCompletion(doc, pos);

	let path = getJsonPath(doc, pos);
	const contextPath = path.slice();

	if (
		valuePropertyName &&
		path.length > 0 &&
		path[path.length - 1].type === 'key'
	) {
		path = path.slice(0, -1);
	}

	// Navigate the path while applying discriminator filtering at each level
	let currentSchema = schema;
	currentSchema = resolveSchemaRefs(currentSchema, schema);

	for (const segment of path) {
		if (segment.type === 'key' && currentSchema.properties) {
			const next = currentSchema.properties[segment.key!];
			if (!next) return null;
			currentSchema = resolveSchemaRefs(next, schema);
		} else if (segment.type === 'array') {
			if (currentSchema.type === 'array' && currentSchema.items) {
				currentSchema = resolveSchemaRefs(currentSchema.items, schema);

				// Check if this schema has a discriminator defined at the top level
				const hasTopLevelDiscriminator =
					currentSchema.discriminator?.propertyName;

				// Check if this array items has a discriminator
				if (
					hasTopLevelDiscriminator ||
					currentSchema.anyOf ||
					currentSchema.oneOf
				) {
					// Look for discriminator at this level
					const discriminator =
						hasTopLevelDiscriminator ||
						(() => {
							const firstOption =
								currentSchema.anyOf?.[0] ||
								currentSchema.oneOf?.[0];
							if (firstOption) {
								const resolved = resolveSchemaRefs(
									firstOption,
									schema
								);
								return resolved.discriminator?.propertyName;
							}
							return undefined;
						})();

					if (discriminator) {
						// Only try to find discriminator value if we're navigating THROUGH the array
						// to a nested property. If we're AT the array level (completing properties
						// of the array item itself), we'll handle discriminator logic later.
						const isNavigatingDeeper =
							path.length > path.indexOf(segment) + 1;

						if (isNavigatingDeeper) {
							// Find the discriminator value at the ARRAY ITEM level, not at the current cursor position
							// We need to find the opening brace of the array item, not the nested object
							const textBefore = doc.sliceString(0, pos);
							let braceDepth = 0;
							let arrayItemStart = -1;

							// Walk backward from cursor, tracking brace depth
							// We want to find the opening brace where we entered the array item (depth becomes -1)
							for (let i = textBefore.length - 1; i >= 0; i--) {
								const char = textBefore[i];
								if (char === '}') {
									braceDepth++;
								} else if (char === '{') {
									if (braceDepth === -1) {
										// This is the opening brace of the array item
										arrayItemStart = i;
										break;
									}
									braceDepth--;
								} else if (char === '[' && braceDepth === 0) {
									// We've gone back past the array opening without finding an item start
									break;
								}
							}

							let discriminatorValue: string | null = null;
							if (arrayItemStart !== -1) {
								// Look for the discriminator within this array item object
								const arrayItemText =
									textBefore.substring(arrayItemStart);
								const regex = new RegExp(
									`"${discriminator}"\\s*:\\s*"([^"]+)"`
								);
								const match = arrayItemText.match(regex);
								discriminatorValue = match ? match[1] : null;
							}

							if (discriminatorValue) {
								// Filter to the matching schema
								currentSchema = filterSchemaByDiscriminator(
									currentSchema,
									schema,
									discriminator,
									discriminatorValue
								);
							}
						}
					}
				}
			} else if (currentSchema.items) {
				currentSchema = resolveSchemaRefs(currentSchema.items, schema);
			}
		} else if (segment.type === 'object') {
			continue;
		}
	}

	if (!currentSchema) {
		return null;
	}

	// Check for discriminator ONLY in the current schema level
	// A valid discriminator must be present in the DIRECT anyOf/oneOf at this level
	let discriminatorProp = currentSchema.discriminator?.propertyName;
	if (!discriminatorProp && (currentSchema.anyOf || currentSchema.oneOf)) {
		// Check if there's a discriminator defined at this level
		const options = currentSchema.anyOf || currentSchema.oneOf;
		if (options && options.length > 0) {
			const firstOption = options[0];
			const resolved = resolveSchemaRefs(firstOption, schema);
			const candidateDiscriminator = resolved.discriminator?.propertyName;

			// Verify this discriminator actually belongs to THIS level by checking
			// that it's defined as a property in the anyOf/oneOf options themselves
			if (candidateDiscriminator) {
				const discriminatorPresent =
					schemaHasProperty(
						resolved,
						candidateDiscriminator,
						schema
					) ||
					options.some((opt) =>
						schemaHasProperty(opt, candidateDiscriminator, schema)
					);

				if (discriminatorPresent) {
					discriminatorProp = candidateDiscriminator;
				}
			}
		}
	}

	if (valuePropertyName) {
		if (valuePropertyName === discriminatorProp) {
			let schemaWithDiscriminator = currentSchema;
			if (currentSchema.anyOf || currentSchema.oneOf) {
				const firstOption =
					currentSchema.anyOf?.[0] || currentSchema.oneOf?.[0];
				if (firstOption) {
					schemaWithDiscriminator = resolveSchemaRefs(
						firstOption,
						schema
					);
				}
			}

			const discriminatorValues = getDiscriminatorValues(
				schemaWithDiscriminator,
				discriminatorProp
			);

			if (discriminatorValues.length === 0) {
				return null;
			}

			const word = context.matchBefore(/"[^"]*$/);
			const from = word ? word.from + 1 : pos;
			const to = pos;

			const textBefore = doc.sliceString(0, pos);
			const valueMatch = textBefore.match(/"[^"]*$/);
			const typedText = valueMatch
				? valueMatch[0].substring(1).toLowerCase()
				: '';

			let filteredValues = discriminatorValues;
			if (typedText) {
				filteredValues = discriminatorValues.filter((value) =>
					value.toLowerCase().startsWith(typedText)
				);
			}

			const options = filteredValues.map((value) => ({
				label: value,
				type: 'constant',
				apply: value,
				boost: 10,
			}));

			return {
				from,
				to,
				options,
				filter: false,
			};
		}

		const candidateValues = new Set<string>();
		collectPropertyValuesFromSchema(
			currentSchema,
			valuePropertyName,
			schema,
			candidateValues
		);

		if (candidateValues.size > 0) {
			const word = context.matchBefore(/"[^"\\]*$/);
			const from = word ? word.from + 1 : pos;
			const to = pos;
			const typedText = word ? word.text.substring(1).toLowerCase() : '';

			const sortedValues = Array.from(candidateValues).sort((a, b) =>
				a.localeCompare(b)
			);
			const filteredValues = typedText
				? sortedValues.filter((value) =>
						value.toLowerCase().startsWith(typedText)
					)
				: sortedValues;

			const options = filteredValues.map((value) => ({
				label: value,
				type: 'constant',
				apply: value,
			}));

			if (options.length > 0) {
				return {
					from,
					to,
					options,
					filter: false,
				};
			}
		}

		return null;
	}

	const inObjectContainer = currentContainerType === 'object';
	const inKeyPosition =
		inObjectContainer && isInPropertyKeyPosition(doc, pos);
	if (!inKeyPosition) {
		return null;
	}

	const word = context.matchBefore(/"\w*/);
	if (!word && !context.explicit) {
		return null;
	}

	const from = word ? word.from : pos;

	let to = pos;
	const textAfterCursor = doc.sliceString(pos, pos + 50);
	const quoteMatch = textAfterCursor.match(/^(\w*)"/);

	if (quoteMatch) {
		to = pos + quoteMatch[0].length;
	}

	const isPluginDataContext = contextPath.some(
		(segment) => segment.type === 'key' && segment.key === 'pluginData'
	);
	const resourceValue = isPluginDataContext
		? getCurrentDiscriminatorValue(doc, pos, 'resource')
		: null;

	let schemaCandidate = currentSchema;
	let schemaAlreadyMerged = false;

	if (isPluginDataContext && resourceValue) {
		const filtered = filterSchemaByConstProperty(
			schemaCandidate,
			schema,
			'resource',
			resourceValue
		);
		if (filtered) {
			schemaCandidate = filtered;
			schemaAlreadyMerged = true;
		}
	}

	const currentDiscriminatorValue = getCurrentDiscriminatorValue(
		doc,
		pos,
		discriminatorProp
	);

	if (currentDiscriminatorValue && discriminatorProp) {
		schemaCandidate = filterSchemaByDiscriminator(
			schemaCandidate,
			schema,
			discriminatorProp,
			currentDiscriminatorValue
		);
		schemaAlreadyMerged = true;
	} else if (discriminatorProp) {
		const mergedSchema = mergeCompositeSchemas(schemaCandidate, schema);
		const discriminatorProperty =
			mergedSchema.properties?.[discriminatorProp];

		if (discriminatorProperty) {
			schemaCandidate = {
				...schemaCandidate,
				properties: {
					[discriminatorProp]: discriminatorProperty,
				},
				required: schemaCandidate.required?.includes(discriminatorProp)
					? [discriminatorProp]
					: [],
			};
		}
	} else if (!schemaAlreadyMerged) {
		schemaCandidate = mergeCompositeSchemas(schemaCandidate, schema);
		schemaAlreadyMerged = true;
	}

	currentSchema = schemaCandidate;

	if (!currentSchema || !currentSchema.properties) {
		return null;
	}

	const existingKeys = getExistingKeysInCurrentObject(doc, pos);
	const currentlyTypingKey =
		word && word.text.length > 1 ? word.text.substring(1) : null;
	const discriminatorMissing = Boolean(
		discriminatorProp && !existingKeys.has(discriminatorProp)
	);

	const calculatedTo = to;

	let propertyKeys = Object.keys(currentSchema.properties).filter((key) => {
		if (existingKeys.has(key) && key !== currentlyTypingKey) {
			return false;
		}
		return true;
	});

	if (
		discriminatorProp &&
		discriminatorMissing &&
		currentSchema.properties[discriminatorProp]
	) {
		propertyKeys = [discriminatorProp];
	}

	const options = propertyKeys.map((key) => {
		const prop = currentSchema.properties![key];
		const resolvedProp = resolveSchemaRefs(prop, schema);
		const effectiveProp = resolvedProp;
		const required =
			currentSchema.required && currentSchema.required.includes(key);
		const isDiscriminator = key === discriminatorProp;
		const isPluginData = key === 'pluginData';

		let valueToInsert = '';
		const propTypes = Array.isArray(effectiveProp.type)
			? effectiveProp.type
			: effectiveProp.type
				? [effectiveProp.type]
				: [];

		const hasObjectShape =
			propTypes.includes('object') ||
			!!effectiveProp.properties ||
			!!effectiveProp.allOf ||
			!!effectiveProp.anyOf ||
			!!effectiveProp.oneOf;
		const hasArrayShape =
			propTypes.includes('array') || !!effectiveProp.items;
		const hasStringShape = propTypes.includes('string');
		const hasNumberShape =
			propTypes.includes('number') || propTypes.includes('integer');
		const hasBooleanShape = propTypes.includes('boolean');
		const hasEnumValues =
			Array.isArray(effectiveProp.enum) && effectiveProp.enum.length > 0;

		if (hasArrayShape) {
			valueToInsert = '[]';
		} else if (hasObjectShape) {
			valueToInsert = '{}';
		} else if (hasStringShape) {
			valueToInsert = '""';
		} else if (hasNumberShape) {
			valueToInsert = '0';
		} else if (hasBooleanShape) {
			valueToInsert = 'false';
		} else if (effectiveProp.const !== undefined) {
			valueToInsert = JSON.stringify(effectiveProp.const);
		} else if (effectiveProp.enum && effectiveProp.enum.length > 0) {
			valueToInsert = JSON.stringify(effectiveProp.enum[0]);
		} else {
			valueToInsert = '""';
		}

		if (isPluginData) {
			valueToInsert = '{ "resource": "" }';
		}

		const keepCursorInString = valueToInsert === '""' && !isPluginData;
		const keepCursorInObject = !isPluginData && hasObjectShape;

		let boost = 0;
		if (isDiscriminator) {
			boost = 10;
		} else if (required) {
			boost = 1;
		}

		return {
			label: key,
			type: 'property',
			detail: (prop.type as string) || (prop.enum ? 'enum' : 'any'),
			info: prop.description || '',
			apply: (view: EditorView) => {
				const insertText = `"${key}": ${valueToInsert}`;

				let cursorOffset;
				if (isPluginData) {
					const resourcePrefix = '"pluginData": { "resource": "';
					const prefixIndex = insertText.indexOf(resourcePrefix);
					cursorOffset = prefixIndex + resourcePrefix.length;
				} else if (hasObjectShape) {
					cursorOffset = insertText.length - 1;
				} else if (hasArrayShape) {
					cursorOffset = insertText.length - 1;
				} else if (hasStringShape) {
					cursorOffset = insertText.length - 1;
				} else {
					cursorOffset = insertText.length;
				}

				view.dispatch({
					changes: { from, to: calculatedTo, insert: insertText },
					selection: { anchor: from + cursorOffset },
				});

				setTimeout(() => {
					formatEditor(view);

					if (isPluginData) {
						const resourcePrefix = '"resource": "';
						const docText = view.state.doc.toString();
						const searchStart = from;
						const resourceIndex = docText.indexOf(
							resourcePrefix,
							Math.max(0, searchStart - 10)
						);
						if (resourceIndex !== -1) {
							const anchor =
								resourceIndex + resourcePrefix.length;
							view.dispatch({ selection: { anchor } });
							startCompletion(view);
						}
						return;
					}

					if (keepCursorInObject) {
						const docText = view.state.doc.toString();
						const searchStart = Math.max(0, from - 20);
						const pattern = `"${key}": {`;
						const propertyIndex = docText.indexOf(
							pattern,
							searchStart
						);
						if (propertyIndex !== -1) {
							const anchor = propertyIndex + pattern.length;
							view.dispatch({ selection: { anchor } });
							startCompletion(view);
							return;
						}
					}

					if (keepCursorInString) {
						const anchorAfterFormat =
							view.state.selection.main.anchor;
						if (anchorAfterFormat >= 2) {
							const docText = view.state.doc.toString();
							const lastChar = docText[anchorAfterFormat - 1];
							const prevChar = docText[anchorAfterFormat - 2];
							if (lastChar === '"' && prevChar === '"') {
								view.dispatch({
									selection: {
										anchor: anchorAfterFormat - 1,
									},
								});
							}
						}

						if (hasEnumValues) {
							startCompletion(view);
						}
					}

					if (isDiscriminator && prop.type === 'string') {
						startCompletion(view);
					}
				}, 0);
			},
			boost,
		};
	});

	const enforceDiscriminator = discriminatorMissing;

	let filteredOptions = options;
	if (!enforceDiscriminator && word && word.text.length > 1) {
		const typed = word.text.substring(1).toLowerCase();
		filteredOptions = options.filter((opt) =>
			opt.label.toLowerCase().startsWith(typed)
		);
	}

	return {
		from,
		to,
		options: filteredOptions,
		filter: false,
	};
}

/**
 * Create the string editor toolbar tooltip extension
 */
function createStringEditorTooltip(openStringEditor: () => boolean) {
	const stringEditorTooltipField = StateField.define<Tooltip | null>({
		create() {
			return null;
		},
		update(_tooltip, tr) {
			const pos = tr.state.selection.main.head;
			const stringInfo = getStringNodeAtPosition(tr.state.doc, pos);

			if (!stringInfo) {
				return null;
			}

			// Only show the button if the string can be JSON-parsed
			if (tryParseJsonString(stringInfo.rawValue) === null) {
				return null;
			}

			return {
				pos: stringInfo.contentStart,
				above: true,
				strictSide: true,
				arrow: false,
				create: (view: EditorView) => {
					const dom = document.createElement('div');
					dom.className = 'cm-string-editor-toolbar';

					const button = document.createElement('button');
					button.className = 'cm-string-editor-button';
					button.innerHTML = '✎ Multiline Edit';
					button.title = 'Edit string (Cmd/Ctrl+E)';
					button.onmousedown = (e) => {
						e.preventDefault();
						e.stopPropagation();
						openStringEditor();
					};

					dom.appendChild(button);

					// Keep the toolbar visible during horizontal scroll
					const updatePosition = () => {
						const tooltip = dom.parentElement;
						if (!tooltip) return;

						const scrollContainer = view.scrollDOM;
						const containerRect =
							scrollContainer.getBoundingClientRect();
						const tooltipRect = tooltip.getBoundingClientRect();

						// If tooltip would be to the left of the visible area, translate it right
						const minLeft = containerRect.left + 8; // 8px padding from edge
						if (tooltipRect.left < minLeft) {
							const offset = minLeft - tooltipRect.left;
							dom.style.transform = `translateX(${offset}px)`;
						} else {
							dom.style.transform = '';
						}
					};

					const scrollHandler = () => updatePosition();

					return {
						dom,
						mount: () => {
							view.scrollDOM.addEventListener(
								'scroll',
								scrollHandler
							);
							// Initial position check
							requestAnimationFrame(updatePosition);
						},
						destroy: () => {
							view.scrollDOM.removeEventListener(
								'scroll',
								scrollHandler
							);
						},
					};
				},
			};
		},
		provide: (field) =>
			showTooltip.compute([field], (state) => state.field(field)),
	});

	return stringEditorTooltipField;
}

const DEFAULT_DOC = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json"
}`;

interface StringEditorState {
	isOpen: boolean;
	initialValue: string;
	language: SupportedLanguage;
	contentStart: number;
	contentEnd: number;
}

export function JSONSchemaEditor({
	config = {},
	className = '',
}: JSONSchemaEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);

	// State for the string editor modal
	const [stringEditorState, setStringEditorState] =
		useState<StringEditorState>({
			isOpen: false,
			initialValue: '',
			language: 'text',
			contentStart: 0,
			contentEnd: 0,
		});

	// Open the string editor modal for the string at the current cursor position
	const openStringEditor = useCallback(() => {
		const view = viewRef.current;
		if (!view) return false;

		const pos = view.state.selection.main.head;
		const stringInfo = getStringNodeAtPosition(view.state.doc, pos);

		if (!stringInfo) return false;

		const parsedValue = tryParseJsonString(stringInfo.rawValue);
		if (parsedValue === null) return false;

		const language = detectLanguage(
			stringInfo.path,
			stringInfo.stepType,
			parsedValue
		);

		setStringEditorState({
			isOpen: true,
			initialValue: parsedValue,
			language,
			contentStart: stringInfo.contentStart,
			contentEnd: stringInfo.contentEnd,
		});

		return true;
	}, []);

	// Handle saving from the string editor modal
	const handleStringEditorSave = useCallback(
		(newValue: string) => {
			const view = viewRef.current;
			if (!view) return;

			// JSON.stringify adds surrounding quotes, so we strip them
			const escapedValue = JSON.stringify(newValue).slice(1, -1);

			view.dispatch({
				changes: {
					from: stringEditorState.contentStart,
					to: stringEditorState.contentEnd,
					insert: escapedValue,
				},
			});

			// Format the document after the change
			setTimeout(() => formatEditor(view), 0);
		},
		[stringEditorState.contentStart, stringEditorState.contentEnd]
	);

	const closeStringEditor = useCallback(() => {
		setStringEditorState((prev) => ({ ...prev, isOpen: false }));
		// Refocus the main editor
		setTimeout(() => viewRef.current?.focus(), 0);
	}, []);

	useEffect(() => {
		if (!editorRef.current) return;

		const initialDoc = config.initialDoc || DEFAULT_DOC;
		const autofocus = config.autofocus ?? true;

		const extensions: Extension[] = [
			// Line numbers and highlighting
			lineNumbers(),
			highlightActiveLineGutter(),
			highlightActiveLine(),
			// Folding
			foldGutter(),
			// Selection features
			dropCursor(),
			rectangularSelection(),
			crosshairCursor(),
			// Language support
			json(),
			syntaxHighlighting(defaultHighlightStyle),
			// Indentation
			indentUnit.of('\t'),
			indentOnInput(),
			// Bracket features
			bracketMatching(),
			closeBrackets(),
			// History
			history(),
			// Selection highlighting
			highlightSelectionMatches(),
			// Keymaps
			keymap.of([
				{
					key: 'Mod-e',
					preventDefault: true,
					run: () => openStringEditor(),
				},
				...defaultKeymap,
				...historyKeymap,
				...foldKeymap,
				...searchKeymap,
				...completionKeymap,
				...closeBracketsKeymap,
				indentWithTab,
			]),
			// Autocompletion with JSON schema
			autocompletion({
				override: [jsonSchemaCompletion],
				activateOnTyping: true,
				closeOnBlur: false,
			}),
			// String editor toolbar tooltip
			createStringEditorTooltip(openStringEditor),
			// Styles for the string editor toolbar
			EditorView.baseTheme({
				'.cm-tooltip': {
					border: 'none',
					backgroundColor: 'transparent',
				},
				'.cm-string-editor-toolbar.cm-string-editor-toolbar': {
					display: 'flex',
					alignItems: 'center',
					padding: '0',
					background: '#1e1e1e',
					borderRadius: '6px',
					boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
				},
				'.cm-string-editor-button': {
					display: 'inline-flex',
					alignItems: 'center',
					gap: '4px',
					height: '24px',
					padding: '0 10px',
					border: 'none',
					borderRadius: '4px',
					background: 'transparent',
					color: '#fff',
					cursor: 'pointer',
					fontSize: '12px',
					fontFamily: 'system-ui, sans-serif',
					lineHeight: '1',
					transition: 'background 0.15s',
				},
				'.cm-string-editor-button:hover': {
					background: 'rgba(255,255,255,0.15)',
				},
			}),
		];

		// Add readOnly extension if specified
		if (config.readOnly) {
			extensions.push(EditorState.readOnly.of(true));
		}

		// Add onChange listener if provided
		if (config.onChange) {
			extensions.push(
				EditorView.updateListener.of((update: ViewUpdate) => {
					if (update.docChanged) {
						config.onChange!(update.state.doc.toString());
					}
				})
			);
		}

		const view = new EditorView({
			doc: initialDoc,
			extensions,
			parent: editorRef.current,
		});

		viewRef.current = view;

		formatEditor(view);

		// Position cursor after the first key/value pair if it's the default schema
		const doc = view.state.doc.toString();
		const schemaUrl =
			'"https://playground.wordpress.net/blueprint-schema.json"';
		const schemaLineEnd = doc.indexOf(schemaUrl);
		if (schemaLineEnd > 0) {
			const cursorPos = schemaLineEnd + schemaUrl.length;
			if (cursorPos <= view.state.doc.length) {
				view.dispatch({
					selection: { anchor: cursorPos },
				});
			}
		}

		if (autofocus) {
			view.focus();
		}

		return () => {
			view.destroy();
			viewRef.current = null;
		};
		// Only create the editor once, don't recreate on prop changes
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Handle document updates from parent without recreating the editor
	useEffect(() => {
		const view = viewRef.current;
		if (!view || !config.initialDoc) {
			return;
		}

		const currentDoc = view.state.doc.toString();
		if (config.initialDoc === currentDoc) {
			return;
		}

		// Only update if the change came from outside (not from user typing)
		view.dispatch({
			changes: {
				from: 0,
				to: view.state.doc.length,
				insert: config.initialDoc,
			},
		});
	}, [config.initialDoc]);

	return (
		<>
			<div ref={editorRef} className={className} />
			<StringEditorModal
				isOpen={stringEditorState.isOpen}
				initialValue={stringEditorState.initialValue}
				language={stringEditorState.language}
				onSave={handleStringEditorSave}
				onClose={closeStringEditor}
			/>
		</>
	);
}

export default JSONSchemaEditor;
