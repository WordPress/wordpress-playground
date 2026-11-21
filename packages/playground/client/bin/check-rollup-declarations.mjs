import { readdir, readFile } from 'node:fs/promises';

const packageDirectory = 'dist/packages/playground/client';
const declarationFile = `${packageDirectory}/index.d.ts`;
const commonJsDeclarationFile = packageDirectory + '/index.d.cts';
const packageJsonFile = `${packageDirectory}/package.json`;
const externalImportPattern =
	/^\s*import\s+(?:[^'"]*\s+from\s+)?['"][^.'"]|^\s*export\s+[^'"]*\s+from\s+['"][^.'"]|import\(\s*['"][^.'"]|^\s*declare module ['"][^.'"]/;

async function main() {
	const declarationFiles = await findDeclarationFiles(packageDirectory);
	const packageJson = JSON.parse(await readFile(packageJsonFile, 'utf8'));
	const unexpectedFiles = declarationFiles.filter(
		(file) => file !== declarationFile && file !== commonJsDeclarationFile
	);

	if (!declarationFiles.includes(declarationFile)) {
		throw new Error(`Missing bundled declaration file: ${declarationFile}`);
	}

	if (unexpectedFiles.length > 0) {
		throw new Error(
			[
				'Expected only the ESM and CommonJS client declaration files.',
				'Unexpected files:',
				...unexpectedFiles.map((file) => `- ${file}`),
			].join('\n')
		);
	}

	if (packageJson.types !== 'index.d.ts') {
		throw new Error(
			`Expected ${packageJsonFile} to declare "types": "index.d.ts".`
		);
	}

	if (
		packageJson.exports?.['.']?.import?.types !== './index.d.ts' ||
		packageJson.exports?.['.']?.require?.types !== './index.d.cts'
	) {
		throw new Error(
			`Expected ${packageJsonFile} to export "./index.d.ts" and "./index.d.cts" for ESM and CommonJS.`
		);
	}

	const declarations = await readFile(declarationFile, 'utf8');
	if ((await readFile(commonJsDeclarationFile, 'utf8')) !== declarations) {
		throw new Error(
			'CommonJS declarations must match the ESM declarations.'
		);
	}

	const externalImports = declarations
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('*'))
		.filter((line) => externalImportPattern.test(line));

	if (externalImports.length > 0) {
		throw new Error(
			[
				'Bundled declarations must inline external imports.',
				`Found an external package reference in ${declarationFile}.`,
				...externalImports.map((line) => `- ${line.trim()}`),
			].join('\n')
		);
	}

	console.log(`Verified bundled declarations in ${declarationFile}`);
}

async function findDeclarationFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = `${directory}/${entry.name}`;
			if (entry.isDirectory()) {
				return findDeclarationFiles(entryPath);
			}
			return /\.d\.(?:ts|cts)$/.test(entry.name) ? [entryPath] : [];
		})
	);
	return files.flat();
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
