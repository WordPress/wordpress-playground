import type { SupportedPHPVersion } from '@php-wasm/universal';

interface PHPVersion {
	version: SupportedPHPVersion;
	directory: string;
}

export const phpVersions: PHPVersion[] = [
	{
		version: '8.4',
		directory: '8_4_0',
	},
	{
		version: '8.3',
		directory: '8_3_0',
	},
	{
		version: '8.2',
		directory: '8_2_10',
	},
	{
		version: '8.1',
		directory: '8_1_23',
	},
	{
		version: '8.0',
		directory: '8_0_30',
	},
	{
		version: '7.4',
		directory: '7_4_33',
	},
	{
		version: '7.3',
		directory: '7_3_33',
	},
	{
		version: '7.2',
		directory: '7_2_34',
	},
];

export function fullyQualifiedPHPVersionDirectory(
	requestedVersion: SupportedPHPVersion
): string {
	const version = (phpVersions as PHPVersion[]).find(
		(v) => v.version === requestedVersion
	);
	if (!version) return '';

	return version.directory;
}
