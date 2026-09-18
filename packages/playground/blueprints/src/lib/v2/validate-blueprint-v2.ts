import type { ErrorObject } from 'ajv';
import blueprintV2Validator from '../../../public/blueprint-v2-schema-validator';
import { InvalidBlueprintError } from '../invalid-blueprint-error';
import type { BlueprintValidationResult } from '../v1/compile';

export type BlueprintV2ValidationError = {
	path: string;
	message: string;
};

export type BlueprintV2ValidationResult =
	| { valid: true }
	| { valid: false; errors: BlueprintV2ValidationError[] };

/** Validates an unknown value against the complete Blueprint v2 schema. */
export function validateBlueprintV2(
	blueprintMaybe: unknown
): BlueprintV2ValidationResult {
	const validationResult = validateBlueprintV2Declaration(blueprintMaybe);
	if (validationResult.valid) {
		return { valid: true };
	}

	return {
		valid: false,
		errors: validationResult.errors.map(normalizeValidationError),
	};
}

/** Returns actionable AJV errors with location data for editors and tooling. */
export function validateBlueprintV2Declaration(
	blueprintMaybe: unknown
): BlueprintValidationResult {
	const valid = blueprintV2Validator(blueprintMaybe);
	return valid
		? { valid: true }
		: {
				valid: false,
				errors: getActionableAjvErrors(
					blueprintV2Validator.errors ?? []
				),
			};
}

/** Rejects an invalid value before any Blueprint v2 runtime work begins. */
export function assertValidBlueprintV2Declaration(
	blueprintMaybe: unknown
): void {
	const result = validateBlueprintV2(blueprintMaybe);
	if (!result.valid) {
		throw new InvalidBlueprintError(
			formatValidationErrors(result.errors),
			result.errors
		);
	}
}

/** Formats structured schema failures for callers that only display a message. */
function formatValidationErrors(errors: BlueprintV2ValidationError[]): string {
	const details = errors
		.map(
			(error, index) =>
				`${index + 1}. At ${
					error.path ? `path "${error.path}"` : 'the document root'
				}: ${error.message}`
		)
		.join('\n');
	return `Invalid Blueprint v2 declaration:\n${details}`;
}

/** Removes failures from union branches that do not match the input's shape. */
function getActionableAjvErrors(errors: ErrorObject[]): ErrorObject[] {
	const errorsByPath = new Map<string, ErrorObject[]>();
	for (const error of errors) {
		const errorsAtPath = errorsByPath.get(error.instancePath) ?? [];
		errorsAtPath.push(error);
		errorsByPath.set(error.instancePath, errorsAtPath);
	}

	const pathsWithDescendants = new Set<string>();
	// Walk JSON Pointer segment boundaries instead of comparing every path pair.
	for (const path of errorsByPath.keys()) {
		let separatorIndex = path.lastIndexOf('/');
		while (separatorIndex >= 0) {
			const ancestorPath = path.slice(0, separatorIndex);
			if (errorsByPath.has(ancestorPath)) {
				pathsWithDescendants.add(ancestorPath);
			}
			if (separatorIndex === 0) {
				break;
			}
			separatorIndex = path.lastIndexOf('/', separatorIndex - 1);
		}
	}

	const selectedErrors: ErrorObject[] = [];
	for (const [path, errorsAtPath] of errorsByPath) {
		if (pathsWithDescendants.has(path) && errorsAtPath.some(isUnionError)) {
			continue;
		}
		selectedErrors.push(...selectErrorsAtPath(errorsAtPath));
	}

	const normalizedKeys = new Set<string>();
	return selectedErrors.filter((error) => {
		const normalized = normalizeValidationError(error);
		const key = JSON.stringify([normalized.path, normalized.message]);
		if (normalizedKeys.has(key)) {
			return false;
		}
		normalizedKeys.add(key);
		return true;
	});
}

/** Selects the most specific useful failures reported for one input value. */
function selectErrorsAtPath(errors: ErrorObject[]): ErrorObject[] {
	const unionErrors = errors.filter(isUnionError);
	const structuralErrors = errors.filter((error) =>
		[
			'additionalProperties',
			'required',
			'discriminator',
			'propertyNames',
		].includes(error.keyword)
	);
	if (
		structuralErrors.length > 0 &&
		(unionErrors.length === 0 ||
			structuralErrors.every(
				(error) => error.keyword === 'additionalProperties'
			))
	) {
		return structuralErrors;
	}

	if (unionErrors.length > 0) {
		return [getDeclaringUnionError(unionErrors)];
	}

	const nonTypeError = errors.find((error) => error.keyword !== 'type');
	return nonTypeError ? [nonTypeError] : errors.slice(0, 1);
}

/** Returns the union summary attached closest to the declaring property. */
function getDeclaringUnionError(errors: ErrorObject[]): ErrorObject {
	return errors.reduce((selected, error) =>
		error.schemaPath.length > selected.schemaPath.length ? error : selected
	);
}

/** Indicates whether an AJV failure summarizes a schema union. */
function isUnionError(error: ErrorObject): boolean {
	return error.keyword === 'anyOf' || error.keyword === 'oneOf';
}

/** Gives property and discriminator failures their exact JSON Pointer paths. */
function normalizeValidationError(
	error: ErrorObject
): BlueprintV2ValidationError {
	let path = error.instancePath;
	if (error.keyword === 'additionalProperties') {
		path = appendJsonPointerSegment(
			path,
			String(error.params['additionalProperty'])
		);
	} else if (error.keyword === 'required') {
		path = appendJsonPointerSegment(
			path,
			String(error.params['missingProperty'])
		);
	} else if (error.keyword === 'discriminator') {
		path = appendJsonPointerSegment(path, String(error.params['tag']));
	} else if (error.keyword === 'propertyNames') {
		path = appendJsonPointerSegment(
			path,
			String(error.params['propertyName'])
		);
	}

	return {
		path,
		message: isUnionError(error)
			? 'must match one of the allowed forms'
			: (error.message ?? 'does not match the Blueprint v2 schema'),
	};
}

/** Appends one RFC 6901-escaped segment to a JSON Pointer. */
function appendJsonPointerSegment(path: string, segment: string): string {
	return `${path}/${segment.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}
