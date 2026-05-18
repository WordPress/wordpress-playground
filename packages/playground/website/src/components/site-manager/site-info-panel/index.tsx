import {
	Button,
	DropdownMenu,
	Flex,
	FlexItem,
	Icon,
	MenuGroup,
	MenuItem,
	TabPanel,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { chevronLeft, edit, moreVertical } from '@wordpress/icons';
import { getLogoDataURL, WordPressIcon } from '@wp-playground/components';
import classNames from 'classnames';
import { lazy, Suspense, useEffect, useState } from 'react';
import { getRelativeDate } from '../../../lib/get-relative-date';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteSlugToDelete,
	setSiteSlugToRename,
} from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { usePlaygroundClientInfo } from '../../../lib/use-playground-client';
import { SiteLogs } from '../../log-modal';
import { OfflineNotice } from '../../offline-notice';
import { DownloadAsZipMenuItem } from '../../toolbar-buttons/download-as-zip';
import { GithubExportMenuItem } from '../../toolbar-buttons/github-export-menu-item';
import { SiteDatabasePanel } from '../site-database-panel';
import { ActiveSiteSettingsForm } from '../site-settings-form/active-site-settings-form';
import { TemporarySiteNotice } from '../temporary-site-notice';
import css from './style.module.css';

const SiteFileBrowser = lazy(() =>
	import('../site-file-browser').then((m) => ({ default: m.SiteFileBrowser }))
);

