import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { phpVersions } from '../../supported-php-versions.mjs';
import { resolvePHPRelease, SupportedExtensionPHPVersions } from './compile';

describe('resolvePHPRelease', () => {
	it('uses the canonical release for every supported extension PHP minor version', () => {
		const canonicalReleases = new Map(
			phpVersions.map(({ version, lastRelease }) => [
				version,
				lastRelease,
			])
		);

		for (const phpVersion of SupportedExtensionPHPVersions) {
			expect(resolvePHPRelease(phpVersion)).toBe(
				canonicalReleases.get(phpVersion)
			);
		}
	});
});
