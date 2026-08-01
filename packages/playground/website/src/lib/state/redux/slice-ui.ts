import type { PayloadAction, Middleware } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { BlueprintStepExecutionError } from '@wp-playground/blueprints';
import { BREAKPOINTS } from '../../constants/breakpoints';

export type SiteError =
	| 'directory-handle-not-found-in-indexeddb'
	| 'directory-handle-permission-denied'
	| 'directory-handle-directory-does-not-exist'
	| 'directory-handle-unknown-error'
	| 'browser-storage-cleanup-failed'
	| 'initial-opfs-sync-interrupted'
	// @TODO: Improve name?
	| 'site-boot-failed'
	| 'github-artifact-expired'
	| 'blueprint-fetch-failed'
	| 'blueprint-filesystem-required'
	| 'blueprint-validation-failed'
	| 'network-firewall-interference'
	| 'resource-download-failed';

export type DockPaneSection =
	| 'new'
	| 'playgrounds'
	| 'blueprint'
	| 'settings'
	| 'database'
	| 'files'
	| 'logs'
	| 'share'
	| 'save';

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
	RENAME_SITE: 'rename-site',
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
		error?: SiteError;
		errorDetails?: SerializedSiteErrorDetails;
	};
	activeModal: string | null;
	siteSlugToRename?: string;
	siteSlugToDelete?: string;
	/**
	 * Site the save modal operates on. Defaults to the active site when unset.
	 */
	siteSlugToSave?: string;
	githubAuthRepoUrl?: string;
	offline: boolean;
	shareExportOpen: boolean;
	dockPaneIsOpen: boolean;
	dockPaneSection: DockPaneSection;
	/**
	 * Draft kept by the New pane's "Write a Blueprint" editor so closing the
	 * pane does not discard the user's work.
	 */
	writeOwnBlueprintDraft?: string;
	/** Playground slug from which the current authoring draft was seeded. */
	writeOwnSeededSlug?: string;
	dockOperationNotice?: {
		title: string;
		message?: string;
	};
}

const query = new URL(document.location.href).searchParams;
const isEmbeddedInAnIframe = window.self !== window.top;

const shouldOpenDockPaneByDefault = false;

const initialState: UIState = {
	/**
	 * Don't show certain modals after a page refresh.
	 * The save-site and error-report modals should only be triggered by user actions,
	 * not by loading a URL with the modal parameter.
	 * The github-private-repo-auth modal should only be triggered by authentication errors,
	 * not by loading a URL with the modal parameter.
	 * The delete-site and rename-site modals require Redux state (siteSlugToDelete /
	 * siteSlugToRename) that is not persisted in the URL, so they cannot be meaningfully
	 * restored from a URL parameter.
	 */
	activeModal:
		query.get('modal') === 'error-report' ||
		query.get('modal') === 'save-site' ||
		query.get('modal') === 'github-private-repo-auth' ||
		query.get('modal') === 'delete-site' ||
		query.get('modal') === 'rename-site'
			? null
			: query.get('modal') || null,
	offline: !navigator.onLine,
	shareExportOpen: false,
	// NOTE: Please do not eliminate the cases in this dockPaneIsOpen expression,
	// even if they seem redundant. We may experiment with toggling the Dock
	// pane to be open by default or closed by default, and we do not want to
	// lose specific reasons for the Dock pane to be closed.
	dockPaneIsOpen:
		// The Dock pane should not be shown at all in seamless mode.
		query.get('mode') !== 'seamless' &&
		(query.get('overlay') !== null ||
			(shouldOpenDockPaneByDefault &&
				// We do not expect to render the Playground app UI in an iframe.
				!isEmbeddedInAnIframe &&
				// Don't default to the Dock pane on small screens (mobile/tablet),
				// as that would mean seeing something that's not Playground filling
				// your entire screen – quite a confusing experience.
				window.innerWidth >= BREAKPOINTS.tablet)),
	dockPaneSection:
		query.get('overlay') === 'blueprints' || query.get('overlay') === 'new'
			? 'new'
			: query.get('overlay') !== null
				? 'playgrounds'
				: 'settings',
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
					error: SiteError;
					details?: SerializedSiteErrorDetails;
				}>
			) => {
				if (state.activeSite) {
					state.activeSite.error = action.payload.error;
					state.activeSite.errorDetails = action.payload.details;
				}
			},
			prepare: (payload: { error: SiteError; details?: unknown }) => ({
				payload: {
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
		setDockPaneOpen: (state, action: PayloadAction<boolean>) => {
			state.dockPaneIsOpen = action.payload;
		},
		setShareExportOpen: (state, action: PayloadAction<boolean>) => {
			state.shareExportOpen = action.payload;
		},
		setDockPaneSection: (state, action: PayloadAction<DockPaneSection>) => {
			state.dockPaneSection = action.payload;
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
		setDockOperationNotice: (
			state,
			action: PayloadAction<UIState['dockOperationNotice']>
		) => {
			state.dockOperationNotice = action.payload;
		},
		setSiteSlugToRename: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.siteSlugToRename = action.payload;
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
				query.get('modal') === 'error-report' ||
				query.get('modal') === 'save-site' ||
				query.get('modal') === 'github-private-repo-auth'
			) {
				setTimeout(() => {
					store.dispatch(uiSlice.actions.setActiveModal(null));
				}, 0);
			}
		}
		return next(action);
	};

export const {
	setActiveModal,
	setActiveSiteError,
	clearActiveSiteError,
	setGitHubAuthRepoUrl,
	setOffline,
	setShareExportOpen,
	setDockPaneOpen,
	setDockPaneSection,
	setWriteOwnBlueprintDraft,
	setWriteOwnSeededSlug,
	setDockOperationNotice,
	setSiteSlugToRename,
	setSiteSlugToDelete,
	setSiteSlugToSave,
} = uiSlice.actions;

export default uiSlice.reducer;
