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
	pencil,
	layout,
	fullscreen,
} from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { GitHubIcon } from '../../github/github';
import PreviewPRForm from '../../github/preview-pr/form';
import GitHubImportForm from '../../github/github-import-form/form';
import {
	createGitHubImportBaselineForExport,
	rememberGitHubImportBaselineForExport,
} from '../../github/github-export-form/import-baseline';
import vanillaScreenshot from './vanilla-wordpress.jpeg';
import { isValidBlueprintDraft } from './is-valid-blueprint-draft';
import { getPlaygroundStorageActions } from './storage-actions';
import {
	useState,
	useEffect,
	useLayoutEffect,
	useRef,
	lazy,
	Suspense,
} from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { getOpfsSyncProgressPercent } from '../../lib/opfs-sync-progress';
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
	updateSiteMetadata,
} from '../../lib/state/redux/slice-sites';
import { readSiteBlueprintJson } from '../blueprint-editor/SiteBlueprintBundleEditor';
import { writeBlueprintJsonToFilesystemBackend } from '../blueprint-editor/blueprint-filesystem';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToDelete,
	setAutosaveNudgeMuted,
	setSiteManagerPaneCloseBlocked,
	setWriteOwnBlueprintDraft,
	setWriteOwnSeededSlug,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { WordPressIcon } from '@wp-playground/components';
import useFetch from '../../lib/hooks/use-fetch';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';
import { OverlaySection } from '../overlay';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { writeAutosaveNudgeMuted } from '../../lib/autosave-nudge-muted';

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
	title?: string;
	description?: string;
	author: string;
	categories?: string[];
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
	panel?: 'all' | 'playgrounds' | 'new';
}

export function SavedPlaygroundsPane({
	panel,
}: {
	panel: 'playgrounds' | 'new';
}) {
	const dispatch = useAppDispatch();
	return (
		<SavedPlaygroundsOverlay
			onClose={() => dispatch(setSiteManagerOpen(false))}
			panel={panel}
		/>
	);
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
		return `${verb}… ${getOpfsSyncProgressPercent(progress)}%`;
	}
	return `${verb}…`;
}

/**
 * Displays saved Playgrounds, recent autosaves, and entry points for new sites.
 */
