import { beforeEach, describe, expect, it, vi } from 'vitest';
import compatibility from '../../compatibility.json' with { type: 'json' };

const mocks = vi.hoisted(() => ({
	runNativeCLI: vi.fn(),
}));

vi.mock('../src/process.js', () => ({
	runNativeCLI: mocks.runNativeCLI,
}));

import { parseOptionsAndRunCLI } from '../src/api.js';

beforeEach(() => {
	mocks.runNativeCLI.mockReset().mockResolvedValue({ code: 0, signal: null });
});

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
		await expect(
			parseOptionsAndRunCLI(['server', '--noFoo'])
		).resolves.toBeUndefined();
		expect(mocks.runNativeCLI).toHaveBeenCalledWith({
			argv: ['server', '--noFoo'],
		});
	});

	it('keeps runtime install valid', async () => {
		await expect(
			parseOptionsAndRunCLI(['runtime', 'install'])
		).resolves.toBeUndefined();
		expect(mocks.runNativeCLI).toHaveBeenCalledWith({
			argv: ['runtime', 'install'],
		});
	});

	it('snapshots descriptor-safe argv before the first await', async () => {
		const argv = ['server', '--wp', 'latest'];
		const running = parseOptionsAndRunCLI(argv);
		argv[0] = 'php';
		argv.push('--experimental-trace');
		await running;
		expect(mocks.runNativeCLI).toHaveBeenCalledWith({
			argv: ['server', '--wp', 'latest'],
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
			['unknown'],
			['runtime'],
			['runtime', 'install', 'extra'],
			['start', '--workers=2'],
		])
			await expect(
				parseOptionsAndRunCLI(argv as string[])
			).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
			});
		await expect(
			parseOptionsAndRunCLI(['server', '--', '--experimental-trace'])
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			message: expect.stringContaining('request tracing'),
		});
		expect(mocks.runNativeCLI).not.toHaveBeenCalled();
	});

	it('accepts only the intended global help and version forms', async () => {
		for (const argv of [
			[],
			['--help'],
			['-h'],
			['--version'],
			['-V'],
			['server', '--help'],
			['runtime', '--help'],
		])
			await expect(parseOptionsAndRunCLI(argv)).resolves.toBeUndefined();
		expect(mocks.runNativeCLI).toHaveBeenCalledTimes(7);
	});
});
