/**
 * Build script for PHP WASM binary-only npm packages.
 *
 * Usage:
 *   node tools/scripts/build-wasm-binary-package.mjs --platform=web --version=8-4
 *   node tools/scripts/build-wasm-binary-package.mjs --platform=node --version=8-4
 *
 * Copies jspi/ and asyncify/ directories from the source build directory to
 * the dist output directory and generates a package.json for publishing to
 * GitHub Packages.
 */

import { cpSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

// Parse CLI args: --platform=web|node --version=8-4
const args = Object.fromEntries(
	process.argv
		.slice(2)
		.filter((arg) => arg.startsWith('--'))
		.map((arg) => {
			const [key, value] = arg.slice(2).split('=');
			return [key, value];
		})
);

const { platform, version } = args;

if (!platform || !['web', 'node'].includes(platform)) {
	console.error('Error: --platform must be "web" or "node"');
	process.exit(1);
}

if (!version || !/^\d+-\d+$/.test(version)) {
	console.error('Error: --version must be in the format "8-4"');
	process.exit(1);
}

// Load the supported PHP versions to get the lastRelease value.
const { phpVersions } = await import(
	join(repoRoot, 'packages/php-wasm/supported-php-versions.mjs')
);

const dotVersion = version.replace('-', '.');
const phpVersion = phpVersions.find((v) => v.version === dotVersion);

if (!phpVersion) {
	console.error(
		`Error: PHP version "${dotVersion}" not found in supported-php-versions.mjs`
	);
	process.exit(1);
}

const { lastRelease } = phpVersion;

const sourceDir = join(
	repoRoot,
	`packages/php-wasm/${platform}-builds/${version}`
);
const distDir = join(
	repoRoot,
	`dist/packages/php-wasm/${platform}-binaries/${version}`
);

console.log(
	`Building @php-wasm-binaries/${platform}-${version} v${lastRelease}`
);
console.log(`  Source: ${sourceDir}`);
console.log(`  Dist:   ${distDir}`);

// Create dist directory.
mkdirSync(distDir, { recursive: true });

// Copy jspi/ and asyncify/ directories.
for (const variant of ['jspi', 'asyncify']) {
	const src = join(sourceDir, variant);
	const dest = join(distDir, variant);
	console.log(`  Copying ${variant}/...`);
	cpSync(src, dest, { recursive: true });
}

// Generate package.json in dist.
const majorMinor = dotVersion.replace('.', '.');
const packageJson = {
	name: `@php-wasm-binaries/${platform}-${version}`,
	version: lastRelease,
	description: `PHP ${majorMinor} WebAssembly binary files for ${platform} (JSPI and Asyncify variants)`,
	publishConfig: {
		access: 'public',
		registry: 'https://npm.pkg.github.com',
	},
};

writeFileSync(
	join(distDir, 'package.json'),
	JSON.stringify(packageJson, null, '\t') + '\n'
);

console.log(`Done. Dist package.json written to ${distDir}/package.json`);
