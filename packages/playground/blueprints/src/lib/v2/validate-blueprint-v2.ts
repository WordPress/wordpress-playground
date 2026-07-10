import type { ErrorObject } from 'ajv';
import blueprintV2Validator from '../../../public/blueprint-v2-schema-validator';
import { InvalidBlueprintError } from '../invalid-blueprint-error';

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
	if (blueprintV2Validator(blueprintMaybe)) {
		return { valid: true };
	}

	return {
		valid: false,
		errors: getActionableValidationErrors(
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
				`${index + 1}. At path "${error.path || '/'}": ${error.message}`
		)
		.join('\n');
	return `Invalid Blueprint v2 declaration:\n${details}`;
}

/** Removes failures from union branches that do not match the input's shape. */
function getActionableValidationErrors(
	errors: ErrorObject[]
): BlueprintV2ValidationError[] {
	const errorsByPath = new Map<string, ErrorObject[]>();
	for (const error of errors) {
		const errorsAtPath = errorsByPath.get(error.instancePath) ?? [];
		errorsAtPath.push(error);
		errorsByPath.set(error.instancePath, errorsAtPath);
	}

	const selectedErrors: ErrorObject[] = [];
	for (const [path, errorsAtPath] of errorsByPath) {
		const hasDeeperFailure = Array.from(errorsByPath.keys()).some(
			(otherPath) => isDescendantJsonPointer(path, otherPath)
		);
		if (hasDeeperFailure && errorsAtPath.some(isUnionError)) {
			continue;
		}
		selectedErrors.push(...selectErrorsAtPath(errorsAtPath));
	}

	const normalizedErrors = selectedErrors.map(normalizeValidationError);
	return normalizedErrors.filter(
		(error, index) =>
			normalizedErrors.findIndex(
				(candidate) =>
					candidate.path === error.path &&
					candidate.message === error.message
			) === index
	);
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

/** Indicates whether one JSON Pointer addresses a child of another. */
function isDescendantJsonPointer(parent: string, candidate: string): boolean {
	return parent === ''
		? candidate !== ''
		: candidate.startsWith(`${parent}/`);
}

/** Appends one RFC 6901-escaped segment to a JSON Pointer. */
function appendJsonPointerSegment(path: string, segment: string): string {
	return `${path}/${segment.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}
