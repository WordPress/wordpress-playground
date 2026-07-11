import {
	AllPHPVersions,
	LatestSupportedPHPVersion,
	type AllPHPVersion,
} from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getWordPressStableVersions,
	resolveWordPressRelease,
} from '@wp-playground/wordpress';
import type { BlueprintDeclaration, RuntimeConfiguration } from '../types';
import type { BlueprintV2Declaration } from './blueprint-v2-declaration';

const V2_WORDPRESS_VERSION_LABELS = ['latest', 'beta', 'trunk', 'nightly'];
const CUSTOM_WORDPRESS_VERSION = 'custom';
const V2_WORDPRESS_VERSION_PATTERN =
	/^\d+\.\d+(?:\.\d+)?(?:-(?:beta|rc)\d+)?$/i;
const V2_PHP_CONSTRAINT_CANDIDATES = AllPHPVersions.filter(
	(phpVersion) => phpVersion !== 'next'
) as AllPHPVersion[];

type UnvalidatedV2WordPressVersionConstraint = {
	min: unknown;
	max?: unknown;
	preferred?: unknown;
};
type V2WordPressVersionConstraint = {
	min: string;
	max?: string;
	preferred?: string;
};
type ComparableWordPressVersion = {
	parts: [number, number, number, number, number];
	patchSpecified: boolean;
	suffix?: 'beta' | 'rc';
};

/**
 * Resolves the runtime settings required by a Blueprint v2 declaration.
 *
 * This module owns the v2 support boundary: unsupported declarations and
 * runtime sources are rejected here instead of falling back to v1 behavior.
 * The validation callback runs before any runtime source is resolved.
 */
export async function resolveBlueprintV2RuntimeConfiguration(
	declaration: BlueprintDeclaration,
	siteMode: BlueprintV2SiteMode = 'create-new-site',
	onBlueprintValidated?: (declaration: BlueprintV2Declaration) => void
): Promise<RuntimeConfiguration> {
	if (!isBlueprintV2Declaration(declaration)) {
		throw new Error('Expected a Blueprint v2 declaration.');
	}
	const { assertValidBlueprintV2Declaration } =
		await import('./validate-blueprint-v2');
	assertValidBlueprintV2Declaration(declaration);
	onBlueprintValidated?.(declaration);
	const playgroundOptions =
		declaration.applicationOptions?.['wordpress-playground'];
	const wpVersion = await resolveV2WordPressVersion(
		declaration,
		siteMode === 'create-new-site'
	);

	return {
		phpVersion: resolveV2PHPVersion(declaration),
		wpVersion,
		intl: false,
		networking: playgroundOptions?.networkAccess ?? false,
		constants: declaration.constants ?? {},
		extraLibraries: [],
	};
}

/** Describes whether Playground creates a site or applies to mounted files. */
export type BlueprintV2SiteMode = 'create-new-site' | 'apply-to-existing-site';

/**
 * Verifies that an existing site satisfies its Blueprint v2 WordPress version.
 *
 * Only constraint objects restrict an existing site. Shorthand versions,
 * including `latest` and concrete releases, are new-site selection hints.
 * `preferred` is also a selection hint and does not narrow compatibility.
 */
export async function assertBlueprintV2WordPressVersionCompatibility(
	declaration: BlueprintV2Declaration,
	installedVersion: string
): Promise<void> {
	const wordpressVersion = declaration.wordpressVersion;
	if (!isV2WordPressVersionConstraint(wordpressVersion)) {
		return;
	}

	assertV2WordPressVersionConstraintSemantics(wordpressVersion);
	if (
		isV2WordPressVersionWithinConstraints(
			installedVersion,
			wordpressVersion
		)
	) {
		return;
	}
	throwV2WordPressVersionCompatibilityError(
		installedVersion,
		wordpressVersion
	);
}

/**
 * Indicates whether a reflected declaration identifies itself as Blueprint v2.
 */
function isBlueprintV2Declaration(
	declaration: BlueprintDeclaration
): declaration is BlueprintV2Declaration {
	return (declaration as { version?: unknown }).version === 2;
}

/**
 * Selects a supported PHP runtime from a Blueprint v2 version declaration.
 *
 * A constraint's recommended version takes precedence. Without a declaration,
 * Playground uses its recommended PHP version.
 */
