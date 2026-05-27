import type { AllPHPVersion } from '@php-wasm/universal';
import { SupportedPHPVersionsList } from '@wp-playground/client';

const PHP_8_6_VERSION = '8.6';
const PHP_MASTER_VERSION = 'master';

export const PHPPlaygroundVersions = [
	PHP_8_6_VERSION,
	...SupportedPHPVersionsList,
];

export function getPHPPlaygroundVersion(version: string | undefined) {
	if (version === PHP_MASTER_VERSION) {
		return PHP_8_6_VERSION;
	}
	return version;
}

export function getPHPRuntimeVersion(version: string): AllPHPVersion {
	return (
		version === PHP_8_6_VERSION ? PHP_MASTER_VERSION : version
	) as AllPHPVersion;
}

export function getPHPVersionLabel(version: string) {
	if (version === PHP_8_6_VERSION) {
		return '8.6 (development)';
	}
	return version;
}
