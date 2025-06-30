import type { SupportedPHPVersion } from '@php-wasm/universal';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { runCLI } from '@wp-playground/cli';
import { printDebugDetails } from '@php-wasm/util';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const phpVersion = process.env.PHP_VERSION as SupportedPHPVersion;
if (!phpVersion) {
	throw new Error('PHP_VERSION is not set');
}
if (!SupportedPHPVersions.includes(phpVersion)) {
	throw new Error(`PHP_VERSION '${phpVersion}' is not supported`);
}

describe(`PHP ${phpVersion}`, () => {
	it('Should load WordPress', { timeout: 10000 }, async () => {
		let cli;
		try {
			cli = await runCLI({
				command: 'server',
				php: phpVersion as any,
				blueprint: {
					siteOptions: {
						blogname: 'My WordPress Website',
					},
				},
				quiet: true,
			});
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
		} catch (e) {
			await printDebugDetails(e, (e as any)?.streamedResponse);
			throw e;
		} finally {
			if (cli) {
				await cli[Symbol.asyncDispose]();
			}
		}
	});
});
