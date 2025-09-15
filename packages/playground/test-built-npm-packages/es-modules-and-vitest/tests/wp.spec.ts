import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runCLI } from '@wp-playground/cli';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { SupportedPHPVersions } from '@php-wasm/universal';

const phpVersion = process.env.PHP_VERSION as SupportedPHPVersion;
if (!phpVersion) {
	throw new Error('PHP_VERSION is not set');
}
if (!SupportedPHPVersions.includes(phpVersion)) {
	throw new Error(`PHP_VERSION '${phpVersion}' is not supported`);
}

describe(`PHP ${phpVersion}`, () => {
	it('Should load WordPress', { timeout: 30000 }, async () => {
		const cli = await runCLI({
			command: 'server',
			php: phpVersion,
			quiet: true,
		});
		try {
			const response = await cli.playground.request({
				method: 'GET',
				url: '/',
			});
			assert.equal(response.httpStatusCode, 200);
			const expectedText = 'My WordPress Website';
			assert.ok(
				response.text.includes(expectedText),
				`Response text does not include '${expectedText}'`
			);
		} finally {
			if (cli) {
				await cli[Symbol.asyncDispose]();
			}
		}
	});

	/**
	 * Very the built Playground packages ship worker files that have stable names.
	 * This is important for downstream consumers that may need to statically declare
	 * a separate entrypoint for each worker file. Including a hash in the filename,
	 * e.g. `worker-thread-v1-af872f.cjs`, would break their build config on every
	 * @wp-playground/cli release.
	 */
	it('Should include required worker thread files in CLI package', async () => {
		const requiredFiles = ['worker-thread-v1.js', 'worker-thread-v2.js'];

		for (const file of requiredFiles) {
			try {
				// Resolve the file from the CLI package without importing it
				const baseUrl = import.meta.resolve(`@wp-playground/cli`);
				const url = new URL(file, baseUrl);
				const path = fileURLToPath(url);
				// Verify that the resolved file actually exists on disk
				await access(path);
			} catch (error) {
				assert.fail(
					`Required file ${file} is missing from CLI package: ${error.message}`
				);
			}
		}
	});

	it('Should have a new URL("./worker-thread-v1.js", import.meta.url) string', async () => {
		const staticStrings = {
			'worker-thread-v1.js':
				'new URL("./worker-thread-v1.js", import.meta.url)',
			'worker-thread-v2.js':
				'new URL("./worker-thread-v2.js", import.meta.url)',
		};
		for (const file of Object.keys(staticStrings)) {
			try {
				// Resolve the file from the CLI package without importing it
				const baseUrl = import.meta.resolve(`@wp-playground/cli`);
				const url = new URL(file, baseUrl);
				const path = fileURLToPath(url);
				assert.ok(
					staticStrings[file].includes(path),
					`Static string for ${file} is not correct`
				);
			} catch (error) {
				assert.fail(
					`Static string for ${file} is not correct: ${error.message}`
				);
			}
		}
	});
});