export function SavedPlaygroundsOverlay({
	onClose,
	panel = 'all',
}: SavedPlaygroundsOverlayProps) {
	const offline = useAppSelector((state) => state.ui.offline);
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const activeSite = useActiveSite();
	const activeClientInfo = useAppSelector(getActiveClientInfo);
	const activeSiteSyncLabel = getActiveSiteSyncLabel(activeClientInfo);
	const autosaveNudgeMuted = useAppSelector(
		(state) => state.ui.autosaveNudgeMuted
	);
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const playground = usePlaygroundClient();
	const localFsAvailability = useLocalFsAvailability(playground ?? undefined);
	const zipFileInputRef = useRef<HTMLInputElement>(null);
	const creationPanelRef = useRef<HTMLDivElement>(null);
	const inlineRename = useInlineRename();

	const [searchQuery, setSearchQuery] = useState('');
	const [showAllStoredSites, setShowAllStoredSites] = useState(false);
	const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);
	const [pendingZipTargetSlug, setPendingZipTargetSlug] = useState<
		string | null
	>(null);
	const [isImportingZip, setIsImportingZip] = useState(false);
	// Re-entrancy guard: the import effect's deps (onClose, activeSite) change on
	// routine re-renders, so this prevents a second concurrent import firing while
	// one is already in flight.
	const importingRef = useRef(false);
	// Set when a tab is reached via arrow keys so the field-autofocus effect below
	// doesn't yank focus out of the tablist mid-navigation (roving stays intact).
	const suppressFieldAutofocusRef = useRef(false);
	const [activeCreationTab, setActiveCreationTab] =
		useState<CreationTabId>('gallery');
	const [blueprintUrlInput, setBlueprintUrlInput] = useState('');

	useEffect(() => {
		dispatch(setSiteManagerPaneCloseBlocked(isImportingZip));
		return () => {
			dispatch(setSiteManagerPaneCloseBlocked(false));
		};
	}, [dispatch, isImportingZip]);

	useEffect(() => {
		if (isCreationTabDisabled(activeCreationTab, offline)) {
			setActiveCreationTab('gallery');
		}
	}, [activeCreationTab, offline]);

	// The "Write a Blueprint" draft lives in Redux so it survives closing and
	// reopening the New pane (which unmounts this component). Falls back to the
	// starter Blueprint until the user edits it.
	const writeOwnDraft =
		useAppSelector((state) => state.ui.writeOwnBlueprintDraft) ??
		STARTER_BLUEPRINT;
	const setWriteOwnDraft = (value: string) =>
		dispatch(setWriteOwnBlueprintDraft(value));
	// Latest draft, readable inside the async seeding effect without making it a
	// dependency, so a slow blueprint read can't overwrite edits typed meanwhile.
	const writeOwnDraftRef = useRef(writeOwnDraft);
	writeOwnDraftRef.current = writeOwnDraft;
	const writeOwnSeededSlug = useAppSelector(
		(state) => state.ui.writeOwnSeededSlug
	);

	// Pre-populate the "Write a Blueprint" sketch with the active site's Blueprint
	// so it and the full Blueprint editor start from the same place. Seeds once per
	// site (re-seeding when the active site changes); edits made afterwards are
	// kept — the seeded slug guards against clobbering them on re-render.
	useEffect(() => {
		if (activeCreationTab !== 'write-own' || !activeSite) {
			return;
		}
		if (writeOwnSeededSlug === activeSite.slug) {
			return;
		}
		const { slug } = activeSite;
		const { originalBlueprint } = activeSite.metadata;
		const draftAtStart = writeOwnDraftRef.current;
		// Mark seeded synchronously so an active-site metadata change mid-read
		// doesn't restart this effect and re-clobber the user's edits.
		dispatch(setWriteOwnSeededSlug(slug));
		let cancelled = false;
		void (async () => {
			try {
				const json = await readSiteBlueprintJson(originalBlueprint);
				// Only seed if the user hasn't edited the draft since the read
				// began (otherwise a slow read would overwrite their work).
				if (!cancelled && writeOwnDraftRef.current === draftAtStart) {
					dispatch(setWriteOwnBlueprintDraft(json));
				}
			} catch {
				// Keep this site on the starter Blueprint if its declaration
				// can't be read. Without this reset, switching from another
				// Playground could leave that previous site's draft in the New
				// pane.
				if (!cancelled && writeOwnDraftRef.current === draftAtStart) {
					dispatch(setWriteOwnBlueprintDraft(STARTER_BLUEPRINT));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
		// Depend on slug (not the whole activeSite) so unrelated metadata changes
		// (e.g. whenLastUsed) don't re-run the seed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeCreationTab, activeSite?.slug, writeOwnSeededSlug, dispatch]);

	// Autofocus the first field whenever a tab shows a form so the user can
	// start typing right away. The "write your own" editor focuses its own
	// CodeMirror surface, so it's excluded here.
	useEffect(() => {
		// Skip when the tab was reached by keyboard arrows — focus must stay on the
		// tab so the user can keep arrowing; clicking a tab still autofocuses.
		if (suppressFieldAutofocusRef.current) {
			suppressFieldAutofocusRef.current = false;
			return;
		}
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
			importingRef.current
		) {
			return;
		}

		// `createNewSavedSite()` resolves once the iframe is usable, while its
		// first MEMFS → OPFS copy continues in the background. Importing into that
		// filesystem during the copy can race the initial save, so wait until the
		// new Playground has settled before writing the zip contents.
		if (activeClientInfo?.opfsSync?.status === 'syncing') {
			return;
		}
		if (activeClientInfo?.opfsSync?.status === 'error') {
			setPendingZipFile(null);
			setPendingZipTargetSlug(null);
			setIsImportingZip(false);
			if (zipFileInputRef.current) {
				zipFileInputRef.current.value = '';
			}
			alert('Unable to save the new Playground before import.');
			return;
		}

		// Capture the file and clear the pending request synchronously, BEFORE the
		// async work, so a re-render (new onClose/activeSite identity) re-running
		// this effect can't kick off a second concurrent import into the same site.
		importingRef.current = true;
		const zipFile = pendingZipFile;
		setPendingZipFile(null);
		setPendingZipTargetSlug(null);

		const doImport = async () => {
			try {
				await importWordPressFiles(playground, {
					wordPressFilesZip: zipFile,
				});
				await flushImportedWordPressFiles(playground);
				window.setTimeout(() => {
					void playground.goTo('/').catch((error) => {
						logger.error('Failed to refresh imported site', error);
					});
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
				setIsImportingZip(false);
				importingRef.current = false;
				if (zipFileInputRef.current) {
					zipFileInputRef.current.value = '';
				}
			}
		};
		doImport();
	}, [
		pendingZipFile,
		pendingZipTargetSlug,
		activeSite,
		playground,
		activeClientInfo?.opfsSync?.status,
		onClose,
	]);

	/**
	 * Creates a target Playground before importing a zip archive.
	 *
	 * Imports prefer a new OPFS-backed site so the result survives a refresh.
	 * If that cannot be created, the import falls back to a new temporary site.
	 */
	async function createSiteForImport() {
		try {
			return await sitesAPI.createNewSavedSite();
		} catch (error) {
			logger.error(
				'Error creating saved Playground for zip import; falling back to a temporary Playground.',
				error
			);
			return await sitesAPI.createNewTemporarySite();
		}
	}

	const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (importingRef.current || pendingZipFile) {
			e.target.value = '';
			return;
		}

		setIsImportingZip(true);
		try {
			const targetSlug = await createSiteForImport();
			setPendingZipTargetSlug(targetSlug);
			setPendingZipFile(file);
		} catch (error) {
			logger.error(error);
			setIsImportingZip(false);
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
	} = useFetch<Record<string, BlueprintsIndexEntry>>(getBlueprintsIndexUrl());

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

	const filteredBlueprints = allBlueprints.filter((blueprint) => {
		const query = searchQuery.toLowerCase();
		const matchesSearch =
			!searchQuery ||
			blueprint.title?.toLowerCase().includes(query) ||
			blueprint.description?.toLowerCase().includes(query) ||
			blueprint.categories?.some((cat) =>
				cat.toLowerCase().includes(query)
			);

		return matchesSearch;
	});

	const onSiteClick = (slug: string) => {
		// Just switch to the Playground and close the pane. We intentionally do
		// NOT change the dock section here: doing so made the closing pane
		// re-render as the "Site details" settings pane mid-exit-animation,
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

	const handleUnmuteAutosaveNotices = () => {
		writeAutosaveNudgeMuted(false);
		dispatch(setAutosaveNudgeMuted(false));
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

	const findPlaygroundRow = (slug: string) =>
		Array.from(
			document.querySelectorAll<HTMLElement>('[data-playground-row]')
		).find(
			(element) => element.getAttribute('data-playground-row') === slug
		);

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
				const element = findPlaygroundRow(slug);
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
						window.clearTimeout(cleanupTimer);
					};
					element.addEventListener('transitionend', cleanup);
					const cleanupTimer = window.setTimeout(cleanup, 500);
				});
			});
		}
	});

	// Store a browser-side Playground permanently in the browser (OPFS), in place —
	// no modal, no leaving the pane. An autosave is just marked permanent; a
	// temporary Playground is persisted to OPFS. Either way it moves into the
	// "Saved" group, animated by the FLIP effect above.
	const handleStoreInBrowser = (site: SiteInfo, closeMenu: () => void) => {
		closeMenu();
		rowRectsRef.current = snapshotRowRects();
		animateMoveRef.current = true;
		const stored = isAutosavedSite(site)
			? site.slug === activeSite?.slug
				? sitesAPI.saveInBrowser()
				: sitesAPI.keep(site.slug)
			: storeTemporarySiteInBrowser(site.slug);
		void stored.catch((error) => {
			animateMoveRef.current = false;
			logger.error('Error storing Playground in the browser', error);
			alert(
				'Unable to store this Playground in the browser. Please try again.'
			);
		});
	};

	const storeTemporarySiteInBrowser = async (slug: string) => {
		if (slug !== activeSite?.slug) {
			await sitesAPI.setActiveSite(slug);
		}
		await sitesAPI.saveInBrowser();
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
			const directoryHandle = await (window as any).showDirectoryPicker({
				id: 'playground-local-fs',
				mode: 'readwrite',
			});
			if (site.slug === activeSite?.slug) {
				closeMenu();
				await sitesAPI.saveToLocalFileSystem(
					undefined,
					directoryHandle
				);
				return;
			}
			closeMenu();
			await sitesAPI.setActiveSite(site.slug);
			await sitesAPI.saveToLocalFileSystem(undefined, directoryHandle);
		} catch (error) {
			if ((error as Error)?.name === 'AbortError') {
				return; // The user dismissed the directory picker.
			}
			logger.error('Error saving Playground to a local directory', error);
			alert(
				'Unable to save this Playground to a local directory. Please try again.'
			);
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
			getCurrentSiteStorageLabel(site),
			`Started from ${getSourceLabel(site)}`,
		].join(' · ');
	};

	const getCurrentSiteStorageLabel = (site: SiteInfo) => {
		if (site.metadata.storage === 'none') {
			return 'Not saved to browser storage';
		}
		if (site.metadata.storage === 'local-fs') {
			return 'Saved in a local directory';
		}
		return isAutosavedSite(site)
			? 'Autosaved in this browser'
			: 'Stored in this browser';
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

		// Autosaving repoints originalBlueprintSource to the persisted OPFS bundle
		// (so a reload restores the saved state, not the pristine Blueprint) — a
		// storage detail, not provenance. When we still know the Blueprint URL the
		// Playground was actually created from, report that instead, so a
		// Blueprint-born Playground never reads as "started from saved files".
		const blueprintUrl = getOriginalSearchParam(site, 'blueprint-url');
		if (blueprintUrl) {
			return getRemoteBlueprintLabel(blueprintUrl);
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
		const blueprintUrl = getBlueprintRawUrlFromIndexPath(blueprintPath);
		if (!blueprintUrl) {
			logger.error(
				'Invalid Blueprint index path; refusing to preview.',
				blueprintPath
			);
			alert('Unable to open this Blueprint. Please try another one.');
			return;
		}
		dispatch(setSiteManagerOpen(false));
		redirectTo(
			PlaygroundRoute.newSite({
				query: {
					name: 'Blueprint preview',
					'blueprint-url': blueprintUrl,
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
			const temporaryClient = sitesAPI.getClient();
			await sitesAPI.saveInBrowser();
			// Saving a temporary Playground changes `whenCreated`, which remounts
			// the iframe. Import into the post-save client, not the temporary iframe
			// that React is about to remove.
			return await waitForSavedGitHubImportClient(temporaryClient);
		} catch (error) {
			logger.error(
				'Error creating saved Playground for GitHub import; falling back to a temporary Playground.',
				error
			);
			await sitesAPI.createNewTemporarySite();
		}
		const client = sitesAPI.getClient();
		if (!client) {
			throw new Error('No active Playground to import into.');
		}
		return client;
	};

	const waitForSavedGitHubImportClient = async (
		temporaryClient: PlaygroundClient | undefined
	) => {
		const timeoutAt = Date.now() + 30_000;
		while (Date.now() < timeoutAt) {
			await waitForNextFrame();
			const client = sitesAPI.getClient();
			if (client && client !== temporaryClient) {
				await client.isReady();
				return client;
			}
		}
		throw new Error(
			'Timed out waiting for the saved Playground to boot before GitHub import.'
		);
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
	const isWriteOwnValid = isValidBlueprintDraft(writeOwnDraft);
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
	 * "Open in the full editor": carry the sketch (with the user's edits) into the
	 * active site's Blueprint, then switch the dock to the roomier Blueprint tab —
	 * with its file tree. The full editor reads the site's Blueprint, so writing
	 * the draft there first preserves any modifications. This only updates the
	 * Blueprint (applied later via "Run"), so the running Playground is not
	 * reloaded.
	 * Saved Playgrounds are the exception: their stored Blueprint must stay
	 * untouched, so we never write the draft into them (that would persist to
	 * OPFS). The full editor opens on their existing Blueprint in read-only
	 * mode instead.
	 */
	const openInFullEditor = async () => {
		if (
			activeSite &&
			!isExplicitlySavedSite(activeSite) &&
			// Only carry over a draft that is itself a valid Blueprint object;
			// persisting a non-object (e.g. "hello"/42) would seed the site with
			// a Blueprint the boot resolver rejects.
			isValidBlueprintDraft(writeOwnDraft)
		) {
			let parsed: unknown;
			try {
				parsed = JSON.parse(writeOwnDraft);
			} catch {
				// Invalid JSON — open the full editor on the site's current
				// Blueprint rather than blocking the handoff.
			}
			if (parsed) {
				try {
					// Preserve bundled files when the source Blueprint already has
					// a file tree; only replace declaration-only Blueprints in metadata.
					const updatedExistingBundle =
						await writeBlueprintJsonToFilesystemBackend(
							activeSite.metadata.originalBlueprint,
							writeOwnDraft
						);
					if (!updatedExistingBundle) {
						await dispatch(
							updateSiteMetadata({
								slug: activeSite.slug,
								changes: {
									originalBlueprint:
										parsed as SiteInfo['metadata']['originalBlueprint'],
									originalBlueprintSource: {
										type: 'inline-string',
									},
								},
							})
						);
					}
				} catch (error) {
					logger.error(
						'Could not open the Blueprint draft in the full editor.',
						error
					);
					alert(
						'Unable to open this Blueprint in the full editor. Please try again.'
					);
					return;
				}
			}
		}
		dispatch(setSiteManagerSection('blueprint'));
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

	// Arrow-key roving focus for the creation method tablist (WAI-ARIA tabs):
	// Left/Right move between enabled tabs, Home/End jump to the ends.
	const handleCreationTabKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>
	) => {
		if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
			return;
		}
		const enabled = creationMethods.filter((method) => !method.disabled);
		const currentIndex = enabled.findIndex(
			(method) => method.id === activeCreationTab
		);
		if (currentIndex === -1) {
			return;
		}
		let nextIndex = currentIndex;
		if (event.key === 'ArrowRight') {
			nextIndex = (currentIndex + 1) % enabled.length;
		} else if (event.key === 'ArrowLeft') {
			nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else {
			nextIndex = enabled.length - 1;
		}
		event.preventDefault();
		const nextId = enabled[nextIndex].id;
		suppressFieldAutofocusRef.current = true;
		setActiveCreationTab(nextId);
		document.getElementById(`creation-tab-${nextId}`)?.focus();
	};

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

	// Every row carries one calm "..." menu (no separate buttons). It groups
	// the save destinations — "Store in this browser" (OPFS) and "Save in a
	// local directory…" — above Rename / Delete. Clicking anywhere on the row
	// switches to it. The menu only lists what applies to that Playground's
	// storage.
	function renderRowActions(site: SiteInfo) {
		const isAutosave = isAutosavedSite(site);
		const isTemporary = site.metadata.storage === 'none';
		const isStored = !isTemporary;
		// Temporary and autosaved Playgrounds live in the browser and can be
		// stored permanently in the browser (OPFS) and/or copied to a local
		// directory. Already-saved and local-directory Playgrounds can't.
		const { canStoreInBrowser, canSaveToLocal } =
			getPlaygroundStorageActions({
				isTemporary,
				isAutosave,
				isOpfsAvailable,
				localFsAvailability,
			});
		const hasSaveActions = canStoreInBrowser || canSaveToLocal;
		if (!hasSaveActions && !isStored) {
			return null;
		}
		return (
			<div className={css.siteRowActions}>
				<DropdownMenu
					icon={moreVertical}
					label={`Actions for ${site.metadata.name}`}
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
											Store in this browser
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
		const isEditing = inlineRename.isEditing(site.slug);
		// While renaming, the row holds a focusable text input. A text field
		// inside role="button" is invalid (nested interactive) ARIA, so drop the
		// button affordance during rename and let the input be the only control.
		const rowButtonProps = isEditing
			? {}
			: {
					role: 'button',
					tabIndex: 0,
					'aria-label': `Open ${site.metadata.name}`,
					onClick: () => onSiteClick(site.slug),
					onKeyDown: (event: React.KeyboardEvent) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							onSiteClick(site.slug);
						}
					},
				};
		return (
			<div
				key={site.slug}
				data-playground-row={site.slug}
				className={classNames(css.siteRow, {
					[css.siteRowSelected]: isSelected,
				})}
			>
				<div className={css.siteRowContent} {...rowButtonProps}>
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
						{renderSiteGroup('Recent autosaves', recentSites)}
						{renderSiteGroup('Saved', visibleSavedSites)}
					</>
				)}
				{autosaveNudgeMuted && (
					<div className={css.autosaveNoticesMuted}>
						<span>Autosave restore notices are off.</span>
						<button
							type="button"
							onClick={handleUnmuteAutosaveNotices}
						>
							Turn notices back on
						</button>
					</div>
				)}
				{savedSites.length > MAX_VISIBLE_STORED_SITES && (
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

	function renderNewPlaygroundSection() {
		// A top tab strip picks a way to start; the panel below swaps to match.
		// The three Blueprint sources lead so they read as one cohesive way to
		// start, then the code/import flows. A quiet heading names each flow.
		const activeMethod = creationMethods.find(
			(method) => method.id === activeCreationTab
		);
		// The roving Tab stop must land on an ENABLED tab. If the active tab is a
		// network source that just went offline (disabled), a disabled element with
		// tabIndex=0 is dropped from the focus order — which would leave the tablist
		// with no Tab stop at all. Fall back to the first enabled tab ('gallery' is
		// always enabled and first, so this always resolves).
		const rovingTabId = creationMethods.some(
			(method) => method.id === activeCreationTab && !method.disabled
		)
			? activeCreationTab
			: creationMethods.find((method) => !method.disabled)?.id;
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
							id={`creation-tab-${method.id}`}
							type="button"
							role="tab"
							aria-selected={activeCreationTab === method.id}
							aria-controls="creation-panel"
							tabIndex={method.id === rovingTabId ? 0 : -1}
							className={classNames(css.creationButton, {
								[css.creationButtonActive]:
									activeCreationTab === method.id,
							})}
							onClick={() => setActiveCreationTab(method.id)}
							onKeyDown={handleCreationTabKeyDown}
							disabled={method.disabled}
							title={
								method.disabled
									? 'Needs an internet connection — unavailable offline'
									: undefined
							}
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
				<div
					id="creation-panel"
					className={css.creationPanel}
					ref={creationPanelRef}
					role="tabpanel"
					aria-labelledby={`creation-tab-${activeCreationTab}`}
					tabIndex={0}
				>
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
							Tweak this Playground's Blueprint, then create a new
							Playground from it — or open the full Blueprint
							editor for a file tree and more room.{' '}
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
							<button
								type="button"
								className={css.writeOwnExpand}
								aria-label="Open the full Blueprint editor"
								title="Open the full Blueprint editor"
								onClick={openInFullEditor}
							>
								<Icon icon={fullscreen} size={20} />
							</button>
							<Suspense
								fallback={
									<div className={css.loadingContainer}>
										<Spinner />
									</div>
								}
							>
								<BlueprintAuthoringEditor
									key={writeOwnSeededSlug ?? 'unseeded'}
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
							onImported={(details) => {
								const activeSiteSlug = sitesAPI
									.list()
									.find((site) => site.isActive)?.slug;
								if (activeSiteSlug) {
									rememberGitHubImportBaselineForExport(
										activeSiteSlug,
										createGitHubImportBaselineForExport(
											details
										)
									);
								}
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
							name="blueprint-url"
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
								isBusy={isImportingZip}
								disabled={isImportingZip}
								onClick={() => zipFileInputRef.current?.click()}
							>
								{isImportingZip
									? 'Importing…'
									: 'Choose a .zip file…'}
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
						name="blueprint-search"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search Blueprints"
						aria-label="Search Blueprints"
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
				className={css.blueprintPreviewCard}
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
						{blueprint.title ?? blueprint.path}
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

	return (
		<div
			className={classNames(css.playgroundsPane, {
				[css.newPane]: panel === 'new',
			})}
		>
			<input
				type="file"
				name="playground-zip-import"
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

function isCreationTabDisabled(tab: CreationTabId, offline: boolean) {
	return (
		offline &&
		(tab === 'blueprint-url' || tab === 'github' || tab === 'pull-request')
	);
}

function getBlueprintRawUrlFromIndexPath(path: string) {
	const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
	if (
		segments.length === 0 ||
		segments.some((segment) => segment === '.' || segment === '..')
	) {
		return null;
	}
	return `https://raw.githubusercontent.com/WordPress/blueprints/trunk/${segments
		.map((segment) => encodeURIComponent(segment))
		.join('/')}`;
}

function getBlueprintsIndexUrl() {
	const indexUrl =
		'https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json';
	if (window.location.port === '5400') {
		// The local Vite dev server has no `/proxy/network-first-fetch/` route;
		// direct GitHub fetches are CORS-enabled and keep the New pane usable.
		return indexUrl;
	}
	return `/proxy/network-first-fetch/${indexUrl}`;
}

async function flushImportedWordPressFiles(playground: PlaygroundClient) {
	const documentRoot = await playground.documentRoot;
	if (await playground.hasOpfsMount(documentRoot)) {
		await playground.flushOpfs(documentRoot);
	}
}

function waitForNextFrame() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}
