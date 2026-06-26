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
import { chevronLeft, edit, moreVertical } from '@wordpress/icons';
import { getLogoDataURL, WordPressIcon } from '@wp-playground/components';
import classNames from 'classnames';
import {
	lazy,
	Suspense,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { getRelativeDate } from '../../../lib/get-relative-date';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import {
	isAutosavedSite,
	isExplicitlySavedSite,
	MAX_AUTOSAVED_SITES,
} from '../../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteSlugToDelete,
	setSiteSlugToRename,
	setSiteSlugToSave,
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

const SiteBlueprintBundleEditor = lazy(() =>
	import('../../blueprint-editor/SiteBlueprintBundleEditor').then((m) => ({
		default: m.SiteBlueprintBundleEditor,
	}))
);

const LAST_TAB_STORAGE_KEY = 'playground-site-last-tabs';
type HeaderAction = {
	key: string;
	label: string;
	variant: 'primary' | 'secondary' | 'tertiary';
	disabled?: boolean;
	onClick: () => void;
};
const HEADER_ACTIONS_TITLE_GAP = 32;
const HEADER_TITLE_MIN_WIDTH_WITH_ACTIONS = 224;
const MOBILE_HEADER_TITLE_MIN_WIDTH_WITH_ACTIONS = 160;

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
	const [visibleHeaderActionCount, setVisibleHeaderActionCount] = useState(
		Number.MAX_SAFE_INTEGER
	);
	const headerRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const headerWidthRef = useRef<number | null>(null);
	const [headerResizeTick, setHeaderResizeTick] = useState(0);

	// Resolve documentRoot from playground client
	const [documentRoot, setDocumentRoot] = useState<string | null>(null);

	// Save the tab when it changes
	const handleTabSelect = (tabName: string) => {
		setSiteLastTab(site.slug, tabName);
	};

	const isTemporary = site.metadata.storage === 'none';
	const isAutosaved = isAutosavedSite(site);
	const isBlueprintReadOnly = isExplicitlySavedSite(site);

	const removeSiteAndCloseMenu = (onClose: () => void) => {
		dispatch(setSiteSlugToDelete(site.slug));
		dispatch(setActiveModal(modalSlugs.DELETE_SITE));
		onClose();
	};
	const openSaveModal = () => {
		dispatch(setSiteSlugToSave(site.slug));
		dispatch(setActiveModal(modalSlugs.SAVE_SITE));
	};
	const openSite = () => {
		dispatch(setSiteManagerOpen(false));
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

	const title = isTemporary ? 'Unsaved Playground' : site.metadata.name;
	const titleWords = title.split(' ');
	const titleStart = titleWords.slice(0, -1).join(' ');
	const titleEnd = titleWords[titleWords.length - 1];
	const createdAgo = site.metadata.whenCreated
		? getRelativeDate(
				new Date(
					// -2 to make sure it's in the past. We want to avoid
					// accidentally signaling this happened in the future,
					// e.g. "in 1 seconds"
					site.metadata.whenCreated - 2
				)
			)
		: '';
	let siteSavedStatus: string | undefined;
	switch (site.metadata.storage) {
		case 'local-fs':
			siteSavedStatus =
				'Saved in a local directory' +
				(localDirName ? ` (${localDirName})` : '') +
				` ${createdAgo}`;
			break;
		case 'opfs':
			siteSavedStatus = isAutosaved
				? `Autosaved in this browser ${createdAgo}. Removed after ${MAX_AUTOSAVED_SITES} newer autosaves unless saved.`
				: `Saved in this browser ${createdAgo}`;
			break;
	}
	const headerActions: HeaderAction[] = [];
	if (isAutosaved) {
		headerActions.push({
			key: 'store-permanently',
			label: 'Store permanently',
			variant: 'primary',
			onClick: openSaveModal,
		});
	}
	if (mobileUi) {
		headerActions.push({
			key: 'open-site',
			label: 'Open site',
			variant: 'primary',
			onClick: openSite,
		});
	} else {
		headerActions.push(
			{
				key: 'wp-admin',
				label: 'WP Admin',
				variant: 'tertiary',
				disabled: !playground,
				onClick: () => navigateTo('/wp-admin/'),
			},
			{
				key: 'homepage',
				label: 'Homepage',
				variant: 'secondary',
				disabled: !playground,
				onClick: () => navigateTo('/'),
			}
		);
	}
	const visibleHeaderActions = headerActions.slice(
		0,
		visibleHeaderActionCount
	);
	const overflowHeaderActions = headerActions.slice(visibleHeaderActionCount);

	useLayoutEffect(() => {
		const header = headerRef.current;
		if (!header || typeof ResizeObserver === 'undefined') {
			return;
		}

		headerWidthRef.current = null;
		setVisibleHeaderActionCount(headerActions.length);
		const updateHeaderActionVisibility = (width: number) => {
			if (headerWidthRef.current === width) {
				return;
			}
			const previousWidth = headerWidthRef.current;
			headerWidthRef.current = width;
			setHeaderResizeTick((tick) => tick + 1);

			if (previousWidth !== null && width > previousWidth) {
				setVisibleHeaderActionCount(headerActions.length);
			}
		};

		updateHeaderActionVisibility(header.getBoundingClientRect().width);
		const observer = new ResizeObserver((entries) => {
			updateHeaderActionVisibility(entries[0].contentRect.width);
		});
		observer.observe(header);
		return () => {
			observer.disconnect();
		};
	}, [headerActions.length, mobileUi, title]);

	useLayoutEffect(() => {
		if (visibleHeaderActionCount === 0) {
			return;
		}

		const titleBox = titleRef.current?.getBoundingClientRect();
		const actionButtons = Array.from(
			headerRef.current?.querySelectorAll(
				'[data-header-primary-actions] button'
			) || []
		);
		if (!titleBox || !actionButtons.length) {
			return;
		}

		const minTitleWidth = mobileUi
			? MOBILE_HEADER_TITLE_MIN_WIDTH_WITH_ACTIONS
			: HEADER_TITLE_MIN_WIDTH_WITH_ACTIONS;
		const headerIsCramped =
			titleBox.width < minTitleWidth ||
			actionButtons.some((button) => {
				const buttonBox = button.getBoundingClientRect();
				return (
					titleBox.left < buttonBox.right &&
					titleBox.right > buttonBox.left &&
					titleBox.right + HEADER_ACTIONS_TITLE_GAP >
						buttonBox.left &&
					titleBox.top < buttonBox.bottom &&
					titleBox.bottom > buttonBox.top
				);
			});

		if (!headerIsCramped) {
			return;
		}

		setVisibleHeaderActionCount((current) =>
			Math.max(0, Math.min(current, headerActions.length) - 1)
		);
	}, [
		headerActions.length,
		headerResizeTick,
		mobileUi,
		title,
		visibleHeaderActionCount,
	]);

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
						ref={headerRef}
						direction="row"
						gap={2}
						justify="space-between"
						align="flex-start"
						expanded={true}
						className={`${css.padded} ${css.siteInfoHeader}`}
						style={{ paddingBottom: 10 }}
					>
						{mobileUi && (
							<FlexItem
								className={css.siteInfoHeaderBack}
								style={{ marginLeft: -20 }}
							>
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
						<FlexItem className={css.siteInfoHeaderIcon}>
							{site.metadata.logo ? (
								<img
									src={getLogoDataURL(site.metadata.logo)}
									alt={site.metadata.name + ' logo'}
								/>
							) : (
								<WordPressIcon
									className={css.siteInfoHeaderIconDefault}
								/>
							)}
						</FlexItem>
						<FlexItem className={css.siteInfoHeaderDetails}>
							<h1
								ref={titleRef}
								className={css.siteInfoHeaderDetailsName}
								aria-label="Playground title"
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
												label="Rename Playground"
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
						<FlexItem className={css.siteInfoHeaderPrimaryActions}>
							<div
								className={css.siteInfoHeaderPrimaryActionsList}
								data-header-primary-actions
							>
								{visibleHeaderActions.map((action) => (
									<Button
										key={action.key}
										variant={action.variant}
										disabled={action.disabled}
										onClick={action.onClick}
									>
										{action.label}
									</Button>
								))}
							</div>
						</FlexItem>
						<FlexItem className={css.siteInfoHeaderMenu}>
							<DropdownMenu
								icon={moreVertical}
								label="Additional actions"
								popoverProps={{
									placement: 'bottom-end',
								}}
							>
								{({ onClose }) => (
									<>
										{overflowHeaderActions.length > 0 && (
											<MenuGroup>
												{overflowHeaderActions.map(
													(action) => (
														<MenuItem
															key={action.key}
															disabled={
																action.disabled
															}
															onClick={() => {
																action.onClick();
																onClose();
															}}
														>
															{action.label}
														</MenuItem>
													)
												)}
											</MenuGroup>
										)}
										{!isTemporary && (
											<MenuGroup>
												<MenuItem
													aria-label="Delete this Playground"
													className={css.danger}
													onClick={() =>
														removeSiteAndCloseMenu(
															onClose
														)
													}
												>
													Delete
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
						<FlexItem className={css.siteInfoHeaderDescription}>
							{!isTemporary && siteSavedStatus && (
								<span
									className={
										css.siteInfoHeaderDetailsCreatedAt
									}
								>
									{siteSavedStatus}
								</span>
							)}
						</FlexItem>
					</Flex>
				</FlexItem>
				<FlexItem className={css.tabPanelWrapper}>
					<TabPanel
						className={css.tabs}
						initialTabName={initialTabName}
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
										css.blueprintWrapper,
										{
											[css.tabHidden]:
												tab.name !== 'blueprint',
										}
									)}
									hidden={tab.name !== 'blueprint'}
								>
									{isBlueprintReadOnly && (
										<div className={css.blueprintNotice}>
											This Blueprint is read-only for
											saved Playgrounds. Create an Unsaved
											Playground to edit and test
											Blueprint changes.
										</div>
									)}
									<Suspense
										fallback={
											<div>
												Loading Blueprint editor...
											</div>
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
