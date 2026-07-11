import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	nativeBinaryEnvironmentVariable,
	nativeBinaryPackageName,
	nativeBinaryTarget,
	resolveNativeBinary,
	runNativeCLI,
} from '../src/native-binary';

describe('native binary launcher', () => {
	test.each([
		['linux', 'x64', 'linux-x64'],
		['linux', 'arm64', 'linux-arm64'],
		['darwin', 'x64', 'macos-x64'],
		['darwin', 'arm64', 'macos-arm64'],
		['win32', 'x64', 'windows-x64'],
		['win32', 'arm64', 'windows-arm64'],
	] as const)(
		'maps %s-%s to the native package label %s',
		async (platform, arch, expected) => {
			expect(nativeBinaryTarget(platform, arch)).toBe(expected);
			const template = JSON.parse(
				await readFile(
					join(
						import.meta.dirname,
						'..',
						'..',
						'cli-native',
						'npm-packages',
						expected,
						'package.json'
					),
					'utf8'
				)
			);
			expect(template.name).toBe(nativeBinaryPackageName(platform, arch));
			expect(template.os).toEqual([platform]);
			expect(template.cpu).toEqual([arch]);
		}
	);

	test('prefers an explicitly configured native executable', async () => {
		const root = await mkdtemp(join(tmpdir(), 'playground-native-binary-'));
		const binary = join(root, 'wp-playground-native');
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);

		expect(
			resolveNativeBinary({
				environment: {
					[nativeBinaryEnvironmentVariable]: binary,
				},
			})
		).toBe(binary);

		await rm(root, { recursive: true, force: true });
	});

	test('finds a native binary bundled beside the package', async () => {
		const root = await mkdtemp(join(tmpdir(), 'playground-native-binary-'));
		const nativeDirectory = join(root, 'native', 'linux-x64');
		const binary = join(nativeDirectory, 'wp-playground-native');
		await mkdir(nativeDirectory, { recursive: true });
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);

		expect(
			resolveNativeBinary({
				environment: {},
				moduleDirectory: root,
				platform: 'linux',
				arch: 'x64',
			})
		).toBe(binary);

		await rm(root, { recursive: true, force: true });
	});

	test('finds the installed platform-native package', async () => {
		const root = await mkdtemp(join(tmpdir(), 'playground-native-binary-'));
		const packageDirectory = join(
			root,
			'node_modules',
			'@wp-playground',
			'cli-native-linux-x64'
		);
		const binary = join(packageDirectory, 'bin', 'wp-playground-native');
		await mkdir(join(packageDirectory, 'bin'), { recursive: true });
		await writeFile(
			join(packageDirectory, 'package.json'),
			JSON.stringify({
				name: nativeBinaryPackageName('linux', 'x64'),
				exports: { './package.json': './package.json' },
			})
		);
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);

		expect(
			resolveNativeBinary({
				environment: {},
				moduleDirectory: root,
				platform: 'linux',
				arch: 'x64',
			})
		).toBe(binary);

		await rm(root, { recursive: true, force: true });
	});

	test('runs the configured Wasmtime host without a shell', async () => {
		if (process.platform === 'win32') {
			return;
		}

		const root = await mkdtemp(join(tmpdir(), 'playground-native-binary-'));
		const binary = join(root, 'wp-playground-native');
		const output = join(root, 'arguments.json');
		await writeFile(
			binary,
			`#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
writeFileSync(process.env.PLAYGROUND_NATIVE_TEST_OUTPUT, JSON.stringify(process.argv.slice(2)));
process.exit(7);
`
		);
		await chmod(binary, 0o755);

		const env = {
			...process.env,
			[nativeBinaryEnvironmentVariable]: binary,
			PLAYGROUND_NATIVE_TEST_OUTPUT: output,
		};
		const result = await runNativeCLI(['server', '--port=9400'], {
			env,
			stdio: 'ignore',
		});

		expect(result).toEqual({ code: 7, signal: null });
		expect(JSON.parse(await readFile(output, 'utf8'))).toEqual([
			'server',
			'--port=9400',
		]);

		await rm(root, { recursive: true, force: true });
	});

	test('explains how to configure a missing native host', async () => {
		expect(() =>
			resolveNativeBinary({
				environment: {},
				moduleDirectory: join(
					tmpdir(),
					'missing-playground-cli-package'
				),
				platform: 'linux',
				arch: 'x64',
			})
		).toThrow(nativeBinaryEnvironmentVariable);
	});
});
