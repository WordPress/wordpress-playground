import { describe, expect, it } from 'vitest';

import { findExtensionArtifact, type ExtensionManifest } from './manifest';

describe('findExtensionArtifact', () => {
	it('selects the PHP version match', () => {
		const manifest: ExtensionManifest = {
			name: 'example',
			version: '0.1.0',
			artifacts: [
				{
					phpVersion: '8.4',
					file: 'example-php8.4-jspi.so',
					sha256: 'abc',
				},
			],
		};

		expect(findExtensionArtifact(manifest, '8.4')?.file).toBe(
			'example-php8.4-jspi.so'
		);
		expect(findExtensionArtifact(manifest, '8.3')).toBe(undefined);
	});
});
