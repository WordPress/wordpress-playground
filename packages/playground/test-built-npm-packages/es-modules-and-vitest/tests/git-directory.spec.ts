import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

describe(`PHP ${phpVersion}`, { concurrency: 1 }, () => {
	/**
	 * This broke at one point in the built package. It bundler tried really
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
								ref: 'HEAD',
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
