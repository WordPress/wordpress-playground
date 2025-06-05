const { SupportedPHPVersions } = require('@php-wasm/universal');
const { runCLI } = require('@wp-playground/cli');

SupportedPHPVersions.forEach((phpVersion: string) => {
	describe(`PHP ${phpVersion}`, () => {
		it('WordPress should load', async () => {
			const cli = await runCLI({
				command: 'server',
				php: phpVersion as any,
			});
			const server = cli.server;
			const requestHandler = cli.requestHandler;
			const php = await requestHandler.getPrimaryPhp();

			try {
				// Make a request
				const response = await requestHandler.request({
					method: 'GET',
					url: '/',
				});

				// Verify response
				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain('My WordPress Website');
			} finally {
				await php.exit();
				await server.close();
			}
		}, 10000);
	});
});
