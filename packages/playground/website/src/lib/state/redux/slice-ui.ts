import type { PayloadAction, Middleware } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { BlueprintStepExecutionError } from '@wp-playground/blueprints';
import { BREAKPOINTS } from '../../constants/breakpoints';
import { readAutosaveNudgeMuted } from '../../autosave-nudge-muted';
import { readDockFullWidth } from '../../dock-full-width';

export type SiteError =
	| 'directory-handle-not-found-in-indexeddb'
	| 'directory-handle-permission-denied'
	| 'directory-handle-directory-does-not-exist'
	| 'directory-handle-unknown-error'
	| 'initial-opfs-sync-interrupted'
	// @TODO: Improve name?
	| 'site-boot-failed'
	// A stored save whose initial copy never finished, so core WordPress files
	// are missing and it can't boot. The lost files aren't recoverable.
	| 'incomplete-save'
	| 'github-artifact-expired'
	| 'blueprint-fetch-failed'
	| 'blueprint-filesystem-required'
	| 'blueprint-validation-failed'
	| 'network-firewall-interference'
	| 'resource-download-failed';

export type SiteManagerSection =
	| 'sidebar'
	| 'site-details'
	| 'playgrounds'
	| 'new'
	| 'settings'
	| 'files'
	| 'blueprint'
	| 'database'
	| 'logs'
	| 'share'
	| 'save'
	| 'blueprints';

export const modalSlugs = {
	LOG: 'log',
	ERROR_REPORT: 'error-report',
	START_ERROR: 'start-error',
	GITHUB_IMPORT: 'github-import',
	GITHUB_IMPORT_NEW_SITE: 'github-import-new-site',
	GITHUB_EXPORT: 'github-export',
	GITHUB_PRIVATE_REPO_AUTH: 'github-private-repo-auth',
	PREVIEW_PR_WP: 'preview-pr-wordpress',
	PREVIEW_PR_GUTENBERG: 'preview-pr-gutenberg',
	MISSING_SITE_PROMPT: 'missing-site-prompt',
	SAVE_SITE: 'save-site',
	DELETE_SITE: 'delete-site',
	BLUEPRINT_URL: 'blueprint-url',
} as const;

export type SerializedPlainErrorDetails = {
	message?: string;
	name?: string;
	stack?: string;
	url?: string;
};

export interface SerializedBlueprintStepErrorDetails extends SerializedPlainErrorDetails {
	type: 'blueprint-step-error';
	stepNumber: number;
	step: Record<string, unknown>;
	messages: string[];
	rawMessage?: string;
}

export type SerializedSiteErrorDetails =
	| string
	| SerializedPlainErrorDetails
	| SerializedBlueprintStepErrorDetails;

const serializeSiteErrorDetails = (
	details?: unknown
): SerializedSiteErrorDetails | undefined => {
	if (details instanceof BlueprintStepExecutionError) {
		return {
			type: 'blueprint-step-error',
			stepNumber: details.stepNumber,
			step: details.step as Record<string, unknown>,
			messages: details.messages,
			rawMessage: details.message,
			message:
				details.cause instanceof Error
					? details.cause.message
					: details.message,
			name: details.name,
			stack: details.stack,
			url: findUrlInCauseChain(details),
		};
	}
	if (details instanceof Error) {
		return {
			message: details.message,
			name: details.name,
			stack: details.stack,
			url: findUrlInCauseChain(details),
		};
	}
	if (typeof details === 'string') {
		return details;
	}
	if (details === undefined || details === null) {
		return undefined;
	}
	if (typeof details === 'object') {
		const maybeMessage =
			'message' in details && typeof (details as any).message === 'string'
				? (details as any).message
				: undefined;
		const maybeName =
			'name' in details && typeof (details as any).name === 'string'
				? (details as any).name
				: undefined;
		const maybeStack =
			'stack' in details && typeof (details as any).stack === 'string'
				? (details as any).stack
				: undefined;
		const maybeUrl =
			'url' in details && typeof (details as any).url === 'string'
				? (details as any).url
				: undefined;
		if (maybeMessage || maybeName || maybeStack || maybeUrl) {
			return {
				message: maybeMessage,
				name: maybeName,
				stack: maybeStack,
				url: maybeUrl,
			};
		}
	}
	try {
		return JSON.stringify(details, null, 2);
	} catch {
		return String(details);
	}
};

