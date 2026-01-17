const { SupportedPHPVersions } = require('@php-wasm/universal');
const { getPHPLoaderModule } = require('@php-wasm/node');
const { runCLI } = require('@wp-playground/cli');
const path = require('path');

SupportedPHPVersions.forEach((phpVersion: string) => {
	describe(`PHP ${phpVersion}`, () => {
		it('WordPress should load', async () => {
			const cli = await runCLI({
				command: 'server',
				php: phpVersion as any,
				port: 0, // Use random available port to avoid conflicts
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

	/**
	 * Very the built Playground packages ship worker files that have stable names.
	 * This is important for downstream consumers that may need to statically declare
	 * a separate entrypoint for each worker file. Including a hash in the filename,
	 * e.g. `worker-thread-v1-af872f.cjs`, would break their build config on every
	 * @wp-playground/cli release.
	 */
	it('Should include required worker thread files in CLI package', () => {
		const requiredFiles = ['worker-thread-v1.cjs', 'worker-thread-v2.cjs'];

		for (const file of requiredFiles) {
			// Try to resolve the file from the CLI package
			const resolvedBasePath = require.resolve(`@wp-playground/cli`);
			const filePath = path.join(resolvedBasePath, file);
			expect(filePath).toBeTruthy();
		}
	});

	/**
	 * Jest struggles with dynamic imports in vm contexts. This test ensures that
	 * the error thrown is helpful and actionable.
	 *
	 * @see https://github.com/vercel/next.js/issues/41725
	 * @see https://github.com/WordPress/wordpress-playground/pull/3099 and the discussion.
	 */
	it('Should throw a helpful error when loading PHP loader module in vm context', async () => {
		await expect(getPHPLoaderModule('8.5')).rejects.toThrow(
			expect.objectContaining({
				message: expect.stringContaining('node:vm context'),
			})
		);

		try {
			await getPHPLoaderModule('8.5');
			fail('Expected getPHPLoaderModule to throw an error');
		} catch (error: any) {
			expect(error.message).toMatch(
				/switching to a different test runner such as vitest/
			);
		}
	});
});
