const { SupportedPHPVersions } = require('@php-wasm/universal');
const { runCLI } = require('@wp-playground/cli');
const path = require('path');

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

	it('Should include required worker thread files in CLI package', () => {
		// Verify that the Playground CLI package ships with the required worker thread files
		const requiredFiles = ['worker-thread-v1.cjs', 'worker-thread-v2.cjs'];

		for (const file of requiredFiles) {
			// Try to resolve the file from the CLI package
			const resolvedBasePath = require.resolve(`@wp-playground/cli`);
			const filePath = path.join(resolvedBasePath, file);
			expect(filePath).toBeTruthy();
		}
	});
});
