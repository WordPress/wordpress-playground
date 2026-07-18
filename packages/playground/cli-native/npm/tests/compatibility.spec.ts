import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicAPI from '../src/index.js';
import { runCLI } from '../src/api.js';
import type {
	NativePlaygroundRequest,
	NativePlaygroundRunOptions,
	NativePlaygroundWorker,
	RunCLIArgs,
} from '../src/api.js';
type Assert<T extends true> = T;
interface StablePHPRequestShape {
	url: string;
	method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'PUT' | 'DELETE';
	headers?: Record<string, string>;
	body?: string | Uint8Array | Record<string, string | Uint8Array | File>;
}
interface StablePHPRunShape {
	relativeUri?: string;
	scriptPath?: string;
	protocol?: string;
	method?: StablePHPRequestShape['method'];
	headers?: Record<string, string>;
	body?: string | Uint8Array;
	env?: Record<string, string>;
	$_SERVER?: Record<string, string>;
	code?: string;
}
type _RequestAcceptsUpstreamShape = Assert<
	StablePHPRequestShape extends NativePlaygroundRequest ? true : false
>;
type _RequestUsesUpstreamShape = Assert<
	NativePlaygroundRequest extends StablePHPRequestShape ? true : false
>;
type _RunAcceptsUpstreamShape = Assert<
	StablePHPRunShape extends NativePlaygroundRunOptions ? true : false
>;
type _RunUsesUpstreamShape = Assert<
	NativePlaygroundRunOptions extends StablePHPRunShape ? true : false
>;

const stableWorkerMethods = [
	'request',
	'requestStreamed',
	'run',
	'mkdir',
	'mkdirTree',
	'readFileAsText',
	'readFileAsBuffer',
	'writeFile',
	'unlink',
	'mv',
	'rmdir',
	'listFiles',
	'isDir',
	'isFile',
	'fileExists',
	'chdir',
	'cwd',
	'defineConstant',
	'pathToInternalUrl',
	'internalUrlToPath',
	'addEventListener',
	'removeEventListener',
] as const satisfies ReadonlyArray<keyof NativePlaygroundWorker>;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('compatibility schema v2', () => {
	it('has a unique, exhaustive inventory for each public surface', async () => {
		const inventory = JSON.parse(
			await readFile(join(packageRoot, 'compatibility.json'), 'utf8')
		) as Record<string, unknown>;
		expect(inventory['schemaVersion']).toBe(2);
		for (const section of [
			'commands',
			'options',
			'cliOptions',
			'exports',
			'serverMembers',
			'workerMembers',
			'events',
		]) {
			const items = inventory[section] as Array<{
				name: string;
				status: string;
				allowFalse?: unknown;
				diagnostic?: string;
				errorContains?: string;
			}>;
			expect(Array.isArray(items), section).toBe(true);
			expect(new Set(items.map(({ name }) => name)).size, section).toBe(
				items.length
			);
			for (const item of items) {
				expect(item.name).toBeTypeOf('string');
				expect(item.status).toMatch(
					/^(supported|native-only|unsupported-by-design)$/
				);
				if (item.status === 'unsupported-by-design')
					expect(item.diagnostic ?? item.errorContains).toBeTypeOf(
						'string'
					);
				if (Object.hasOwn(item, 'allowFalse')) {
					expect(section).toBe('options');
					expect(item.status).toBe('unsupported-by-design');
					expect(item.allowFalse).toBe(true);
				}
			}
		}

		const commands = names(inventory['commands']);
		expect(commands).toEqual([
			'start',
			'server',
			'run-blueprint',
			'build-snapshot',
			'php',
		]);
		const options = names(inventory['options']);
		expect(options).toContain('command');
		expect(
			(
				inventory['options'] as Array<{
					name: string;
					acceptedNoopCommands?: string[];
				}>
			)
				.filter(({ acceptedNoopCommands }) => acceptedNoopCommands)
				.map(({ name, acceptedNoopCommands }) => ({
					name,
					acceptedNoopCommands,
				}))
		).toEqual([{ name: 'port', acceptedNoopCommands: ['run-blueprint'] }]);
		expect(
			(
				inventory['options'] as Array<{
					name: string;
					allowFalse?: boolean;
				}>
			)
				.filter(({ allowFalse }) => allowFalse === true)
				.map(({ name }) => name)
				.sort()
		).toEqual(['internalCookieStore']);
		const cliOptions = inventory['cliOptions'] as Array<{
			name: string;
			commands: string[];
			status: string;
			errorContains?: string;
		}>;
		const commandNames = new Set([
			'start',
			'server',
			'run-blueprint',
			'build-snapshot',
		]);
		for (const option of cliOptions) {
			expect(option.name).toMatch(/^--/);
			expect(option.status).toMatch(
				/^(supported|unsupported-by-design)$/
			);
			expect(option.commands.length).toBeGreaterThan(0);
			expect(new Set(option.commands).size).toBe(option.commands.length);
			expect(
				option.commands.every((command) => commandNames.has(command))
			).toBe(true);
			if (option.status === 'unsupported-by-design')
				expect(option.errorContains).toBeTypeOf('string');
		}
		expect(names(inventory['workerMembers'])).toEqual(
			expect.arrayContaining([...stableWorkerMethods, 'cli', 'onMessage'])
		);
	});

	it('exports only the documented runtime API', () => {
		expect(Object.keys(publicAPI).sort()).toEqual(
			[
				'CLIArgsValidationError',
				'LogVerbosity',
				'NativeCLIError',
				'NativeCLIErrorCode',
				'internalsKeyForTesting',
				'mergeDefinedConstants',
				'parseOptionsAndRunCLI',
				'resolveWorkerCount',
				'runCLI',
			].sort()
		);
	});

	it('rejects every unsupported option before starting acquisition', async () => {
		const inventory = JSON.parse(
			await readFile(join(packageRoot, 'compatibility.json'), 'utf8')
		) as {
			options: Array<{ name: keyof RunCLIArgs; status: string }>;
		};
		for (const option of inventory.options.filter(
			({ status }) => status === 'unsupported-by-design'
		)) {
			await expect(
				runCLI({
					command: 'start',
					[option.name]: unsupportedValue(option.name),
				} as RunCLIArgs)
			).rejects.toMatchObject({
				code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			});
		}
		await expect(
			runCLI({ command: 'start', mount: {} as never })
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
		});
		await expect(
			runCLI({ command: 'start', _: ['start', 'extra'] })
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
		});
	});
});

function names(value: unknown): string[] {
	return (value as Array<{ name: string }>).map(({ name }) => name);
}

function unsupportedValue(name: keyof RunCLIArgs): unknown {
	if (
		[
			'pathAliases',
			'additional-blueprint-steps',
			'phpExtension',
			'experimentalUnsafeIdeIntegration',
			'defaultedDebugConstants',
		].includes(name)
	)
		return ['enabled'];
	if (name === 'phpmyadmin') return 'latest';
	if (name === 'mode') return 'mount-only';
	if (name === 'db-engine') return 'mysql';
	if (name.startsWith('db-') || name === 'allow') return 'enabled';
	if (name === 'experimental-multi-worker') return 2;
	return true;
}
