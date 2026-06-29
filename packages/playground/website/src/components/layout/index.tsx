import css from './style.module.css';

import type { PlaygroundReduxState } from '../../lib/state/redux/store';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import type { ExportFormValues } from '../../github/github-export-form/form';
import { asPullRequestAction } from '../../github/github-export-form/form';
import { GitHubOAuthGuardModal } from '../../github/github-oauth-guard';
import { asContentType } from '../../github/import-from-github';
import { LogModal } from '../log-modal';
import { StartErrorModal } from '../start-error-modal';
import type { DisplayMode } from '../playground-viewport';
import {
	supportedDisplayModes,
	PlaygroundViewport,
} from '../playground-viewport';
import { MissingSiteModal } from '../missing-site-modal';
import { DeleteSiteModal } from '../delete-site-modal';
import { SaveSiteModal } from '../save-site-modal';
import {
	modalSlugs,
	setSiteManagerOpen,
	setSiteManagerSection,
} from '../../lib/state/redux/slice-ui';
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
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const dockFullWidth = useAppSelector((state) => state.ui.dockFullWidth);
	const dispatch = useAppDispatch();
	const showDock = displayMode !== 'seamless';

	useEffect(() => {
		const overlayParam = new URL(document.location.href).searchParams.get(
			'overlay'
		);
		if (!showDock || overlayParam === null) {
			return;
		}
		dispatch(
			setSiteManagerSection(
				overlayParam === 'blueprints' ? 'new' : 'playgrounds'
			)
		);
		dispatch(setSiteManagerOpen(true));
	}, [dispatch, showDock]);

	const closeDockPane = () => {
		dispatch(setSiteManagerOpen(false));
		clearOverlayQueryParam();
	};

	// While a dock pane is open the preview is visually obscured (blurred,
	// pointer-events:none). Mark it `inert` too so the hidden WordPress iframe
	// also leaves the keyboard tab order and the accessibility tree — especially
	// important on mobile where the pane is full-screen. `inert` is set
	// imperatively because React 18 does not forward it as a prop.
	const siteViewContentRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = siteViewContentRef.current;
		if (!element) {
			return;
		}
		if (showDock && siteManagerIsOpen) {
			element.setAttribute('inert', '');
		} else {
			element.removeAttribute('inert');
		}
	}, [showDock, siteManagerIsOpen]);

	return (
		<div
			className={classNames(css.layout, {
				[css.hasDockPane]: showDock && siteManagerIsOpen,
				[css.dockDocked]: showDock && dockFullWidth,
			})}
		>
			<Modals />
			<div className={css.siteView}>
				<div
					ref={siteViewContentRef}
					className={classNames(css.siteViewContent, {
						[css.siteViewContentBlurred]:
							showDock && siteManagerIsOpen,
					})}
				>
					<PlaygroundViewport displayMode={displayMode} />
				</div>
				{showDock && (
					<button
						type="button"
						className={classNames(css.previewDismiss, {
							[css.previewDismissVisible]: siteManagerIsOpen,
						})}
						// Pointer-only click-outside scrim. Hidden from assistive
						// tech and the tab order (so it's never a hidden tab stop
						// behind the full-screen mobile pane); keyboard users close
						// the pane with Escape or its X.
						aria-hidden="true"
						tabIndex={-1}
						onClick={closeDockPane}
					/>
				)}
			</div>
			{showDock && <Dock />}
		</div>
	);
}

function clearOverlayQueryParam() {
	const url = new URL(window.location.href);
	if (!url.searchParams.has('overlay')) {
		return;
	}
	url.searchParams.delete('overlay');
	window.history.replaceState({}, '', url.toString());
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
	const query = new URL(document.location.href).searchParams;

	const [githubExportFiles, setGithubExportFiles] = useState<any[]>();
	const [githubExportValues, setGithubExportValues] = useState<
		Partial<ExportFormValues>
	>(() => {
		const values: Partial<ExportFormValues> = {};
		if (query.get('ghexport-repo-url')) {
			values.repoUrl = query.get('ghexport-repo-url')!;
		}
		if (query.get('ghexport-content-type')) {
			values.contentType = asContentType(
				query.get('ghexport-content-type')
			);
		}
		if (query.get('ghexport-pr-action')) {
			values.prAction = asPullRequestAction(
				query.get('ghexport-pr-action')
			);
		}
		if (query.get('ghexport-pr-number')) {
			values.prNumber = query.get('ghexport-pr-number')?.toString();
		}
		if (query.get('ghexport-playground-root')) {
			values.fromPlaygroundRoot = query.get('ghexport-playground-root')!;
		}
		if (query.get('ghexport-repo-root')) {
			values.toPathInRepo = query.get('ghexport-repo-root')!;
		}
		if (query.get('ghexport-path')) {
			values.relativeExportPaths = query.getAll('ghexport-path');
		}
		if (query.get('ghexport-commit-message')) {
			values.commitMessage = query.get('ghexport-commit-message')!;
		}
		if (query.get('ghexport-plugin')) {
			values.plugin = query.get('ghexport-plugin')!;
		}
		if (query.get('ghexport-theme')) {
			values.theme = query.get('ghexport-theme')!;
		}
		return values;
	});

	const currentModal = useAppSelector(
		(state: PlaygroundReduxState) => state.ui.activeModal
	);

	if (currentModal === modalSlugs.LOG) {
		return <LogModal />;
	} else if (currentModal === modalSlugs.START_ERROR) {
		return <StartErrorModal />;
	} else if (currentModal === modalSlugs.MISSING_SITE_PROMPT) {
		return <MissingSiteModal />;
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
					onImported={({
						url,
						path,
						files,
						pluginOrThemeName,
						contentType,
						urlInformation: { owner, repo, type, pr },
					}) => {
						setGithubExportValues({
							repoUrl: url,
							prNumber: pr?.toString(),
							toPathInRepo: path,
							prAction: pr ? 'update' : 'create',
							contentType,
							plugin: pluginOrThemeName,
							theme: pluginOrThemeName,
						});
						setGithubExportFiles(files);
					}}
				/>
			</LazyModal>
		);
	} else if (currentModal === modalSlugs.GITHUB_EXPORT) {
		return (
			<LazyModal>
				<GithubExportModal
					allowZipExport={
						(query.get('ghexport-allow-include-zip') ?? 'yes') ===
						'yes'
					}
					initialValues={githubExportValues}
					initialFilesBeforeChanges={githubExportFiles}
					onExported={(prUrl, formValues) => {
						setGithubExportValues(formValues);
						setGithubExportFiles(undefined);
					}}
				/>
			</LazyModal>
		);
	}

	if (query.get('gh-ensure-auth') === 'yes') {
		return <GitHubOAuthGuardModal />;
	}

	return;
}
