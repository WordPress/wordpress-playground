import {
	AllPHPVersions,
	LatestSupportedPHPVersion,
	type AllPHPVersion,
} from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import type { BlueprintDeclaration, RuntimeConfiguration } from '../types';
import type { BlueprintV2Declaration } from './blueprint-v2-declaration';

const V2_WORDPRESS_VERSION_LABELS = ['latest', 'beta', 'trunk', 'nightly'];
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

/**
 * Resolves the runtime settings required by a Blueprint v2 declaration.
 *
 * This module owns the v2 support boundary: unsupported declarations and
 * runtime sources are rejected here instead of falling back to v1 behavior.
 */
export function resolveBlueprintV2RuntimeConfiguration(
	declaration: BlueprintDeclaration
): RuntimeConfiguration {
	if (!isBlueprintV2Declaration(declaration)) {
		throw new Error('Expected a Blueprint v2 declaration.');
	}
	const playgroundOptions =
		declaration.applicationOptions?.['wordpress-playground'];

	return {
		phpVersion: resolveV2PHPVersion(declaration),
		wpVersion: resolveV2WordPressVersion(declaration),
		intl: false,
		networking: playgroundOptions?.networkAccess ?? false,
		constants: declaration.constants ?? {},
		extraLibraries: [],
	};
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
		return resolveV2PHPVersionString(recommendedVersion);
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
 * Missing versions default to `latest`. Unsupported data references are
 * rejected instead of silently booting a different WordPress version.
 */
function resolveV2WordPressVersion(
	declaration: BlueprintV2Declaration
): string {
	const wordpressVersion = declaration.wordpressVersion;
	if (typeof wordpressVersion === 'string') {
		return resolveV2WordPressVersionString(wordpressVersion);
	}

	if (isV2WordPressVersionConstraint(wordpressVersion)) {
		const constrainedVersion =
			resolveV2WordPressConstraintVersion(wordpressVersion);
		if (constrainedVersion) {
			return constrainedVersion;
		}

		throw new Error(
			`Unsatisfiable Blueprint v2 WordPress version constraints ` +
				`${JSON.stringify(wordpressVersion)}. ` +
				'Use a max version greater than or equal to min.'
		);
	}

	if (wordpressVersion && typeof wordpressVersion === 'object') {
		throw new Error(
			'Unsupported Blueprint v2 wordpressVersion data reference. ' +
				'Use latest, beta, trunk, nightly, a version like 6.8, ' +
				'or an http(s) WordPress ZIP URL.'
		);
	}

	return 'latest';
}

/**
 * Resolves a Blueprint v2 WordPress version string to a runtime source.
 *
 * Runtime configuration can carry named WordPress builds and HTTP(S) ZIP URLs,
 * but it cannot carry file references from the Blueprint execution context.
 */
function resolveV2WordPressVersionString(wordpressVersion: string): string {
	if (isHttpUrl(wordpressVersion)) {
		return wordpressVersion;
	}
	if (isExecutionContextPath(wordpressVersion)) {
		throw new Error(
			'Unsupported Blueprint v2 wordpressVersion file reference. ' +
				'Use an http(s) WordPress ZIP URL instead.'
		);
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
 * Selects a requestable WordPress version from a Blueprint v2 constraint.
 *
 * An explicit concrete preferred version wins when it satisfies the bounds.
 * Otherwise, an unbounded constraint maps to `latest`, while a bounded
 * constraint maps to its maximum because the runtime cannot request a latest
 * release capped at a maximum version.
 */
function resolveV2WordPressConstraintVersion(
	wordpressVersion: UnvalidatedV2WordPressVersionConstraint
): string | undefined {
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
		const resolvedPreferredVersion =
			resolveV2WordPressVersionString(preferredVersion);
		if (
			isV2WordPressVersionWithinConstraints(
				resolvedPreferredVersion,
				wordpressVersion
			)
		) {
			return resolvedPreferredVersion;
		}

		throw new Error(
			`Blueprint v2 preferred WordPress version ` +
				`"${preferredVersion}" does not satisfy constraints ` +
				`${JSON.stringify(wordpressVersion)}.`
		);
	}

	if (!wordpressVersion.max) {
		return 'latest';
	}

	const maxVersion = resolveV2WordPressVersionString(wordpressVersion.max);
	return isV2WordPressVersionWithinConstraints(maxVersion, wordpressVersion)
		? maxVersion
		: undefined;
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
	if (
		!isComparableWordPressVersion(wordpressVersion) ||
		!isComparableWordPressVersion(constraints.min)
	) {
		return false;
	}
	if (compareWordPressVersions(wordpressVersion, constraints.min) < 0) {
		return false;
	}
	if (!constraints.max) {
		return true;
	}
	return (
		isComparableWordPressVersion(constraints.max) &&
		compareWordPressVersions(wordpressVersion, constraints.max) <= 0
	);
}

/**
 * Compares concrete WordPress releases using their parsed precedence components.
 *
 * Returns a negative number when `left` is older, a positive number when it is
 * newer, and zero when both releases have equal precedence.
 */
function compareWordPressVersions(left: string, right: string): number {
	const leftParts = parseComparableWordPressVersion(left);
	const rightParts = parseComparableWordPressVersion(right);
	if (!leftParts || !rightParts) {
		throw new Error(
			`Cannot compare WordPress versions "${left}" and "${right}".`
		);
	}
	for (let i = 0; i < leftParts.length; i++) {
		const difference = leftParts[i] - rightParts[i];
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
 * custom URLs are not comparable and return `null`.
 */
function parseComparableWordPressVersion(
	wordpressVersion: string
): [number, number, number, number, number] | null {
	const match = wordpressVersion.match(
		/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(beta|rc)(\d+))?$/i
	);
	if (!match) {
		return null;
	}
	const [, major, minor, patch = '0', suffix, suffixVersion = '0'] = match;
	const suffixRank = suffix ? (suffix.toLowerCase() === 'beta' ? 0 : 1) : 2;
	return [
		Number(major),
		Number(minor),
		Number(patch),
		suffixRank,
		Number(suffixVersion),
	];
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
