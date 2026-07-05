import { Flex, FlexItem, TabPanel } from '@wordpress/components';
import classNames from 'classnames';
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { logger } from '@php-wasm/logger';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { setSiteManagerOpen } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { SiteLogs } from '../../log-modal';
import { OfflineNotice } from '../../offline-notice';
import { PaneLoading } from '../../pane-loading';
import { SiteDatabasePanel } from '../site-database-panel';
import { ActiveSiteSettingsForm } from '../site-settings-form/active-site-settings-form';
import type { PlaygroundClient } from '@wp-playground/remote';
import css from './style.module.css';

const SiteFileBrowser = lazy(() =>
	import('../site-file-browser').then((m) => ({ default: m.SiteFileBrowser }))
);

const SiteBlueprintBundleEditor = lazy(() =>
	import('../../blueprint-editor/SiteBlueprintBundleEditor').then((m) => ({
		default: m.SiteBlueprintBundleEditor,
	}))
);

const LAST_TAB_STORAGE_KEY = 'playground-site-last-tabs';

export type SiteInfoPanelTabName =
	| 'settings'
	| 'files'
	| 'blueprint'
	| 'database'
	| 'logs';

const SITE_INFO_PANEL_TABS: Array<{
	name: SiteInfoPanelTabName;
	title: string;
}> = [
	{
		name: 'settings',
		title: 'Settings',
	},
	{
		name: 'files',
		title: 'File browser',
	},
	{
		name: 'blueprint',
		title: 'Blueprint',
	},
	{
		name: 'database',
		title: 'Database',
	},
	{
		name: 'logs',
		title: 'Logs',
	},
];

function getSiteLastTab(siteSlug: string): SiteInfoPanelTabName | null {
	try {
		const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY);
		if (!stored) {
			return null;
		}
		const tabs = JSON.parse(stored);
		const tab = tabs[siteSlug];
		return isSiteInfoPanelTabName(tab) ? tab : null;
	} catch {
		return null;
	}
}

function setSiteLastTab(siteSlug: string, tabName: string): void {
	if (!isSiteInfoPanelTabName(tabName)) {
		return;
	}
	try {
		const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY);
		const tabs = stored ? JSON.parse(stored) : {};
		tabs[siteSlug] = tabName;
		localStorage.setItem(LAST_TAB_STORAGE_KEY, JSON.stringify(tabs));
	} catch {
		// Silently fail if localStorage is not available
	}
}

function isSiteInfoPanelTabName(
	tabName: unknown
): tabName is SiteInfoPanelTabName {
	return (
		typeof tabName === 'string' &&
		SITE_INFO_PANEL_TABS.some((tab) => tab.name === tabName)
	);
}

