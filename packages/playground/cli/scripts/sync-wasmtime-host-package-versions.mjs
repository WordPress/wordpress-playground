import { readFile, writeFile } from 'node:fs/promises';

const packageJsonPath = 'dist/packages/playground/cli/package.json';
const wasmtimeHostPackageNames = [
	'@wp-playground/cli-wasmtime-linux-x64',
	'@wp-playground/cli-wasmtime-linux-arm64',
	'@wp-playground/cli-wasmtime-macos-x64',
	'@wp-playground/cli-wasmtime-macos-arm64',
	'@wp-playground/cli-wasmtime-windows-x64',
	'@wp-playground/cli-wasmtime-windows-arm64',
];

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
if (!packageJson.version) {
	throw new Error(`${packageJsonPath} has no package version.`);
}
const wasmtimeHostVersion =
	process.env.WP_PLAYGROUND_WASMTIME_NPM_VERSION ?? packageJson.version;

packageJson.optionalDependencies = {
	...packageJson.optionalDependencies,
	...Object.fromEntries(
		wasmtimeHostPackageNames.map((name) => [name, wasmtimeHostVersion])
	),
};

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
