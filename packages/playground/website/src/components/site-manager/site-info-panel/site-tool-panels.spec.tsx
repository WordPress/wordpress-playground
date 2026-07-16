// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { SiteToolPanels } from './site-tool-panels';

vi.mock('../../../lib/state/redux/store', () => ({
	useAppDispatch: () => vi.fn(),
	useAppSelector: () => false,
}));

vi.mock('../site-file-browser', () => ({
	SiteFileBrowser: ({
		isVisible,
		documentRoot,
		filesystemRoot,
	}: {
		isVisible: boolean;
		documentRoot: string;
		filesystemRoot: string;
	}) => (
		<div
			data-testid="files"
			data-visible={isVisible}
			data-document-root={documentRoot}
			data-filesystem-root={filesystemRoot}
		>
			File browser
		</div>
	),
}));

vi.mock('../../blueprint-editor/SiteBlueprintBundleEditor', () => ({
	SiteBlueprintBundleEditor: ({
		dockPresentation,
	}: {
		dockPresentation?: boolean;
	}) => (
		<div data-testid="blueprint" data-dock-presentation={dockPresentation}>
			Blueprint editor
		</div>
	),
}));

vi.mock('../site-settings-form/active-site-settings-form', () => ({
	ActiveSiteSettingsForm: () => (
		<div data-testid="settings">Site settings</div>
	),
}));

vi.mock('../site-database-panel', () => ({
	SiteDatabasePanel: () => <div data-testid="database">Database tools</div>,
}));

vi.mock('../../log-modal', () => ({
	SiteLogs: () => <div data-testid="logs">Site logs</div>,
}));

vi.mock('../../offline-notice', () => ({
	OfflineNotice: () => <div>Offline</div>,
}));

const site = {
	slug: 'test-site',
	metadata: {
		storage: 'opfs',
		id: 'test-site',
		name: 'Test site',
		persistence: 'explicit',
		runtimeConfiguration: {},
		originalBlueprint: {},
		originalBlueprintSource: {},
	},
} as SiteInfo;

const playground = {
	documentRoot: Promise.resolve('/wordpress'),
} as PlaygroundClient;

describe('SiteToolPanels', () => {
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
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it('mounts tools on first visit and keeps them mounted when hidden', async () => {
		await renderPanels('database', playground);

		const database = findTool('database');
		expect(database.closest('[hidden]')).toBeNull();
		for (const name of ['settings', 'files', 'blueprint', 'logs']) {
			expect(findOptionalTool(name)).toBeNull();
		}

		await renderPanels('logs', playground);
		expect(findTool('database')).toBe(database);
		expect(database.closest('[hidden]')).not.toBeNull();
		expect(findTool('logs').closest('[hidden]')).toBeNull();
	});

	it('enables the Blueprint editor Dock presentation', async () => {
		await renderPanels('blueprint', playground);

		expect(
			findTool('blueprint').getAttribute('data-dock-presentation')
		).toBe('true');
	});

	it('explains that Playground files are still loading', async () => {
		await renderPanels('files', undefined);

		expect(container.querySelector('[role="status"]')?.textContent).toBe(
			'Playground files are still loading…'
		);
	});

	it('browses a local PHP project from its mount root', async () => {
		const phpSite = {
			...site,
			metadata: {
				...site.metadata,
				localDirectoryBootConfiguration: {
					mountpoint: '/app',
					documentRoot: 'public',
					siteMode: 'php',
				},
			},
		} as SiteInfo;
		const phpPlayground = {
			documentRoot: Promise.resolve('/app/public'),
		} as PlaygroundClient;

		await renderPanels('files', phpPlayground, phpSite);

		expect(findTool('files').getAttribute('data-document-root')).toBe(
			'/app/public'
		);
		expect(findTool('files').getAttribute('data-filesystem-root')).toBe(
			'/app'
		);
	});

	async function renderPanels(
		activeTabName: React.ComponentProps<
			typeof SiteToolPanels
		>['activeTabName'],
		client: PlaygroundClient | undefined,
		selectedSite: SiteInfo = site
	) {
		await act(async () => {
			root.render(
				<SiteToolPanels
					site={selectedSite}
					playground={client}
					activeTabName={activeTabName}
				/>
			);
		});
	}

	function findTool(name: string) {
		const tool = findOptionalTool(name);
		if (!tool) {
			throw new Error(`Could not find ${name} tool.`);
		}
		return tool;
	}

	function findOptionalTool(name: string) {
		return container.querySelector(`[data-testid="${name}"]`);
	}
});
