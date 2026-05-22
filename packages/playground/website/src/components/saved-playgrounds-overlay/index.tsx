import css from './style.module.css';
import classNames from 'classnames';
import {
	Spinner,
	DropdownMenu,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { moreVertical, plus, upload, link } from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { GitHubIcon } from '../../github/github';
import { useDispatch } from 'react-redux';
import { useState, useEffect, useRef } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { importWordPressFiles } from '@wp-playground/client';
import { logger } from '@php-wasm/logger';
import {
	useActiveSite,
	useAppSelector,
	useAppDispatch,
} from '../../lib/state/redux/store';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import type { SiteLogo, SiteInfo } from '../../lib/state/redux/slice-sites';
import {
	isAutosavedSite,
	isExplicitlySavedSite,
	MAX_AUTOSAVED_SITES,
	selectSortedSites,
	selectTemporarySite,
} from '../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToRename,
	setSiteSlugToDelete,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { WordPressIcon } from '@wp-playground/components';
import useFetch from '../../lib/hooks/use-fetch';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';
import {
	Overlay,
	OverlayHeader,
	OverlayBody,
	OverlaySection,
} from '../overlay';

/**
 * Maximum explicitly saved Playgrounds to show before collapsing the list.
 */
const MAX_VISIBLE_SAVED_SITES = 8;

type BlueprintsIndexEntry = {
	title: string;
	description: string;
	author: string;
	categories: string[];
	path: string;
	screenshot_url?: string;
	featured?: boolean;
};

export type OverlayViewMode = 'main' | 'blueprints';

interface SavedPlaygroundsOverlayProps {
	onClose: () => void;
	initialViewMode?: OverlayViewMode;
}

function PullRequestIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
		</svg>
	);
}

function GridIcon({ size = 20 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<path d="M1 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2zM1 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V7zM1 12a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2z" />
		</svg>
	);
}

/**
 * Displays saved Playgrounds, recent autosaves, and entry points for new sites.
 */
