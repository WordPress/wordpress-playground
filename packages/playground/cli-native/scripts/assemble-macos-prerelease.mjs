#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
	copyFile,
	mkdir,
	readFile,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const targets = [
	{
		name: 'darwin-x64',
		triple: 'x86_64-apple-darwin',
	},
	{
		name: 'darwin-arm64',
		triple: 'aarch64-apple-darwin',
	},
];

function parseArguments(argv) {
	const values = new Map();
	for (let index = 0; index < argv.length; index += 2) {
		const name = argv[index];
		const value = argv[index + 1];
		if (!name?.startsWith('--') || value === undefined) {
			throw new Error(
				`Expected --name value arguments, received ${name ?? '<end>'}`
			);
		}
		values.set(name.slice(2), value);
	}
	for (const required of [
		'input-dir',
		'package-dir',
		'output-dir',
		'source-commit',
	]) {
		if (!values.has(required)) {
			throw new Error(`Missing required --${required} argument`);
		}
	}
	return Object.fromEntries(values);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function assertSha256(value, description) {
	assert(
		typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
		`${description} must be a lowercase SHA-256 digest`
	);
}

async function sha256(path) {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest('hex');
}

async function decompressedIdentity(path) {
	const hash = createHash('sha256');
	let size = 0;
	await pipeline(
		createReadStream(path),
		createGunzip(),
		new Writable({
			write(chunk, _encoding, callback) {
				size += chunk.length;
				hash.update(chunk);
				callback();
			},
		})
	);
	return { size, sha256: hash.digest('hex') };
}

async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'));
}

async function run(command, args, options = {}) {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('close', (code, signal) => {
			if (code === 0 && signal === null) {
				resolvePromise({ stdout, stderr });
				return;
			}
			reject(
				new Error(
					`${command} ${args.join(' ')} failed with ${signal ?? `exit ${code}`}\n${stderr.slice(-8_000)}`
				)
			);
		});
	});
}

async function packPackage(packageDir, outputDir) {
	const npmCliPath = process.env['npm_execpath'];
	if (!npmCliPath) {
		throw new Error(
			'npm_execpath is unavailable; run this assembler through npm exec'
		);
	}
	const packed = await run(process.execPath, [
		npmCliPath,
		'pack',
		packageDir,
		'--json',
		'--pack-destination',
		outputDir,
	]);
	const report = JSON.parse(packed.stdout)?.[0];
	assert(
		report?.filename,
		`npm pack returned an invalid report: ${packed.stdout}`
	);
	assert(
		Array.isArray(report.files),
		'npm pack did not report its file inventory'
	);
	for (const file of report.files) {
		assert(
			!file.path.endsWith('.cwasm') &&
				!/(^|\/)wp-playground-native(?:\.exe)?$/.test(file.path),
			`npm tarball contains forbidden native payload ${file.path}`
		);
	}
	assert(
		report.files.some((file) => file.path === 'native-host-manifest.json'),
		'npm tarball is missing native-host-manifest.json'
	);
	return join(outputDir, report.filename);
}

