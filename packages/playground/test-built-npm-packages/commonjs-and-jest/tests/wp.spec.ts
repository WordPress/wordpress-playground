const { SupportedPHPVersions } = require('@php-wasm/universal');
const { runCLI } = require('@wp-playground/cli');

// Exclude PHP 7.2 – it often times out on CI.
SupportedPHPVersions.filter(
	(phpVersion: string) => !['7.2', '7.3'].includes(phpVersion)
).forEach((phpVersion: string) => {
	describe(`PHP ${phpVersion}`, () => {
		it('WordPress should load', async () => {
			const cli = await runCLI({
				command: 'server',
				php: phpVersion as any,
				exitOnPrimaryWorkerCrash: false,
			});
			try {
				// Make a request
				const response = await cli.playground.request({
					method: 'GET',
					url: '/',
				});

				// Verify response
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain('My WordPress Website');
			} finally {
				await cli[Symbol.asyncDispose]();
			}
		}, 30000);
	});
});
