import { describe, it, expect } from 'vitest';
import { runCLI } from '@wp-playground/cli';
import { SupportedPHPVersions } from '@php-wasm/universal';

['8.0'].forEach((phpVersion) => {
	describe(`PHP ${phpVersion}`, () => {
		it('Should load WordPress', async () => {
			const cli = await runCLI({
				command: 'server',
				php: phpVersion as any,
			});
			const server = cli.server;
			const requestHandler = cli.requestHandler;
			const php = await requestHandler.getPrimaryPhp();

			try {
				const response = await requestHandler.request({
					method: 'GET',
					url: '/',
				});

				expect(response.httpStatusCode).toBe(200);
				expect(response.text).toContain('My WordPress Website');
			} finally {
				await php.exit();
				await server.close();
			}
		});
	});
});