function resolveV2PHPVersion(
	declaration: BlueprintV2Declaration
): AllPHPVersion {
	const phpVersion = declaration.phpVersion;
	if (typeof phpVersion === 'string') {
		return resolveV2PHPVersionString(phpVersion);
	}

	const recommendedVersion = getV2PHPConstraintRecommendedVersion(phpVersion);
	if (recommendedVersion) {
		const resolvedRecommendedVersion =
			resolveV2PHPVersionString(recommendedVersion);
		if (
			phpVersion &&
			typeof phpVersion === 'object' &&
			isV2PHPVersionWithinConstraints(
				resolvedRecommendedVersion,
				phpVersion
			)
		) {
			return resolvedRecommendedVersion;
		}
		throw new Error(
			`Blueprint v2 recommended PHP version ` +
				`"${recommendedVersion}" does not satisfy constraints ` +
				`${JSON.stringify(phpVersion)}.`
		);
	}

	const constrainedVersion = resolveV2PHPConstraintVersion(phpVersion);
	if (constrainedVersion) {
		return constrainedVersion;
	}
	if (phpVersion && typeof phpVersion === 'object') {
		throw new Error(
			`Unsatisfiable Blueprint v2 PHP version constraints ` +
				`${JSON.stringify(phpVersion)}. ` +
				`Supported versions: ${AllPHPVersions.join(', ')}.`
		);
	}

	return RecommendedPHPVersion;
}

/**
 * Resolves the `latest` alias or validates a concrete PHP runtime version.
 */
function resolveV2PHPVersionString(phpVersion: string): AllPHPVersion {
	if (phpVersion === 'latest') {
		return LatestSupportedPHPVersion;
	}
	if ((AllPHPVersions as readonly string[]).includes(phpVersion)) {
		return phpVersion as AllPHPVersion;
	}
	throw new Error(
		`Unsupported Blueprint v2 PHP version "${phpVersion}". ` +
			`Supported versions: ${AllPHPVersions.join(', ')}.`
	);
}

/**
 * Returns a constraint's recommended PHP version when it is a string.
 */
function getV2PHPConstraintRecommendedVersion(
	phpVersion: BlueprintV2Declaration['phpVersion']
): string | undefined {
	if (!phpVersion || typeof phpVersion !== 'object') {
		return undefined;
	}
	if (!('recommended' in phpVersion)) {
		return undefined;
	}
	return typeof phpVersion.recommended === 'string'
		? phpVersion.recommended
		: undefined;
}

/**
 * Selects a supported PHP version within the declared constraint bounds.
 *
 * Playground's recommended version wins when compatible; otherwise, the first
 * compatible runtime in the supported-version list is returned.
 */
function resolveV2PHPConstraintVersion(
	phpVersion: BlueprintV2Declaration['phpVersion']
): AllPHPVersion | undefined {
	if (!phpVersion || typeof phpVersion !== 'object') {
		return undefined;
	}
	if (isV2PHPVersionWithinConstraints(RecommendedPHPVersion, phpVersion)) {
		return RecommendedPHPVersion;
	}
	return V2_PHP_CONSTRAINT_CANDIDATES.find((candidate) =>
		isV2PHPVersionWithinConstraints(candidate, phpVersion)
	);
}

/**
 * Indicates whether a PHP version satisfies inclusive Blueprint v2 bounds.
 *
 * The `next` development build is excluded because numeric constraints cannot
 * establish its ordering relative to released versions.
 */
function isV2PHPVersionWithinConstraints(
	phpVersion: AllPHPVersion,
	constraints: Exclude<BlueprintV2Declaration['phpVersion'], string>
): boolean {
	if (phpVersion === 'next') {
		return false;
	}
	const minVersion = normalizeV2PHPConstraintVersion(constraints?.min);
	if (minVersion && comparePHPVersions(phpVersion, minVersion) < 0) {
		return false;
	}
	const maxVersion = normalizeV2PHPConstraintVersion(constraints?.max);
	if (maxVersion && comparePHPVersions(phpVersion, maxVersion) > 0) {
		return false;
	}
	return true;
}

/**
 * Maps the `latest` PHP constraint label to the latest supported runtime.
 */
function normalizeV2PHPConstraintVersion(
	phpVersion: string | undefined
): string | undefined {
	if (phpVersion === 'latest') {
		return LatestSupportedPHPVersion;
	}
	return phpVersion;
}

