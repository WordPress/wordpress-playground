#!/usr/bin/env node

import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { verifyPortablePhpAssets } from './portable-php-assets.mjs';

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
	for (const required of ['source-package', 'package-dir']) {
		if (!values.has(required)) {
			throw new Error(`Missing required --${required} argument`);
		}
	}
	return Object.fromEntries(values);
}

async function filesBelow(root, relative = '') {
	const entries = await readdir(join(root, relative), {
		withFileTypes: true,
	});
	const files = [];
	for (const entry of entries) {
		const child = join(relative, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await filesBelow(root, child)));
		} else if (entry.isFile()) {
			files.push(child);
		}
	}
	return files;
}

async function main() {
	const args = parseArguments(process.argv.slice(2));
	const sourcePackage = resolve(args['source-package']);
	const packageDir = resolve(args['package-dir']);
	const sourceAssets = join(sourcePackage, 'share', 'wp-playground-native');
	const destinationAssets = join(packageDir, 'share', 'wp-playground-native');
	if (!(await stat(sourceAssets)).isDirectory()) {
		throw new Error(
			`Native package asset root is not a directory: ${sourceAssets}`
		);
	}
	await rm(destinationAssets, { recursive: true, force: true });
	await mkdir(join(packageDir, 'share'), { recursive: true });
	await cp(sourceAssets, destinationAssets, {
		recursive: true,
		errorOnExist: true,
		force: false,
	});
	const files = await filesBelow(destinationAssets);
	const forbidden = files.filter((path) => path.endsWith('.cwasm'));
	if (forbidden.length > 0) {
		throw new Error(
			`npm runtime assets unexpectedly contain .cwasm: ${forbidden.join(', ')}`
		);
	}
	const phpAssets = await verifyPortablePhpAssets(destinationAssets, {
		forbidWasmtime: true,
	});
	if (
		!files.some((path) =>
			path.endsWith('sqlite-database-integration-trunk.zip')
		)
	) {
		throw new Error(
			'npm runtime assets do not contain the SQLite integration archive'
		);
	}
	process.stdout.write(
		`${JSON.stringify({ assetRoot: destinationAssets, files, phpVersions: phpAssets.versions })}\n`
	);
}

main().catch((error) => {
	process.stderr.write(`${error.stack ?? error.message}\n`);
	process.exitCode = 1;
});
