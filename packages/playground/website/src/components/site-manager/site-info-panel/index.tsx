import { Flex, FlexItem, TabPanel } from '@wordpress/components';
import classNames from 'classnames';
import { lazy, Suspense, useEffect, useState } from 'react';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { setSiteManagerOpen } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { SiteLogs } from '../../log-modal';
import { OfflineNotice } from '../../offline-notice';
import { PaneLoading } from '../../pane-loading';
import { SiteDatabasePanel } from '../site-database-panel';
import { ActiveSiteSettingsForm } from '../site-settings-form/active-site-settings-form';
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

function getSiteLastTab(siteSlug: string): string | null {
	try {
		const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY);
		if (!stored) {
			return null;
		}
		const tabs = JSON.parse(stored);
		return tabs[siteSlug] || null;
	} catch {
		return null;
	}
}

function setSiteLastTab(siteSlug: string, tabName: string): void {
	try {
		const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY);
		const tabs = stored ? JSON.parse(stored) : {};
		tabs[siteSlug] = tabName;
		localStorage.setItem(LAST_TAB_STORAGE_KEY, JSON.stringify(tabs));
	} catch {
		// Silently fail if localStorage is not available
	}
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
	// Load the last active tab for this site
	const [initialTabName] = useState(() => {
		const lastTab = getSiteLastTab(site.slug);
		return lastTab || 'settings';
	});

	// Resolve documentRoot from playground client
	const [documentRoot, setDocumentRoot] = useState<string | null>(null);

	// Save the tab when it changes
	const handleTabSelect = (tabName: string) => {
		setSiteLastTab(site.slug, tabName);
	};

	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	const playground = clientInfo?.client;

	// Resolve documentRoot from playground
	useEffect(() => {
		if (!playground) {
			setDocumentRoot(null);
			return;
		}

		void playground.documentRoot.then((root) => {
			setDocumentRoot(root);
		});
	}, [playground]);

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
					<TabPanel
						key={activeTabName ?? site.slug}
						className={classNames(css.tabs, {
							[css.tabsNoNav]: !!activeTabName,
						})}
						initialTabName={activeTabName ?? initialTabName}
						onSelect={handleTabSelect}
						tabs={[
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
						]}
					>
						{(tab) => (
							<>
								<div
									className={classNames(css.tabContents, {
										[css.tabHidden]:
											tab.name !== 'settings',
									})}
									hidden={tab.name !== 'settings'}
								>
									{offline ? (
										<div className={css.padded}>
											<OfflineNotice />
										</div>
									) : null}

									<ActiveSiteSettingsForm
										onSubmit={() =>
											dispatch(setSiteManagerOpen(false))
										}
									/>
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.fileBrowserTab,
										{
											[css.tabHidden]:
												tab.name !== 'files',
										}
									)}
									hidden={tab.name !== 'files'}
								>
									<Suspense
										fallback={
											<PaneLoading message="Loading the file browser…" />
										}
									>
										{documentRoot ? (
											<SiteFileBrowser
												key={site.slug}
												site={site}
												isVisible={tab.name === 'files'}
												documentRoot={documentRoot}
											/>
										) : (
											// The file browser needs the booted
											// WordPress runtime; show a clear
											// loading state instead of a blank tab.
											<PaneLoading message="Waiting for the Playground to finish loading…" />
										)}
									</Suspense>
								</div>
								<div
									className={classNames(
										css.blueprintWrapper,
										{
											[css.tabHidden]:
												tab.name !== 'blueprint',
										}
									)}
									hidden={tab.name !== 'blueprint'}
								>
									<Suspense
										fallback={
											<PaneLoading message="Loading the Blueprint editor…" />
										}
									>
										<SiteBlueprintBundleEditor
											key={site.slug}
											site={site}
											className={classNames(
												css.blueprintEditor
											)}
										/>
									</Suspense>
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.toolTabContents,
										{
											[css.tabHidden]:
												tab.name !== 'database',
										}
									)}
									hidden={tab.name !== 'database'}
								>
									<SiteDatabasePanel
										playground={playground}
									/>
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.toolTabContents,
										{
											[css.tabHidden]:
												tab.name !== 'logs',
										}
									)}
									hidden={tab.name !== 'logs'}
								>
									<div
										className={classNames(css.logsWrapper)}
									>
										<SiteLogs className={css.logsSection} />
									</div>
								</div>
							</>
						)}
					</TabPanel>
				</FlexItem>
			</Flex>
		</section>
	);
}