/**
 * Compares PHP versions by major, minor, and patch components.
 *
 * Returns a negative number when `left` is older, a positive number when it is
 * newer, and zero when both versions have equal components.
 */
function comparePHPVersions(left: string, right: string): number {
	const leftParts = parsePHPVersion(left);
	const rightParts = parsePHPVersion(right);
	for (let i = 0; i < 3; i++) {
		const difference = leftParts[i] - rightParts[i];
		if (difference !== 0) {
			return difference;
		}
	}
	return 0;
}

/**
 * Parses a PHP version into numeric components, defaulting omitted parts to zero.
 */
function parsePHPVersion(phpVersion: string): [number, number, number] {
	const [major = 0, minor = 0, patch = 0] = phpVersion
		.split('.')
		.map((part) => Number(part));
	return [major, minor, patch];
}

/**
 * Resolves the WordPress runtime source from a Blueprint v2 declaration.
 *
 * Missing versions default to `latest`. Custom data references use a synthetic
 * runtime label because their concrete archive is resolved before boot.
 */
async function resolveV2WordPressVersion(
	declaration: BlueprintV2Declaration,
	selectAvailableRelease: boolean
): Promise<string> {
	const wordpressVersion = declaration.wordpressVersion;
	if (typeof wordpressVersion === 'string') {
		return resolveV2WordPressVersionString(wordpressVersion);
	}

	if (isV2WordPressVersionConstraint(wordpressVersion)) {
		if (!selectAvailableRelease) {
			assertV2WordPressVersionConstraintSemantics(wordpressVersion);
			// Existing sites are checked against the bounds before WordPress boot.
			// No concrete download is needed in apply-to-existing-site mode.
			return 'latest';
		}
		const constrainedVersion =
			await resolveV2WordPressConstraintVersion(wordpressVersion);
		if (constrainedVersion) {
			return constrainedVersion;
		}

		throw new Error(
			`Unsatisfiable Blueprint v2 WordPress version constraints ` +
				`${JSON.stringify(wordpressVersion)}. ` +
				'No available WordPress release satisfies the declared bounds.'
		);
	}

	if (wordpressVersion && typeof wordpressVersion === 'object') {
		// Validation guarantees that non-constraint objects are data references.
		// Their archive is resolved separately before WordPress boot.
		return CUSTOM_WORDPRESS_VERSION;
	}

	return 'latest';
}

/**
 * Resolves a Blueprint v2 WordPress version string to a runtime source.
 *
 * Runtime configuration carries named builds and HTTP(S) ZIP URLs directly.
 * Execution-context references use a synthetic label and resolve separately.
 */
function resolveV2WordPressVersionString(wordpressVersion: string): string {
	if (isHttpUrl(wordpressVersion)) {
		return wordpressVersion;
	}
	if (isExecutionContextPath(wordpressVersion)) {
		return CUSTOM_WORDPRESS_VERSION;
	}
	if (
		V2_WORDPRESS_VERSION_LABELS.includes(wordpressVersion) ||
		V2_WORDPRESS_VERSION_PATTERN.test(wordpressVersion)
	) {
		return wordpressVersion;
	}

	throw new Error(
		`Unsupported Blueprint v2 WordPress version "${wordpressVersion}". ` +
			'Use latest, beta, trunk, nightly, or a version like ' +
			'6.8, 6.8.1, 6.8-beta1, or 6.8-rc1.'
	);
}

/**
 * Identifies a constraint-shaped value without trusting its property types.
 *
 * Property validation happens before the object is used for version comparison.
 */
function isV2WordPressVersionConstraint(
	wordpressVersion: unknown
): wordpressVersion is UnvalidatedV2WordPressVersionConstraint {
	if (!wordpressVersion || typeof wordpressVersion !== 'object') {
		return false;
	}
	return 'min' in wordpressVersion;
}

/**
 * Selects an available WordPress release from a Blueprint v2 constraint.
 *
 * Stable releases come from the official WordPress release catalog. A concrete
 * preferred branch or release wins when available and compatible; otherwise the
 * newest release satisfying the bounds is selected.
 */
