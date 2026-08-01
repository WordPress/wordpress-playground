import { rm, readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const packagesDirectory = 'packages';
const outputDirectory = 'dist/packages/playground/client';
const outputFile = `${outputDirectory}/index.d.ts`;
const entryPoint = 'packages/playground/client/src/index.ts';
const tsconfig = 'packages/playground/client/tsconfig.lib.json';
const externalPackageNames = ['ajv'];

await removeGeneratedDeclarations(outputDirectory);

const internalPackageNames = await findInternalPackageNames(packagesDirectory);
const inlinedPackageNames = [
	...internalPackageNames,
	...externalPackageNames,
].sort();
const result = spawnSync(
	'npx',
	[
		'dts-bundle-generator',
		'--project',
		tsconfig,
		'--external-inlines',
		...inlinedPackageNames,
		'-o',
		outputFile,
		'--',
		entryPoint,
	],
	{ stdio: 'inherit' }
);

process.exit(result.status ?? 1);

async function removeGeneratedDeclarations(directory) {
	const declarationFiles = await findDeclarationFiles(directory);
	await Promise.all(declarationFiles.map((file) => rm(file)));
}

async function findInternalPackageNames(directory) {
	const packageJsonFiles = await findPackageJsonFiles(directory);
	const names = await Promise.all(
		packageJsonFiles.map(async (file) => {
			const packageJson = JSON.parse(await readFile(file, 'utf8'));
			return packageJson.name;
		})
	);
	return names
		.filter(
			(name) =>
				name?.startsWith('@php-wasm/') ||
				name?.startsWith('@wp-playground/')
		)
		.sort();
}

async function findPackageJsonFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = `${directory}/${entry.name}`;
			if (entry.isDirectory()) {
				return findPackageJsonFiles(entryPath);
			}
			return entry.name === 'package.json' ? [entryPath] : [];
		})
	);
	return files.flat();
}

async function findDeclarationFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = `${directory}/${entry.name}`;
			if (entry.isDirectory()) {
				return findDeclarationFiles(entryPath);
			}
			return entry.name.endsWith('.d.ts') ? [entryPath] : [];
		})
	);
	return files.flat();
}
