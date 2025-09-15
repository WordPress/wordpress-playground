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

	it('Should include required worker thread files in CLI package', async () => {
		// Verify that the Playground CLI package ships with the required worker thread files
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
});
