#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
	chmod,
	mkdir,
	readFile,
	rename,
	stat,
	writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip, constants as zlibConstants } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '../../../..');

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
	for (const required of ['binary', 'target', 'fixture-dir', 'package-dir']) {
		if (!values.has(required)) {
			throw new Error(`Missing required --${required} argument`);
		}
	}
	return Object.fromEntries(values);
}

async function sha256(path) {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(path)) {
		hash.update(chunk);
	}
	return hash.digest('hex');
}

const supportedTargets = new Set([
	'linux-x64-gnu',
	'linux-arm64-gnu',
	'darwin-x64',
	'darwin-arm64',
	'win32-x64',
	'win32-arm64',
]);

async function main() {
	const args = parseArguments(process.argv.slice(2));
	if (!supportedTargets.has(args.target)) {
		throw new Error(`Unsupported fixture target: ${args.target}`);
	}

	const binaryPath = resolve(args.binary);
	const fixtureDir = resolve(args['fixture-dir']);
	const packageDir = resolve(args['package-dir']);
	const hostDir = join(fixtureDir, 'hosts');
	const compressedName = `${basename(binaryPath)}-${args.target}.gz`;
	const compressedPath = join(hostDir, compressedName);
	const temporaryPath = `${compressedPath}.tmp-${process.pid}`;

	await mkdir(hostDir, { recursive: true });
	await mkdir(packageDir, { recursive: true });
	await pipeline(
		createReadStream(binaryPath),
		createGzip({
			level: 9,
			strategy: zlibConstants.Z_DEFAULT_STRATEGY,
		}),
		createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 })
	);
	await rename(temporaryPath, compressedPath);
	if (process.platform !== 'win32') {
		await chmod(compressedPath, 0o644);
	}

	const [binaryStat, compressedStat, binaryHash, compressedHash] =
		await Promise.all([
			stat(binaryPath),
			stat(compressedPath),
			sha256(binaryPath),
			sha256(compressedPath),
		]);
	const lerna = JSON.parse(
		await readFile(join(repositoryRoot, 'lerna.json'), 'utf8')
	);
	const manifest = {
		schemaVersion: 1,
		protocolVersion: 1,
		hostVersion: String(lerna.version),
		targets: {
			[args.target]: {
				path: `hosts/${compressedName}`,
				compressedSize: compressedStat.size,
				compressedSha256: compressedHash,
				size: binaryStat.size,
				sha256: binaryHash,
			},
		},
	};
	const manifestContents = `${JSON.stringify(manifest, null, '\t')}\n`;
	await Promise.all([
		writeFile(
			join(packageDir, 'native-host-manifest.json'),
			manifestContents
		),
		writeFile(
			join(fixtureDir, 'native-host-manifest.json'),
			manifestContents
		),
	]);
	process.stdout.write(
		`${JSON.stringify({
			target: args.target,
			binary: binaryPath,
			fixture: compressedPath,
			manifest: join(packageDir, 'native-host-manifest.json'),
		})}\n`
	);
}

main().catch((error) => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