export function SiteInfoPanel({
	className,
	site,
	mobileUi,
	activeTabName,
}: {
	className: string;
	site: SiteInfo;
	mobileUi?: boolean;
	activeTabName?: SiteInfoPanelTabName;
}) {
	const offline = useAppSelector((state) => state.ui.offline);
	const dispatch = useAppDispatch();
	// Load the last active tab for this site.
	const initialTabName = useMemo(() => {
		const lastTab = getSiteLastTab(site.slug);
		return lastTab || 'settings';
	}, [site.slug]);
	// Keep visited tabs mounted so editor state survives tool switches, but avoid
	// booting every heavy pane (Files, Blueprint, Database) before it is opened.
	const [visitedTabs, setVisitedTabs] = useState<
		ReadonlySet<SiteInfoPanelTabName>
	>(() => new Set([activeTabName || initialTabName]));
	const rememberVisitedTab = useCallback((tabName: SiteInfoPanelTabName) => {
		setVisitedTabs((currentTabs) => {
			if (currentTabs.has(tabName)) {
				return currentTabs;
			}
			return new Set([...currentTabs, tabName]);
		});
	}, []);

	// Resolve documentRoot from playground client.
	const [documentRoot, setDocumentRoot] = useState<{
		playground: PlaygroundClient;
		root: string;
	} | null>(null);

	// Save the tab when it changes
	const handleTabSelect = (tabName: string) => {
		setSiteLastTab(site.slug, tabName);
		if (isSiteInfoPanelTabName(tabName)) {
			rememberVisitedTab(tabName);
		}
	};

	useEffect(() => {
		if (activeTabName) {
			setSiteLastTab(site.slug, activeTabName);
			rememberVisitedTab(activeTabName);
		}
	}, [activeTabName, rememberVisitedTab, site.slug]);

	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	const playground = clientInfo?.client;
	const shouldRenderTab = (
		tabName: SiteInfoPanelTabName,
		selectedTabName: SiteInfoPanelTabName
	) => selectedTabName === tabName || visitedTabs.has(tabName);

	// Resolve documentRoot from playground
	useEffect(() => {
		if (!playground) {
			setDocumentRoot(null);
			return;
		}

		let cancelled = false;
		setDocumentRoot(null);
		void playground.documentRoot.then(
			(root) => {
				if (!cancelled) {
					setDocumentRoot({ playground, root });
				}
			},
			(error) => {
				logger.error(
					'Could not resolve Playground document root',
					error
				);
				if (!cancelled) {
					setDocumentRoot(null);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [playground]);

	const currentDocumentRoot =
		documentRoot && documentRoot.playground === playground
			? documentRoot.root
			: null;

	const renderTabContents = (selectedTabName: SiteInfoPanelTabName) => (
		<>
			<div
				className={classNames(css.tabContents, {
					[css.tabHidden]: selectedTabName !== 'settings',
				})}
				hidden={selectedTabName !== 'settings'}
			>
				{shouldRenderTab('settings', selectedTabName) ? (
					<>
						{offline ? (
							<div className={css.padded}>
								<OfflineNotice />
							</div>
						) : null}

						<ActiveSiteSettingsForm
							onSubmit={() => dispatch(setSiteManagerOpen(false))}
						/>
					</>
				) : null}
			</div>
			<div
				className={classNames(css.tabContents, css.fileBrowserTab, {
					[css.tabHidden]: selectedTabName !== 'files',
				})}
				hidden={selectedTabName !== 'files'}
			>
				{shouldRenderTab('files', selectedTabName) ? (
					<Suspense
						fallback={
							<PaneLoading message="Loading the file browser…" />
						}
					>
						{currentDocumentRoot ? (
							<SiteFileBrowser
								key={site.slug}
								site={site}
								isVisible={selectedTabName === 'files'}
								documentRoot={currentDocumentRoot}
							/>
						) : (
							// The file browser needs the booted WordPress runtime;
							// show a clear loading state instead of a blank tab.
							<PaneLoading message="Waiting for the Playground to finish loading…" />
						)}
					</Suspense>
				) : null}
			</div>
			<div
				className={classNames(css.blueprintWrapper, {
					[css.tabHidden]: selectedTabName !== 'blueprint',
				})}
				hidden={selectedTabName !== 'blueprint'}
			>
				{shouldRenderTab('blueprint', selectedTabName) ? (
					<Suspense
						fallback={
							<PaneLoading message="Loading the Blueprint editor…" />
						}
					>
						<SiteBlueprintBundleEditor
							key={site.slug}
							site={site}
							className={classNames(css.blueprintEditor)}
						/>
					</Suspense>
				) : null}
			</div>
			<div
				className={classNames(css.tabContents, css.toolTabContents, {
					[css.tabHidden]: selectedTabName !== 'database',
				})}
				hidden={selectedTabName !== 'database'}
			>
				{shouldRenderTab('database', selectedTabName) ? (
					<SiteDatabasePanel playground={playground} />
				) : null}
			</div>
			<div
				className={classNames(css.tabContents, css.toolTabContents, {
					[css.tabHidden]: selectedTabName !== 'logs',
				})}
				hidden={selectedTabName !== 'logs'}
			>
				{shouldRenderTab('logs', selectedTabName) ? (
					<div className={classNames(css.logsWrapper)}>
						<SiteLogs
							className={css.logsSection}
							autoFocusSearch={selectedTabName === 'logs'}
						/>
					</div>
				) : null}
			</div>
		</>
	);

	return (
		<section
			className={classNames(className, css.siteInfoPanel, {
				[css.isMobile]: mobileUi,
			})}
		>
			<Flex
				direction="column"
				gap={1}
				justify="flex-start"
				expanded={true}
				className={css.siteInfoPanelContent}
			>
				<FlexItem style={{ flexGrow: 1 }}>
					{activeTabName ? (
						<div className={classNames(css.tabs, css.tabsNoNav)}>
							<div className="components-tab-panel__tab-content">
								{renderTabContents(activeTabName)}
							</div>
						</div>
					) : (
						<TabPanel
							key={site.slug}
							className={css.tabs}
							initialTabName={initialTabName}
							onSelect={handleTabSelect}
							tabs={SITE_INFO_PANEL_TABS}
						>
							{(tab) =>
								renderTabContents(
									tab.name as SiteInfoPanelTabName
								)
							}
						</TabPanel>
					)}
				</FlexItem>
			</Flex>
		</section>
	);
}
