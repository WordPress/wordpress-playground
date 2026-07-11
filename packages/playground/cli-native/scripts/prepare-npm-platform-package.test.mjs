import assert from 'node:assert/strict';
import {
	access,
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { prepareNpmPlatformPackage } from './prepare-npm-platform-package.mjs';

test('prepares an npm package from a native package directory', async () => {
	const root = await mkdtemp(
		join(tmpdir(), 'playground-native-npm-package-')
	);
	const source = join(root, 'native-package');
	const destination = join(root, 'npm-package');
	const binary = join(source, 'bin', 'wp-playground-native');
	const manifest = join(
		source,
		'share',
		'wp-playground-native',
		'packages',
		'playground',
		'cli-native',
		'assets',
		'php-assets.json'
	);

	try {
		await mkdir(join(source, 'bin'), { recursive: true });
		await mkdir(dirname(manifest), { recursive: true });
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);
		await writeFile(manifest, '{}');
		await writeFile(join(source, 'package-manifest.json'), '{}');

		await prepareNpmPlatformPackage({
			label: 'linux-x64',
			sourceDirectory: source,
			destinationDirectory: destination,
			version: '9.8.7',
		});

		assert.deepEqual(
			JSON.parse(
				await readFile(join(destination, 'package.json'), 'utf8')
			),
			{
				name: '@wp-playground/cli-native-linux-x64',
				version: '9.8.7',
				description:
					'Wasmtime native host for @wp-playground/cli on Linux x64',
				repository: {
					type: 'git',
					url: 'https://github.com/WordPress/wordpress-playground',
				},
				homepage: 'https://developer.wordpress.org/playground',
				license: 'GPL-2.0-or-later',
				os: ['linux'],
				cpu: ['x64'],
				files: ['bin', 'share', 'package-manifest.json'],
				exports: { './package.json': './package.json' },
				publishConfig: { access: 'public' },
				engines: { node: '>=20.10.0', npm: '>=10.2.3' },
			}
		);
		await access(join(destination, 'bin', 'wp-playground-native'));
		await access(
			join(
				destination,
				'share',
				'wp-playground-native',
				'packages',
				'playground',
				'cli-native',
				'assets',
				'php-assets.json'
			)
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
