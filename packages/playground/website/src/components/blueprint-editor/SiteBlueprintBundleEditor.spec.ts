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
import type * as BlueprintBundleStorageModule from '../../lib/state/opfs/opfs-blueprint-bundle-storage';
import type * as SliceSitesModule from '../../lib/state/redux/slice-sites';
import {
	readSiteBlueprintJson,
	SiteBlueprintBundleEditor,
} from './SiteBlueprintBundleEditor';

type SiteInfo = SliceSitesModule.SiteInfo;

const mocks = vi.hoisted(() => ({
	dispatch: vi.fn(),
	persistBlueprintBundle: vi.fn(),
	updateSiteMetadata: vi.fn(),
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
	useAppSelector: vi.fn(),
}));

vi.mock('../../lib/state/redux/slice-sites', async (importOriginal) => ({
	...(await importOriginal<typeof SliceSitesModule>()),
	updateSiteMetadata: mocks.updateSiteMetadata,
}));

vi.mock('./BlueprintBundleEditor', async () => {
	const { forwardRef } = await import('react');
	return {
		BlueprintBundleEditor: forwardRef(function BlueprintBundleEditorMock() {
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
		mocks.dispatch.mockReset();
		mocks.persistBlueprintBundle.mockReset();
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
});
