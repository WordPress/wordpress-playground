// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { SiteToolPanels } from './site-tool-panels';

vi.mock('../../../lib/state/redux/store', () => ({
	useAppSelector: () => false,
}));

vi.mock('../site-file-browser', () => ({
	SiteFileBrowser: ({ isVisible }: { isVisible: boolean }) => (
		<div data-testid="files" data-visible={isVisible}>
			File browser
		</div>
	),
}));

vi.mock('../../blueprint-editor/SiteBlueprintBundleEditor', () => ({
	SiteBlueprintBundleEditor: () => (
		<div data-testid="blueprint">Blueprint editor</div>
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

vi.mock('../temporary-site-notice', () => ({
	TemporarySiteNotice: () => <div>Temporary Playground</div>,
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

	it('keeps every tool mounted and shows only the active tab', async () => {
		await renderPanels('database');

		const database = findTool('database');
		expect(database.closest('[hidden]')).toBeNull();
		for (const name of ['settings', 'files', 'blueprint', 'logs']) {
			expect(findTool(name).closest('[hidden]')).not.toBeNull();
		}

		await renderPanels('logs');
		expect(findTool('database')).toBe(database);
		expect(database.closest('[hidden]')).not.toBeNull();
		expect(findTool('logs').closest('[hidden]')).toBeNull();
	});

	async function renderPanels(
		activeTabName: React.ComponentProps<
			typeof SiteToolPanels
		>['activeTabName']
	) {
		await act(async () => {
			root.render(
				<SiteToolPanels
					site={site}
					playground={playground}
					activeTabName={activeTabName}
				/>
			);
		});
	}

	function findTool(name: string) {
		const tool = container.querySelector(`[data-testid="${name}"]`);
		if (!tool) {
			throw new Error(`Could not find ${name} tool.`);
		}
		return tool;
	}
});
