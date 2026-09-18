import { describe, expect, it } from 'vitest';

import {
	createManifest,
	findExtensionArtifact,
	type ExtensionManifest,
} from './manifest';

describe('findExtensionArtifact', () => {
	it('selects the PHP version match', () => {
		const manifest: ExtensionManifest = {
			name: 'example',
			version: '0.1.0',
			artifacts: [
				{
					phpVersion: '8.4',
					sourcePath: 'example-php8.4-jspi.so',
				},
			],
		};

		expect(findExtensionArtifact(manifest, '8.4')?.sourcePath).toBe(
			'example-php8.4-jspi.so'
		);
		expect(findExtensionArtifact(manifest, '8.3')).toBe(undefined);
	});
});

describe('createManifest', () => {
	it('emits sourcePath entries that match the @php-wasm/universal loader', async () => {
		const manifest = await createManifest({
			name: 'example',
			version: '0.1.0',
			artifacts: [
				{
					phpVersion: '8.4',
					sourcePath: 'example-php8.4-jspi.so',
					path: '/tmp/dist/example-php8.4-jspi.so',
				},
			],
		});

		expect(manifest).toEqual({
			name: 'example',
			version: '0.1.0',
			artifacts: [
				{
					phpVersion: '8.4',
					sourcePath: 'example-php8.4-jspi.so',
				},
			],
		});
	});

	it('threads extraFiles through to the manifest output', async () => {
		const manifest = await createManifest({
			name: 'example',
			version: '0.1.0',
			artifacts: [
				{
					phpVersion: '8.4',
					sourcePath: 'example-php8.4-jspi.so',
					path: '/tmp/dist/example-php8.4-jspi.so',
				},
			],
			extraFiles: {
				vfsRoot: '/internal/shared/example',
				nodes: [
					{ vfsPath: 'data', type: 'directory' },
					{ vfsPath: 'ui/index.html', sourcePath: 'ui/index.html' },
				],
			},
		});

		expect(manifest.extraFiles).toEqual({
			vfsRoot: '/internal/shared/example',
			nodes: [
				{ vfsPath: 'data', type: 'directory' },
				{ vfsPath: 'ui/index.html', sourcePath: 'ui/index.html' },
			],
		});
	});
});
