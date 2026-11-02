import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { type Extension, StateEffect, StateField } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
	findNodeAtLocation,
	parseTree,
	type Node as JsonNode,
} from 'jsonc-parser';
import {
	validateBlueprintDeclaration,
	type BlueprintValidationResult,
} from '@wp-playground/blueprints';

/**
 * State effect used to notify external code when validation state changes
 */
export const validationStateEffect = StateEffect.define<{
	hasErrors: boolean;
	result: BlueprintValidationResult | null;
}>();

/**
 * State field that tracks the current validation state
 */
export const validationStateField = StateField.define<{
	hasErrors: boolean;
	result: BlueprintValidationResult | null;
}>({
	create: () => ({ hasErrors: false, result: null }),
	update: (value, tr) => {
		for (const effect of tr.effects) {
			if (effect.is(validationStateEffect)) {
				return effect.value;
			}
		}
		return value;
	},
});

/**
 * Creates a Blueprint linter extension that validates JSON against the
 * Blueprint schema and highlights errors in the editor.
 *
 * @param onValidationChange - Callback invoked when validation state changes
 * @returns CodeMirror extension for Blueprint validation
 */
export function createBlueprintLinter(
	onValidationChange?: (result: BlueprintValidationResult | null) => void
): Extension {
	return [
		validationStateField,
		lintGutter(),
		linter(
			async (view: EditorView): Promise<Diagnostic[]> => {
				const docText = view.state.doc.toString();

				// Skip validation for empty documents
				if (!docText.trim()) {
					dispatchValidationState(view, false, null);
					onValidationChange?.(null);
					return [];
				}

				// Parse the JSON document
				let parsedJson: unknown;
				try {
					parsedJson = JSON.parse(docText);
				} catch (e) {
					// JSON parse error - find the position of the syntax error
					const syntaxError = e as SyntaxError;
					const errorMessage = syntaxError.message;

					// Try to extract position from error message
					// Error messages look like: "Unexpected token } in JSON at position 123"
					const posMatch = errorMessage.match(/position\s+(\d+)/i);
					const errorPos = posMatch ? parseInt(posMatch[1], 10) : 0;

					const diagnostic: Diagnostic = {
						from: Math.min(errorPos, docText.length),
						to: Math.min(errorPos + 1, docText.length),
						severity: 'error',
						message: `Invalid JSON: ${errorMessage}`,
					};

					const result: BlueprintValidationResult = {
						valid: false,
						errors: [
							{
								instancePath: '',
								schemaPath: '',
								keyword: 'syntax',
								params: {},
								message: errorMessage,
							},
						],
					};

					dispatchValidationState(view, true, result);
					onValidationChange?.(result);
					return [diagnostic];
				}

				// Validate against Blueprint schema
				if (typeof parsedJson !== 'object' || parsedJson === null) {
					const result: BlueprintValidationResult = {
						valid: false,
						errors: [
							{
								instancePath: '',
								schemaPath: '',
								keyword: 'type',
								params: { type: 'object' },
								message: 'Blueprint must be an object',
							},
						],
					};
					dispatchValidationState(view, true, result);
					onValidationChange?.(result);
					return [
						{
							from: 0,
							to: docText.length,
							severity: 'error',
							message: 'Blueprint must be an object',
						},
					];
				}

				const validationResult =
					await validateBlueprintDeclaration(parsedJson);
				// A v2 validator may load asynchronously. Ignore its result if the
				// author changed the document while it was loading.
				if (view.state.doc.toString() !== docText) {
					return [];
				}

				if (validationResult.valid) {
					dispatchValidationState(view, false, validationResult);
					onValidationChange?.(validationResult);
					return [];
				}

				// Parse the document tree to find node positions
				const tree = parseTree(docText);
				if (!tree) {
					dispatchValidationState(view, true, validationResult);
					onValidationChange?.(validationResult);
					return [];
				}

				// Convert validation errors to diagnostics
				const diagnostics: Diagnostic[] = validationResult.errors.map(
					(error) => {
						// Parse the instance path (e.g., "/steps/0" -> ["steps", 0])
						const pathSegments = parseInstancePath(
							error.instancePath,
							tree
						);

						let from: number;
						let to: number;

						// Special handling for additionalProperties errors -
						// highlight just the unknown property, not the entire object
						if (
							error.keyword === 'additionalProperties' &&
							error.params?.additionalProperty
						) {
							const propName = error.params
								.additionalProperty as string;
							const extendedPath = [...pathSegments, propName];
							const propNode = findNodeAtLocation(
								tree,
								extendedPath
							);

							if (propNode?.parent?.type === 'property') {
								// Highlight the entire property (key + value)
								from = propNode.parent.offset;
								to =
									propNode.parent.offset +
									propNode.parent.length;
							} else if (propNode) {
								from = propNode.offset;
								to = propNode.offset + propNode.length;
							} else {
								// Fall back to first character
								from = 0;
								to = 1;
							}
						} else {
							// Find the node at this path
							const node = findNodeAtLocation(tree, pathSegments);

							if (node) {
								from = node.offset;
								to = node.offset + node.length;
							} else if (pathSegments.length > 0) {
								// Try parent path if the exact node isn't found
								const parentPath = pathSegments.slice(0, -1);
								const parentNode = findNodeAtLocation(
									tree,
									parentPath
								);
								if (parentNode) {
									from = parentNode.offset;
									to = parentNode.offset + parentNode.length;
								} else {
									// Fall back to document start
									from = 0;
									to = Math.min(1, docText.length);
								}
							} else {
								// Root-level error
								from = 0;
								to = Math.min(1, docText.length);
							}
						}

						return {
							from,
							to,
							severity: 'error' as const,
							message: formatErrorMessage(error),
						};
					}
				);

				dispatchValidationState(view, true, validationResult);
				onValidationChange?.(validationResult);
				return diagnostics;
			},
			{
				delay: 300, // Debounce validation
			}
		),
	];
}

