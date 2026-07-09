import {
	AllPHPVersions,
	LatestSupportedPHPVersion,
	type AllPHPVersion,
} from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { BlueprintReflection } from './reflection';
import type {
	Blueprint,
	BlueprintDeclaration,
	RuntimeConfiguration,
} from './types';
import { compileBlueprintV1 } from './v1/compile';
import type { BlueprintV1 } from './v1/types';
import type { BlueprintV2Declaration } from './v2/blueprint-v2-declaration';

const V2_WORDPRESS_VERSION_LABELS = ['latest', 'beta', 'trunk', 'nightly'];
const V2_WORDPRESS_VERSION_PATTERN =
	/^\d+\.\d+(?:\.\d+)?(?:-(?:beta|rc)\d+)?$/i;
const V2_PHP_CONSTRAINT_CANDIDATES = AllPHPVersions.filter(
	(phpVersion) => phpVersion !== 'next'
) as AllPHPVersion[];

type V2WordPressVersionConstraintObject = {
	min: unknown;
	max?: unknown;
	preferred?: unknown;
};
type V2WordPressVersionConstraint = {
	min: string;
	max?: string;
	preferred?: string;
};

export async function resolveRuntimeConfiguration(
	blueprint: Blueprint
): Promise<RuntimeConfiguration> {
	const reflection = await BlueprintReflection.create(blueprint);
	if (reflection.getVersion() === 1) {
		const compiledBlueprint = await compileBlueprintV1(
			blueprint as BlueprintV1
		);

		return {
			wpVersion: compiledBlueprint.versions.wp,
			phpVersion: compiledBlueprint.versions.php,
			intl: compiledBlueprint.features.intl,
			networking: compiledBlueprint.features.networking,
			extraLibraries: compiledBlueprint.extraLibraries,
			/*
			 * Constants don't matter so much for temporary sites so let's
			 * use an empty object here. We can't easily figure out which
			 * additional constants were applied via playground.defineConstant()
			 * at this stage anyway.
			 *
			 * This property is only relevant for stored sites to ensure they're
			 * consistently applied across page reloads.
			 */
			constants: {},
		};
	} else {
		const declaration = reflection.getDeclaration();
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
}

function isBlueprintV2Declaration(
	declaration: BlueprintDeclaration
): declaration is BlueprintV2Declaration {
	return (declaration as { version?: unknown }).version === 2;
}

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

function normalizeV2PHPConstraintVersion(
	phpVersion: string | undefined
): string | undefined {
	if (phpVersion === 'latest') {
		return LatestSupportedPHPVersion;
	}
	return phpVersion;
}

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

function parsePHPVersion(phpVersion: string): [number, number, number] {
	const [major = 0, minor = 0, patch = 0] = phpVersion
		.split('.')
		.map((part) => Number(part));
	return [major, minor, patch];
}

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

function isV2WordPressVersionConstraint(
	wordpressVersion: unknown
): wordpressVersion is V2WordPressVersionConstraintObject {
	if (!wordpressVersion || typeof wordpressVersion !== 'object') {
		return false;
	}
	return 'min' in wordpressVersion;
}

function resolveV2WordPressConstraintVersion(
	wordpressVersion: V2WordPressVersionConstraintObject
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

function assertV2WordPressVersionConstraint(
	wordpressVersion: V2WordPressVersionConstraintObject
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

function isComparableWordPressVersion(wordpressVersion: string): boolean {
	return parseComparableWordPressVersion(wordpressVersion) !== null;
}

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

function isHttpUrl(reference: string) {
	return reference.startsWith('http://') || reference.startsWith('https://');
}

function isExecutionContextPath(reference: string) {
	return (
		reference.startsWith('/') ||
		reference.startsWith('./') ||
		reference.startsWith('../')
	);
}
