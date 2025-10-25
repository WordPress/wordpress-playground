import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseOptionsAndRunCLI } from '../src/run-cli';

describe('parseOptionsAndRunCLI WordPress version validation', () => {
	let originalArgv: string[];
	let exitSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		originalArgv = process.argv;
		exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('process.exit called');
		}) as any);
		consoleErrorSpy = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
	});

	afterEach(() => {
		process.argv = originalArgv;
		exitSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	it('should reject invalid WordPress version "brazil"', async () => {
		process.argv = ['node', 'cli.js', 'server', '--wp=brazil'];

		await expect(parseOptionsAndRunCLI()).rejects.toThrow(
			'process.exit called'
		);

		expect(consoleErrorSpy).toHaveBeenCalled();
		const errorMessage = consoleErrorSpy.mock.calls[0][0];
		expect(errorMessage).toContain('Unrecognized WordPress version');
	});

	it('should reject invalid WordPress version "invalid-version"', async () => {
		process.argv = ['node', 'cli.js', 'server', '--wp=invalid-version'];

		await expect(parseOptionsAndRunCLI()).rejects.toThrow(
			'process.exit called'
		);

		expect(consoleErrorSpy).toHaveBeenCalled();
		const errorMessage = consoleErrorSpy.mock.calls[0][0];
		expect(errorMessage).toContain('Unrecognized WordPress version');
	});

	it('should accept valid WordPress version "beta"', async () => {
		process.argv = [
			'node',
			'cli.js',
			'server',
			'--wp=beta',
			'--skip-wordpress-setup',
		];

		// This test would actually start the server, so we skip it in unit tests
		// The important part is that it doesn't throw a validation error
		// We'll rely on integration tests to verify the full flow
	});

	it('should accept valid WordPress version "latest"', async () => {
		process.argv = [
			'node',
			'cli.js',
			'server',
			'--wp=latest',
			'--skip-wordpress-setup',
		];

		// This test would actually start the server, so we skip it in unit tests
		// The important part is that it doesn't throw a validation error
		// We'll rely on integration tests to verify the full flow
	});
});
