// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import { InMemoryFilesystemBackend } from '@wp-playground/storage';
import type { EventedFilesystem } from '@wp-playground/storage';
import type * as BlueprintsModule from '@wp-playground/blueprints';
import type * as BlueprintBundleStorageModule from '../../lib/state/opfs/opfs-blueprint-bundle-storage';
import type * as SliceClientsModule from '../../lib/state/redux/slice-clients';
import type * as SliceSitesModule from '../../lib/state/redux/slice-sites';
import type * as SliceUiModule from '../../lib/state/redux/slice-ui';
import {
	readSiteBlueprintJson,
	SiteBlueprintBundleEditor,
} from './SiteBlueprintBundleEditor';

type SiteInfo = SliceSitesModule.SiteInfo;

const mocks = vi.hoisted(() => ({
	clientEntities: {} as Record<
		string,
		{ opfsSync?: { status: 'syncing' | 'error' } }
	>,
	componentProps: undefined as Record<string, unknown> | undefined,
	createStoredSite: vi.fn(),
	dispatch: vi.fn(),
	persistBlueprintBundle: vi.fn(),
	pruneAutosavedSites: vi.fn(),
	removeClientInfo: vi.fn(),
	removeSite: vi.fn(),
	resolveRuntimeConfiguration: vi.fn(),
	setActiveSite: vi.fn(),
	setDockOperationNotice: vi.fn(),
	setDockPaneOpen: vi.fn(),
	updateSite: vi.fn(),
	updateSiteMetadata: vi.fn(),
}));