async function resolveV2WordPressConstraintVersion(
	wordpressVersion: UnvalidatedV2WordPressVersionConstraint
): Promise<string | undefined> {
	assertV2WordPressVersionConstraintSemantics(wordpressVersion);
	const preferredVersion = wordpressVersion.preferred;
	const availableVersions =
		await getAvailableV2WordPressVersions(wordpressVersion);
	if (preferredVersion && preferredVersion !== 'latest') {
		const preferredVersions = availableVersions.filter((candidate) =>
			doesV2WordPressVersionMatchExpression(candidate, preferredVersion)
		);
		if (preferredVersions.length === 0) {
			throw new Error(
				`Blueprint v2 preferred WordPress version ` +
					`"${preferredVersion}" is not available.`
			);
		}
		const compatiblePreferredVersion = preferredVersions.find((candidate) =>
			isV2WordPressVersionWithinConstraints(candidate, wordpressVersion)
		);
		if (compatiblePreferredVersion) {
			return compatiblePreferredVersion;
		}
		throw new Error(
			`Blueprint v2 preferred WordPress version ` +
				`"${preferredVersion}" does not satisfy constraints ` +
				`${JSON.stringify(wordpressVersion)}.`
		);
	}

	return availableVersions.find((candidate) =>
		isV2WordPressVersionWithinConstraints(candidate, wordpressVersion)
	);
}

/**
 * Validates the shape and internal consistency of WordPress version bounds.
 *
 * This check does not consult the release catalog, so existing sites can be
 * checked without requiring a downloadable release for the installed version.
 */
function assertV2WordPressVersionConstraintSemantics(
	wordpressVersion: UnvalidatedV2WordPressVersionConstraint
): asserts wordpressVersion is V2WordPressVersionConstraint {
	assertV2WordPressVersionConstraint(wordpressVersion);
	assertV2ComparableWordPressConstraintVersion(
		'wordpressVersion.min',
		wordpressVersion.min
	);
	if (wordpressVersion.max) {
		assertV2ComparableWordPressConstraintVersion(
			'wordpressVersion.max',
			wordpressVersion.max
		);
	}

	const preferredVersion = wordpressVersion.preferred;
	if (preferredVersion && preferredVersion !== 'latest') {
		assertV2ComparableWordPressConstraintVersion(
			'wordpressVersion.preferred',
			preferredVersion
		);
		if (
			!doesV2WordPressVersionExpressionSatisfyConstraints(
				preferredVersion,
				wordpressVersion
			)
		) {
			throw new Error(
				`Blueprint v2 preferred WordPress version ` +
					`"${preferredVersion}" does not satisfy constraints ` +
					`${JSON.stringify(wordpressVersion)}.`
			);
		}
	}
	if (
		!isV2WordPressVersionWithinConstraints(
			wordpressVersion.min,
			wordpressVersion
		)
	) {
		throw new Error(
			`Unsatisfiable Blueprint v2 WordPress version constraints ` +
				`${JSON.stringify(wordpressVersion)}. ` +
				'The minimum version exceeds the maximum version.'
		);
	}
}

/**
 * Returns comparable WordPress releases ordered from newest to oldest.
 *
 * The stable catalog is exhaustive. The current beta-channel offer is added
 * only for constraints that mention a prerelease because historical
 * prereleases are not part of the stable release catalog.
 */
async function getAvailableV2WordPressVersions(
	constraints?: V2WordPressVersionConstraint
): Promise<string[]> {
	const versions = (await getWordPressStableVersions()).map(
		normalizeV2AvailableWordPressVersion
	);
	if (
		constraints &&
		[constraints.min, constraints.max, constraints.preferred].some(
			(version) =>
				version &&
				parseComparableWordPressVersion(version)?.suffix !== undefined
		)
	) {
		const betaRelease = await resolveWordPressRelease('beta');
		versions.push(betaRelease.version);
	}

	return Array.from(new Set(versions))
		.filter(isComparableWordPressVersion)
		.sort((left, right) => compareWordPressVersions(right, left));
}

/**
 * Preserves an initial stable release as an exact runtime request.
 *
 * WordPress catalogs call the first release in a branch `6.8`, while runtime
 * consumers interpret `6.8` as the newest patch in that branch. The explicit
 * `6.8.0` form keeps constraint selection from booting a newer patch instead.
 */
function normalizeV2AvailableWordPressVersion(
	wordpressVersion: string
): string {
	return /^\d+\.\d+$/.test(wordpressVersion)
		? `${wordpressVersion}.0`
		: wordpressVersion;
}

