import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../state/redux/slice-sites';
import { hasSpacefastConnection, saveSiteToSpacefast } from './save';

const mocks = vi.hoisted(() => ({
	connect: vi.fn(),
	createSpace: vi.fn(),
	getSpace: vi.fn(),
	publish: vi.fn(),
}));
vi.mock('./api', () => ({
	SpacefastClient: class {
		connect = mocks.connect;
		createSpace = mocks.createSpace;
		getSpace = mocks.getSpace;
		publish = mocks.publish;
	},
}));
vi.mock('./site', () => ({
	SOURCE_DIRECTORY: '_playground',
	parseSetupBlueprint: async (text: string) => JSON.parse(text),
	collectSiteFiles: async () => ({ files: [], manifest: { uploads: [] } }),
	loadPublicSite: vi.fn(),
}));

describe('Spacefast save sessions', () => {
	it('reuses an allocated Space and tab credential after an upload fails', async () => {
		mocks.connect.mockResolvedValue({ kind: 'team', teamId: 'team_test' });
		mocks.createSpace.mockResolvedValue({ id: 'spc_created' });
		mocks.getSpace.mockResolvedValue({ id: 'spc_created', liveUrl: null });
		mocks.publish
			.mockRejectedValueOnce(new Error('Upload interrupted'))
			.mockResolvedValueOnce({
				space: { liveUrl: 'https://created.space.fast/' },
			});
		const site = {
			metadata: {
				id: 'retry-session',
				originalBlueprint: {},
				runtimeConfiguration: { phpVersion: '8.3', wpVersion: '6.8' },
			},
		} as unknown as SiteInfo;
		const options = {
			site,
			playground: {} as PlaygroundClient,
			name: 'My site',
			handoff: 'handoff',
			proxy: '',
			onProgress: vi.fn(),
		};
		await expect(saveSiteToSpacefast(options)).rejects.toThrow(
			'Upload interrupted'
		);
		expect(hasSpacefastConnection(site.metadata.id)).toBe(true);
		await expect(saveSiteToSpacefast(options)).resolves.toEqual({
			spaceId: 'spc_created',
			url: 'https://created.space.fast/',
		});
		expect(mocks.connect).toHaveBeenCalledTimes(1);
		expect(mocks.createSpace).toHaveBeenCalledTimes(1);
		expect(mocks.publish.mock.calls.map(([id]) => id)).toEqual([
			'spc_created',
			'spc_created',
		]);
	});
});
