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

describe(`PHP ${phpVersion}`, () => {
	it('Should load WordPress', { timeout: 30000 }, async () => {
		const cli = await runCLI({
			command: 'server',
			php: phpVersion,
			verbosity: 'quiet',
			exitOnPrimaryWorkerCrash: false,
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
});
