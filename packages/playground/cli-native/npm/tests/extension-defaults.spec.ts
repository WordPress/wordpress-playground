import { describe, expect, it } from 'vitest';
import {
	defaultNetworkExtensionsInArgs,
	defaultNetworkExtensionsInArgv,
	defaultNetworkExtensionsForExecutable,
	executableShouldDefaultNetworkExtensions,
	type ExecutableJspiRuntime,
} from '../src/extension-defaults.js';
import { assertSupportedArgv } from '../src/compatibility.js';

const node22WithoutJspi: ExecutableJspiRuntime = {
	hasJspi: false,
	noRespawn: false,
	isBun: false,
	isDeno: false,
	execArgv: [],
	nodeVersion: '22.20.0',
};

describe('network extension defaults', () => {
	it('defaults omitted values independently without overriding explicit values', () => {
		expect(
			defaultNetworkExtensionsInArgs(
				{ command: 'server', redis: false },
				true
			)
		).toEqual({ command: 'server', redis: false, memcached: true });
		expect(
			defaultNetworkExtensionsInArgs(
				{ command: 'server', memcached: false },
				true
			)
		).toEqual({ command: 'server', redis: true, memcached: false });
		expect(
			defaultNetworkExtensionsInArgv(
				['run-blueprint', '--redis', '--no-memcached'],
				true
			)
		).toEqual(['run-blueprint', '--redis', '--no-memcached']);
		expect(
			defaultNetworkExtensionsInArgv(['start', '--no-redis'], true)
		).toEqual(['start', '--no-redis', '--memcached']);
		expect(
			defaultNetworkExtensionsInArgv(['server', '--redis=true'], true)
		).toEqual(['server', '--redis=true', '--memcached']);
	});

	it('only applies to commands that can select the bundled extensions', () => {
		expect(
			defaultNetworkExtensionsInArgs({ command: 'runtime' }, true)
		).toEqual({ command: 'runtime' });
		expect(
			defaultNetworkExtensionsInArgv(['runtime', 'install'], true)
		).toEqual(['runtime', 'install']);
		expect(defaultNetworkExtensionsInArgv(['server'], false)).toEqual([
			'server',
		]);
		expect(
			defaultNetworkExtensionsInArgv(['server', '--help'], true)
		).toEqual(['server', '--help']);
	});

	it('accepts explicit Redis and Memcached selection on start', () => {
		expect(
			assertSupportedArgv(['start', '--redis', '--no-memcached'])
		).toEqual(['start', '--redis', '--no-memcached']);
	});

	it('mirrors a successful upstream Node JSPI respawn for the executable', () => {
		expect(
			executableShouldDefaultNetworkExtensions({
				...node22WithoutJspi,
				hasJspi: true,
				noRespawn: true,
				isBun: true,
				execArgv: ['--experimental-wasm-jspi'],
			})
		).toBe(true);
		expect(
			executableShouldDefaultNetworkExtensions({
				...node22WithoutJspi,
				nodeVersion: '23.0.0',
			})
		).toBe(true);
		expect(
			defaultNetworkExtensionsForExecutable(['start', '--no-redis'], {
				...node22WithoutJspi,
				nodeVersion: '24.0.0',
			})
		).toEqual(['start', '--no-redis', '--memcached']);
	});

	it.each([
		['Node 22', {}],
		['the respawn opt-out', { noRespawn: true, nodeVersion: '24.0.0' }],
		['Bun', { isBun: true, nodeVersion: '24.0.0' }],
		['Deno', { isDeno: true, nodeVersion: '24.0.0' }],
		[
			'an already-present but ineffective flag',
			{
				execArgv: ['--experimental-wasm-jspi'],
				nodeVersion: '24.0.0',
			},
		],
	] as const)('does not emulate a respawn for %s', (_name, overrides) => {
		expect(
			executableShouldDefaultNetworkExtensions({
				...node22WithoutJspi,
				...overrides,
			})
		).toBe(false);
	});
});
