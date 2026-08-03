import { bootPlaygroundAPI } from './boot-playground-api';

const mocks = vi.hoisted(() => ({
	setAPIReady: vi.fn(),
}));

vi.mock('@php-wasm/universal', () => ({
	exposeAPI: vi.fn((api: object) => [
		mocks.setAPIReady,
		vi.fn(),
		{
			...api,
			isConnected: vi.fn(async () => undefined),
			isReady: vi.fn(async () => undefined),
		},
	]),
}));

vi.mock('./state/opfs/opfs-site-storage', () => ({
	opfsSiteStorage: undefined,
}));

describe('bootPlaygroundAPI', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('reports when OPFS site storage is unavailable', async () => {
		const api = bootPlaygroundAPI();

		await expect(api.exportSavedSiteAsZip('my-site')).rejects.toThrow(
			'OPFS site storage is unavailable in this context.'
		);
	});
});
