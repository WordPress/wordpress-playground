import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../state/redux/slice-sites';
import { hasSpacefastConnection, saveSiteToSpacefast } from './save';

const mocks = vi.hoisted(() => ({
	connect: vi.fn(),
	createSpace: vi.fn(),
	getSpace: vi.fn(),
	publish: vi.fn(),
	generate: vi.fn(),
}));
vi.mock('./api', () => ({
	SpacefastClient: class {
		connect = mocks.connect;
		createSpace = mocks.createSpace;
		getSpace = mocks.getSpace;
		publish = mocks.publish;
	},
}));
vi.mock('./simply-static', () => ({ generateStaticSite: mocks.generate }));
vi.mock('./site', () => ({
	SOURCE_DIRECTORY: '_playground',
	parseSetupBlueprint: async (text: string) => JSON.parse(text),
	collectSiteFiles: async (
		_playground: unknown,
		_blueprint: unknown,
		_spaceId: string,
		_onProgress: unknown,
		files: unknown[]
	) => ({ files, manifest: { uploads: [] } }),
	loadPublicSite: vi.fn(),
}));

describe('Spacefast save sessions', () => {
	beforeEach(() => vi.clearAllMocks());
	it('reuses an allocated Space and tab credential after an upload fails', async () => {
		mocks.connect.mockResolvedValue({ kind: 'team', teamId: 'team_test' });
		mocks.createSpace.mockResolvedValue({ id: 'spc_created' });
		mocks.getSpace.mockResolvedValue({
			id: 'spc_created',
			liveUrl: 'https://created.space.fast/',
		});
		mocks.generate.mockImplementation(async (_playground, blueprint) => ({
			blueprint,
			files: [{ path: 'index.html', data: new Blob(['<h1>Site</h1>']) }],
		}));
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
			blueprint: expect.any(Object),
		});
		expect(mocks.publish.mock.calls[0][1]).toEqual([
			expect.objectContaining({ path: 'index.html' }),
		]);
		expect(mocks.publish.mock.calls[0][2]).toEqual({
			replace: true,
			deletePaths: [],
		});
		expect(mocks.connect).toHaveBeenCalledTimes(1);
		expect(mocks.createSpace).toHaveBeenCalledTimes(1);
		expect(mocks.publish.mock.calls.map(([id]) => id)).toEqual([
			'spc_created',
			'spc_created',
		]);
	});
	it('does not publish when static generation fails', async () => {
		mocks.connect.mockResolvedValue({
			kind: 'space',
			spaceId: 'spc_export_failure',
		});
		mocks.getSpace.mockResolvedValue({
			id: 'spc_export_failure',
			liveUrl: 'https://example.space.fast/',
		});
		mocks.generate.mockRejectedValue(new Error('Static generation failed'));
		await expect(
			saveSiteToSpacefast({
				site: {
					metadata: {
						id: 'failed-export-session',
						originalBlueprint: {},
						runtimeConfiguration: {
							phpVersion: '8.3',
							wpVersion: '6.8',
						},
					},
				} as unknown as SiteInfo,
				playground: {} as PlaygroundClient,
				name: 'My site',
				handoff: 'handoff',
				proxy: '',
				onProgress: vi.fn(),
			})
		).rejects.toThrow('Static generation failed');
		expect(mocks.publish).not.toHaveBeenCalled();
	});
});
