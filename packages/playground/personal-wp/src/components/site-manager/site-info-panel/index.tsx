import { Button, Flex, FlexItem, Icon, TabPanel } from '@wordpress/components';
import { chevronLeft } from '@wordpress/icons';
import classNames from 'classnames';
import { lazy, Suspense, useEffect, useState } from 'react';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { setSiteManagerOpen } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { usePlaygroundClientInfo } from '../../../lib/use-playground-client';
import { SiteLogs } from '../../log-modal';
import { SiteDatabasePanel } from '../site-database-panel';
import css from './style.module.css';

const SiteFileBrowser = lazy(() =>
	import('../site-file-browser').then((m) => ({ default: m.SiteFileBrowser }))
);

const LAST_TAB_STORAGE_KEY = 'playground-site-last-tabs';

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
	siteViewHidden,
}: {
	className: string;
	site: SiteInfo;
	mobileUi?: boolean;
	siteViewHidden?: boolean;
}) {
	const dispatch = useAppDispatch();

	// Load the last active tab for this site
	const [initialTabName] = useState(() => {
		const lastTab = getSiteLastTab(site.slug);
		// Only allow tabs that exist in our simplified panel
		if (lastTab && ['files', 'database', 'logs'].includes(lastTab)) {
			return lastTab;
		}
		return 'files';
	});

	// Resolve documentRoot from playground client, or use fallback for direct OPFS access
	// Initialize to "/" for OPFS sites so the file browser can render immediately
	const [documentRoot, setDocumentRoot] = useState<string | null>(
		site.metadata.storage === 'opfs' ? '/' : null
	);

	// Save the tab when it changes
	const handleTabSelect = (tabName: string) => {
		setSiteLastTab(site.slug, tabName);
	};

	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	const playground = clientInfo?.client;

	// Resolve documentRoot from playground, or use fallback for direct OPFS access
	useEffect(() => {
		if (playground) {
			void playground.documentRoot.then((root) => {
				setDocumentRoot(root);
			});
		} else if (site.metadata.storage === 'opfs') {
			// When accessing OPFS directly (no client), the root is "/".
			// This also handles the case where playground becomes null after being set
			// (e.g., site crashes mid-session), resetting documentRoot for direct OPFS access.
			setDocumentRoot('/');
		} else {
			setDocumentRoot(null);
		}
	}, [playground, site.metadata.storage]);

	function navigateTo(path: string) {
		if (siteViewHidden) {
			dispatch(setSiteManagerOpen(false));
		}

		if (playground) {
			playground.goTo(path);
		}
	}

	usePlaygroundClientInfo(site.slug);

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
				<FlexItem style={{ flexShrink: 0 }}>
					<Flex
						direction="row"
						gap={2}
						justify="space-between"
						align="flex-start"
						expanded={true}
						className={`${css.padded} ${css.siteInfoHeader}`}
						style={{ paddingBottom: 10 }}
					>
						{mobileUi && (
							<FlexItem style={{ marginLeft: -20 }}>
								<Button
									variant="link"
									label="Back to Playground"
									icon={() => (
										<Icon icon={chevronLeft} size={38} />
									)}
									className={css.grayLinkDark}
									onClick={() => {
										dispatch(setSiteManagerOpen(false));
									}}
								/>
							</FlexItem>
						)}
						<FlexItem style={{ flexGrow: 1 }}>
							<h2 className={css.siteInfoHeaderDetailsName}>
								Site Tools
							</h2>
						</FlexItem>
						{mobileUi ? (
							<FlexItem style={{ flexShrink: 0 }}>
								<Button
									variant="primary"
									onClick={() => {
										dispatch(setSiteManagerOpen(false));
									}}
								>
									Open site
								</Button>
							</FlexItem>
						) : (
							<>
								<FlexItem className={css.siteInfoHeaderAction}>
									<Button
										variant="tertiary"
										disabled={!playground}
										onClick={() => navigateTo('/wp-admin/')}
									>
										WP Admin
									</Button>
								</FlexItem>
								<FlexItem className={css.siteInfoHeaderAction}>
									<Button
										variant="secondary"
										disabled={!playground}
										onClick={() => navigateTo('/')}
									>
										Homepage
									</Button>
								</FlexItem>
							</>
						)}
					</Flex>
				</FlexItem>
				<FlexItem style={{ flexGrow: 1 }}>
					<TabPanel
						className={css.tabs}
						initialTabName={initialTabName}
						onSelect={handleTabSelect}
						tabs={[
							{
								name: 'files',
								title: 'Files',
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
											<div className={css.padded}>
												Loading file browser...
											</div>
										}
									>
										{documentRoot && (
											<SiteFileBrowser
												key={site.slug}
												site={site}
												isVisible={tab.name === 'files'}
												documentRoot={documentRoot}
											/>
										)}
									</Suspense>
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.padded,
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
										css.padded,
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
