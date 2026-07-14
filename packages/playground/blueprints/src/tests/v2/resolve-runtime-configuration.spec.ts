import { StreamedFile } from '@php-wasm/stream-compression';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { beforeEach, vi } from 'vitest';
import { resolveRuntimeConfiguration } from '../../lib/resolve-runtime-configuration';
import type { BlueprintBundle } from '../../lib/types';
import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';
import { assertBlueprintV2WordPressVersionCompatibility } from '../../lib/v2/resolve-runtime-configuration';

const wordpressMocks = vi.hoisted(() => ({
	getWordPressStableVersions: vi.fn(),
	resolveWordPressRelease: vi.fn(),
}));

vi.mock('@wp-playground/wordpress', () => ({
	getWordPressStableVersions: wordpressMocks.getWordPressStableVersions,
	resolveWordPressRelease: wordpressMocks.resolveWordPressRelease,
	versionStringToLoadedWordPressVersion: (version: string) =>
		version.includes('-alpha-') ? 'trunk' : version,
}));

describe('Blueprint v2 runtime configuration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		wordpressMocks.getWordPressStableVersions.mockResolvedValue([
			'6.7.5',
			'6.8',
			'6.8.1',
			'6.8.5',
			'6.9',
		]);
		wordpressMocks.resolveWordPressRelease.mockResolvedValue({
			version: '7.0-beta1',
			releaseUrl: 'https://wordpress.org/wordpress-7.0-beta1.zip',
			source: 'api',
		});
	});

	const expectedDefaults = {
		phpVersion: RecommendedPHPVersion,
		wpVersion: 'latest',
		intl: false,
		networking: false,
		constants: {},
		extraLibraries: [],
	};

	it('resolves default runtime configuration from a declaration', async () => {
		const blueprint = {
			version: 2,
		} satisfies BlueprintV2Declaration;

		await expect(resolveRuntimeConfiguration(blueprint)).resolves.toEqual(
			expectedDefaults
		);
	});

	it('rejects malformed declarations before resolving WordPress releases', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: { min: '6.8' },
				pluginz: [],
			} as any)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: [
				{
					path: '/pluginz',
					message: 'must NOT have additional properties',
				},
			],
		});
		expect(
			wordpressMocks.getWordPressStableVersions
		).not.toHaveBeenCalled();
		expect(wordpressMocks.resolveWordPressRelease).not.toHaveBeenCalled();
	});

	it('resolves default runtime configuration from a bundle declaration', async () => {
		const blueprint = createBundle({
			version: 2,
		});

		await expect(resolveRuntimeConfiguration(blueprint)).resolves.toEqual(
			expectedDefaults
		);
	});

	it('resolves networking from Playground application options', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						networkAccess: false,
					},
				},
			})
		).resolves.toMatchObject({
			networking: false,
		});

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						networkAccess: true,
					},
				},
			})
		).resolves.toMatchObject({
			networking: true,
		});
	});

	it('disables networking by default when network access is omitted', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {},
				},
			})
		).resolves.toMatchObject({
			networking: false,
		});
	});

	it('resolves constants from the declaration', async () => {
		const constants = {
			WP_DEBUG: true,
			WP_ENVIRONMENT_TYPE: 'local',
			AUTOSAVE_INTERVAL: 120,
		};

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				constants,
			})
		).resolves.toMatchObject({
			constants,
		});
	});

	it('resolves exact PHP version strings', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: '8.2',
			})
		).resolves.toMatchObject({
			phpVersion: '8.2',
		});

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: 'next',
			})
		).resolves.toMatchObject({
			phpVersion: 'next',
		});
	});

	it('resolves the latest PHP version label', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: 'latest',
			})
		).resolves.toMatchObject({
			phpVersion: LatestSupportedPHPVersion,
		});
	});

	it('resolves recommended PHP versions from constraint objects', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.1',
					recommended: '8.2',
					max: '8.4',
				},
			})
		).resolves.toMatchObject({
			phpVersion: '8.2',
		});
	});

	it('rejects recommended PHP versions outside constraint bounds', async () => {
		for (const phpVersion of [
			{ min: '8.2', recommended: '8.1' },
			{ recommended: '8.5', max: '8.4' },
		] as const) {
			await expect(
				resolveRuntimeConfiguration({
					version: 2,
					phpVersion,
				})
			).rejects.toThrow(
				`Blueprint v2 recommended PHP version "${phpVersion.recommended}" does not satisfy constraints`
			);
		}
	});

	it('uses the default PHP version for constraints without a recommended version', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.1',
					max: '8.4',
				},
			})
		).resolves.toMatchObject({
			phpVersion: RecommendedPHPVersion,
		});
	});

	it('uses the highest supported PHP version matching version constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: LatestSupportedPHPVersion,
				},
			})
		).resolves.toMatchObject({
			phpVersion: LatestSupportedPHPVersion,
		});
	});

	it('uses a lower supported PHP version when max excludes the default', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					max: '8.2',
				},
			})
		).resolves.toMatchObject({
			phpVersion: '8.2',
		});
	});

	it('rejects unsupported PHP version strings', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: '8.9',
			} as BlueprintV2Declaration)
		).rejects.toThrow(
			'Unsupported Blueprint v2 PHP version "8.9". Supported versions:'
		);
	});

	it('rejects unsatisfied PHP version constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.5',
					max: '8.4',
				},
			})
		).rejects.toThrow(
			'Unsatisfiable Blueprint v2 PHP version constraints {"min":"8.5","max":"8.4"}. Supported versions:'
		);
	});

	it('resolves simple WordPress version strings', async () => {
		for (const wordpressVersion of [
			'latest',
			'6.8',
			'6.8.1',
			'6.8-rc1',
			'beta',
			'trunk',
			'nightly',
		]) {
			await expect(
				resolveRuntimeConfiguration({
					version: 2,
					wordpressVersion,
				} as BlueprintV2Declaration)
			).resolves.toMatchObject({
				wpVersion: wordpressVersion,
			});
		}
	});

	it('resolves preferred WordPress versions from constraint objects', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8.4',
					max: '6.8',
					preferred: '6.8',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8.5',
		});
	});

	it('resolves an available exact preferred WordPress release', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
					preferred: '6.8.1',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8.1',
		});
	});

	it('resolves the latest WordPress version matching constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.7',
					max: '6.8',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8.5',
		});
	});

	it('selects the newest available WordPress version for an open constraint', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.9.0',
		});
	});

	it('preserves an initial release as an exact runtime request', async () => {
		wordpressMocks.getWordPressStableVersions.mockResolvedValue(['6.8']);

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8.0',
					max: '6.8.0',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8.0',
		});
	});

	it('selects an available release below a nonexistent maximum', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
					max: '6.8.4',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8.1',
		});
	});

	it('does not require a downloadable release when applying to an existing site', async () => {
		wordpressMocks.getWordPressStableVersions.mockRejectedValue(
			new Error('Release catalog unavailable')
		);
		const blueprint = {
			version: 2,
			wordpressVersion: {
				min: '6.8.2',
				max: '6.8.4',
			},
		} as const;

		await expect(
			resolveRuntimeConfiguration(blueprint, {
				siteMode: 'apply-to-existing-site',
			})
		).resolves.toMatchObject({ wpVersion: 'latest' });
		await expect(
			assertBlueprintV2WordPressVersionCompatibility(blueprint, '6.8.3')
		).resolves.toBeUndefined();

		const prereleaseBlueprint = {
			version: 2,
			wordpressVersion: {
				min: '6.8-beta1',
				max: '6.8-rc1',
			},
		} as const;
		await expect(
			resolveRuntimeConfiguration(prereleaseBlueprint, {
				siteMode: 'apply-to-existing-site',
			})
		).resolves.toMatchObject({ wpVersion: 'latest' });
		await expect(
			assertBlueprintV2WordPressVersionCompatibility(
				prereleaseBlueprint,
				'6.8-beta2'
			)
		).resolves.toBeUndefined();
		expect(
			wordpressMocks.getWordPressStableVersions
		).not.toHaveBeenCalled();
	});

	it('selects the newest release regardless of catalog order', async () => {
		wordpressMocks.getWordPressStableVersions.mockResolvedValue([
			'6.8.1',
			'6.8.5',
			'6.8',
		]);

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
					max: '6.8',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8.5',
		});
	});

	it('selects the current prerelease when it satisfies constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '7.0-beta1',
					max: '7.0-rc1',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '7.0-beta1',
		});
	});

	it('rejects preferred WordPress versions absent from the catalog', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
					preferred: '6.8.4',
				},
			})
		).rejects.toThrow(
			'Blueprint v2 preferred WordPress version "6.8.4" is not available.'
		);
	});

	it('rejects preferred WordPress versions outside constraints', async () => {
		for (const siteMode of [
			'create-new-site',
			'apply-to-existing-site',
		] as const) {
			await expect(
				resolveRuntimeConfiguration(
					{
						version: 2,
						wordpressVersion: {
							min: '6.8',
							max: '6.8',
							preferred: '6.9',
						},
					},
					{ siteMode }
				)
			).rejects.toThrow(
				'Blueprint v2 preferred WordPress version "6.9" does not satisfy constraints'
			);
		}
		expect(
			wordpressMocks.getWordPressStableVersions
		).not.toHaveBeenCalled();
	});

	it('rejects unsatisfied WordPress version constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.9',
					max: '6.8',
				},
			})
		).rejects.toThrow(
			'Unsatisfiable Blueprint v2 WordPress version constraints {"min":"6.9","max":"6.8"}.'
		);

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8.2',
					max: '6.8.4',
				},
			})
		).rejects.toThrow(
			'No available WordPress release satisfies the declared bounds.'
		);
	});

	it('uses WordPress ZIP URLs as custom runtime sources', async () => {
		for (const wordpressVersion of [
			'https://example.com/wordpress.zip',
			'http://example.com/wordpress.zip',
		] as const) {
			await expect(
				resolveRuntimeConfiguration({
					version: 2,
					wordpressVersion,
				})
			).resolves.toMatchObject({
				wpVersion: wordpressVersion,
			});
		}
	});

	it.each([
		'./wordpress.zip',
		{ filename: 'wordpress.zip', content: '' },
		{ directoryName: 'wordpress', files: {} },
		{ gitRepository: 'https://example.com/wordpress.git' },
	] as const)(
		'uses WordPress data reference %j as a custom runtime source',
		async (wordpressVersion) => {
			await expect(
				resolveRuntimeConfiguration({
					version: 2,
					wordpressVersion,
				} as BlueprintV2Declaration)
			).resolves.toMatchObject({ wpVersion: 'custom' });
		}
	);

	it('rejects malformed WordPress version constraint values', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: 123,
				},
			} as unknown as BlueprintV2Declaration)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: expect.arrayContaining([
				expect.objectContaining({ path: '/wordpressVersion/min' }),
			]),
		});
	});

	it('rejects unsupported WordPress version strings', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: 'not-a-version',
			} as unknown as BlueprintV2Declaration)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: expect.arrayContaining([
				expect.objectContaining({ path: '/wordpressVersion' }),
			]),
		});
	});

	it('accepts installed WordPress patches within a branch constraint', async () => {
		await expect(
			assertBlueprintV2WordPressVersionCompatibility(
				{
					version: 2,
					wordpressVersion: {
						min: '6.8',
						max: '6.8',
						preferred: '6.8.1',
					},
				},
				'6.8.5'
			)
		).resolves.toBeUndefined();
	});

	it('rejects installed WordPress patches above an exact maximum', async () => {
		await expect(
			assertBlueprintV2WordPressVersionCompatibility(
				{
					version: 2,
					wordpressVersion: {
						min: '6.8',
						max: '6.8.1',
					},
				},
				'6.8.5'
			)
		).rejects.toThrow(
			'Installed WordPress version "6.8.5" does not satisfy Blueprint v2 wordpressVersion'
		);
	});

	it('rejects installed WordPress versions below the minimum', async () => {
		await expect(
			assertBlueprintV2WordPressVersionCompatibility(
				{
					version: 2,
					wordpressVersion: { min: '6.8' },
				},
				'6.7.5'
			)
		).rejects.toThrow(
			'Installed WordPress version "6.7.5" does not satisfy Blueprint v2 wordpressVersion'
		);
	});

	it('treats shorthand WordPress versions as new-site selection hints', async () => {
		for (const wordpressVersion of [
			undefined,
			'latest',
			'6.8.1',
		] as const) {
			await expect(
				assertBlueprintV2WordPressVersionCompatibility(
					{ version: 2, wordpressVersion },
					'6.7.5'
				)
			).resolves.toBeUndefined();
		}
	});
});

function createBundle(blueprint: BlueprintV2Declaration): BlueprintBundle {
	return {
		async read(path: string) {
			if (path !== 'blueprint.json') {
				throw new Error(`Unexpected bundle read: ${path}`);
			}
			return StreamedFile.fromArrayBuffer(
				new TextEncoder().encode(JSON.stringify(blueprint)),
				'blueprint.json'
			);
		},
	} satisfies BlueprintBundle;
}
