import css from './style.module.css';

import { SiteManager } from '../site-manager';
import { CSSTransition } from 'react-transition-group';
import type { PlaygroundReduxState } from '../../lib/state/redux/store';
import { useAppSelector } from '../../lib/state/redux/store';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import { useState, useEffect, useRef } from 'react';
import { acquireOAuthTokenIfNeeded } from '../../github/acquire-oauth-token-if-needed';
import { GithubExportModal } from '../../github/github-export-form';
import type { ExportFormValues } from '../../github/github-export-form/form';
import { asPullRequestAction } from '../../github/github-export-form/form';
import { GithubImportModal } from '../../github/github-import-form';
import { GitHubOAuthGuardModal } from '../../github/github-oauth-guard';
import { asContentType } from '../../github/import-from-github';
import { LogModal } from '../log-modal';
import { StartErrorModal } from '../start-error-modal';
import type { DisplayMode } from '../playground-viewport';
import {
	supportedDisplayModes,
	PlaygroundViewport,
} from '../playground-viewport';
import { ImportFormModal } from '../import-form-modal';
import { PreviewPRModal } from '../../github/preview-pr';
import { MissingSiteModal } from '../missing-site-modal';
import { RenameSiteModal } from '../rename-site-modal';
import { SaveSiteModal } from '../save-site-modal';
import { modalSlugs } from '../../lib/state/redux/slice-ui';
import { GitHubPrivateRepoAuthModal } from '../github-private-repo-auth-modal';

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
 * @TODO: Think through a mobile-friendly modal architecture that doesn't stack modals,
 * allows dismissing, and understands some modals (e.g. fatal error report) might have priority
 * over other modals (e.g. connect to GitHub). Discuss whether modals should be declared at the
 * top level, like here, or contextual to where the "Show modal" button is rendered.
 */
function Modals(blueprint: BlueprintV1Declaration) {
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

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {}, []);

	const currentModal = useAppSelector(
		(state: PlaygroundReduxState) => state.ui.activeModal
	);

	if (currentModal === modalSlugs.LOG) {
		return <LogModal />;
	} else if (currentModal === modalSlugs.START_ERROR) {
		return <StartErrorModal />;
	} else if (currentModal === modalSlugs.IMPORT_FORM) {
		return <ImportFormModal />;
	} else if (currentModal === modalSlugs.PREVIEW_PR_WP) {
		return <PreviewPRModal target="wordpress" />;
	} else if (currentModal === modalSlugs.PREVIEW_PR_GUTENBERG) {
		return <PreviewPRModal target="gutenberg" />;
	} else if (currentModal === modalSlugs.GITHUB_IMPORT) {
		return (
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
		);
	} else if (currentModal === modalSlugs.GITHUB_EXPORT) {
		return (
			<GithubExportModal
				allowZipExport={
					(query.get('ghexport-allow-include-zip') ?? 'yes') === 'yes'
				}
				initialValues={githubExportValues}
				initialFilesBeforeChanges={githubExportFiles}
				onExported={(prUrl, formValues) => {
					setGithubExportValues(formValues);
					setGithubExportFiles(undefined);
				}}
			/>
		);
	} else if (currentModal === modalSlugs.MISSING_SITE_PROMPT) {
		return <MissingSiteModal />;
	} else if (currentModal === modalSlugs.RENAME_SITE) {
		return <RenameSiteModal />;
	} else if (currentModal === modalSlugs.SAVE_SITE) {
		return <SaveSiteModal />;
	} else if (currentModal === modalSlugs.GITHUB_PRIVATE_REPO_AUTH) {
		return <GitHubPrivateRepoAuthModal />;
	}

	if (query.get('gh-ensure-auth') === 'yes') {
		return <GitHubOAuthGuardModal />;
	}

	return;
}