/**
 * Dispatch validation state to the editor state
 */
function dispatchValidationState(
	view: EditorView,
	hasErrors: boolean,
	result: BlueprintValidationResult | null
): void {
	view.dispatch({
		effects: validationStateEffect.of({ hasErrors, result }),
	});
}

/**
 * Parses an AJV instance path into path segments for jsonc-parser.
 *
 * AJV reports an error location as a JSON Pointer, where each `/` separates
 * one complete object key or array index. For example, `/steps/10/step` has
 * the three segments `steps`, `10`, and `step`; the digits are not split.
 */
function parseInstancePath(
	instancePath: string,
	tree: JsonNode
): (string | number)[] {
	if (!instancePath) {
		return [];
	}

	const path: (string | number)[] = [];
	let currentNode: JsonNode | undefined = tree;
	// Remove only the leading JSON Pointer separator. Splitting the remainder
	// preserves empty object keys, such as the final segment in `/siteOptions/`.
	for (const encodedSegment of instancePath.slice(1).split('/')) {
		// JSON Pointer escapes `~` as `~0` and `/` as `~1` within a segment.
		// Decode `~1` first: `~01` means the literal text `~1`; decoding `~0`
		// first would turn it into `~1` and then incorrectly into `/`.
		const segment = encodedSegment
			.replaceAll('~1', '/')
			.replaceAll('~0', '~');
		// A segment such as `10` may be either an object key or an array index.
		// jsonc-parser expects a number only when its parent is actually an array.
		const arrayIndex = Number(segment);
		const isArrayIndex: boolean =
			currentNode?.type === 'array' &&
			Number.isSafeInteger(arrayIndex) &&
			arrayIndex >= 0 &&
			String(arrayIndex) === segment;
		const pathSegment: string | number = isArrayIndex
			? arrayIndex
			: segment;
		path.push(pathSegment);
		currentNode = currentNode
			? findNodeAtLocation(currentNode, [pathSegment])
			: undefined;
	}
	return path;
}

/**
 * Format an AJV error object into a human-readable message
 */
function formatErrorMessage(error: {
	keyword: string;
	message?: string;
	params?: Record<string, unknown>;
	instancePath?: string;
}): string {
	const path = error.instancePath || '(root)';
	let message = error.message || 'Validation error';

	// Add more context based on the error type
	if (error.keyword === 'additionalProperties' && error.params) {
		const prop = error.params.additionalProperty;
		message = `Unknown property "${prop}"`;
	} else if (error.keyword === 'required' && error.params) {
		const prop = error.params.missingProperty;
		message = `Missing required property "${prop}"`;
	} else if (error.keyword === 'enum' && error.params) {
		const allowed = error.params.allowedValues;
		if (Array.isArray(allowed)) {
			message = `Value must be one of: ${allowed.join(', ')}`;
		}
	} else if (error.keyword === 'type' && error.params) {
		const expected = error.params.type;
		message = `Expected ${expected}`;
	}

	return `${path === '(root)' ? '' : path + ': '}${message}`;
}
