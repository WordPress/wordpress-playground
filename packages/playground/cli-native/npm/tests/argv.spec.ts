import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import compatibility from '../../compatibility.json' with { type: 'json' };

const mocks = vi.hoisted(() => ({
	parseNativeCLIArgs: vi.fn(),
	runNativeCLI: vi.fn(),
}));

vi.mock('../src/process.js', () => ({
	parseNativeCLIArgs: mocks.parseNativeCLIArgs,
	runNativeCLI: mocks.runNativeCLI,
}));

import { parseOptionsAndRunCLI } from '../src/api.js';

beforeEach(() => {
	mocks.parseNativeCLIArgs.mockReset().mockResolvedValue({
		status: 'valid',
		command: 'run-blueprint',
		port: null,
		siteUrl: null,
	});
	mocks.runNativeCLI.mockReset().mockResolvedValue({ code: 0, signal: null });
});

afterEach(() => vi.restoreAllMocks());

describe('argv compatibility preflight', () => {
	it('rejects php and every unsupported CLI option before acquisition', async () => {
		await expect(parseOptionsAndRunCLI(['php'])).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			message: compatibility.commands.find(({ name }) => name === 'php')
				?.diagnostic,
		});
		for (const option of compatibility.cliOptions.filter(
			({ status }) => status === 'unsupported-by-design'
		)) {
			for (const spelling of [option.name, `${option.name}=enabled`]) {
				await expect(
					parseOptionsAndRunCLI(['server', spelling])
				).rejects.toMatchObject({
					name: 'NativeCLIError',
					code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
					message: expect.stringContaining(
						option.errorContains ?? option.name
					),
				});
			}
		}
		for (const [spelling, diagnostic] of [
			['--no-experimentalTrace=value', 'request tracing'],
			['--no-internalCookieStore', 'Node cookie-store mediation'],
			[
				'--no-blueprintMay-readAdjacent-files',
				'blueprint-may-read-adjacent-files',
			],
			['--no-autoMount', 'mixed yargs alias --no-autoMount'],
		] as const)
			await expect(
				parseOptionsAndRunCLI(['server', spelling])
			).rejects.toMatchObject({
				code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
				message: expect.stringContaining(diagnostic),
			});
		expect(mocks.runNativeCLI).not.toHaveBeenCalled();
	});

	it('does not reinterpret --noFoo as a negated --foo option', async () => {
		mocks.parseNativeCLIArgs.mockResolvedValueOnce({
			status: 'invalid',
			exitCode: 1,
			message: 'Unknown option --noFoo',
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(
			parseOptionsAndRunCLI(['server', '--noFoo'])
		).resolves.toEqual({ exitCode: 1 });
		expect(mocks.parseNativeCLIArgs).toHaveBeenCalledWith(
			['server', '--noFoo'],
			{ cwd: process.cwd() }
		);
		expect(mocks.runNativeCLI).not.toHaveBeenCalled();
	});

	it('returns Rust parser validation as a structured exit', async () => {
		mocks.parseNativeCLIArgs.mockResolvedValueOnce({
			status: 'invalid',
			exitCode: 1,
			message: 'Invalid --workers value',
		});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(
			parseOptionsAndRunCLI(['server', '--workers=invalid'])
		).resolves.toEqual({ exitCode: 1 });
		expect(error).toHaveBeenCalledWith('Invalid --workers value');
		expect(mocks.runNativeCLI).not.toHaveBeenCalled();
	});

	it('keeps runtime install valid', async () => {
		await expect(
			parseOptionsAndRunCLI(['runtime', 'install'])
		).resolves.toEqual({ exitCode: 0 });
		expect(mocks.runNativeCLI).toHaveBeenCalledWith({
			argv: ['runtime', 'install'],
			cwd: process.cwd(),
		});
		expect(mocks.parseNativeCLIArgs).not.toHaveBeenCalled();
	});

	it('snapshots descriptor-safe argv before the first await', async () => {
		const argv = ['run-blueprint', '--wp', 'latest'];
		const running = parseOptionsAndRunCLI(argv);
		argv[0] = 'php';
		argv.push('--experimental-trace');
		await expect(running).resolves.toEqual({ exitCode: 0 });
		expect(mocks.parseNativeCLIArgs).toHaveBeenCalledWith(
			['run-blueprint', '--wp', 'latest'],
			{ cwd: process.cwd() }
		);
		expect(mocks.runNativeCLI).toHaveBeenCalledWith({
			argv: ['run-blueprint', '--wp', 'latest'],
			cwd: process.cwd(),
		});
	});

	it('rejects malformed argv, commands, scopes, and delimiter bypasses', async () => {
		class ArgvSubclass extends Array<string> {}
		const sparse = new Array<string>(2);
		sparse[0] = 'server';
		const extra = ['server'];
		Object.defineProperty(extra, 'extra', { value: true });
		const symbol = ['server'];
		Object.defineProperty(symbol, Symbol('extra'), { value: true });
		const accessor = ['server', '--wp'];
		Object.defineProperty(accessor, '1', { get: () => '--wp' });
		for (const argv of [
			new ArgvSubclass('server'),
			sparse,
			extra,
			symbol,
			accessor,
			['server\0'],
		])
			await expect(
				parseOptionsAndRunCLI(argv as string[])
			).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
			});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const argv of [
			[],
			['unknown'],
			['runtime'],
			['runtime', 'install', 'extra'],
			['start', '--workers=2'],
		])
			await expect(parseOptionsAndRunCLI(argv)).resolves.toEqual({
				exitCode: 1,
			});
		await expect(
			parseOptionsAndRunCLI(['server', '--', '--experimental-trace'])
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			message: expect.stringContaining('request tracing'),
		});
		expect(mocks.runNativeCLI).not.toHaveBeenCalled();
	});

	it('returns structured exits for help and version forms', async () => {
		for (const argv of [
			['--help'],
			['-h'],
			['--version'],
			['-V'],
			['server', '--help'],
			['runtime', '--help'],
		])
			await expect(parseOptionsAndRunCLI(argv)).resolves.toEqual({
				exitCode: 0,
			});
		expect(mocks.runNativeCLI).toHaveBeenCalledTimes(6);
		expect(mocks.parseNativeCLIArgs).not.toHaveBeenCalled();
	});

	it('keeps genuine one-shot failures and signals exceptional', async () => {
		mocks.runNativeCLI.mockResolvedValueOnce({ code: 9, signal: null });
		await expect(
			parseOptionsAndRunCLI(['run-blueprint'])
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_EXIT',
			details: { exitCode: 9 },
		});
		mocks.runNativeCLI.mockResolvedValueOnce({
			code: null,
			signal: 'SIGTERM',
		});
		await expect(
			parseOptionsAndRunCLI(['run-blueprint'])
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_EXIT',
			details: { signal: 'SIGTERM' },
		});
	});
});
