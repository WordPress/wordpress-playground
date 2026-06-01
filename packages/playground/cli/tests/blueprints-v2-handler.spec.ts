import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BlueprintsV2Handler } from '../src/blueprints-v2/blueprints-v2-handler';
import type { RunCLIArgs } from '../src/run-cli';
import type { CLIOutput } from '../src/cli-output';
import type {
	BlueprintBundle,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { fetchSqliteIntegration } from '../src/blueprints-v1/download';

vi.mock('../src/blueprints-v1/download', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		fetchSqliteIntegration: vi.fn(
			async () => new File(['sqlite'], 'sqlite.zip')
		),
	};
});

describe('BlueprintsV2Handler', () => {
	const cliOutput = {
		updateProgress: vi.fn(),
	} as unknown as CLIOutput;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('uses the standard TypeScript worker path', () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		expect(handler.getWorkerType()).toBe('v1');
	});

	test('applies CLI overrides and normalizes additional steps before compiling', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				php: '8.1',
				wp: '6.4',
				login: true,
				blueprint: {
					version: 2,
					additionalStepsAfterExecution: [
						{
							step: 'mkdir',
							path: 'wp-content/uploads/demo',
						},
					],
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		const compiled = await handler.compileInputBlueprint([
			{
				step: 'activateTheme',
				themeFolderName: 'mounted-theme',
			},
		]);

		expect(compiled.declaration).toMatchObject({
			version: 2,
			phpVersion: '8.1',
			wordpressVersion: '6.4',
			applicationOptions: {
				'wordpress-playground': {
					login: true,
				},
			},
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: 'wp-content/uploads/demo',
				},
				{
					step: 'activateTheme',
					themeDirectoryName: 'mounted-theme',
				},
			],
		});
	});

	test('does not treat parsed CLI defaults as v2 version overrides', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				php: '8.4',
				wp: 'latest',
				cliProvidedOptions: {
					php: false,
					wp: false,
				},
				blueprint: {
					version: 2,
					phpVersion: '7.4',
					wordpressVersion: '6.4',
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		const compiled = await handler.compileInputBlueprint([]);

		expect(compiled.declaration).toMatchObject({
			version: 2,
			phpVersion: '7.4',
			wordpressVersion: '6.4',
		});
	});

	test('does not treat parsed CLI login defaults as v2 login overrides', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				login: false,
				cliProvidedOptions: {
					login: false,
				},
				blueprint: {
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							login: true,
						},
					},
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		const compiled = await handler.compileInputBlueprint([]);

		expect(compiled.declaration).toMatchObject({
			applicationOptions: {
				'wordpress-playground': {
					login: true,
				},
			},
		});
	});

	test('applies start command default login when v2 declaration has no login opinion', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'start',
				login: true,
				cliProvidedOptions: {
					login: false,
				},
				blueprint: {
					version: 2,
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		const compiled = await handler.compileInputBlueprint([]);

		expect(compiled.declaration).toMatchObject({
			applicationOptions: {
				'wordpress-playground': {
					login: true,
				},
			},
		});
	});

	test('preserves v2 login intent over start command default login', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'start',
				login: true,
				cliProvidedOptions: {
					login: false,
				},
				blueprint: {
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							login: false,
						},
					},
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		const compiled = await handler.compileInputBlueprint([]);

		expect(compiled.declaration).toMatchObject({
			applicationOptions: {
				'wordpress-playground': {
					login: false,
				},
			},
		});
	});

	test('applies explicit --login and --no-login overrides to v2 declarations', async () => {
		const createHandler = (login: boolean) =>
			new BlueprintsV2Handler(
				{
					command: 'server',
					login,
					cliProvidedOptions: {
						login: true,
					},
					blueprint: {
						version: 2,
						applicationOptions: {
							'wordpress-playground': {
								login: !login,
							},
						},
					},
				} as RunCLIArgs,
				{
					siteUrl: 'http://127.0.0.1:9400',
					cliOutput,
				}
			);

		await expect(
			createHandler(true).compileInputBlueprint([])
		).resolves.toMatchObject({
			declaration: {
				applicationOptions: {
					'wordpress-playground': {
						login: true,
					},
				},
			},
		});
		await expect(
			createHandler(false).compileInputBlueprint([])
		).resolves.toMatchObject({
			declaration: {
				applicationOptions: {
					'wordpress-playground': {
						login: false,
					},
				},
			},
		});
	});

	test('applies CLI overrides and additional steps to blueprint bundles', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				php: '8.2',
				login: true,
				blueprint: createBundle({
					version: 2,
					siteOptions: {
						blogname: 'Bundled site',
					},
				}),
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);

		const compiled = await handler.compileInputBlueprint([
			{
				step: 'mkdir',
				path: 'wp-content/uploads/from-bundle',
			},
		]);

		expect(compiled.declaration).toMatchObject({
			version: 2,
			phpVersion: '8.2',
			siteOptions: {
				blogname: 'Bundled site',
			},
			applicationOptions: {
				'wordpress-playground': {
					login: true,
				},
			},
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: 'wp-content/uploads/from-bundle',
				},
			],
		});
	});

	test('translates v2 apply-to-existing-site mode to the v1 worker install mode', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				mode: 'apply-to-existing-site',
				wordpressInstallMode: 'download-and-install',
				skipSqliteSetup: true,
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

		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'install-from-existing-files-if-needed',
			}),
			expect.anything()
		);
	});

	test('preserves v2 mount-only mode from legacy install mode', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				wordpressInstallMode: 'do-not-attempt-installing',
				skipSqliteSetup: true,
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

		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
			}),
			expect.anything()
		);
	});

	test('skips SQLite setup in v2 mount-only mode', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				mode: 'mount-only',
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

		expect(fetchSqliteIntegration).not.toHaveBeenCalled();
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
				sqliteIntegrationPluginZip: undefined,
			}),
			expect.anything()
		);
	});

	test('preserves v1 preferredVersions.wp false in the native v2 path', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				skipSqliteSetup: true,
				blueprint: {
					preferredVersions: {
						php: 'latest',
						wp: false,
					},
					steps: [],
				},
			} as unknown as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};

		await handler.bootWordPress(playground as any, {} as any);

		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				wordpressInstallMode: 'do-not-attempt-installing',
			}),
			expect.anything()
		);
	});

	test('passes v2 network access to the worker boot', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				mode: 'apply-to-existing-site',
				skipSqliteSetup: true,
				blueprint: {
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							networkAccess: false,
						},
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

		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				networking: false,
			}),
			expect.anything()
		);
	});

	test('passes inline wordpressVersion ZIP references to the worker boot', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				skipSqliteSetup: true,
				blueprint: {
					version: 2,
					wordpressVersion: {
						filename: 'wordpress.zip',
						content: 'zip',
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

		const bootOptions = playground.bootWordPress.mock.calls[0][0];
		expect(bootOptions).toMatchObject({
			wpVersion: 'custom-wordpress',
			wordpressInstallMode: 'download-and-install',
		});
		expect(new TextDecoder().decode(bootOptions.wordPressZip)).toBe('zip');
	});

	test('rejects wordpressVersion ZIP references outside create-new-site mode', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				mode: 'apply-to-existing-site',
				skipSqliteSetup: true,
				blueprint: {
					version: 2,
					wordpressVersion: {
						filename: 'wordpress.zip',
						content: 'zip',
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

		await expect(
			handler.bootWordPress(playground as any, {} as any)
		).rejects.toThrow(
			'Blueprint v2 wordpressVersion ZIP references can only be used when creating a new site.'
		);
	});

	test('rejects URL wordpressVersion ZIP references before fetching outside create-new-site mode', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		try {
			const handler = new BlueprintsV2Handler(
				{
					command: 'server',
					mode: 'apply-to-existing-site',
					skipSqliteSetup: true,
					blueprint: {
						version: 2,
						wordpressVersion: 'https://example.com/wordpress.zip',
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

			await expect(
				handler.bootWordPress(playground as any, {} as any)
			).rejects.toThrow(
				'Blueprint v2 wordpressVersion ZIP references can only be used when creating a new site.'
			);
			expect(fetchMock).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	test('uses the v2 runtime PHP version when selecting the SQLite integration', async () => {
		const handler = new BlueprintsV2Handler(
			{
				command: 'server',
				mode: 'apply-to-existing-site',
				php: '8.4',
				cliProvidedOptions: {
					php: false,
				},
				blueprint: {
					version: 2,
					phpVersion: '5.2',
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

		expect(fetchSqliteIntegration).toHaveBeenCalledWith(
			'v3.0.0-rc.3-php52'
		);
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				phpVersion: '5.2',
			}),
			expect.anything()
		);
	});
});

function createBundle(blueprint: BlueprintV2Declaration): BlueprintBundle {
	return {
		read: vi.fn(async (filePath: string) => {
			if (filePath.replace(/^\.?\//, '') !== 'blueprint.json') {
				throw new Error(`Unexpected bundled file: ${filePath}`);
			}
			return new File([JSON.stringify(blueprint)], 'blueprint.json');
		}),
	} as unknown as BlueprintBundle;
}
