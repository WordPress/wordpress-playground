import css from './style.module.css';

import { SiteManager } from '../site-manager';
import { CSSTransition } from 'react-transition-group';
import type { PlaygroundReduxState } from '../../lib/state/redux/store';
import { useAppSelector } from '../../lib/state/redux/store';
import { useState, useRef, lazy, Suspense } from 'react';
import { acquireOAuthTokenIfNeeded } from '../../github/acquire-oauth-token-if-needed';
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
import { RenameSiteModal } from '../rename-site-modal';
import { SaveSiteModal } from '../save-site-modal';
import { modalSlugs } from '../../lib/state/redux/slice-ui';
import { GitHubPrivateRepoAuthModal } from '../github-private-repo-auth-modal';
import { BlueprintUrlModal } from '../blueprint-url-modal';
import { ModalLoadingFallback } from '../modal-loading-fallback';

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

acquireOAuthTokenIfNeeded();
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
	const siteManagerWrapperRef = useRef<HTMLDivElement>(null);

	return (
		<div className={`${css.layout}`}>
			<Modals />
			<CSSTransition
				nodeRef={siteManagerWrapperRef}
				in={siteManagerIsOpen}
				timeout={500}
				classNames={{
					enter: css.siteManagerWrapperEnter,
					enterActive: css.siteManagerWrapperEnterActive,
					exit: css.siteManagerWrapperExit,
					exitActive: css.siteManagerWrapperExitActive,
				}}
				unmountOnExit
			>
				<div
					ref={siteManagerWrapperRef}
					className={css.siteManagerWrapper}
				>
					<SiteManager />
				</div>
			</CSSTransition>
			<div className={css.siteView}>
				<div className={css.siteViewContent}>
					<PlaygroundViewport displayMode={displayMode} />
				</div>
			</div>
		</div>
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
	} else if (currentModal === modalSlugs.RENAME_SITE) {
		return <RenameSiteModal />;
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
	} else if (currentModal === modalSlugs.GITHUB_IMPORT) {
		return (
			<LazyModal>
				<GithubImportModal
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