export function SavedPlaygroundsOverlay({
	onClose,
	initialViewMode = 'main',
}: SavedPlaygroundsOverlayProps) {
	const offline = useAppSelector((state) => state.ui.offline);
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const explicitlySavedSites = storedSites.filter(isExplicitlySavedSite);
	const autosavedSites = storedSites
		.filter(isAutosavedSite)
		.slice(0, MAX_AUTOSAVED_SITES);
	const temporarySite = useAppSelector(selectTemporarySite);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const modalDispatch: PlaygroundDispatch = useDispatch();
	const sitesAPI = useSitesAPI();
	const playground = usePlaygroundClient();
	const zipFileInputRef = useRef<HTMLInputElement>(null);

	const [viewMode, setViewMode] = useState<OverlayViewMode>(initialViewMode);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [showAllSavedSites, setShowAllSavedSites] = useState(false);
	const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);
	const [pendingZipTargetSlug, setPendingZipTargetSlug] = useState<
		string | null
	>(null);

	useEffect(() => {
		if (
			!pendingZipFile ||
			!playground ||
			!activeSite ||
			activeSite.slug !== pendingZipTargetSlug
		) {
			return;
		}

		const doImport = async () => {
			try {
				await importWordPressFiles(playground, {
					wordPressFilesZip: pendingZipFile,
				});
				setTimeout(async () => {
					await playground.goTo('/');
				}, 200);
				alert(
					'File imported! This Playground instance has been updated and will refresh shortly.'
				);
				onClose();
			} catch (error) {
				logger.error(error);
				alert(
					'Unable to import file. Is it a valid WordPress Playground export?'
				);
			} finally {
				setPendingZipFile(null);
				setPendingZipTargetSlug(null);
				if (zipFileInputRef.current) {
					zipFileInputRef.current.value = '';
				}
			}
		};
		doImport();
	}, [pendingZipFile, pendingZipTargetSlug, activeSite, playground, onClose]);

	/**
	 * Creates or selects a target Playground before importing a zip archive.
	 *
	 * Imports prefer a new OPFS-backed site so the result survives a refresh.
	 * If that cannot be created, the import falls back to an existing or new
	 * temporary site.
	 */
	async function createSiteForImport() {
		try {
			return await sitesAPI.createNewSavedSite();
		} catch {
			if (temporarySite) {
				await sitesAPI.setActiveSite(temporarySite.slug);
				return temporarySite.slug;
			}
			return await sitesAPI.createNewTemporarySite();
		}
	}

	const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const targetSlug = await createSiteForImport();
			setPendingZipTargetSlug(targetSlug);
			setPendingZipFile(file);
		} catch (error) {
			logger.error(error);
			alert(
				'No active Playground to import into. Please create one first.'
			);
			if (zipFileInputRef.current) {
				zipFileInputRef.current.value = '';
			}
		}
	};

	const {
		data: blueprintsData,
		isLoading: blueprintsLoading,
		isError: blueprintsError,
	} = useFetch<Record<string, BlueprintsIndexEntry>>(
		'https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json'
	);

	const allBlueprints: BlueprintsIndexEntry[] = blueprintsData
		? Object.entries(blueprintsData).map(([path, entry]) => ({
				...entry,
				path,
			}))
		: [];

	const previewBlueprints = allBlueprints.slice(0, 5);

	const tagCounts = new Map<string, number>();
	allBlueprints.forEach((b) => {
		(b.categories || []).forEach((tag) => {
			tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
		});
	});
	const allTags = Array.from(tagCounts.keys())
		.filter((tag) => tag.substring(0, 1).match(/^[A-Z]$/))
		.sort((a, b) => {
			const countDiff = (tagCounts.get(b) || 0) - (tagCounts.get(a) || 0);
			if (countDiff !== 0) return countDiff;
			return 0;
		});

	const filteredBlueprints = allBlueprints.filter((blueprint) => {
		const query = searchQuery.toLowerCase();
		const matchesSearch =
			!searchQuery ||
			blueprint.title.toLowerCase().includes(query) ||
			blueprint.description.toLowerCase().includes(query) ||
			blueprint.categories?.some((cat) =>
				cat.toLowerCase().includes(query)
			);

		const matchesTag =
			!selectedTag ||
			(selectedTag === 'Featured'
				? blueprint.featured === true
				: blueprint.categories?.includes(selectedTag));

		return matchesSearch && matchesTag;
	});

	const onSiteClick = (slug: string) => {
		dispatch(setSiteManagerSection('site-details'));
		onClose();
		void sitesAPI.setActiveSite(slug).catch((error) => {
			logger.error('Error opening saved Playground', error);
		});
	};

	const getLogoDataURL = (logo: SiteLogo): string => {
		return `data:${logo.mime};base64,${logo.data}`;
	};

	const handleDeleteSite = (site: SiteInfo, closeMenu: () => void) => {
		dispatch(setSiteSlugToDelete(site.slug));
		modalDispatch(setActiveModal(modalSlugs.DELETE_SITE));
		closeMenu();
	};

	const handleRenameSite = (site: SiteInfo, closeMenu: () => void) => {
		dispatch(setSiteSlugToRename(site.slug));
		modalDispatch(setActiveModal(modalSlugs.RENAME_SITE));
		closeMenu();
	};

	const handleKeepSite = async (site: SiteInfo, closeMenu?: () => void) => {
		await sitesAPI.keep(site.slug);
		closeMenu?.();
	};

	const getStoredSiteDetails = (site: SiteInfo) => {
		if (isAutosavedSite(site)) {
			return 'Recovery copy';
		}
		if (site.metadata.storage === 'local-fs') {
			return 'Saved in a local directory';
		}
		return 'Saved in this browser';
	};

	/**
	 * Opens the selected Blueprint as a fresh Playground that may be autosaved.
	 *
	 * Intentionally uses `newSite()` instead of `newTemporarySite()` so
	 * in-app Blueprint previews follow the default browser autosave policy.
	 */
	function previewBlueprint(blueprintPath: BlueprintsIndexEntry['path']) {
		dispatch(setSiteManagerOpen(false));
		redirectTo(
			PlaygroundRoute.newSite({
				query: {
					name: 'Blueprint preview',
					'blueprint-url': `https://raw.githubusercontent.com/WordPress/blueprints/trunk/${blueprintPath.replace(
						/^\//,
						''
					)}`,
				},
			})
		);
		onClose();
	}

	function createVanillaSite() {
		dispatch(setSiteManagerOpen(false));
		// "New Playground" means start fresh. The URL change makes the
		// selected-site guard handle this as an in-app new-site navigation.
		redirectTo(PlaygroundRoute.newSite());
		onClose();
	}

	const creationOptions = [
		{
			id: 'vanilla',
			title: 'New Playground',
			icon: plus,
			iconSize: 56,
			onClick: createVanillaSite,
			disabled: false,
		},
		{
			id: 'wp-pr',
			title: 'Preview a WordPress PR',
			iconComponent: <PullRequestIcon />,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.PREVIEW_PR_WP));
			},
			disabled: offline,
		},
		{
			id: 'gutenberg-pr',
			title: 'Preview a Gutenberg PR',
			iconComponent: <PullRequestIcon />,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.PREVIEW_PR_GUTENBERG));
			},
			disabled: offline,
		},
		{
			id: 'github',
			title: 'Import from GitHub',
			iconComponent: GitHubIcon,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.GITHUB_IMPORT));
			},
			disabled: offline,
		},
		{
			id: 'blueprint-url',
			title: 'Open a Blueprint URL',
			icon: link,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.BLUEPRINT_URL));
			},
			disabled: offline,
		},
		{
			id: 'zip',
			title: 'Import a .zip',
			icon: upload,
			onClick: () => {
				zipFileInputRef.current?.click();
			},
			disabled: false,
		},
	];

	const visibleSavedSites = showAllSavedSites
		? explicitlySavedSites
		: explicitlySavedSites.slice(0, MAX_VISIBLE_SAVED_SITES);
	const hiddenSavedSitesCount =
		explicitlySavedSites.length - visibleSavedSites.length;

	function formatSiteCreatedDate(site: SiteInfo) {
		return site.metadata.whenCreated
			? new Date(site.metadata.whenCreated).toLocaleDateString(
					undefined,
					{
						year: 'numeric',
						month: 'short',
						day: 'numeric',
					}
				)
			: undefined;
	}

	function renderSiteRow(site: SiteInfo) {
		const isSelected = site.slug === activeSite?.slug;
		const isAutosave = isAutosavedSite(site);
		const createdDate = formatSiteCreatedDate(site);

		return (
			<div
				key={site.slug}
				className={classNames(css.siteRow, {
					[css.siteRowSelected]: isSelected,
				})}
			>
				<button
					className={css.siteRowContent}
					onClick={() => onSiteClick(site.slug)}
				>
					<div className={css.siteRowLogo}>
						{site.metadata.logo ? (
							<img
								src={getLogoDataURL(site.metadata.logo)}
								alt=""
							/>
						) : (
							<WordPressIcon />
						)}
					</div>
					<div className={css.siteRowInfo}>
						<span className={css.siteRowName}>
							{site.metadata.name}
						</span>
						<span className={css.siteRowDate}>
							{getStoredSiteDetails(site)}
							{createdDate ? ` - Created ${createdDate}` : ''}
						</span>
					</div>
				</button>
				<div className={css.siteRowActions}>
					{isAutosave && (
						<button
							type="button"
							className={css.keepButton}
							onClick={() => handleKeepSite(site)}
							title="Store this Playground permanently so it is not pruned from recent autosaves."
						>
							Store permanently
						</button>
					)}
					<DropdownMenu
						icon={moreVertical}
						label="Site actions"
						className={css.siteRowMenu}
						popoverProps={{
							placement: 'bottom-end',
						}}
					>
						{({ onClose: closeMenu }) => (
							<>
								<MenuGroup>
									{isAutosave && (
										<MenuItem
											onClick={() =>
												handleKeepSite(site, closeMenu)
											}
										>
											Store permanently
										</MenuItem>
									)}
									<MenuItem
										onClick={() =>
											handleRenameSite(site, closeMenu)
										}
									>
										Rename
									</MenuItem>
								</MenuGroup>
								<MenuGroup>
									<MenuItem
										className={css.dangerMenuItem}
										onClick={() =>
											handleDeleteSite(site, closeMenu)
										}
									>
										Delete
									</MenuItem>
								</MenuGroup>
							</>
						)}
					</DropdownMenu>
				</div>
			</div>
		);
	}

	function renderSavedPlaygroundsSection() {
		if (explicitlySavedSites.length === 0) {
			return null;
		}

		return (
			<OverlaySection title="Saved Playgrounds">
				<div className={css.sitesList}>
					{visibleSavedSites.map(renderSiteRow)}
				</div>
				{hiddenSavedSitesCount > 0 && (
					<button
						type="button"
						className={css.showMoreButton}
						onClick={() => setShowAllSavedSites(!showAllSavedSites)}
					>
						{showAllSavedSites
							? 'Show fewer saved Playgrounds'
							: `Show ${hiddenSavedSitesCount} more saved Playgrounds`}
					</button>
				)}
			</OverlaySection>
		);
	}

	function renderAutosavesSection() {
		if (autosavedSites.length === 0) {
			return null;
		}

		return (
			<OverlaySection
				title={`Last ${MAX_AUTOSAVED_SITES} autosaves`}
				description="Older autosaves are deleted automatically. Use Store permanently to keep one."
			>
				<div className={css.sitesList}>
					{autosavedSites.map(renderSiteRow)}
				</div>
			</OverlaySection>
		);
	}

	if (viewMode === 'blueprints') {
		return (
			<Overlay onClose={onClose}>
				<OverlayHeader
					onClose={onClose}
					onBack={() => {
						setViewMode('main');
						setSearchQuery('');
						setSelectedTag(null);
					}}
					title="Blueprints"
					showLogo={false}
				/>
				<div className={css.filtersBar}>
					<div className={css.tagsContainer}>
						<button
							className={classNames(css.tagButton, {
								[css.tagButtonActive]: selectedTag === null,
							})}
							onClick={() => setSelectedTag(null)}
						>
							All
						</button>
						<button
							className={classNames(css.tagButton, {
								[css.tagButtonActive]:
									selectedTag === 'Featured',
							})}
							onClick={() =>
								setSelectedTag(
									selectedTag === 'Featured'
										? null
										: 'Featured'
								)
							}
						>
							Featured
						</button>
						{allTags.slice(0, 8).map((tag) => (
							<button
								key={tag}
								className={classNames(css.tagButton, {
									[css.tagButtonActive]: selectedTag === tag,
								})}
								onClick={() =>
									setSelectedTag(
										selectedTag === tag ? null : tag
									)
								}
							>
								{tag}
							</button>
						))}
					</div>
					<div className={css.searchWrapper}>
						<div className={css.searchIcon}>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.35-4.35" />
							</svg>
						</div>
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search Blueprints"
							className={css.searchField}
							autoFocus
						/>
					</div>
				</div>
				<OverlayBody>
					<OverlaySection
						title={
							selectedTag || searchQuery
								? `Showing ${filteredBlueprints.length} of ${allBlueprints.length} blueprints`
								: `Showing all ${filteredBlueprints.length} blueprints`
						}
					>
						{blueprintsLoading ? (
							<div className={css.loadingContainer}>
								<Spinner />
							</div>
						) : blueprintsError ? (
							<p className={css.emptyMessage}>
								Unable to load blueprints. Check your
								connection.
							</p>
						) : filteredBlueprints.length === 0 ? (
							<p className={css.emptyMessage}>
								No blueprints found matching your criteria.
							</p>
						) : (
							<div className={css.blueprintsFullGrid}>
								{filteredBlueprints.map((blueprint) => (
									<button
										key={blueprint.path}
										className={css.blueprintCard}
										onClick={() =>
											previewBlueprint(blueprint.path)
										}
									>
										<div className={css.blueprintThumbnail}>
											{blueprint.screenshot_url ? (
												<img
													src={
														blueprint.screenshot_url
													}
													alt=""
													loading="lazy"
												/>
											) : (
												<div
													className={
														css.blueprintPlaceholder
													}
												>
													<WordPressIcon />
												</div>
											)}
										</div>
										<div className={css.blueprintInfo}>
											<h3 className={css.blueprintTitle}>
												{blueprint.title}
											</h3>
											<p
												className={
													css.blueprintDescription
												}
											>
												{blueprint.description}
											</p>
											{blueprint.categories &&
												blueprint.categories.length >
													0 && (
													<div
														className={
															css.blueprintTags
														}
													>
														{blueprint.categories
															.slice(0, 3)
															.map((tag) => (
																<span
																	key={tag}
																	className={
																		css.blueprintTag
																	}
																>
																	{tag}
																</span>
															))}
													</div>
												)}
										</div>
									</button>
								))}
							</div>
						)}
					</OverlaySection>
				</OverlayBody>
			</Overlay>
		);
	}

	return (
		<Overlay onClose={onClose}>
			<input
				type="file"
				ref={zipFileInputRef}
				onChange={handleImportZip}
				accept=".zip,application/zip"
				style={{ display: 'none' }}
			/>
			<OverlayHeader onClose={onClose} />
			<OverlayBody>
				<OverlaySection title="Start a new Playground">
					<div className={css.creationRow}>
						{creationOptions.map((option) => {
							const hasIcon =
								'iconComponent' in option || 'icon' in option;
							return (
								<button
									key={option.id}
									className={css.creationButton}
									onClick={option.onClick}
									disabled={option.disabled}
								>
									{hasIcon && (
										<span
											className={classNames(
												css.creationIcon,
												option.id === 'vanilla'
													? css.newPlaygroundIcon
													: undefined
											)}
										>
											{'iconComponent' in option ? (
												option.iconComponent
											) : 'icon' in option ? (
												<Icon
													icon={option.icon!}
													size={
														'iconSize' in option
															? option.iconSize
															: 24
													}
												/>
											) : null}
										</span>
									)}
									<span className={css.creationTitle}>
										{option.title}
									</span>
								</button>
							);
						})}
					</div>
				</OverlaySection>

				<OverlaySection title="Start from a Blueprint">
					{blueprintsLoading ? (
						<div className={css.loadingContainer}>
							<Spinner />
						</div>
					) : blueprintsError ? (
						<p className={css.emptyMessage}>
							Unable to load blueprints. Check your connection.
						</p>
					) : (
						<div className={css.blueprintsRow}>
							{previewBlueprints.map((blueprint) => (
								<button
									key={blueprint.path}
									className={css.blueprintPreviewCard}
									onClick={() =>
										previewBlueprint(blueprint.path)
									}
								>
									<div
										className={
											css.blueprintPreviewThumbnail
										}
									>
										{blueprint.screenshot_url ? (
											<img
												src={blueprint.screenshot_url}
												alt=""
												loading="lazy"
											/>
										) : (
											<div
												className={
													css.blueprintPlaceholder
												}
											>
												<WordPressIcon />
											</div>
										)}
									</div>
									<span className={css.blueprintPreviewTitle}>
										{blueprint.title}
									</span>
								</button>
							))}
							<button
								className={css.blueprintPreviewCard}
								onClick={() => setViewMode('blueprints')}
							>
								<div
									className={classNames(
										css.blueprintPreviewThumbnail,
										css.viewAllThumbnail
									)}
								>
									<GridIcon size={50} />
								</div>
								<span className={css.blueprintPreviewTitle}>
									View all {allBlueprints.length} blueprints
								</span>
							</button>
						</div>
					)}
				</OverlaySection>

				{renderAutosavesSection()}
				{renderSavedPlaygroundsSection()}
			</OverlayBody>
		</Overlay>
	);
}
