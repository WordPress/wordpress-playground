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

	test.each(['../../backups/site', '/var/backups/site', 'C:\\backups\\site'])(
		'rejects the Blueprint WordPress version %s',
		async (wp) => {
			vi.mocked(resolveWordPressRelease).mockImplementationOnce(
				actualWordPress.resolveWordPressRelease
			);
			const playground = {
				bootWordPress: vi.fn().mockResolvedValue(undefined),
			};

			await expect(
				createHandler(wp).bootWordPress(playground as any, {} as any)
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
			createHandler('../../backups/site').bootWordPress(
				playground as any,
				{} as any
			)
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

		await createHandler(url).bootWordPress(playground as any, {} as any);

		expect(cachedDownload).toHaveBeenCalledWith(
			url,
			expect.stringMatching(/^custom-[0-9a-f]{64}\.zip$/),
			expect.anything()
		);
	});

	function createHandler(wp: string) {
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
				blueprint: {
					preferredVersions: {
						php: '7.4',
						wp,
					},
				},
			} as RunCLIArgs,
			{
				siteUrl: 'http://127.0.0.1:9400',
				cliOutput,
			}
		);
	}
});