function findUrlInCauseChain(error: Error): string | undefined {
	let current: unknown = error;
	const seen = new Set<Error>();
	while (current) {
		if (current instanceof Error) {
			if (seen.has(current)) {
				break;
			}
			seen.add(current);
		}
		if (
			typeof current === 'object' &&
			'url' in current &&
			typeof (current as any).url === 'string'
		) {
			return (current as any).url;
		}
		current = current instanceof Error ? current.cause : undefined;
	}
	return undefined;
}

export interface UIState {
	activeSite?: {
		slug: string;
		bootRetryKey?: number;
		error?: SiteError;
		errorDetails?: SerializedSiteErrorDetails;
	};
	activeModal: string | null;
	siteSlugToDelete?: string;
	/**
	 * Site the save modal operates on. Defaults to the active site when unset.
	 */
	siteSlugToSave?: string;
	githubAuthRepoUrl?: string;
	offline: boolean;
	siteManagerIsOpen: boolean;
	siteManagerSection: SiteManagerSection;
	/**
	 * Whether the current dock pane is running work that must not be hidden yet.
	 * The dock owns the pane contents, while the preview scrim lives in Layout,
	 * so this has to be shared instead of local component state.
	 */
	siteManagerPaneCloseBlocked: boolean;
	/**
	 * Draft kept by the New pane's "Write a Blueprint" editor so the user's
	 * in-progress Blueprint survives closing and reopening the pane (which
	 * unmounts it). Undefined means "use the starter Blueprint".
	 */
	writeOwnBlueprintDraft?: string;
	/**
	 * Slug of the Playground the New pane's "Write a Blueprint" editor was seeded
	 * from, so reopening the pane for the same Playground reuses the existing
	 * draft instead of reseeding it from the starter Blueprint.
	 */
	writeOwnSeededSlug?: string;
	/**
	 * Whether the Share pane is showing the inline "Export to GitHub" sub-view.
	 * The dock reads this to drop its own pane header so the sub-view shows a
	 * single header instead of two.
	 */
	shareExportOpen: boolean;
	/**
	 * Whether the dock is pinned full-width (docked to the bottom edge) rather
	 * than free-floating. The layout reads this to obscure the preview behind a
	 * docked pane.
	 */
	dockFullWidth: boolean;
	/**
	 * A recent autosave from the same setup URL that the user can restore.
	 * Surfaced as a popover anchored to the dock's Playgrounds tool.
	 */
	autosaveNudge?: {
		siteSlug: string;
		setupUrlFingerprint: string;
		whenCreated?: number;
	} | null;
	/**
	 * Whether the autosave nudge panel is currently shown. The nudge itself can
	 * stay set (so the dot on the Playgrounds tool persists) after the panel is
	 * closed, so panel visibility is tracked separately.
	 */
	autosaveNudgePanelOpen: boolean;
	/**
	 * Whether the user muted the proactive autosave cues (the nudge panel and the
	 * dot). Persisted across sessions; autosaves stay restorable from Your
	 * Playgrounds regardless.
	 */
	autosaveNudgeMuted: boolean;
	/**
	 * Setup-URL fingerprints the user declined to restore, so we don't reprompt
	 * for the same URL within this session.
	 */
	declinedAutosaveRestoreFingerprints: string[];
}

const query = new URL(document.location.href).searchParams;
const isEmbeddedInAnIframe = window.self !== window.top;

const shouldOpenSiteManagerByDefault = false;

