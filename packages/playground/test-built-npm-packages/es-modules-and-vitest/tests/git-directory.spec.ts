import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runCLI } from '@wp-playground/cli';

const WASMTIME_PHP_VERSION = '8.2';
const phpVersion = process.env.PHP_VERSION;
if (phpVersion !== WASMTIME_PHP_VERSION) {
	throw new Error(
		`PHP_VERSION must be '${WASMTIME_PHP_VERSION}' for the Wasmtime CLI, got '${phpVersion ?? ''}'`
	);
}

describe(`PHP ${phpVersion}`, { concurrency: 1 }, () => {
	/**
	 * This broke at one point in the built package. The bundler tried really
	 * hard to create an isomorphic package, but ended shipping the following
	 * code which always returned false:
	 *
	 *    var z = {};
	 *    if (i.object instanceof z.Buffer)
	 *
	 * This test confirms the git client still works after bundling.
	 */
	it(
		'Should support git:directory resources',
		{ timeout: 60000 },
		async () => {
			const cli = await runCLI({
				command: 'server',
				php: phpVersion,
				port: 0, // Use random available port to avoid conflicts
				quiet: true,
				blueprint: {
					steps: [
						{
							step: 'installPlugin',
							options: {
								activate: true,
								targetFolderName: 'blocky-formats',
							},
							pluginData: {
								resource: 'git:directory',
								url: 'https://github.com/dmsnell/blocky-formats.git',
								ref: '372b8820fff1d49f24f865a6178d059a53e5df5b',
								path: '/',
							},
						},
					],
				},
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
		}
	);
});
