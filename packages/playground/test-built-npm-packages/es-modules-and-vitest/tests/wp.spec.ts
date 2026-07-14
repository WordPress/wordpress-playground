import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runCLI } from '@wp-playground/cli';

const WASMTIME_PHP_VERSION = '8.2';
const phpVersion = process.env.PHP_VERSION;
if (phpVersion !== WASMTIME_PHP_VERSION) {
	throw new Error(
		`PHP_VERSION must be '${WASMTIME_PHP_VERSION}' for the Wasmtime CLI, got '${phpVersion ?? ''}'`
	);
}

describe(`PHP ${phpVersion}`, { concurrency: 1 }, () => {
	it('Should load WordPress', { timeout: 60000 }, async () => {
		const cli = await runCLI({
			command: 'server',
			php: phpVersion,
			port: 0, // Use random available port to avoid conflicts
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
	 * Verify the built Playground packages ship worker files that have stable names.
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
			} catch (error: any) {
				assert.fail(
					`Required file ${file} is missing from CLI package: ${error?.message}`
				);
			}
		}
	});

	/**
	 * Verify the workers are loaded in a way that can be statically analyzed by
	 * downstream bundlers. Without this, bundling an app relying on Playground CLI
	 * is challenging as the consumer must handle detecting and chunking workers and
	 * also rewrite their target URL.
	 */
	it('Should load workers using a new URL("./worker-thread-v1.js", import.meta.url) string', async () => {
		// @TODO: Also verify this is wrapped in a new Worker() call.
		const staticStrings = {
			'worker-thread-v1.js':
				'new URL("./worker-thread-v1.js", import.meta.url)',
			'worker-thread-v2.js':
				'new URL("./worker-thread-v2.js", import.meta.url)',
		};
		for (const file of Object.keys(
			staticStrings
		) as (keyof typeof staticStrings)[]) {
			try {
				// Resolve the file from the CLI package without importing it
				const baseUrl = import.meta.resolve(`@wp-playground/cli`);
				const url = new URL(file, baseUrl);
				const moduleDir = dirname(fileURLToPath(url));
				const runCliModuleNames = (await readdir(moduleDir)).filter(
					(name) => /^run-cli-[^.]+\.js$/.test(name)
				);
				assert.equal(
					runCliModuleNames.length,
					1,
					`Only one run-cli .js file should be found in ${moduleDir}`
				);
				const runCliPath = join(moduleDir, runCliModuleNames[0]);
				const runCliModuleText = await readFile(runCliPath, 'utf8');
				assert.ok(
					runCliModuleText.includes(staticStrings[file]),
					`Workers are not loaded in a statically analyzable way for ${file}`
				);
			} catch (error: any) {
				assert.fail(
					`Workers are not loaded in a statically analyzable way for ${file}: ${error?.message}`
				);
			}
		}
	});
});
