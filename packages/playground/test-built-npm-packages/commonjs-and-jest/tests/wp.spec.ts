const { SupportedPHPVersions } = require('@php-wasm/universal');
const { runCLI } = require('@wp-playground/cli');

describe('WordPress Playground Tests', () => {
	test('WordPress should load', async () => {
		// Use one PHP version for testing
		const phpVersion = SupportedPHPVersions[0];

		// Create a server with the selected PHP version
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
	});
});
