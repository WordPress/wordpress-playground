describe('stored site specs', () => {
	let persistBlueprintBundle: ReturnType<typeof vi.fn>;
	let resetSiteFiles: ReturnType<typeof vi.fn>;
	let resolveRuntimeConfiguration: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		persistBlueprintBundle = vi.fn();
		resetSiteFiles = vi.fn();
		resolveRuntimeConfiguration = vi.fn();

		vi.doMock('@php-wasm/logger', () => ({
			logger: {
				error: vi.fn(),
			},
		}));
		vi.doMock('@wp-playground/common', () => ({
			RecommendedPHPVersion: '8.3',
		}));
		vi.doMock('@wp-playground/blueprints', () => ({
			BlueprintFetchError: class BlueprintFetchError extends Error {},
			BlueprintReflection: {
				create: vi.fn(async () => ({
					getVersion: () => 2,
				})),
			},
			InvalidBlueprintError: class InvalidBlueprintError extends Error {},
			resolveRuntimeConfiguration,
		}));
		vi.doMock('../opfs/opfs-blueprint-bundle-storage', () => ({
			isTraversableFilesystemBackend: (value: unknown) =>
				typeof value === 'object' &&
				value !== null &&
				typeof (value as { read?: unknown }).read === 'function' &&
				typeof (value as { listFiles?: unknown }).listFiles ===
					'function' &&
				typeof (value as { isDir?: unknown }).isDir === 'function',
			persistBlueprintBundle,
		}));
		vi.doMock('../opfs/opfs-site-storage', () => ({
			opfsSiteStorage: {
				resetSiteFiles,
			},
		}));
		vi.doMock('../playground-identity', () => ({
			getAutosaveFingerprintFromURL: () => 'fingerprint',
		}));
		vi.doMock('../url/resolve-blueprint-from-url', () => ({
			applyQueryOverrides: vi.fn(),
			resolveBlueprintFromURL: vi.fn(async () => ({
				blueprint: createBundleBlueprint(),
				source: { type: 'inline-string' },
			})),
		}));
		vi.doMock('./slice-ui', () => ({
			setActiveSiteError: vi.fn((payload) => ({
				type: 'ui/setActiveSiteError',
				payload,
			})),
		}));
		vi.doMock('./store', () => ({
			selectActiveSite: vi.fn(),
			setActiveSite: vi.fn((slug) => ({
				type: 'ui/setActiveSite',
				payload: slug,
			})),
		}));
	});

	afterEach(() => {
		vi.doUnmock('@php-wasm/logger');
		vi.doUnmock('@wp-playground/common');
		vi.doUnmock('@wp-playground/blueprints');
		vi.doUnmock('../opfs/opfs-blueprint-bundle-storage');
		vi.doUnmock('../opfs/opfs-site-storage');
		vi.doUnmock('../playground-identity');
		vi.doUnmock('../url/resolve-blueprint-from-url');
		vi.doUnmock('./slice-ui');
		vi.doUnmock('./store');
	});

	it('does not replace a persisted bundle before validating the new setup', async () => {
		resolveRuntimeConfiguration.mockRejectedValue(new Error('Invalid setup'));
		const { resetAutosavedSiteSpec } = await import('./slice-sites');
		const resetSite = resetAutosavedSiteSpec(
			'autosaved-site',
			new URL('https://playground.test/?blueprint-url=https://example.com')
		);

		await expect(
			resetSite(createDispatch() as any, createGetState() as any)
		).rejects.toThrow('Invalid setup');

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
		expect(resetSiteFiles).not.toHaveBeenCalled();
	});

	it('does not persist a bundle for a new stored site before validating setup', async () => {
		resolveRuntimeConfiguration.mockRejectedValue(new Error('Invalid setup'));
		const { setStoredSiteSpec } = await import('./slice-sites');
		const addSite = setStoredSiteSpec(
			'Autosaved site',
			new URL('https://playground.test/?blueprint-url=https://example.com'),
			'autosaved-site',
			{ persistence: 'autosave' }
		);

		await expect(
			addSite(createDispatch() as any, createEmptyGetState() as any)
		).rejects.toThrow('Invalid setup');

		expect(persistBlueprintBundle).not.toHaveBeenCalled();
	});
});

function createEmptyGetState() {
	return () => ({
		sites: {
			ids: [],
			entities: {},
			opfsSitesLoadingState: 'loaded',
			firstTemporarySiteCreated: false,
		},
	});
}

function createGetState() {
	return () => ({
		sites: {
			ids: ['autosaved-site'],
			entities: {
				'autosaved-site': {
					slug: 'autosaved-site',
					metadata: {
						id: 'autosaved-site',
						name: 'Autosaved site',
						storage: 'opfs',
						persistence: 'autosave',
						originalBlueprint: {},
						originalBlueprintSource: { type: 'none' },
						runtimeConfiguration: {
							phpVersion: '8.3',
							wpVersion: 'latest',
							intl: false,
							networking: true,
							extraLibraries: [],
							constants: {},
						},
					},
				},
			},
			opfsSitesLoadingState: 'loaded',
			firstTemporarySiteCreated: false,
		},
	});
}

function createDispatch() {
	return vi.fn(async (action) => action);
}

function createBundleBlueprint() {
	return {
		read: vi.fn(),
		listFiles: vi.fn(),
		isDir: vi.fn(),
	};
}