const initialState: UIState = {
	/**
	 * Don't show certain modals after a page refresh.
	 * The save-site and error-report modals should only be triggered by user actions,
	 * not by loading a URL with the modal parameter.
	 * The github-private-repo-auth modal should only be triggered by authentication errors,
	 * not by loading a URL with the modal parameter.
	 * The delete-site modal requires Redux state (siteSlugToDelete) that is not
	 * persisted in the URL, so it cannot be meaningfully restored from a URL
	 * parameter.
	 */
	activeModal:
		query.has('modal') &&
		shouldClearModalParamOnInitialLoad(query.get('modal'))
			? null
			: query.get('modal') || null,
	offline: !navigator.onLine,
	// NOTE: Please do not eliminate the cases in this siteManagerIsOpen expression,
	// even if they seem redundant. We may experiment which toggling the manager
	// to be open by default or closed by default, and we do not want to lose
	// specific reasons for the manager to be closed.
	siteManagerIsOpen:
		shouldOpenSiteManagerByDefault &&
		// The site manager should not be shown at all in seamless mode.
		query.get('mode') !== 'seamless' &&
		// We do not expect to render the Playground app UI in an iframe.
		!isEmbeddedInAnIframe &&
		// Don't default to the site manager on small screens (mobile/tablet),
		// as that would mean seeing something that's not Playground filling
		// your entire screen – quite a confusing experience.
		window.innerWidth >= BREAKPOINTS.tablet,
	siteManagerSection: 'site-details',
	siteManagerPaneCloseBlocked: false,
	shareExportOpen: false,
	dockFullWidth: readDockFullWidth(),
	autosaveNudge: null,
	autosaveNudgePanelOpen: false,
	autosaveNudgeMuted: readAutosaveNudgeMuted(),
	declinedAutosaveRestoreFingerprints: [],
};

const uiSlice = createSlice({
	name: 'ui',
	initialState,
	reducers: {
		setActiveSite: (state, action: PayloadAction<string | undefined>) => {
			state.activeSite = action.payload
				? {
						slug: action.payload,
						error: undefined,
						errorDetails: undefined,
					}
				: undefined;
		},
		setActiveSiteError: {
			reducer: (
				state,
				action: PayloadAction<{
					siteSlug?: string;
					error: SiteError;
					details?: SerializedSiteErrorDetails;
				}>
			) => {
				if (
					state.activeSite &&
					(!action.payload.siteSlug ||
						action.payload.siteSlug === state.activeSite.slug)
				) {
					state.activeSite.error = action.payload.error;
					state.activeSite.errorDetails = action.payload.details;
				}
			},
			prepare: (payload: {
				siteSlug?: string;
				error: SiteError;
				details?: unknown;
			}) => ({
				payload: {
					siteSlug: payload.siteSlug,
					error: payload.error,
					details: serializeSiteErrorDetails(payload.details),
				},
			}),
		},
		clearActiveSiteError: (state) => {
			if (state.activeSite) {
				state.activeSite.error = undefined;
				state.activeSite.errorDetails = undefined;
			}
		},
		retryActiveSiteBoot: (state) => {
			if (!state.activeSite) {
				return;
			}
			state.activeSite.error = undefined;
			state.activeSite.errorDetails = undefined;
			state.activeSite.bootRetryKey =
				(state.activeSite.bootRetryKey ?? 0) + 1;
		},
		setActiveModal: (state, action: PayloadAction<string | null>) => {
			const url = new URL(window.location.href);
			if (action.payload === null) {
				url.searchParams.delete('modal');
			} else {
				url.searchParams.set('modal', action.payload);
			}
			window.history.replaceState({}, '', url.href);

			state.activeModal = action.payload;
		},
		setGitHubAuthRepoUrl: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.githubAuthRepoUrl = action.payload;
		},
		setOffline: (state, action: PayloadAction<boolean>) => {
			state.offline = action.payload;
		},
		setSiteManagerOpen: (state, action: PayloadAction<boolean>) => {
			state.siteManagerIsOpen = action.payload;
		},
		setSiteManagerSection: (
			state,
			action: PayloadAction<SiteManagerSection>
		) => {
			state.siteManagerSection = action.payload;
		},
		setSiteManagerPaneCloseBlocked: (
			state,
			action: PayloadAction<boolean>
		) => {
			state.siteManagerPaneCloseBlocked = action.payload;
		},
		setWriteOwnBlueprintDraft: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.writeOwnBlueprintDraft = action.payload;
		},
		setWriteOwnSeededSlug: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.writeOwnSeededSlug = action.payload;
		},
		setShareExportOpen: (state, action: PayloadAction<boolean>) => {
			state.shareExportOpen = action.payload;
		},
		setDockFullWidth: (state, action: PayloadAction<boolean>) => {
			state.dockFullWidth = action.payload;
		},
		setSiteSlugToDelete: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.siteSlugToDelete = action.payload;
		},
		setSiteSlugToSave: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.siteSlugToSave = action.payload;
		},
		setAutosaveNudge: (
			state,
			action: PayloadAction<{
				siteSlug: string;
				setupUrlFingerprint: string;
				whenCreated?: number;
			}>
		) => {
			state.autosaveNudge = action.payload;
			// A fresh nudge auto-opens its panel once.
			state.autosaveNudgePanelOpen = true;
		},
		dismissAutosaveNudge: (state) => {
			state.autosaveNudge = null;
			state.autosaveNudgePanelOpen = false;
		},
		// Hide the nudge panel but keep the nudge itself set, so the dot on the
		// Playgrounds tool persists and the autosave stays one click away.
		closeAutosaveNudgePanel: (state) => {
			state.autosaveNudgePanelOpen = false;
		},
		setAutosaveNudgeMuted: (state, action: PayloadAction<boolean>) => {
			state.autosaveNudgeMuted = action.payload;
		},
		addDeclinedAutosaveRestoreFingerprint: (
			state,
			action: PayloadAction<string>
		) => {
			if (
				!state.declinedAutosaveRestoreFingerprints.includes(
					action.payload
				)
			) {
				state.declinedAutosaveRestoreFingerprints.push(action.payload);
			}
		},
	},
});