const AutosavedBlueprintBundleEditor = lazy(() =>
	import('../../blueprint-editor/AutosavedBlueprintBundleEditor').then(
		(m) => ({
			default: m.AutosavedBlueprintBundleEditor,
		})
	)
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

	const isTemporary = site.metadata.storage === 'none';

	const removeSiteAndCloseMenu = (onClose: () => void) => {
		dispatch(setSiteSlugToDelete(site.slug));
		dispatch(setActiveModal(modalSlugs.DELETE_SITE));
		onClose();
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

	function navigateTo(path: string) {
		if (siteViewHidden) {
			// Close the site manager so the site view is visible.
			dispatch(setSiteManagerOpen(false));
		}

		if (playground) {
			playground.goTo(path);
		}
	}

	const { opfsMountDescriptor } = usePlaygroundClientInfo(site.slug) || {};

	const localDirName =
		site.metadata?.storage === 'local-fs'
			? (opfsMountDescriptor as any)?.device?.handle?.name
			: undefined;

	const title = isTemporary
		? __('Unsaved Playground', 'playground-website')
		: site.metadata.name;
	const titleWords = title.split(' ');
	const titleStart = titleWords.slice(0, -1).join(' ');
	const titleEnd = titleWords[titleWords.length - 1];

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
									label={__(
										'Back to Playground',
										'playground-website'
									)}
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
						<FlexItem className={css.siteInfoHeaderIcon}>
							{site.metadata.logo ? (
								<img
									src={getLogoDataURL(site.metadata.logo)}
									alt={sprintf(
										__('%s logo', 'playground-website'),
										site.metadata.name
									)}
								/>
							) : (
								<WordPressIcon
									className={css.siteInfoHeaderIconDefault}
								/>
							)}
						</FlexItem>
						<FlexItem style={{ flexGrow: 1 }}>
							<Flex direction="column" gap={0.25} expanded={true}>
								<Flex
									direction="row"
									align="flex-start"
									className={css.siteInfoHeaderTitleRow}
								>
									<FlexItem
										className={css.siteInfoHeaderTitle}
									>
										<h1
											className={
												css.siteInfoHeaderDetailsName
											}
											aria-label={__(
												'Playground title',
												'playground-website'
											)}
										>
											<span
												className={
													css.siteInfoHeaderDetailsNameText
												}
											>
												{titleStart}{' '}
												<span
													className={
														css.siteInfoHeaderDetailsNameTextEnd
													}
												>
													{titleEnd}
													{!isTemporary && (
														<Button
															className={
																css.siteInfoRenameButton
															}
															icon={edit}
															label={__(
																'Rename Playground',
																'playground-website'
															)}
															showTooltip={true}
															variant="tertiary"
															isSmall={true}
															onClick={() => {
																dispatch(
																	setSiteSlugToRename(
																		site.slug
																	)
																);
																dispatch(
																	setActiveModal(
																		modalSlugs.RENAME_SITE
																	)
																);
															}}
														/>
													)}
												</span>
											</span>
										</h1>
									</FlexItem>
								</Flex>
								{!isTemporary && (
									<span
										className={
											css.siteInfoHeaderDetailsCreatedAt
										}
									>
										{(function () {
											const createdAgo = site.metadata
												.whenCreated
												? getRelativeDate(
														new Date(
															// -2 to make sure it's in the past. We want to
															// avoid accidentally signaling this happened in
															// the future, e.g. "in 1 seconds"
															site.metadata
																.whenCreated - 2
														)
													)
												: '';
											switch (site.metadata.storage) {
												case 'local-fs':
													return localDirName
														? sprintf(
																__(
																	'Saved in a local directory (%1$s) %2$s',
																	'playground-website'
																),
																localDirName,
																createdAgo
															)
														: sprintf(
																__(
																	'Saved in a local directory %s',
																	'playground-website'
																),
																createdAgo
															);
												case 'opfs':
													return sprintf(
														__(
															'Saved in this browser %s',
															'playground-website'
														),
														createdAgo
													);
											}
										})()}{' '}
									</span>
								)}
							</Flex>
						</FlexItem>
						{mobileUi ? (
							<FlexItem style={{ flexShrink: 0 }}>
								<Button
									variant="primary"
									onClick={() => {
										dispatch(setSiteManagerOpen(false));
									}}
								>
									{__('Open site', 'playground-website')}
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
										{__('WP Admin', 'playground-website')}
									</Button>
								</FlexItem>
								<FlexItem className={css.siteInfoHeaderAction}>
									<Button
										variant="secondary"
										disabled={!playground}
										onClick={() => navigateTo('/')}
									>
										{__('Homepage', 'playground-website')}
									</Button>
								</FlexItem>
							</>
						)}
						<FlexItem className={css.siteInfoHeaderAction}>
							<DropdownMenu
								icon={moreVertical}
								label={__(
									'Additional actions',
									'playground-website'
								)}
								popoverProps={{
									placement: 'bottom-end',
								}}
							>
								{({ onClose }) => (
									<>
										{!isTemporary && (
											<MenuGroup>
												<MenuItem
													aria-label={__(
														'Delete this Playground',
														'playground-website'
													)}
													className={css.danger}
													onClick={() =>
														removeSiteAndCloseMenu(
															onClose
														)
													}
												>
													{__(
														'Delete',
														'playground-website'
													)}
												</MenuItem>
											</MenuGroup>
										)}
										<MenuGroup>
											<GithubExportMenuItem
												onClose={onClose}
												disabled={
													offline || !playground
												}
											/>
											<DownloadAsZipMenuItem
												onClose={onClose}
												disabled={!playground}
											/>
										</MenuGroup>
									</>
								)}
							</DropdownMenu>
						</FlexItem>
					</Flex>
				</FlexItem>
				<FlexItem style={{ flexGrow: 1 }}>
					<TabPanel
						className={css.tabs}
						initialTabName={initialTabName}
						onSelect={handleTabSelect}
						tabs={[
							{
								name: 'settings',
								title: __('Settings', 'playground-website'),
							},
							{
								name: 'files',
								title: __('File browser', 'playground-website'),
							},
							{
								name: 'blueprint',
								title: __('Blueprint', 'playground-website'),
							},
							{
								name: 'database',
								title: __('Database', 'playground-website'),
							},
							{
								name: 'logs',
								title: __('Logs', 'playground-website'),
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

									{isTemporary ? (
										<div data-testid="temporary-site-notice">
											<TemporarySiteNotice
												className={css.siteNotice}
											/>
										</div>
									) : null}

									<ActiveSiteSettingsForm />
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
											<div className={css.padded}>
												{__(
													'Loading file browser...',
													'playground-website'
												)}
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
										css.blueprintWrapper,
										{
											[css.tabHidden]:
												tab.name !== 'blueprint',
										}
									)}
									hidden={tab.name !== 'blueprint'}
								>
									{!isTemporary && (
										<div className={css.blueprintNotice}>
											{__(
												'This Blueprint is read-only for saved Playgrounds. Create an Unsaved Playground to edit and test Blueprint changes.',
												'playground-website'
											)}
										</div>
									)}
									<Suspense
										fallback={
											<div>
												{__(
													'Loading Blueprint editor...',
													'playground-website'
												)}
											</div>
										}
									>
										<AutosavedBlueprintBundleEditor
											key={site.slug}
											site={site}
											isVisible={tab.name === 'blueprint'}
											className={classNames(
												css.blueprintEditor
											)}
										/>
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
