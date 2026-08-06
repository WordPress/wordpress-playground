/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { execFile, spawn } from 'node:child_process';
import {
	cp,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryDirectory = fileURLToPath(
	new URL('../../../../', import.meta.url)
);
const repositoryLicense = fileURLToPath(
	new URL('../../../../LICENSE', import.meta.url)
);
const nxCLI = fileURLToPath(
	new URL('../../../../node_modules/nx/bin/nx.js', import.meta.url)
);
const packageConfigurations = [
	{
		name: '@php-wasm/universal',
		directory: fileURLToPath(
			new URL(
				'../../../../dist/packages/php-wasm/universal/',
				import.meta.url
			)
		),
		requiredFiles: [
			'LICENSE',
			'index.cjs',
			'index.cjs.map',
			'index.d.ts',
			'index.js',
			'index.js.map',
			'package.json',
		],
		requiredPackedFiles: [
			'LICENSE',
			'index.cjs',
			'index.cjs.map',
			'index.d.ts',
			'index.js',
			'index.js.map',
			'package.json',
		],
		requireDualFormat: true,
	},
	{
		name: '@wp-playground/client',
		directory: fileURLToPath(
			new URL(
				'../../../../dist/packages/playground/client/',
				import.meta.url
			)
		),
		requiredFiles: [
			'LICENSE',
			'index.cjs',
			'index.d.ts',
			'index.js',
			'package.json',
		],
		requiredPackedFiles: [
			'LICENSE',
			'index.cjs',
			'index.d.ts',
			'index.js',
			'package.json',
		],
		requireDualFormat: true,
	},
	{
		name: '@wp-playground/remote',
		directory: fileURLToPath(
			new URL(
				'../../../../dist/packages/playground/remote/',
				import.meta.url
			)
		),
		requiredFiles: ['LICENSE', 'package.json', 'remote.html'],
		requiredPackedFiles: ['LICENSE', 'package.json'],
		requireDualFormat: false,
		// Versioned WordPress trees are copied runtime inputs, not Vite output.
		copiedRuntimeSourcePrefixes: ['wp-'],
	},
];
const forbiddenLegacySourcePatterns = [
	{ label: 'legacy RPC library name', pattern: /comlink/i },
];
const forbiddenBundledSourcePatterns = [
	{
		label: 'Apache license text',
		pattern: /Licensed under the Apache License/i,
	},
	{
		label: 'Apache SPDX identifier',
		pattern: /SPDX-License-Identifier:\s*Apache/i,
	},
	{ label: 'Google copyright notice', pattern: /Copyright[^\n]*Google/i },
];
const textFilePattern =
	/\.(?:[cm]?js|[cm]?ts|jsx|tsx|map|json|md|html|css|txt|svg)$/i;
const bundledSourceFilePattern = /\.(?:[cm]?js|jsx|css|html|map)$/i;

for (const configuration of packageConfigurations) {
	await rm(configuration.directory, { recursive: true, force: true });
}

await runNx([
	'run-many',
	'--target=build',
	'--projects=php-wasm-logger,php-wasm-util,php-wasm-stream-compression,php-wasm-progress,php-wasm-universal,playground-client',
	'--skip-nx-cache',
]);
await runNx(['run', 'playground-remote:build', '--skip-nx-cache']);
await assertDualFormatImports();

const rootLicense = await readFile(repositoryLicense);
const results = [];
for (const configuration of packageConfigurations) {
	results.push(await inspectPackage(configuration, rootLicense));
}

console.log(
	JSON.stringify(
		{
			packages: results,
			dualFormatImports: 'ESM and CommonJS passed',
			forbiddenSourcePatterns: 'none found',
		},
		null,
		2
	)
);

async function inspectPackage(configuration, rootLicense) {
	const files = await listFiles(configuration.directory);
	for (const file of files) {
		assertNoForbiddenSource(`${configuration.name} file path`, file);
	}
	for (const required of configuration.requiredFiles) {
		assert(
			files.includes(required),
			`${configuration.name} build is missing ${required}.`
		);
	}
	assert(
		!files.some(isTestFixturePath),
		`${configuration.name} build contains RPC test fixtures.`
	);

	const directoryURL = pathToDirectoryURL(configuration.directory);
	const [packagedLicense, packageJSONText] = await Promise.all([
		readFile(new URL('LICENSE', directoryURL)),
		readFile(new URL('package.json', directoryURL), 'utf8'),
	]);
	assert(
		rootLicense.equals(packagedLicense),
		`${configuration.name} LICENSE is not byte-for-byte equal to the repository GPL license.`
	);
	const packageJSON = JSON.parse(packageJSONText);
	assert(
		packageJSON.name === configuration.name,
		`${configuration.name} build has the wrong package name.`
	);
	assert(
		packageJSON.license === 'GPL-2.0-or-later',
		`${configuration.name} package.json has the wrong license identifier.`
	);
	if (configuration.requireDualFormat) {
		assert(
			packageJSON.exports?.['.']?.import === './index.js' &&
				packageJSON.exports?.['.']?.require === './index.cjs',
			`${configuration.name} does not expose both ESM and CommonJS builds.`
		);
	}

	let sourceMapCount = 0;
	let sourcesContentCount = 0;
	for (const file of files) {
		if (!textFilePattern.test(file)) continue;
		const content = await readFile(new URL(file, directoryURL), 'utf8');
		assertNoForbiddenSource(`${configuration.name}/${file}`, content);
		const inspectBundledSource = shouldInspectBundledSource(
			configuration,
			file
		);
		if (inspectBundledSource) {
			assertNoForbiddenBundledSource(
				`${configuration.name}/${file}`,
				content
			);
		}
		if (!file.endsWith('.map')) continue;
		const sourceMap = JSON.parse(content);
		sourceMapCount++;
		assert(
			Array.isArray(sourceMap.sources),
			`${configuration.name}/${file} has no sources array.`
		);
		for (const source of sourceMap.sources) {
			assertNoForbiddenSource(
				`${configuration.name}/${file} source path`,
				String(source)
			);
			if (inspectBundledSource) {
				assertNoForbiddenBundledSource(
					`${configuration.name}/${file} source path`,
					String(source)
				);
			}
		}
		if (Array.isArray(sourceMap.sourcesContent)) {
			for (const [index, source] of sourceMap.sourcesContent.entries()) {
				if (typeof source !== 'string') continue;
				sourcesContentCount++;
				assertNoForbiddenSource(
					`${configuration.name}/${file} sourcesContent[${index}]`,
					source
				);
				if (inspectBundledSource) {
					assertNoForbiddenBundledSource(
						`${configuration.name}/${file} sourcesContent[${index}]`,
						source
					);
				}
			}
		}
	}

	const packedFiles = await getPackedFiles(configuration.directory);
	for (const file of packedFiles) {
		assertNoForbiddenSource(`${configuration.name} npm pack path`, file);
	}
	for (const required of configuration.requiredPackedFiles) {
		assert(
			packedFiles.includes(required),
			`${configuration.name} npm package is missing ${required}.`
		);
	}
	assert(
		!packedFiles.some(isTestFixturePath),
		`${configuration.name} npm package contains RPC test fixtures.`
	);

	return {
		name: configuration.name,
		packageDirectory: configuration.directory,
		builtFileCount: files.length,
		packedFileCount: packedFiles.length,
		packedFiles,
		sourceMapCount,
		sourcesContentCount,
		licenseBytes: packagedLicense.byteLength,
		license: packageJSON.license,
		esm: packageJSON.exports?.['.']?.import,
		commonjs: packageJSON.exports?.['.']?.require,
	};
}

async function runNx(args) {
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [nxCLI, ...args], {
			cwd: repositoryDirectory,
			env: { ...process.env, NX_DAEMON: 'false' },
			stdio: 'inherit',
		});
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (code === 0) resolve();
			else {
				reject(
					new Error(
						`Nx artifact build failed with ${
							signal ? `signal ${signal}` : `exit code ${code}`
						}.`
					)
				);
			}
		});
	});
}

