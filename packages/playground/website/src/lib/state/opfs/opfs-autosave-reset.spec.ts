import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAutosavedSiteFilesWithPendingMarker } from './opfs-autosave-reset';
import type { SiteInfo } from '../redux/slice-sites';

const mocks = vi.hoisted(() => ({
	opfsSiteStorage: {
		update: vi.fn(),
		resetSiteFiles: vi.fn(),
	},
}));

vi.mock('./opfs-site-storage', () => ({
	opfsSiteStorage: mocks.opfsSiteStorage,
}));

describe('resetAutosavedSiteFilesWithPendingMarker', () => {
	beforeEach(() => {
		mocks.opfsSiteStorage.update.mockReset();
		mocks.opfsSiteStorage.update.mockResolvedValue(undefined);
		mocks.opfsSiteStorage.resetSiteFiles.mockReset();
		mocks.opfsSiteStorage.resetSiteFiles.mockResolvedValue(undefined);
	});

	it('persists a reset marker before deleting old WordPress files', async () => {
		const changes = createChanges();

		const completedChanges = await resetAutosavedSiteFilesWithPendingMarker(
			'autosaved',
			changes
		);

		expect(mocks.opfsSiteStorage.update).toHaveBeenNthCalledWith(
			1,
			'autosaved',
			expect.objectContaining({
				initialOpfsSyncPending: true,
				opfsResetPending: true,
			}),
			changes.originalUrlParams
		);
		expect(
			mocks.opfsSiteStorage.update.mock.invocationCallOrder[0]
		).toBeLessThan(
			mocks.opfsSiteStorage.resetSiteFiles.mock.invocationCallOrder[0]
		);
		expect(mocks.opfsSiteStorage.resetSiteFiles).toHaveBeenCalledWith(
			'autosaved'
		);
		expect(mocks.opfsSiteStorage.update).toHaveBeenNthCalledWith(
			2,
			'autosaved',
			expect.objectContaining({
				initialOpfsSyncPending: true,
				opfsResetPending: undefined,
			}),
			changes.originalUrlParams
		);
		expect(
			mocks.opfsSiteStorage.resetSiteFiles.mock.invocationCallOrder[0]
		).toBeLessThan(
			mocks.opfsSiteStorage.update.mock.invocationCallOrder[1]
		);
		expect(completedChanges.metadata.opfsResetPending).toBeUndefined();
	});

	it('leaves the pending marker for boot recovery when deleting files fails', async () => {
		const resetError = new Error('reset failed');
		mocks.opfsSiteStorage.resetSiteFiles.mockRejectedValueOnce(resetError);

		await expect(
			resetAutosavedSiteFilesWithPendingMarker(
				'autosaved',
				createChanges()
			)
		).rejects.toBe(resetError);

		expect(mocks.opfsSiteStorage.update).toHaveBeenCalledTimes(1);
		expect(mocks.opfsSiteStorage.update).toHaveBeenCalledWith(
			'autosaved',
			expect.objectContaining({
				opfsResetPending: true,
			}),
			expect.anything()
		);
		expect(mocks.opfsSiteStorage.resetSiteFiles).toHaveBeenCalledWith(
			'autosaved'
		);
	});
});

function createChanges(): {
	metadata: SiteInfo['metadata'];
	originalUrlParams: SiteInfo['originalUrlParams'];
} {
	return {
		metadata: {
			id: 'autosaved-id',
			name: 'Autosaved',
			storage: 'opfs',
			persistence: 'autosave',
			initialOpfsSyncPending: true,
			runtimeConfiguration: {
				phpVersion: '8.3',
				wpVersion: 'latest',
				intl: false,
				networking: true,
				extraLibraries: [],
				constants: {},
			},
			originalBlueprint: {},
			originalBlueprintSource: { type: 'none' },
		},
		originalUrlParams: {
			searchParams: { php: '8.3' },
			hash: '#blueprint',
		},
	};
}
