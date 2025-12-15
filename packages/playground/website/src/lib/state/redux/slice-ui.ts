import type { PayloadAction, Middleware } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { BlueprintStepExecutionError } from '@wp-playground/blueprints';

export type SiteError =
	| 'directory-handle-not-found-in-indexeddb'
	| 'directory-handle-permission-denied'
	| 'directory-handle-directory-does-not-exist'
	| 'directory-handle-unknown-error'
	// @TODO: Improve name?
	| 'site-boot-failed'
	| 'github-artifact-expired'
	| 'blueprint-fetch-failed'
	| 'blueprint-filesystem-required'
	| 'blueprint-validation-failed';

export type SiteManagerSection = 'sidebar' | 'site-details' | 'blueprints';

export const modalSlugs = {
	LOG: 'log',
	ERROR_REPORT: 'error-report',
	START_ERROR: 'start-error',
	GITHUB_IMPORT: 'github-import',
	GITHUB_EXPORT: 'github-export',
	GITHUB_PRIVATE_REPO_AUTH: 'github-private-repo-auth',
	PREVIEW_PR_WP: 'preview-pr-wordpress',
	PREVIEW_PR_GUTENBERG: 'preview-pr-gutenberg',
	MISSING_SITE_PROMPT: 'missing-site-prompt',
	RENAME_SITE: 'rename-site',
	SAVE_SITE: 'save-site',
	BLUEPRINT_URL: 'blueprint-url',
} as const;

export type SerializedPlainErrorDetails = {
	message?: string;
	name?: string;
	stack?: string;
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
		};
	}
	if (details instanceof Error) {
		return {
			message: details.message,
			name: details.name,
			stack: details.stack,
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
		if (maybeMessage || maybeName || maybeStack) {
			return {
				message: maybeMessage,
				name: maybeName,
				stack: maybeStack,
			};
		}
	}
	try {
		return JSON.stringify(details, null, 2);
	} catch {
		return String(details);
	}
};

export interface UIState {
	activeSite?: {
		slug: string;
		error?: SiteError;
		errorDetails?: SerializedSiteErrorDetails;
	};
	activeModal: string | null;
	siteSlugToRename?: string;
	githubAuthRepoUrl?: string;
	offline: boolean;
	siteManagerIsOpen: boolean;
	siteManagerSection: SiteManagerSection;
}

const query = new URL(document.location.href).searchParams;
const isEmbeddedInAnIframe = window.self !== window.top;
// @TODO: Centralize these breakpoint sizes.
const isMobile = window.innerWidth < 875;

const shouldOpenSiteManagerByDefault = false;

const initialState: UIState = {
	/**
	 * Don't show certain modals after a page refresh.
	 * The save-site and error-report modals should only be triggered by user actions,
	 * not by loading a URL with the modal parameter.
	 * The github-private-repo-auth modal should only be triggered by authentication errors,
	 * not by loading a URL with the modal parameter.
	 */
	activeModal:
		query.get('modal') === 'error-report' ||
		query.get('modal') === 'save-site' ||
		query.get('modal') === 'github-private-repo-auth'
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
		// Don't default to the site manager on mobile, as that would mean
		// seeing something that's not Playground filling your entire screen –
		// quite a confusing experience.
		!isMobile,
	siteManagerSection: 'site-details',
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
		setSiteManagerOpen: (state, action: PayloadAction<boolean>) => {
			state.siteManagerIsOpen = action.payload;
		},
		setSiteManagerSection: (
			state,
			action: PayloadAction<SiteManagerSection>
		) => {
			state.siteManagerSection = action.payload;
		},
		setSiteSlugToRename: (
			state,
			action: PayloadAction<string | undefined>
		) => {
			state.siteSlugToRename = action.payload;
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
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToRename,
} = uiSlice.actions;

export default uiSlice.reducer;
