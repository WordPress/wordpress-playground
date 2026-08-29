import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const assembler = resolve(scriptDirectory, '../assemble-macos-prerelease.mjs');
const sourceCommit = '1'.repeat(40);
const version = '3.1.45';

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

async function writeTarget(inputDir, name, triple, commit = sourceCommit) {
	const binary = Buffer.from(`synthetic-${name}-native-host`);
	const compressed = gzipSync(binary);
	const hostFileName = `wp-playground-native-${name}.gz`;
	await writeFile(join(inputDir, hostFileName), compressed);
	await writeFile(
		join(inputDir, `native-host-manifest-${name}.json`),
		`${JSON.stringify(
			{
				schemaVersion: 1,
				protocolVersion: 1,
				hostVersion: version,
				targets: {
					[name]: {
						path: `hosts/${hostFileName}`,
						compressedSize: compressed.length,
						compressedSha256: sha256(compressed),
						size: binary.length,
						sha256: sha256(binary),
					},
				},
			},
			null,
			'\t'
		)}\n`
	);
	await writeFile(
		join(inputDir, `runtime-package-manifest-${name}.json`),
		`${JSON.stringify(
			{
				schemaVersion: 1,
				packageName: 'runtime-assets',
				version,
				targetTriple: triple,
				sourceCommit: commit,
				rustcVersion: 'rustc synthetic',
				binary: {
					path: 'bin/wp-playground-native',
					kind: 'binary',
					sizeBytes: binary.length,
					sha256: sha256(binary),
				},
				files: [],
			},
			null,
			'\t'
		)}\n`
	);
}

async function runAssembler(root) {
	const inputDir = join(root, 'input');
	const packageDir = join(root, 'package');
	const outputDir = join(root, 'output');
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(
			process.execPath,
			[
				assembler,
				'--input-dir',
				inputDir,
				'--package-dir',
				packageDir,
				'--output-dir',
				outputDir,
				'--source-commit',
				sourceCommit,
			],
			{
				env: process.env,
				stdio: ['ignore', 'pipe', 'pipe'],
			}
		);
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('close', (code, signal) =>
			resolvePromise({ code, signal, stdout, stderr, outputDir })
		);
	});
}

async function createFixture({ arm64Commit = sourceCommit } = {}) {
	const root = await mkdtemp(join(tmpdir(), 'cli-native-prerelease-test-'));
	const inputDir = join(root, 'input');
	const packageDir = join(root, 'package');
	await Promise.all([
		mkdir(inputDir, { recursive: true }),
		mkdir(packageDir, { recursive: true }),
	]);
	await Promise.all([
		writeTarget(inputDir, 'darwin-x64', 'x86_64-apple-darwin'),
		writeTarget(
			inputDir,
			'darwin-arm64',
			'aarch64-apple-darwin',
			arm64Commit
		),
		writeFile(
			join(packageDir, 'package.json'),
			`${JSON.stringify({
				name: '@wp-playground/cli-native',
				version,
				private: true,
				files: ['index.js', 'native-host-manifest.json'],
			})}\n`
		),
		writeFile(
			join(packageDir, 'index.js'),
			'export const synthetic = true;\n'
		),
	]);
	return root;
}

test('assembles two verified macOS hosts into one private shell', async () => {
	assert.ok(process.env.npm_execpath, 'test must run through npm exec');
	const root = await createFixture();
	try {
		const result = await runAssembler(root);
		assert.equal(result.signal, null);
		assert.equal(result.code, 0, result.stderr);
		const manifest = JSON.parse(
			await readFile(
				join(result.outputDir, 'native-host-manifest.json'),
				'utf8'
			)
		);
		assert.deepEqual(Object.keys(manifest.targets).sort(), [
			'darwin-arm64',
			'darwin-x64',
		]);
		assert.equal(
			manifest.targets['darwin-x64'].path,
			'wp-playground-native-darwin-x64.gz'
		);
		assert.equal(
			manifest.targets['darwin-arm64'].path,
			'wp-playground-native-darwin-arm64.gz'
		);
		const provenance = JSON.parse(
			await readFile(
				join(result.outputDir, 'prerelease-provenance.json'),
				'utf8'
			)
		);
		assert.equal(provenance.sourceCommit, sourceCommit);
		assert.equal(
			await sha256(
				await readFile(join(result.outputDir, provenance.packageFile))
			),
			provenance.packageSha256
		);
		assert.match(
			await readFile(join(result.outputDir, 'SHA256SUMS'), 'utf8'),
			/wp-playground-cli-native-3\.1\.45\.tgz/
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('rejects a runtime package built from a different source commit', async () => {
	const root = await createFixture({ arm64Commit: '2'.repeat(40) });
	try {
		const result = await runAssembler(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /runtime package provenance/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
