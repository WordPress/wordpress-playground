const { SupportedPHPVersions } = require('@php-wasm/universal');
const { runCLI } = require('@wp-playground/cli');

SupportedPHPVersions.forEach((phpVersion: string) => {
	describe(`PHP ${phpVersion}`, () => {
		it('WordPress should load', async () => {
			let cli: any;
			try {
				cli = await runCLI({
					command: 'server',
					php: phpVersion as any,
					exitOnPrimaryWorkerCrash: false,
				});
				// Make a request
				const response = await cli.playground.request({
					method: 'GET',
					url: '/',
				});

				// Verify response
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain('My WordPress Website');
			} catch (e) {
				console.error(e);
				throw e;
			} finally {
				await cli[Symbol.asyncDispose]();
			}
		}, 10000);
	});
});
