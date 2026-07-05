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
const V2_PHP_VERSION_CONSTRAINT_PATTERN = /^\d+\.\d+(?:\.\d+)?$/;
const V2_PHP_CONSTRAINT_CANDIDATES = AllPHPVersions.filter(
	(phpVersion) => phpVersion !== 'next'
) as AllPHPVersion[];

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
			networking: playgroundOptions?.networkAccess ?? true,
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
		const resolvedRecommended =
			resolveV2PHPVersionString(recommendedVersion);
		if (isV2PHPVersionWithinConstraints(resolvedRecommended, phpVersion)) {
			return resolvedRecommended;
		}
		throw new Error(
			`Recommended Blueprint v2 PHP version "${recommendedVersion}" ` +
				`does not satisfy constraints ${JSON.stringify(phpVersion)}.`
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
	if (typeof phpVersion.recommended === 'string') {
		return phpVersion.recommended;
	}
	throw new Error(
		`Unsupported Blueprint v2 PHP version constraint "recommended": ` +
			`${JSON.stringify(phpVersion.recommended)}. ` +
			`Use latest or a version like 8.3.`
	);
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
	const minVersion = normalizeV2PHPConstraintVersion(constraints?.min, 'min');
	if (minVersion && comparePHPVersions(phpVersion, minVersion) < 0) {
		return false;
	}
	const maxVersion = normalizeV2PHPConstraintVersion(constraints?.max, 'max');
	if (maxVersion && comparePHPVersions(phpVersion, maxVersion) > 0) {
		return false;
	}
	return true;
}

