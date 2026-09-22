import css from './style.module.css';

import type { PlaygroundReduxState } from '../../lib/state/redux/store';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { GitHubOAuthGuardModal } from '../../github/github-oauth-guard';
import {
	GitHubExportSessionProvider,
	useGitHubExportSession,
} from '../../github/github-export-session';
import { LogModal } from '../log-modal';
import { StartErrorModal } from '../start-error-modal';
import type { DisplayMode } from '../playground-viewport';
import {
	supportedDisplayModes,
	PlaygroundViewport,
} from '../playground-viewport';
import { MissingSiteModal } from '../missing-site-modal';
import { RenameSiteModal } from '../rename-site-modal';
import { DeleteSiteModal } from '../delete-site-modal';
import { SaveSiteModal } from '../save-site-modal';
import { modalSlugs, setDockPaneOpen } from '../../lib/state/redux/slice-ui';
import { GitHubPrivateRepoAuthModal } from '../github-private-repo-auth-modal';
import { BlueprintUrlModal } from '../blueprint-url-modal';
import { ModalLoadingFallback } from '../modal-loading-fallback';
import { Dock } from '../dock';
import classNames from 'classnames';

/**
 * Lazy modal wrapper component to reduce Suspense repetition
 */
function LazyModal({ children }: { children: React.ReactNode }) {
	return <Suspense fallback={<ModalLoadingFallback />}>{children}</Suspense>;
}

// Lazy-loaded heavy modals for code splitting
const GithubExportModal = lazy(() =>
	import('../../github/github-export-form').then((m) => ({
		default: m.GithubExportModal,
	}))
);

const GithubImportModal = lazy(() =>
	import('../../github/github-import-form').then((m) => ({
		default: m.GithubImportModal,
	}))
);

const PreviewPRModal = lazy(() =>
	import('../../github/preview-pr').then((m) => ({
		default: m.PreviewPRModal,
	}))
);

const displayMode = getDisplayModeFromQuery();
function getDisplayModeFromQuery(): DisplayMode {
	const query = new URLSearchParams(document.location.search);
	return supportedDisplayModes.includes(query.get('mode') as any)
		? (query.get('mode') as DisplayMode)
		: 'browser-full-screen';
}

export function Layout() {
	const dockPaneIsOpen = useAppSelector((state) => state.ui.dockPaneIsOpen);
	const dispatch = useAppDispatch();
	const [paneCloseBlocked, setPaneCloseBlocked] = useState(false);
	const siteViewContentRef = useRef<HTMLDivElement>(null);
	const showDock = displayMode !== 'seamless';

	// React 18 does not forward inert. Set it on the preview explicitly so an
	// obscured WordPress iframe also leaves the keyboard and accessibility trees.
	useEffect(() => {
		const siteViewContent = siteViewContentRef.current;
		if (!siteViewContent) {
			return;
		}
		if (showDock && dockPaneIsOpen) {
			siteViewContent.setAttribute('inert', '');
		} else {
			siteViewContent.removeAttribute('inert');
		}
	}, [showDock, dockPaneIsOpen]);

	/** Closes the active pane unless its current operation owns the surface. */
	const closeDockPane = () => {
		if (!paneCloseBlocked) {
			dispatch(setDockPaneOpen(false));
		}
	};

	return (
		<GitHubExportSessionProvider>
			<div
				className={classNames(css.layout, {
					[css.hasDockPane]: showDock && dockPaneIsOpen,
				})}
			>
				<Modals />
				<div className={css.siteView}>
					<div
						ref={siteViewContentRef}
						className={classNames(css.siteViewContent, {
							[css.siteViewContentBlurred]:
								showDock && dockPaneIsOpen,
						})}
					>
						<PlaygroundViewport displayMode={displayMode} />
					</div>
					{showDock && (
						<button
							type="button"
							className={classNames(css.previewDismiss, {
								[css.previewDismissVisible]: dockPaneIsOpen,
							})}
							aria-label="Close Playground tools"
							aria-hidden={dockPaneIsOpen ? undefined : true}
							tabIndex={dockPaneIsOpen ? 0 : -1}
							disabled={paneCloseBlocked}
							onClick={closeDockPane}
						/>
					)}
				</div>
				{showDock && (
					<Dock
						paneCloseBlocked={paneCloseBlocked}
						onPaneCloseBlockedChange={setPaneCloseBlocked}
					/>
				)}
			</div>
		</GitHubExportSessionProvider>
	);
}

/**
 * Renders the currently active modal. Some modals are lazy loaded
 * to reduce the initial bundle size. Every button that would open
 * those modals must be disabled in the offline mode or else the
 * UI will go blank when the user tries to open them.
 *
 * @TODO: Think through a mobile-friendly modal architecture that
 * doesn't stack modals, allows dismissing, and understands some
 * modals (e.g. fatal error report) might have priority over other
 * modals (e.g. connect to GitHub). Discuss whether modals should
 * be declared at the top level, like here, or contextual to where
 * the "Show modal" button is rendered.
 */
function Modals() {
	const githubExportSession = useGitHubExportSession();

	const currentModal = useAppSelector(
		(state: PlaygroundReduxState) => state.ui.activeModal
	);

	if (currentModal === modalSlugs.LOG) {
		return <LogModal />;
	} else if (currentModal === modalSlugs.START_ERROR) {
		return <StartErrorModal />;
	} else if (currentModal === modalSlugs.MISSING_SITE_PROMPT) {
		return <MissingSiteModal />;
	} else if (currentModal === modalSlugs.RENAME_SITE) {
		return <RenameSiteModal />;
	} else if (currentModal === modalSlugs.DELETE_SITE) {
		return <DeleteSiteModal />;
	} else if (currentModal === modalSlugs.SAVE_SITE) {
		return <SaveSiteModal />;
	} else if (currentModal === modalSlugs.GITHUB_PRIVATE_REPO_AUTH) {
		return <GitHubPrivateRepoAuthModal />;
	} else if (currentModal === modalSlugs.BLUEPRINT_URL) {
		return <BlueprintUrlModal />;
	}

	if (currentModal === modalSlugs.PREVIEW_PR_WP) {
		return (
			<LazyModal>
				<PreviewPRModal target="wordpress" />
			</LazyModal>
		);
	} else if (currentModal === modalSlugs.PREVIEW_PR_GUTENBERG) {
		return (
			<LazyModal>
				<PreviewPRModal target="gutenberg" />
			</LazyModal>
		);
	} else if (
		currentModal === modalSlugs.GITHUB_IMPORT ||
		currentModal === modalSlugs.GITHUB_IMPORT_NEW_SITE
	) {
		return (
			<LazyModal>
				<GithubImportModal
					createNewSiteBeforeImport={
						currentModal === modalSlugs.GITHUB_IMPORT_NEW_SITE
					}
					onImported={githubExportSession.recordImport}
				/>
			</LazyModal>
		);
	} else if (currentModal === modalSlugs.GITHUB_EXPORT) {
		return (
			<LazyModal>
				<GithubExportModal
					allowZipExport={githubExportSession.allowZipExport}
					initialValues={githubExportSession.values}
					initialFilesBeforeChanges={
						githubExportSession.filesBeforeChanges
					}
					onExported={(_prUrl, formValues) =>
						githubExportSession.recordExport(formValues)
					}
				/>
			</LazyModal>
		);
	}

	const shouldEnsureGitHubAuth =
		new URL(document.location.href).searchParams.get('gh-ensure-auth') ===
		'yes';
	if (shouldEnsureGitHubAuth) {
		return <GitHubOAuthGuardModal />;
	}

	return;
}
