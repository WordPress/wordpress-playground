import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { joinPaths } from '@php-wasm/util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { phpVersions } from '../../../supported-php-versions.mjs';

const asyncModes = ['jspi', 'asyncify'];

/**
 * A bare `.wasm` import relies on bundler-specific file-loader semantics.
 * Vite 8.1+ reads it as a WASM ESM Integration module and fails to resolve
 * Emscripten's `env` import, so every committed loader must resolve the
 * `.wasm` file with `new URL(..., import.meta.url)` instead.
 */
describe.each(asyncModes)('%s loaders', (asyncMode) => {
	it.each(phpVersions)(
		'php $version resolves the .wasm file with new URL()',
		({ version, loaderFilename, wasmFilename, lastRelease }) => {
			const loaderPath = joinPaths(
				import.meta.dirname,
				'../../../web-builds',
				version.replace('.', '-'),
				asyncMode,
				loaderFilename
			);
			const releaseDirectory = lastRelease.replaceAll('.', '_');

			expect(readFirstStatement(loaderPath)).toBe(
				`const dependencyFilename = new URL('./${releaseDirectory}/${wasmFilename}', import.meta.url).href;`
			);
		}
	);
});

function readFirstStatement(loaderPath: string) {
	const contents = fs.readFileSync(loaderPath, 'utf8');

	return contents
		.slice(0, contents.indexOf(';') + 1)
		.replace(/\s*\n\s*/g, '');
}
