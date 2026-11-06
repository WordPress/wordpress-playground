import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { consumeAPI, type UniversalPHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { encodeZip } from '@php-wasm/stream-compression';
import {
	getBlueprintDeclaration,
	type BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import { BlueprintsV1Handler } from '../src/blueprints-v1/blueprints-v1-handler';
import type { RunCLIArgs } from '../src/run-cli';
import type { CLIOutput } from '../src/cli-output';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { fetchSqliteIntegration } from '../src/blueprints-v1/download';
import { resolveBlueprint } from '../src/resolve-blueprint';

vi.mock('@php-wasm/universal', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return { ...actual, consumeAPI: vi.fn() };
});

vi.mock('../src/blueprints-v1/download', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		cachedDownload: vi.fn(
			async () => new File(['WordPress'], 'wordpress.zip')
		),
		fetchSqliteIntegration: vi.fn(
			async () => new File(['SQLite'], 'sqlite.zip')
		),
	};
});

vi.mock('@wp-playground/wordpress', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		resolveWordPressRelease: vi.fn(async (version: string) => ({
			releaseUrl: `https://wordpress.org/wordpress-${version}.zip`,
			version,
			source: 'inferred',
		})),
	};
});

describe('BlueprintsV1Handler', () => {
	const cliOutput = {
		updateProgress: vi.fn(),
	} as unknown as CLIOutput;
	let fixtureDirectory: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		fixtureDirectory = await mkdtemp(
			joinPaths(tmpdir(), 'blueprint-flags-')
		);
	});

	afterEach(async () => {
		await rm(fixtureDirectory, { recursive: true, force: true });
	});

	test('prepares the WordPress version declared by the Blueprint', async () => {
		const handler = new BlueprintsV1Handler(
			{
				command: 'server',
				wordpressInstallMode: 'download-and-install',
				'mount-before-install': [
					{
						hostPath: '/mounted',
						vfsPath: '/wordpress',
					},
				],
				blueprint: {
					preferredVersions: {
						php: '7.4',
						wp: '6.2',
					},
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};

		await handler.bootWordPress(playground as any, {} as any);

		expect(resolveWordPressRelease).toHaveBeenCalledWith('6.2');
		expect(fetchSqliteIntegration).toHaveBeenCalledWith('trunk');
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				phpVersion: '7.4',
				wpVersion: '6.2',
			}),
			expect.anything()
		);
	});

	describe.each(['json', 'zip'] as const)('%s Blueprints', (format) => {
		test.each([
			{ steps: [] },
			{ preferredVersions: { php: '7.4', wp: '6.2' }, steps: [] },
		] satisfies BlueprintV1Declaration[])(
			'applies CLI flags at every boot and compilation stage: %j',
			async (declaration) => {
				const blueprint = await resolveFixture(format, declaration);
				const handler = createHandler({
					blueprint,
					php: '8.1',
					wp: '6.4',
					login: true,
				});
				const playground = {
					bootWordPress: vi.fn(),
					isConnected: vi.fn(),
					useFileLockManager: vi.fn(),
					bootRequestHandler: vi.fn(),
					isReady: vi.fn(),
					defineConstant: vi.fn(),
				};
				vi.mocked(consumeAPI).mockReturnValue(playground as any);

				await handler.bootWordPress(playground as any, {} as any);
				await handler.bootRequestHandler({
					worker: { phpPort: {}, processId: 1 } as any,
					fileLockManagerPort: {} as any,
					nativeInternalDirPath: fixtureDirectory,
				});
				const compiled = await handler.compileInputBlueprint([]);
				await compiled.run(playground as unknown as UniversalPHP);

				expect(resolveWordPressRelease).toHaveBeenCalledWith('6.4');
				expect(playground.bootWordPress).toHaveBeenCalledWith(
					expect.objectContaining({
						phpVersion: '8.1',
						wpVersion: '6.4',
					}),
					expect.anything()
				);
				expect(playground.bootRequestHandler).toHaveBeenCalledWith(
					expect.objectContaining({ phpVersion: '8.1' })
				);
				expect(compiled.versions).toEqual({ php: '8.1', wp: '6.4' });
				expect(playground.defineConstant).toHaveBeenCalledWith(
					'PLAYGROUND_AUTO_LOGIN_AS_USER',
					'admin'
				);
				expect(await getBlueprintDeclaration(blueprint!)).toEqual(
					declaration
				);
			}
		);

		test('keeps bundled resources and explicit Blueprint login settings', async () => {
			const blueprint = await resolveFixture(format, {
				login: false,
				steps: [
					{
						step: 'writeFile',
						path: '/copied.txt',
						data: { resource: 'bundled', path: 'message.txt' },
					},
				],
			});
			const handler = createHandler({
				blueprint,
				php: '8.1',
				login: true,
			});
			const compiled = await handler.compileInputBlueprint([]);
			const playground = { writeFile: vi.fn(), defineConstant: vi.fn() };

			await compiled.run(playground as unknown as UniversalPHP);

			expect(playground.writeFile).toHaveBeenCalledWith(
				'/copied.txt',
				new TextEncoder().encode('Bundled resource')
			);
			expect(playground.defineConstant).not.toHaveBeenCalled();
		});
	});

	test('does not bypass the adjacent-file permission when applying flags', async () => {
		const blueprint = await resolveFixture(
			'json',
			{
				steps: [
					{
						step: 'writeFile',
						path: '/copied.txt',
						data: { resource: 'bundled', path: 'message.txt' },
					},
				],
			},
			false
		);
		const compiled = await createHandler({
			blueprint,
			php: '8.1',
		}).compileInputBlueprint([]);
		const playground = { writeFile: vi.fn() };

		await expect(
			compiled.run(playground as unknown as UniversalPHP)
		).rejects.toMatchObject({
			cause: expect.objectContaining({
				message: expect.stringContaining(
					'--blueprint-may-read-adjacent-files'
				),
			}),
		});
		expect(playground.writeFile).not.toHaveBeenCalled();
	});

	test.each(['declaration', 'json', 'zip'] as const)(
		'preserves PHP-only %s Blueprints when CLI login is enabled',
		async (format) => {
			const declaration: BlueprintV1Declaration = {
				preferredVersions: { wp: false, php: '8.2' },
			};
			const blueprint =
				format === 'declaration'
					? declaration
					: await resolveFixture(format, declaration);
			const compiled = await createHandler({
				blueprint,
				php: '8.1',
				wp: '6.4',
				login: true,
			}).compileInputBlueprint([]);
			expect(compiled.versions.php).toBe('8.2');
		}
	);

	function createHandler(args: Partial<RunCLIArgs>) {
		return new BlueprintsV1Handler(
			{
				command: 'server',
				wordpressInstallMode: 'download-and-install',
				'mount-before-install': [
					{ hostPath: fixtureDirectory, vfsPath: '/wordpress' },
				],
				...args,
			},
			{ siteUrl: 'http://127.0.0.1:9400', cliOutput }
		);
	}

	async function resolveFixture(
		format: 'json' | 'zip',
		declaration: BlueprintV1Declaration,
		blueprintMayReadAdjacentFiles = true
	) {
		const sourceString = joinPaths(fixtureDirectory, `input.${format}`);
		const json = JSON.stringify(declaration);
		if (format === 'zip') {
			const zip = encodeZip([
				new File([json], 'blueprint.json'),
				new File(['Bundled resource'], 'message.txt'),
			]);
			await writeFile(
				sourceString,
				new Uint8Array(await new Response(zip).arrayBuffer())
			);
		} else {
			await writeFile(sourceString, json);
			await writeFile(
				joinPaths(fixtureDirectory, 'message.txt'),
				'Bundled resource'
			);
		}
		return resolveBlueprint({
			sourceString,
			blueprintMayReadAdjacentFiles,
		});
	}
});
