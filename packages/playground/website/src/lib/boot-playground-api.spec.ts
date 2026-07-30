import { bootPlaygroundAPI } from './boot-playground-api';

const mocks = vi.hoisted(() => {
	const exportSavedSiteAsZip = vi.fn();
	return {
		exposeAPI: vi.fn(),
		exportSavedSiteAsZip,
		opfsSiteStorage: { exportSavedSiteAsZip } as
			| { exportSavedSiteAsZip: typeof exportSavedSiteAsZip }
			| undefined,
		setAPIReady: vi.fn(),
	};
});

vi.mock('@php-wasm/universal', () => ({
	exposeAPI: mocks.exposeAPI,
}));

vi.mock('./state/opfs/opfs-site-storage', () => ({
	get opfsSiteStorage() {
		return mocks.opfsSiteStorage;
	},
}));

describe('bootPlaygroundAPI', () => {
	beforeEach(() => {
		mocks.opfsSiteStorage = {
			exportSavedSiteAsZip: mocks.exportSavedSiteAsZip,
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('exposes the saved-site export API and forwards its options', async () => {
		const exposedAPI = { isReady: vi.fn() };
		mocks.exposeAPI.mockReturnValue([
			mocks.setAPIReady,
			vi.fn(),
			exposedAPI,
		]);
		const zip = new Blob(['zip'], { type: 'application/zip' });
		mocks.exportSavedSiteAsZip.mockResolvedValue(zip);

		expect(bootPlaygroundAPI()).toBe(exposedAPI);
		const methods = mocks.exposeAPI.mock.calls[0][0];
		await expect(
			methods.exportSavedSiteAsZip('my-site', {
				excludePatterns: ['/*', '!/wp-content/**'],
			})
		).resolves.toBe(zip);

		expect(mocks.exportSavedSiteAsZip).toHaveBeenCalledWith('my-site', {
			excludePatterns: ['/*', '!/wp-content/**'],
		});
		expect(mocks.setAPIReady).toHaveBeenCalledTimes(1);
	});

	it('reports when OPFS site storage is unavailable', async () => {
		mocks.exposeAPI.mockReturnValue([
			mocks.setAPIReady,
			vi.fn(),
			{ isReady: vi.fn() },
		]);
		mocks.opfsSiteStorage = undefined;

		bootPlaygroundAPI();
		const methods = mocks.exposeAPI.mock.calls[0][0];

		await expect(methods.exportSavedSiteAsZip('my-site')).rejects.toThrow(
			'OPFS site storage is unavailable in this context.'
		);
	});
});
