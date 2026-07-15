import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BlueprintsV1Handler } from '../src/blueprints-v1/blueprints-v1-handler';
import type { RunCLIArgs } from '../src/run-cli';
import type { CLIOutput } from '../src/cli-output';
import { resolveWordPressRelease } from '@wp-playground/wordpress';

vi.mock('../src/blueprints-v1/download', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		cachedDownload: vi.fn(
			async () => new File(['WordPress'], 'wordpress.zip')
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

	test('boots the WordPress and PHP versions declared by the Blueprint', async () => {
		const { MinifiedWordPressVersions } =
			await import('@wp-playground/wordpress-builds');
		const handler = new BlueprintsV1Handler(
			{
				command: 'server',
				wordpressInstallMode: 'download-and-install',
				skipSqliteSetup: true,
				'mount-before-install': [
					{
						hostPath: '/mounted',
						vfsPath: '/wordpress',
					},
				],
				blueprint: {
					preferredVersions: {
						php: '8.3',
						wp: 'beta',
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

		expect(resolveWordPressRelease).toHaveBeenCalledWith(
			MinifiedWordPressVersions.beta
		);
		expect(playground.bootWordPress).toHaveBeenCalledWith(
			expect.objectContaining({
				phpVersion: '8.3',
				wpVersion: 'beta',
			}),
			expect.anything()
		);
	});
});