vi.mock('@wp-playground/blueprints', async (importOriginal) => ({
	...(await importOriginal<typeof BlueprintsModule>()),
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

vi.mock(
	'../../lib/state/opfs/opfs-blueprint-bundle-storage',
	async (importOriginal) => ({
		...(await importOriginal<typeof BlueprintBundleStorageModule>()),
		persistBlueprintBundle: mocks.persistBlueprintBundle,
	})
);

vi.mock('../../lib/state/redux/store', () => ({
	useAppDispatch: () => mocks.dispatch,
	useAppSelector: (
		selector: (state: {
			clients: { entities: typeof mocks.clientEntities };
		}) => unknown
	) => selector({ clients: { entities: mocks.clientEntities } }),
	setActiveSite: mocks.setActiveSite,
}));

vi.mock('../../lib/state/redux/slice-sites', async (importOriginal) => ({
	...(await importOriginal<typeof SliceSitesModule>()),
	createStoredSite: mocks.createStoredSite,
	pruneAutosavedSites: mocks.pruneAutosavedSites,
	removeSite: mocks.removeSite,
	updateSite: mocks.updateSite,
	updateSiteMetadata: mocks.updateSiteMetadata,
}));

vi.mock('../../lib/state/redux/slice-clients', async (importOriginal) => ({
	...(await importOriginal<typeof SliceClientsModule>()),
	removeClientInfo: mocks.removeClientInfo,
}));

vi.mock('../../lib/state/redux/slice-ui', async (importOriginal) => ({
	...(await importOriginal<typeof SliceUiModule>()),
	setDockOperationNotice: mocks.setDockOperationNotice,
	setDockPaneOpen: mocks.setDockPaneOpen,
}));

vi.mock('@wp-playground/components', async () => {
	const { forwardRef } = await import('react');
	return {
		BlueprintBundleEditor: forwardRef(function BlueprintBundleEditorMock(
			props: Record<string, unknown>,
			_ref
		) {
			mocks.componentProps = props;
			return null;
		}),
	};
});

describe('readSiteBlueprintJson', () => {
	it('seeds a minimal Blueprint when no declaration exists', async () => {
		const blueprintJson = await readSiteBlueprintJson(undefined);

		expect(JSON.parse(blueprintJson)).toEqual({
			$schema: 'https://playground.wordpress.net/blueprint-schema.json',
			steps: [],
		});
	});

	it('does not modify a persisted bundle while reading it', async () => {
		const backend = new InMemoryFilesystemBackend();

		await expect(readSiteBlueprintJson(backend)).rejects.toThrow(
			'File not found: /blueprint.json'
		);
		expect(await backend.fileExists('/blueprint.json')).toBe(false);
	});
});

describe('SiteBlueprintBundleEditor', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(() => {
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		mocks.clientEntities = {};
		mocks.componentProps = undefined;
		mocks.createStoredSite.mockReset();
		mocks.dispatch.mockReset();
		mocks.persistBlueprintBundle.mockReset();
		mocks.pruneAutosavedSites.mockReset();
		mocks.removeClientInfo.mockReset();
		mocks.removeSite.mockReset();
		mocks.resolveRuntimeConfiguration.mockReset();
		mocks.setActiveSite.mockReset();
		mocks.setActiveSite.mockImplementation((slug) => ({
			type: 'set-active-site',
			payload: slug,
		}));
		mocks.setDockOperationNotice.mockReset();
		mocks.setDockPaneOpen.mockReset();
		mocks.updateSite.mockReset();
		mocks.updateSiteMetadata.mockReset();
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('updates only Blueprint metadata after storing an autosaved draft', async () => {
		const site = {
			slug: 'autosaved-site',
			metadata: {
				id: 'autosaved-site',
				name: 'Autosaved Playground',
				storage: 'opfs',
				persistence: 'autosave',
				initialOpfsSyncPending: true,
				originalBlueprint: { steps: [] },
				originalBlueprintSource: { type: 'none' },
				runtimeConfiguration: {
					phpVersion: '8.3',
					wpVersion: 'latest',
				},
			},
		} as SiteInfo;
		const persistedBackend = new InMemoryFilesystemBackend();
		const metadataAction = { type: 'update-site-metadata' };
		let finishPersistence!: () => void;
		const persistence = new Promise<InMemoryFilesystemBackend>(
			(resolve) => {
				finishPersistence = () => resolve(persistedBackend);
			}
		);
		mocks.persistBlueprintBundle.mockReturnValue(persistence);
		mocks.updateSiteMetadata.mockReturnValue(metadataAction);
		mocks.dispatch.mockResolvedValue(undefined);

		await act(async () => {
			root.render(createElement(SiteBlueprintBundleEditor, { site }));
			await Promise.resolve();
		});
		await vi.waitFor(() =>
			expect(mocks.persistBlueprintBundle).toHaveBeenCalledOnce()
		);

		expect(mocks.updateSiteMetadata).not.toHaveBeenCalled();

		await act(async () => {
			finishPersistence();
			await persistence;
		});
		await vi.waitFor(() =>
			expect(mocks.updateSiteMetadata).toHaveBeenCalledOnce()
		);

		expect(mocks.updateSiteMetadata).toHaveBeenCalledWith({
			slug: site.slug,
			changes: {
				originalBlueprint: persistedBackend,
				originalBlueprintSource: { type: 'opfs-site' },
			},
		});
		expect(mocks.dispatch).toHaveBeenCalledOnce();
		expect(mocks.dispatch).toHaveBeenCalledWith(metadataAction);
	});

	it('runs an autosaved Blueprint in a new Playground', async () => {
		const sourceSite = createStoredSite('source-site');
		const newSite = createStoredSite('blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		const pruneAction = { type: 'prune-autosaves' };
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue(pruneAction);
		mocks.dispatch.mockImplementation((action) =>
			action === createAction ? Promise.resolve(newSite) : action
		);

		const { filesystem, onPreview } = await renderEditor(sourceSite);
		await act(async () => onPreview(filesystem));

		expect(mocks.createStoredSite).toHaveBeenCalledWith(
			sourceSite.metadata.name,
			filesystem.backend,
			undefined,
			{
				persistence: 'autosave',
				siteSlugToReturnToIfBlueprintFails: sourceSite.slug,
			}
		);
		expect(mocks.setActiveSite).toHaveBeenCalledWith(newSite.slug);
		expect(mocks.pruneAutosavedSites).toHaveBeenCalledWith({
			excludeSlugs: [sourceSite.slug, newSite.slug],
		});
	});

	it('keeps a temporary Blueprint in the current Playground', async () => {
		const site = {
			slug: 'temporary-site',
			metadata: {
				name: 'Temporary Playground',
				storage: 'none',
				originalBlueprint: null,
			},
		} as SiteInfo;
		const runtimeConfiguration = {
			phpVersion: '8.3',
			wpVersion: 'latest',
		};
		const updateAction = { type: 'update-site' };
		mocks.resolveRuntimeConfiguration.mockResolvedValue(
			runtimeConfiguration
		);
		mocks.updateSite.mockReturnValue(updateAction);
		mocks.dispatch.mockImplementation((action) => action);

		const { filesystem, onPreview } = await renderEditor(site);
		await act(async () => onPreview(filesystem));

		expect(mocks.createStoredSite).not.toHaveBeenCalled();
		expect(mocks.resolveRuntimeConfiguration).toHaveBeenCalledWith(
			filesystem.backend
		);
		expect(mocks.updateSite).toHaveBeenCalledWith({
			slug: site.slug,
			changes: {
				metadata: {
					originalBlueprintSource: { type: 'none' },
					originalBlueprint: filesystem,
					runtimeConfiguration,
					whenCreated: expect.any(Number),
				},
				originalUrlParams: undefined,
			},
		});
	});

	it('removes a failed run before pruning autosaves on retry', async () => {
		const failedRun = createStoredSite('failed-run');
		failedRun.metadata.siteSlugToReturnToIfBlueprintFails = 'original-site';
		const replacement = createStoredSite('replacement');
		const createAction = { type: 'create-stored-site' };
		const removeAction = { type: 'remove-site' };
		const pruneAction = { type: 'prune-autosaves' };
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.removeSite.mockReturnValue(removeAction);
		mocks.pruneAutosavedSites.mockReturnValue(pruneAction);
		mocks.dispatch.mockImplementation((action) =>
			action === createAction ? Promise.resolve(replacement) : action
		);

		const { filesystem, onPreview } = await renderEditor(failedRun);
		await act(async () => onPreview(filesystem));

		expect(mocks.removeSite).toHaveBeenCalledWith(failedRun.slug);
		expect(mocks.pruneAutosavedSites).toHaveBeenCalledWith({
			excludeSlugs: ['original-site', replacement.slug],
		});
		const actions = mocks.dispatch.mock.calls.map(([action]) => action);
		expect(actions.indexOf(removeAction)).toBeLessThan(
			actions.indexOf(pruneAction)
		);
	});

	it('waits for the source Playground to finish copying before running', async () => {
		const sourceSite = createStoredSite('source-site');
		const newSite = createStoredSite('blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		mocks.clientEntities[sourceSite.slug] = {
			opfsSync: { status: 'syncing' },
		};
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue({ type: 'prune-autosaves' });
		mocks.dispatch.mockImplementation((action) =>
			action === createAction ? Promise.resolve(newSite) : action
		);

		const { filesystem, onPreview } = await renderEditor(sourceSite);
		let preview!: Promise<void>;
		let duplicatePreview!: Promise<void>;
		act(() => {
			preview = onPreview(filesystem);
			duplicatePreview = onPreview(filesystem);
		});
		await act(async () => duplicatePreview);
		await act(async () => Promise.resolve());
		expect(mocks.createStoredSite).not.toHaveBeenCalled();

		mocks.clientEntities[sourceSite.slug] = {};
		await act(async () => {
			root.render(
				createElement(SiteBlueprintBundleEditor, { site: sourceSite })
			);
			await Promise.resolve();
		});
		await act(async () => preview);

		expect(mocks.createStoredSite).toHaveBeenCalledOnce();
	});

	it('allows another run after Playground creation fails', async () => {
		const sourceSite = createStoredSite('source-site');
		const newSite = createStoredSite('blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		let attempts = 0;
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue({ type: 'prune-autosaves' });
		mocks.dispatch.mockImplementation((action) => {
			if (action === createAction) {
				attempts++;
				return attempts === 1
					? Promise.reject(new Error('Could not create site'))
					: Promise.resolve(newSite);
			}
			return action;
		});

		const { filesystem, onPreview } = await renderEditor(sourceSite);
		await expect(onPreview(filesystem)).rejects.toThrow(
			'Could not create site'
		);
		expect(mocks.setDockOperationNotice).not.toHaveBeenCalled();
		await act(async () => onPreview(filesystem));

		expect(mocks.createStoredSite).toHaveBeenCalledTimes(2);
		expect(mocks.setActiveSite).toHaveBeenCalledWith(newSite.slug);
		expect(mocks.setDockOperationNotice).toHaveBeenCalledOnce();
	});

	async function renderEditor(site: SiteInfo): Promise<{
		filesystem: EventedFilesystem;
		onPreview: (filesystem: EventedFilesystem) => Promise<void>;
	}> {
		await act(async () => {
			root.render(createElement(SiteBlueprintBundleEditor, { site }));
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(mocks.componentProps).toBeDefined());
		return mocks.componentProps as {
			filesystem: EventedFilesystem;
			onPreview: (filesystem: EventedFilesystem) => Promise<void>;
		};
	}

	function createStoredSite(slug: string): SiteInfo {
		return {
			slug,
			metadata: {
				id: slug,
				name: 'Stored Blueprint',
				storage: 'opfs',
				persistence: 'autosave',
				originalBlueprint: new InMemoryFilesystemBackend(),
				originalBlueprintSource: { type: 'opfs-site' },
			},
		} as SiteInfo;
	}
});
