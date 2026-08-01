import type { AllPHPVersion } from '@php-wasm/universal';
import {
	PHPNextVersion,
	SupportedPHPVersionsList,
} from '@wp-playground/client';

export const PHPPlaygroundVersions = [
	PHPNextVersion,
	...SupportedPHPVersionsList,
];

const PHPVersionLabels: Partial<Record<AllPHPVersion, string>> = {
	[PHPNextVersion]: 'Next (development)',
};

export function getPHPVersionLabel(version: string) {
	return PHPVersionLabels[version as AllPHPVersion] ?? version;
}
