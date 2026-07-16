// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { EventedFilesystem } from '@wp-playground/storage';
import type * as SliceSitesModule from '../../lib/state/redux/slice-sites';
import type * as SliceUiModule from '../../lib/state/redux/slice-ui';
import {
	BlueprintBundleEditor,
	type BlueprintBundleEditorHandle,
} from './BlueprintBundleEditor';

type SiteInfo = SliceSitesModule.SiteInfo;

const EDITED_BLUEPRINT = '{"steps":[{"step":"login"}]}';
const mocks = vi.hoisted(() => ({
	changeCode: undefined as ((code: string) => void) | undefined,
	createStoredSite: vi.fn(),
	dispatch: vi.fn(),
	fileExplorerProps: undefined as Record<string, unknown> | undefined,
	loggerError: vi.fn(),
	pruneAutosavedSites: vi.fn(),
	resolveRuntimeConfiguration: vi.fn(),
	setActiveSite: vi.fn(),
	setDockPaneOpen: vi.fn(),
	updateSite: vi.fn(),
}));

vi.mock('@php-wasm/logger', () => ({
	logger: { error: mocks.loggerError },
}));

vi.mock('@wp-playground/blueprints', () => ({
	resolveRuntimeConfiguration: mocks.resolveRuntimeConfiguration,
}));

vi.mock('@wp-playground/components', async () => {
	const { forwardRef } = await import('react');
	return {
		CodeEditor: forwardRef(
			(props: { onChange: (code: string) => void }, _ref) => {
				mocks.changeCode = props.onChange;
				return null;
			}
		),
		FileExplorerSidebar: (props: Record<string, unknown>) => {
			mocks.fileExplorerProps = props;
			return null;
		},
	};
});

vi.mock('../../lib/hooks/use-blueprint-url-hash', () => ({
	useBlueprintUrlHash: () => ({ isShareable: true, urlHash: '' }),
}));

vi.mock('../../lib/state/redux/store', () => ({
	useAppDispatch: () => mocks.dispatch,
	setActiveSite: mocks.setActiveSite,
}));

vi.mock('../../lib/state/redux/slice-sites', async (importOriginal) => ({
	...(await importOriginal<typeof SliceSitesModule>()),
	createStoredSite: mocks.createStoredSite,
	pruneAutosavedSites: mocks.pruneAutosavedSites,
	updateSite: mocks.updateSite,
}));

vi.mock('../../lib/state/redux/slice-ui', async (importOriginal) => ({
	...(await importOriginal<typeof SliceUiModule>()),
	setDockPaneOpen: mocks.setDockPaneOpen,
}));