async function assertDualFormatImports() {
	const temporaryDirectory = await mkdtemp(
		join(repositoryDirectory, 'dist/rpc-artifact-import-')
	);
	try {
		const packages = [
			['@php-wasm/logger', 'dist/packages/php-wasm/logger'],
			['@php-wasm/util', 'dist/packages/php-wasm/util'],
			[
				'@php-wasm/stream-compression',
				'dist/packages/php-wasm/stream-compression',
			],
			['@php-wasm/progress', 'dist/packages/php-wasm/progress'],
			['@php-wasm/universal', 'dist/packages/php-wasm/universal'],
			['@wp-playground/client', 'dist/packages/playground/client'],
		];
		for (const [name, source] of packages) {
			const destination = join(
				temporaryDirectory,
				'node_modules',
				...name.split('/')
			);
			await mkdir(destination, { recursive: true });
			await cp(join(repositoryDirectory, source), destination, {
				recursive: true,
			});
		}

		const esmScript = join(temporaryDirectory, 'verify-esm.mjs');
		const commonjsScript = join(temporaryDirectory, 'verify-commonjs.cjs');
		await Promise.all([
			writeFile(
				esmScript,
				"await import('@php-wasm/universal');\nawait import('@wp-playground/client');\n"
			),
			writeFile(
				commonjsScript,
				"require('@php-wasm/universal');\nrequire('@wp-playground/client');\n"
			),
		]);
		await runNodeScript(esmScript);
		await runNodeScript(commonjsScript);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
}

async function runNodeScript(script) {
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [script], {
			cwd: repositoryDirectory,
			stdio: 'inherit',
		});
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (code === 0) resolve();
			else {
				reject(
					new Error(
						`Package import check failed with ${
							signal ? `signal ${signal}` : `exit code ${code}`
						}.`
					)
				);
			}
		});
	});
}