/**
 * Indicates whether a release matches an exact or branch-style expression.
 *
 * A stable expression without a patch, such as `6.8`, selects the newest stable
 * release in that branch. Patch and prerelease expressions compare exactly.
 */
function doesV2WordPressVersionMatchExpression(
	wordpressVersion: string,
	expression: string
): boolean {
	const parsedVersion = parseComparableWordPressVersion(wordpressVersion);
	const parsedExpression = parseComparableWordPressVersion(expression);
	if (!parsedVersion || !parsedExpression) {
		return false;
	}
	if (!parsedExpression.patchSpecified && !parsedExpression.suffix) {
		return (
			!parsedVersion.suffix &&
			parsedVersion.parts[0] === parsedExpression.parts[0] &&
			parsedVersion.parts[1] === parsedExpression.parts[1]
		);
	}
	return compareWordPressVersions(wordpressVersion, expression) === 0;
}

/**
 * Indicates whether a preferred exact release or branch intersects the bounds.
 *
 * A patchless stable expression such as `6.8` represents the entire stable
 * branch, so it is valid when at least one theoretical `6.8.x` release could
 * satisfy the constraint. Release availability is checked separately.
 */
function doesV2WordPressVersionExpressionSatisfyConstraints(
	expression: string,
	constraints: V2WordPressVersionConstraint
): boolean {
	const parsedExpression = parseComparableWordPressVersion(expression);
	if (!parsedExpression) {
		return false;
	}
	if (parsedExpression.patchSpecified || parsedExpression.suffix) {
		return isV2WordPressVersionWithinConstraints(expression, constraints);
	}

	const parsedMin = parseComparableWordPressVersion(constraints.min)!;
	const branch = parsedExpression.parts.slice(0, 2);
	const minBranch = parsedMin.parts.slice(0, 2);
	if (compareV2WordPressVersionBranches(branch, minBranch) < 0) {
		return false;
	}
	if (!constraints.max) {
		return true;
	}

	const parsedMax = parseComparableWordPressVersion(constraints.max)!;
	const maxBranch = parsedMax.parts.slice(0, 2);
	const maxBranchComparison = compareV2WordPressVersionBranches(
		branch,
		maxBranch
	);
	return (
		maxBranchComparison < 0 ||
		(maxBranchComparison === 0 && !parsedMax.suffix)
	);
}

/**
 * Compares WordPress major/minor branch identifiers.
 */
function compareV2WordPressVersionBranches(
	left: number[],
	right: number[]
): number {
	for (let i = 0; i < 2; i++) {
		const difference = left[i] - right[i];
		if (difference !== 0) {
			return difference;
		}
	}
	return 0;
}

/**
 * Throws the common existing-site compatibility diagnostic.
 */
function throwV2WordPressVersionCompatibilityError(
	installedVersion: string,
	requirement: V2WordPressVersionConstraint
): never {
	throw new Error(
		`Installed WordPress version "${installedVersion}" does not satisfy ` +
			`Blueprint v2 wordpressVersion ${JSON.stringify(requirement)}.`
	);
}

/**
 * Validates the property types of a constraint-shaped WordPress version value.
 */
function assertV2WordPressVersionConstraint(
	wordpressVersion: UnvalidatedV2WordPressVersionConstraint
): asserts wordpressVersion is V2WordPressVersionConstraint {
	assertV2StringWordPressConstraintVersion(
		'wordpressVersion.min',
		wordpressVersion.min
	);
	if (wordpressVersion.max !== undefined) {
		assertV2StringWordPressConstraintVersion(
			'wordpressVersion.max',
			wordpressVersion.max
		);
	}
	if (wordpressVersion.preferred !== undefined) {
		assertV2StringWordPressConstraintVersion(
			'wordpressVersion.preferred',
			wordpressVersion.preferred
		);
	}
}

/**
 * Validates that a WordPress constraint field contains a string value.
 *
 * The supplied schema path is included in the error so malformed runtime input
 * can be traced back to the exact Blueprint field.
 */
function assertV2StringWordPressConstraintVersion(
	path: string,
	value: unknown
) {
	if (typeof value === 'string') {
		return;
	}
	throw new Error(
		`Unsupported Blueprint v2 WordPress version constraint ` +
			`${path} ${JSON.stringify(value)}. ` +
			'Use a version like 6.8, 6.8.1, 6.8-beta1, or 6.8-rc1.'
	);
}

