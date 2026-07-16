import { bootPlaygroundAPI } from './boot-playground-api';

const mocks = vi.hoisted(() => ({
	exposeAPI: vi.fn(),
	exportSavedSiteAsZip: vi.fn(),
	setAPIReady: vi.fn(),
}));

vi.mock('@php-wasm/universal', () => ({
	exposeAPI: mocks.exposeAPI,
}));

vi.mock('./state/opfs/opfs-site-storage', () => ({
	opfsSiteStorage: {
		exportSavedSiteAsZip: mocks.exportSavedSiteAsZip,
	},
}));

describe('bootPlaygroundAPI', () => {
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
				patterns: ['/*', '!/wp-content/**'],
			})
		).resolves.toBe(zip);

		expect(mocks.exportSavedSiteAsZip).toHaveBeenCalledWith('my-site', {
			patterns: ['/*', '!/wp-content/**'],
		});
		expect(mocks.setAPIReady).toHaveBeenCalledTimes(1);
	});
});
