import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BlueprintsV1Handler } from '../src/blueprints-v1/blueprints-v1-handler';
import type { RunCLIArgs } from '../src/run-cli';
import type { CLIOutput } from '../src/cli-output';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import type * as WordPressModule from '@wp-playground/wordpress';
import {
	cachedDownload,
	fetchSqliteIntegration,
} from '../src/blueprints-v1/download';
import { InMemoryFilesystem, OverlayFilesystem } from '@wp-playground/storage';
import { RecommendedPHPVersion } from '@wp-playground/common';

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

const actualWordPress = await vi.importActual<typeof WordPressModule>(
	'@wp-playground/wordpress'
);

describe('BlueprintsV1Handler', () => {
	const cliOutput = {
		updateProgress: vi.fn(),
	} as unknown as CLIOutput;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('prepares the WordPress version declared by the Blueprint', async () => {
		const handler = createHandler({
			blueprint: {
				preferredVersions: {
					php: '7.4',
					wp: '6.2',
				},
			},
		});
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

	test('applies the --wp and --php flags to a Blueprint file bundle', async () => {
		const handler = createHandler({
			blueprint: new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': JSON.stringify({ steps: [] }),
				}),
			]),
			wp: '6.4',
			php: '8.1',
		});
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};

		await handler.bootWordPress(playground as any, {} as any);

		expect(resolveWordPressRelease).toHaveBeenCalledWith('6.4');
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				phpVersion: '8.1',
				wpVersion: '6.4',
			}),
			expect.anything()
		);
	});

	test('prefers bundle preferredVersions over --wp and --php', async () => {
		const handler = createHandler({
			blueprint: new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': JSON.stringify({
						steps: [],
						preferredVersions: {
							php: '7.4',
							wp: '6.2',
						},
					}),
				}),
			]),
			wp: '6.4',
			php: '8.1',
		});
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};

		await handler.bootWordPress(playground as any, {} as any);

		expect(resolveWordPressRelease).toHaveBeenCalledWith('6.2');
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				phpVersion: '7.4',
				wpVersion: '6.2',
			}),
			expect.anything()
		);
	});

	test('keeps the default versions for a Blueprint file bundle without flags', async () => {
		const handler = createHandler({
			blueprint: new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': JSON.stringify({ steps: [] }),
				}),
			]),
		});
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};

		await handler.bootWordPress(playground as any, {} as any);

		expect(resolveWordPressRelease).toHaveBeenCalledWith('latest');
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				phpVersion: RecommendedPHPVersion,
				wpVersion: 'latest',
			}),
			expect.anything()
		);
	});

	test('honors --login and resolves bundled resources for a Blueprint file bundle', async () => {
		const handler = createHandler({
			blueprint: new OverlayFilesystem([
				new InMemoryFilesystem({
					'blueprint.json': JSON.stringify({
						steps: [
							{
								step: 'writeFile',
								path: '/wordpress/hello.txt',
								data: {
									resource: 'bundled',
									path: 'hello.txt',
								},
							},
						],
					}),
					'hello.txt': 'hello from bundle',
				}),
			]),
			login: true,
		});
		const playground = {
			defineConstant: vi.fn().mockResolvedValue(undefined),
			writeFile: vi.fn().mockResolvedValue(undefined),
		};

		const compiled = await handler.compileInputBlueprint([]);
		await compiled.run(playground as any);

		expect(playground.defineConstant).toHaveBeenCalledWith(
			'PLAYGROUND_AUTO_LOGIN_AS_USER',
			'admin'
		);
		expect(playground.writeFile).toHaveBeenCalledWith(
			'/wordpress/hello.txt',
			new TextEncoder().encode('hello from bundle')
		);
	});

	test.each(['../../backups/site', 'C:\\backups\\site'])(
		'rejects the Blueprint WordPress version %s',
		async (wp) => {
			vi.mocked(resolveWordPressRelease).mockImplementationOnce(
				actualWordPress.resolveWordPressRelease
			);
			const playground = {
				bootWordPress: vi.fn().mockResolvedValue(undefined),
			};

			await expect(
				createHandler({
					blueprint: {
						preferredVersions: {
							php: '7.4',
							wp,
						},
					},
				}).bootWordPress(playground as any, {} as any)
			).rejects.toThrow('Unrecognized WordPress version');
			expect(cachedDownload).not.toHaveBeenCalled();
			expect(playground.bootWordPress).not.toHaveBeenCalled();
		}
	);

	test('refuses a resolved version that would leave the cache folder', async () => {
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};

		await expect(
			createHandler({
				blueprint: {
					preferredVersions: {
						php: '7.4',
						wp: '../../backups/site',
					},
				},
			}).bootWordPress(playground as any, {} as any)
		).rejects.toThrow('Invalid cache file name');
		expect(cachedDownload).not.toHaveBeenCalled();
		expect(playground.bootWordPress).not.toHaveBeenCalled();
	});

	test('downloads a custom WordPress URL under a full-hash cache key', async () => {
		vi.mocked(resolveWordPressRelease).mockImplementationOnce(
			actualWordPress.resolveWordPressRelease
		);
		const playground = {
			bootWordPress: vi.fn().mockResolvedValue(undefined),
		};
		const url = 'https://example.com/wordpress.zip';

		await createHandler({
			blueprint: {
				preferredVersions: {
					php: '7.4',
					wp: url,
				},
			},
		}).bootWordPress(playground as any, {} as any);

		expect(cachedDownload).toHaveBeenCalledWith(
			url,
			expect.stringMatching(/^custom-[0-9a-f]{64}\.zip$/),
			expect.anything()
		);
	});

	function createHandler(overrides: Partial<RunCLIArgs> = {}) {
		return new BlueprintsV1Handler(
			{
				command: 'server',
				wordpressInstallMode: 'download-and-install',
				'mount-before-install': [
					{
						hostPath: '/mounted',
						vfsPath: '/wordpress',
					},
				],
				...overrides,
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);
	}
});
