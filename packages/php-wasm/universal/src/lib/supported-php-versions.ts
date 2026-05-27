export const PhpMasterVersion = 'master';
export type PhpMasterVersion = typeof PhpMasterVersion;

export const SupportedPHPVersions = [
	'8.5',
	'8.4',
	'8.3',
	'8.2',
	'8.1',
	'8.0',
	'7.4',
] as const;
export const LatestSupportedPHPVersion = SupportedPHPVersions[0];
export const SupportedPHPVersionsList = SupportedPHPVersions as any as string[];
export type SupportedPHPVersion = (typeof SupportedPHPVersions)[number];

export const LegacyPHPVersions = ['5.2'] as const;
export type LegacyPHPVersion = (typeof LegacyPHPVersions)[number];

/**
 * Type guard for the PHP master build pseudo-version.
 */
export function isPhpMasterVersion(
	version: string | undefined
): version is PhpMasterVersion {
	return version === PhpMasterVersion;
}

/**
 * Type guard for legacy PHP versions. Lets callers narrow a string
 * to `LegacyPHPVersion` without the `as readonly string[]` cast that
 * would otherwise be required to satisfy `Array.prototype.includes`.
 */
export function isLegacyPHPVersion(
	version: string | undefined
): version is LegacyPHPVersion {
	return (LegacyPHPVersions as readonly string[]).includes(version ?? '');
}

export const AllPHPVersions = [
	PhpMasterVersion,
	...SupportedPHPVersions,
	...LegacyPHPVersions,
] as const;
export type AllPHPVersion =
	| PhpMasterVersion
	| SupportedPHPVersion
	| LegacyPHPVersion;
