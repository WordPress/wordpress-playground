#!/usr/bin/env node
/**
 * This script generates version-specific PHP-WASM packages.
 *
 * Each PHP version (8.5, 8.4, etc.) gets its own package for both node and web platforms.
 * This allows users to install only the PHP versions they need, reducing package size.
 *
 * Each version package includes:
 * - PHP WASM binary (JSPI and Asyncify variants)
 * - Extensions for that PHP version (intl, xdebug for node)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { phpVersions } from '../../packages/php-wasm/supported-php-versions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const packagesDir = path.join(rootDir, 'packages/php-wasm');

const platforms = ['node', 'web'];

function getVersionDirName(lastRelease) {
	return lastRelease.replace(/\./g, '_');
}

function getMajorMinorDir(version) {
	return version.replace('.', '_');
}

function generatePackageJson(platform, version, lastRelease) {
	const packageName = `@php-wasm/${platform}-${version}`;
	return {
		name: packageName,
		version: '3.0.31',
		description: `PHP ${version} WebAssembly binaries for ${platform}`,
		repository: {
			type: 'git',
			url: 'https://github.com/WordPress/wordpress-playground',
		},
		homepage: 'https://developer.wordpress.org/playground',
		author: 'The WordPress contributors',
		contributors: [
			{
				name: 'Adam Zielinski',
				email: 'adam@adamziel.com',
				url: 'https://github.com/adamziel',
			},
		],
		exports: {
			'.': {
				import: './index.js',
				require: './index.cjs',
			},
			'./package.json': './package.json',
		},
		publishConfig: {
			access: 'public',
			directory: `../../../dist/packages/php-wasm/${platform}-${version}`,
		},
		type: 'module',
		main: './index.cjs',
		module: './index.js',
		types: 'index.d.ts',
		license: 'GPL-2.0-or-later',
		engines: {
			node: '>=20.18.3',
			npm: '>=10.1.0',
		},
	};
}

function generateProjectJson(platform, version) {
	const projectName = `php-wasm-${platform}-${version.replace('.', '-')}`;
	const packagePath = `packages/php-wasm/${platform}-${version}`;
	const distPath = `dist/packages/php-wasm/${platform}-${version}`;

	return {
		name: projectName,
		$schema: '../../../node_modules/nx/schemas/project-schema.json',
		sourceRoot: `${packagePath}/src`,
		projectType: 'library',
		implicitDependencies: ['php-wasm-compile'],
		targets: {
			build: {
				executor: 'nx:noop',
				dependsOn: ['build:copy-assets'],
			},
			'build:mkdir': {
				executor: 'nx:run-commands',
				options: {
					commands: [`mkdir -p ${distPath}`],
					parallel: false,
				},
			},
			'build:package-json': {
				executor: '@wp-playground/nx-extensions:package-json',
				options: {
					tsConfig: `${packagePath}/tsconfig.lib.json`,
					outputPath: distPath,
					buildTarget: `${projectName}:build:bundle:production`,
				},
				dependsOn: ['build:mkdir'],
			},
			'build:bundle': {
				executor: 'nx:run-commands',
				options: {
					command: `node ${packagePath}/build.js`,
					parallel: false,
				},
				dependsOn: ['build:mkdir'],
			},
			'build:copy-assets': {
				executor: 'nx:run-commands',
				options: {
					commands: [
						`cp -rf ${packagePath}/jspi ${distPath}/`,
						`cp -rf ${packagePath}/asyncify ${distPath}/`,
					],
					parallel: false,
				},
				dependsOn: ['build:package-json'],
			},
			publish: {
				executor: 'nx:run-commands',
				options: {
					command: `node tools/scripts/publish.mjs ${projectName} {args.ver} {args.tag}`,
					parallel: false,
				},
				dependsOn: ['build'],
			},
			// No lint target - these packages contain only generated code
		},
		tags: ['scope:php-binaries'],
	};
}

function generateTsConfigJson(platform, version) {
	return {
		extends: '../../../tsconfig.base.json',
		compilerOptions: {
			module: 'ESNext',
			moduleResolution: 'bundler',
			allowJs: true,
			checkJs: false,
		},
		files: [],
		include: [],
		references: [
			{
				path: './tsconfig.lib.json',
			},
		],
	};
}

function generateTsConfigLibJson(platform, version) {
	return {
		extends: './tsconfig.json',
		compilerOptions: {
			outDir: `../../../dist/packages/php-wasm/${platform}-${version}`,
			declaration: true,
			types: ['node'],
		},
		include: ['src/**/*.ts'],
		exclude: ['**/*.spec.ts', '**/*.test.ts'],
	};
}

