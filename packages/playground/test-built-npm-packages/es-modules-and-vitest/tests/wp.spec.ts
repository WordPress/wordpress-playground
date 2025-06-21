import { describe, it, expect } from 'vitest';
import { runCLI } from '@wp-playground/cli';
import { SupportedPHPVersions } from '@php-wasm/universal';

SupportedPHPVersions.forEach((phpVersion: string) => {
	describe(`PHP ${phpVersion}`, () => {
		it('Should load WordPress', async () => {
			await using cli = await runCLI({
				command: 'server',
				php: phpVersion as any,
			});
			const response = await cli.playground.request({
				method: 'GET',
				url: '/',
			});

			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('My WordPress Website');
		}, 10000);
	});
});
