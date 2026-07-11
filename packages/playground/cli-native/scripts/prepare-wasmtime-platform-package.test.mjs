import assert from 'node:assert/strict';
import {
	access,
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { prepareWasmtimePlatformPackage } from './prepare-wasmtime-platform-package.mjs';
import {
	getNpmInvocation,
	packageWasmtimePlatformForSelfHosting,
} from './package-wasmtime-platform-for-self-hosting.mjs';

test('prepares an npm package from a Wasmtime package directory', async () => {
	const root = await mkdtemp(
		join(tmpdir(), 'playground-wasmtime-npm-package-')
	);
	const source = join(root, 'wasmtime-package');
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

		await prepareWasmtimePlatformPackage({
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
				name: '@wp-playground/cli-wasmtime-linux-x64',
				version: '9.8.7',
				description:
					'Wasmtime host for @wp-playground/cli on Linux x64',
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

test('creates the archive name expected by the self-hosted package repository', async () => {
	const root = await mkdtemp(
		join(tmpdir(), 'playground-wasmtime-self-hosted-package-')
	);
	const source = join(root, 'wasmtime-package');
	const destination = join(root, 'npm-package');
	const archives = join(root, 'archives');
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

		const archive = await packageWasmtimePlatformForSelfHosting({
			label: 'linux-x64',
			sourceDirectory: source,
			destinationDirectory: destination,
			archiveDirectory: archives,
			version: '9.8.7',
		});

		assert.equal(
			archive,
			join(archives, '@wp-playground-cli-wasmtime-linux-x64-9.8.7.tar.gz')
		);
		assert.ok((await stat(archive)).size > 0);
		await access(join(destination, 'bin', 'wp-playground-native'));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('runs the bundled npm CLI through Node.js on Windows', () => {
	assert.deepEqual(
		getNpmInvocation({
			platform: 'win32',
			nodeExecutable: String.raw`C:\hostedtoolcache\node\node.exe`,
		}),
		{
			executable: String.raw`C:\hostedtoolcache\node\node.exe`,
			argumentPrefix: [
				String.raw`C:\hostedtoolcache\node\node_modules\npm\bin\npm-cli.js`,
			],
		}
	);
});