function generateIndexTs(platform, version, loaderFilename) {
	const majorMinor = getMajorMinorDir(version);
	const hasXdebug = platform === 'node';

	let code = `import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/${loaderFilename}');
	} else {
		// @ts-ignore
		return await import('../asyncify/${loaderFilename}');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		// @ts-ignore
		return (await import('../jspi/extensions/intl/${majorMinor}/intl.so?url')).default;
	} else {
		// @ts-ignore
		return (await import('../asyncify/extensions/intl/${majorMinor}/intl.so?url')).default;
	}
}
`;

	if (hasXdebug) {
		code += `
export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		// @ts-ignore
		return (await import('../jspi/extensions/xdebug/${majorMinor}/xdebug.so?url')).default;
	} else {
		// @ts-ignore
		return (await import('../asyncify/extensions/xdebug/${majorMinor}/xdebug.so?url')).default;
	}
}
`;
	}

	code += `
export { jspi };
`;
	return code;
}

function generateBuildJs(platform, version, loaderFilename) {
	const majorMinor = getMajorMinorDir(version);
	const packagePath = `packages/php-wasm/${platform}-${version}`;
	const distPath = `dist/packages/php-wasm/${platform}-${version}`;

	return `import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const packagePath = '${packagePath}';
const distPath = '${distPath}';

try {
	fs.mkdirSync(distPath, { recursive: true });
} catch (e) {
	// Ignore
}

/**
 * Plugin to rewrite imports to work from the dist directory.
 * Dynamic imports need to be preserved as external and paths adjusted.
 */
const externalPathPlugin = {
	name: 'external-path',
	setup(build) {
		// Mark PHP loader files as external and rewrite their paths
		build.onResolve({ filter: /\\.\\.\\/(?:jspi|asyncify)\\/.*\\.js$/ }, (args) => {
			const newPath = args.path.replace('../', './');
			return { path: newPath, external: true };
		});
		// Mark extension .so files as external and rewrite paths
		build.onResolve({ filter: /\\.\\.\\/(?:jspi|asyncify)\\/extensions\\/.*\\.so\\?url$/ }, (args) => {
			const newPath = args.path.replace('../', './');
			return { path: newPath, external: true };
		});
	},
};

async function build() {
	// CommonJS build
	await esbuild.build({
		entryPoints: [\`\${packagePath}/src/index.ts\`],
		supported: { 'dynamic-import': false },
		outExtension: { '.js': '.cjs' },
		outdir: distPath,
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'direct-eval': 'silent',
			'commonjs-variable-in-esm': 'silent',
		},
		format: 'cjs',
		bundle: true,
		tsconfig: \`\${packagePath}/tsconfig.json\`,
		external: ['@php-wasm/*', 'wasm-feature-detect'],
		loader: { '.wasm': 'file', '.so': 'file' },
		plugins: [externalPathPlugin],
	});

	// ESM build
	await esbuild.build({
		entryPoints: [\`\${packagePath}/src/index.ts\`],
		banner: {
			js: \`import { createRequire as topLevelCreateRequire } from 'module';
const require = topLevelCreateRequire(import.meta.url);
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
\`,
		},
		outdir: distPath,
		platform: 'node',
		assetNames: '[name]',
		chunkNames: '[name]',
		logOverride: {
			'direct-eval': 'silent',
			'commonjs-variable-in-esm': 'silent',
		},
		packages: 'external',
		bundle: true,
		tsconfig: \`\${packagePath}/tsconfig.json\`,
		external: ['@php-wasm/*', 'wasm-feature-detect'],
		supported: { 'dynamic-import': true, 'top-level-await': true },
		format: 'esm',
		loader: { '.wasm': 'file', '.so': 'file' },
		plugins: [externalPathPlugin],
	});

	fs.copyFileSync(\`\${packagePath}/README.md\`, \`\${distPath}/README.md\`);
}
build();
`;
}

function generateReadme(platform, version) {
	const hasXdebug = platform === 'node';
	return `# @php-wasm/${platform}-${version}

PHP ${version} WebAssembly binaries for ${platform === 'node' ? 'Node.js' : 'the web'}.

This package contains:
- JSPI and Asyncify variants of PHP ${version} compiled to WebAssembly
- intl extension for PHP ${version}${hasXdebug ? '\n- xdebug extension for PHP ' + version : ''}

## Installation

\`\`\`bash
npm install @php-wasm/${platform}-${version}
\`\`\`

## Usage

\`\`\`typescript
import { getPHPLoaderModule, getIntlExtensionPath } from '@php-wasm/${platform}-${version}';

const loaderModule = await getPHPLoaderModule();
const intlPath = await getIntlExtensionPath();
\`\`\`

## Related Packages

- [@php-wasm/${platform}](https://www.npmjs.com/package/@php-wasm/${platform}) - Main package (requires version packages)
- [@php-wasm/universal](https://www.npmjs.com/package/@php-wasm/universal) - Universal PHP.wasm bindings

## License

GPL-2.0-or-later
`;
}

