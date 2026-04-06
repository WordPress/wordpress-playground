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

export const LegacyPHPVersions = ['5.6'] as const;
export type LegacyPHPVersion = (typeof LegacyPHPVersions)[number];

export const AllPHPVersions = [
	...SupportedPHPVersions,
	...LegacyPHPVersions,
] as const;
export type AllPHPVersion = SupportedPHPVersion | LegacyPHPVersion;
