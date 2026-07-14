import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	nextFixedVersion,
	publishWasmtimeNpmPackages,
	selfHostedWasmtimePackageUrl,
	sha512Integrity,
	validateDistTag,
	validateNpmPublishInspection,
	validateSelfHostedCliPackage,
	verifyPublishedWasmtimeNpmPackages,
	wasmtimeNpmPackageSpec,
	wasmtimeNpmPlatformLabels,
} from './wasmtime-npm-release.mjs';

test('computes the fixed Lerna release version', () => {
	assert.equal(nextFixedVersion('3.1.44', 'patch'), '3.1.45');
	assert.equal(nextFixedVersion('3.1.44', 'minor'), '3.2.0');
	assert.equal(nextFixedVersion('3.1.44', 'major'), '4.0.0');
	assert.throws(() => nextFixedVersion('3.1.44', 'prerelease'));
	assert.throws(() => nextFixedVersion('3.1.44-beta.1', 'patch'));
});

test('validates npm dist tags', () => {
	assert.equal(validateDistTag('latest'), 'latest');
	assert.equal(validateDistTag('release-next.1'), 'release-next.1');
	assert.throws(() => validateDistTag('3.1.45'));
	assert.throws(() => validateDistTag('v3.1.45'));
	assert.throws(() => validateDistTag('X'));
	assert.throws(() => validateDistTag('x.x'));
	assert.equal(validateDistTag('x-next'), 'x-next');
	assert.throws(() => validateDistTag('not a tag'));
});

test('describes all six platform packages at one version', () => {
	assert.deepEqual(wasmtimeNpmPlatformLabels, [
		'linux-x64',
		'linux-arm64',
		'macos-x64',
		'macos-arm64',
		'windows-x64',
		'windows-arm64',
	]);
	assert.deepEqual(wasmtimeNpmPackageSpec('windows-arm64', '9.8.7'), {
		label: 'windows-arm64',
		name: '@wp-playground/cli-wasmtime-windows-arm64',
		version: '9.8.7',
		archiveName: 'wp-playground-cli-wasmtime-windows-arm64-9.8.7.tgz',
		requiredFiles: [
			'bin/wp-playground-native.exe',
			'package.json',
			'package-manifest.json',
			'share/wp-playground-native/packages/playground/cli-native/assets/php-assets.json',
		],
	});
});

test('matches the self-hosted package URL convention', () => {
	assert.equal(
		selfHostedWasmtimePackageUrl(
			'https://example.test/playground/',
			'macos-arm64',
			'9.8.7'
		),
		'https://example.test/playground/v9.8.7/@wp-playground-cli-wasmtime-macos-arm64-9.8.7.tar.gz'
	);
	const optionalDependencies = Object.fromEntries(
		wasmtimeNpmPlatformLabels.map((label) => {
			const spec = wasmtimeNpmPackageSpec(label, '9.8.7');
			return [
				spec.name,
				selfHostedWasmtimePackageUrl(
					'https://example.test/playground',
					label,
					'9.8.7'
				),
			];
		})
	);
	assert.doesNotThrow(() =>
		validateSelfHostedCliPackage(
			{ optionalDependencies },
			{
				hostingBaseUrl: 'https://example.test/playground',
				version: '9.8.7',
			}
		)
	);
});

test('validates npm dry-run package inspection', () => {
	const spec = wasmtimeNpmPackageSpec('linux-x64', '9.8.7');
	const inspection = {
		id: `${spec.name}@${spec.version}`,
		name: spec.name,
		version: spec.version,
		filename: spec.archiveName,
		size: 1024,
		files: spec.requiredFiles.map((path) => ({ path })),
	};
	assert.equal(validateNpmPublishInspection(inspection, spec), inspection);
	assert.throws(() =>
		validateNpmPublishInspection({ ...inspection, version: '9.8.6' }, spec)
	);
	assert.throws(() =>
		validateNpmPublishInspection(
			{ ...inspection, files: [{ path: 'package.json' }] },
			spec
		)
	);
	assert.throws(() =>
		validateNpmPublishInspection(
			{ ...inspection, size: 96 * 1024 * 1024 },
			spec
		)
	);
});

test('computes npm-compatible archive integrity', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'wasmtime-integrity-'));
	const archive = join(directory, 'fixture.tgz');
	try {
		await writeFile(archive, 'fixture');
		assert.equal(
			await sha512Integrity(archive),
			'sha512-lOlQ7aSocOZWXUThS5DxbAo4HNaTBFKcgfa9QIrxPFFVFrhBfgBfwxCT+qSxPekkNkVt0lKJqyhnw6V2+pSESQ=='
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('requires all six native package versions before resuming', async () => {
	const visited = [];
	await verifyPublishedWasmtimeNpmPackages({
		version: '9.8.7',
		lookupVersion(spec) {
			visited.push(spec.label);
			return spec.version;
		},
	});
	assert.deepEqual(visited, wasmtimeNpmPlatformLabels);

	await assert.rejects(() =>
		verifyPublishedWasmtimeNpmPackages({
			version: '9.8.7',
			lookupVersion(spec) {
				return spec.label === 'windows-arm64'
					? undefined
					: spec.version;
			},
		})
	);
});

test('validates all six archives before publishing them in platform order', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'wasmtime-npm-release-'));
	const events = [];
	const version = '9.8.7';
	const npmClient = {
		inspect(_archivePath, spec) {
			events.push(`inspect:${spec.label}`);
			return publishInspection(spec);
		},
		versionExists(spec) {
			events.push(`exists:${spec.label}`);
			return false;
		},
		publish(_archivePath, spec) {
			events.push(`publish:${spec.label}`);
		},
	};

	try {
		for (const label of wasmtimeNpmPlatformLabels) {
			const spec = wasmtimeNpmPackageSpec(label, version);
			await writeFile(join(directory, spec.archiveName), 'fixture');
		}
		await publishWasmtimeNpmPackages({
			archiveDirectory: directory,
			version,
			distTag: 'next',
			npmClient,
			reporter() {},
		});
		assert.deepEqual(
			events.slice(0, 6),
			wasmtimeNpmPlatformLabels.map((label) => `inspect:${label}`)
		);
		assert.deepEqual(
			events.slice(6),
			wasmtimeNpmPlatformLabels.flatMap((label) => [
				`exists:${label}`,
				`publish:${label}`,
			])
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('refuses an incomplete six-platform archive set', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'wasmtime-npm-release-'));
	try {
		for (const label of wasmtimeNpmPlatformLabels.slice(0, -1)) {
			const spec = wasmtimeNpmPackageSpec(label, '9.8.7');
			await writeFile(join(directory, spec.archiveName), 'fixture');
		}
		await assert.rejects(() =>
			publishWasmtimeNpmPackages({
				archiveDirectory: directory,
				version: '9.8.7',
				distTag: 'next',
				npmClient: {},
				reporter() {},
			})
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

function publishInspection(spec) {
	return {
		id: `${spec.name}@${spec.version}`,
		name: spec.name,
		version: spec.version,
		filename: spec.archiveName,
		size: 1024,
		files: spec.requiredFiles.map((path) => ({ path })),
	};
}
