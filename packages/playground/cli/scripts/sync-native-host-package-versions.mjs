import { readFile, writeFile } from 'node:fs/promises';

const packageJsonPath = 'dist/packages/playground/cli/package.json';
const nativeHostPackageNames = [
	'@wp-playground/cli-native-linux-x64',
	'@wp-playground/cli-native-linux-arm64',
	'@wp-playground/cli-native-macos-x64',
	'@wp-playground/cli-native-macos-arm64',
	'@wp-playground/cli-native-windows-x64',
	'@wp-playground/cli-native-windows-arm64',
];

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
if (!packageJson.version) {
	throw new Error(`${packageJsonPath} has no package version.`);
}

packageJson.optionalDependencies = {
	...packageJson.optionalDependencies,
	...Object.fromEntries(
		nativeHostPackageNames.map((name) => [name, packageJson.version])
	),
};

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
