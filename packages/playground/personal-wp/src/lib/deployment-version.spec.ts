vi.mock('./config', () => ({ buildVersion: 'current-build' }));
vi.mock('./state/url/app-base-url', () => ({
	getAppBaseUrl: () => new URL('https://example.test/app/'),
}));

describe('deployment version on document startup', () => {
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.unstubAllGlobals());

	it('shares a single uncached version check across boot attempts in the same document', async () => {
		const fetch = vi.fn(
			async () =>
				new Response(JSON.stringify({ buildVersion: 'new-build' }))
		);
		vi.stubGlobal('fetch', fetch);
		const { getDeploymentVersion } = await import('./deployment-version');
		expect(await getDeploymentVersion()).toBe('new-build');
		expect(await getDeploymentVersion()).toBe('new-build');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			new URL('https://example.test/app/personal-wp-version.json'),
			{ cache: 'no-store' }
		);
	});

	it('permits offline startup when the deployment check fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		const { getDeploymentVersion } = await import('./deployment-version');
		expect(await getDeploymentVersion()).toBe('current-build');
	});
});
