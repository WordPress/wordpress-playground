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
import {
	useState,
	useEffect,
	useLayoutEffect,
	useRef,
	lazy,
	Suspense,
} from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';
import { useInlineRename } from '../../lib/hooks/use-inline-rename';
import { importWordPressFiles } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { logger } from '@php-wasm/logger';
import {
	useActiveSite,
	useAppSelector,
	useAppDispatch,
	getActiveClientInfo,
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
	setSiteSlugToDelete,
	setWriteOwnBlueprintDraft,
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
 * The schema-aware Blueprint editor (CodeMirror) used by the "Write your own"
 * source. Loaded lazily so opening the New pane on the Gallery never pulls in
 * CodeMirror; it arrives only when the user chooses to author a Blueprint.
 */
const BlueprintAuthoringEditor = lazy(() =>
	import('../blueprint-editor/json-schema-editor/json-schema-editor').then(
		(module) => ({ default: module.JSONSchemaEditor })
	)
);

/**
 * Starter Blueprint for "Write your own" — a working scaffold (logged in, landing
 * in wp-admin) rather than a blank box, so authoring begins from something that
 * already runs.
 */
const STARTER_BLUEPRINT = `{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": []
}`;

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
 * The "New Playground" pane is a method rail beside one content panel. The rail
 * lists every way to start, grouped under two quiet eyebrows — "Blueprints"
 * (Gallery, From a URL, Write your own) and "Bring your own" (From GitHub, Pull
 * request, Import .zip). Selecting a rail row swaps only the panel; the rail
 * never moves. The three Blueprint sources are adjacent peers that all end in
 * one outcome — "Create Playground" — so they read as three doors to the same
 * thing rather than scattered, mixed-weight tabs.
 */
type CreationTabId =
	| 'gallery'
	| 'blueprint-url'
	| 'write-own'
	| 'github'
	| 'pull-request'
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
 * The active Playground's in-progress save, as a short label with percentage,
 * so its row in the list mirrors the dock's "Saving" status. Returns undefined
 * when no OPFS sync is running.
 */
function getActiveSiteSyncLabel(
	clientInfo: ReturnType<typeof getActiveClientInfo>
): string | undefined {
	const opfsSync = clientInfo?.opfsSync;
	if (opfsSync?.status !== 'syncing') {
		return undefined;
	}
	const verb = opfsSync.operation === 'autosave' ? 'Autosaving' : 'Saving';
	const { progress } = opfsSync;
	if (progress && progress.total > 0) {
		const percent = Math.min(
			100,
			Math.round((progress.files / progress.total) * 100)
		);
		return `${verb}… ${percent}%`;
	}
	return `${verb}…`;
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
	const activeClientInfo = useAppSelector(getActiveClientInfo);
	const activeSiteSyncLabel = getActiveSiteSyncLabel(activeClientInfo);
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const playground = usePlaygroundClient();
	const localFsAvailability = useLocalFsAvailability(playground ?? undefined);
	const zipFileInputRef = useRef<HTMLInputElement>(null);
	const creationPanelRef = useRef<HTMLDivElement>(null);
	const inlineRename = useInlineRename();

	const [viewMode, setViewMode] = useState<OverlayViewMode>(initialViewMode);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [showAllStoredSites, setShowAllStoredSites] = useState(false);
	const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);
	const [pendingZipTargetSlug, setPendingZipTargetSlug] = useState<
		string | null
	>(null);
	const [activeCreationTab, setActiveCreationTab] =
		useState<CreationTabId>('gallery');
	const [blueprintUrlInput, setBlueprintUrlInput] = useState('');
	// The "Write a Blueprint" draft lives in Redux so it survives closing and
	// reopening the New pane (which unmounts this component). Falls back to the
	// starter Blueprint until the user edits it.
	const writeOwnDraft =
		useAppSelector((state) => state.ui.writeOwnBlueprintDraft) ??
		STARTER_BLUEPRINT;
	const setWriteOwnDraft = (value: string) =>
		dispatch(setWriteOwnBlueprintDraft(value));
	const isCompactLayout = useIsCompactLayout();
	const activeOpfsSyncStatus = activeClientInfo?.opfsSync?.status;

	// Autofocus the first field whenever a tab shows a form so the user can
	// start typing right away. The "write your own" editor focuses its own
	// CodeMirror surface, so it's excluded here.
	useEffect(() => {
		const formTabs: CreationTabId[] = [
			'blueprint-url',
			'github',
			'pull-request',
		];
		if (!formTabs.includes(activeCreationTab)) {
			return;
		}
		const field = creationPanelRef.current?.querySelector<HTMLElement>(
			'input:not([type="hidden"]):not([type="radio"]), textarea, select'
		);
		field?.focus();
	}, [activeCreationTab]);

	useEffect(() => {
		if (
			!pendingZipFile ||
			!playground ||
			!activeSite ||
			activeSite.slug !== pendingZipTargetSlug ||
			zipImportInProgressRef.current
		) {
			return;
		}

		if (activeOpfsSyncStatus === 'syncing') {
			return;
		}

		const zipFile = pendingZipFile;
		zipImportInProgressRef.current = true;
		setPendingZipFile(null);
		setPendingZipTargetSlug(null);
		if (zipFileInputRef.current) {
			zipFileInputRef.current.value = '';
		}

		const doImport = async () => {
			try {
				if (activeOpfsSyncStatus === 'error') {
					throw new Error(
						'Unable to save the new Playground before import.'
					);
				}
				await importWordPressFiles(playground, {
					wordPressFilesZip: zipFile,
				});
				await flushImportedWordPressFiles(playground);
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
				zipImportInProgressRef.current = false;
			}
		};
		doImport();
	}, [
		pendingZipFile,
		pendingZipTargetSlug,
		activeSite,
		playground,
		activeOpfsSyncStatus,
		onClose,
	]);

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
		if (zipImportInProgressRef.current || pendingZipFile) {
			e.target.value = '';
			return;
		}

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

	// Rename happens inline in the row (no modal): start editing, commit on
	// Enter/blur, cancel on Escape.
	const handleRenameSite = (site: SiteInfo, closeMenu?: () => void) => {
		closeMenu?.();
		inlineRename.start(site);
	};

	// FLIP animation state for "Store": when an autosave becomes a permanent save
	// it moves from "Last 5 autosaves" to "Saved". We snapshot every row's
	// position before the change and animate each row from its old position to its
	// new one, so the stored Playground visibly travels between the two groups.
	const rowRectsRef = useRef<Map<string, DOMRect>>(new Map());
	const animateMoveRef = useRef(false);

	const snapshotRowRects = () => {
		const rects = new Map<string, DOMRect>();
		document
			.querySelectorAll<HTMLElement>('[data-playground-row]')
			.forEach((element) => {
				const slug = element.getAttribute('data-playground-row');
				if (slug) {
					rects.set(slug, element.getBoundingClientRect());
				}
			});
		return rects;
	};

	useLayoutEffect(() => {
		// Only touch the DOM on the render that follows a "Store" — every other
		// render returns immediately, so we never read layout (and never thrash
		// it) during unrelated re-renders such as a Playground booting.
		if (!animateMoveRef.current) {
			return;
		}
		animateMoveRef.current = false;
		{
			const oldRects = rowRectsRef.current;
			const newRects = snapshotRowRects();
			newRects.forEach((newRect, slug) => {
				const oldRect = oldRects.get(slug);
				if (!oldRect) {
					return;
				}
				const dx = oldRect.left - newRect.left;
				const dy = oldRect.top - newRect.top;
				if (!dx && !dy) {
					return;
				}
				const element = document.querySelector<HTMLElement>(
					`[data-playground-row="${slug}"]`
				);
				if (!element) {
					return;
				}
				// Invert: jump the row back to where it was, then release it so it
				// transitions to its new home.
				element.style.transition = 'none';
				element.style.transform = `translate(${dx}px, ${dy}px)`;
				element.style.zIndex = '2';
				requestAnimationFrame(() => {
					element.style.transition =
						'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
					element.style.transform = '';
					const cleanup = () => {
						element.style.transition = '';
						element.style.zIndex = '';
						element.removeEventListener('transitionend', cleanup);
					};
					element.addEventListener('transitionend', cleanup);
				});
			});
		}
	});

	// Store an autosaved Playground permanently in place — no modal, no leaving
	// the pane. It's a metadata-only lifecycle change (autosave -> explicit), so
	// the Playground simply moves into the "Saved" group, animated by the effect
	// above.
	// Store a browser-side Playground permanently in the browser (OPFS), in place —
	// no modal, no leaving the pane. An autosave is just marked permanent; a
	// temporary Playground is persisted to OPFS. Either way it moves into the
	// "Saved" group, animated by the FLIP effect above.
	const handleStoreInBrowser = (site: SiteInfo, closeMenu: () => void) => {
		closeMenu();
		rowRectsRef.current = snapshotRowRects();
		animateMoveRef.current = true;
		const stored = isAutosavedSite(site)
			? sitesAPI.keep(site.slug)
			: sitesAPI.saveInBrowser();
		void stored.catch((error) => {
			animateMoveRef.current = false;
			logger.error('Error storing Playground in the browser', error);
		});
	};

	// Save a browser-side Playground's files to a folder the user picks. Saving
	// reads the running Playground, so a non-active one is switched to first —
	// but the OS directory picker MUST open inside this click gesture, before the
	// async switch/boot, or the browser blocks it. So we pick the folder first,
	// then switch and write into it.
	const handleSaveToLocalDirectory = async (
		site: SiteInfo,
		closeMenu: () => void
	) => {
		try {
			if (site.slug === activeSite?.slug) {
				closeMenu();
				await sitesAPI.saveToLocalFileSystem();
				return;
			}
			const directoryHandle = await (window as any).showDirectoryPicker({
				id: 'playground-local-fs',
				mode: 'readwrite',
			});
			closeMenu();
			await sitesAPI.setActiveSite(site.slug);
			await sitesAPI.saveToLocalFileSystem(undefined, directoryHandle);
		} catch (error) {
			if ((error as Error)?.name === 'AbortError') {
				return; // The user dismissed the directory picker.
			}
			logger.error('Error saving Playground to a local directory', error);
		}
	};

	// The save state lives in the row's status chip, so the meta line stays clean
	// (just the date, or the location for local-directory Playgrounds).
	const getStoredSiteDetails = (site: SiteInfo) => {
		if (site.metadata.storage === 'none') {
			return 'Not saved to browser storage';
		}
		if (site.metadata.storage === 'local-fs') {
			return 'Local directory';
		}
		return formatSiteCreatedDate(site) ?? '';
	};

	const getCurrentSiteDetails = (site: SiteInfo) => {
		return [
			getRuntimeLabel(site),
			`Started from ${getSourceLabel(site)}`,
		].join(' · ');
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

	/**
	 * Creates a Playground from the Blueprint authored in the inline editor.
	 * The JSON rides the URL hash fragment (`#{...}`), which the boot resolver
	 * already decodes — the same one-outcome path as the gallery and URL sources,
	 * with no new API.
	 */
	const isWriteOwnValid = (() => {
		try {
			JSON.parse(writeOwnDraft);
			return writeOwnDraft.trim().length > 0;
		} catch {
			return false;
		}
	})();
	const createFromEditor = () => {
		if (!isWriteOwnValid) {
			return;
		}
		dispatch(setSiteManagerOpen(false));
		redirectTo(
			PlaygroundRoute.newSite({
				hash: encodeURIComponent(writeOwnDraft),
			})
		);
		onClose();
	};

	/**
	 * The start methods, as a top tab strip. The three Blueprint sources lead
	 * (Gallery / From a URL / Write your own) so they read as one cohesive way to
	 * start; the code/import flows follow. Each tab shows an icon + label; the
	 * panel below names the active flow and renders it.
	 */
	const creationMethods: {
		id: CreationTabId;
		label: string;
		panelTitle: string;
		icon: React.ReactNode;
		disabled: boolean;
	}[] = [
		{
			id: 'gallery',
			label: 'Blueprint gallery',
			panelTitle: 'Start from a Blueprint',
			icon: <Icon icon={layout} size={20} />,
			disabled: false,
		},
		{
			id: 'blueprint-url',
			label: 'Blueprint URL',
			panelTitle: 'Blueprint from a URL',
			icon: <Icon icon={link} size={20} />,
			disabled: offline,
		},
		{
			id: 'write-own',
			label: 'Write a Blueprint',
			panelTitle: 'Write a Blueprint',
			icon: <Icon icon={pencil} size={20} />,
			disabled: false,
		},
		{
			id: 'pull-request',
			label: 'Pull request',
			panelTitle: 'Preview a pull request',
			icon: <PullRequestIcon />,
			disabled: offline,
		},
		{
			id: 'github',
			label: 'From GitHub',
			panelTitle: 'Import from GitHub',
			icon: GitHubIcon,
			disabled: offline,
		},
		{
			id: 'zip',
			label: 'Import .zip',
			panelTitle: 'Import a .zip export',
			icon: <Icon icon={upload} size={20} />,
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

	// Every row carries one calm "..." menu (no separate buttons). It groups the
	// two save destinations — "Save in this browser" (OPFS) and "Save in a local
	// directory…" — above Rename / Delete. Clicking anywhere on the row switches
	// to it. The menu only lists what applies to that Playground's storage.
	function renderRowActions(site: SiteInfo) {
		const isAutosave = isAutosavedSite(site);
		const isTemporary = site.metadata.storage === 'none';
		const isStored = !isTemporary;
		// Temporary and autosaved Playgrounds live in the browser and can be
		// stored permanently in the browser (OPFS) and/or copied to a local
		// directory. Already-saved and local-directory Playgrounds can't.
		const canStoreInBrowser = isTemporary || isAutosave;
		const canSaveToLocal =
			canStoreInBrowser && localFsAvailability === 'available';
		const hasSaveActions = canStoreInBrowser || canSaveToLocal;
		if (!hasSaveActions && !isStored) {
			return null;
		}
		return (
			<div className={css.siteRowActions}>
				<DropdownMenu
					icon={moreVertical}
					label="Playground actions"
					className={css.siteRowMenu}
					popoverProps={{ placement: 'bottom-end' }}
				>
					{({ onClose: closeMenu }) => (
						<>
							{hasSaveActions && (
								<MenuGroup>
									{canStoreInBrowser && (
										<MenuItem
											onClick={() =>
												handleStoreInBrowser(
													site,
													closeMenu
												)
											}
										>
											Save in this browser
										</MenuItem>
									)}
									{canSaveToLocal && (
										<MenuItem
											onClick={() =>
												handleSaveToLocalDirectory(
													site,
													closeMenu
												)
											}
										>
											Save in a local directory…
										</MenuItem>
									)}
								</MenuGroup>
							)}
							{isStored && (
								<MenuGroup>
									<MenuItem
										onClick={() => {
											closeMenu();
											handleRenameSite(site);
										}}
									>
										Rename
									</MenuItem>
									<MenuItem
										className={css.dangerMenuItem}
										onClick={() =>
											handleDeleteSite(site, closeMenu)
										}
									>
										Delete
									</MenuItem>
								</MenuGroup>
							)}
						</>
					)}
				</DropdownMenu>
			</div>
		);
	}

	function renderSiteRowName(site: SiteInfo) {
		if (!inlineRename.isEditing(site.slug)) {
			return (
				<span className={css.siteRowName}>{site.metadata.name}</span>
			);
		}
		return (
			<input
				className={css.siteRowNameInput}
				{...inlineRename.getInputProps(site)}
			/>
		);
	}

	function renderSiteRow(site: SiteInfo) {
		const isSelected = site.slug === activeSite?.slug;
		const meta = getStoredSiteDetails(site);
		return (
			<div
				key={site.slug}
				data-playground-row={site.slug}
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
						{renderSiteRowName(site)}
						{meta && (
							<span className={css.siteRowDate}>{meta}</span>
						)}
					</div>
				</div>
				{renderRowActions(site)}
			</div>
		);
	}

	function renderCurrentSiteRow(site: SiteInfo) {
		const meta = getCurrentSiteDetails(site);
		// A temporary Playground is lost on refresh — call that out right on its
		// row so the list mirrors the dock's yellow "Unsaved" status.
		const isUnsaved = site.metadata.storage === 'none';
		return (
			<div
				data-playground-row={site.slug}
				className={classNames(css.siteRow, css.currentSiteRow)}
			>
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
						<span className={css.currentSiteNameLine}>
							{renderSiteRowName(site)}
							{isUnsaved && (
								<span className={css.unsavedBadge}>
									Unsaved
								</span>
							)}
						</span>
						{activeSiteSyncLabel ? (
							<span className={css.siteRowSaving}>
								<span
									className={css.siteRowSavingSpinner}
									aria-hidden="true"
								/>
								{activeSiteSyncLabel}
							</span>
						) : (
							meta && (
								<span className={css.siteRowDate}>{meta}</span>
							)
						)}
					</div>
				</div>
				{renderRowActions(site)}
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
							{renderSiteGroup('Last 5 autosaves', recentSites)}
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
		// A top tab strip picks a way to start; the panel below swaps to match.
		// The three Blueprint sources lead so they read as one cohesive way to
		// start, then the code/import flows. A quiet heading names each flow.
		const activeMethod = creationMethods.find(
			(method) => method.id === activeCreationTab
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
					{creationMethods.map((method) => (
						<button
							key={method.id}
							type="button"
							role="tab"
							aria-selected={activeCreationTab === method.id}
							className={classNames(css.creationButton, {
								[css.creationButtonActive]:
									activeCreationTab === method.id,
							})}
							aria-label={method.label}
							onClick={() => setActiveCreationTab(method.id)}
							disabled={method.disabled}
						>
							<span className={css.creationIcon}>
								{method.icon}
							</span>
							<span className={css.creationTitle}>
								{method.label}
							</span>
						</button>
					))}
				</div>
				<div className={css.creationPanel} ref={creationPanelRef}>
					<div className={css.panelHeader}>
						<h3 className={css.panelTitle}>
							{activeMethod?.panelTitle}
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
						Unable to load Blueprints. Check your connection.
					</p>
				)}
				{!blueprintsLoading &&
					!blueprintsError &&
					filteredBlueprints.length === 0 && (
						<p className={css.emptyMessage}>
							No Blueprints found matching your criteria.
						</p>
					)}
			</>
		);
	}

	function renderActiveCreationTab() {
		switch (activeCreationTab) {
			case 'gallery':
				return renderBlueprintGallery();
			case 'write-own':
				return (
					<div
						className={classNames(css.inlineForm, css.writeOwnFlow)}
					>
						<p className={css.inlineFormHint}>
							Sketch a starter Blueprint, then create your
							Playground. For a roomier editor with a file tree,
							open the Blueprint tab once it boots.{' '}
							<a
								className={css.inlineFormLink}
								href="https://wordpress.github.io/wordpress-playground/blueprints"
								target="_blank"
								rel="noreferrer"
							>
								What are Blueprints?
							</a>
						</p>
						<div className={css.writeOwnEditor}>
							<Suspense
								fallback={
									<div className={css.loadingContainer}>
										<Spinner />
									</div>
								}
							>
								<BlueprintAuthoringEditor
									config={{
										initialDoc: writeOwnDraft,
										onChange: setWriteOwnDraft,
									}}
								/>
							</Suspense>
						</div>
						<div className={css.inlineFormActions}>
							<Button
								variant="primary"
								onClick={createFromEditor}
								disabled={!isWriteOwnValid}
							>
								Create Playground
							</Button>
						</div>
					</div>
				);
			case 'pull-request':
				return (
					<div className={css.inlineForm}>
						<PreviewPRForm
							inline
							onClose={() => setActiveCreationTab('gallery')}
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
							onClose={() => setActiveCreationTab('gallery')}
							onImported={() => {
								// eslint-disable-next-line no-alert
								alert(
									'Import finished! Your Playground has been updated.'
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
							hideLabelFromVision
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
								Create Playground
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
						Unable to load Blueprints. Check your connection.
					</p>
				)}
				{!blueprintsLoading &&
					!blueprintsError &&
					blueprintsToShow.length === 0 && (
						<p className={css.emptyMessage}>
							No Blueprints found matching your criteria.
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
								No Blueprints found matching your criteria.
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

async function flushImportedWordPressFiles(playground: PlaygroundClient) {
	const documentRoot = await playground.documentRoot;
	if (await playground.hasOpfsMount(documentRoot)) {
		await playground.flushOpfs(documentRoot);
	}
}
