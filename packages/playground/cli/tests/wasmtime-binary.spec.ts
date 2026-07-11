import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
	wasmtimeBinaryEnvironmentVariable,
	wasmtimeBinaryPackageName,
	wasmtimeBinaryTarget,
	resolveWasmtimeBinary,
	runWasmtimeCLI,
} from '../src/wasmtime-binary';

describe('Wasmtime binary launcher', () => {
	test.each([
		['linux', 'x64', 'linux-x64'],
		['linux', 'arm64', 'linux-arm64'],
		['darwin', 'x64', 'macos-x64'],
		['darwin', 'arm64', 'macos-arm64'],
		['win32', 'x64', 'windows-x64'],
		['win32', 'arm64', 'windows-arm64'],
	] as const)(
		'maps %s-%s to the Wasmtime package label %s',
		async (platform, arch, expected) => {
			expect(wasmtimeBinaryTarget(platform, arch)).toBe(expected);
			const template = JSON.parse(
				await readFile(
					join(
						import.meta.dirname,
						'..',
						'..',
						'cli-native',
						'wasmtime-npm-packages',
						expected,
						'package.json'
					),
					'utf8'
				)
			);
			expect(template.name).toBe(
				wasmtimeBinaryPackageName(platform, arch)
			);
			expect(template.os).toEqual([platform]);
			expect(template.cpu).toEqual([arch]);
		}
	);

	test('prefers an explicitly configured Wasmtime executable', async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'playground-wasmtime-binary-')
		);
		const binary = join(root, 'wp-playground-native');
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);

		expect(
			resolveWasmtimeBinary({
				environment: {
					[wasmtimeBinaryEnvironmentVariable]: binary,
				},
			})
		).toBe(binary);

		await rm(root, { recursive: true, force: true });
	});

	test('finds a Wasmtime binary bundled beside the package', async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'playground-wasmtime-binary-')
		);
		const wasmtimeDirectory = join(root, 'wasmtime', 'linux-x64');
		const binary = join(wasmtimeDirectory, 'wp-playground-native');
		await mkdir(wasmtimeDirectory, { recursive: true });
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);

		expect(
			resolveWasmtimeBinary({
				environment: {},
				moduleDirectory: root,
				platform: 'linux',
				arch: 'x64',
			})
		).toBe(binary);

		await rm(root, { recursive: true, force: true });
	});

	test('finds the installed platform-Wasmtime package', async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'playground-wasmtime-binary-')
		);
		const packageDirectory = join(
			root,
			'node_modules',
			'@wp-playground',
			'cli-wasmtime-linux-x64'
		);
		const binary = join(packageDirectory, 'bin', 'wp-playground-native');
		await mkdir(join(packageDirectory, 'bin'), { recursive: true });
		await writeFile(
			join(packageDirectory, 'package.json'),
			JSON.stringify({
				name: wasmtimeBinaryPackageName('linux', 'x64'),
				exports: { './package.json': './package.json' },
			})
		);
		await writeFile(binary, '#!/bin/sh\nexit 0\n');
		await chmod(binary, 0o755);

		expect(
			resolveWasmtimeBinary({
				environment: {},
				moduleDirectory: root,
				platform: 'linux',
				arch: 'x64',
			})
		).toBe(await realpath(binary));

		await rm(root, { recursive: true, force: true });
	});

	test('prefers a source build over an installed package template', async () => {
		const root = await mkdtemp(
			join(tmpdir(), 'playground-wasmtime-binary-')
		);
		const moduleDirectory = join(
			root,
			'packages',
			'playground',
			'cli',
			'src'
		);
		const sourceBinary = join(
			root,
			'packages',
			'playground',
			'cli-native',
			'target',
			'debug',
			'wp-playground-native'
		);
		const packageDirectory = join(
			root,
			'node_modules',
			'@wp-playground',
			'cli-wasmtime-linux-x64'
		);
		await mkdir(moduleDirectory, { recursive: true });
		await mkdir(dirname(sourceBinary), { recursive: true });
		await mkdir(packageDirectory, { recursive: true });
		await writeFile(sourceBinary, '#!/bin/sh\nexit 0\n');
		await chmod(sourceBinary, 0o755);
		await writeFile(
			join(packageDirectory, 'package.json'),
			JSON.stringify({
				name: wasmtimeBinaryPackageName('linux', 'x64'),
				exports: { './package.json': './package.json' },
			})
		);

		expect(
			resolveWasmtimeBinary({
				environment: {},
				moduleDirectory,
				platform: 'linux',
				arch: 'x64',
			})
		).toBe(sourceBinary);

		await rm(root, { recursive: true, force: true });
	});

	test('runs the configured Wasmtime host without a shell', async () => {
		if (process.platform === 'win32') {
			return;
		}

		const root = await mkdtemp(
			join(tmpdir(), 'playground-wasmtime-binary-')
		);
		const binary = join(root, 'wp-playground-native');
		const output = join(root, 'arguments.json');
		await writeFile(
			binary,
			`#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
writeFileSync(process.env.PLAYGROUND_WASMTIME_TEST_OUTPUT, JSON.stringify(process.argv.slice(2)));
process.exit(7);
`
		);
		await chmod(binary, 0o755);

		const env = {
			...process.env,
			[wasmtimeBinaryEnvironmentVariable]: binary,
			PLAYGROUND_WASMTIME_TEST_OUTPUT: output,
		};
		const result = await runWasmtimeCLI(['server', '--port=9400'], {
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

	test('explains how to configure a missing Wasmtime host', async () => {
		expect(() =>
			resolveWasmtimeBinary({
				environment: {},
				moduleDirectory: join(
					tmpdir(),
					'missing-playground-cli-package'
				),
				platform: 'linux',
				arch: 'x64',
			})
		).toThrow(wasmtimeBinaryEnvironmentVariable);
	});
});
