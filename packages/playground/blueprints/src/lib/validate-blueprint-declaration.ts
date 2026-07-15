import {
	validateBlueprint,
	type BlueprintValidationResult,
} from './v1/compile';

/**
 * Validates either Blueprint declaration version without loading the v2
 * validator for v1 declarations.
 */
export async function validateBlueprintDeclaration(
	blueprintMaybe: unknown
): Promise<BlueprintValidationResult> {
	if (isBlueprintV2Candidate(blueprintMaybe)) {
		const { validateBlueprintV2Declaration } =
			await import('./v2/validate-blueprint-v2');
		return validateBlueprintV2Declaration(blueprintMaybe);
	}

	return validateBlueprint(blueprintMaybe as object);
}

/** Selects v2 only when the declaration explicitly requests version 2. */
function isBlueprintV2Candidate(
	blueprintMaybe: unknown
): blueprintMaybe is { version: 2 } {
	return (
		typeof blueprintMaybe === 'object' &&
		blueprintMaybe !== null &&
		'version' in blueprintMaybe &&
		blueprintMaybe.version === 2
	);
}
