import css from './style.module.css';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
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
	offline as offlineIcon,
	check,
} from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { GitHubIcon } from '../../github/github';
import PreviewPRForm from '../../github/preview-pr/form';
import GitHubImportForm from '../../github/github-import-form/form';
import { useGitHubExportSession } from '../../github/github-export-session';
import vanillaScreenshot from './vanilla-wordpress.jpeg';
import { isValidBlueprintDraft } from './is-valid-blueprint-draft';
import {
	useState,
	useEffect,
	useLayoutEffect,
	useCallback,
	useRef,
	lazy,
	Suspense,
} from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';
import { useInlineRename } from '../../lib/hooks/use-inline-rename';
import { logger } from '@php-wasm/logger';
import {
	useActiveSite,
	useAppSelector,
	useAppDispatch,
	getActiveClientInfo,
} from '../../lib/state/redux/store';
import type { SiteImage, SiteInfo } from '../../lib/state/redux/slice-sites';
import {
	isAutosavedSite,
	isExplicitlySavedSite,
	isRestorableAutosavedSite,
	selectSortedSites,
	updateSiteMetadata,
} from '../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setDockOperationNotice,
	setDockPaneOpen,
	setDockPaneSection,
	setSiteSlugToDelete,
	setWriteOwnBlueprintDraft,
	setWriteOwnSeededSlug,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { WordPressIcon } from '@wp-playground/components';
import useFetch from '../../lib/hooks/use-fetch';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';
import { OverlaySection } from '../overlay';
import { TruncatedText } from '../truncated-text';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import type { DockPaneHeaderOverride } from '../dock/dock-pane';

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
 * The "New Playground" pane uses one top tab strip to choose how to start. The
 * selected tab swaps only the content panel below it.
 */
type CreationTabId =
	| 'gallery'
	| 'blueprint-url'
	| 'write-own'
	| 'github'
	| 'pull-request'
	| 'zip';

interface SavedPlaygroundsPanelProps {
	onClose: () => void;
	panel: 'playgrounds' | 'new';
	onPaneHeaderChange: (header: DockPaneHeaderOverride | undefined) => void;
}

/**
 * Displays saved Playgrounds, recent autosaves, and entry points for new sites.
 */
