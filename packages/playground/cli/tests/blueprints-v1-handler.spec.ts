import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BlueprintsV1Handler } from '../src/blueprints-v1/blueprints-v1-handler';
import type { RunCLIArgs } from '../src/run-cli';
import type { CLIOutput } from '../src/cli-output';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import { fetchSqliteIntegration } from '../src/blueprints-v1/download';

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
});