export const __internal_uiSlice = uiSlice;

let ranOnce = false;
export const listenToOnlineOfflineEventsMiddleware: Middleware =
	(store) => (next) => (action) => {
		if (!ranOnce) {
			ranOnce = true;
			if (typeof window !== 'undefined') {
				window.addEventListener('online', () => {
					store.dispatch(uiSlice.actions.setOffline(false));
				});
				window.addEventListener('offline', () => {
					store.dispatch(uiSlice.actions.setOffline(true));
				});
			}
			/**
			 * Hide certain modals on page load and remove them from the URL.
			 * These modals should only be triggered by user actions, not by
			 * loading a URL with the modal parameter.
			 */
			if (
				query.has('modal') &&
				shouldClearModalParamOnInitialLoad(query.get('modal'))
			) {
				setTimeout(() => {
					store.dispatch(uiSlice.actions.setActiveModal(null));
				}, 0);
			}
		}
		const result = next(action);
		if (
			uiSlice.actions.setSiteManagerOpen.match(action) &&
			action.payload === false
		) {
			clearSiteManagerUrlParams();
		}
		return result;
	};

function clearSiteManagerUrlParams() {
	if (typeof window === 'undefined') {
		return;
	}
	const url = new URL(window.location.href);
	if (
		!url.searchParams.has('overlay') &&
		!url.searchParams.has('page-title')
	) {
		return;
	}
	url.searchParams.delete('overlay');
	url.searchParams.delete('page-title');
	window.history.replaceState({}, '', url.href);
}

function shouldClearModalParamOnInitialLoad(modal: string | null) {
	return (
		modal === modalSlugs.ERROR_REPORT ||
		modal === modalSlugs.SAVE_SITE ||
		modal === modalSlugs.GITHUB_PRIVATE_REPO_AUTH ||
		modal === modalSlugs.DELETE_SITE ||
		// Old URLs can still contain the removed rename modal. Leaving that
		// unknown modal in Redux blocks Escape-close handlers even though no
		// modal is visible.
		modal === 'rename-site'
	);
}

export const {
	setActiveModal,
	setActiveSiteError,
	clearActiveSiteError,
	retryActiveSiteBoot,
	setGitHubAuthRepoUrl,
	setOffline,
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteManagerPaneCloseBlocked,
	setWriteOwnBlueprintDraft,
	setWriteOwnSeededSlug,
	setShareExportOpen,
	setDockFullWidth,
	setSiteSlugToDelete,
	setSiteSlugToSave,
	setAutosaveNudge,
	dismissAutosaveNudge,
	closeAutosaveNudgePanel,
	setAutosaveNudgeMuted,
	addDeclinedAutosaveRestoreFingerprint,
} = uiSlice.actions;

export default uiSlice.reducer;