async function generatePackages() {
	for (const platform of platforms) {
		for (const { version, loaderFilename, lastRelease } of phpVersions) {
			const packageDir = path.join(packagesDir, `${platform}-${version}`);
			const srcDir = path.join(packageDir, 'src');
			const sourcePackageDir = path.join(packagesDir, platform);

			console.log(`Generating @php-wasm/${platform}-${version}...`);

			// Create directories
			fs.mkdirSync(srcDir, { recursive: true });

			// Generate files
			fs.writeFileSync(
				path.join(packageDir, 'package.json'),
				JSON.stringify(
					generatePackageJson(platform, version, lastRelease),
					null,
					'\t'
				) + '\n'
			);

			fs.writeFileSync(
				path.join(packageDir, 'project.json'),
				JSON.stringify(
					generateProjectJson(platform, version),
					null,
					'\t'
				) + '\n'
			);

			fs.writeFileSync(
				path.join(packageDir, 'tsconfig.json'),
				JSON.stringify(
					generateTsConfigJson(platform, version),
					null,
					'\t'
				) + '\n'
			);

			fs.writeFileSync(
				path.join(packageDir, 'tsconfig.lib.json'),
				JSON.stringify(
					generateTsConfigLibJson(platform, version),
					null,
					'\t'
				) + '\n'
			);

			fs.writeFileSync(
				path.join(srcDir, 'index.ts'),
				generateIndexTs(platform, version, loaderFilename)
			);

			fs.writeFileSync(
				path.join(packageDir, 'build.js'),
				generateBuildJs(platform, version, loaderFilename)
			);

			fs.writeFileSync(
				path.join(packageDir, 'README.md'),
				generateReadme(platform, version)
			);

			// Copy WASM files and extensions
			const versionDir = getVersionDirName(lastRelease);
			const majorMinorDir = getMajorMinorDir(version);

			if (platform === 'node') {
				const jspiSrc = path.join(sourcePackageDir, 'jspi');
				const asyncifySrc = path.join(sourcePackageDir, 'asyncify');
				const jspiDst = path.join(packageDir, 'jspi');
				const asyncifyDst = path.join(packageDir, 'asyncify');

				// Create directories
				fs.mkdirSync(path.join(jspiDst, versionDir), {
					recursive: true,
				});
				fs.mkdirSync(path.join(asyncifyDst, versionDir), {
					recursive: true,
				});
				fs.mkdirSync(
					path.join(jspiDst, 'extensions/intl', majorMinorDir),
					{ recursive: true }
				);
				fs.mkdirSync(
					path.join(asyncifyDst, 'extensions/intl', majorMinorDir),
					{ recursive: true }
				);
				fs.mkdirSync(
					path.join(jspiDst, 'extensions/xdebug', majorMinorDir),
					{ recursive: true }
				);
				fs.mkdirSync(
					path.join(asyncifyDst, 'extensions/xdebug', majorMinorDir),
					{ recursive: true }
				);

				// Copy PHP loader and WASM
				const jspiLoaderSrc = path.join(jspiSrc, loaderFilename);
				const asyncifyLoaderSrc = path.join(
					asyncifySrc,
					loaderFilename
				);

				if (fs.existsSync(jspiLoaderSrc)) {
					fs.copyFileSync(
						jspiLoaderSrc,
						path.join(jspiDst, loaderFilename)
					);
				}
				if (fs.existsSync(asyncifyLoaderSrc)) {
					fs.copyFileSync(
						asyncifyLoaderSrc,
						path.join(asyncifyDst, loaderFilename)
					);
				}

				// Copy WASM directory
				const jspiWasmSrc = path.join(jspiSrc, versionDir);
				const asyncifyWasmSrc = path.join(asyncifySrc, versionDir);

				if (fs.existsSync(jspiWasmSrc)) {
					fs.cpSync(jspiWasmSrc, path.join(jspiDst, versionDir), {
						recursive: true,
					});
				}
				if (fs.existsSync(asyncifyWasmSrc)) {
					fs.cpSync(
						asyncifyWasmSrc,
						path.join(asyncifyDst, versionDir),
						{ recursive: true }
					);
				}

				// Copy intl extension
				const jspiIntlSrc = path.join(
					jspiSrc,
					'extensions/intl',
					majorMinorDir
				);
				const asyncifyIntlSrc = path.join(
					asyncifySrc,
					'extensions/intl',
					majorMinorDir
				);

				if (fs.existsSync(jspiIntlSrc)) {
					fs.cpSync(
						jspiIntlSrc,
						path.join(jspiDst, 'extensions/intl', majorMinorDir),
						{ recursive: true }
					);
				}
				if (fs.existsSync(asyncifyIntlSrc)) {
					fs.cpSync(
						asyncifyIntlSrc,
						path.join(
							asyncifyDst,
							'extensions/intl',
							majorMinorDir
						),
						{ recursive: true }
					);
				}

				// Copy xdebug extension
				const jspiXdebugSrc = path.join(
					jspiSrc,
					'extensions/xdebug',
					majorMinorDir
				);
				const asyncifyXdebugSrc = path.join(
					asyncifySrc,
					'extensions/xdebug',
					majorMinorDir
				);

				if (fs.existsSync(jspiXdebugSrc)) {
					fs.cpSync(
						jspiXdebugSrc,
						path.join(jspiDst, 'extensions/xdebug', majorMinorDir),
						{ recursive: true }
					);
				}
				if (fs.existsSync(asyncifyXdebugSrc)) {
					fs.cpSync(
						asyncifyXdebugSrc,
						path.join(
							asyncifyDst,
							'extensions/xdebug',
							majorMinorDir
						),
						{ recursive: true }
					);
				}
			} else {
				// For web platform
				const jspiSrc = path.join(sourcePackageDir, 'public/php/jspi');
				const asyncifySrc = path.join(
					sourcePackageDir,
					'public/php/asyncify'
				);
				const jspiDst = path.join(packageDir, 'jspi');
				const asyncifyDst = path.join(packageDir, 'asyncify');

				// Create directories
				fs.mkdirSync(path.join(jspiDst, versionDir), {
					recursive: true,
				});
				fs.mkdirSync(path.join(asyncifyDst, versionDir), {
					recursive: true,
				});
				fs.mkdirSync(
					path.join(jspiDst, 'extensions/intl', majorMinorDir),
					{ recursive: true }
				);
				fs.mkdirSync(
					path.join(asyncifyDst, 'extensions/intl', majorMinorDir),
					{ recursive: true }
				);

				// Copy PHP loader and WASM
				const jspiLoaderSrc = path.join(jspiSrc, loaderFilename);
				const asyncifyLoaderSrc = path.join(
					asyncifySrc,
					loaderFilename
				);

				if (fs.existsSync(jspiLoaderSrc)) {
					fs.copyFileSync(
						jspiLoaderSrc,
						path.join(jspiDst, loaderFilename)
					);
				}
				if (fs.existsSync(asyncifyLoaderSrc)) {
					fs.copyFileSync(
						asyncifyLoaderSrc,
						path.join(asyncifyDst, loaderFilename)
					);
				}

				// Copy WASM directory
				const jspiWasmSrc = path.join(jspiSrc, versionDir);
				const asyncifyWasmSrc = path.join(asyncifySrc, versionDir);

				if (fs.existsSync(jspiWasmSrc)) {
					fs.cpSync(jspiWasmSrc, path.join(jspiDst, versionDir), {
						recursive: true,
					});
				}
				if (fs.existsSync(asyncifyWasmSrc)) {
					fs.cpSync(
						asyncifyWasmSrc,
						path.join(asyncifyDst, versionDir),
						{ recursive: true }
					);
				}

				// Copy intl extension
				const jspiIntlSrc = path.join(
					jspiSrc,
					'extensions/intl',
					majorMinorDir
				);
				const asyncifyIntlSrc = path.join(
					asyncifySrc,
					'extensions/intl',
					majorMinorDir
				);

				if (fs.existsSync(jspiIntlSrc)) {
					fs.cpSync(
						jspiIntlSrc,
						path.join(jspiDst, 'extensions/intl', majorMinorDir),
						{ recursive: true }
					);
				}
				if (fs.existsSync(asyncifyIntlSrc)) {
					fs.cpSync(
						asyncifyIntlSrc,
						path.join(
							asyncifyDst,
							'extensions/intl',
							majorMinorDir
						),
						{ recursive: true }
					);
				}
			}
		}
	}

	console.log('Done generating version-specific packages!');
}

generatePackages().catch(console.error);
