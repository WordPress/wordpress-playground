import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { joinPaths } from '@php-wasm/util';

/**
 * Bare `.wasm` imports rely on bundler-specific file-loader semantics.
 * Vite 8.1+ interprets them as WASM ESM Integration modules and fails to
 * resolve the Emscripten `env` import, so the loaders must resolve the
 * `.wasm` URL with `new URL(..., import.meta.url)` instead.
 */
describe('web-builds loader modules', () => {
	const webBuildsDir = joinPaths(
		import.meta.dirname,
		'..',
		'..',
		'..',
		'web-builds'
	);
	const loaderPaths = fs
		.readdirSync(webBuildsDir)
		.filter((entry) => /^\d+-\d+$/.test(entry))
		.flatMap((version) =>
			['jspi', 'asyncify'].map((mode) =>
				joinPaths(webBuildsDir, version, mode)
			)
		)
		.filter((modeDir) => fs.existsSync(modeDir))
		.flatMap((modeDir) =>
			fs
				.readdirSync(modeDir)
				.filter((entry) => /^php_\d+_\d+\.js$/.test(entry))
				.map((loader) => joinPaths(modeDir, loader))
		);

	it('finds the committed loaders', () => {
		expect(loaderPaths.length).toBeGreaterThan(0);
	});

	it.each(loaderPaths)(
		'%s resolves the .wasm file without a bare import',
		(loaderPath) => {
			const contents = fs.readFileSync(loaderPath, 'utf8');
			expect(contents).not.toMatch(/^import .* from ['"].*\.wasm['"]/m);
			expect(contents).toMatch(
				/const dependencyFilename = new URL\(\s*'\.\/[\w.-]+\/php_\d+_\d+\.wasm',\s*import\.meta\.url\s*\)\s*\.href/
			);
		}
	);
});