describe('BlueprintBundleEditor Run barrier', () => {
	let container: HTMLDivElement;
	let root: Root;
	let filesystem: EventedFilesystem;
	let filesystemBackend: EventedFilesystem['backend'];
	let writeFile: ReturnType<typeof vi.fn>;
	const temporarySite = {
		metadata: {
			initialOpfsSyncPending: false,
			name: 'Temporary Playground',
			originalBlueprint: null,
			storage: 'none',
		},
		slug: 'test-site',
	} as SiteInfo;

	beforeAll(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	beforeEach(async () => {
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
		writeFile = vi.fn();
		filesystemBackend = {} as EventedFilesystem['backend'];
		filesystem = {
			backend: filesystemBackend,
			readFileAsText: vi.fn().mockResolvedValue('{}'),
			writeFile,
		} as unknown as EventedFilesystem;
		mocks.changeCode = undefined;
		mocks.createStoredSite.mockReset();
		mocks.fileExplorerProps = undefined;
		mocks.dispatch.mockReset();
		mocks.loggerError.mockReset();
		mocks.pruneAutosavedSites.mockReset();
		mocks.resolveRuntimeConfiguration.mockReset();
		mocks.setActiveSite.mockReset();
		mocks.setActiveSite.mockImplementation((slug) => ({
			type: 'set-active-site',
			payload: slug,
		}));
		mocks.setDockPaneOpen.mockReset();
		mocks.setDockPaneOpen.mockImplementation(
			(
				await vi.importActual<typeof SliceUiModule>(
					'../../lib/state/redux/slice-ui'
				)
			).setDockPaneOpen
		);
		mocks.updateSite.mockReset();
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('does not run when the pending edit cannot be saved', async () => {
		let failWrite!: (error: Error) => void;
		writeFile.mockReturnValue(
			new Promise<void>((_resolve, reject) => {
				failWrite = reject;
			})
		);
		const editorRef = await renderEditor();
		act(() => mocks.changeCode!(EDITED_BLUEPRINT));

		let run!: Promise<void>;
		act(() => {
			run = editorRef.current!.runBlueprint();
		});
		await act(async () => Promise.resolve());

		expect(writeFile).toHaveBeenCalledOnce();
		expect(writeFile).toHaveBeenCalledWith(
			'/blueprint.json',
			EDITED_BLUEPRINT
		);
		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();

		await act(async () => {
			failWrite(new Error('disk full'));
			await run;
		});

		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();
		expect(mocks.dispatch).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			'Could not save changes. Try again.'
		);
	});

	it('runs an autosaved Blueprint in a new Playground', async () => {
		const sourceSite = createStoredSiteInfo('autosave');
		const newSite = createStoredSiteInfo('autosave', 'blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		const pruneAction = { type: 'prune-autosaves' };
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue(pruneAction);
		mocks.dispatch.mockImplementation((action) => {
			if (action === createAction) {
				return Promise.resolve(newSite);
			}
			return action;
		});
		const editorRef = await renderEditor({ site: sourceSite });

		await act(async () => editorRef.current!.runBlueprint());

		expect(mocks.createStoredSite).toHaveBeenCalledWith(
			sourceSite.metadata.name,
			filesystemBackend,
			undefined,
			{ persistence: 'autosave' }
		);
		expect(mocks.pruneAutosavedSites).toHaveBeenCalledWith({
			excludeSlugs: [sourceSite.slug, newSite.slug],
		});
		expect(mocks.setDockPaneOpen).toHaveBeenCalledWith(false);
		expect(mocks.setActiveSite).toHaveBeenCalledWith(newSite.slug);
		expect(mocks.resolveRuntimeConfiguration).not.toHaveBeenCalled();
	});

	it('keeps running a temporary Blueprint in the current Playground', async () => {
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
		const editorRef = await renderEditor();

		await act(async () => editorRef.current!.runBlueprint());

		expect(mocks.createStoredSite).not.toHaveBeenCalled();
		expect(mocks.resolveRuntimeConfiguration).toHaveBeenCalledWith(
			filesystem
		);
		expect(mocks.updateSite).toHaveBeenCalledWith({
			slug: temporarySite.slug,
			changes: {
				metadata: {
					...temporarySite.metadata,
					originalBlueprintSource: { type: 'none' },
					originalBlueprint: filesystem,
					runtimeConfiguration,
					initialOpfsSyncPending: false,
					playgroundDefinedConstants: undefined,
					whenCreated: expect.any(Number),
				},
				originalUrlParams: undefined,
			},
		});
	});

	it('ignores a second run while Playground creation is pending', async () => {
		const sourceSite = createStoredSiteInfo('autosave');
		const newSite = createStoredSiteInfo('autosave', 'blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		let finishCreation!: (site: SiteInfo) => void;
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue({ type: 'prune-autosaves' });
		mocks.dispatch.mockImplementation((action) => {
			if (action === createAction) {
				return new Promise<SiteInfo>((resolve) => {
					finishCreation = resolve;
				});
			}
			return action;
		});
		const editorRef = await renderEditor({ site: sourceSite });

		let firstRun!: Promise<void>;
		let secondRun!: Promise<void>;
		act(() => {
			firstRun = editorRef.current!.runBlueprint();
			secondRun = editorRef.current!.runBlueprint();
		});
		await act(async () => Promise.resolve());

		expect(mocks.createStoredSite).toHaveBeenCalledOnce();

		await act(async () => {
			finishCreation(newSite);
			await Promise.all([firstRun, secondRun]);
		});
	});

	it('allows retrying after Playground creation fails', async () => {
		const sourceSite = createStoredSiteInfo('autosave');
		const newSite = createStoredSiteInfo('autosave', 'blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		let creationAttempts = 0;
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue({
			type: 'prune-autosaves',
		});
		mocks.dispatch.mockImplementation((action) => {
			if (action === createAction) {
				creationAttempts++;
				return creationAttempts === 1
					? Promise.reject(new Error('Could not create site'))
					: Promise.resolve(newSite);
			}
			return action;
		});
		const editorRef = await renderEditor({ site: sourceSite });

		await act(async () => editorRef.current!.runBlueprint());

		expect(container.textContent).toContain(
			'Could not create Playground. Try again.'
		);

		await act(async () => editorRef.current!.runBlueprint());

		expect(mocks.createStoredSite).toHaveBeenCalledTimes(2);
		expect(mocks.setActiveSite).toHaveBeenCalledWith(newSite.slug);
	});

	it('keeps a committed Playground when autosave pruning fails', async () => {
		const sourceSite = createStoredSiteInfo('autosave');
		const newSite = createStoredSiteInfo('autosave', 'blueprint-copy');
		const createAction = { type: 'create-stored-site' };
		const pruneAction = { type: 'prune-autosaves' };
		mocks.createStoredSite.mockReturnValue(createAction);
		mocks.pruneAutosavedSites.mockReturnValue(pruneAction);
		mocks.dispatch.mockImplementation((action) => {
			if (action === createAction) {
				return Promise.resolve(newSite);
			}
			if (action === pruneAction) {
				return Promise.reject(new Error('Could not prune'));
			}
			return action;
		});
		const editorRef = await renderEditor({ site: sourceSite });

		await act(async () => editorRef.current!.runBlueprint());

		expect(mocks.setActiveSite).toHaveBeenCalledWith(newSite.slug);
		expect(container.textContent).not.toContain(
			'Could not create Playground. Try again.'
		);
		expect(mocks.loggerError).toHaveBeenCalledWith(
			'Failed to prune autosaved Playgrounds',
			expect.any(Error)
		);
	});

	it('shows that stored Blueprints run in a fresh Playground', async () => {
		const sourceSite = createStoredSiteInfo('autosave');
		await renderEditor({ site: sourceSite });

		expect(container.textContent).toContain('Run in a new Playground');
		expect(container.textContent).toContain(
			`“${sourceSite.metadata.name}” stays in Recent autosaves.`
		);
		expect(container.textContent).not.toContain('reset site');
		expect(container.textContent).not.toContain('replace all its files');
	});

	it('shows that explicitly saved Playgrounds remain saved', async () => {
		const sourceSite = createStoredSiteInfo('explicit');
		await renderEditor({ site: sourceSite });

		expect(container.textContent).toContain(
			`“${sourceSite.metadata.name}” stays in Saved Playgrounds.`
		);
	});

	it('keeps the existing presentation by default', async () => {
		await renderEditor();

		expect(container.textContent).toContain(
			'Discard current Playground & run Blueprint'
		);
		expect(
			container.querySelector('button.is-destructive')?.textContent
		).toContain('Discard current Playground & run Blueprint');
		expect(container.textContent).not.toContain('Run in a new Playground');
		expect(container.textContent).not.toContain(
			'creates a fresh autosaved Playground'
		);
		expect(container.textContent).not.toContain('Export');
		expect(
			container.querySelector(
				'a[aria-label="See Blueprints documentation"]'
			)
		).toBeNull();
		expect(mocks.fileExplorerProps).not.toHaveProperty('dockPresentation');
	});

	it('can render the Blueprint editor as Dock content', async () => {
		await renderEditor({ dockPresentation: true });

		expect(container.textContent).toContain('Export');
		expect(
			container.querySelector(
				'a[aria-label="See Blueprints documentation"]'
			)
		).not.toBeNull();
		expect(mocks.fileExplorerProps).toMatchObject({
			title: 'Blueprint',
			showBinaryPreviewHeader: false,
			dockPresentation: true,
			useWordPressTooltips: true,
		});
	});

	async function renderEditor({
		dockPresentation = false,
		site = temporarySite,
	}: {
		dockPresentation?: boolean;
		site?: SiteInfo;
	} = {}): Promise<React.RefObject<BlueprintBundleEditorHandle>> {
		const editorRef = createRef<BlueprintBundleEditorHandle>();
		await act(async () => {
			root.render(
				<BlueprintBundleEditor
					ref={editorRef}
					filesystem={filesystem}
					site={site}
					dockPresentation={dockPresentation}
				/>
			);
			await Promise.resolve();
		});
		expect(editorRef.current).not.toBeNull();
		expect(mocks.changeCode).toBeTypeOf('function');
		return editorRef;
	}

	function createStoredSiteInfo(
		persistence: 'autosave' | 'explicit',
		slug = 'source-site'
	): SiteInfo {
		return {
			slug,
			metadata: {
				...temporarySite.metadata,
				id: slug,
				name: 'Source Playground',
				persistence,
				storage: 'opfs',
			},
		} as SiteInfo;
	}
});