function normalizeV2PHPConstraintVersion(
	phpVersion: unknown,
	fieldName: 'min' | 'max'
): string | undefined {
	if (phpVersion === undefined) {
		return undefined;
	}
	if (phpVersion === 'latest') {
		return LatestSupportedPHPVersion;
	}
	if (
		typeof phpVersion !== 'string' ||
		!V2_PHP_VERSION_CONSTRAINT_PATTERN.test(phpVersion)
	) {
		throw new Error(
			`Unsupported Blueprint v2 PHP version constraint "${fieldName}": ` +
				`${JSON.stringify(phpVersion)}. Use latest or a version like 8.3.`
		);
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

	if (wordpressVersion && typeof wordpressVersion === 'object') {
		if ('min' in wordpressVersion) {
			assertV2WordPressConstraintVersion(wordpressVersion.min, 'min');
			if ('max' in wordpressVersion) {
				assertV2WordPressConstraintVersion(wordpressVersion.max, 'max');
				if (
					compareWordPressVersions(
						wordpressVersion.max,
						wordpressVersion.min
					) < 0
				) {
					throw new Error(
						`Unsatisfiable Blueprint v2 WordPress version constraints ` +
							`${JSON.stringify(wordpressVersion)}.`
					);
				}
			}
			const preferredVersion =
				getV2WordPressConstraintPreferredVersion(wordpressVersion);
			if (preferredVersion) {
				const resolvedPreferred = resolveV2WordPressPreferredVersion(
					preferredVersion,
					wordpressVersion
				);
				if (
					!isV2WordPressPreferredVersionWithinConstraints(
						resolvedPreferred,
						wordpressVersion
					)
				) {
					throw new Error(
						`Preferred Blueprint v2 WordPress version "${preferredVersion}" ` +
							`does not satisfy constraints ${JSON.stringify(wordpressVersion)}.`
					);
				}
				return resolvedPreferred;
			}
			return resolveLatestV2WordPressVersionMatchingConstraints(
				wordpressVersion
			);
		}
		throw new Error(
			'Unsupported Blueprint v2 WordPress version data reference. ' +
				'Use a version string or a constraint object with min/preferred fields.'
		);
	}

	return 'latest';
}

function resolveV2WordPressVersionString(wordpressVersion: string): string {
	if (
		V2_WORDPRESS_VERSION_LABELS.includes(wordpressVersion) ||
		V2_WORDPRESS_VERSION_PATTERN.test(wordpressVersion)
	) {
		return wordpressVersion;
	}

	throw new Error(
		`Unsupported Blueprint v2 WordPress version "${wordpressVersion}". ` +
			'Use latest, beta, trunk, nightly, or a version like 6.8, 6.8.1, or 6.8-rc1.'
	);
}

function resolveV2WordPressPreferredVersion(
	wordpressVersion: string,
	constraints: { min: string; max?: unknown }
): string {
	if (wordpressVersion === 'latest') {
		return resolveLatestV2WordPressVersionMatchingConstraints(constraints);
	}
	if (V2_WORDPRESS_VERSION_PATTERN.test(wordpressVersion)) {
		return wordpressVersion;
	}

	throw new Error(
		`Unsupported Blueprint v2 WordPress version constraint "preferred": ` +
			`${JSON.stringify(wordpressVersion)}. ` +
			'Use latest or a version like 6.8, 6.8.1, or 6.8-rc1.'
	);
}

function resolveLatestV2WordPressVersionMatchingConstraints(constraints: {
	min: string;
	max?: unknown;
}): string {
	if ('max' in constraints) {
		assertV2WordPressConstraintVersion(constraints.max, 'max');
		return constraints.max;
	}
	return 'latest';
}

function getV2WordPressConstraintPreferredVersion(
	wordpressVersion: BlueprintV2Declaration['wordpressVersion']
): string | undefined {
	if (!wordpressVersion || typeof wordpressVersion !== 'object') {
		return undefined;
	}
	if (!('min' in wordpressVersion)) {
		return undefined;
	}
	if (!('preferred' in wordpressVersion)) {
		return undefined;
	}
	if (typeof wordpressVersion.preferred === 'string') {
		return wordpressVersion.preferred;
	}
	throw new Error(
		`Unsupported Blueprint v2 WordPress version constraint "preferred": ` +
			`${JSON.stringify(wordpressVersion.preferred)}. ` +
			'Use latest or a version like 6.8, 6.8.1, or 6.8-rc1.'
	);
}

function assertV2WordPressConstraintVersion(
	wordpressVersion: unknown,
	fieldName: 'min' | 'max'
): asserts wordpressVersion is string {
	if (
		typeof wordpressVersion !== 'string' ||
		!V2_WORDPRESS_VERSION_PATTERN.test(wordpressVersion)
	) {
		throw new Error(
			`Unsupported Blueprint v2 WordPress version constraint "${fieldName}": ` +
				`${JSON.stringify(wordpressVersion)}. ` +
				'Use a version like 6.8, 6.8.1, or 6.8-rc1.'
		);
	}
}

function isV2WordPressPreferredVersionWithinConstraints(
	wordpressVersion: string,
	constraints: { min: string; max?: unknown }
): boolean {
	if (wordpressVersion === 'latest') {
		return true;
	}
	const minVersion = constraints?.min;
	assertV2WordPressConstraintVersion(minVersion, 'min');
	if (compareWordPressVersions(wordpressVersion, minVersion) < 0) {
		return false;
	}
	if ('max' in constraints) {
		const maxVersion = constraints.max;
		assertV2WordPressConstraintVersion(maxVersion, 'max');
		if (compareWordPressVersions(wordpressVersion, maxVersion) > 0) {
			return false;
		}
	}
	return true;
}

function compareWordPressVersions(left: string, right: string): number {
	const leftParts = parseWordPressVersion(left);
	const rightParts = parseWordPressVersion(right);
	for (let i = 0; i < 3; i++) {
		const difference = leftParts.version[i] - rightParts.version[i];
		if (difference !== 0) {
			return difference;
		}
	}
	if (leftParts.suffixRank !== rightParts.suffixRank) {
		return leftParts.suffixRank - rightParts.suffixRank;
	}
	return leftParts.suffixNumber - rightParts.suffixNumber;
}

function parseWordPressVersion(wordpressVersion: string) {
	const match = wordpressVersion.match(
		/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(beta|rc)(\d+))?$/i
	);
	if (!match) {
		throw new Error(`Unsupported WordPress version: ${wordpressVersion}`);
	}
	const [, major, minor, patch = '0', suffix, suffixNumber = '0'] = match;
	const suffixRank =
		suffix?.toLowerCase() === 'beta'
			? 0
			: suffix?.toLowerCase() === 'rc'
				? 1
				: 2;
	return {
		version: [Number(major), Number(minor), Number(patch)] as const,
		suffixRank,
		suffixNumber: Number(suffixNumber),
	};
}
