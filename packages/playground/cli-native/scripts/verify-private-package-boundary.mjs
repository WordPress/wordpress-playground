#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyPortablePhpAssets } from './portable-php-assets.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const repositoryRoot = resolve(projectRoot, '../../..');

async function filesBelow(root, directory = root) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(root, path)));
		else if (entry.isFile())
			files.push(relative(root, path).replaceAll('\\', '/'));
	}
	return files;
}

function fail(message) {
	throw new Error(
		`Private cli-native package boundary violation: ${message}`
	);
}

async function main() {
	const packageJson = JSON.parse(
		await readFile(join(projectRoot, 'package.json'), 'utf8')
	);
	if (packageJson.name !== '@wp-playground/cli-native')
		fail('unexpected package name');
	if (packageJson.private !== true)
		fail('package.json must set private=true');
	const workspaceVersion = JSON.parse(
		await readFile(join(repositoryRoot, 'lerna.json'), 'utf8')
	).version;
	if (packageJson.version !== workspaceVersion) {
		fail(
			`package version ${packageJson.version} does not match lerna.json ${workspaceVersion}`
		);
	}
	if ('publishConfig' in packageJson)
		fail('package.json must not contain publishConfig');
	for (const scriptName of Object.keys(packageJson.scripts ?? {})) {
		if (scriptName.toLowerCase().includes('publish')) {
			fail(`package.json must not contain a ${scriptName} script`);
		}
	}

	const projectJson = JSON.parse(
		await readFile(join(projectRoot, 'project.json'), 'utf8')
	);
	for (const targetName of Object.keys(projectJson.targets ?? {})) {
		if (targetName.toLowerCase().includes('publish')) {
			fail(`project.json must not contain a ${targetName} target`);
		}
	}

	const releaseWorkflow = await readFile(
		join(repositoryRoot, '.github/workflows/publish-github-release.yml'),
		'utf8'
	);
	if (/cli-native|wp-playground-native/i.test(releaseWorkflow)) {
		fail('the public GitHub release workflow mentions the native CLI');
	}

	const ciWorkflow = await readFile(
		join(repositoryRoot, '.github/workflows/ci.yml'),
		'utf8'
	);
	const nativeJob = ciWorkflow.match(
		/^    test-playground-cli-native:\r?\n([\s\S]*?)(?=^    [a-zA-Z0-9_-]+:\r?\n|\s*$)/m
	)?.[0];
	if (!nativeJob) fail('could not locate the native CLI CI job');
	if (/actions\/upload-artifact/.test(nativeJob)) {
		fail('the native CLI CI job uploads an artifact');
	}

	const packageDirectoryArgument = process.argv.indexOf('--package-dir');
	if (packageDirectoryArgument !== -1) {
		const value = process.argv[packageDirectoryArgument + 1];
		if (!value) fail('--package-dir requires a value');
		const packageDirectory = resolve(value);
		const files = await filesBelow(packageDirectory);
		const forbidden = files.filter(
			(path) =>
				path.endsWith('.cwasm') ||
				path === 'wp-playground-native' ||
				path === 'wp-playground-native.exe' ||
				path.startsWith('target/') ||
				path.endsWith('/Cargo.toml') ||
				path.endsWith('/Cargo.lock')
		);
		if (forbidden.length > 0)
			fail(`built package contains ${forbidden.join(', ')}`);
		const required = [
			'package.json',
			'wp-playground.js',
			'index.js',
			'index.cjs',
			'index.d.ts',
			'native-host-manifest.json',
			'share/licenses/php-wasi/zlib.txt',
			'share/licenses/php-wasi-extended/libmemcached-awesome-BSD-3-Clause.txt',
			'share/licenses/php-wasi-extended/php-memcached-PHP-3.01.txt',
			'share/licenses/php-wasi-extended/phpredis-PHP-3.01.txt',
			'share/licenses/php-wasi-extended/xdebug-1.03.txt',
		];
		for (const path of required) {
			if (!files.includes(path)) fail(`built package is missing ${path}`);
		}
		try {
			await verifyPortablePhpAssets(
				join(packageDirectory, 'share', 'wp-playground-native'),
				{ forbidWasmtime: true }
			);
		} catch (error) {
			fail(error.message);
		}
		if (
			!files.some((path) =>
				path.endsWith('sqlite-database-integration-trunk.zip')
			)
		) {
			fail('built package is missing the SQLite integration');
		}
	}

	process.stdout.write('Private cli-native package boundary verified.\n');
}

main().catch((error) => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
