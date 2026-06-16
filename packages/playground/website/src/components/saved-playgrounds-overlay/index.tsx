import css from './style.module.css';
import classNames from 'classnames';
import {
	Spinner,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	TextControl,
	Button,
} from '@wordpress/components';
import {
	moreVertical,
	upload,
	link,
	close,
	pencil,
	layout,
} from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { GitHubIcon } from '../../github/github';
import PreviewPRForm from '../../github/preview-pr/form';
import GitHubImportForm from '../../github/github-import-form/form';
import vanillaScreenshot from './vanilla-wordpress.jpeg';
import { useState, useEffect, useRef } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { importWordPressFiles } from '@wp-playground/client';
import { logger } from '@php-wasm/logger';
import {
	useActiveSite,
	useAppSelector,
	useAppDispatch,
} from '../../lib/state/redux/store';
import type { SiteLogo, SiteInfo } from '../../lib/state/redux/slice-sites';
import {
	isAutosavedSite,
	isExplicitlySavedSite,
	selectSortedSites,
	selectTemporarySite,
} from '../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteSlugToRename,
	setSiteSlugToDelete,
	setSiteSlugToSave,
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

const COMPACT_LAYOUT_QUERY = '(max-width: 875px)';
const MAX_VISIBLE_COMPACT_STORED_SITES = 2;

/**
 * Maximum stored Playgrounds to show before collapsing the dock pane list.
 */
const MAX_VISIBLE_STORED_SITES = 8;

type BlueprintsIndexEntry = {
	title: string;
	description: string;
	author: string;
	categories: string[];
	path: string;
	screenshot_url?: string;
	featured?: boolean;
	/**
	 * The synthetic "Vanilla WordPress" card. It is not a real Blueprint in the
	 * Blueprints repo — it starts a clean Playground and uses a screenshot kept
	 * (and CI-refreshed) in this package.
	 */
	isVanilla?: boolean;
};

/**
 * The default "Blueprint" gallery card. Starts a clean WordPress install rather
 * than resolving a Blueprint from the index, so its preview is a local,
 * CI-refreshed screenshot instead of one served from the Blueprints repo.
 */
const VANILLA_WORDPRESS_CARD: BlueprintsIndexEntry = {
	path: '__vanilla-wordpress__',
	title: 'Vanilla WordPress',
	description: 'A clean WordPress install — the default starting point.',
	author: 'WordPress',
	categories: [],
	featured: true,
	screenshot_url: vanillaScreenshot,
	isVanilla: true,
};

export type OverlayViewMode = 'main' | 'blueprints';

/**
 * The "New Playground" pane is a single tabbed surface: "Blueprint" (the
 * gallery, default) plus one tab per alternative way to start. Selecting a tab
 * swaps the panel below rather than opening a separate modal.
 */
type CreationTabId =
	| 'blueprint'
	| 'wp-pr'
	| 'gutenberg-pr'
	| 'github'
	| 'blueprint-url'
	| 'zip';

interface SavedPlaygroundsOverlayProps {
	onClose: () => void;
	initialViewMode?: OverlayViewMode;
	variant?: 'overlay' | 'pane';
	panel?: 'all' | 'playgrounds' | 'new';
}

export function SavedPlaygroundsPane({
	panel,
	initialViewMode = 'main',
}: {
	panel: 'playgrounds' | 'new';
	initialViewMode?: OverlayViewMode;
}) {
	const dispatch = useAppDispatch();
	return (
		<SavedPlaygroundsOverlay
			onClose={() => dispatch(setSiteManagerOpen(false))}
			initialViewMode={initialViewMode}
			variant="pane"
			panel={panel}
		/>
	);
}

function useIsCompactLayout() {
	const [isCompactLayout, setIsCompactLayout] = useState(() => {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia(COMPACT_LAYOUT_QUERY).matches
		);
	});

	useEffect(() => {
		const mediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY);
		const updateIsCompactLayout = () => {
			setIsCompactLayout(mediaQuery.matches);
		};

		updateIsCompactLayout();
		mediaQuery.addEventListener('change', updateIsCompactLayout);
		return () => {
			mediaQuery.removeEventListener('change', updateIsCompactLayout);
		};
	}, []);

	return isCompactLayout;
}

function PullRequestIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
		</svg>
	);
}

/**
 * Displays saved Playgrounds, recent autosaves, and entry points for new sites.
 */
export function SavedPlaygroundsOverlay({
	onClose,
	initialViewMode = 'main',
	variant = 'overlay',
	panel = 'all',
}: SavedPlaygroundsOverlayProps) {
	const offline = useAppSelector((state) => state.ui.offline);
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const temporarySite = useAppSelector(selectTemporarySite);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const playground = usePlaygroundClient();
	const zipFileInputRef = useRef<HTMLInputElement>(null);

	const [viewMode, setViewMode] = useState<OverlayViewMode>(initialViewMode);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [showAllStoredSites, setShowAllStoredSites] = useState(false);
	const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);
	const [pendingZipTargetSlug, setPendingZipTargetSlug] = useState<
		string | null
	>(null);
	const [activeCreationTab, setActiveCreationTab] =
		useState<CreationTabId>('blueprint');
	const [blueprintUrlInput, setBlueprintUrlInput] = useState('');
	const isCompactLayout = useIsCompactLayout();

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

	const allBlueprints: BlueprintsIndexEntry[] = [
		// Vanilla WordPress is always the first card and shows immediately, even
		// while the remote Blueprint index is still loading.
		VANILLA_WORDPRESS_CARD,
		...(blueprintsData
			? Object.entries(blueprintsData).map(([path, entry]) => ({
					...entry,
					path,
				}))
			: []),
	];

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
		// Just switch to the Playground and close the pane. We intentionally do
		// NOT change the dock section here: doing so made the closing pane
		// re-render as the "This Playground" settings pane mid-exit-animation,
		// which read as a confusing flash when restoring an autosaved Playground.
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
		dispatch(setActiveModal(modalSlugs.DELETE_SITE));
		closeMenu();
	};

	const handleRenameSite = (site: SiteInfo, closeMenu?: () => void) => {
		dispatch(setSiteSlugToRename(site.slug));
		dispatch(setActiveModal(modalSlugs.RENAME_SITE));
		closeMenu?.();
	};

	const openSaveModalForSite = (site: SiteInfo, closeMenu?: () => void) => {
		dispatch(setSiteSlugToSave(site.slug));
		dispatch(setActiveModal(modalSlugs.SAVE_SITE));
		closeMenu?.();
		onClose();
	};

	const getStoredSiteDetails = (site: SiteInfo) => {
		if (site.metadata.storage === 'none') {
			return 'Not saved to browser storage';
		}
		const createdDate = formatSiteCreatedDate(site);
		if (isAutosavedSite(site)) {
			return createdDate
				? `Autosaved · ${createdDate}`
				: 'Autosaved in this browser';
		}
		if (site.metadata.storage === 'local-fs') {
			return 'Saved in a local directory';
		}
		return createdDate ? `Saved · ${createdDate}` : 'Saved in this browser';
	};

	const getCurrentSiteDetails = (site: SiteInfo) => {
		return [
			getStorageLabel(site),
			getRuntimeLabel(site),
			`Started from ${getSourceLabel(site)}`,
		].join(' · ');
	};

	const getStorageLabel = (site: SiteInfo) => {
		if (site.metadata.storage === 'none') {
			return 'Unsaved';
		}
		if (isAutosavedSite(site)) {
			return 'Autosaved in this browser';
		}
		if (site.metadata.storage === 'local-fs') {
			return 'Local directory';
		}
		return 'Saved in this browser';
	};

	const getRuntimeLabel = (site: SiteInfo) => {
		const { phpVersion, wpVersion } = site.metadata.runtimeConfiguration;
		return `WP ${wpVersion} · PHP ${phpVersion}`;
	};

	const getSourceLabel = (site: SiteInfo) => {
		const corePr = getOriginalSearchParam(site, 'core-pr');
		if (corePr) {
			return `WordPress PR #${corePr}`;
		}

		const gutenbergPr = getOriginalSearchParam(site, 'gutenberg-pr');
		if (gutenbergPr) {
			return `Gutenberg PR #${gutenbergPr}`;
		}

		const gutenbergBranch = getOriginalSearchParam(
			site,
			'gutenberg-branch'
		);
		if (gutenbergBranch) {
			return `Gutenberg branch ${gutenbergBranch}`;
		}

		const source = site.metadata.originalBlueprintSource;
		if (source.type === 'remote-url') {
			return getRemoteBlueprintLabel(source.url);
		}
		if (source.type === 'inline-string') {
			return 'inline Blueprint';
		}
		if (source.type === 'opfs-site') {
			return 'saved Playground files';
		}
		return 'default WordPress';
	};

	const getOriginalSearchParam = (site: SiteInfo, name: string) => {
		const value = site.originalUrlParams?.searchParams?.[name];
		return Array.isArray(value) ? value[0] : value;
	};

	const getRemoteBlueprintLabel = (url: string) => {
		try {
			const parsed = new URL(url);
			const pathParts = parsed.pathname.split('/').filter(Boolean);
			const filename = pathParts[pathParts.length - 2];
			if (parsed.hostname === 'raw.githubusercontent.com' && filename) {
				return `${formatBlueprintSlug(filename)} Blueprint`;
			}
			return `Blueprint URL on ${parsed.hostname}`;
		} catch {
			return 'remote Blueprint';
		}
	};

	const formatBlueprintSlug = (slug: string) => {
		return slug
			.split(/[-_]/)
			.filter(Boolean)
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
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

	/**
	 * Creates a fresh Playground for the inline "From GitHub" import to write
	 * into, so importing from the New pane starts a new site (mirrors the old
	 * GitHub import modal's new-site flow).
	 */
	const createSiteForGitHubImport = async () => {
		try {
			await sitesAPI.createNewTemporarySite();
			await sitesAPI.saveInBrowser();
		} catch {
			if (temporarySite) {
				await sitesAPI.setActiveSite(temporarySite.slug);
			} else {
				await sitesAPI.createNewTemporarySite();
			}
		}
		const client = sitesAPI.getClient();
		if (!client) {
			throw new Error('No active Playground to import into.');
		}
		return client;
	};

	const submitBlueprintUrl = () => {
		const trimmed = blueprintUrlInput.trim();
		if (!trimmed) {
			return;
		}
		dispatch(setSiteManagerOpen(false));
		redirectTo(
			PlaygroundRoute.newSite({ query: { 'blueprint-url': trimmed } })
		);
		onClose();
	};

	const creationTabs: {
		id: CreationTabId;
		title: string;
		ariaLabel: string;
		icon: React.ReactNode;
		disabled: boolean;
	}[] = [
		{
			id: 'blueprint',
			title: 'Blueprint',
			ariaLabel: 'Start from a Blueprint',
			icon: <Icon icon={layout} size={24} />,
			disabled: false,
		},
		{
			id: 'wp-pr',
			title: 'WordPress PR',
			ariaLabel: 'Preview a WordPress PR',
			icon: <PullRequestIcon />,
			disabled: offline,
		},
		{
			id: 'gutenberg-pr',
			title: 'Gutenberg PR',
			ariaLabel: 'Preview a Gutenberg PR',
			icon: <PullRequestIcon />,
			disabled: offline,
		},
		{
			id: 'github',
			title: 'From GitHub',
			ariaLabel: 'Import from GitHub',
			icon: GitHubIcon,
			disabled: offline,
		},
		{
			id: 'blueprint-url',
			title: 'Blueprint URL',
			ariaLabel: 'Open a Blueprint URL',
			icon: <Icon icon={link} size={24} />,
			disabled: offline,
		},
		{
			id: 'zip',
			title: 'Import .zip',
			ariaLabel: 'Import a .zip',
			icon: <Icon icon={upload} size={24} />,
			disabled: false,
		},
	];

	const inactiveStoredSites = storedSites.filter(
		(site) => site.slug !== activeSite?.slug
	);
	const recentSites = inactiveStoredSites.filter(isAutosavedSite);
	const savedSites = inactiveStoredSites.filter(isExplicitlySavedSite);

	function formatSiteCreatedDate(site: SiteInfo) {
		if (!site.metadata.whenCreated) {
			return undefined;
		}
		const created = new Date(site.metadata.whenCreated);
		const now = new Date();
		const startOfDay = (date: Date) =>
			new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const dayDiff = Math.round(
			(startOfDay(now).getTime() - startOfDay(created).getTime()) /
				86_400_000
		);
		// Today/yesterday read more naturally as a time of day; older
		// Playgrounds keep the calendar date. Both follow the browser locale.
		if (dayDiff === 0 || dayDiff === 1) {
			const time = created.toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit',
			});
			return `${dayDiff === 0 ? 'Today' : 'Yesterday'} at ${time}`;
		}
		return created.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	function renderSiteRow(site: SiteInfo) {
		const isSelected = site.slug === activeSite?.slug;
		const isAutosave = isAutosavedSite(site);
		const isStoredSite = site.metadata.storage !== 'none';

		return (
			<div
				key={site.slug}
				className={classNames(css.siteRow, {
					[css.siteRowSelected]: isSelected,
				})}
			>
				<div
					className={css.siteRowContent}
					role="button"
					tabIndex={0}
					aria-label={`Open ${site.metadata.name}`}
					onClick={() => onSiteClick(site.slug)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							onSiteClick(site.slug);
						}
					}}
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
						<span className={css.siteRowNameLine}>
							<span className={css.siteRowName}>
								{site.metadata.name}
							</span>
							{isStoredSite && (
								<button
									type="button"
									className={css.renameButton}
									aria-label={`Rename ${site.metadata.name}`}
									title="Rename"
									onClick={(event) => {
										event.stopPropagation();
										handleRenameSite(site);
									}}
								>
									<Icon icon={pencil} size={16} />
								</button>
							)}
						</span>
						<span className={css.siteRowDate}>
							{getStoredSiteDetails(site)}
						</span>
					</div>
				</div>
				{isStoredSite && (
					<div className={css.siteRowActions}>
						{isAutosave && (
							<button
								type="button"
								className={css.keepButton}
								onClick={() => openSaveModalForSite(site)}
								aria-label="Store this Playground permanently"
								title="Store this Playground permanently so it is not pruned from recent autosaves."
							>
								<span className={css.keepButtonFullText}>
									Store permanently
								</span>
								<span className={css.keepButtonCompactText}>
									Keep
								</span>
							</button>
						)}
						<DropdownMenu
							icon={moreVertical}
							label="Playground actions"
							className={css.siteRowMenu}
							popoverProps={{
								placement: 'bottom-end',
							}}
						>
							{({ onClose: closeMenu }) => (
								<>
									{isAutosave && (
										<MenuGroup>
											<MenuItem
												onClick={() =>
													openSaveModalForSite(
														site,
														closeMenu
													)
												}
											>
												Store permanently
											</MenuItem>
										</MenuGroup>
									)}
									<MenuGroup>
										<MenuItem
											className={css.dangerMenuItem}
											onClick={() =>
												handleDeleteSite(
													site,
													closeMenu
												)
											}
										>
											Delete
										</MenuItem>
									</MenuGroup>
								</>
							)}
						</DropdownMenu>
					</div>
				)}
			</div>
		);
	}

	function renderCurrentSiteRow(site: SiteInfo) {
		return (
			<div className={classNames(css.siteRow, css.currentSiteRow)}>
				<div className={css.siteRowContent}>
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
							{getCurrentSiteDetails(site)}
						</span>
					</div>
				</div>
			</div>
		);
	}

	function renderSiteGroup(title: string, sites: SiteInfo[]) {
		if (sites.length === 0) {
			return null;
		}
		return (
			<div className={css.siteGroup}>
				<h3 className={css.siteGroupTitle}>{title}</h3>
				<div className={classNames(css.sitesList, css.playgroundsList)}>
					{sites.map(renderSiteRow)}
				</div>
			</div>
		);
	}

	function renderYourPlaygroundsSection() {
		if (variant === 'pane') {
			const visibleSavedSites = showAllStoredSites
				? savedSites
				: savedSites.slice(0, MAX_VISIBLE_STORED_SITES);
			const hiddenSavedSitesCount =
				savedSites.length - visibleSavedSites.length;
			const hasSites =
				!!activeSite || recentSites.length > 0 || savedSites.length > 0;

			return (
				<OverlaySection className={css.playgroundsSection}>
					{!hasSites ? (
						<p className={css.emptyMessage}>
							No Playgrounds available yet.
						</p>
					) : (
						<>
							{activeSite && (
								<div className={css.siteGroup}>
									<h3 className={css.siteGroupTitle}>
										Current Playground
									</h3>
									<div
										className={classNames(
											css.sitesList,
											css.playgroundsList
										)}
									>
										{renderCurrentSiteRow(activeSite)}
									</div>
								</div>
							)}
							{renderSiteGroup('Recent', recentSites)}
							{renderSiteGroup('Saved', visibleSavedSites)}
						</>
					)}
					{hiddenSavedSitesCount > 0 && (
						<button
							type="button"
							className={css.showMoreButton}
							onClick={() =>
								setShowAllStoredSites(!showAllStoredSites)
							}
						>
							{showAllStoredSites
								? 'Show fewer Playgrounds'
								: `Show ${hiddenSavedSitesCount} more Playgrounds`}
						</button>
					)}
				</OverlaySection>
			);
		}

		const visibleStoredSites =
			isCompactLayout && !showAllStoredSites
				? storedSites.slice(0, MAX_VISIBLE_COMPACT_STORED_SITES)
				: storedSites;
		const hiddenStoredSitesCount =
			storedSites.length - visibleStoredSites.length;
		const visibleSites = [
			...(temporarySite ? [temporarySite] : []),
			...visibleStoredSites,
		];

		return (
			<OverlaySection
				title="Your Playgrounds"
				className={classNames(
					css.playgroundsSection,
					css.yourPlaygroundsSection
				)}
			>
				{visibleSites.length === 0 ? (
					<p className={css.emptyMessage}>
						No Playgrounds available yet.
					</p>
				) : (
					<div
						className={classNames(
							css.sitesList,
							css.playgroundsList
						)}
					>
						{visibleSites.map(renderSiteRow)}
					</div>
				)}
				{isCompactLayout && hiddenStoredSitesCount > 0 && (
					<button
						type="button"
						className={css.viewAllPlaygroundsButton}
						onClick={() => setShowAllStoredSites(true)}
					>
						View all
					</button>
				)}
				{isCompactLayout &&
					showAllStoredSites &&
					storedSites.length > MAX_VISIBLE_COMPACT_STORED_SITES && (
						<button
							type="button"
							className={css.viewAllPlaygroundsButton}
							onClick={() => setShowAllStoredSites(false)}
						>
							Show fewer
						</button>
					)}
			</OverlaySection>
		);
	}

	function renderNewPlaygroundSection() {
		// One tabbed surface: the tab strip (grouped in its own toolbar) picks a
		// way to start, and the panel below swaps to match. The panel keeps a
		// sticky header that names the active flow — restoring "Start from a
		// Blueprint" and clearly separating the tabs from the gallery's category
		// filters. "Blueprint" (the gallery) is the default.
		const activeTab = creationTabs.find(
			(tab) => tab.id === activeCreationTab
		);
		return (
			<OverlaySection
				className={classNames(
					css.playgroundsSection,
					css.creationSection
				)}
			>
				<div
					className={css.creationTabs}
					role="tablist"
					aria-label="Ways to start a new Playground"
				>
					{creationTabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeCreationTab === tab.id}
							className={classNames(css.creationButton, {
								[css.creationButtonActive]:
									activeCreationTab === tab.id,
							})}
							aria-label={tab.ariaLabel}
							onClick={() => setActiveCreationTab(tab.id)}
							disabled={tab.disabled}
						>
							<span className={css.creationIcon}>{tab.icon}</span>
							<span className={css.creationTitle}>
								{tab.title}
							</span>
						</button>
					))}
				</div>
				<div className={css.creationPanel}>
					<div className={css.panelHeader}>
						<h3 className={css.panelTitle}>
							{activeTab?.ariaLabel}
						</h3>
					</div>
					{renderActiveCreationTab()}
				</div>
			</OverlaySection>
		);
	}

	function renderBlueprintGallery() {
		return (
			<>
				{renderBlueprintFilters()}
				{filteredBlueprints.length > 0 && (
					<div className={css.blueprintsRow}>
						{filteredBlueprints.map(renderBlueprintCard)}
					</div>
				)}
				{blueprintsLoading && (
					<div className={css.loadingContainer}>
						<Spinner />
					</div>
				)}
				{!blueprintsLoading && blueprintsError && (
					<p className={css.emptyMessage}>
						Unable to load blueprints. Check your connection.
					</p>
				)}
				{!blueprintsLoading &&
					!blueprintsError &&
					filteredBlueprints.length === 0 && (
						<p className={css.emptyMessage}>
							No blueprints found matching your criteria.
						</p>
					)}
			</>
		);
	}

	function renderActiveCreationTab() {
		switch (activeCreationTab) {
			case 'blueprint':
				return renderBlueprintGallery();
			case 'wp-pr':
				return (
					<div className={css.inlineForm}>
						<PreviewPRForm
							target="wordpress"
							inline
							onClose={() => setActiveCreationTab('blueprint')}
						/>
					</div>
				);
			case 'gutenberg-pr':
				return (
					<div className={css.inlineForm}>
						<PreviewPRForm
							target="gutenberg"
							inline
							onClose={() => setActiveCreationTab('blueprint')}
						/>
					</div>
				);
			case 'github':
				return (
					<div className={css.inlineForm}>
						<GitHubImportForm
							playground={playground!}
							getPlaygroundBeforeImport={
								createSiteForGitHubImport
							}
							onClose={() => setActiveCreationTab('blueprint')}
							onImported={() => {
								// eslint-disable-next-line no-alert
								alert(
									'Import finished! Your Playground site has been updated.'
								);
								onClose();
							}}
						/>
					</div>
				);
			case 'blueprint-url':
				return (
					<form
						className={css.inlineForm}
						onSubmit={(event) => {
							event.preventDefault();
							submitBlueprintUrl();
						}}
					>
						<TextControl
							__nextHasNoMarginBottom
							label="Blueprint URL"
							value={blueprintUrlInput}
							onChange={(value: string) =>
								setBlueprintUrlInput(value)
							}
							placeholder="https://example.com/blueprint.json"
							type="url"
						/>
						<p className={css.inlineFormHint}>
							Runs a Blueprint hosted at a public URL as a fresh
							Playground.
						</p>
						<div className={css.inlineFormActions}>
							<Button
								variant="primary"
								type="submit"
								disabled={!blueprintUrlInput.trim()}
							>
								Run Blueprint
							</Button>
						</div>
					</form>
				);
			case 'zip':
				return (
					<div className={css.inlineForm}>
						<p className={css.inlineFormHint}>
							Import a WordPress Playground <code>.zip</code>{' '}
							export to start a new Playground from it.
						</p>
						<div className={css.inlineFormActions}>
							<Button
								variant="primary"
								data-cy="restore-from-zip"
								onClick={() => zipFileInputRef.current?.click()}
							>
								Choose a .zip file…
							</Button>
						</div>
					</div>
				);
			default:
				return null;
		}
	}

	function renderBlueprintFilters() {
		return (
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
							[css.tagButtonActive]: selectedTag === 'Featured',
						})}
						onClick={() =>
							setSelectedTag(
								selectedTag === 'Featured' ? null : 'Featured'
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
								setSelectedTag(selectedTag === tag ? null : tag)
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
					/>
				</div>
			</div>
		);
	}

	function renderBlueprintCard(blueprint: BlueprintsIndexEntry) {
		return (
			<button
				key={blueprint.path}
				className={classNames(css.blueprintPreviewCard, {
					[css.vanillaCard]: blueprint.isVanilla,
				})}
				onClick={() =>
					blueprint.isVanilla
						? createVanillaSite()
						: previewBlueprint(blueprint.path)
				}
			>
				<div className={css.blueprintPreviewThumbnail}>
					{blueprint.screenshot_url ? (
						<img
							src={blueprint.screenshot_url}
							alt=""
							loading="lazy"
						/>
					) : (
						<div className={css.blueprintPlaceholder}>
							<WordPressIcon />
						</div>
					)}
					{blueprint.isVanilla && (
						<span className={css.blueprintBadge}>Default</span>
					)}
				</div>
				<span className={css.blueprintPreviewBody}>
					<span className={css.blueprintPreviewTitle}>
						{blueprint.title}
					</span>
					{blueprint.description && (
						<span className={css.blueprintPreviewDescription}>
							{blueprint.description}
						</span>
					)}
				</span>
			</button>
		);
	}

	function renderBlueprintPreviewSection() {
		// Vanilla WordPress is always present in `allBlueprints`, so the grid
		// shows it immediately while the remote index loads behind it.
		const blueprintsToShow =
			variant === 'pane' ? filteredBlueprints : allBlueprints;
		return (
			<OverlaySection
				title={
					variant === 'pane' ? undefined : 'Start from a Blueprint'
				}
				className={classNames(
					css.playgroundsSection,
					css.blueprintsSection
				)}
			>
				{variant === 'pane' && renderBlueprintFilters()}
				{blueprintsToShow.length > 0 && (
					<div className={css.blueprintsRow}>
						{blueprintsToShow.map(renderBlueprintCard)}
					</div>
				)}
				{blueprintsLoading && (
					<div className={css.loadingContainer}>
						<Spinner />
					</div>
				)}
				{!blueprintsLoading && blueprintsError && (
					<p className={css.emptyMessage}>
						Unable to load blueprints. Check your connection.
					</p>
				)}
				{!blueprintsLoading &&
					!blueprintsError &&
					blueprintsToShow.length === 0 && (
						<p className={css.emptyMessage}>
							No blueprints found matching your criteria.
						</p>
					)}
			</OverlaySection>
		);
	}

	if (variant === 'pane') {
		return (
			<div
				className={classNames(css.playgroundsPane, {
					[css.newPane]: panel === 'new',
				})}
			>
				<input
					type="file"
					ref={zipFileInputRef}
					onChange={handleImportZip}
					accept=".zip,application/zip"
					style={{ display: 'none' }}
				/>
				{panel !== 'new' && renderYourPlaygroundsSection()}
				{panel !== 'playgrounds' && renderNewPlaygroundSection()}
			</div>
		);
	}

	if (viewMode === 'blueprints') {
		return (
			<Overlay
				onClose={onClose}
				className={css.playgroundsOverlay}
				contentClassName={css.playgroundsContent}
			>
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
		<Overlay
			onClose={onClose}
			className={css.playgroundsOverlay}
			contentClassName={css.playgroundsContent}
		>
			<input
				type="file"
				ref={zipFileInputRef}
				onChange={handleImportZip}
				accept=".zip,application/zip"
				style={{ display: 'none' }}
			/>
			<button
				type="button"
				className={css.playgroundsCloseButton}
				aria-label="Close"
				onClick={onClose}
			>
				<Icon icon={close} size={28} />
			</button>
			<OverlayBody className={css.playgroundsBody}>
				<div className={css.playgroundsColumns}>
					{renderNewPlaygroundSection()}
					{renderYourPlaygroundsSection()}

					{renderBlueprintPreviewSection()}
				</div>
			</OverlayBody>
		</Overlay>
	);
}