/**
 * Validates that a WordPress constraint field can participate in comparisons.
 *
 * Runtime labels and custom URLs are valid top-level sources but not constraint
 * bounds, which must use concrete release versions.
 */
function assertV2ComparableWordPressConstraintVersion(
	path: string,
	wordpressVersion: string
) {
	if (isComparableWordPressVersion(wordpressVersion)) {
		return;
	}
	throw new Error(
		`Unsupported Blueprint v2 WordPress version constraint ` +
			`${path} "${wordpressVersion}". ` +
			'Use a version like 6.8, 6.8.1, 6.8-beta1, or 6.8-rc1.'
	);
}

/**
 * Indicates whether a WordPress release satisfies inclusive constraint bounds.
 *
 * Non-comparable runtime labels and custom URLs never satisfy constraints.
 */
function isV2WordPressVersionWithinConstraints(
	wordpressVersion: string,
	constraints: V2WordPressVersionConstraint
): boolean {
	const parsedVersion = parseComparableWordPressVersion(wordpressVersion);
	const parsedMin = parseComparableWordPressVersion(constraints.min);
	if (!parsedVersion || !parsedMin) {
		return false;
	}
	if (compareWordPressVersions(wordpressVersion, constraints.min) < 0) {
		return false;
	}
	if (!constraints.max) {
		return true;
	}
	const parsedMax = parseComparableWordPressVersion(constraints.max);
	if (!parsedMax) {
		return false;
	}
	if (
		!parsedMax.patchSpecified &&
		!parsedMax.suffix &&
		parsedVersion.parts[0] === parsedMax.parts[0] &&
		parsedVersion.parts[1] === parsedMax.parts[1]
	) {
		return true;
	}
	return compareWordPressVersions(wordpressVersion, constraints.max) <= 0;
}

/**
 * Compares concrete WordPress releases using their parsed precedence components.
 *
 * Returns a negative number when `left` is older, a positive number when it is
 * newer, and zero when both releases have equal precedence.
 */
function compareWordPressVersions(left: string, right: string): number {
	const leftVersion = parseComparableWordPressVersion(left);
	const rightVersion = parseComparableWordPressVersion(right);
	if (!leftVersion || !rightVersion) {
		throw new Error(
			`Cannot compare WordPress versions "${left}" and "${right}".`
		);
	}
	for (let i = 0; i < leftVersion.parts.length; i++) {
		const difference = leftVersion.parts[i] - rightVersion.parts[i];
		if (difference !== 0) {
			return difference;
		}
	}
	return 0;
}

/**
 * Indicates whether a WordPress version is a concrete, orderable release.
 */
function isComparableWordPressVersion(wordpressVersion: string): boolean {
	return parseComparableWordPressVersion(wordpressVersion) !== null;
}

/**
 * Parses a comparable WordPress release into components ordered by precedence.
 *
 * Missing patch numbers become zero, and suffix ranks preserve the WordPress
 * release order: beta before RC before the stable release. Runtime labels and
 * custom URLs are not comparable and return `null`. `patchSpecified` remains
 * separate so a max bound such as `6.8` can include every `6.8.x` patch.
 */
function parseComparableWordPressVersion(
	wordpressVersion: string
): ComparableWordPressVersion | null {
	const match = wordpressVersion.match(
		/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(beta|rc)(\d+))?$/i
	);
	if (!match) {
		return null;
	}
	const [, major, minor, patch, suffix, suffixVersion = '0'] = match;
	const normalizedSuffix = suffix?.toLowerCase() as 'beta' | 'rc' | undefined;
	const suffixRank = normalizedSuffix
		? normalizedSuffix === 'beta'
			? 0
			: 1
		: 2;
	return {
		parts: [
			Number(major),
			Number(minor),
			Number(patch ?? '0'),
			suffixRank,
			Number(suffixVersion),
		],
		patchSpecified: patch !== undefined,
		suffix: normalizedSuffix,
	};
}

/**
 * Indicates whether a runtime source uses a supported HTTP(S) URL prefix.
 */
function isHttpUrl(reference: string) {
	return reference.startsWith('http://') || reference.startsWith('https://');
}

/**
 * Indicates whether a source uses an absolute or explicit relative file path.
 */
function isExecutionContextPath(reference: string) {
	return (
		reference.startsWith('/') ||
		reference.startsWith('./') ||
		reference.startsWith('../')
	);
}