async function getPackedFiles(directory) {
	const npmCLI = process.env.npm_execpath;
	const command = npmCLI ? process.execPath : 'npm';
	const args = npmCLI
		? [npmCLI, 'pack', directory, '--dry-run', '--json', '--ignore-scripts']
		: ['pack', directory, '--dry-run', '--json', '--ignore-scripts'];
	const { stdout } = await execFileAsync(command, args, {
		cwd: repositoryDirectory,
		maxBuffer: 16 * 1024 * 1024,
	});
	const report = JSON.parse(stdout);
	assert(
		Array.isArray(report) &&
			report.length === 1 &&
			Array.isArray(report[0].files),
		`npm pack returned an invalid manifest for ${directory}.`
	);
	return report[0].files.map(({ path }) => String(path)).sort();
}

async function listFiles(directory, prefix = '') {
	const entries = await readdir(directory, { withFileTypes: true });
	const result = [];
	for (const entry of entries) {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			result.push(
				...(await listFiles(
					fileURLToPath(
						new URL(`${entry.name}/`, pathToDirectoryURL(directory))
					),
					relative
				))
			);
		} else {
			result.push(relative);
		}
	}
	return result.sort();
}

function pathToDirectoryURL(path) {
	const url = pathToFileURL(path);
	if (!url.pathname.endsWith('/')) url.pathname += '/';
	return url;
}

function assertNoForbiddenSource(location, content) {
	assertNoPatterns(location, content, forbiddenLegacySourcePatterns);
}

function isTestFixturePath(file) {
	return file.includes('test-fixtures') || file.includes('test/fixtures');
}

function shouldInspectBundledSource(configuration, file) {
	return (
		bundledSourceFilePattern.test(file) &&
		!configuration.copiedRuntimeSourcePrefixes?.some((prefix) =>
			file.startsWith(prefix)
		)
	);
}

function assertNoForbiddenBundledSource(location, content) {
	assertNoPatterns(location, content, forbiddenBundledSourcePatterns);
}

function assertNoPatterns(location, content, patterns) {
	for (const { label, pattern } of patterns) {
		assert(!pattern.test(content), `${location} contains ${label}.`);
	}
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}
