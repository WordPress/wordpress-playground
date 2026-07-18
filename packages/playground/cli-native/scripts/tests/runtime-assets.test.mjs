import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const scriptDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stageScript = join(scriptDirectory, 'stage-npm-runtime-assets.mjs');
const boundaryScript = join(
	scriptDirectory,
	'verify-private-package-boundary.mjs'
);
const manifestRelativePath =
	'packages/playground/cli-native/assets/php-assets.json';
const licensePaths = [
	'share/licenses/php-wasi/zlib.txt',
	'share/licenses/php-wasi-extended/libmemcached-awesome-BSD-3-Clause.txt',
	'share/licenses/php-wasi-extended/php-memcached-PHP-3.01.txt',
	'share/licenses/php-wasi-extended/phpredis-PHP-3.01.txt',
	'share/licenses/php-wasi-extended/xdebug-1.03.txt',
];

function sha256(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

async function writeFixture(sourcePackage) {
	const assetRoot = join(sourcePackage, 'share', 'wp-playground-native');
	const components = [
		{
			version: '7.4',
			variant: 'base',
			path: 'php/7.4/php-wasi-component.wasm',
			bytes: Buffer.from('portable-php-7.4'),
		},
		{
			version: '8.5',
			variant: 'base',
			path: 'php/8.5/php-wasi-component.wasm',
			bytes: Buffer.from('portable-php-8.5'),
		},
		{
			version: '8.5',
			variant: 'extended',
			path: 'php/8.5/php-wasi-component-extended.wasm',
			bytes: Buffer.from('portable-php-8.5-extended'),
		},
	];
	const php = {};
	for (const { version, variant, path, bytes } of components) {
		await mkdir(dirname(join(assetRoot, path)), { recursive: true });
		await writeFile(join(assetRoot, path), bytes);
		php[version] ??= {};
		const descriptor = { path, sha256: sha256(bytes) };
		if (variant === 'base') {
			php[version].wasm = descriptor;
		} else {
			php[version].variants = { extended: { wasm: descriptor } };
		}
	}
	await mkdir(dirname(join(assetRoot, manifestRelativePath)), {
		recursive: true,
	});
	await writeFile(
		join(assetRoot, manifestRelativePath),
		`${JSON.stringify({ schemaVersion: 2, runtime: 'wasip2-component', php }, null, 2)}\n`
	);
	await mkdir(join(assetRoot, 'sqlite'), { recursive: true });
	await writeFile(
		join(assetRoot, 'sqlite/sqlite-database-integration-trunk.zip'),
		'dummy-sqlite-archive'
	);
	return { assetRoot, components };
}

async function stage(sourcePackage, packageDirectory) {
	return await run(process.execPath, [
		stageScript,
		'--source-package',
		sourcePackage,
		'--package-dir',
		packageDirectory,
	]);
}

async function verifyPackageBoundary(packageDirectory) {
	return await run(process.execPath, [
		boundaryScript,
		'--package-dir',
		packageDirectory,
	]);
}

test('stages and verifies every PHP component declared by the manifest', async () => {
	const root = await mkdtemp(join(tmpdir(), 'cli-native-runtime-assets-'));
	try {
		const sourcePackage = join(root, 'source');
		const packageDirectory = join(root, 'package');
		const { components } = await writeFixture(sourcePackage);
		const result = await stage(sourcePackage, packageDirectory);
		const summary = JSON.parse(result.stdout);
		assert.deepEqual(summary.phpVersions, ['7.4', '8.5']);

		for (const { path, bytes } of components) {
			assert.deepEqual(
				await readFile(
					join(packageDirectory, 'share/wp-playground-native', path)
				),
				bytes
			);
		}
		for (const path of [
			'package.json',
			'wp-playground.js',
			'index.js',
			'index.cjs',
			'index.d.ts',
			'native-host-manifest.json',
		]) {
			await writeFile(join(packageDirectory, path), '{}\n');
		}
		for (const path of licensePaths) {
			await mkdir(dirname(join(packageDirectory, path)), {
				recursive: true,
			});
			await writeFile(join(packageDirectory, path), 'license fixture\n');
		}
		await verifyPackageBoundary(packageDirectory);
		const zlibLicense = join(packageDirectory, licensePaths[0]);
		await rm(zlibLicense);
		await assert.rejects(
			() => verifyPackageBoundary(packageDirectory),
			(error) =>
				/built package is missing share\/licenses\/php-wasi\/zlib\.txt/.test(
					error.stderr
				)
		);
		await writeFile(zlibLicense, 'license fixture\n');

		const destinationComponent = join(
			packageDirectory,
			'share/wp-playground-native/php/8.5/php-wasi-component-extended.wasm'
		);
		await writeFile(destinationComponent, 'corrupt');
		await assert.rejects(
			() => verifyPackageBoundary(packageDirectory),
			(error) =>
				/PHP 8\.5 extended wasm asset checksum mismatch/.test(
					error.stderr
				)
		);

		await writeFile(
			join(
				sourcePackage,
				'share/wp-playground-native/php/8.5/php-wasi-component-extended.wasm'
			),
			'corrupt'
		);
		await assert.rejects(
			() => stage(sourcePackage, packageDirectory),
			(error) =>
				/PHP 8\.5 extended wasm asset checksum mismatch/.test(
					error.stderr
				)
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('rejects an extended Wasmtime precompile from portable npm assets', async () => {
	const root = await mkdtemp(join(tmpdir(), 'cli-native-runtime-cwasm-'));
	try {
		const sourcePackage = join(root, 'source');
		const packageDirectory = join(root, 'package');
		const { assetRoot } = await writeFixture(sourcePackage);
		const manifestPath = join(assetRoot, manifestRelativePath);
		const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
		const path = 'php/8.5/php-wasi-component-extended.wasm.cwasm';
		const bytes = Buffer.from('host-specific-precompile');
		await writeFile(join(assetRoot, path), bytes);
		manifest.php['8.5'].variants.extended.wasmtime = {
			path,
			sha256: sha256(bytes),
		};
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

		await assert.rejects(
			() => stage(sourcePackage, packageDirectory),
			(error) => /unexpectedly contain \.cwasm/.test(error.stderr)
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
