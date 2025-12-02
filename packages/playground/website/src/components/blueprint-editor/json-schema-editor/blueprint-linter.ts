import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { type Extension, StateEffect, StateField } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { findNodeAtLocation, parseTree } from 'jsonc-parser';
import {
	validateBlueprint,
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
			(view: EditorView): Diagnostic[] => {
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

				const validationResult = validateBlueprint(parsedJson);

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
							error.instancePath
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
 * Parse an AJV instance path into path segments.
 * "/steps/0/step" -> ["steps", 0, "step"]
 */
function parseInstancePath(instancePath: string): (string | number)[] {
	if (!instancePath || instancePath === '') {
		return [];
	}

	return instancePath
		.split('/')
		.filter((segment) => segment !== '')
		.map((segment) => {
			const asNumber = parseInt(segment, 10);
			return isNaN(asNumber) ? segment : asNumber;
		});
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