export function SavedPlaygroundsPanel({
	onClose,
	panel,
	onPaneHeaderChange,
}: SavedPlaygroundsPanelProps) {
	const offline = useAppSelector((state) => state.ui.offline);
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const activeSite = useActiveSite();
	const activeClientInfo = useAppSelector(getActiveClientInfo);
	const activeSiteSyncLabel = getActiveSiteSyncLabel(activeClientInfo);
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const githubExportSession = useGitHubExportSession();
	const playground = usePlaygroundClient();
	const localFsAvailability = useLocalFsAvailability(playground ?? undefined);
	const zipFileInputRef = useRef<HTMLInputElement>(null);
	const zipDragDepthRef = useRef(0);
	const panelRootRef = useRef<HTMLDivElement>(null);
	const creationPanelRef = useRef<HTMLDivElement>(null);
	const inlineRename = useInlineRename();

	const [searchQuery, setSearchQuery] = useState('');
	const [showAllStoredSites, setShowAllStoredSites] = useState(false);
	const [isImportingZip, setIsImportingZip] = useState(false);
	const [isDraggingZip, setIsDraggingZip] = useState(false);
	const [zipImportError, setZipImportError] = useState<string>();
	const zipImportPendingRef = useRef(false);
	// A mouse click can put the cursor in the newly selected form straight away.
	// Keyboard and touch activation otherwise keep their focus on the tab. The
	// dedicated GitHub view moves keyboard focus to its Back button because it
	// hides the tablist.
	const creationTabPointerTypeRef = useRef<string>();
	const focusCreationFieldAfterMouseClickRef = useRef(false);
	const creationFocusTargetRef = useRef<CreationTabId | 'back'>();
	const creationBackButtonRef = useRef<HTMLButtonElement>(null);
	const [activeCreationTab, setActiveCreationTab] =
		useState<CreationTabId>('gallery');
	const [isGitHubImportDetailsOpen, setIsGitHubImportDetailsOpen] =
		useState(false);
	const handleCreationBack = useCallback(() => {
		creationFocusTargetRef.current = 'github';
		setIsGitHubImportDetailsOpen(false);
	}, []);

	useLayoutEffect(() => {
		onPaneHeaderChange(
			panel === 'new' &&
				activeCreationTab === 'github' &&
				isGitHubImportDetailsOpen
				? {
						title: 'Import from GitHub',
						backLabel: 'Back to the GitHub repository URL',
						backButtonRef: creationBackButtonRef,
						focusBackButton:
							creationFocusTargetRef.current === 'back',
						onBack: handleCreationBack,
					}
				: undefined
		);
	}, [
		activeCreationTab,
		handleCreationBack,
		isGitHubImportDetailsOpen,
		onPaneHeaderChange,
		panel,
	]);
	const [autofocusWriteOwn, setAutofocusWriteOwn] = useState(false);
	const [blueprintUrlInput, setBlueprintUrlInput] = useState('');
	const writeOwnDraft =
		useAppSelector((state) => state.ui.writeOwnBlueprintDraft) ??
		STARTER_BLUEPRINT;
	const setWriteOwnDraft = (value: string) =>
		dispatch(setWriteOwnBlueprintDraft(value));
	const writeOwnDraftRef = useRef(writeOwnDraft);
	writeOwnDraftRef.current = writeOwnDraft;
	const writeOwnSeededSlug = useAppSelector(
		(state) => state.ui.writeOwnSeededSlug
	);

	useEffect(() => {
		if (isCreationTabDisabled(activeCreationTab, offline)) {
			setIsGitHubImportDetailsOpen(false);
			setActiveCreationTab('gallery');
		}
	}, [activeCreationTab, offline]);

	// Pre-populate the authoring sketch from the active site's Blueprint, whether
	// it is a declaration or a bundle. Seed once per site and do not let a slow
	// read overwrite edits typed while it was in flight.
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
		dispatch(setWriteOwnSeededSlug(slug));
		let cancelled = false;
		void (async () => {
			try {
				const { readSiteBlueprintJson } =
					await import('../blueprint-editor/SiteBlueprintBundleEditor');
				const json = await readSiteBlueprintJson(originalBlueprint);
				if (!cancelled && writeOwnDraftRef.current === draftAtStart) {
					dispatch(setWriteOwnBlueprintDraft(json));
				}
			} catch {
				// Keep the starter Blueprint when the site's bundle cannot be read.
			}
		})();
		return () => {
			cancelled = true;
		};
		// Depend on the slug rather than the whole site so unrelated metadata
		// changes do not restart the read.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeCreationTab, activeSite?.slug, writeOwnSeededSlug, dispatch]);

	// A direct mouse click can focus the first field in a form, but arrow-key
	// navigation must leave focus in the tablist. The "write your own" editor
	// focuses its own CodeMirror surface, so it is excluded here.
	useEffect(() => {
		if (!focusCreationFieldAfterMouseClickRef.current) {
			return;
		}
		focusCreationFieldAfterMouseClickRef.current = false;
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
		const target = creationFocusTargetRef.current;
		if (!target) {
			return;
		}
		creationFocusTargetRef.current = undefined;
		if (target === 'back') {
			creationBackButtonRef.current?.focus();
		} else {
			document.getElementById(`creation-tab-${target}`)?.focus();
		}
	}, [activeCreationTab, isGitHubImportDetailsOpen]);

	useEffect(() => {
		if (panel !== 'new') {
			// Showing the panel again is navigation, not a request to type. Only a
			// fresh mouse click on the authoring tab may autofocus the editor.
			setAutofocusWriteOwn(false);
		}
	}, [panel]);

	const handleImportZip = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			void importZipFile(file);
		}
	};

	const importZipFile = useCallback(
		async (file: File) => {
			if (zipImportPendingRef.current) {
				if (zipFileInputRef.current) {
					zipFileInputRef.current.value = '';
				}
				return;
			}
			if (!file.name.toLowerCase().endsWith('.zip')) {
				setZipImportError('Choose a WordPress Playground .zip export.');
				if (zipFileInputRef.current) {
					zipFileInputRef.current.value = '';
				}
				return;
			}

			zipImportPendingRef.current = true;
			setIsImportingZip(true);
			setZipImportError(undefined);
			onClose();
			try {
				const importedSiteSlug =
					await sitesAPI.createNewSiteFromZip(file);
				const importedSite = sitesAPI
					.list()
					.find((site) => site.slug === importedSiteSlug);
				dispatch(
					setDockOperationNotice({
						status: 'success',
						title: 'Playground imported',
						message:
							importedSite?.storage === 'temporary'
								? 'Your Playground is ready. It’s available until you close this page.'
								: 'Your Playground is ready. It’s autosaved in this browser.',
					})
				);
			} catch (error) {
				logger.error(error);
				setZipImportError(
					'Unable to import this file. Is it a valid WordPress Playground export?'
				);
				dispatch(setDockPaneOpen(true));
			} finally {
				zipImportPendingRef.current = false;
				setIsImportingZip(false);
				if (zipFileInputRef.current) {
					zipFileInputRef.current.value = '';
				}
			}
		},
		[dispatch, onClose, sitesAPI]
	);

	useEffect(() => {
		if (panel !== 'new' || activeCreationTab !== 'zip' || isImportingZip) {
			return;
		}
		let dragLeaveTimer: number | undefined;

		function handleDragEnter(event: DragEvent) {
			if (!hasFiles(event)) {
				return;
			}
			event.preventDefault();
			cancelPendingDragLeave();
			zipDragDepthRef.current += 1;
			setIsDraggingZip(true);
		}

		function handleDragOver(event: DragEvent) {
			if (!hasFiles(event)) {
				return;
			}
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'copy';
			}
		}

		function handleDragLeave(event: DragEvent) {
			if (zipDragDepthRef.current === 0) {
				return;
			}
			event.preventDefault();
			zipDragDepthRef.current -= 1;
			if (zipDragDepthRef.current === 0) {
				dragLeaveTimer = window.setTimeout(() => {
					dragLeaveTimer = undefined;
					if (zipDragDepthRef.current === 0) {
						setIsDraggingZip(false);
					}
				}, 50);
			}
		}

		function handleDrop(event: DragEvent) {
			if (!hasFiles(event)) {
				return;
			}
			event.preventDefault();
			cancelPendingDragLeave();
			zipDragDepthRef.current = 0;
			setIsDraggingZip(false);
			const file = event.dataTransfer?.files[0];
			if (file) {
				void importZipFile(file);
			}
		}

		function hasFiles(event: DragEvent) {
			return event.dataTransfer?.types.includes('Files') ?? false;
		}

		function cancelPendingDragLeave() {
			if (dragLeaveTimer !== undefined) {
				window.clearTimeout(dragLeaveTimer);
				dragLeaveTimer = undefined;
			}
		}

		document.addEventListener('dragenter', handleDragEnter, true);
		document.addEventListener('dragover', handleDragOver, true);
		document.addEventListener('dragleave', handleDragLeave, true);
		document.addEventListener('drop', handleDrop, true);
		return () => {
			document.removeEventListener('dragenter', handleDragEnter, true);
			document.removeEventListener('dragover', handleDragOver, true);
			document.removeEventListener('dragleave', handleDragLeave, true);
			document.removeEventListener('drop', handleDrop, true);
			cancelPendingDragLeave();
			zipDragDepthRef.current = 0;
			setIsDraggingZip(false);
		};
	}, [activeCreationTab, importZipFile, isImportingZip, panel]);

	const {
		data: blueprintsData,
		isLoading: blueprintsLoading,
		isError: blueprintsError,
	} = useFetch<Record<string, BlueprintsIndexEntry>>(
		'/proxy/network-first-fetch/https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json'
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
		if (isImportingZip) {
			return;
		}
		// Just switch to the Playground and close the pane. We intentionally do
		// NOT change the dock section here: doing so made the closing pane
		// re-render as the "This Playground" settings pane mid-exit-animation,
		// which read as a confusing flash when restoring an autosaved Playground.
		onClose();
		void sitesAPI.setActiveSite(slug).catch((error) => {
			logger.error('Error opening saved Playground', error);
			const site = storedSites.find(
				(candidate) => candidate.slug === slug
			);
			dispatch(
				setDockOperationNotice({
					status: 'error',
					title: `Couldn’t open “${site?.metadata.name ?? slug}”`,
					message: 'This Playground is still available in your list.',
				})
			);
		});
	};

	const handleDeleteSite = (site: SiteInfo, closeMenu: () => void) => {
		if (isImportingZip) {
			return;
		}
		dispatch(setSiteSlugToDelete(site.slug));
		dispatch(setActiveModal(modalSlugs.DELETE_SITE));
		closeMenu();
	};

	// Rename happens inline in the row (no modal): start editing, commit on
	// Enter/blur, cancel on Escape.
	const handleRenameSite = (site: SiteInfo, closeMenu?: () => void) => {
		if (isImportingZip) {
			return;
		}
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
		panelRootRef.current
			?.querySelectorAll<HTMLElement>('[data-playground-row]')
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
				const element =
					panelRootRef.current?.querySelector<HTMLElement>(
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

	// Store a browser-side Playground permanently in the browser (OPFS), in place —
	// no modal, no leaving the pane. An autosave is just marked permanent; a
	// temporary Playground is persisted to OPFS. Either way it moves into the
	// "Saved" group, animated by the FLIP effect above.
	const handleStoreInBrowser = (site: SiteInfo, closeMenu: () => void) => {
		if (isImportingZip) {
			return;
		}
		closeMenu();
		dispatch(setDockOperationNotice(undefined));
		rowRectsRef.current = snapshotRowRects();
		animateMoveRef.current = true;
		const stored = isAutosavedSite(site)
			? sitesAPI.keep(site.slug)
			: sitesAPI.saveInBrowser();
		void stored.catch((error) => {
			animateMoveRef.current = false;
			logger.error('Error storing Playground in the browser', error);
			dispatch(
				setDockOperationNotice({
					status: 'error',
					title: `Couldn’t store “${site.metadata.name}” in browser storage`,
					message: 'No changes were made to this Playground.',
				})
			);
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
		if (isImportingZip) {
			return;
		}
		try {
			dispatch(setDockOperationNotice(undefined));
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
			dispatch(
				setDockOperationNotice({
					status: 'error',
					title: `Couldn’t save ${site.metadata.name} locally`,
					message: 'The Playground in your browser is unchanged.',
				})
			);
		}
	};

	// The save state lives in the row's status chip, so the meta line stays focused
	// on runtime/date details or the local-directory location.
	const getStoredSiteDetails = (site: SiteInfo) => {
		if (site.metadata.storage === 'none') {
			return 'Not saved to browser storage';
		}
		if (site.metadata.storage === 'local-fs') {
			return 'Local directory';
		}
		const createdDate = formatSiteCreatedDate(site);
		return isAutosavedSite(site)
			? [getRuntimeLabel(site), createdDate].filter(Boolean).join(' · ')
			: (createdDate ?? '');
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
		if (isImportingZip) {
			return;
		}
		dispatch(setDockPaneOpen(false));
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
		if (isImportingZip) {
			return;
		}
		dispatch(setDockPaneOpen(false));
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
			await sitesAPI.createNewSavedSite();
		} catch (error) {
			logger.error(
				'Error creating a saved Playground for GitHub import; falling back to a temporary Playground.',
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

	const submitBlueprintUrl = () => {
		if (isImportingZip) {
			return;
		}
		const trimmed = blueprintUrlInput.trim();
		if (!trimmed) {
			return;
		}
		dispatch(setDockPaneOpen(false));
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
		if (isImportingZip || !isWriteOwnValid) {
			return;
		}
		dispatch(setDockPaneOpen(false));
		redirectTo(
			PlaygroundRoute.newSite({
				hash: encodeURIComponent(writeOwnDraft),
			})
		);
		onClose();
	};

	/**
	 * Opens the roomier Blueprint tab with its file tree. A temporary Playground
	 * first receives the edited draft as an in-memory declaration, without
	 * reloading the running site. Stored Playgrounds are left untouched, so their
	 * existing Blueprint opens instead.
	 */
	const openInFullEditor = async () => {
		if (isImportingZip) {
			return;
		}
		if (
			activeSite?.metadata.storage === 'none' &&
			// Only carry over a draft that is itself a valid Blueprint object;
			// persisting a non-object (e.g. "hello"/42) would seed the site with
			// a Blueprint the boot resolver rejects.
			isValidBlueprintDraft(writeOwnDraft)
		) {
			try {
				const parsed = JSON.parse(writeOwnDraft);
				await dispatch(
					updateSiteMetadata({
						slug: activeSite.slug,
						changes: {
							originalBlueprint: parsed,
							originalBlueprintSource: { type: 'inline-string' },
						},
					})
				);
			} catch {
				// Invalid JSON — open the full editor on the site's current
				// Blueprint rather than blocking the handoff.
			}
		}
		dispatch(setDockPaneSection('blueprint'));
	};

	/**
	 * The start methods, as a top tab strip. The three Blueprint sources lead
	 * (Gallery / From a URL / Write your own) so they read as one cohesive way to
	 * start; the code/import flows follow. Each tab shows an icon + label; the
	 * panel below renders the active flow.
	 */
	const creationMethods: {
		id: CreationTabId;
		label: string;
		panelTitle?: string;
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
			label: 'From a URL',
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
			label: 'Preview a PR',
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
			label: 'Import zip',
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
		creationFocusTargetRef.current = undefined;
		setAutofocusWriteOwn(false);
		setIsGitHubImportDetailsOpen(false);
		setActiveCreationTab(nextId);
		document.getElementById(`creation-tab-${nextId}`)?.focus();
	};

	const handleCreationTabPointerDown = (
		event: React.PointerEvent<HTMLButtonElement>
	) => {
		creationTabPointerTypeRef.current = event.pointerType;
	};

	const handleCreationTabClick = (tabId: CreationTabId) => {
		// `click` also fires for keyboard activation. Pair it with pointer type so
		// only a real mouse click receives the typing convenience.
		const pointerType = creationTabPointerTypeRef.current;
		const activatedWithMouse = pointerType === 'mouse';
		creationTabPointerTypeRef.current = undefined;
		focusCreationFieldAfterMouseClickRef.current =
			activatedWithMouse && tabId !== activeCreationTab;
		creationFocusTargetRef.current = undefined;
		setAutofocusWriteOwn(activatedWithMouse && tabId === 'write-own');
		setIsGitHubImportDetailsOpen(false);
		setActiveCreationTab(tabId);
	};

	const inactiveStoredSites = storedSites.filter(
		(site) => site.slug !== activeSite?.slug
	);
	const recentSites = inactiveStoredSites.filter(isRestorableAutosavedSite);
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
	// two save destinations — "Save in browser storage" (OPFS) and "Save in a
	// local directory…" — above Rename / Delete. Clicking anywhere on the row switches
	// to it. The menu only lists what applies to that Playground's storage.
	function renderRowActions(site: SiteInfo) {
		const isAutosave = isAutosavedSite(site);
		const isTemporary = site.metadata.storage === 'none';
		const isStored = !isTemporary;
		// Temporary and autosaved Playgrounds live in the browser and can be
		// stored permanently in the browser (OPFS) and/or copied to a local
		// directory. Already-saved and local-directory Playgrounds can't.
		const canStoreInBrowser =
			(isTemporary || isAutosave) && isOpfsAvailable;
		const canSaveToLocal =
			(isTemporary || isAutosave) && localFsAvailability === 'available';
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
					toggleProps={{ disabled: isImportingZip }}
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
											Save in browser storage
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
							{site.metadata.storage === 'opfs' && (
								<MenuGroup>
									<MenuItem icon={check} disabled>
										Saved in browser storage
									</MenuItem>
								</MenuGroup>
							)}
							{site.metadata.storage === 'local-fs' && (
								<MenuGroup>
									<MenuItem icon={check} disabled>
										Saved in a local directory
									</MenuItem>
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
				<TruncatedText className={css.siteRowName}>
					{site.metadata.name}
				</TruncatedText>
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
		const rowButtonProps =
			isEditing || isImportingZip
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
					<SitePreview site={site} />
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
					<SitePreview site={site} />
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
				{savedSites.length > MAX_VISIBLE_STORED_SITES && (
					<button
						type="button"
						className={css.showMoreButton}
						disabled={isImportingZip}
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
		// start, then the code/import flows. Most have a quiet secondary heading.
		const activeMethod = creationMethods.find(
			(method) => method.id === activeCreationTab
		);
		const isGitHubImportOpen =
			activeCreationTab === 'github' && isGitHubImportDetailsOpen;
		// The roving Tab stop must land on an ENABLED tab. If the active tab is a
		// network source that just went offline (disabled), a disabled element with
		// tabIndex=0 is dropped from the focus order — which would leave the tablist
		// with no Tab stop at all. Fall back to the first enabled tab ('gallery' is
		// always enabled and first, so this always resolves). All tabs are
		// intentionally disabled while a zip import owns the pane.
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
					hidden={isGitHubImportOpen}
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
							onPointerDown={handleCreationTabPointerDown}
							onClick={() => handleCreationTabClick(method.id)}
							onKeyDown={handleCreationTabKeyDown}
							disabled={method.disabled || isImportingZip}
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
					className={classNames(css.creationPanel, {
						[css.creationPanelDedicated]: isGitHubImportOpen,
					})}
					ref={creationPanelRef}
					role={isGitHubImportOpen ? 'region' : 'tabpanel'}
					aria-label={
						isGitHubImportOpen
							? activeMethod?.panelTitle
							: undefined
					}
					aria-labelledby={
						isGitHubImportOpen
							? undefined
							: `creation-tab-${activeCreationTab}`
					}
				>
					{!isGitHubImportOpen && activeMethod?.panelTitle && (
						<div className={css.panelHeader}>
							<h3
								id="creation-panel-title"
								className={css.panelTitle}
							>
								{activeMethod?.panelTitle}
							</h3>
						</div>
					)}
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
					<div className={css.blueprintsError} role="alert">
						<span
							className={css.blueprintsErrorIcon}
							aria-hidden="true"
						>
							<Icon icon={offlineIcon} size={16} />
						</span>
						<div>
							<p className={css.blueprintsErrorTitle}>
								The Blueprint gallery couldn’t load
							</p>
							<p className={css.blueprintsErrorMessage}>
								Check your internet connection and try again.
							</p>
						</div>
					</div>
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
							{activeSite?.metadata.storage === 'none' ? (
								<>
									Tweak this Playground's Blueprint, then
									create a new Playground from it — or
									continue in the full Blueprint editor for a
									file tree and more room.{' '}
								</>
							) : (
								<>
									Create a new Playground from this draft. The
									full Blueprint editor opens this
									Playground's stored Blueprint instead.{' '}
								</>
							)}
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
								disabled={isImportingZip}
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
									config={{
										initialDoc: writeOwnDraft,
										onChange: setWriteOwnDraft,
										autofocus: autofocusWriteOwn,
									}}
								/>
							</Suspense>
						</div>
						<div className={css.inlineFormActions}>
							<Button
								variant="primary"
								onClick={createFromEditor}
								disabled={isImportingZip || !isWriteOwnValid}
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
							showRepositoryDetails={isGitHubImportDetailsOpen}
							onRepositoryResolved={() => {
								creationFocusTargetRef.current = 'back';
								setIsGitHubImportDetailsOpen(true);
							}}
							getPlaygroundBeforeImport={
								createSiteForGitHubImport
							}
							onClose={() => setActiveCreationTab('gallery')}
							onImported={(details) => {
								githubExportSession.recordImport(details);
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
								disabled={
									isImportingZip || !blueprintUrlInput.trim()
								}
							>
								Create Playground
							</Button>
						</div>
					</form>
				);
			case 'zip':
				return (
					<>
						{isDraggingZip &&
							createPortal(
								<div
									className={css.zipDropOverlay}
									data-cy="zip-drop-overlay"
									aria-hidden="true"
								>
									<span className={css.zipDropOverlayIcon}>
										<Icon icon={upload} size={56} />
									</span>
									<span className={css.zipDropOverlayTitle}>
										Drop a Playground ZIP here
									</span>
								</div>,
								document.body
							)}
						<div className={css.inlineForm}>
							<p className={css.inlineFormHint}>
								Import a WordPress Playground <code>.zip</code>{' '}
								export to start a new Playground from it.
							</p>
							<button
								type="button"
								className={css.zipDropzone}
								data-cy="restore-from-zip"
								disabled={isImportingZip}
								onClick={() => zipFileInputRef.current?.click()}
							>
								<span className={css.zipDropzoneIcon}>
									<Icon icon={upload} size={32} />
								</span>
								<span className={css.zipDropzoneTitle}>
									Drop a Playground ZIP here
								</span>
								<span className={css.zipDropzoneHint}>
									or click to choose a file
								</span>
							</button>
							{zipImportError && (
								<div
									className={classNames(
										css.zipImportStatus,
										css.zipImportError
									)}
									role="alert"
								>
									{zipImportError}
								</div>
							)}
						</div>
					</>
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
				disabled={isImportingZip}
				aria-label={
					blueprint.isVanilla
						? 'Vanilla WordPress - New Playground'
						: undefined
				}
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
					<TruncatedText className={css.blueprintPreviewTitle}>
						{blueprint.title ?? blueprint.path}
					</TruncatedText>
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
			ref={panelRootRef}
			className={classNames(css.playgroundsPane, {
				[css.newPane]: panel === 'new',
			})}
		>
			<input
				type="file"
				ref={zipFileInputRef}
				onChange={handleImportZip}
				accept=".zip,application/zip"
				className={css.zipFileInput}
			/>
			{panel !== 'new' && renderYourPlaygroundsSection()}
			{panel !== 'playgrounds' && renderNewPlaygroundSection()}
		</div>
	);
}

function SitePreview({ site }: { site: SiteInfo }) {
	return (
		<div
			className={classNames(css.siteRowPreview, {
				[css.siteRowPreviewFallback]: !site.metadata.thumbnail,
			})}
		>
			{site.metadata.thumbnail ? (
				<img
					className={css.siteRowThumbnail}
					src={getSiteImageDataURL(site.metadata.thumbnail)}
					alt=""
					data-site-thumbnail
				/>
			) : (
				<div className={css.siteRowLogo}>
					{site.metadata.logo ? (
						<img
							src={getSiteImageDataURL(site.metadata.logo)}
							alt=""
						/>
					) : (
						<WordPressIcon />
					)}
				</div>
			)}
		</div>
	);
}

function getSiteImageDataURL(image: SiteImage) {
	return `data:${image.mime};base64,${image.data}`;
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

function isCreationTabDisabled(tab: CreationTabId, offline: boolean) {
	return (
		offline &&
		(tab === 'blueprint-url' || tab === 'github' || tab === 'pull-request')
	);
}

function getOpfsSyncProgressPercent(progress: {
	files: number;
	total: number;
}) {
	if (progress.total <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((progress.files / progress.total) * 100));
}