async function main() {
	const args = parseArguments(process.argv.slice(2));
	const inputDir = resolve(args['input-dir']);
	const packageDir = resolve(args['package-dir']);
	const outputDir = resolve(args['output-dir']);
	const sourceCommit = args['source-commit'];
	assert(
		/^[a-f0-9]{40}$/.test(sourceCommit),
		'--source-commit must be a full lowercase Git commit SHA'
	);
	assert(
		outputDir !== resolve('/'),
		'--output-dir must not be the filesystem root'
	);

	const packageJson = await readJson(join(packageDir, 'package.json'));
	assert(
		packageJson.name === '@wp-playground/cli-native' &&
			packageJson.private === true,
		'prerelease package must remain private @wp-playground/cli-native'
	);

	await rm(outputDir, { recursive: true, force: true });
	await mkdir(outputDir, { recursive: true });

	let hostVersion;
	const combinedTargets = {};
	const provenanceTargets = {};
	for (const target of targets) {
		const manifest = await readJson(
			join(inputDir, `native-host-manifest-${target.name}.json`)
		);
		const packageManifest = await readJson(
			join(inputDir, `runtime-package-manifest-${target.name}.json`)
		);
		assert(
			manifest.schemaVersion === 1,
			`${target.name} schemaVersion must be 1`
		);
		assert(
			manifest.protocolVersion === 1,
			`${target.name} protocolVersion must be 1`
		);
		hostVersion ??= manifest.hostVersion;
		assert(
			manifest.hostVersion === hostVersion,
			`${target.name} hostVersion does not match the other macOS build`
		);
		assert(
			manifest.hostVersion === packageJson.version,
			`${target.name} hostVersion does not match package.json`
		);
		assert(
			JSON.stringify(Object.keys(manifest.targets)) ===
				JSON.stringify([target.name]),
			`${target.name} manifest must contain exactly its own target`
		);
		const asset = manifest.targets[target.name];
		assert(
			asset && typeof asset === 'object',
			`${target.name} asset is missing`
		);
		for (const key of ['compressedSize', 'size']) {
			assert(
				Number.isSafeInteger(asset[key]) && asset[key] > 0,
				`${target.name}.${key} must be a positive integer`
			);
		}
		assertSha256(asset.compressedSha256, `${target.name}.compressedSha256`);
		assertSha256(asset.sha256, `${target.name}.sha256`);
		const hostFileName = `wp-playground-native-${target.name}.gz`;
		assert(
			basename(asset.path) === hostFileName,
			`${target.name} manifest points to unexpected host ${asset.path}`
		);
		const hostPath = join(inputDir, hostFileName);
		const compressedStat = await stat(hostPath);
		assert(
			compressedStat.size === asset.compressedSize,
			`${target.name} compressed size does not match its manifest`
		);
		assert(
			(await sha256(hostPath)) === asset.compressedSha256,
			`${target.name} compressed SHA-256 does not match its manifest`
		);
		const decompressed = await decompressedIdentity(hostPath);
		assert(
			decompressed.size === asset.size,
			`${target.name} executable size does not match its manifest`
		);
		assert(
			decompressed.sha256 === asset.sha256,
			`${target.name} executable SHA-256 does not match its manifest`
		);

		assert(
			packageManifest.schemaVersion === 1 &&
				packageManifest.version === hostVersion &&
				packageManifest.targetTriple === target.triple &&
				packageManifest.sourceCommit === sourceCommit,
			`${target.name} runtime package provenance does not match the requested build`
		);
		assert(
			packageManifest.binary?.sizeBytes === asset.size &&
				packageManifest.binary?.sha256 === asset.sha256,
			`${target.name} runtime package binary does not match the host asset`
		);

		combinedTargets[target.name] = { ...asset, path: hostFileName };
		await copyFile(hostPath, join(outputDir, hostFileName));
		provenanceTargets[target.name] = {
			targetTriple: target.triple,
			hostFile: hostFileName,
			compressedSize: asset.compressedSize,
			compressedSha256: asset.compressedSha256,
			size: asset.size,
			sha256: asset.sha256,
			rustcVersion: packageManifest.rustcVersion,
		};
	}

	const combinedManifest = {
		schemaVersion: 1,
		protocolVersion: 1,
		hostVersion,
		targets: combinedTargets,
	};
	const manifestContents = `${JSON.stringify(combinedManifest, null, '\t')}\n`;
	await Promise.all([
		writeFile(
			join(packageDir, 'native-host-manifest.json'),
			manifestContents
		),
		writeFile(
			join(outputDir, 'native-host-manifest.json'),
			manifestContents
		),
	]);

	const packagePath = await packPackage(packageDir, outputDir);
	const provenance = {
		schemaVersion: 1,
		kind: 'experimental-cli-native-macos-prerelease',
		sourceCommit,
		packageVersion: packageJson.version,
		packageFile: basename(packagePath),
		packageSha256: await sha256(packagePath),
		targets: provenanceTargets,
	};
	const provenancePath = join(outputDir, 'prerelease-provenance.json');
	await writeFile(
		provenancePath,
		`${JSON.stringify(provenance, null, '\t')}\n`
	);

	const checksumFiles = [
		basename(packagePath),
		'native-host-manifest.json',
		'prerelease-provenance.json',
		...targets.map((target) => `wp-playground-native-${target.name}.gz`),
	].sort();
	const checksumLines = [];
	for (const file of checksumFiles) {
		checksumLines.push(`${await sha256(join(outputDir, file))}  ${file}`);
	}
	await writeFile(
		join(outputDir, 'SHA256SUMS'),
		`${checksumLines.join('\n')}\n`
	);

	process.stdout.write(
		`${JSON.stringify({
			outputDir,
			package: packagePath,
			sourceCommit,
			targets: targets.map((target) => target.name),
		})}\n`
	);
}

main().catch((error) => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
