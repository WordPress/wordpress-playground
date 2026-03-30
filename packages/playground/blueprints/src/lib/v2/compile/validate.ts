/**
 * Known V2 step names — the set of step discriminators defined in
 * the Blueprint V2 schema's `Step` union type.
 */
export const KNOWN_V2_STEP_NAMES = new Set([
	'defineConstants',
	'setSiteOptions',
	'installPlugin',
	'activatePlugin',
	'installTheme',
	'activateTheme',
	'importThemeStarterContent',
	'importContent',
	'importMedia',
	'runPHP',
	'runSQL',
	'wp-cli',
	'writeFiles',
	'cp',
	'mv',
	'mkdir',
	'rm',
	'rmdir',
	'unzip',
	'setSiteLanguage',
]);

export interface BlueprintValidationV2Result {
	valid: boolean;
	errors: string[];
}

/**
 * Validates an unknown value as a V2 Blueprint declaration.
 *
 * Performs structural checks — not full JSON Schema validation —
 * to catch common authoring mistakes with actionable messages.
 */
export function validateBlueprintV2(
	blueprint: unknown
): BlueprintValidationV2Result {
	const errors: string[] = [];

	if (!isRecord(blueprint)) {
		errors.push('Blueprint must be a JSON object.');
		return { valid: false, errors };
	}

	validateVersion(blueprint, errors);
	validateTopLevelTypes(blueprint, errors);
	validateStepNames(blueprint, errors);

	return { valid: errors.length === 0, errors };
}

// ------------------------------------------------------------------
// Internal validation helpers
// ------------------------------------------------------------------

function validateVersion(
	blueprint: Record<string, unknown>,
	errors: string[]
): void {
	if (!('version' in blueprint)) {
		errors.push(
			'Missing required property "version". ' +
				'A V2 blueprint must include "version": 2.'
		);
		return;
	}
	if (blueprint.version !== 2) {
		errors.push(
			`Invalid version: expected 2, got ${JSON.stringify(blueprint.version)}.`
		);
	}
}

function validateTopLevelTypes(
	blueprint: Record<string, unknown>,
	errors: string[]
): void {
	validateOptionalType(blueprint, 'plugins', 'array', errors);
	validateOptionalType(blueprint, 'themes', 'array', errors);
	validateOptionalType(blueprint, 'muPlugins', 'array', errors);
	validateOptionalType(blueprint, 'media', 'array', errors);
	validateOptionalType(blueprint, 'content', 'array', errors);
	validateOptionalType(blueprint, 'users', 'array', errors);
	validateOptionalType(blueprint, 'roles', 'array', errors);
	validateOptionalType(
		blueprint,
		'additionalStepsAfterExecution',
		'array',
		errors
	);
	validateOptionalType(blueprint, 'siteOptions', 'object', errors);
	validateOptionalType(blueprint, 'constants', 'object', errors);
	validateOptionalType(blueprint, 'applicationOptions', 'object', errors);
	validateOptionalType(blueprint, 'blueprintMeta', 'object', errors);
	validateOptionalType(blueprint, 'postTypes', 'object', errors);
	validateOptionalType(blueprint, 'fonts', 'object', errors);
	validateOptionalStringOrObject(blueprint, 'phpVersion', errors);
	validateOptionalStringOrObject(blueprint, 'wordpressVersion', errors);
	validateOptionalStringLike(blueprint, 'siteLanguage', errors);
}

function validateStepNames(
	blueprint: Record<string, unknown>,
	errors: string[]
): void {
	const steps = blueprint.additionalStepsAfterExecution;
	if (!Array.isArray(steps)) {
		return;
	}
	for (const entry of steps) {
		if (!isRecord(entry) || typeof entry.step !== 'string') {
			continue;
		}
		const name = entry.step;
		if (!KNOWN_V2_STEP_NAMES.has(name)) {
			const suggestion = findClosestStepName(name);
			const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
			errors.push(`Unknown step name "${name}".${hint}`);
		}
	}
}

// ------------------------------------------------------------------
// Property-type assertion helpers
// ------------------------------------------------------------------

function validateOptionalType(
	obj: Record<string, unknown>,
	key: string,
	expected: 'array' | 'object',
	errors: string[]
): void {
	if (!(key in obj) || obj[key] === undefined) {
		return;
	}
	const value = obj[key];
	if (expected === 'array' && !Array.isArray(value)) {
		errors.push(`Property "${key}" must be an array.`);
	} else if (
		expected === 'object' &&
		(typeof value !== 'object' || value === null || Array.isArray(value))
	) {
		errors.push(`Property "${key}" must be an object.`);
	}
}

function validateOptionalStringOrObject(
	obj: Record<string, unknown>,
	key: string,
	errors: string[]
): void {
	if (!(key in obj) || obj[key] === undefined) {
		return;
	}
	const value = obj[key];
	if (
		typeof value !== 'string' &&
		(typeof value !== 'object' || value === null || Array.isArray(value))
	) {
		errors.push(`Property "${key}" must be a string or an object.`);
	}
}

function validateOptionalStringLike(
	obj: Record<string, unknown>,
	key: string,
	errors: string[]
): void {
	if (!(key in obj) || obj[key] === undefined) {
		return;
	}
	if (typeof obj[key] !== 'string') {
		errors.push(`Property "${key}" must be a string.`);
	}
}

// ------------------------------------------------------------------
// Fuzzy matching
// ------------------------------------------------------------------

/**
 * Finds the closest known step name to the given input using
 * Levenshtein distance. Returns `undefined` when no name is
 * close enough (distance > half the target length).
 */
function findClosestStepName(input: string): string | undefined {
	let best: string | undefined;
	let bestDistance = Infinity;

	for (const candidate of KNOWN_V2_STEP_NAMES) {
		const d = levenshteinDistance(
			input.toLowerCase(),
			candidate.toLowerCase()
		);
		if (d < bestDistance) {
			bestDistance = d;
			best = candidate;
		}
	}

	// Only suggest if the distance is reasonable — at most
	// half the longer string's length.
	const maxLen = Math.max(input.length, best?.length ?? 0);
	if (bestDistance <= Math.ceil(maxLen / 2)) {
		return best;
	}
	return undefined;
}

/**
 * Standard Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () =>
		new Array<number>(n + 1).fill(0)
	);

	for (let i = 0; i <= m; i++) {
		dp[i][0] = i;
	}
	for (let j = 0; j <= n; j++) {
		dp[0][j] = j;
	}

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,
				dp[i][j - 1] + 1,
				dp[i - 1][j - 1] + cost
			);
		}
	}

	return dp[m][n];
}

// ------------------------------------------------------------------
// Utility
// ------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
